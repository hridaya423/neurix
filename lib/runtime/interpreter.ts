import type { GraphicEffect, ScriptCondition, ScriptNode, ScriptValue } from "@/lib/compiler/types";

export type ScriptRuntime = {
  isCancelled: () => boolean;
  wait: (ms: number) => Promise<void>;
  nextFrame: () => Promise<void>;
  keyDown: (key: string) => boolean;
  anyKeyDown: () => boolean;
  lastKey: () => string;
  touchingEdge: () => boolean;
  touchingMousePointer: () => boolean;
  touchingSprite: (name: string) => boolean;
  touchingColor: (color: string) => boolean;
  colorTouchingColor: (color: string, touching: string) => boolean;
  distanceToSprite: (name: string) => number;
  getSpriteX: (name: string) => number;
  getSpriteY: (name: string) => number;
  getSpriteDirection: (name: string) => number;
  getSpriteSize: (name: string) => number;
  getSpriteCostumeName: (name: string) => string;
  getSpriteCostumeNumber: (name: string) => number;
  getSpriteVolume: (name: string) => number;
  mouseDown: () => boolean;
  getMouseX: () => number;
  getMouseY: () => number;
  username?: () => string;
  loudness?: () => number;
  getTimerSeconds: () => number;
  getX: () => number;
  getY: () => number;
  getDirection: () => number;
  getSize: () => number;
  getBackdropName: () => string;
  getBackdropNumber: () => number;
  getCostumeName: () => string;
  getCostumeNumber: () => number;
  getVariable: (name: string) => number | string;
  setVariable: (name: string, value: number | string) => void;
  getCloudVariable: (name: string) => number | string;
  setCloudVariable: (name: string, value: number | string) => void;
  getList: (name: string) => Array<number | string>;
  setList: (name: string, values: Array<number | string>) => void;
  setListVisible?: (name: string, visible: boolean) => void;
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
  changeGraphicEffect: (effect: GraphicEffect, amount: number) => void;
  setGraphicEffect: (effect: GraphicEffect, value: number) => void;
  clearGraphicEffects: () => void;
  resetTimer: () => void;
  askAndWait: (question: string) => Promise<void>;
  getAnswer: () => string;
  setDragMode: (mode: "draggable" | "not draggable") => void;
  setVariableVisible: (name: string, visible: boolean) => void;
  createClone: () => void;
  deleteClone: () => void;
  goToLayer: (layer: "front" | "back") => void;
  changeLayer: (direction: "forward" | "backward", amount: number) => void;
  switchBackdrop: (backdropId: string) => void;
  switchBackdropAndWait: (backdropId: string) => Promise<void>;
  nextBackdrop: () => void;
  broadcast: (message: string, waitForCompletion: boolean) => Promise<void>;
  switchCostume: (costumeId: string) => void;
  nextCostume: () => void;
  playSound?: (soundId: string, waitForCompletion: boolean) => Promise<void>;
  stopAllSounds?: () => void;
  changeSoundEffect?: (effect: "pitch" | "pan", amount: number) => void;
  setSoundEffect?: (effect: "pitch" | "pan", value: number) => void;
  clearSoundEffects?: () => void;
  changeVolume?: (amount: number) => void;
  setVolume?: (volume: number) => void;
  getVolume?: () => number;
  show: () => void;
  hide: () => void;
};

type Variables = Record<string, number | string>;

const maxCloudValue = 999_999_999;

function isCloudVariableName(name: string) {
  return name.startsWith("Cloud: ") || name.startsWith("☁ ");
}

function clampCloudValue(value: number | string) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-maxCloudValue, Math.min(maxCloudValue, Math.round(number * 1000) / 1000));
}

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

function listIndex(value: number | string, length: number) {
  return Math.max(0, Math.min(length - 1, Math.floor(toNumber(value)) - 1));
}

