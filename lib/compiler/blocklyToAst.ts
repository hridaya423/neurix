import * as Blockly from "blockly/core";
import type { GraphicEffect, KeyName, ScriptCondition, ScriptEventPrograms, ScriptNode, ScriptProgram, ScriptValue } from "@/lib/compiler/types";

type CustomDefinitionArg = { name: string; kind: "value" | "boolean" };
type CustomDefinition = { start: Blockly.Block | null; args: CustomDefinitionArg[] };
type CustomDefinitions = Map<string, CustomDefinition>;
type ValueBindings = Map<string, ScriptValue>;
type ConditionBindings = Map<string, ScriptCondition>;

const maxDefinitionDepth = 8;

function normalizeCustomName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function getCustomBlockName(block: Blockly.Block) {
  const procedure = block as unknown as Partial<{ getProcedureDef: () => [string, string[], boolean] }>;
  if (typeof procedure.getProcedureDef === "function") {
    return procedure.getProcedureDef()[0];
  }
  try {
    const data = (block as Blockly.Block & { data?: string | null }).data;
    const parsed = data ? JSON.parse(data) as { name?: string } : null;
    if (parsed?.name?.trim()) return parsed.name.trim();
  } catch {
  }
  return block.getField("NAME")?.getText() ?? String(block.getFieldValue("PROMPT") ?? "");
}

function isCustomDefinitionBlock(block: Blockly.Block) {
  return block.type === "custom_define" || block.type === "ai_define" || block.type === "procedures_defnoreturn";
}

function getNumberField(block: Blockly.Block, fieldName: string) {
  return Number(block.getFieldValue(fieldName)) || 0;
}

function getMessageField(block: Blockly.Block) {
  return String(block.getFieldValue("MESSAGE") ?? "message1").trim() || "message1";
}

function getCustomDefinitionArgs(block: Blockly.Block, fallbackArgs: string[]): CustomDefinitionArg[] {
  try {
    const data = (block as Blockly.Block & { data?: string | null }).data;
    const parsed = data ? JSON.parse(data) as { args?: { name?: string; kind?: string }[] } : null;
    if (Array.isArray(parsed?.args)) {
      const names = fallbackArgs.length > 0 ? fallbackArgs : parsed.args.map((arg, index) => String(arg.name ?? `input${index + 1}`));
      return names.map((name, index) => ({
        name: String(parsed.args?.[index]?.name ?? name),
        kind: parsed.args?.[index]?.kind === "boolean" ? "boolean" : "value",
      }));
    }
  } catch {
  }

  return fallbackArgs.map((name) => ({ name, kind: "value" }));
}

function getVariableName(block: Blockly.Block, fieldName = "VAR") {
  const field = block.getField(fieldName);
  return field?.getText() || String(block.getFieldValue(fieldName) ?? "variable");
}

