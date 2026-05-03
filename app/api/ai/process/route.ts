import { NextResponse } from "next/server";
import { generateProcessAst } from "@/lib/ai/processPrompt";
import { isAuthenticated } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Sign in to use AI." }, { status: 401 });
    }

    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const prompt = "prompt" in body && typeof body.prompt === "string" ? body.prompt.trim() : "";
    const spriteName = "spriteName" in body && typeof body.spriteName === "string" ? body.spriteName : "Sprite";

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const process = await generateProcessAst(prompt.slice(0, 240), spriteName.slice(0, 80));
    return NextResponse.json(process);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate blocks.";
    const status = message.includes("HACKAI_API_KEY") ? 500 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
