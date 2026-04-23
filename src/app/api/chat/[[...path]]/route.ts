import { NextResponse } from 'next/server';
import crypto from 'crypto';

const CHAT_BACKEND_URL = process.env.CHAT_BACKEND_URL || 'http://localhost:8092/v1/chat';
const AUTH_SERVICE_URL =
    process.env.AUTH_SERVICE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://localhost:8081';
const CHAT_SECRET =
    process.env.CHAT_PROXY_SIGNING_SECRET ??
    (process.env.NODE_ENV === 'development' ? 'dev_secret_change_me' : '');

type RouteParams = { params: Promise<{ path?: string[] }> };

const pickString = (source: Record<string, unknown> | null, keys: string[]) => {
    if (!source) return null;
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object') return null;
    return value as Record<string, unknown>;
};

const extractUserId = (payload: unknown): string | null => {
    const root = asRecord(payload);
    if (!root) return null;
    const data = asRecord(root.data);
    const user = asRecord(data?.user) ?? asRecord(root.user);
    return (
        pickString(user, ['id', 'user_id', 'userId']) ??
        pickString(data, ['id', 'user_id', 'userId']) ??
        pickString(root, ['id', 'user_id', 'userId'])
    );
};

async function resolveAuthenticatedUserId(authHeader: string): Promise<string | null> {
    try {
        const res = await fetch(`${AUTH_SERVICE_URL}/v1/auth/me`, {
            method: 'GET',
            headers: {
                Authorization: authHeader,
                Accept: 'application/json',
            },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const payload = await res.json().catch(() => null);
        return extractUserId(payload);
    } catch {
        return null;
    }
}

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

    if (!CHAT_SECRET) {
        return NextResponse.json(
            { error: 'Missing chat proxy signing secret configuration' },
            { status: 500 },
        );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const authenticatedUserId = await resolveAuthenticatedUserId(authHeader);
    if (!authenticatedUserId) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const signToken = (uid: string) => {
        const payload = {
            sub: uid,
            user_id: uid,
            exp: Math.floor(Date.now() / 1000) + (24 * 3600)
        };
        const headerEncoded = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
        const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
        const sig = crypto.createHmac("sha256", CHAT_SECRET).update(`${headerEncoded}.${payloadEncoded}`).digest("base64url");
        return `${headerEncoded}.${payloadEncoded}.${sig}`;
    };

    const headerUserId = req.headers.get('x-user-id')?.trim() || null;
    const queryUserId = url.searchParams.get('userId')?.trim() || null;
    const requestedUserId = headerUserId ?? (fullPath === 'token' ? queryUserId : null);

    if (requestedUserId && authenticatedUserId !== requestedUserId) {
        return NextResponse.json(
            { error: 'Forbidden: user identity mismatch' },
            { status: 403 },
        );
    }

    const effectiveUserId = authenticatedUserId;
    const chatToken = signToken(effectiveUserId);

    if (fullPath === 'token') {
        return NextResponse.json({ token: chatToken });
    }

    const backendUrl = `${CHAT_BACKEND_URL}/${fullPath}${url.search}`;

    try {
        const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
            ? await req.text()
            : undefined;

        const idempotencyKey = req.headers.get('Idempotency-Key') || crypto.randomUUID();

        const res = await fetch(backendUrl, {
            method: req.method,
            headers: {
                'Authorization': `Bearer ${chatToken}`,
                'X-User-Id': effectiveUserId,
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
