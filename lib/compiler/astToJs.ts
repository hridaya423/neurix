import type { ScriptCondition, ScriptNode } from "@/lib/compiler/types";

function jsString(value: string) {
  return JSON.stringify(value);
}

function line(depth: number, content: string) {
  return `${"  ".repeat(depth)}${content}`;
}

function conditionToJs(condition: ScriptCondition): string {
  switch (condition.type) {
    case "keyPressed":
      return `api.keyDown(${jsString(condition.key)})`;
    case "touchingEdge":
      return "sprite.touchingEdge()";
    case "not":
      return `!(${conditionToJs(condition.condition)})`;
    case "and":
      return `(${conditionToJs(condition.left)} && ${conditionToJs(condition.right)})`;
    case "or":
      return `(${conditionToJs(condition.left)} || ${conditionToJs(condition.right)})`;
    case "compare":
      return `${condition.left} ${condition.operator === "=" ? "===" : condition.operator} ${condition.right}`;
  }
}

function nodesToJs(nodes: ScriptNode[], depth: number): string[] {
  return nodes.flatMap((node): string[] => {
    switch (node.type) {
      case "move":
        return [line(depth, `sprite.move(${node.steps});`)];
      case "turn":
        return [line(depth, `sprite.turn(${node.degrees});`)];
      case "setPosition":
        return [line(depth, `sprite.setPosition(${node.x}, ${node.y});`)];
      case "goHome":
        return [line(depth, "sprite.setPosition(0, 0);")];
      case "changeX":
        return [line(depth, `sprite.changeX(${node.dx});`)];
      case "changeY":
        return [line(depth, `sprite.changeY(${node.dy});`)];
      case "setX":
        return [line(depth, `sprite.setX(${node.x});`)];
      case "setY":
        return [line(depth, `sprite.setY(${node.y});`)];
      case "setDirection":
      case "pointInDirection":
        return [line(depth, `sprite.setDirection(${node.direction});`)];
      case "ifOnEdgeBounce":
        return [line(depth, "sprite.ifOnEdgeBounce();")];
      case "say":
        return [line(depth, `await api.say(${jsString(node.text)});`)];
      case "sayForSeconds":
        return [
          line(depth, `api.say(${jsString(node.text)});`),
          line(depth, `await api.wait(${Math.max(0, node.seconds) * 1000});`),
          line(depth, "api.say(undefined);"),
        ];
      case "think":
        return [line(depth, `await api.say(${jsString(node.text)});`)];
      case "thinkForSeconds":
        return [
          line(depth, `api.say(${jsString(node.text)});`),
          line(depth, `await api.wait(${Math.max(0, node.seconds) * 1000});`),
          line(depth, "api.say(undefined);"),
        ];
      case "clearSpeech":
        return [line(depth, "api.say(undefined);")];
      case "changeSize":
        return [line(depth, `sprite.changeSize(${node.amount});`)];
      case "setSize":
        return [line(depth, `sprite.setSize(${node.size});`)];
      case "show":
        return [line(depth, "sprite.show();")];
      case "hide":
        return [line(depth, "sprite.hide();")];
      case "wait":
        return [line(depth, `await api.wait(${Math.max(0, node.seconds) * 1000});`)];
      case "repeat":
        return [
          line(depth, `for (let i = 0; i < ${Math.max(1, Math.floor(node.times))}; i += 1) {`),
          ...nodesToJs(node.body, depth + 1),
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
      case "aiIntent":
        return [line(depth, `// unresolved AI intent: ${node.prompt}`)];
    }
  });
}

export function astToJs(nodes: ScriptNode[]) {
  return [
    "export async function run({ sprite, api }) {",
    ...nodesToJs(nodes, 1),
    "}",
  ].join("\n");
}
