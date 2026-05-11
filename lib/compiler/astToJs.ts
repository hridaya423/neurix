import type { ScriptCondition, ScriptNode, ScriptValue } from "@/lib/compiler/types";

function jsString(value: string) {
  return JSON.stringify(value);
}

function line(depth: number, content: string) {
  return `${"  ".repeat(depth)}${content}`;
}

function valueToJs(value: ScriptValue): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return jsString(value);

  switch (value.type) {
    case "number":
      return String(value.value);
    case "string":
      return jsString(value.value);
    case "variable":
      return `(vars[${jsString(value.name)}] ?? 0)`;
    case "spriteProperty":
      return `sprite.${value.property}`;
    case "stageProperty":
      return value.property === "backdropName" ? "api.backdropName()" : "api.backdropNumber()";
    case "costumeProperty":
      return value.property === "costumeName" ? "sprite.costumeName()" : "sprite.costumeNumber()";
    case "sensing":
      if (value.property === "mouseX") return "api.mouseX()";
      if (value.property === "mouseY") return "api.mouseY()";
      if (value.property === "timer") return "api.timer()";
      if (value.property === "currentSecond") return "new Date().getSeconds()";
      if (value.property === "currentMinute") return "new Date().getMinutes()";
      if (value.property === "currentHour") return "new Date().getHours()";
      if (value.property === "lastKey") return "api.lastKey()";
      return "Math.round(Math.hypot(sprite.x, sprite.y))";
    case "random":
      return `Math.floor(Math.random() * (${valueToJs(value.to)} - ${valueToJs(value.from)} + 1)) + ${valueToJs(value.from)}`;
    case "arithmetic":
      if (value.operator === "^") return `(${valueToJs(value.left)} ** ${valueToJs(value.right)})`;
      return `(${valueToJs(value.left)} ${value.operator} ${valueToJs(value.right)})`;
    case "round":
      return `Math.round(${valueToJs(value.value)})`;
    case "math":
      if (value.operator === "ceiling") return `Math.ceil(${valueToJs(value.value)})`;
      if (value.operator === "sqrt") return `Math.sqrt(Math.max(0, ${valueToJs(value.value)}))`;
      if (value.operator === "floor") return `Math.floor(${valueToJs(value.value)})`;
      if (value.operator === "abs") return `Math.abs(${valueToJs(value.value)})`;
      if (value.operator === "sin") return `Math.sin((${valueToJs(value.value)} * Math.PI) / 180)`;
      if (value.operator === "cos") return `Math.cos((${valueToJs(value.value)} * Math.PI) / 180)`;
      return `Math.tan((${valueToJs(value.value)} * Math.PI) / 180)`;
    case "join":
      return value.values.map(valueToJs).join(" + ");
    case "letterOf":
      return `String(${valueToJs(value.text)})[Math.max(1, Math.floor(Number(${valueToJs(value.index)}))) - 1] ?? ""`;
    case "lengthOf":
      return `String(${valueToJs(value.text)}).length`;
    case "listItem":
      return `(api.getList(${jsString(value.list)})[Math.max(0, Math.min(Math.floor(Number(${valueToJs(value.index)}) || 1) - 1, api.getList(${jsString(value.list)}).length - 1))] ?? "")`;
    case "listIndex":
      return `(api.getList(${jsString(value.list)}).findIndex((item) => String(item) === String(${valueToJs(value.item)})) + 1)`;
    case "listLength":
      return `api.getList(${jsString(value.list)}).length`;
    case "soundVolume":
      return "api.getVolume?.() ?? 100";
  }
}

function conditionToJs(condition: ScriptCondition): string {
  switch (condition.type) {
    case "keyPressed":
      return `api.keyDown(${jsString(condition.key)})`;
    case "touchingEdge":
      return "sprite.touchingEdge()";
    case "mouseDown":
      return "api.mouseDown()";
    case "anyKeyPressed":
      return "api.anyKeyDown()";
    case "boolean":
      return String(condition.value);
    case "not":
      return `!(${conditionToJs(condition.condition)})`;
    case "and":
      return `(${conditionToJs(condition.left)} && ${conditionToJs(condition.right)})`;
    case "or":
      return `(${conditionToJs(condition.left)} || ${conditionToJs(condition.right)})`;
    case "compare":
      if (condition.operator === "=") return `${valueToJs(condition.left)} === ${valueToJs(condition.right)}`;
      if (condition.operator === "≠") return `${valueToJs(condition.left)} !== ${valueToJs(condition.right)}`;
      if (condition.operator === "≤") return `${valueToJs(condition.left)} <= ${valueToJs(condition.right)}`;
      if (condition.operator === "≥") return `${valueToJs(condition.left)} >= ${valueToJs(condition.right)}`;
      return `${valueToJs(condition.left)} ${condition.operator} ${valueToJs(condition.right)}`;
    case "contains":
      return `String(${valueToJs(condition.text)}).includes(String(${valueToJs(condition.search)}))`;
    case "listContains":
      return `api.getList(${jsString(condition.list)}).some((item) => String(item) === String(${valueToJs(condition.item)}))`;
  }
}