function valueOf(value: ScriptValue, runtime: ScriptRuntime, variables: Variables): number | string {
  if (typeof value === "number" || typeof value === "string") return value;

  switch (value.type) {
    case "number":
      return value.value;
    case "string":
      return value.value;
    case "variable":
      if (isCloudVariableName(value.name)) return runtime.getCloudVariable(value.name);
      return runtime.getVariable(value.name) ?? getVariable(variables, value.name);
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
      if (value.property === "currentDate") return new Date().getDate();
      if (value.property === "currentMonth") return new Date().getMonth() + 1;
      if (value.property === "currentYear") return new Date().getFullYear();
      if (value.property === "currentDayOfWeek") return new Date().getDay() + 1;
      if (value.property === "daysSince2000") return Math.floor((Date.now() - Date.UTC(2000, 0, 1)) / 86400000);
      if (value.property === "username") return runtime.username?.() ?? "";
      if (value.property === "loudness") return runtime.loudness?.() ?? 0;
      if (value.property === "lastKey") return runtime.lastKey();
      return Math.round(Math.hypot(runtime.getX(), runtime.getY()));
    case "distanceToObject":
      if (value.object === "mouse-pointer") return Math.round(Math.hypot(runtime.getMouseX() - runtime.getX(), runtime.getMouseY() - runtime.getY()));
      if (value.object === "center" || value.object === "edge") return Math.round(Math.hypot(runtime.getX(), runtime.getY()));
      return Math.round(runtime.distanceToSprite(value.object));
    case "propertyOf":
      if (value.object === "Stage") {
        if (value.property === "volume") return runtime.getVolume?.() ?? 100;
        if (value.property === "costumeName") return runtime.getBackdropName();
        if (value.property === "costumeNumber") return runtime.getBackdropNumber();
        return 0;
      }
      if (value.property === "x") return runtime.getSpriteX(value.object);
      if (value.property === "y") return runtime.getSpriteY(value.object);
      if (value.property === "direction") return runtime.getSpriteDirection(value.object);
      if (value.property === "size") return runtime.getSpriteSize(value.object);
      if (value.property === "costumeName") return runtime.getSpriteCostumeName(value.object);
      if (value.property === "costumeNumber") return runtime.getSpriteCostumeNumber(value.object);
      return runtime.getSpriteVolume(value.object);
    case "answer":
      return runtime.getAnswer();
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
    case "listItem": {
      const list = runtime.getList(value.list);
      return list[listIndex(valueOf(value.index, runtime, variables), list.length)] ?? "";
    }
    case "listIndex": {
      const item = toText(valueOf(value.item, runtime, variables));
      const index = runtime.getList(value.list).findIndex((entry) => toText(entry) === item);
      return index >= 0 ? index + 1 : 0;
    }
    case "listLength":
      return runtime.getList(value.list).length;
    case "soundVolume":
      return runtime.getVolume?.() ?? 100;
  }
}

