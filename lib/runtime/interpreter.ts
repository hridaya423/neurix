import type { ScriptCondition, ScriptNode } from "@/lib/compiler/types";

export type ScriptRuntime = {
  isCancelled: () => boolean;
  wait: (ms: number) => Promise<void>;
  nextFrame: () => Promise<void>;
  keyDown: (key: string) => boolean;
  touchingEdge: () => boolean;
  move: (steps: number) => void;
  turn: (degrees: number) => void;
  setPosition: (x: number, y: number) => void;
  changeX: (dx: number) => void;
  changeY: (dy: number) => void;
  setX: (x: number) => void;
  setY: (y: number) => void;
  setDirection: (direction: number) => void;
  ifOnEdgeBounce: () => void;
  say: (text: string | undefined) => void;
  changeSize: (amount: number) => void;
  setSize: (size: number) => void;
  show: () => void;
  hide: () => void;
};

function isConditionTrue(condition: ScriptCondition, runtime: ScriptRuntime): boolean {
  switch (condition.type) {
    case "keyPressed":
      return runtime.keyDown(condition.key);
    case "touchingEdge":
      return runtime.touchingEdge();
    case "not":
      return !isConditionTrue(condition.condition, runtime);
    case "and":
      return isConditionTrue(condition.left, runtime) && isConditionTrue(condition.right, runtime);
    case "or":
      return isConditionTrue(condition.left, runtime) || isConditionTrue(condition.right, runtime);
    case "compare":
      if (condition.operator === "=") return condition.left === condition.right;
      if (condition.operator === "<") return condition.left < condition.right;
      return condition.left > condition.right;
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
    case "setX":
      runtime.setX(node.x);
      await runtime.wait(100);
      break;
    case "setY":
      runtime.setY(node.y);
      await runtime.wait(100);
      break;
    case "setDirection":
    case "pointInDirection":
      runtime.setDirection(node.direction);
      await runtime.wait(100);
      break;
    case "ifOnEdgeBounce":
      runtime.ifOnEdgeBounce();
      await runtime.wait(100);
      break;
    case "say":
      runtime.say(node.text);
      await runtime.wait(900);
      break;
    case "sayForSeconds":
      runtime.say(node.text);
      await runtime.wait(Math.max(0, node.seconds) * 1000);
      runtime.say(undefined);
      break;
    case "think":
      runtime.say(node.text);
      await runtime.wait(900);
      break;
    case "thinkForSeconds":
      runtime.say(node.text);
      await runtime.wait(Math.max(0, node.seconds) * 1000);
      runtime.say(undefined);
      break;
    case "clearSpeech":
      runtime.say(undefined);
      break;
    case "changeSize":
      runtime.changeSize(node.amount);
      await runtime.wait(100);
      break;
    case "setSize":
      runtime.setSize(node.size);
      await runtime.wait(100);
      break;
    case "show":
      runtime.show();
      break;
    case "hide":
      runtime.hide();
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
    case "ifElse":
      if (isConditionTrue(node.condition, runtime)) {
        await runScript(node.thenBody, runtime);
      } else {
        await runScript(node.elseBody, runtime);
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
