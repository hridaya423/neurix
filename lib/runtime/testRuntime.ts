import type { ScriptRuntime } from "@/lib/runtime/interpreter";

export type RuntimeCall = [string, ...unknown[]];

export type TestRuntimeState = {
  x: number;
  y: number;
  direction: number;
  size: number;
  visible: boolean;
  vars: Record<string, number | string>;
  cloudVars: Record<string, number | string>;
  lists: Record<string, Array<number | string>>;
  says: Array<string | undefined>;
  waits: number[];
  calls: RuntimeCall[];
  ticks: number;
};

export type TestRuntimeOptions = {
  cancelAfterTicks?: number;
  vars?: Record<string, number | string>;
  lists?: Record<string, Array<number | string>>;
  keysDown?: string[];
  timerSeconds?: number;
};

export function createTestRuntime(options: TestRuntimeOptions = {}) {
  const state: TestRuntimeState = {
    x: 0,
    y: 0,
    direction: 90,
    size: 100,
    visible: true,
    vars: { ...(options.vars ?? {}) },
    cloudVars: {},
    lists: Object.fromEntries(Object.entries(options.lists ?? {}).map(([k, v]) => [k, [...v]])),
    says: [],
    waits: [],
    calls: [],
    ticks: 0,
  };

  const cancelAfter = options.cancelAfterTicks ?? Infinity;
  const keysDown = new Set(options.keysDown ?? []);
  const record = (name: string, ...args: unknown[]) => state.calls.push([name, ...args]);

  const runtime: ScriptRuntime = {
    isCancelled: () => state.ticks >= cancelAfter,
    wait: (ms) => {
      state.waits.push(ms);
      record("wait", ms);
      return Promise.resolve();
    },
    nextFrame: () => {
      state.ticks += 1;
      return Promise.resolve();
    },
    keyDown: (key) => keysDown.has(key),
    anyKeyDown: () => keysDown.size > 0,
    lastKey: () => [...keysDown][0] ?? "",
    touchingEdge: () => false,
    touchingMousePointer: () => false,
    touchingSprite: () => false,
    touchingColor: () => false,
    colorTouchingColor: () => false,
    distanceToSprite: () => 0,
    getSpriteX: () => 0,
    getSpriteY: () => 0,
    getSpriteDirection: () => 90,
    getSpriteSize: () => 100,
    getSpriteCostumeName: () => "costume1",
    getSpriteCostumeNumber: () => 1,
    getSpriteVolume: () => 100,
    mouseDown: () => false,
    getMouseX: () => 0,
    getMouseY: () => 0,
    getTimerSeconds: () => options.timerSeconds ?? 0,
    getX: () => state.x,
    getY: () => state.y,
    getDirection: () => state.direction,
    getSize: () => state.size,
    getBackdropName: () => "backdrop1",
    getBackdropNumber: () => 1,
    getCostumeName: () => "costume1",
    getCostumeNumber: () => 1,
    getVariable: (name) => state.vars[name] ?? 0,
    setVariable: (name, value) => {
      state.vars[name] = value;
      record("setVariable", name, value);
    },
    getCloudVariable: (name) => state.cloudVars[name] ?? 0,
    setCloudVariable: (name, value) => {
      state.cloudVars[name] = value;
      record("setCloudVariable", name, value);
    },
    getList: (name) => (state.lists[name] ??= []),
    setList: (name, values) => {
      state.lists[name] = values;
    },
    setListVisible: (name, visible) => record("setListVisible", name, visible),
    move: (steps) => {
      const radians = (state.direction * Math.PI) / 180;
      state.x += steps * Math.cos(radians);
      state.y += steps * Math.sin(radians);
      record("move", steps);
    },
    turn: (degrees) => {
      state.direction += degrees;
      record("turn", degrees);
    },
    setPosition: (x, y) => {
      state.x = x;
      state.y = y;
      record("setPosition", x, y);
    },
    changeX: (dx) => {
      state.x += dx;
      record("changeX", dx);
    },
    changeY: (dy) => {
      state.y += dy;
      record("changeY", dy);
    },
    setX: (x) => {
      state.x = x;
      record("setX", x);
    },
    setY: (y) => {
      state.y = y;
      record("setY", y);
    },
    setDirection: (direction) => {
      state.direction = direction;
      record("setDirection", direction);
    },
    ifOnEdgeBounce: () => record("ifOnEdgeBounce"),
    say: (text) => {
      state.says.push(text);
      record("say", text);
    },
    changeSize: (amount) => {
      state.size += amount;
      record("changeSize", amount);
    },
    setSize: (size) => {
      state.size = size;
      record("setSize", size);
    },
    setTone: (tone) => record("setTone", tone),
    changeTone: (amount) => record("changeTone", amount),
    changeGraphicEffect: (effect, amount) => record("changeGraphicEffect", effect, amount),
    setGraphicEffect: (effect, value) => record("setGraphicEffect", effect, value),
    clearGraphicEffects: () => record("clearGraphicEffects"),
    resetTimer: () => record("resetTimer"),
    askAndWait: (question) => {
      record("askAndWait", question);
      return Promise.resolve();
    },
    getAnswer: () => "",
    setDragMode: (mode) => record("setDragMode", mode),
    setVariableVisible: (name, visible) => record("setVariableVisible", name, visible),
    createClone: () => record("createClone"),
    deleteClone: () => record("deleteClone"),
    goToLayer: (layer) => record("goToLayer", layer),
    changeLayer: (direction, amount) => record("changeLayer", direction, amount),
    switchBackdrop: (id) => record("switchBackdrop", id),
    switchBackdropAndWait: (id) => {
      record("switchBackdropAndWait", id);
      return Promise.resolve();
    },
    nextBackdrop: () => record("nextBackdrop"),
    broadcast: (message, wait) => {
      record("broadcast", message, wait);
      return Promise.resolve();
    },
    switchCostume: (id) => record("switchCostume", id),
    nextCostume: () => record("nextCostume"),
    playSound: (id, wait) => {
      record("playSound", id, wait);
      return Promise.resolve();
    },
    stopAllSounds: () => record("stopAllSounds"),
    changeSoundEffect: (effect, amount) => record("changeSoundEffect", effect, amount),
    setSoundEffect: (effect, value) => record("setSoundEffect", effect, value),
    clearSoundEffects: () => record("clearSoundEffects"),
    changeVolume: (amount) => record("changeVolume", amount),
    setVolume: (volume) => record("setVolume", volume),
    getVolume: () => 100,
    show: () => {
      state.visible = true;
      record("show");
    },
    hide: () => {
      state.visible = false;
      record("hide");
    },
  };

  return { runtime, state };
}

export function callNames(state: TestRuntimeState) {
  return state.calls.map((call) => call[0]);
}
