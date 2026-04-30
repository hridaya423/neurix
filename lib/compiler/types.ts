export type KeyName = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Space";

export type ScriptCondition =
  | { type: "keyPressed"; key: KeyName };

export type ScriptNode =
  | { type: "move"; steps: number }
  | { type: "turn"; degrees: number }
  | { type: "setPosition"; x: number; y: number }
  | { type: "goHome" }
  | { type: "changeX"; dx: number }
  | { type: "changeY"; dy: number }
  | { type: "say"; text: string }
  | { type: "wait"; seconds: number }
  | { type: "repeat"; times: number; body: ScriptNode[] }
  | { type: "forever"; body: ScriptNode[] }
  | { type: "if"; condition: ScriptCondition; body: ScriptNode[] }
  | { type: "aiIntent"; prompt: string };
