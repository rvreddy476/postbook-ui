import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { action, payload } = await req.json();
        const apiKey = process.env.API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Missing Gemini API Key on server" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey });

        if (action === "generateText") {
            const result = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: payload.prompt,
            });
            const text = result.text ?? "";
            return NextResponse.json({ text });
        }

        if (action === "generateImage") {
            const result = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: payload.prompt }] }],
                config: {
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
