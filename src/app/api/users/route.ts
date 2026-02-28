import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:8082/v1'; // Based on the initial request, but we'll try to reach it.

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    try {
        const res = await fetch(`${BACKEND_URL}/users?limit=${limit}&offset=${offset}`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            // If 8082 fails, let's try 8092 as a fallback (based on the chat backend port)
            const fallbackRes = await fetch(`http://localhost:8092/v1/users?limit=${limit}&offset=${offset}`, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!fallbackRes.ok) {
                return NextResponse.json({ error: 'Backend services unreachable' }, { status: 502 });
            }
            return NextResponse.json(await fallbackRes.json());
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('User Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
