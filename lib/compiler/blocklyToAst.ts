import * as Blockly from "blockly/core";
import type { KeyName, ScriptCondition, ScriptNode, ScriptProgram, ScriptValue } from "@/lib/compiler/types";

type CustomDefinitions = Map<string, Blockly.Block | null>;

const maxDefinitionDepth = 8;

function normalizeCustomName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function getCustomBlockName(block: Blockly.Block) {
  return block.getField("NAME")?.getText() ?? String(block.getFieldValue("PROMPT") ?? "");
}

function isCustomDefinitionBlock(block: Blockly.Block) {
  return block.type === "custom_define" || block.type === "ai_define";
}

function getNumberField(block: Blockly.Block, fieldName: string) {
  return Number(block.getFieldValue(fieldName)) || 0;
}

function getVariableName(block: Blockly.Block, fieldName = "VAR") {
  const field = block.getField(fieldName);
  return field?.getText() || String(block.getFieldValue(fieldName) ?? "variable");
}

function parseValue(block: Blockly.Block | null, fallback: ScriptValue = 0): ScriptValue {
  if (!block) return fallback;

  switch (block.type) {
    case "math_number":
      return Number(block.getFieldValue("NUM")) || 0;
    case "text":
      return String(block.getFieldValue("TEXT") ?? "");
    case "variables_get":
      return { type: "variable", name: getVariableName(block) };
    case "motion_x_position":
      return { type: "spriteProperty", property: "x" };
    case "motion_y_position":
      return { type: "spriteProperty", property: "y" };
    case "motion_direction_reporter":
      return { type: "spriteProperty", property: "direction" };
    case "looks_size_reporter":
      return { type: "spriteProperty", property: "size" };
    case "looks_backdrop_name":
      return { type: "stageProperty", property: "backdropName" };
    case "looks_backdrop_number":
      return { type: "stageProperty", property: "backdropNumber" };
    case "sensing_mouse_x":
      return { type: "sensing", property: "mouseX" };
    case "sensing_mouse_y":
      return { type: "sensing", property: "mouseY" };
    case "sensing_timer":
      return { type: "sensing", property: "timer" };
    case "sensing_distance_to_center":
      return { type: "sensing", property: "distanceToCenter" };
    case "sensing_current_time": {
      const unit = String(block.getFieldValue("UNIT"));
      return { type: "sensing", property: unit === "MINUTE" ? "currentMinute" : unit === "HOUR" ? "currentHour" : "currentSecond" };
    }
    case "sensing_last_key":
      return { type: "sensing", property: "lastKey" };
    case "math_random_int":
      return {
        type: "random",
        from: parseValue(block.getInputTargetBlock("FROM"), 1),
        to: parseValue(block.getInputTargetBlock("TO"), 10),
      };
    case "math_arithmetic": {
      const op = String(block.getFieldValue("OP"));
      const operator = op === "MINUS" ? "-" : op === "MULTIPLY" ? "*" : op === "DIVIDE" ? "/" : op === "POWER" ? "^" : "+";
      return {
        type: "arithmetic",
        operator,
        left: parseValue(block.getInputTargetBlock("A"), 0),
        right: parseValue(block.getInputTargetBlock("B"), 0),
      };
    }
    case "math_modulo":
      return {
        type: "arithmetic",
        operator: "%",
        left: parseValue(block.getInputTargetBlock("DIVIDEND"), 0),
        right: parseValue(block.getInputTargetBlock("DIVISOR"), 1),
      };
    case "math_round":
      return { type: "round", value: parseValue(block.getInputTargetBlock("NUM"), 0) };
    case "math_single": {
      const op = String(block.getFieldValue("OP"));
      const operator = op === "ABS" ? "abs" : op === "NEG" ? "abs" : op === "LN" ? "sqrt" : "sqrt";
      return { type: "math", operator, value: parseValue(block.getInputTargetBlock("NUM"), 0) };
    }
    case "math_trig": {
      const op = String(block.getFieldValue("OP"));
      const operator = op === "COS" ? "cos" : op === "TAN" ? "tan" : "sin";
      return { type: "math", operator, value: parseValue(block.getInputTargetBlock("NUM"), 0) };
    }
    case "operator_join":
      return {
        type: "join",
        values: [parseValue(block.getInputTargetBlock("A"), ""), parseValue(block.getInputTargetBlock("B"), "")],
      };
    case "text_join":
      return {
        type: "join",
        values: [parseValue(block.getInputTargetBlock("ADD0"), ""), parseValue(block.getInputTargetBlock("ADD1"), "")],
      };
    case "text_length":
      return { type: "lengthOf", text: parseValue(block.getInputTargetBlock("VALUE"), "") };
    case "text_charAt":
      return {
        type: "letterOf",
        text: parseValue(block.getInputTargetBlock("VALUE"), ""),
        index: parseValue(block.getInputTargetBlock("AT"), 1),
      };
    default:
      return fallback;
  }
}