function parseValue(block: Blockly.Block | null, fallback: ScriptValue = 0, bindings: ValueBindings = new Map()): ScriptValue {
  if (!block) return fallback;

  switch (block.type) {
    case "math_number":
      return Number(block.getFieldValue("NUM")) || 0;
    case "text":
      return String(block.getFieldValue("TEXT") ?? "");
    case "variables_get":
    case "variables_get_dynamic": {
      const name = getVariableName(block);
      return bindings.get(name) ?? { type: "variable", name };
    }
    case "variable_watcher_toggle": {
      const name = getVariableName(block, "NAME").trim();
      return name ? bindings.get(name) ?? { type: "variable", name } : fallback;
    }
    case "custom_arg_value": {
      const name = getVariableName(block, "NAME").trim();
      return name ? bindings.get(name) ?? fallback : fallback;
    }
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
    case "looks_costume_name":
      return { type: "costumeProperty", property: "costumeName" };
    case "looks_costume_number":
      return { type: "costumeProperty", property: "costumeNumber" };
    case "sensing_mouse_x":
      return { type: "sensing", property: "mouseX" };
    case "sensing_mouse_y":
      return { type: "sensing", property: "mouseY" };
    case "sensing_timer":
      return { type: "sensing", property: "timer" };
    case "sensing_distance_to":
      return { type: "distanceToObject", object: String(block.getFieldValue("OBJ") ?? "center") };
    case "sensing_current_time": {
      const unit = String(block.getFieldValue("UNIT"));
      return { type: "sensing", property: unit === "MINUTE" ? "currentMinute" : unit === "HOUR" ? "currentHour" : "currentSecond" };
    }
    case "sensing_last_key":
      return { type: "sensing", property: "lastKey" };
    case "math_random_int":
      return {
        type: "random",
        from: parseValue(block.getInputTargetBlock("FROM"), 1, bindings),
        to: parseValue(block.getInputTargetBlock("TO"), 10, bindings),
      };
    case "math_arithmetic": {
      const op = String(block.getFieldValue("OP"));
      const operator = op === "MINUS" ? "-" : op === "MULTIPLY" ? "*" : op === "DIVIDE" ? "/" : op === "POWER" ? "^" : "+";
      return {
        type: "arithmetic",
        operator,
        left: parseValue(block.getInputTargetBlock("A"), 0, bindings),
        right: parseValue(block.getInputTargetBlock("B"), 0, bindings),
      };
    }
    case "math_modulo":
      return {
        type: "arithmetic",
        operator: "%",
        left: parseValue(block.getInputTargetBlock("DIVIDEND"), 0, bindings),
        right: parseValue(block.getInputTargetBlock("DIVISOR"), 1, bindings),
      };
    case "math_round":
      return { type: "round", value: parseValue(block.getInputTargetBlock("NUM"), 0, bindings) };
    case "math_single": {
      const op = String(block.getFieldValue("OP"));
      const operator = op === "ABS" ? "abs" : op === "NEG" ? "abs" : op === "LN" ? "sqrt" : "sqrt";
      return { type: "math", operator, value: parseValue(block.getInputTargetBlock("NUM"), 0, bindings) };
    }
    case "math_trig": {
      const op = String(block.getFieldValue("OP"));
      const operator = op === "COS" ? "cos" : op === "TAN" ? "tan" : "sin";
      return { type: "math", operator, value: parseValue(block.getInputTargetBlock("NUM"), 0, bindings) };
    }
    case "operator_join":
      return {
        type: "join",
        values: [parseValue(block.getInputTargetBlock("A"), "", bindings), parseValue(block.getInputTargetBlock("B"), "", bindings)],
      };
    case "text_join":
      return {
        type: "join",
        values: [parseValue(block.getInputTargetBlock("ADD0"), "", bindings), parseValue(block.getInputTargetBlock("ADD1"), "", bindings)],
      };
    case "text_length":
      return { type: "lengthOf", text: parseValue(block.getInputTargetBlock("VALUE"), "", bindings) };
    case "text_charAt":
      return {
        type: "letterOf",
        text: parseValue(block.getInputTargetBlock("VALUE"), "", bindings),
        index: parseValue(block.getInputTargetBlock("AT"), 1, bindings),
      };
    case "list_item":
      return { type: "listItem", list: String(block.getFieldValue("LIST") ?? "list"), index: parseValue(block.getInputTargetBlock("INDEX"), 1, bindings) };
    case "list_index":
      return { type: "listIndex", list: String(block.getFieldValue("LIST") ?? "list"), item: parseValue(block.getInputTargetBlock("ITEM"), "", bindings) };
    case "list_length":
      return { type: "listLength", list: String(block.getFieldValue("LIST") ?? "list") };
    case "sound_volume":
      return { type: "soundVolume" };
    default:
      return fallback;
  }
}

function getValueInput(block: Blockly.Block, inputName: string, fallback: ScriptValue = 0, bindings: ValueBindings = new Map()) {
  return parseValue(block.getInputTargetBlock(inputName), fallback, bindings);
}

