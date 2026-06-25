import { describe, expect, it } from "vitest";
import {
  SUPPORTED_CONDITIONS,
  SUPPORTED_STATEMENTS,
  validateGeneratedProcess,
} from "@/lib/ai/validateGeneratedProcess";
import { schema } from "@/lib/ai/processPrompt";
import type { ScriptNode } from "@/lib/compiler/types";

function run(ast: unknown) {
  return validateGeneratedProcess(JSON.stringify({ name: "n", explanation: "e", ast }));
}

const statementFixtures: Record<(typeof SUPPORTED_STATEMENTS)[number], Record<string, unknown>> = {
  move: { type: "move", steps: 5 },
  turn: { type: "turn", degrees: 20 },
  setPosition: { type: "setPosition", x: 1, y: 2 },
  goHome: { type: "goHome" },
  changeX: { type: "changeX", dx: 3 },
  changeY: { type: "changeY", dy: 4 },
  setX: { type: "setX", x: 5 },
  setY: { type: "setY", y: 6 },
  pointInDirection: { type: "pointInDirection", direction: 45 },
  ifOnEdgeBounce: { type: "ifOnEdgeBounce" },
  say: { type: "say", text: "hi" },
  sayForSeconds: { type: "sayForSeconds", text: "hi", seconds: 1 },
  think: { type: "think", text: "hmm" },
  thinkForSeconds: { type: "thinkForSeconds", text: "hmm", seconds: 1 },
  clearSpeech: { type: "clearSpeech" },
  changeSize: { type: "changeSize", amount: 5 },
  setSize: { type: "setSize", size: 120 },
  show: { type: "show" },
  hide: { type: "hide" },
  nextCostume: { type: "nextCostume" },
  nextBackdrop: { type: "nextBackdrop" },
  goToLayer: { type: "goToLayer", layer: "front" },
  wait: { type: "wait", seconds: 1 },
  repeat: { type: "repeat", times: 3, body: [{ type: "move", steps: 1 }] },
  forever: { type: "forever", body: [{ type: "move", steps: 1 }] },
  if: { type: "if", condition: { type: "mouseDown" }, body: [] },
  ifElse: { type: "ifElse", condition: { type: "mouseDown" }, thenBody: [], elseBody: [] },
  repeatUntil: { type: "repeatUntil", condition: { type: "mouseDown" }, body: [] },
  waitUntil: { type: "waitUntil", condition: { type: "mouseDown" } },
  stop: { type: "stop", mode: "all" },
  createClone: { type: "createClone" },
  deleteClone: { type: "deleteClone" },
  resetTimer: { type: "resetTimer" },
};

describe("validateGeneratedProcess - supported statements", () => {
  it("has a fixture for every supported statement (keeps tests honest)", () => {
    expect(Object.keys(statementFixtures).sort()).toEqual([...SUPPORTED_STATEMENTS].sort());
  });

  it.each(SUPPORTED_STATEMENTS)("keeps a %s node instead of dropping it", (type) => {
    const result = run([statementFixtures[type]]);
    expect(result.ast).toHaveLength(1);
    expect(result.ast[0].type).toBe(type);
  });
});

describe("validateGeneratedProcess - supported conditions", () => {
  const conditionFixtures: Record<(typeof SUPPORTED_CONDITIONS)[number], Record<string, unknown>> = {
    keyPressed: { type: "keyPressed", key: "ArrowUp" },
    touchingObject: { type: "touchingObject", object: "edge" },
    touchingColor: { type: "touchingColor", color: "#ff0000" },
    colorTouchingColor: { type: "colorTouchingColor", color: "#ff0000", touching: "#00ff00" },
    mouseDown: { type: "mouseDown" },
    anyKeyPressed: { type: "anyKeyPressed" },
    not: { type: "not", condition: { type: "mouseDown" } },
    and: { type: "and", left: { type: "mouseDown" }, right: { type: "mouseDown" } },
    or: { type: "or", left: { type: "mouseDown" }, right: { type: "mouseDown" } },
    compare: { type: "compare", left: 1, operator: "<", right: 2 },
  };

  it.each(SUPPORTED_CONDITIONS)("preserves a %s condition through an if", (type) => {
    const result = run([{ type: "if", condition: conditionFixtures[type], body: [] }]);
    const node = result.ast[0] as Extract<ScriptNode, { type: "if" }>;
    expect(node.condition.type).toBe(type);
  });
});

