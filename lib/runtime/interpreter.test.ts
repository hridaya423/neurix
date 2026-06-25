import { describe, expect, it } from "vitest";
import { runScript } from "@/lib/runtime/interpreter";
import type { ScriptNode } from "@/lib/compiler/types";
import { callNames, createTestRuntime } from "@/lib/runtime/testRuntime";

describe("runScript - motion", () => {
  it("moves the sprite along its direction", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript([{ type: "pointInDirection", direction: 0 }, { type: "move", steps: 10 }], runtime);
    expect(Math.round(state.x)).toBe(10);
    expect(Math.round(state.y)).toBe(0);
  });

  it("evaluates arithmetic in a value slot", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript(
      [{ type: "setPosition", x: { type: "arithmetic", operator: "+", left: 2, right: 3 }, y: -4 }],
      runtime,
    );
    expect(state.x).toBe(5);
    expect(state.y).toBe(-4);
  });

  it("evaluates extended Scratch math operators", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript([
      { type: "setVariable", name: "log", value: { type: "math", operator: "log", value: 100 } },
      { type: "setVariable", name: "asin", value: { type: "math", operator: "asin", value: 1 } },
    ], runtime);
    expect(state.vars.log).toBe(2);
    expect(state.vars.asin).toBe(90);
  });

  it("keeps decimal precision for Scratch random ranges", async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
      const { runtime, state } = createTestRuntime();
      await runScript([{ type: "setVariable", name: "n", value: { type: "random", from: 1.5, to: 2.5 } }], runtime);
      expect(state.vars.n).toBe(2);
    } finally {
      Math.random = originalRandom;
    }
  });

  it("glides to Scratch non-sprite targets", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript([
      { type: "setPosition", x: 10, y: 10 },
      { type: "glideToObject", seconds: 0, object: "center" },
    ], runtime);
    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
  });
});

describe("runScript - variables", () => {
  it("sets and changes a variable", async () => {
    const { runtime, state } = createTestRuntime();
    const program: ScriptNode[] = [
      { type: "setVariable", name: "score", value: 10 },
      { type: "changeVariable", name: "score", amount: 5 },
    ];
    await runScript(program, runtime);
    expect(state.vars.score).toBe(15);
  });

  it("reads a variable inside a value", async () => {
    const { runtime, state } = createTestRuntime({ vars: { speed: 7 } });
    await runScript([{ type: "changeX", dx: { type: "variable", name: "speed" } }], runtime);
    expect(state.x).toBe(7);
  });

  it("routes cloud variables through the cloud setter", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript([{ type: "setVariable", name: "☁ Highscore", value: 999 }], runtime);
    expect(state.cloudVars["☁ Highscore"]).toBe(999);
    expect(state.vars["☁ Highscore"]).toBeUndefined();
  });
});

describe("runScript - control flow", () => {
  it("repeats a body a fixed number of times", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript(
      [{ type: "repeat", times: 5, body: [{ type: "changeVariable", name: "n", amount: 1 }] }],
      runtime,
    );
    expect(state.vars.n).toBe(5);
  });

  it("takes the then-branch when the condition is true", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript(
      [{
        type: "ifElse",
        condition: { type: "compare", left: 2, operator: ">", right: 1 },
        thenBody: [{ type: "setVariable", name: "branch", value: "then" }],
        elseBody: [{ type: "setVariable", name: "branch", value: "else" }],
      }],
      runtime,
    );
    expect(state.vars.branch).toBe("then");
  });

  it("exits repeatUntil once its condition becomes true", async () => {
    const { runtime, state } = createTestRuntime({ cancelAfterTicks: 1000 });
    await runScript(
      [{
        type: "repeatUntil",
        condition: { type: "compare", left: { type: "variable", name: "i" }, operator: "≥", right: 3 },
        body: [{ type: "changeVariable", name: "i", amount: 1 }],
      }],
      runtime,
    );
    expect(state.vars.i).toBe(3);
  });

  it("stops a forever loop when the runtime is cancelled", async () => {
    const { runtime, state } = createTestRuntime({ cancelAfterTicks: 4 });
    await runScript(
      [{ type: "forever", body: [{ type: "changeVariable", name: "i", amount: 1 }] }],
      runtime,
    );
    expect(state.vars.i).toBe(4);
  });

  it("stops the current script after stop blocks", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript([
      { type: "setVariable", name: "before", value: 1 },
      { type: "stop", mode: "thisScript" },
      { type: "setVariable", name: "after", value: 1 },
    ], runtime);
    expect(state.vars.before).toBe(1);
    expect(state.vars.after).toBeUndefined();
  });

  it("propagates stop out of nested blocks", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript([
      { type: "if", condition: { type: "boolean", value: true }, body: [{ type: "stop", mode: "thisScript" }] },
      { type: "setVariable", name: "after", value: 1 },
    ], runtime);
    expect(state.vars.after).toBeUndefined();
  });
});