function defaultCondition(): ScriptCondition {
  return { type: "compare", left: 1, operator: "=", right: 1 };
}

function parseCondition(block: Blockly.Block | null, bindings: ValueBindings = new Map(), conditionBindings: ConditionBindings = new Map()): ScriptCondition {
  if (!block) return defaultCondition();

  switch (block.type) {
    case "custom_arg_boolean": {
      const name = getVariableName(block, "NAME").trim();
      return name ? conditionBindings.get(name) ?? defaultCondition() : defaultCondition();
    }
    case "sensing_key_pressed":
      return { type: "keyPressed", key: String(block.getFieldValue("KEY")) as KeyName };
    case "sensing_touching_object":
      return { type: "touchingObject", object: String(block.getFieldValue("OBJ") ?? "edge") };
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
        left: parseValue(block.getInputTargetBlock("A"), 0, bindings),
        operator,
        right: parseValue(block.getInputTargetBlock("B"), 0, bindings),
      };
    }
    case "logic_operation":
      return String(block.getFieldValue("OP")) === "OR"
        ? { type: "or", left: parseCondition(block.getInputTargetBlock("A"), bindings, conditionBindings), right: parseCondition(block.getInputTargetBlock("B"), bindings, conditionBindings) }
        : { type: "and", left: parseCondition(block.getInputTargetBlock("A"), bindings, conditionBindings), right: parseCondition(block.getInputTargetBlock("B"), bindings, conditionBindings) };
    case "logic_negate":
      return { type: "not", condition: parseCondition(block.getInputTargetBlock("BOOL"), bindings, conditionBindings) };
    case "operator_contains":
      return {
        type: "contains",
        text: parseValue(block.getInputTargetBlock("TEXT"), "", bindings),
        search: parseValue(block.getInputTargetBlock("SEARCH"), "", bindings),
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
        left: parseValue(block.getInputTargetBlock("LEFT"), 0, bindings),
        operator: String(block.getFieldValue("OPERATOR")) as "=" | "<" | ">" | "≤" | "≥" | "≠",
        right: parseValue(block.getInputTargetBlock("RIGHT"), 0, bindings),
      };
    case "operator_and":
      return {
        type: "and",
        left: parseCondition(block.getInputTargetBlock("LEFT"), bindings, conditionBindings),
        right: parseCondition(block.getInputTargetBlock("RIGHT"), bindings, conditionBindings),
      };
    case "operator_or":
      return {
        type: "or",
        left: parseCondition(block.getInputTargetBlock("LEFT"), bindings, conditionBindings),
        right: parseCondition(block.getInputTargetBlock("RIGHT"), bindings, conditionBindings),
      };
    case "operator_not":
      return { type: "not", condition: parseCondition(block.getInputTargetBlock("COND"), bindings, conditionBindings) };
    case "list_contains":
      return { type: "listContains", list: String(block.getFieldValue("LIST") ?? "list"), item: parseValue(block.getInputTargetBlock("ITEM"), "", bindings) };
    default:
      return defaultCondition();
  }
}

