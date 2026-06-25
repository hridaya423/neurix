import type { KeyName, ScriptCondition, ScriptNode } from "@/lib/compiler/types";

export type GeneratedProcess = {
  name: string;
  explanation: string;
  ast: ScriptNode[];
};

export const SUPPORTED_STATEMENTS = [
  "move",
  "turn",
  "setPosition",
  "goHome",
  "changeX",
  "changeY",
  "setX",
  "setY",
  "pointInDirection",
  "ifOnEdgeBounce",
  "say",
  "sayForSeconds",
  "think",
  "thinkForSeconds",
  "clearSpeech",
  "changeSize",
  "setSize",
  "show",
  "hide",
  "nextCostume",
  "nextBackdrop",
  "goToLayer",
  "wait",
  "repeat",
  "forever",
  "if",
  "ifElse",
  "repeatUntil",
  "waitUntil",
  "stop",
  "createClone",
  "deleteClone",
  "resetTimer",
] as const;

export const SUPPORTED_CONDITIONS = [
  "keyPressed",
  "touchingObject",
  "touchingColor",
  "colorTouchingColor",
  "mouseDown",
  "anyKeyPressed",
  "not",
  "and",
  "or",
  "compare",
] as const;

const keyValues: KeyName[] = [
  " ",
  "Enter",
  "Tab",
  "Backspace",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Shift",
  "Control",
  "Alt",
  "Meta",
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  ..."0123456789".split(""),
  "-", "=", "[", "]", ";", "'", ",", ".", "/", "\\",
];
const keySet = new Set<string>(keyValues);

const touchingObjects = new Set(["edge", "mouse-pointer"]);
const compareOperators = new Set(["=", "<", ">", "≤", "≥", "≠"]);
const hexColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const maxNodes = 100;
const maxDepth = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string, maxLen = 200) {
  return typeof value === "string" ? value.slice(0, maxLen) : fallback;
}

function num(value: unknown, fallback = 0, min = -100000, max = 100000) {
  const number = typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
      ? Number(value)
      : fallback;
  return Math.min(max, Math.max(min, number));
}

function intNum(value: unknown, fallback: number, min: number, max: number) {
  return Math.round(num(value, fallback, min, max));
}

function key(value: unknown): KeyName {
  return typeof value === "string" && keySet.has(value) ? value : " ";
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && hexColor.test(value.trim()) ? value.trim() : fallback;
}

function validateCondition(value: unknown, depth: number): ScriptCondition {
  const fallback: ScriptCondition = { type: "compare", left: 0, operator: "=", right: 0 };
  if (depth > maxDepth || !isRecord(value) || typeof value.type !== "string") return fallback;

  switch (value.type) {
    case "keyPressed":
      return { type: "keyPressed", key: key(value.key) };
    case "touchingObject": {
      const object = typeof value.object === "string" && touchingObjects.has(value.object) ? value.object : "edge";
      return { type: "touchingObject", object };
    }
    case "touchingColor":
      return { type: "touchingColor", color: color(value.color, "#52c3f0") };
    case "colorTouchingColor":
      return {
        type: "colorTouchingColor",
        color: color(value.color, "#5b6d7c"),
        touching: color(value.touching, "#d5e04a"),
      };
    case "mouseDown":
      return { type: "mouseDown" };
    case "anyKeyPressed":
      return { type: "anyKeyPressed" };
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
      const operator = typeof value.operator === "string" && compareOperators.has(value.operator)
        ? (value.operator as "=" | "<" | ">" | "≤" | "≥" | "≠")
        : "=";
      return { type: "compare", left: num(value.left), operator, right: num(value.right) };
    }
    default:
      return fallback;
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
        nodes.push({ type: "move", steps: num(item.steps, 10) });
        break;
      case "turn":
        nodes.push({ type: "turn", degrees: num(item.degrees, 15, -360, 360) });
        break;
      case "setPosition":
        nodes.push({ type: "setPosition", x: num(item.x), y: num(item.y) });
        break;
      case "goHome":
        nodes.push({ type: "goHome" });
        break;
      case "changeX":
        nodes.push({ type: "changeX", dx: num(item.dx, 10) });
        break;
      case "changeY":
        nodes.push({ type: "changeY", dy: num(item.dy, 10) });
        break;
      case "setX":
        nodes.push({ type: "setX", x: num(item.x) });
        break;
      case "setY":
        nodes.push({ type: "setY", y: num(item.y) });
        break;
      case "setDirection":
      case "pointInDirection":
        nodes.push({ type: "pointInDirection", direction: num(item.direction, 90, -360, 360) });
        break;
      case "ifOnEdgeBounce":
        nodes.push({ type: "ifOnEdgeBounce" });
        break;
      case "say":
        nodes.push({ type: "say", text: text(item.text, "Hello") });
        break;
      case "sayForSeconds":
        nodes.push({ type: "sayForSeconds", text: text(item.text, "Hello"), seconds: num(item.seconds, 2, 0, 3600) });
        break;
      case "think":
        nodes.push({ type: "think", text: text(item.text, "Hmm") });
        break;
      case "thinkForSeconds":
        nodes.push({ type: "thinkForSeconds", text: text(item.text, "Hmm"), seconds: num(item.seconds, 2, 0, 3600) });
        break;
      case "clearSpeech":
        nodes.push({ type: "clearSpeech" });
        break;
      case "changeSize":
        nodes.push({ type: "changeSize", amount: num(item.amount, 10, -1000, 1000) });
        break;
      case "setSize":
        nodes.push({ type: "setSize", size: num(item.size, 100, 0, 1000) });
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
      case "nextBackdrop":
        nodes.push({ type: "nextBackdrop" });
        break;
      case "goToLayer":
        nodes.push({ type: "goToLayer", layer: item.layer === "back" ? "back" : "front" });
        break;
      case "wait":
        nodes.push({ type: "wait", seconds: num(item.seconds, 1, 0, 3600) });
        break;
      case "resetTimer":
        nodes.push({ type: "resetTimer" });
        break;
      case "stop":
        nodes.push({ type: "stop", mode: item.mode === "thisScript" ? "thisScript" : "all" });
        break;
      case "createClone":
        nodes.push({ type: "createClone" });
        break;
      case "deleteClone":
        nodes.push({ type: "deleteClone" });
        break;
      case "repeat":
        nodes.push({ type: "repeat", times: intNum(item.times, 10, 0, 100000), body: validateNodes(item.body, depth + 1, count) });
        break;
      case "forever":
        nodes.push({ type: "forever", body: validateNodes(item.body, depth + 1, count) });
        break;
      case "repeatUntil":
        nodes.push({ type: "repeatUntil", condition: validateCondition(item.condition, depth + 1), body: validateNodes(item.body, depth + 1, count) });
        break;
      case "waitUntil":
        nodes.push({ type: "waitUntil", condition: validateCondition(item.condition, depth + 1) });
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
      default:
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
    name: text(parsed.name, "custom block", 120),
    explanation: text(parsed.explanation, "Generated editable blocks.", 500),
    ast,
  };
}
