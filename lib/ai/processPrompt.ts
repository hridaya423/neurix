import { OpenRouter } from "@openrouter/sdk";
import { SUPPORTED_CONDITIONS, SUPPORTED_STATEMENTS, validateGeneratedProcess } from "@/lib/ai/validateGeneratedProcess";

const model = "x-ai/grok-4.3";

const statementShapes: Record<(typeof SUPPORTED_STATEMENTS)[number], string> = {
  move: "{ steps: number }",
  turn: "{ degrees: number }",
  setPosition: "{ x: number, y: number }",
  goHome: "{}",
  changeX: "{ dx: number }",
  changeY: "{ dy: number }",
  setX: "{ x: number }",
  setY: "{ y: number }",
  pointInDirection: "{ direction: number }",
  ifOnEdgeBounce: "{}",
  say: "{ text: string }",
  sayForSeconds: "{ text: string, seconds: number }",
  think: "{ text: string }",
  thinkForSeconds: "{ text: string, seconds: number }",
  clearSpeech: "{}",
  changeSize: "{ amount: number }",
  setSize: "{ size: number }",
  show: "{}",
  hide: "{}",
  nextCostume: "{}",
  nextBackdrop: "{}",
  goToLayer: '{ layer: "front" | "back" }',
  wait: "{ seconds: number }",
  repeat: "{ times: number, body: ScriptNode[] }",
  forever: "{ body: ScriptNode[] }",
  if: "{ condition: Condition, body: ScriptNode[] }",
  ifElse: "{ condition: Condition, thenBody: ScriptNode[], elseBody: ScriptNode[] }",
  repeatUntil: "{ condition: Condition, body: ScriptNode[] }",
  waitUntil: "{ condition: Condition }",
  stop: '{ mode: "all" | "thisScript" }',
  createClone: "{}",
  deleteClone: "{}",
  resetTimer: "{}",
};

const conditionShapes: Record<(typeof SUPPORTED_CONDITIONS)[number], string> = {
  keyPressed: '{ key: KeyName }',
  touchingObject: '{ object: "edge" | "mouse-pointer" }',
  touchingColor: "{ color: hex string }",
  colorTouchingColor: "{ color: hex string, touching: hex string }",
  mouseDown: "{}",
  anyKeyPressed: "{}",
  not: "{ condition: Condition }",
  and: "{ left: Condition, right: Condition }",
  or: "{ left: Condition, right: Condition }",
  compare: '{ left: number, operator: "=" | "<" | ">" | "≤" | "≥" | "≠", right: number }',
};

export const schema = `
Return JSON with this shape:
{
  "name": string,
  "explanation": string,
  "ast": ScriptNode[]
}

A ScriptNode is { "type": string, ...fields }. Supported types and their fields:
${SUPPORTED_STATEMENTS.map((type) => `${type} ${statementShapes[type]}`).join(", ")}.

A Condition is { "type": string, ...fields }. Supported types:
${SUPPORTED_CONDITIONS.map((type) => `${type} ${conditionShapes[type]}`).join(", ")}.

KeyName is a KeyboardEvent key value, e.g. "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " " (space), "Enter", or a single character like "a" or "0".
Use only the listed node and condition types. Do not invent variables, lists, costumes, sounds, broadcasts, or graphic/sound effects.
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
