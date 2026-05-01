import * as Blockly from "blockly/core";
import type { KeyName, ScriptCondition, ScriptNode } from "@/lib/compiler/types";

type AiDefinitions = Map<string, Blockly.Block | null>;

const maxDefinitionDepth = 8;

function normalizePrompt(prompt: string) {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function getNumberField(block: Blockly.Block, fieldName: string) {
  return Number(block.getFieldValue(fieldName)) || 0;
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
    case "operator_compare_numbers":
      return {
        type: "compare",
        left: getNumberField(block, "LEFT"),
        operator: String(block.getFieldValue("OPERATOR")) as "=" | "<" | ">",
        right: getNumberField(block, "RIGHT"),
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

function parseStack(startBlock: Blockly.Block | null, definitions: AiDefinitions, depth = 0): ScriptNode[] {
  const program: ScriptNode[] = [];
  let block = startBlock;

  while (block) {
    switch (block.type) {
      case "motion_move_steps":
        program.push({ type: "move", steps: getNumberField(block, "STEPS") });
        break;
      case "motion_turn_degrees":
        program.push({ type: "turn", degrees: getNumberField(block, "DEGREES") });
        break;
      case "motion_set_xy":
        program.push({
          type: "setPosition",
          x: getNumberField(block, "X"),
          y: getNumberField(block, "Y"),
        });
        break;
      case "motion_go_home":
        program.push({ type: "goHome" });
        break;
      case "motion_change_x":
        program.push({ type: "changeX", dx: getNumberField(block, "DX") });
        break;
      case "motion_set_x":
        program.push({ type: "setX", x: getNumberField(block, "X") });
        break;
      case "motion_change_y":
        program.push({ type: "changeY", dy: getNumberField(block, "DY") });
        break;
      case "motion_set_y":
        program.push({ type: "setY", y: getNumberField(block, "Y") });
        break;
      case "motion_point_direction":
        program.push({ type: "pointInDirection", direction: getNumberField(block, "DIRECTION") });
        break;
      case "motion_if_on_edge_bounce":
        program.push({ type: "ifOnEdgeBounce" });
        break;
      case "looks_say":
        program.push({ type: "say", text: String(block.getFieldValue("TEXT") ?? "") });
        break;
      case "looks_say_for_seconds":
        program.push({
          type: "sayForSeconds",
          text: String(block.getFieldValue("TEXT") ?? ""),
          seconds: getNumberField(block, "SECONDS"),
        });
        break;
      case "looks_think":
        program.push({ type: "think", text: String(block.getFieldValue("TEXT") ?? "") });
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
      case "looks_set_size":
        program.push({ type: "setSize", size: getNumberField(block, "SIZE") });
        break;
      case "looks_show":
        program.push({ type: "show" });
        break;
      case "looks_hide":
        program.push({ type: "hide" });
        break;
      case "control_wait":
        program.push({ type: "wait", seconds: getNumberField(block, "SECONDS") });
        break;
      case "control_repeat_times":
        program.push({
          type: "repeat",
          times: Math.max(1, Math.floor(getNumberField(block, "TIMES"))),
          body: parseStack(block.getInputTargetBlock("DO"), definitions, depth),
        });
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
      case "ai_use": {
        const prompt = String(block.getFieldValue("PROMPT") ?? "");
        const definitionStart = definitions.get(normalizePrompt(prompt));

        if (definitionStart && depth < maxDefinitionDepth) {
          program.push(...parseStack(definitionStart, definitions, depth + 1));
        } else {
          program.push({ type: "aiIntent", prompt });
        }
        break;
      }
    }

    block = block.getNextBlock();
  }

  return program;
}

export function blocklyToAst(workspace: Blockly.WorkspaceSvg) {
  const topBlocks = workspace.getTopBlocks(false);
  const definitions = new Map<string, Blockly.Block | null>();

  for (const block of topBlocks) {
    if (block.type === "ai_define") {
      definitions.set(
        normalizePrompt(String(block.getFieldValue("PROMPT") ?? "")),
        block.getNextBlock(),
      );
    }
  }

  const startBlock = topBlocks.find((block) => block.type === "event_start");
  return startBlock ? parseStack(startBlock.getNextBlock(), definitions) : [];
}