function nodesToJs(nodes: ScriptNode[], depth: number): string[] {
  return nodes.flatMap((node): string[] => {
    switch (node.type) {
      case "move":
        return [line(depth, `sprite.move(Number(${valueToJs(node.steps)}) || 0);`)];
      case "turn":
        return [line(depth, `sprite.turn(Number(${valueToJs(node.degrees)}) || 0);`)];
      case "setPosition":
        return [line(depth, `sprite.setPosition(Number(${valueToJs(node.x)}) || 0, Number(${valueToJs(node.y)}) || 0);`)];
      case "goHome":
        return [line(depth, "sprite.setPosition(0, 0);")];
      case "changeX":
        return [line(depth, `sprite.changeX(Number(${valueToJs(node.dx)}) || 0);`)];
      case "changeY":
        return [line(depth, `sprite.changeY(Number(${valueToJs(node.dy)}) || 0);`)];
      case "setX":
        return [line(depth, `sprite.setX(Number(${valueToJs(node.x)}) || 0);`)];
      case "setY":
        return [line(depth, `sprite.setY(Number(${valueToJs(node.y)}) || 0);`)];
      case "setDirection":
      case "pointInDirection":
        return [line(depth, `sprite.setDirection(Number(${valueToJs(node.direction)}) || 0);`)];
      case "ifOnEdgeBounce":
        return [line(depth, "sprite.ifOnEdgeBounce();")];
      case "goToMouse":
        return [line(depth, "sprite.setPosition(api.mouseX(), api.mouseY());")];
      case "goToRandom":
        return [line(depth, "sprite.setPosition(Math.round(Math.random() * 480 - 240), Math.round(Math.random() * 360 - 180));")];
      case "pointTowardMouse":
        return [line(depth, "sprite.setDirection((Math.atan2(api.mouseX() - sprite.x, api.mouseY() - sprite.y) * 180) / Math.PI);")];
      case "pointTowardCenter":
        return [line(depth, "sprite.setDirection((Math.atan2(-sprite.x, -sprite.y) * 180) / Math.PI);")];
      case "glideToPosition":
        return [
          line(depth, `{`),
          line(depth + 1, `const startX = sprite.x;`),
          line(depth + 1, `const startY = sprite.y;`),
          line(depth + 1, `const targetX = Number(${valueToJs(node.x)}) || 0;`),
          line(depth + 1, `const targetY = Number(${valueToJs(node.y)}) || 0;`),
          line(depth + 1, `const steps = Math.max(1, Math.ceil((Math.max(0, Number(${valueToJs(node.seconds)}) || 0) * 1000) / 16));`),
          line(depth + 1, `for (let i = 1; i <= steps; i += 1) {`),
          line(depth + 2, `const t = i / steps;`),
          line(depth + 2, `sprite.setPosition(startX + (targetX - startX) * t, startY + (targetY - startY) * t);`),
          line(depth + 2, `await api.nextFrame();`),
          line(depth + 1, `}`),
          line(depth, `}`),
        ];
      case "glideToMouse":
        return [
          line(depth, `{`),
          line(depth + 1, `const startX = sprite.x;`),
          line(depth + 1, `const startY = sprite.y;`),
          line(depth + 1, `const targetX = api.mouseX();`),
          line(depth + 1, `const targetY = api.mouseY();`),
          line(depth + 1, `const steps = Math.max(1, Math.ceil((Math.max(0, Number(${valueToJs(node.seconds)}) || 0) * 1000) / 16));`),
          line(depth + 1, `for (let i = 1; i <= steps; i += 1) {`),
          line(depth + 2, `const t = i / steps;`),
          line(depth + 2, `sprite.setPosition(startX + (targetX - startX) * t, startY + (targetY - startY) * t);`),
          line(depth + 2, `await api.nextFrame();`),
          line(depth + 1, `}`),
          line(depth, `}`),
        ];
      case "say":
        return [line(depth, `await api.say(String(${valueToJs(node.text)}));`)];
      case "sayForSeconds":
        return [
          line(depth, `api.say(String(${valueToJs(node.text)}));`),
          line(depth, `await api.wait(Math.max(0, Number(${valueToJs(node.seconds)}) || 0) * 1000);`),
          line(depth, "api.say(undefined);"),
        ];
      case "think":
        return [line(depth, `await api.say(String(${valueToJs(node.text)}));`)];
      case "thinkForSeconds":
        return [
          line(depth, `api.say(String(${valueToJs(node.text)}));`),
          line(depth, `await api.wait(Math.max(0, Number(${valueToJs(node.seconds)}) || 0) * 1000);`),
          line(depth, "api.say(undefined);"),
        ];
      case "clearSpeech":
        return [line(depth, "api.say(undefined);")];
      case "changeSize":
        return [line(depth, `sprite.changeSize(Number(${valueToJs(node.amount)}) || 0);`)];
      case "setSize":
        return [line(depth, `sprite.setSize(Number(${valueToJs(node.size)}) || 0);`)];
      case "setTone":
        return [line(depth, `sprite.setTone(${jsString(node.tone)});`)];
      case "changeTone":
        return [line(depth, `sprite.changeTone(Number(${valueToJs(node.amount)}) || 0);`)];
      case "changeGraphicEffect":
        return [line(depth, `api.changeGraphicEffect?.(${jsString(node.effect)}, Number(${valueToJs(node.amount)}) || 0);`)];
      case "setGraphicEffect":
        return [line(depth, `api.setGraphicEffect?.(${jsString(node.effect)}, Number(${valueToJs(node.value)}) || 0);`)];
      case "clearGraphicEffects":
        return [line(depth, `api.clearGraphicEffects?.();`)];
      case "showVariable":
        return [line(depth, `api.setVariableVisible?.(${jsString(node.name)}, true);`)];
      case "hideVariable":
        return [line(depth, `api.setVariableVisible?.(${jsString(node.name)}, false);`)];
      case "resetTimer":
        return [line(depth, `api.resetTimer?.();`)];
      case "stop":
        if (node.mode === "all") return [line(depth, "return;")];
        return [line(depth, "return;")];
      case "show":
        return [line(depth, "sprite.show();")];
      case "hide":
        return [line(depth, "sprite.hide();")];
      case "goToLayer":
        return [line(depth, `api.goToLayer(${jsString(node.layer)});`)];
      case "changeLayer":
        return [line(depth, `api.changeLayer(${jsString(node.direction)}, Math.max(0, Math.floor(Number(${valueToJs(node.amount)}) || 0)));`)];
      case "switchBackdrop":
        return [line(depth, `api.switchBackdrop(${jsString(node.backdropId)});`)];
      case "switchBackdropAndWait":
        return [line(depth, `await api.switchBackdropAndWait(${jsString(node.backdropId)});`)];
      case "nextBackdrop":
        return [line(depth, "api.nextBackdrop();")];
      case "broadcast":
        return [line(depth, `api.broadcast(${jsString(node.message)});`)];
      case "broadcastAndWait":
        return [line(depth, `await api.broadcastAndWait(${jsString(node.message)});`)];
      case "switchCostume":
        return [line(depth, `sprite.switchCostume(${jsString(node.costumeId)});`)];
      case "nextCostume":
        return [line(depth, "sprite.nextCostume();")];
      case "playSound":
        return [line(depth, `${node.wait ? "await " : ""}api.playSound?.(${jsString(node.soundId)}, ${String(node.wait)});`)];
      case "stopAllSounds":
        return [line(depth, "api.stopAllSounds?.();")];
      case "changeSoundEffect":
        return [line(depth, `api.changeSoundEffect?.(${jsString(node.effect)}, Number(${valueToJs(node.amount)}) || 0);`)];
      case "setSoundEffect":
        return [line(depth, `api.setSoundEffect?.(${jsString(node.effect)}, Number(${valueToJs(node.value)}) || 0);`)];
      case "clearSoundEffects":
        return [line(depth, "api.clearSoundEffects?.();")];
      case "changeVolume":
        return [line(depth, `api.changeVolume?.(Number(${valueToJs(node.amount)}) || 0);`)];
      case "setVolume":
        return [line(depth, `api.setVolume?.(Number(${valueToJs(node.volume)}) || 0);`)];
      case "setVariable":
        return [line(depth, `vars[${jsString(node.name)}] = ${valueToJs(node.value)};`)];
      case "changeVariable":
        return [line(depth, `vars[${jsString(node.name)}] = Number(vars[${jsString(node.name)}] ?? 0) + (Number(${valueToJs(node.amount)}) || 0);`)];
      case "listAdd":
        return [line(depth, `api.setList(${jsString(node.list)}, [...api.getList(${jsString(node.list)}), ${valueToJs(node.item)}]);`)];
      case "listDelete":
        return node.index === "all"
          ? [line(depth, `api.setList(${jsString(node.list)}, []);`)]
          : [line(depth, `{ const list = api.getList(${jsString(node.list)}); const index = Math.max(0, Math.min(Math.floor(Number(${valueToJs(node.index)}) || 1) - 1, list.length - 1)); api.setList(${jsString(node.list)}, list.filter((_, i) => i !== index)); }`)];
      case "listInsert":
        return [line(depth, `{ const list = api.getList(${jsString(node.list)}); const index = Math.max(0, Math.min(list.length, Math.floor(Number(${valueToJs(node.index)}) || 1) - 1)); api.setList(${jsString(node.list)}, [...list.slice(0, index), ${valueToJs(node.item)}, ...list.slice(index)]); }`)];
      case "listReplace":
        return [line(depth, `{ const list = api.getList(${jsString(node.list)}); const index = Math.max(0, Math.min(Math.floor(Number(${valueToJs(node.index)}) || 1) - 1, list.length - 1)); api.setList(${jsString(node.list)}, list.map((item, i) => i === index ? ${valueToJs(node.item)} : item)); }`)];
      case "showList":
        return [line(depth, `api.setListVisible?.(${jsString(node.list)}, true);`)];
      case "hideList":
        return [line(depth, `api.setListVisible?.(${jsString(node.list)}, false);`)];
      case "createClone":
        return [line(depth, "api.createClone();")];
      case "deleteClone":
        return [line(depth, "api.deleteClone();")];
      case "wait":
        return [line(depth, `await api.wait(Math.max(0, Number(${valueToJs(node.seconds)}) || 0) * 1000);`)];
      case "repeat":
        return [
          line(depth, `for (let i = 0; i < Math.max(0, Math.floor(Number(${valueToJs(node.times)}) || 0)); i += 1) {`),
          ...nodesToJs(node.body, depth + 1),
          line(depth, "}"),
        ];
      case "repeatUntil":
        return [
          line(depth, `while (api.running() && !(${conditionToJs(node.condition)})) {`),
          ...nodesToJs(node.body, depth + 1),
          line(depth + 1, "await api.nextFrame();"),
          line(depth, "}"),
        ];
      case "waitUntil":
        return [
          line(depth, `while (api.running() && !(${conditionToJs(node.condition)})) {`),
          line(depth + 1, "await api.nextFrame();"),
          line(depth, "}"),
        ];
      case "forever":
        return [
          line(depth, "while (api.running()) {"),
          ...nodesToJs(node.body, depth + 1),
          line(depth + 1, "await api.nextFrame();"),
          line(depth, "}"),
        ];
      case "if":
        return [
          line(depth, `if (${conditionToJs(node.condition)}) {`),
          ...nodesToJs(node.body, depth + 1),
          line(depth, "}"),
        ];
      case "ifElse":
        return [
          line(depth, `if (${conditionToJs(node.condition)}) {`),
          ...nodesToJs(node.thenBody, depth + 1),
          line(depth, "} else {"),
          ...nodesToJs(node.elseBody, depth + 1),
          line(depth, "}"),
        ];
      case "customCall":
        return [line(depth, `api.say(${jsString(`Custom block needs a definition: ${node.name}`)});`)];
      case "aiIntent":
        return [line(depth, `api.say(${jsString(`Custom block needs a definition: ${node.prompt}`)});`)];
      default:
        return [];
    }
  });
}

export function astToJs(nodes: ScriptNode[]) {
  return [
    "export async function run({ sprite, api }) {",
    line(1, "const vars = {};"),
    ...nodesToJs(nodes, 1),
    "}",
  ].join("\n");
}
