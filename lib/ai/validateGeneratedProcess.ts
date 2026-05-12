import type { KeyName, ScriptCondition, ScriptNode } from "@/lib/compiler/types";

export type GeneratedProcess = {
  name: string;
  explanation: string;
  ast: ScriptNode[];
};

const keys: KeyName[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
const maxNodes = 80;
const maxDepth = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.slice(0, 120) : fallback;
}

function numberValue(value: unknown, fallback = 0, min = -500, max = 500) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}

function validateCondition(value: unknown, depth: number): ScriptCondition {
  if (depth > maxDepth || !isRecord(value) || typeof value.type !== "string") {
    return { type: "compare", left: 1, operator: "=", right: 1 };
  }

  switch (value.type) {
    case "keyPressed": {
      const key = keys.includes(value.key as KeyName) ? value.key as KeyName : "Space";
      return { type: "keyPressed", key };
    }
    case "touchingObject": {
      const object = typeof value.object === "string" ? value.object : "edge";
      return { type: "touchingObject", object };
    }
    case "not":
      return { type: "not", condition: validateCondition(value.condition, depth + 1) };
    case "and":
      return {
        type: "and",
        left: validateCondition(value.left, depth + 1),
        right: validateCondition(value.right, depth + 1),
      };
    case "or":
      return {
        type: "or",
        left: validateCondition(value.left, depth + 1),
        right: validateCondition(value.right, depth + 1),
      };
    case "compare": {
      const operator = value.operator === "<" || value.operator === ">" ? value.operator : "=";
      return {
        type: "compare",
        left: numberValue(value.left),
        operator,
        right: numberValue(value.right),
      };
    }
    default:
      return { type: "compare", left: 1, operator: "=", right: 1 };
  }
}

function validateNodes(value: unknown, depth = 0, count = { value: 0 }): ScriptNode[] {
  if (!Array.isArray(value) || depth > maxDepth || count.value >= maxNodes) return [];

  const nodes: ScriptNode[] = [];

  for (const item of value) {
    if (count.value >= maxNodes || !isRecord(item) || typeof item.type !== "string") continue;
    count.value += 1;

    switch (item.type) {
      case "move":
        nodes.push({ type: "move", steps: numberValue(item.steps) });
        break;
      case "turn":
        nodes.push({ type: "turn", degrees: numberValue(item.degrees, 15, -360, 360) });
        break;
      case "setPosition":
        nodes.push({ type: "setPosition", x: numberValue(item.x), y: numberValue(item.y) });
        break;
      case "goHome":
        nodes.push({ type: "goHome" });
        break;
      case "changeX":
        nodes.push({ type: "changeX", dx: numberValue(item.dx) });
        break;
      case "changeY":
        nodes.push({ type: "changeY", dy: numberValue(item.dy) });
        break;
      case "setX":
        nodes.push({ type: "setX", x: numberValue(item.x) });
        break;
      case "setY":
        nodes.push({ type: "setY", y: numberValue(item.y) });
        break;
      case "setDirection":
        nodes.push({ type: "setDirection", direction: numberValue(item.direction, 90, -360, 360) });
        break;
      case "pointInDirection":
        nodes.push({ type: "pointInDirection", direction: numberValue(item.direction, 90, -360, 360) });
        break;
      case "ifOnEdgeBounce":
        nodes.push({ type: "ifOnEdgeBounce" });
        break;
      case "say":
        nodes.push({ type: "say", text: stringValue(item.text, "Hello") });
        break;
      case "sayForSeconds":
        nodes.push({ type: "sayForSeconds", text: stringValue(item.text, "Hello"), seconds: numberValue(item.seconds, 2, 0, 30) });
        break;
      case "think":
        nodes.push({ type: "think", text: stringValue(item.text, "Hmm") });
        break;
      case "thinkForSeconds":
        nodes.push({ type: "thinkForSeconds", text: stringValue(item.text, "Hmm"), seconds: numberValue(item.seconds, 2, 0, 30) });
        break;
      case "clearSpeech":
        nodes.push({ type: "clearSpeech" });
        break;
      case "changeSize":
        nodes.push({ type: "changeSize", amount: numberValue(item.amount, 10, -100, 100) });
        break;
      case "setSize":
        nodes.push({ type: "setSize", size: numberValue(item.size, 100, 1, 300) });
        break;
      case "show":
        nodes.push({ type: "show" });
        break;
      case "hide":
        nodes.push({ type: "hide" });
        break;
      case "nextCostume":
        nodes.push({ type: "nextCostume" });
        break;
      case "wait":
        nodes.push({ type: "wait", seconds: numberValue(item.seconds, 1, 0, 30) });
        break;
      case "repeat":
        nodes.push({ type: "repeat", times: Math.round(numberValue(item.times, 3, 1, 100)), body: validateNodes(item.body, depth + 1, count) });
        break;
      case "forever":
        nodes.push({ type: "forever", body: validateNodes(item.body, depth + 1, count) });
        break;
      case "if":
        nodes.push({ type: "if", condition: validateCondition(item.condition, depth + 1), body: validateNodes(item.body, depth + 1, count) });
        break;
      case "ifElse":
        nodes.push({
          type: "ifElse",
          condition: validateCondition(item.condition, depth + 1),
          thenBody: validateNodes(item.thenBody, depth + 1, count),
          elseBody: validateNodes(item.elseBody, depth + 1, count),
        });
        break;
    }
  }

  return nodes;
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

export function validateGeneratedProcess(content: string): GeneratedProcess {
  const parsed: unknown = JSON.parse(extractJson(content));

  if (!isRecord(parsed)) {
    throw new Error("AI response was not a JSON object.");
  }

  const ast = validateNodes(parsed.ast);
  if (ast.length === 0) {
    throw new Error("AI did not return any usable blocks.");
  }

  return {
    name: stringValue(parsed.name, "custom block"),
    explanation: stringValue(parsed.explanation, "Generated editable blocks."),
    ast,
  };
}
