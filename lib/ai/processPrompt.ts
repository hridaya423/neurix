import { OpenRouter } from "@openrouter/sdk";
import { validateGeneratedProcess } from "@/lib/ai/validateGeneratedProcess";

const model = "x-ai/grok-4.3";

const schema = `
Return JSON with this shape:
{
  "name": string,
  "explanation": string,
  "ast": ScriptNode[]
}

Supported ScriptNode types:
move { steps }, turn { degrees }, setPosition { x, y }, goHome {}, changeX { dx }, changeY { dy }, setX { x }, setY { y }, pointInDirection { direction }, ifOnEdgeBounce {}, say { text }, sayForSeconds { text, seconds }, think { text }, thinkForSeconds { text, seconds }, clearSpeech {}, changeSize { amount }, setSize { size }, show {}, hide {}, nextCostume {}, wait { seconds }, repeat { times, body }, forever { body }, if { condition, body }, ifElse { condition, thenBody, elseBody }.

Supported condition types:
keyPressed { key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Space" }, touchingEdge {}, not { condition }, and { left, right }, or { left, right }, compare { left, operator: "=" | "<" | ">", right }.
`;

export async function generateProcessAst(prompt: string, spriteName: string) {
  const apiKey = process.env.HACKAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing HACKAI_API_KEY.");
  }

  const client = new OpenRouter({
    apiKey,
    serverURL: "https://ai.hackclub.com/proxy/v1",
  });

  const response = await client.chat.send({
    chatRequest: {
      model,
      messages: [
        {
          role: "system",
          content: `You generate editable Scratch-like block AST for a kid-friendly visual programming app. Return ONLY JSON. Do not return markdown. Do not return JavaScript. Use only supported node types. Prefer simple, readable logic. Keep the result under 40 blocks. ${schema}`,
        },
        {
          role: "user",
          content: `Sprite: ${spriteName}\nCustom block idea: ${prompt}\nGenerate the blocks that should go under this custom block definition.`,
        },
      ],
      stream: false,
    },
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("AI response did not contain text.");
  }

  return validateGeneratedProcess(content);
}