function getValueInput(block: Blockly.Block, inputName: string, fallback: ScriptValue = 0) {
  return parseValue(block.getInputTargetBlock(inputName), fallback);
}

function defaultCondition(): ScriptCondition {
  return { type: "compare", left: 1, operator: "=", right: 1 };
}

function parseCondition(block: Blockly.Block | null): ScriptCondition {
  if (!block) return defaultCondition();

  switch (block.type) {
    case "sensing_key_pressed":
      return { type: "keyPressed", key: String(block.getFieldValue("KEY")) as KeyName };
    case "sensing_touching_edge":
      return { type: "touchingEdge" };
    case "sensing_mouse_down":
      return { type: "mouseDown" };
    case "sensing_any_key_pressed":
      return { type: "anyKeyPressed" };
    case "logic_boolean":
      return { type: "boolean", value: block.getFieldValue("BOOL") === "TRUE" };
    case "logic_compare": {
      const op = String(block.getFieldValue("OP"));
      const operator = op === "NEQ" ? "≠" : op === "LT" ? "<" : op === "LTE" ? "≤" : op === "GT" ? ">" : op === "GTE" ? "≥" : "=";
      return {
        type: "compare",
        left: parseValue(block.getInputTargetBlock("A"), 0),
        operator,
        right: parseValue(block.getInputTargetBlock("B"), 0),
      };
    }
    case "logic_operation":
      return String(block.getFieldValue("OP")) === "OR"
        ? { type: "or", left: parseCondition(block.getInputTargetBlock("A")), right: parseCondition(block.getInputTargetBlock("B")) }
        : { type: "and", left: parseCondition(block.getInputTargetBlock("A")), right: parseCondition(block.getInputTargetBlock("B")) };
    case "logic_negate":
      return { type: "not", condition: parseCondition(block.getInputTargetBlock("BOOL")) };
    case "operator_contains":
      return {
        type: "contains",
        text: parseValue(block.getInputTargetBlock("TEXT"), ""),
        search: parseValue(block.getInputTargetBlock("SEARCH"), ""),
      };
    case "operator_compare_numbers":
      return {
        type: "compare",
        left: getNumberField(block, "LEFT"),
        operator: String(block.getFieldValue("OPERATOR")) as "=" | "<" | ">",
        right: getNumberField(block, "RIGHT"),
      };
    case "operator_compare_values":
      return {
        type: "compare",
        left: parseValue(block.getInputTargetBlock("LEFT"), 0),
        operator: String(block.getFieldValue("OPERATOR")) as "=" | "<" | ">" | "≤" | "≥" | "≠",
        right: parseValue(block.getInputTargetBlock("RIGHT"), 0),
      };
    case "operator_and":
      return {
        type: "and",
        left: parseCondition(block.getInputTargetBlock("LEFT")),
        right: parseCondition(block.getInputTargetBlock("RIGHT")),
      };
    case "operator_or":
      return {
        type: "or",
        left: parseCondition(block.getInputTargetBlock("LEFT")),
        right: parseCondition(block.getInputTargetBlock("RIGHT")),
      };
    case "operator_not":
      return { type: "not", condition: parseCondition(block.getInputTargetBlock("COND")) };
    default:
      return defaultCondition();
  }
}

