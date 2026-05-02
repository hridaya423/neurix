import { NextResponse } from "next/server";
import { explainBlocks, streamExplainBlocks } from "@/lib/ai/explainBlocks";

function streamToResponse(stream: Awaited<ReturnType<typeof streamExplainBlocks>>) {
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
    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const spriteName = "spriteName" in body && typeof body.spriteName === "string" ? body.spriteName.slice(0, 80) : "Sprite";
    const selectedAst = "selectedAst" in body && Array.isArray(body.selectedAst) ? body.selectedAst : [];
    const fullAst = "fullAst" in body && Array.isArray(body.fullAst) ? body.fullAst : [];
    const stream = "stream" in body && body.stream === true;

    if (selectedAst.length === 0) {
      return NextResponse.json({ error: "Select a connected block stack to explain." }, { status: 400 });
    }

    if (stream) {
      return streamToResponse(await streamExplainBlocks({ spriteName, selectedAst, fullAst }));
    }

    const explanation = await explainBlocks({ spriteName, selectedAst, fullAst });
    return NextResponse.json(explanation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to explain blocks.";
    const status = message.includes("HACKAI_API_KEY") ? 500 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
