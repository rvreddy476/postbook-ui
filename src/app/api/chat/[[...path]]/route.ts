import { NextResponse } from 'next/server';
import crypto from 'crypto';

const CHAT_BACKEND_URL = 'http://localhost:8092/v1/chat';
const CHAT_SECRET = 'dev_secret_change_me';

type RouteParams = { params: Promise<{ path?: string[] }> };

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

    // Special endpoint to get a token for WS
    if (fullPath === 'token') {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
        return NextResponse.json({ token: signToken(userId) });
    }

    // Extract userId from Authorization header or custom header to re-sign
    const authHeader = req.headers.get('Authorization');
    let userId = req.headers.get('X-User-Id');

    if (!userId && authHeader?.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
            userId = payload.sub || payload.user_id;
        } catch (e) {
            console.error("[ChatProxy] Token decode failed", e);
        }
    }

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: No User ID found in session' }, { status: 401 });
    }

    const chatToken = signToken(userId);
    const backendUrl = `${CHAT_BACKEND_URL}/${fullPath}${new URL(req.url).search}`;

    try {
        const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
            ? await req.text()
            : undefined;

        const idempotencyKey = req.headers.get('Idempotency-Key') || crypto.randomUUID();

        const res = await fetch(backendUrl, {
            method: req.method,
            headers: {
                'Authorization': `Bearer ${chatToken}`,
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
