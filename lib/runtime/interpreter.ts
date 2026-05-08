import type { ScriptCondition, ScriptNode, ScriptValue } from "@/lib/compiler/types";

export type ScriptRuntime = {
  isCancelled: () => boolean;
  wait: (ms: number) => Promise<void>;
  nextFrame: () => Promise<void>;
  keyDown: (key: string) => boolean;
  anyKeyDown: () => boolean;
  lastKey: () => string;
  touchingEdge: () => boolean;
  mouseDown: () => boolean;
  getMouseX: () => number;
  getMouseY: () => number;
  getTimerSeconds: () => number;
  getX: () => number;
  getY: () => number;
  getDirection: () => number;
  getSize: () => number;
  getBackdropName: () => string;
  getBackdropNumber: () => number;
  getCostumeName: () => string;
  getCostumeNumber: () => number;
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
  setTone: (tone: string) => void;
  changeTone: (amount: number) => void;
  createClone: () => void;
  deleteClone: () => void;
  goToLayer: (layer: "front" | "back") => void;
  changeLayer: (direction: "forward" | "backward", amount: number) => void;
  switchBackdrop: (backdropId: string) => void;
  nextBackdrop: () => void;
  switchCostume: (costumeId: string) => void;
  nextCostume: () => void;
  show: () => void;
  hide: () => void;
};

type Variables = Record<string, number | string>;

function toNumber(value: number | string) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toText(value: number | string) {
  return String(value);
}

function getVariable(variables: Variables, name: string) {
  return variables[name] ?? 0;
}