describe("validateGeneratedProcess - bug fixes", () => {
  it("coerces the space key to its KeyboardEvent value", () => {
    const result = run([{ type: "if", condition: { type: "keyPressed", key: "Space" }, body: [] }]);
    const node = result.ast[0] as Extract<ScriptNode, { type: "if" }>;
    expect(node.condition).toEqual({ type: "keyPressed", key: " " });
  });

  it("accepts touchingObject with edge/mouse-pointer (replacing the old touchingEdge)", () => {
    const edge = run([{ type: "if", condition: { type: "touchingObject", object: "edge" }, body: [] }]);
    const mouse = run([{ type: "if", condition: { type: "touchingObject", object: "mouse-pointer" }, body: [] }]);
    expect((edge.ast[0] as Extract<ScriptNode, { type: "if" }>).condition).toEqual({ type: "touchingObject", object: "edge" });
    expect((mouse.ast[0] as Extract<ScriptNode, { type: "if" }>).condition).toEqual({ type: "touchingObject", object: "mouse-pointer" });
  });

  it("falls back unknown touching objects to edge", () => {
    const result = run([{ type: "if", condition: { type: "touchingObject", object: "Sprite7" }, body: [] }]);
    expect((result.ast[0] as Extract<ScriptNode, { type: "if" }>).condition).toEqual({ type: "touchingObject", object: "edge" });
  });

  it("keeps the full set of compare operators", () => {
    for (const operator of ["=", "<", ">", "≤", "≥", "≠"]) {
      const result = run([{ type: "if", condition: { type: "compare", left: 1, operator, right: 2 }, body: [] }]);
      const node = result.ast[0] as Extract<ScriptNode, { type: "if" }>;
      expect(node.condition).toMatchObject({ type: "compare", operator });
    }
  });

  it("maps the alias setDirection to pointInDirection", () => {
    const result = run([{ type: "setDirection", direction: 30 }]);
    expect(result.ast[0]).toEqual({ type: "pointInDirection", direction: 30 });
  });
});

describe("validateGeneratedProcess - safety", () => {
  it("drops unsupported node types", () => {
    const result = run([
      { type: "move", steps: 1 },
      { type: "playSound", soundId: "meow" },
      { type: "setVariable", name: "x", value: 1 },
    ]);
    expect(result.ast.map((node) => node.type)).toEqual(["move"]);
  });

  it("falls back unknown conditions to a trivial compare", () => {
    const result = run([{ type: "if", condition: { type: "definitelyNotAThing" }, body: [] }]);
    const node = result.ast[0] as Extract<ScriptNode, { type: "if" }>;
    expect(node.condition).toEqual({ type: "compare", left: 0, operator: "=", right: 0 });
  });

  it("clamps numeric values to safe ranges", () => {
    const result = run([
      { type: "turn", degrees: 99999 },
      { type: "setSize", size: -50 },
      { type: "repeat", times: 2.7, body: [] },
    ]);
    expect(result.ast[0]).toEqual({ type: "turn", degrees: 360 });
    expect(result.ast[1]).toEqual({ type: "setSize", size: 0 });
    expect(result.ast[2]).toMatchObject({ type: "repeat", times: 3 });
  });

  it("validates nested bodies recursively", () => {
    const result = run([
      { type: "repeat", times: 2, body: [{ type: "move", steps: 1 }, { type: "playSound", soundId: "x" }] },
    ]);
    const node = result.ast[0] as Extract<ScriptNode, { type: "repeat" }>;
    expect(node.body.map((child) => child.type)).toEqual(["move"]);
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    const content = "Here you go:\n```json\n" + JSON.stringify({ name: "n", explanation: "e", ast: [{ type: "move", steps: 4 }] }) + "\n```";
    const result = validateGeneratedProcess(content);
    expect(result.ast).toEqual([{ type: "move", steps: 4 }]);
  });

  it("throws when there are no usable blocks", () => {
    expect(() => run([{ type: "playSound", soundId: "x" }])).toThrow(/usable blocks/);
  });

  it("throws when the response is not a JSON object", () => {
    expect(() => validateGeneratedProcess("[]")).toThrow();
  });
});

describe("validateGeneratedProcess - prompt drift guard", () => {
  it("advertises every supported statement in the prompt schema", () => {
    for (const type of SUPPORTED_STATEMENTS) {
      expect(schema).toContain(type);
    }
  });

  it("advertises every supported condition in the prompt schema", () => {
    for (const type of SUPPORTED_CONDITIONS) {
      expect(schema).toContain(type);
    }
  });

  it("does not advertise removed/unsupported types", () => {
    expect(schema).not.toContain("touchingEdge");
    expect(schema).not.toContain('"Space"');
  });
});
