import { describe, expect, it } from "vitest";
import { astToJs } from "@/lib/compiler/astToJs";
import type { ScriptNode } from "@/lib/compiler/types";

type Call = [string, ...unknown[]];

function createHost(options: { runTicks?: number; lists?: Record<string, Array<number | string>> } = {}) {
  const calls: Call[] = [];
  const lists: Record<string, Array<number | string>> = { ...(options.lists ?? {}) };
  let runTicks = options.runTicks ?? 0;

  const rec = (name: string, ...args: unknown[]) => {
    calls.push([name, ...args]);
  };

  const recorder = (name: string, impls: Record<string, unknown> = {}) =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          const key = String(prop);
          if (key in impls) return impls[key];
          return (...args: unknown[]) => rec(`${name}.${key}`, ...args);
        },
      },
    );

  const sprite = recorder("sprite", {
    costumeName: () => "costume1",
    costumeNumber: () => 1,
    x: 0,
    y: 0,
  });

  const api = recorder("api", {
    wait: (ms: number) => { rec("api.wait", ms); return Promise.resolve(); },
    nextFrame: () => { rec("api.nextFrame"); return Promise.resolve(); },
    say: (text: unknown) => { rec("api.say", text); return Promise.resolve(); },
    running: () => runTicks-- > 0,
    getList: (name: string) => (lists[name] ??= []),
    setList: (name: string, values: Array<number | string>) => {
      lists[name] = values;
    },
    keyDown: () => false,
    mouseDown: () => false,
    timer: () => 0,
    mouseX: () => 0,
    mouseY: () => 0,
  });

  return { sprite, api, calls, lists };
}

async function compileAndRun(nodes: ScriptNode[], host: ReturnType<typeof createHost>) {
  const source = astToJs(nodes).replace("export async function run", "async function run");
  const factory = new Function(`${source}\nreturn run;`);
  const run = factory() as (ctx: { sprite: unknown; api: unknown }) => Promise<void>;
  await run({ sprite: host.sprite, api: host.api });
}

const callsTo = (calls: Call[], name: string) => calls.filter((call) => call[0] === name);

describe("astToJs - output shape", () => {
  it("wraps nodes in an exported async run function", () => {
    const source = astToJs([{ type: "move", steps: 10 }]);
    expect(source.startsWith("export async function run({ sprite, api }) {")).toBe(true);
    expect(source).toContain("const vars = {};");
    expect(source.trimEnd().endsWith("}")).toBe(true);
  });

  it("produces syntactically valid JS for a broad mix of nodes", () => {
    const program: ScriptNode[] = [
      { type: "forever", body: [
        { type: "if", condition: { type: "keyPressed", key: "Space" }, body: [{ type: "changeY", dy: 10 }] },
        { type: "repeatUntil", condition: { type: "compare", left: { type: "spriteProperty", property: "y" }, operator: ">", right: 100 }, body: [{ type: "changeY", dy: -1 }] },
        { type: "waitUntil", condition: { type: "mouseDown" } },
      ] },
    ];
    const source = astToJs(program).replace("export async function run", "async function run");
    expect(() => new Function(`${source}\nreturn run;`)).not.toThrow();
  });
});

describe("astToJs - execution", () => {
  it("evaluates arithmetic in a value slot", async () => {
    const host = createHost();
    await compileAndRun([{ type: "move", steps: { type: "arithmetic", operator: "+", left: 2, right: 3 } }], host);
    expect(callsTo(host.calls, "sprite.move")).toEqual([["sprite.move", 5]]);
  });

  it("emits extended math operators", async () => {
    const host = createHost();
    await compileAndRun([{ type: "move", steps: { type: "math", operator: "10^", value: 2 } }], host);
    expect(callsTo(host.calls, "sprite.move")).toEqual([["sprite.move", 100]]);
  });

  it("keeps decimal precision for Scratch random ranges", async () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
      const host = createHost();
      await compileAndRun([{ type: "move", steps: { type: "random", from: 1.5, to: 2.5 } }], host);
      expect(callsTo(host.calls, "sprite.move")).toEqual([["sprite.move", 2]]);
    } finally {
      Math.random = originalRandom;
    }
  });

  it("runs a repeat body a fixed number of times", async () => {
    const host = createHost();
    await compileAndRun([{ type: "repeat", times: 3, body: [{ type: "changeX", dx: 1 }] }], host);
    expect(callsTo(host.calls, "sprite.changeX")).toHaveLength(3);
  });

  it("takes the if-branch when the condition is true", async () => {
    const host = createHost();
    await compileAndRun(
      [{ type: "if", condition: { type: "compare", left: 1, operator: "<", right: 2 }, body: [{ type: "say", text: "yes" }] }],
      host,
    );
    expect(callsTo(host.calls, "api.say")).toEqual([["api.say", "yes"]]);
  });

  it("compares numeric strings like Scratch", async () => {
    const host = createHost();
    await compileAndRun([
      { type: "if", condition: { type: "compare", left: 5, operator: "=", right: "5" }, body: [{ type: "say", text: "eq" }] },
      { type: "if", condition: { type: "compare", left: 5, operator: "≠", right: "5" }, body: [{ type: "say", text: "neq" }] },
    ], host);
    expect(callsTo(host.calls, "api.say")).toEqual([["api.say", "eq"]]);
  });

  it("reads back a variable set earlier", async () => {
    const host = createHost();
    await compileAndRun(
      [
        { type: "setVariable", name: "score", value: 5 },
        { type: "changeVariable", name: "score", amount: 2 },
        { type: "move", steps: { type: "variable", name: "score" } },
      ],
      host,
    );
    expect(callsTo(host.calls, "sprite.move")).toEqual([["sprite.move", 7]]);
  });

  it("mutates lists with 1-based indexing", async () => {
    const host = createHost();
    await compileAndRun(
      [
        { type: "listAdd", list: "fruit", item: "apple" },
        { type: "listAdd", list: "fruit", item: "pear" },
        { type: "listReplace", list: "fruit", index: 2, item: "plum" },
      ],
      host,
    );
    expect(host.lists.fruit).toEqual(["apple", "plum"]);
  });

  it("supports Scratch list index labels", async () => {
    const host = createHost({ lists: { fruit: ["apple", "pear"] } });
    await compileAndRun([
      { type: "listReplace", list: "fruit", index: "last", item: "plum" },
      { type: "say", text: { type: "listItem", list: "fruit", index: "last" } },
      { type: "listInsert", list: "fruit", index: "last", item: "grape" },
      { type: "listDelete", list: "fruit", index: "last" },
    ], host);
    expect(callsTo(host.calls, "api.say")).toEqual([["api.say", "plum"]]);
    expect(host.lists.fruit).toEqual(["apple", "plum"]);
  });

  it("glides to Scratch non-sprite targets", async () => {
    const host = createHost();
    await compileAndRun([{ type: "glideToObject", seconds: 0, object: "center" }], host);
    expect(callsTo(host.calls, "sprite.setPosition").at(-1)).toEqual(["sprite.setPosition", 0, 0]);
  });

  it("stops a forever loop when running() turns false", async () => {
    const host = createHost({ runTicks: 3 });
    await compileAndRun([{ type: "forever", body: [{ type: "changeX", dx: 1 }] }], host);
    expect(callsTo(host.calls, "sprite.changeX")).toHaveLength(3);
  });
});