function valueOf(value: ScriptValue, runtime: ScriptRuntime, variables: Variables): number | string {
  if (typeof value === "number" || typeof value === "string") return value;

  switch (value.type) {
    case "number":
      return value.value;
    case "string":
      return value.value;
    case "variable":
      return getVariable(variables, value.name);
    case "spriteProperty":
      if (value.property === "x") return runtime.getX();
      if (value.property === "y") return runtime.getY();
      if (value.property === "direction") return runtime.getDirection();
      return runtime.getSize();
    case "stageProperty":
      return value.property === "backdropName" ? runtime.getBackdropName() : runtime.getBackdropNumber();
    case "costumeProperty":
      return value.property === "costumeName" ? runtime.getCostumeName() : runtime.getCostumeNumber();
    case "sensing":
      if (value.property === "mouseX") return runtime.getMouseX();
      if (value.property === "mouseY") return runtime.getMouseY();
      if (value.property === "timer") return runtime.getTimerSeconds();
      if (value.property === "currentSecond") return new Date().getSeconds();
      if (value.property === "currentMinute") return new Date().getMinutes();
      if (value.property === "currentHour") return new Date().getHours();
      if (value.property === "lastKey") return runtime.lastKey();
      return Math.round(Math.hypot(runtime.getX(), runtime.getY()));
    case "random": {
      const from = toNumber(valueOf(value.from, runtime, variables));
      const to = toNumber(valueOf(value.to, runtime, variables));
      const min = Math.min(from, to);
      const max = Math.max(from, to);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    case "arithmetic": {
      const left = toNumber(valueOf(value.left, runtime, variables));
      const right = toNumber(valueOf(value.right, runtime, variables));
      if (value.operator === "+") return left + right;
      if (value.operator === "-") return left - right;
      if (value.operator === "*") return left * right;
      if (value.operator === "/") return right === 0 ? 0 : left / right;
      if (value.operator === "%") return right === 0 ? 0 : left % right;
      return left ** right;
    }
    case "round":
      return Math.round(toNumber(valueOf(value.value, runtime, variables)));
    case "math": {
      const number = toNumber(valueOf(value.value, runtime, variables));
      if (value.operator === "abs") return Math.abs(number);
      if (value.operator === "floor") return Math.floor(number);
      if (value.operator === "ceiling") return Math.ceil(number);
      if (value.operator === "sqrt") return Math.sqrt(Math.max(0, number));
      if (value.operator === "sin") return Math.sin((number * Math.PI) / 180);
      if (value.operator === "cos") return Math.cos((number * Math.PI) / 180);
      return Math.tan((number * Math.PI) / 180);
    }
    case "join":
      return value.values.map((item) => toText(valueOf(item, runtime, variables))).join("");
    case "letterOf": {
      const text = toText(valueOf(value.text, runtime, variables));
      const index = Math.max(1, Math.floor(toNumber(valueOf(value.index, runtime, variables)))) - 1;
      return text[index] ?? "";
    }
    case "lengthOf":
      return toText(valueOf(value.text, runtime, variables)).length;
  }
}

function isConditionTrue(condition: ScriptCondition, runtime: ScriptRuntime, variables: Variables): boolean {
  switch (condition.type) {
    case "keyPressed":
      return runtime.keyDown(condition.key);
    case "touchingEdge":
      return runtime.touchingEdge();
    case "mouseDown":
      return runtime.mouseDown();
    case "anyKeyPressed":
      return runtime.anyKeyDown();
    case "boolean":
      return condition.value;
    case "not":
      return !isConditionTrue(condition.condition, runtime, variables);
    case "and":
      return isConditionTrue(condition.left, runtime, variables) && isConditionTrue(condition.right, runtime, variables);
    case "or":
      return isConditionTrue(condition.left, runtime, variables) || isConditionTrue(condition.right, runtime, variables);
    case "compare": {
      const left = valueOf(condition.left, runtime, variables);
      const right = valueOf(condition.right, runtime, variables);
      if (condition.operator === "=") return left === right;
      if (condition.operator === "≠") return left !== right;
      const leftNumber = toNumber(left);
      const rightNumber = toNumber(right);
      if (condition.operator === "<") return leftNumber < rightNumber;
      if (condition.operator === ">") return leftNumber > rightNumber;
      if (condition.operator === "≤") return leftNumber <= rightNumber;
      return leftNumber >= rightNumber;
    }
    case "contains":
      return toText(valueOf(condition.text, runtime, variables)).includes(toText(valueOf(condition.search, runtime, variables)));
  }
}

async function runNode(node: ScriptNode, runtime: ScriptRuntime, variables: Variables): Promise<void> {
  if (runtime.isCancelled()) return;

  switch (node.type) {
    case "move":
      runtime.move(toNumber(valueOf(node.steps, runtime, variables)));
      await runtime.wait(120);
      break;
    case "turn":
      runtime.turn(toNumber(valueOf(node.degrees, runtime, variables)));
      await runtime.wait(100);
      break;
    case "setPosition":
      runtime.setPosition(toNumber(valueOf(node.x, runtime, variables)), toNumber(valueOf(node.y, runtime, variables)));
      await runtime.wait(100);
      break;
    case "goHome":
      runtime.setPosition(0, 0);
      await runtime.wait(100);
      break;
    case "changeX":
      runtime.changeX(toNumber(valueOf(node.dx, runtime, variables)));
      break;
    case "changeY":
      runtime.changeY(toNumber(valueOf(node.dy, runtime, variables)));
      break;
    case "setX":
      runtime.setX(toNumber(valueOf(node.x, runtime, variables)));
      await runtime.wait(100);
      break;
    case "setY":
      runtime.setY(toNumber(valueOf(node.y, runtime, variables)));
      await runtime.wait(100);
      break;
    case "setDirection":
    case "pointInDirection":
      runtime.setDirection(toNumber(valueOf(node.direction, runtime, variables)));
      await runtime.wait(100);
      break;
    case "ifOnEdgeBounce":
      runtime.ifOnEdgeBounce();
      await runtime.wait(100);
      break;
    case "goToMouse":
      runtime.setPosition(runtime.getMouseX(), runtime.getMouseY());
      await runtime.wait(100);
      break;
    case "goToRandom":
      runtime.setPosition(Math.round(Math.random() * 480 - 240), Math.round(Math.random() * 360 - 180));
      await runtime.wait(100);
      break;
    case "pointTowardMouse": {
      const dx = runtime.getMouseX() - runtime.getX();
      const dy = runtime.getMouseY() - runtime.getY();
      runtime.setDirection((Math.atan2(dx, dy) * 180) / Math.PI);
      await runtime.wait(100);
      break;
    }
    case "pointTowardCenter": {
      const dx = -runtime.getX();
      const dy = -runtime.getY();
      runtime.setDirection((Math.atan2(dx, dy) * 180) / Math.PI);
      await runtime.wait(100);
      break;
    }
    case "glideToPosition": {
      const seconds = Math.max(0, toNumber(valueOf(node.seconds, runtime, variables)));
      const startX = runtime.getX();
      const startY = runtime.getY();
      const targetX = toNumber(valueOf(node.x, runtime, variables));
      const targetY = toNumber(valueOf(node.y, runtime, variables));
      const steps = Math.max(1, Math.ceil((seconds * 1000) / 16));
      for (let i = 1; i <= steps && !runtime.isCancelled(); i += 1) {
        const t = i / steps;
        runtime.setPosition(startX + (targetX - startX) * t, startY + (targetY - startY) * t);
        await runtime.nextFrame();
      }
      break;
    }
    case "glideToMouse": {
      const seconds = Math.max(0, toNumber(valueOf(node.seconds, runtime, variables)));
      const startX = runtime.getX();
      const startY = runtime.getY();
      const targetX = runtime.getMouseX();
      const targetY = runtime.getMouseY();
      const steps = Math.max(1, Math.ceil((seconds * 1000) / 16));
      for (let i = 1; i <= steps && !runtime.isCancelled(); i += 1) {
        const t = i / steps;
        runtime.setPosition(startX + (targetX - startX) * t, startY + (targetY - startY) * t);
        await runtime.nextFrame();
      }
      break;
    }
    case "say":
      runtime.say(toText(valueOf(node.text, runtime, variables)));
      await runtime.wait(900);
      break;
    case "sayForSeconds":
      runtime.say(toText(valueOf(node.text, runtime, variables)));
      await runtime.wait(Math.max(0, toNumber(valueOf(node.seconds, runtime, variables))) * 1000);
      runtime.say(undefined);
      break;
    case "think":
      runtime.say(toText(valueOf(node.text, runtime, variables)));
      await runtime.wait(900);
      break;
    case "thinkForSeconds":
      runtime.say(toText(valueOf(node.text, runtime, variables)));
      await runtime.wait(Math.max(0, toNumber(valueOf(node.seconds, runtime, variables))) * 1000);
      runtime.say(undefined);
      break;
    case "clearSpeech":
      runtime.say(undefined);
      break;
    case "changeSize":
      runtime.changeSize(toNumber(valueOf(node.amount, runtime, variables)));
      await runtime.wait(100);
      break;
    case "setSize":
      runtime.setSize(toNumber(valueOf(node.size, runtime, variables)));
      await runtime.wait(100);
      break;
    case "setTone":
      runtime.setTone(node.tone);
      break;
    case "changeTone":
      runtime.changeTone(toNumber(valueOf(node.amount, runtime, variables)));
      break;
    case "show":
      runtime.show();
      break;
    case "hide":
      runtime.hide();
      break;
    case "goToLayer":
      runtime.goToLayer(node.layer);
      break;
    case "changeLayer":
      runtime.changeLayer(node.direction, Math.max(0, Math.floor(toNumber(valueOf(node.amount, runtime, variables)))));
      break;
    case "switchBackdrop":
      runtime.switchBackdrop(node.backdropId);
      break;
    case "nextBackdrop":
      runtime.nextBackdrop();
      break;
    case "switchCostume":
      runtime.switchCostume(node.costumeId);
      break;
    case "nextCostume":
      runtime.nextCostume();
      break;
    case "setVariable":
      variables[node.name] = valueOf(node.value, runtime, variables);
      break;
    case "changeVariable":
      variables[node.name] = toNumber(getVariable(variables, node.name)) + toNumber(valueOf(node.amount, runtime, variables));
      break;
    case "createClone":
      runtime.createClone();
      break;
    case "deleteClone":
      runtime.deleteClone();
      return;
    case "wait":
      await runtime.wait(Math.max(0, toNumber(valueOf(node.seconds, runtime, variables))) * 1000);
      break;
    case "repeat":
      for (let i = 0; i < Math.max(0, Math.floor(toNumber(valueOf(node.times, runtime, variables)))); i += 1) {
        await runScript(node.body, runtime, variables);
        if (runtime.isCancelled()) return;
      }
      break;
    case "repeatUntil":
      while (!runtime.isCancelled() && !isConditionTrue(node.condition, runtime, variables)) {
        await runScript(node.body, runtime, variables);
        await runtime.nextFrame();
      }
      break;
    case "waitUntil":
      while (!runtime.isCancelled() && !isConditionTrue(node.condition, runtime, variables)) {
        await runtime.nextFrame();
      }
      break;
    case "forever":
      while (!runtime.isCancelled()) {
        await runScript(node.body, runtime, variables);
        await runtime.nextFrame();
      }
      break;
    case "if":
      if (isConditionTrue(node.condition, runtime, variables)) {
        await runScript(node.body, runtime, variables);
      }
      break;
    case "ifElse":
      if (isConditionTrue(node.condition, runtime, variables)) {
        await runScript(node.thenBody, runtime, variables);
      } else {
        await runScript(node.elseBody, runtime, variables);
      }
      break;
    case "customCall":
      runtime.say(`Custom block needs a definition: ${node.name}`);
      await runtime.wait(900);
      break;
    case "aiIntent":
      runtime.say(`Custom block needs a definition: ${node.prompt}`);
      await runtime.wait(900);
      break;
  }
}

export async function runScript(nodes: ScriptNode[], runtime: ScriptRuntime, variables: Variables = {}) {
  for (const node of nodes) {
    await runNode(node, runtime, variables);
    if (runtime.isCancelled()) return;
  }
}
