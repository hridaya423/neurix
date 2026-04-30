import type { ScriptCondition, ScriptNode } from "@/lib/compiler/types";

export type ScriptRuntime = {
  isCancelled: () => boolean;
  wait: (ms: number) => Promise<void>;
  nextFrame: () => Promise<void>;
  keyDown: (key: string) => boolean;
  move: (steps: number) => void;
  turn: (degrees: number) => void;
  setPosition: (x: number, y: number) => void;
  changeX: (dx: number) => void;
  changeY: (dy: number) => void;
  say: (text: string | undefined) => void;
};

function isConditionTrue(condition: ScriptCondition, runtime: ScriptRuntime) {
  switch (condition.type) {
    case "keyPressed":
      return runtime.keyDown(condition.key);
  }
}

async function runNode(node: ScriptNode, runtime: ScriptRuntime): Promise<void> {
  if (runtime.isCancelled()) return;

  switch (node.type) {
    case "move":
      runtime.move(node.steps);
      await runtime.wait(120);
      break;
    case "turn":
      runtime.turn(node.degrees);
      await runtime.wait(100);
      break;
    case "setPosition":
      runtime.setPosition(node.x, node.y);
      await runtime.wait(100);
      break;
    case "goHome":
      runtime.setPosition(0, 0);
      await runtime.wait(100);
      break;
    case "changeX":
      runtime.changeX(node.dx);
      break;
    case "changeY":
      runtime.changeY(node.dy);
      break;
    case "say":
      runtime.say(node.text);
      await runtime.wait(900);
      break;
    case "wait":
      await runtime.wait(Math.max(0, node.seconds) * 1000);
      break;
    case "repeat":
      for (let i = 0; i < node.times; i += 1) {
        await runScript(node.body, runtime);
        if (runtime.isCancelled()) return;
      }
      break;
    case "forever":
      while (!runtime.isCancelled()) {
        await runScript(node.body, runtime);
        await runtime.nextFrame();
      }
      break;
    case "if":
      if (isConditionTrue(node.condition, runtime)) {
        await runScript(node.body, runtime);
      }
      break;
    case "aiIntent":
      runtime.say(`AI block needs resolving: ${node.prompt}`);
      await runtime.wait(900);
      break;
  }
}

export async function runScript(nodes: ScriptNode[], runtime: ScriptRuntime) {
  for (const node of nodes) {
    await runNode(node, runtime);
    if (runtime.isCancelled()) return;
  }
}