function parseStack(startBlock: Blockly.Block | null, definitions: CustomDefinitions, depth = 0, bindings: ValueBindings = new Map(), conditionBindings: ConditionBindings = new Map()): ScriptNode[] {
  const program: ScriptNode[] = [];
  let block = startBlock;

  while (block) {
    switch (block.type) {
      case "motion_move_steps":
        program.push({ type: "move", steps: getNumberField(block, "STEPS") });
        break;
      case "motion_move_value":
        program.push({ type: "move", steps: getValueInput(block, "STEPS", 10, bindings) });
        break;
      case "motion_turn_degrees":
        program.push({ type: "turn", degrees: getNumberField(block, "DEGREES") });
        break;
      case "motion_turn_value":
        program.push({ type: "turn", degrees: getValueInput(block, "DEGREES", 15, bindings) });
        break;
      case "motion_set_xy":
        program.push({
          type: "setPosition",
          x: getNumberField(block, "X"),
          y: getNumberField(block, "Y"),
        });
        break;
      case "motion_set_xy_value":
        program.push({ type: "setPosition", x: getValueInput(block, "X", 0, bindings), y: getValueInput(block, "Y", 0, bindings) });
        break;
      case "motion_go_home":
        program.push({ type: "goHome" });
        break;
      case "motion_change_x":
        program.push({ type: "changeX", dx: getNumberField(block, "DX") });
        break;
      case "motion_change_x_value":
        program.push({ type: "changeX", dx: getValueInput(block, "DX", 10, bindings) });
        break;
      case "motion_set_x":
        program.push({ type: "setX", x: getNumberField(block, "X") });
        break;
      case "motion_set_x_value":
        program.push({ type: "setX", x: getValueInput(block, "X", 0, bindings) });
        break;
      case "motion_change_y":
        program.push({ type: "changeY", dy: getNumberField(block, "DY") });
        break;
      case "motion_change_y_value":
        program.push({ type: "changeY", dy: getValueInput(block, "DY", 10, bindings) });
        break;
      case "motion_set_y":
        program.push({ type: "setY", y: getNumberField(block, "Y") });
        break;
      case "motion_set_y_value":
        program.push({ type: "setY", y: getValueInput(block, "Y", 0, bindings) });
        break;
      case "motion_point_direction":
        program.push({ type: "pointInDirection", direction: getNumberField(block, "DIRECTION") });
        break;
      case "motion_point_direction_value":
        program.push({ type: "pointInDirection", direction: getValueInput(block, "DIRECTION", 90, bindings) });
        break;
      case "motion_if_on_edge_bounce":
program.push({ type: "ifOnEdgeBounce" });
        break;
      case "motion_point_toward_object":
        program.push({ type: "pointTowardObject", object: String(block.getFieldValue("OBJ") ?? "mouse-pointer") });
        break;
      case "motion_if_on_edge_bounce":
        program.push({ type: "ifOnEdgeBounce" });
        break;
      case "motion_go_to_object":
        program.push({ type: "goToObject", object: String(block.getFieldValue("OBJ") ?? "mouse-pointer") });
        break;
      case "motion_glide_xy":
        program.push({ type: "glideToPosition", seconds: getValueInput(block, "SECONDS", 1, bindings), x: getValueInput(block, "X", 0, bindings), y: getValueInput(block, "Y", 0, bindings) });
        break;
      case "motion_glide_object":
        program.push({ type: "glideToObject", seconds: getValueInput(block, "SECONDS", 1, bindings), object: String(block.getFieldValue("OBJ") ?? "mouse-pointer") });
        break;
      case "motion_glide_xy":
        program.push({ type: "glideToPosition", seconds: getValueInput(block, "SECONDS", 1, bindings), x: getValueInput(block, "X", 0, bindings), y: getValueInput(block, "Y", 0, bindings) });
        break;
      case "looks_say":
        program.push({ type: "say", text: String(block.getFieldValue("TEXT") ?? "") });
        break;
      case "looks_say_value":
        program.push({ type: "say", text: getValueInput(block, "TEXT", "Hello", bindings) });
        break;
      case "looks_say_for_seconds":
        program.push({
          type: "sayForSeconds",
          text: String(block.getFieldValue("TEXT") ?? ""),
          seconds: getNumberField(block, "SECONDS"),
        });
        break;
      case "looks_say_value_for_seconds":
        program.push({ type: "sayForSeconds", text: getValueInput(block, "TEXT", "Hello", bindings), seconds: getValueInput(block, "SECONDS", 2, bindings) });
        break;
      case "looks_think":
        program.push({ type: "think", text: String(block.getFieldValue("TEXT") ?? "") });
        break;
      case "looks_think_value":
        program.push({ type: "think", text: getValueInput(block, "TEXT", "Hmm", bindings) });
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
        program.push({ type: "changeSize", amount: getValueInput(block, "AMOUNT", 10, bindings) });
        break;
      case "looks_set_size":
        program.push({ type: "setSize", size: getNumberField(block, "SIZE") });
        break;
      case "looks_set_size_value":
        program.push({ type: "setSize", size: getValueInput(block, "SIZE", 100, bindings) });
        break;
      case "looks_set_tone":
        program.push({ type: "setTone", tone: String(block.getFieldValue("TONE") ?? "#56CBF9") });
        break;
      case "looks_change_tone":
        program.push({ type: "changeTone", amount: getValueInput(block, "AMOUNT", 1, bindings) });
        break;
      case "looks_change_effect":
        program.push({ type: "changeGraphicEffect", effect: String(block.getFieldValue("EFFECT")) as GraphicEffect, amount: getValueInput(block, "AMOUNT", 25, bindings) });
        break;
      case "looks_set_effect":
        program.push({ type: "setGraphicEffect", effect: String(block.getFieldValue("EFFECT")) as GraphicEffect, value: getValueInput(block, "VALUE", 0, bindings) });
        break;
      case "looks_clear_effects":
        program.push({ type: "clearGraphicEffects" });
        break;
      case "data_showvariable":
        program.push({ type: "showVariable", name: getVariableName(block, "VAR") });
        break;
      case "data_hidevariable":
        program.push({ type: "hideVariable", name: getVariableName(block, "VAR") });
        break;
      case "sensing_resettimer":
        program.push({ type: "resetTimer" });
        break;
      case "control_stop": {
        const mode = String(block.getFieldValue("STOP") ?? "all");
        program.push({ type: "stop", mode: mode === "thisScript" ? "thisScript" : "all" });
        break;
      }
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
          amount: getValueInput(block, "AMOUNT", 1, bindings),
        });
        break;
      case "looks_switch_backdrop":
        program.push({ type: "switchBackdrop", backdropId: String(block.getFieldValue("BACKDROP") ?? "backdrop-1") });
        break;
      case "looks_switch_backdrop_and_wait":
        program.push({ type: "switchBackdropAndWait", backdropId: String(block.getFieldValue("BACKDROP") ?? "backdrop-1") });
        break;
      case "looks_next_backdrop":
        program.push({ type: "nextBackdrop" });
        break;
      case "event_broadcast":
        program.push({ type: "broadcast", message: getMessageField(block) });
        break;
      case "event_broadcast_wait":
        program.push({ type: "broadcastAndWait", message: getMessageField(block) });
        break;
      case "looks_switch_costume":
        program.push({ type: "switchCostume", costumeId: String(block.getFieldValue("COSTUME") ?? "costume-1") });
        break;
      case "looks_next_costume":
        program.push({ type: "nextCostume" });
        break;
      case "sound_play":
        program.push({ type: "playSound", soundId: String(block.getFieldValue("SOUND") ?? ""), wait: false });
        break;
      case "sound_play_until_done":
        program.push({ type: "playSound", soundId: String(block.getFieldValue("SOUND") ?? ""), wait: true });
        break;
      case "sound_stop_all":
        program.push({ type: "stopAllSounds" });
        break;
      case "sound_change_effect":
        program.push({ type: "changeSoundEffect", effect: String(block.getFieldValue("EFFECT")) === "pan" ? "pan" : "pitch", amount: getValueInput(block, "AMOUNT", 10, bindings) });
        break;
      case "sound_set_effect":
        program.push({ type: "setSoundEffect", effect: String(block.getFieldValue("EFFECT")) === "pan" ? "pan" : "pitch", value: getValueInput(block, "VALUE", 0, bindings) });
        break;
      case "sound_clear_effects":
        program.push({ type: "clearSoundEffects" });
        break;
      case "sound_change_volume":
        program.push({ type: "changeVolume", amount: getValueInput(block, "AMOUNT", -10, bindings) });
        break;
      case "sound_set_volume":
        program.push({ type: "setVolume", volume: getValueInput(block, "VOLUME", 100, bindings) });
        break;
      case "variables_set":
      case "variables_set_dynamic":
        program.push({ type: "setVariable", name: getVariableName(block), value: getValueInput(block, "VALUE", 0, bindings) });
        break;
      case "math_change":
        program.push({ type: "changeVariable", name: getVariableName(block), amount: getValueInput(block, "DELTA", 1, bindings) });
        break;
      case "list_add":
        program.push({ type: "listAdd", list: String(block.getFieldValue("LIST") ?? "list"), item: getValueInput(block, "ITEM", "", bindings) });
        break;
      case "list_delete":
        program.push({ type: "listDelete", list: String(block.getFieldValue("LIST") ?? "list"), index: getValueInput(block, "INDEX", 1, bindings) });
        break;
      case "list_delete_all":
        program.push({ type: "listDelete", list: String(block.getFieldValue("LIST") ?? "list"), index: "all" });
        break;
      case "list_insert":
        program.push({ type: "listInsert", list: String(block.getFieldValue("LIST") ?? "list"), index: getValueInput(block, "INDEX", 1, bindings), item: getValueInput(block, "ITEM", "", bindings) });
        break;
      case "list_replace":
        program.push({ type: "listReplace", list: String(block.getFieldValue("LIST") ?? "list"), index: getValueInput(block, "INDEX", 1, bindings), item: getValueInput(block, "ITEM", "", bindings) });
        break;
      case "list_show":
        program.push({ type: "showList", list: String(block.getFieldValue("LIST") ?? "list") });
        break;
      case "list_hide":
        program.push({ type: "hideList", list: String(block.getFieldValue("LIST") ?? "list") });
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
        program.push({ type: "wait", seconds: getValueInput(block, "SECONDS", 1, bindings) });
        break;
      case "control_repeat_times":
        program.push({
          type: "repeat",
          times: Math.max(1, Math.floor(getNumberField(block, "TIMES"))),
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth, bindings, conditionBindings),
        });
        break;
      case "control_repeat_value":
        program.push({
          type: "repeat",
          times: getValueInput(block, "TIMES", 3, bindings),
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth, bindings, conditionBindings),
        });
        break;
      case "control_repeat_until":
        program.push({
          type: "repeatUntil",
          condition: parseCondition(block.getInputTargetBlock("COND"), bindings, conditionBindings),
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth, bindings, conditionBindings),
        });
        break;
      case "control_wait_until":
        program.push({ type: "waitUntil", condition: parseCondition(block.getInputTargetBlock("COND"), bindings, conditionBindings) });
        break;
      case "control_forever":
        program.push({
          type: "forever",
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth, bindings, conditionBindings),
        });
        break;
      case "control_if":
        program.push({
          type: "if",
          condition: parseCondition(block.getInputTargetBlock("COND"), bindings, conditionBindings),
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth, bindings, conditionBindings),
        });
        break;
      case "control_if_else":
        program.push({
          type: "ifElse",
          condition: parseCondition(block.getInputTargetBlock("COND"), bindings, conditionBindings),
          thenBody: parseStack(block.getInputTargetBlock("DO"), definitions, depth, bindings, conditionBindings),
          elseBody: parseStack(block.getInputTargetBlock("ELSE"), definitions, depth, bindings, conditionBindings),
        });
        break;
      case "custom_call":
      case "ai_use": {
        const currentBlock = block;
        const name = getCustomBlockName(block);
        const definition = definitions.get(normalizeCustomName(name));

        if (definition && depth < maxDefinitionDepth) {
          const nextBindings = new Map(bindings);
          const nextConditionBindings = new Map(conditionBindings);
          definition.args.forEach((arg, index) => {
            if (arg.kind === "boolean") {
              nextConditionBindings.set(arg.name, parseCondition(currentBlock.getInputTargetBlock(`ARG${index}`), bindings, conditionBindings));
            } else {
              nextBindings.set(arg.name, getValueInput(currentBlock, `ARG${index}`, 0, bindings));
            }
          });
          program.push(...parseStack(definition.start, definitions, depth + 1, nextBindings, nextConditionBindings));
        } else {
          program.push({ type: "customCall", name });
        }
        break;
      }
      case "procedures_callnoreturn": {
        const currentBlock = block;
        const procedure = block as unknown as { getProcedureCall?: () => string; arguments_?: string[] };
        const name = procedure.getProcedureCall?.() ?? getCustomBlockName(block);
        const definition = definitions.get(normalizeCustomName(name));

        if (definition && depth < maxDefinitionDepth) {
          const nextBindings = new Map(bindings);
          const nextConditionBindings = new Map(conditionBindings);
          definition.args.forEach((arg, index) => {
            if (arg.kind === "boolean") {
              nextConditionBindings.set(arg.name, parseCondition(currentBlock.getInputTargetBlock(`ARG${index}`), bindings, conditionBindings));
            } else {
              nextBindings.set(arg.name, getValueInput(currentBlock, `ARG${index}`, 0, bindings));
            }
          });
          program.push(...parseStack(definition.start, definitions, depth + 1, nextBindings, nextConditionBindings));
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
  const definitions: CustomDefinitions = new Map();

  for (const block of workspace.getTopBlocks(false)) {
    if (isCustomDefinitionBlock(block)) {
      const procedure = block as unknown as Partial<{ getProcedureDef: () => [string, string[], boolean] }>;
      const procedureDef = procedure.getProcedureDef?.();
      const args = getCustomDefinitionArgs(block, procedureDef?.[1] ?? []);
      definitions.set(
        normalizeCustomName(getCustomBlockName(block)),
        {
          start: block.type === "procedures_defnoreturn" ? block.getInputTargetBlock("STACK") : block.getNextBlock(),
          args,
        },
      );
    }
  }

  return definitions;
}

export function blockStackToAst(workspace: Blockly.WorkspaceSvg, block: Blockly.Block): ScriptNode[] {
  const definitions = collectCustomDefinitions(workspace);

  if (block.type === "event_start" || block.type === "event_clone_start" || block.type === "event_when_broadcast" || block.type === "event_when_backdrop" || isCustomDefinitionBlock(block)) {
    return parseStack(block.type === "procedures_defnoreturn" ? block.getInputTargetBlock("STACK") : block.getNextBlock(), definitions);
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
  const broadcasts: ScriptEventPrograms = {};
  const backdrops: ScriptEventPrograms = {};

  const addEventStack = (target: ScriptEventPrograms, key: string, block: Blockly.Block) => {
    const stack = parseStack(block.getNextBlock(), definitions);
    if (stack.length === 0) return;
    target[key] = [...(target[key] ?? []), stack];
  };

  for (const block of topBlocks) {
    if (block.type === "event_when_broadcast") {
      addEventStack(broadcasts, getMessageField(block), block);
    }

    if (block.type === "event_when_backdrop") {
      addEventStack(backdrops, String(block.getFieldValue("BACKDROP") ?? "backdrop-1"), block);
    }
  }

  return {
    start: startBlocks.map((block) => parseStack(block.getNextBlock(), definitions)).filter((stack) => stack.length > 0),
    cloneStart: cloneStartBlocks.map((block) => parseStack(block.getNextBlock(), definitions)).filter((stack) => stack.length > 0),
    broadcasts,
    backdrops,
  } satisfies { start: ScriptProgram; cloneStart: ScriptProgram; broadcasts: ScriptEventPrograms; backdrops: ScriptEventPrograms };
}
