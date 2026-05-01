export type KeyName = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Space";

export type ScriptCondition =
  | { type: "keyPressed"; key: KeyName }
  | { type: "touchingEdge" }
  | { type: "not"; condition: ScriptCondition }
  | { type: "and"; left: ScriptCondition; right: ScriptCondition }
  | { type: "or"; left: ScriptCondition; right: ScriptCondition }
  | { type: "compare"; left: number; operator: "=" | "<" | ">"; right: number };

export type ScriptNode =
  | { type: "move"; steps: number }
  | { type: "turn"; degrees: number }
  | { type: "setPosition"; x: number; y: number }
  | { type: "goHome" }
  | { type: "changeX"; dx: number }
  | { type: "changeY"; dy: number }
  | { type: "setX"; x: number }
  | { type: "setY"; y: number }
  | { type: "setDirection"; direction: number }
  | { type: "pointInDirection"; direction: number }
  | { type: "ifOnEdgeBounce" }
  | { type: "say"; text: string }
  | { type: "sayForSeconds"; text: string; seconds: number }
  | { type: "think"; text: string }
  | { type: "thinkForSeconds"; text: string; seconds: number }
  | { type: "clearSpeech" }
  | { type: "changeSize"; amount: number }
  | { type: "setSize"; size: number }
  | { type: "show" }
  | { type: "hide" }
  | { type: "wait"; seconds: number }
  | { type: "repeat"; times: number; body: ScriptNode[] }
  | { type: "forever"; body: ScriptNode[] }
  | { type: "if"; condition: ScriptCondition; body: ScriptNode[] }
  | { type: "ifElse"; condition: ScriptCondition; thenBody: ScriptNode[]; elseBody: ScriptNode[] }
  | { type: "aiIntent"; prompt: string };
