import { NextResponse } from "next/server";
import { askBlocks, streamAskBlocks } from "@/lib/ai/askBlocks";
import { isAuthenticated } from "@/lib/auth-server";

function streamToResponse(stream: Awaited<ReturnType<typeof streamAskBlocks>>) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta.content;
            if (content) controller.enqueue(encoder.encode(content));
          }
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Stream failed.";
          controller.enqueue(encoder.encode(`\n${message}`));
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Sign in to use AI." }, { status: 401 });
    }

    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const spriteName = "spriteName" in body && typeof body.spriteName === "string" ? body.spriteName.slice(0, 80) : "Sprite";
    const question = "question" in body && typeof body.question === "string" ? body.question.trim().slice(0, 300) : "";
    const selectedAst = "selectedAst" in body && Array.isArray(body.selectedAst) ? body.selectedAst : [];
    const fullAst = "fullAst" in body && Array.isArray(body.fullAst) ? body.fullAst : [];
    const stream = "stream" in body && body.stream === true;

    if (!question) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    if (selectedAst.length === 0) {
      return NextResponse.json({ error: "Select a connected block stack first." }, { status: 400 });
    }

    if (stream) {
      return streamToResponse(await streamAskBlocks({ spriteName, question, selectedAst, fullAst }));
    }

    const answer = await askBlocks({ spriteName, question, selectedAst, fullAst });
    return NextResponse.json(answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ask AI.";
    const status = message.includes("HACKAI_API_KEY") ? 500 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
