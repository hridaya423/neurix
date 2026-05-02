import { OpenRouter } from "@openrouter/sdk";
import type { ScriptNode } from "@/lib/compiler/types";

const model = "x-ai/grok-4.3";

export type AskBlocksResult = {
  answer: string;
};

const systemPrompt = "You answer questions about Scratch-like visual blocks for a kid-friendly coding app. Be concise and specific. Use the selected stack plus full sprite script only as context for the direct answer. Do not add tips, suggestions, or a context section. Do not invent behavior that is not in the AST.";

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
  return typeof value === "string" ? value.trim().slice(0, 900) || fallback : fallback;
}

function validateAnswer(content: string): AskBlocksResult {
  const parsed: unknown = JSON.parse(extractJson(content));

  if (!isRecord(parsed)) {
    throw new Error("AI answer was not valid JSON.");
  }

  return {
    answer: cleanText(parsed.answer, "I could not answer that from these blocks."),
  };
}

export async function askBlocks(params: {
  spriteName: string;
  question: string;
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
          content: `${systemPrompt} Return ONLY JSON with answer.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            outputShape: {
              answer: "direct answer in 1-3 short sentences",
            },
            spriteName: params.spriteName,
            question: params.question,
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

  return validateAnswer(content);
}

export async function streamAskBlocks(params: {
  spriteName: string;
  question: string;
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
            question: params.question,
            selectedAst: params.selectedAst,
            fullAst: params.fullAst,
          }),
        },
      ],
      stream: true,
    },
  });
}
