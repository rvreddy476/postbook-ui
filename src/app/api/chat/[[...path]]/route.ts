import { NextResponse } from 'next/server';
import crypto from 'crypto';

const normalizeChatBackendUrl = (raw: string) => {
    const trimmed = raw.replace(/\/+$/, '');
    return trimmed.endsWith('/v1/chat') ? trimmed : `${trimmed}/v1/chat`;
};

const CHAT_BACKEND_URL = normalizeChatBackendUrl(process.env.CHAT_BACKEND_URL || 'http://localhost:8092/v1/chat');
const AUTH_SERVICE_URL =
    process.env.AUTH_SERVICE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://localhost:8081';
/**
 * Signing secret for the chat token this proxy mints.
 *
 * There used to be a hardcoded fallback literal here, applied whenever
 * NODE_ENV was 'development'. Two problems with that: a usable signing key
 * lived in the repository, and any environment that was not exactly
 * 'development' — a preview build, a container with NODE_ENV unset — fell
 * through to an empty string and answered every chat request with a bare 500
 * that named nothing.
 *
 * Now there is no fallback. The secret comes from the environment or the
 * route refuses to serve, and says exactly which variable is missing. It must
 * match the JWT_SECRET used by chat-message-service and chat-ws-gateway.
 */
const CHAT_SECRET = process.env.CHAT_PROXY_SIGNING_SECRET ?? '';

/**
 * Shortest secret worth accepting for an HMAC-SHA256 signing key. Anything
 * below this is a placeholder, not a key.
 */
const MIN_SECRET_LENGTH = 16;

type SecretProblem = { code: string; detail: string };

/**
 * Check the secret's presence and length. Never reads, logs or returns the
 * value itself — only whether there is one and whether it is long enough.
 */
const checkChatSecret = (): SecretProblem | null => {
    if (!CHAT_SECRET) {
        return {
            code: 'CHAT_PROXY_SECRET_MISSING',
            detail:
                'CHAT_PROXY_SIGNING_SECRET is not set in this environment. It must equal the JWT_SECRET used by chat-message-service and chat-ws-gateway.',
        };
    }
    if (CHAT_SECRET.length < MIN_SECRET_LENGTH) {
        return {
            code: 'CHAT_PROXY_SECRET_TOO_SHORT',
            detail: `CHAT_PROXY_SIGNING_SECRET is set but is shorter than ${MIN_SECRET_LENGTH} characters, which is too short to sign with.`,
        };
    }
    return null;
};

// Surface the misconfiguration once at startup rather than only on the first
// user who tries to open a chat.
const startupSecretProblem = checkChatSecret();
if (startupSecretProblem) {
    console.error(
        `[ChatProxy] disabled at startup: ${startupSecretProblem.code} — ${startupSecretProblem.detail}`,
    );
}

const CHAT_JWT_KID = process.env.JWT_KID || 'v1';

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

    // A missing signing secret is a deployment fault, not a bad request and
    // not a crash. 503 says "this route cannot serve in this environment", and
    // the body names the variable so whoever sees it can fix it without
    // reading the source. The value is never included.
    const secretProblem = checkChatSecret();
    if (secretProblem) {
        console.error(
            `[ChatProxy] refusing ${req.method} /${fullPath}: ${secretProblem.code} — ${secretProblem.detail}`,
        );
        return NextResponse.json(
            {
                error: {
                    code: secretProblem.code,
                    message: 'Chat is not available because this deployment is misconfigured.',
                    detail: secretProblem.detail,
                },
            },
            { status: 503 },
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
        const headerEncoded = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: CHAT_JWT_KID })).toString("base64url");
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
