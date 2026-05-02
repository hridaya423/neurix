import * as Blockly from "blockly/core";
import type { ScriptCondition, ScriptNode } from "@/lib/compiler/types";

function setField(block: Blockly.Block, name: string, value: string | number) {
  block.setFieldValue(String(value), name);
}

function connectValue(parent: Blockly.Block, inputName: string, child: Blockly.Block | null) {
  if (!child?.outputConnection) return;
  const connection = parent.getInput(inputName)?.connection;
  if (connection) connection.connect(child.outputConnection);
}

function connectStatements(parent: Blockly.Block, inputName: string, nodes: ScriptNode[]) {
  const connection = parent.getInput(inputName)?.connection;
  if (!connection) return;

  const first = createStatementStack(parent.workspace, nodes);
  if (first?.previousConnection) connection.connect(first.previousConnection);
}

function init(block: Blockly.Block) {
  const svgBlock = block as Blockly.BlockSvg;
  svgBlock.initSvg();
  svgBlock.render();
  return block;
}

function createConditionBlock(workspace: Blockly.Workspace, condition: ScriptCondition): Blockly.Block {
  switch (condition.type) {
    case "keyPressed": {
      const block = workspace.newBlock("sensing_key_pressed");
      setField(block, "KEY", condition.key);
      return init(block);
    }
    case "touchingEdge":
      return init(workspace.newBlock("sensing_touching_edge"));
    case "not": {
      const block = init(workspace.newBlock("operator_not"));
      connectValue(block, "COND", createConditionBlock(workspace, condition.condition));
      return block;
    }
    case "and": {
      const block = init(workspace.newBlock("operator_and"));
      connectValue(block, "LEFT", createConditionBlock(workspace, condition.left));
      connectValue(block, "RIGHT", createConditionBlock(workspace, condition.right));
      return block;
    }
    case "or": {
      const block = init(workspace.newBlock("operator_or"));
      connectValue(block, "LEFT", createConditionBlock(workspace, condition.left));
      connectValue(block, "RIGHT", createConditionBlock(workspace, condition.right));
      return block;
    }
    case "compare": {
      const block = workspace.newBlock("operator_compare_numbers");
      setField(block, "LEFT", condition.left);
      setField(block, "OPERATOR", condition.operator);
      setField(block, "RIGHT", condition.right);
      return init(block);
    }
  }
}

function createStatementBlock(workspace: Blockly.Workspace, node: ScriptNode): Blockly.Block | null {
  let block: Blockly.Block;

  switch (node.type) {
    case "move":
      block = workspace.newBlock("motion_move_steps");
      setField(block, "STEPS", node.steps);
      return init(block);
    case "turn":
      block = workspace.newBlock("motion_turn_degrees");
      setField(block, "DEGREES", node.degrees);
      return init(block);
    case "setPosition":
      block = workspace.newBlock("motion_set_xy");
      setField(block, "X", node.x);
      setField(block, "Y", node.y);
      return init(block);
    case "goHome":
      return init(workspace.newBlock("motion_go_home"));
    case "changeX":
      block = workspace.newBlock("motion_change_x");
      setField(block, "DX", node.dx);
      return init(block);
    case "changeY":
      block = workspace.newBlock("motion_change_y");
      setField(block, "DY", node.dy);
      return init(block);
    case "setX":
      block = workspace.newBlock("motion_set_x");
      setField(block, "X", node.x);
      return init(block);
    case "setY":
      block = workspace.newBlock("motion_set_y");
      setField(block, "Y", node.y);
      return init(block);
    case "setDirection":
    case "pointInDirection":
      block = workspace.newBlock("motion_point_direction");
      setField(block, "DIRECTION", node.direction);
      return init(block);
    case "ifOnEdgeBounce":
      return init(workspace.newBlock("motion_if_on_edge_bounce"));
    case "say":
      block = workspace.newBlock("looks_say");
      setField(block, "TEXT", node.text);
      return init(block);
    case "sayForSeconds":
      block = workspace.newBlock("looks_say_for_seconds");
      setField(block, "TEXT", node.text);
      setField(block, "SECONDS", node.seconds);
      return init(block);
    case "think":
      block = workspace.newBlock("looks_think");
      setField(block, "TEXT", node.text);
      return init(block);
    case "thinkForSeconds":
      block = workspace.newBlock("looks_think_for_seconds");
      setField(block, "TEXT", node.text);
      setField(block, "SECONDS", node.seconds);
      return init(block);
    case "clearSpeech":
      return init(workspace.newBlock("looks_clear_speech"));
    case "changeSize":
      block = workspace.newBlock("looks_change_size");
      setField(block, "AMOUNT", node.amount);
      return init(block);
    case "setSize":
      block = workspace.newBlock("looks_set_size");
      setField(block, "SIZE", node.size);
      return init(block);
    case "show":
      return init(workspace.newBlock("looks_show"));
    case "hide":
      return init(workspace.newBlock("looks_hide"));
    case "wait":
      block = workspace.newBlock("control_wait");
      setField(block, "SECONDS", node.seconds);
      return init(block);
    case "repeat":
      block = workspace.newBlock("control_repeat_times");
      setField(block, "TIMES", node.times);
      init(block);
      connectStatements(block, "DO", node.body);
      return block;
    case "forever":
      block = init(workspace.newBlock("control_forever"));
      connectStatements(block, "DO", node.body);
      return block;
    case "if":
      block = init(workspace.newBlock("control_if"));
      connectValue(block, "COND", createConditionBlock(workspace, node.condition));
      connectStatements(block, "DO", node.body);
      return block;
    case "ifElse":
      block = init(workspace.newBlock("control_if_else"));
      connectValue(block, "COND", createConditionBlock(workspace, node.condition));
      connectStatements(block, "DO", node.thenBody);
      connectStatements(block, "ELSE", node.elseBody);
      return block;
    case "aiIntent":
      block = workspace.newBlock("ai_use");
      setField(block, "PROMPT", node.prompt);
      return init(block);
  }
}

function createStatementStack(workspace: Blockly.Workspace, nodes: ScriptNode[]) {
  let first: Blockly.Block | null = null;
  let previous: Blockly.Block | null = null;

  for (const node of nodes) {
    const block = createStatementBlock(workspace, node);
    if (!block) continue;

    if (!first) first = block;
    if (previous?.nextConnection && block.previousConnection) {
      previous.nextConnection.connect(block.previousConnection);
    }
    previous = block;
  }

  return first;
}

export function insertAstUnderDefinition(definitionBlock: Blockly.Block, nodes: ScriptNode[]) {
  const existing = definitionBlock.getNextBlock();
  existing?.dispose(false);

  const first = createStatementStack(definitionBlock.workspace, nodes);
  if (first?.previousConnection && definitionBlock.nextConnection) {
    definitionBlock.nextConnection.connect(first.previousConnection);
  }

  (definitionBlock.workspace as Blockly.WorkspaceSvg).render();
}
