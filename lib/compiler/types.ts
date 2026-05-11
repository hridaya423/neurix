export type KeyName = string;

export type ScriptValue =
  | number
  | string
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "variable"; name: string }
  | { type: "spriteProperty"; property: "x" | "y" | "direction" | "size" }
  | { type: "stageProperty"; property: "backdropName" | "backdropNumber" }
  | { type: "costumeProperty"; property: "costumeName" | "costumeNumber" }
  | { type: "sensing"; property: "mouseX" | "mouseY" | "timer" | "currentSecond" | "currentMinute" | "currentHour" | "distanceToCenter" | "lastKey" }
  | { type: "random"; from: ScriptValue; to: ScriptValue }
  | { type: "arithmetic"; operator: "+" | "-" | "*" | "/" | "%" | "^"; left: ScriptValue; right: ScriptValue }
  | { type: "round"; value: ScriptValue }
  | { type: "math"; operator: "abs" | "floor" | "ceiling" | "sqrt" | "sin" | "cos" | "tan"; value: ScriptValue }
  | { type: "join"; values: ScriptValue[] }
  | { type: "letterOf"; index: ScriptValue; text: ScriptValue }
  | { type: "lengthOf"; text: ScriptValue }
  | { type: "listItem"; list: string; index: ScriptValue }
  | { type: "listIndex"; list: string; item: ScriptValue }
  | { type: "listLength"; list: string }
  | { type: "soundVolume" };

export type ScriptCondition =
  | { type: "keyPressed"; key: KeyName }
  | { type: "touchingEdge" }
  | { type: "mouseDown" }
  | { type: "anyKeyPressed" }
  | { type: "boolean"; value: boolean }
  | { type: "not"; condition: ScriptCondition }
  | { type: "and"; left: ScriptCondition; right: ScriptCondition }
  | { type: "or"; left: ScriptCondition; right: ScriptCondition }
  | { type: "compare"; left: ScriptValue; operator: "=" | "<" | ">" | "≤" | "≥" | "≠"; right: ScriptValue }
  | { type: "contains"; text: ScriptValue; search: ScriptValue }
  | { type: "listContains"; list: string; item: ScriptValue };

export type ScriptNode =
  | { type: "move"; steps: ScriptValue }
  | { type: "turn"; degrees: ScriptValue }
  | { type: "setPosition"; x: ScriptValue; y: ScriptValue }
  | { type: "goHome" }
  | { type: "changeX"; dx: ScriptValue }
  | { type: "changeY"; dy: ScriptValue }
  | { type: "setX"; x: ScriptValue }
  | { type: "setY"; y: ScriptValue }
  | { type: "setDirection"; direction: ScriptValue }
  | { type: "pointInDirection"; direction: ScriptValue }
  | { type: "pointTowardMouse" }
  | { type: "pointTowardCenter" }
  | { type: "ifOnEdgeBounce" }
  | { type: "goToMouse" }
  | { type: "goToRandom" }
  | { type: "glideToPosition"; seconds: ScriptValue; x: ScriptValue; y: ScriptValue }
  | { type: "glideToMouse"; seconds: ScriptValue }
  | { type: "say"; text: ScriptValue }
  | { type: "sayForSeconds"; text: ScriptValue; seconds: ScriptValue }
  | { type: "think"; text: ScriptValue }
  | { type: "thinkForSeconds"; text: ScriptValue; seconds: ScriptValue }
  | { type: "clearSpeech" }
  | { type: "changeSize"; amount: ScriptValue }
  | { type: "setSize"; size: ScriptValue }
  | { type: "show" }
  | { type: "hide" }
  | { type: "goToLayer"; layer: "front" | "back" }
  | { type: "changeLayer"; direction: "forward" | "backward"; amount: ScriptValue }
  | { type: "switchBackdrop"; backdropId: string }
  | { type: "nextBackdrop" }
  | { type: "broadcast"; message: string }
  | { type: "broadcastAndWait"; message: string }
  | { type: "switchCostume"; costumeId: string }
  | { type: "nextCostume" }
  | { type: "playSound"; soundId: string; wait: boolean }
  | { type: "stopAllSounds" }
  | { type: "changeSoundEffect"; effect: "pitch" | "pan"; amount: ScriptValue }
  | { type: "setSoundEffect"; effect: "pitch" | "pan"; value: ScriptValue }
  | { type: "clearSoundEffects" }
  | { type: "changeVolume"; amount: ScriptValue }
  | { type: "setVolume"; volume: ScriptValue }
  | { type: "setTone"; tone: string }
  | { type: "changeTone"; amount: ScriptValue }
  | { type: "setVariable"; name: string; value: ScriptValue }
  | { type: "changeVariable"; name: string; amount: ScriptValue }
  | { type: "listAdd"; list: string; item: ScriptValue }
  | { type: "listDelete"; list: string; index: ScriptValue | "all" }
  | { type: "listInsert"; list: string; index: ScriptValue; item: ScriptValue }
  | { type: "listReplace"; list: string; index: ScriptValue; item: ScriptValue }
  | { type: "showList"; list: string }
  | { type: "hideList"; list: string }
  | { type: "createClone" }
  | { type: "deleteClone" }
  | { type: "wait"; seconds: ScriptValue }
  | { type: "repeat"; times: ScriptValue; body: ScriptNode[] }
  | { type: "repeatUntil"; condition: ScriptCondition; body: ScriptNode[] }
  | { type: "waitUntil"; condition: ScriptCondition }
  | { type: "forever"; body: ScriptNode[] }
  | { type: "if"; condition: ScriptCondition; body: ScriptNode[] }
  | { type: "ifElse"; condition: ScriptCondition; thenBody: ScriptNode[]; elseBody: ScriptNode[] }
  | { type: "customCall"; name: string }
  | { type: "aiIntent"; prompt: string };

export type ScriptStack = ScriptNode[];

export type ScriptProgram = ScriptStack[];

export type ScriptEventPrograms = Record<string, ScriptProgram>;