function parseStack(startBlock: Blockly.Block | null, definitions: CustomDefinitions, depth = 0): ScriptNode[] {
  const program: ScriptNode[] = [];
  let block = startBlock;

  while (block) {
    switch (block.type) {
      case "motion_move_steps":
        program.push({ type: "move", steps: getNumberField(block, "STEPS") });
        break;
      case "motion_move_value":
        program.push({ type: "move", steps: getValueInput(block, "STEPS", 10) });
        break;
      case "motion_turn_degrees":
        program.push({ type: "turn", degrees: getNumberField(block, "DEGREES") });
        break;
      case "motion_turn_value":
        program.push({ type: "turn", degrees: getValueInput(block, "DEGREES", 15) });
        break;
      case "motion_set_xy":
        program.push({
          type: "setPosition",
          x: getNumberField(block, "X"),
          y: getNumberField(block, "Y"),
        });
        break;
      case "motion_set_xy_value":
        program.push({ type: "setPosition", x: getValueInput(block, "X", 0), y: getValueInput(block, "Y", 0) });
        break;
      case "motion_go_home":
        program.push({ type: "goHome" });
        break;
      case "motion_change_x":
        program.push({ type: "changeX", dx: getNumberField(block, "DX") });
        break;
      case "motion_change_x_value":
        program.push({ type: "changeX", dx: getValueInput(block, "DX", 10) });
        break;
      case "motion_set_x":
        program.push({ type: "setX", x: getNumberField(block, "X") });
        break;
      case "motion_set_x_value":
        program.push({ type: "setX", x: getValueInput(block, "X", 0) });
        break;
      case "motion_change_y":
        program.push({ type: "changeY", dy: getNumberField(block, "DY") });
        break;
      case "motion_change_y_value":
        program.push({ type: "changeY", dy: getValueInput(block, "DY", 10) });
        break;
      case "motion_set_y":
        program.push({ type: "setY", y: getNumberField(block, "Y") });
        break;
      case "motion_set_y_value":
        program.push({ type: "setY", y: getValueInput(block, "Y", 0) });
        break;
      case "motion_point_direction":
        program.push({ type: "pointInDirection", direction: getNumberField(block, "DIRECTION") });
        break;
      case "motion_point_direction_value":
        program.push({ type: "pointInDirection", direction: getValueInput(block, "DIRECTION", 90) });
        break;
      case "motion_if_on_edge_bounce":
        program.push({ type: "ifOnEdgeBounce" });
        break;
      case "motion_go_to_mouse":
        program.push({ type: "goToMouse" });
        break;
      case "motion_go_to_random":
        program.push({ type: "goToRandom" });
        break;
      case "motion_point_toward_mouse":
        program.push({ type: "pointTowardMouse" });
        break;
      case "motion_point_toward_center":
        program.push({ type: "pointTowardCenter" });
        break;
      case "motion_glide_xy":
        program.push({ type: "glideToPosition", seconds: getValueInput(block, "SECONDS", 1), x: getValueInput(block, "X", 0), y: getValueInput(block, "Y", 0) });
        break;
      case "motion_glide_mouse":
        program.push({ type: "glideToMouse", seconds: getValueInput(block, "SECONDS", 1) });
        break;
      case "looks_say":
        program.push({ type: "say", text: String(block.getFieldValue("TEXT") ?? "") });
        break;
      case "looks_say_value":
        program.push({ type: "say", text: getValueInput(block, "TEXT", "Hello") });
        break;
      case "looks_say_for_seconds":
        program.push({
          type: "sayForSeconds",
          text: String(block.getFieldValue("TEXT") ?? ""),
          seconds: getNumberField(block, "SECONDS"),
        });
        break;
      case "looks_say_value_for_seconds":
        program.push({ type: "sayForSeconds", text: getValueInput(block, "TEXT", "Hello"), seconds: getValueInput(block, "SECONDS", 2) });
        break;
      case "looks_think":
        program.push({ type: "think", text: String(block.getFieldValue("TEXT") ?? "") });
        break;
      case "looks_think_value":
        program.push({ type: "think", text: getValueInput(block, "TEXT", "Hmm") });
        break;
      case "looks_think_for_seconds":
        program.push({
          type: "thinkForSeconds",
          text: String(block.getFieldValue("TEXT") ?? ""),
          seconds: getNumberField(block, "SECONDS"),
        });
        break;
      case "looks_clear_speech":
        program.push({ type: "clearSpeech" });
        break;
      case "looks_change_size":
        program.push({ type: "changeSize", amount: getNumberField(block, "AMOUNT") });
        break;
      case "looks_change_size_value":
        program.push({ type: "changeSize", amount: getValueInput(block, "AMOUNT", 10) });
        break;
      case "looks_set_size":
        program.push({ type: "setSize", size: getNumberField(block, "SIZE") });
        break;
      case "looks_set_size_value":
        program.push({ type: "setSize", size: getValueInput(block, "SIZE", 100) });
        break;
      case "looks_set_tone":
        program.push({ type: "setTone", tone: String(block.getFieldValue("TONE") ?? "#56CBF9") });
        break;
      case "looks_change_tone":
        program.push({ type: "changeTone", amount: getValueInput(block, "AMOUNT", 1) });
        break;
      case "looks_show":
        program.push({ type: "show" });
        break;
      case "looks_hide":
        program.push({ type: "hide" });
        break;
      case "looks_go_to_layer":
        program.push({ type: "goToLayer", layer: String(block.getFieldValue("LAYER")) === "back" ? "back" : "front" });
        break;
      case "looks_change_layer":
        program.push({
          type: "changeLayer",
          direction: String(block.getFieldValue("DIRECTION")) === "backward" ? "backward" : "forward",
          amount: getValueInput(block, "AMOUNT", 1),
        });
        break;
      case "looks_switch_backdrop":
        program.push({ type: "switchBackdrop", backdropId: String(block.getFieldValue("BACKDROP") ?? "backdrop-1") });
        break;
      case "looks_next_backdrop":
        program.push({ type: "nextBackdrop" });
        break;
      case "variables_set":
        program.push({ type: "setVariable", name: getVariableName(block), value: getValueInput(block, "VALUE", 0) });
        break;
      case "math_change":
        program.push({ type: "changeVariable", name: getVariableName(block), amount: getValueInput(block, "DELTA", 1) });
        break;
      case "control_create_clone":
        program.push({ type: "createClone" });
        break;
      case "control_delete_clone":
        program.push({ type: "deleteClone" });
        break;
      case "control_wait":
        program.push({ type: "wait", seconds: getNumberField(block, "SECONDS") });
        break;
      case "control_wait_value":
        program.push({ type: "wait", seconds: getValueInput(block, "SECONDS", 1) });
        break;
      case "control_repeat_times":
        program.push({
          type: "repeat",
          times: Math.max(1, Math.floor(getNumberField(block, "TIMES"))),
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth),
        });
        break;
      case "control_repeat_value":
        program.push({
          type: "repeat",
          times: getValueInput(block, "TIMES", 3),
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth),
        });
        break;
      case "control_repeat_until":
        program.push({
          type: "repeatUntil",
          condition: parseCondition(block.getInputTargetBlock("COND")),
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth),
        });
        break;
      case "control_wait_until":
        program.push({ type: "waitUntil", condition: parseCondition(block.getInputTargetBlock("COND")) });
        break;
      case "control_forever":
        program.push({
          type: "forever",
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth),
        });
        break;
      case "control_if":
        program.push({
          type: "if",
          condition: parseCondition(block.getInputTargetBlock("COND")),
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth),
        });
        break;
      case "control_if_else":
        program.push({
          type: "ifElse",
          condition: parseCondition(block.getInputTargetBlock("COND")),
          thenBody: parseStack(block.getInputTargetBlock("DO"), definitions, depth),
          elseBody: parseStack(block.getInputTargetBlock("ELSE"), definitions, depth),
        });
        break;
      case "custom_call":
      case "ai_use": {
        const name = getCustomBlockName(block);
        const definitionStart = definitions.get(normalizeCustomName(name));

        if (definitionStart && depth < maxDefinitionDepth) {
          program.push(...parseStack(definitionStart, definitions, depth + 1));
        } else {
          program.push({ type: "customCall", name });
        }
        break;
      }
    }

    block = block.getNextBlock();
  }

  return program;
}

