import { NextResponse } from "next/server";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart = {
    text?: string;
    inlineData?: {
        data?: string;
        mimeType?: string;
    };
};

type GeminiResponse = {
    candidates?: Array<{
        content?: {
            parts?: GeminiPart[];
        };
    }>;
};

async function callGemini(apiKey: string, model: string, body: Record<string, unknown>): Promise<GeminiResponse> {
    const res = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errorBody}`);
    }

    return (await res.json()) as GeminiResponse;
}

function extractText(result: GeminiResponse): string {
    const parts = result.candidates?.[0]?.content?.parts ?? [];
    return parts
        .map((part) => part.text)
        .filter((text): text is string => Boolean(text))
        .join("\n")
        .trim();
}

export async function POST(req: Request) {
    try {
        const { action, payload } = await req.json();
        const apiKey = process.env.API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing Gemini API Key on server" }, { status: 500 });
        }

        if (action === "generateText") {
            const result = await callGemini(apiKey, "gemini-2.0-flash", {
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: payload.prompt }] }],
            });
            const text = extractText(result);
            return NextResponse.json({ text });
        }

        if (action === "generateImage") {
            const result = await callGemini(apiKey, "gemini-2.0-flash", {
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: payload.prompt }] }],
                generationConfig: {
                    maxOutputTokens: 2048,
                },
            });

            const candidate = result.candidates?.[0];
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        return NextResponse.json({ data: part.inlineData.data });
                    }
                }
            }
            return NextResponse.json({ error: "No image data returned" }, { status: 500 });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        console.error("Gemini Proxy Error:", error);
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