function isConditionTrue(condition: ScriptCondition, runtime: ScriptRuntime, variables: Variables): boolean {
  switch (condition.type) {
    case "keyPressed":
      return runtime.keyDown(condition.key);
    case "touchingObject":
      if (condition.object === "edge") return runtime.touchingEdge();
      if (condition.object === "mouse-pointer") return runtime.touchingMousePointer();
      return runtime.touchingSprite(condition.object);
    case "touchingColor":
      return runtime.touchingColor(condition.color);
    case "colorTouchingColor":
      return runtime.colorTouchingColor(condition.color, condition.touching);
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
    case "listContains": {
      const item = toText(valueOf(condition.item, runtime, variables));
      return runtime.getList(condition.list).some((entry) => toText(entry) === item);
    }
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
    case "goToObject":
      if (node.object === "mouse-pointer") {
        runtime.setPosition(runtime.getMouseX(), runtime.getMouseY());
      } else if (node.object === "random position") {
        runtime.setPosition(Math.round(Math.random() * 480 - 240), Math.round(Math.random() * 360 - 180));
      } else {
        runtime.setPosition(runtime.getSpriteX(node.object), runtime.getSpriteY(node.object));
      }
      await runtime.wait(100);
      break;
    case "pointTowardObject":
      if (node.object === "mouse-pointer") {
        runtime.setDirection((Math.atan2(runtime.getMouseX() - runtime.getX(), runtime.getMouseY() - runtime.getY()) * 180) / Math.PI);
      } else if (node.object === "center") {
        runtime.setDirection((Math.atan2(-runtime.getX(), -runtime.getY()) * 180) / Math.PI);
      } else {
        runtime.setDirection((Math.atan2(runtime.getSpriteX(node.object) - runtime.getX(), runtime.getSpriteY(node.object) - runtime.getY()) * 180) / Math.PI);
      }
      await runtime.wait(100);
      break;
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
    case "glideToObject": {
      const seconds = Math.max(0, toNumber(valueOf(node.seconds, runtime, variables)));
      const startX = runtime.getX();
      const startY = runtime.getY();
      let targetX: number;
      let targetY: number;
      if (node.object === "mouse-pointer") {
        targetX = runtime.getMouseX();
        targetY = runtime.getMouseY();
      } else {
        targetX = runtime.getSpriteX(node.object);
        targetY = runtime.getSpriteY(node.object);
      }
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
    case "changeGraphicEffect":
      runtime.changeGraphicEffect(node.effect, toNumber(valueOf(node.amount, runtime, variables)));
      break;
    case "setGraphicEffect":
      runtime.setGraphicEffect(node.effect, toNumber(valueOf(node.value, runtime, variables)));
      break;
    case "clearGraphicEffects":
      runtime.clearGraphicEffects();
      break;
    case "showVariable":
      runtime.setVariableVisible(node.name, true);
      break;
    case "hideVariable":
      runtime.setVariableVisible(node.name, false);
      break;
    case "resetTimer":
      runtime.resetTimer();
      break;
    case "askAndWait":
      await runtime.askAndWait(toText(valueOf(node.question, runtime, variables)));
      break;
    case "setDragMode":
      runtime.setDragMode(node.mode);
      break;
    case "stop":
      return;
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
    case "switchBackdropAndWait":
      await runtime.switchBackdropAndWait(node.backdropId);
      break;
    case "nextBackdrop":
      runtime.nextBackdrop();
      break;
    case "broadcast":
      await runtime.broadcast(node.message, false);
      break;
    case "broadcastAndWait":
      await runtime.broadcast(node.message, true);
      break;
    case "switchCostume":
      runtime.switchCostume(node.costumeId);
      break;
    case "nextCostume":
      runtime.nextCostume();
      break;
    case "playSound":
      await runtime.playSound?.(node.soundId, node.wait);
      break;
    case "stopAllSounds":
      runtime.stopAllSounds?.();
      break;
    case "changeSoundEffect":
      runtime.changeSoundEffect?.(node.effect, toNumber(valueOf(node.amount, runtime, variables)));
      break;
    case "setSoundEffect":
      runtime.setSoundEffect?.(node.effect, toNumber(valueOf(node.value, runtime, variables)));
      break;
    case "clearSoundEffects":
      runtime.clearSoundEffects?.();
      break;
    case "changeVolume":
      runtime.changeVolume?.(toNumber(valueOf(node.amount, runtime, variables)));
      break;
    case "setVolume":
      runtime.setVolume?.(toNumber(valueOf(node.volume, runtime, variables)));
      break;
    case "setVariable":
      if (isCloudVariableName(node.name)) {
        runtime.setCloudVariable(node.name, clampCloudValue(valueOf(node.value, runtime, variables)));
      } else {
        runtime.setVariable(node.name, valueOf(node.value, runtime, variables));
      }
      break;
    case "changeVariable":
      if (isCloudVariableName(node.name)) {
        runtime.setCloudVariable(node.name, clampCloudValue(toNumber(runtime.getCloudVariable(node.name)) + toNumber(valueOf(node.amount, runtime, variables))));
      } else {
        runtime.setVariable(node.name, toNumber(runtime.getVariable(node.name)) + toNumber(valueOf(node.amount, runtime, variables)));
      }
      break;
    case "listAdd":
      runtime.setList(node.list, [...runtime.getList(node.list), valueOf(node.item, runtime, variables)]);
      break;
    case "listDelete":
      if (node.index === "all") {
        runtime.setList(node.list, []);
      } else {
        const list = runtime.getList(node.list);
        const index = listIndex(valueOf(node.index, runtime, variables), list.length);
        runtime.setList(node.list, list.filter((_, itemIndex) => itemIndex !== index));
      }
      break;
    case "listInsert": {
      const list = runtime.getList(node.list);
      const index = Math.max(0, Math.min(list.length, Math.floor(toNumber(valueOf(node.index, runtime, variables))) - 1));
      runtime.setList(node.list, [...list.slice(0, index), valueOf(node.item, runtime, variables), ...list.slice(index)]);
      break;
    }
    case "listReplace": {
      const list = runtime.getList(node.list);
      const index = listIndex(valueOf(node.index, runtime, variables), list.length);
      runtime.setList(node.list, list.map((item, itemIndex) => itemIndex === index ? valueOf(node.item, runtime, variables) : item));
      break;
    }
    case "showList":
      runtime.setListVisible?.(node.list, true);
      break;
    case "hideList":
      runtime.setListVisible?.(node.list, false);
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