function collectCustomDefinitions(workspace: Blockly.WorkspaceSvg): CustomDefinitions {
  const definitions = new Map<string, Blockly.Block | null>();

  for (const block of workspace.getTopBlocks(false)) {
    if (isCustomDefinitionBlock(block)) {
      definitions.set(
        normalizeCustomName(getCustomBlockName(block)),
        block.getNextBlock(),
      );
    }
  }

  return definitions;
}

export function blockStackToAst(workspace: Blockly.WorkspaceSvg, block: Blockly.Block): ScriptNode[] {
  const definitions = collectCustomDefinitions(workspace);

  if (block.type === "event_start" || block.type === "event_clone_start" || isCustomDefinitionBlock(block)) {
    return parseStack(block.getNextBlock(), definitions);
  }

  if (block.outputConnection) {
    return [{ type: "if", condition: parseCondition(block), body: [] }];
  }

  return parseStack(block, definitions);
}

export function blocklyToAst(workspace: Blockly.WorkspaceSvg) {
  return blocklyToPrograms(workspace).start.flat();
}

export function blocklyToPrograms(workspace: Blockly.WorkspaceSvg) {
  const topBlocks = workspace.getTopBlocks(false);
  const definitions = collectCustomDefinitions(workspace);

  const startBlocks = topBlocks.filter((block) => block.type === "event_start");
  const cloneStartBlocks = topBlocks.filter((block) => block.type === "event_clone_start");

  return {
    start: startBlocks.map((block) => parseStack(block.getNextBlock(), definitions)).filter((stack) => stack.length > 0),
    cloneStart: cloneStartBlocks.map((block) => parseStack(block.getNextBlock(), definitions)).filter((stack) => stack.length > 0),
  } satisfies { start: ScriptProgram; cloneStart: ScriptProgram };
}