describe("runScript - lists", () => {
  it("adds, replaces and reads list items (1-based indexing)", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript(
      [
        { type: "listAdd", list: "fruit", item: "apple" },
        { type: "listAdd", list: "fruit", item: "pear" },
        { type: "listReplace", list: "fruit", index: 2, item: "plum" },
        { type: "setVariable", name: "first", value: { type: "listItem", list: "fruit", index: 1 } },
      ],
      runtime,
    );
    expect(state.lists.fruit).toEqual(["apple", "plum"]);
    expect(state.vars.first).toBe("apple");
  });

  it("supports Scratch list index labels", async () => {
    const { runtime, state } = createTestRuntime({ lists: { fruit: ["apple", "pear"] } });
    await runScript([
      { type: "listReplace", list: "fruit", index: "last", item: "plum" },
      { type: "setVariable", name: "picked", value: { type: "listItem", list: "fruit", index: "last" } },
      { type: "listInsert", list: "fruit", index: "last", item: "grape" },
      { type: "listDelete", list: "fruit", index: "last" },
    ], runtime);
    expect(state.vars.picked).toBe("plum");
    expect(state.lists.fruit).toEqual(["apple", "plum"]);
  });
});

describe("runScript - conditions", () => {
  it("compares strings with = and ≠", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript(
      [
        { type: "if", condition: { type: "compare", left: "a", operator: "=", right: "a" }, body: [{ type: "setVariable", name: "eq", value: 1 }] },
        { type: "if", condition: { type: "compare", left: "a", operator: "≠", right: "b" }, body: [{ type: "setVariable", name: "neq", value: 1 }] },
      ],
      runtime,
    );
    expect(state.vars.eq).toBe(1);
    expect(state.vars.neq).toBe(1);
  });

  it("compares numeric strings like Scratch", async () => {
    const { runtime, state } = createTestRuntime();
    await runScript([
      { type: "if", condition: { type: "compare", left: 5, operator: "=", right: "5" }, body: [{ type: "setVariable", name: "eq", value: 1 }] },
      { type: "if", condition: { type: "compare", left: 5, operator: "≠", right: "5" }, body: [{ type: "setVariable", name: "neq", value: 1 }] },
    ], runtime);
    expect(state.vars.eq).toBe(1);
    expect(state.vars.neq).toBeUndefined();
  });

  it("honors keyPressed via the runtime", async () => {
    const { runtime, state } = createTestRuntime({ keysDown: ["Space"] });
    await runScript(
      [{ type: "if", condition: { type: "keyPressed", key: "Space" }, body: [{ type: "setVariable", name: "jumped", value: 1 }] }],
      runtime,
    );
    expect(state.vars.jumped).toBe(1);
  });
});

describe("runScript - cancellation", () => {
  it("does not run nodes after cancellation", async () => {
    const { runtime, state } = createTestRuntime({ cancelAfterTicks: 0 });
    await runScript([{ type: "say", text: "hello" }], runtime);
    expect(callNames(state)).toEqual([]);
  });
});
