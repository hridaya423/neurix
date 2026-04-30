import * as Blockly from "blockly/core";
import type { ScriptNode } from "@/lib/compiler/types";

type AiDefinitions = Map<string, Blockly.Block | null>;

const maxDefinitionDepth = 8;

function normalizePrompt(prompt: string) {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function getNumberField(block: Blockly.Block, fieldName: string) {
  return Number(block.getFieldValue(fieldName)) || 0;
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
      case "looks_say":
        program.push({ type: "say", text: String(block.getFieldValue("TEXT") ?? "") });
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
