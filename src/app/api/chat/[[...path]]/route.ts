import { NextResponse } from 'next/server';
import crypto from 'crypto';

const normalizeChatBackendUrl = (raw: string) => {
    const trimmed = raw.replace(/\/+$/, '');
    return trimmed.endsWith('/v1/chat') ? trimmed : `${trimmed}/v1/chat`;
};

const CHAT_BACKEND_URL = normalizeChatBackendUrl(process.env.CHAT_BACKEND_URL || 'http://localhost:8092/v1/chat');

/**
 * The chat proxy forwards the signed-in user's OWN access token.
 *
 * It used to hold CHAT_PROXY_SIGNING_SECRET — the platform's HS256
 * JWT_SECRET — and mint a 24-hour chat token for whatever user id it had
 * just confirmed with auth-service. That made this server a token minter:
 * anyone who could read its environment could sign a chat token for ANY
 * user id and read or send their messages (security sweep 2026-10-21, #3).
 *
 * Now the proxy holds no signing material at all. The browser already sends
 * the user's RS256 access token as `Authorization`; it is passed to
 * chat-message-service unchanged, and that service verifies it with the
 * platform public key under the same issuer/audience/expiry/session rules
 * the API gateway applies. The identity is whatever the token says — this
 * route never names a user id, so there is nothing here to impersonate with.
 *
 * The old `GET /api/chat/token` sub-route is retired: the socket opens with
 * the access token directly (services/messageService.ts connectToHub).
 */

type RouteParams = { params: Promise<{ path?: string[] }> };

const BEARER_PATTERN = /^Bearer\s+\S+$/;

export async function GET(req: Request, { params }: RouteParams) {
    return handleRequest(req, await params);
}

export async function POST(req: Request, { params }: RouteParams) {
    return handleRequest(req, await params);
}

export async function PUT(req: Request, { params }: RouteParams) {
    return handleRequest(req, await params);
}

export async function PATCH(req: Request, { params }: RouteParams) {
    return handleRequest(req, await params);
}

export async function DELETE(req: Request, { params }: RouteParams) {
    return handleRequest(req, await params);
}

async function handleRequest(req: Request, params: { path?: string[] }) {
    const pathParts = params.path || [];
    const fullPath = pathParts.join('/');
    const url = new URL(req.url);

    const authHeader = req.headers.get('authorization')?.trim() ?? '';
    if (!BEARER_PATTERN.test(authHeader)) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (fullPath === 'token') {
        return NextResponse.json(
            {
                error: {
                    code: 'CHAT_PROXY_TOKEN_RETIRED',
                    message: 'The chat proxy no longer mints tokens. Open the socket with the access token.',
                },
            },
            { status: 410 },
        );
    }

    const backendUrl = `${CHAT_BACKEND_URL}/${fullPath}${url.search}`;

    try {
        const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
            ? await req.text()
            : undefined;

        const idempotencyKey = req.headers.get('Idempotency-Key') || crypto.randomUUID();

        // Only these headers cross to the chat service. The caller's token is
        // the whole identity; no X-User-Id travels with it, so nothing the
        // browser sends can name a different user than the token does.
        const res = await fetch(backendUrl, {
            method: req.method,
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey,
            },
            body
        });

        const contentType = res.headers.get('content-type');
        let data;
        if (contentType?.includes('application/json')) {
            data = await res.json();
        } else {
            const text = await res.text();
            data = { message: text };
        }

        if (!res.ok) {
            console.error(`[ChatProxy] Backend Error (${res.status}):`, data);
        }

        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('[ChatProxy] Fetch Exception:', error);
        return NextResponse.json({ error: 'Chat Backend Unreachable' }, { status: 502 });
    }
}
