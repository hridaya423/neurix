import { OpenRouter } from "@openrouter/sdk";
import type { ScriptNode } from "@/lib/compiler/types";

const model = "x-ai/grok-4.3";

export type ExplainBlocksResult = {
  title: string;
  summary: string;
  steps: string[];
};

const systemPrompt = "You explain Scratch-like visual blocks for a kid-friendly coding app. Be concise, warm, and specific. Explain only what the selected stack does in 1-3 short sentences. Use the full sprite script only to avoid missing context. Do not add a context section or tips. Do not invent behavior that is not in the AST.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJson(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1];

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);

  return trimmed;
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim().slice(0, 800) || fallback : fallback;
}

function cleanSteps(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function validateExplanation(content: string): ExplainBlocksResult {
  const parsed: unknown = JSON.parse(extractJson(content));

  if (!isRecord(parsed)) {
    throw new Error("AI explanation was not valid JSON.");
  }

  const steps = cleanSteps(parsed.steps);

  return {
    title: cleanText(parsed.title, "Block explanation").slice(0, 80),
    summary: cleanText(parsed.summary, "This stack controls what the sprite does."),
    steps: steps.length > 0 ? steps : ["Read the blocks from top to bottom.", "Nested blocks run inside their parent control blocks."],
  };
}

export async function explainBlocks(params: {
  spriteName: string;
  selectedAst: ScriptNode[];
  fullAst: ScriptNode[];
}) {
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
          content: `${systemPrompt} Return ONLY JSON with title, summary, and steps.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            outputShape: {
              title: "short title",
              summary: "one short sentence explanation",
              steps: ["short step 1", "short step 2"],
            },
            spriteName: params.spriteName,
            selectedAst: params.selectedAst,
            fullAst: params.fullAst,
          }),
        },
      ],
      stream: false,
    },
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("AI response did not contain text.");
  }

  return validateExplanation(content);
}

export async function streamExplainBlocks(params: {
  spriteName: string;
  selectedAst: ScriptNode[];
  fullAst: ScriptNode[];
}) {
  const apiKey = process.env.HACKAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing HACKAI_API_KEY.");
  }

  const client = new OpenRouter({
    apiKey,
    serverURL: "https://ai.hackclub.com/proxy/v1",
  });

  return client.chat.send({
    chatRequest: {
      model,
      messages: [
        {
          role: "system",
          content: `${systemPrompt} Return plain text only. No markdown headings.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            spriteName: params.spriteName,
            selectedAst: params.selectedAst,
            fullAst: params.fullAst,
          }),
        },
      ],
      stream: true,
    },
  });
}
