import * as Blockly from "blockly/core";
import type { ScriptEventPrograms, ScriptNode, ScriptProgram, ScriptValue, ScriptCondition } from "@/lib/compiler/types";

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

function primitive(value: ScriptValue, fallback: string | number) {
  if (typeof value === "number" || typeof value === "string") return value;
  if (value.type === "number") return value.value;
  if (value.type === "string") return value.value;
  return fallback;
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
    case "mouseDown":
      return init(workspace.newBlock("sensing_mouse_down"));
    case "anyKeyPressed":
      return init(workspace.newBlock("sensing_any_key_pressed"));
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
      setField(block, "LEFT", primitive(condition.left, 1));
      setField(block, "OPERATOR", condition.operator === "≠" ? "=" : condition.operator === "≤" ? "<" : condition.operator === "≥" ? ">" : condition.operator);
      setField(block, "RIGHT", primitive(condition.right, 1));
      return init(block);
    }
    case "boolean":
    case "contains":
    case "listContains":
      return createConditionBlock(workspace, { type: "compare", left: 1, operator: "=", right: 1 });
  }
}

function createStatementBlock(workspace: Blockly.Workspace, node: ScriptNode): Blockly.Block | null {
  let block: Blockly.Block;

  switch (node.type) {
    case "move":
      block = workspace.newBlock("motion_move_steps");
      setField(block, "STEPS", primitive(node.steps, 10));
      return init(block);
    case "turn":
      block = workspace.newBlock("motion_turn_degrees");
      setField(block, "DEGREES", primitive(node.degrees, 15));
      return init(block);
    case "setPosition":
      block = workspace.newBlock("motion_set_xy");
      setField(block, "X", primitive(node.x, 0));
      setField(block, "Y", primitive(node.y, 0));
      return init(block);
    case "goHome":
      return init(workspace.newBlock("motion_go_home"));
    case "changeX":
      block = workspace.newBlock("motion_change_x");
      setField(block, "DX", primitive(node.dx, 10));
      return init(block);
    case "changeY":
      block = workspace.newBlock("motion_change_y");
      setField(block, "DY", primitive(node.dy, 10));
      return init(block);
    case "setX":
      block = workspace.newBlock("motion_set_x");
      setField(block, "X", primitive(node.x, 0));
      return init(block);
    case "setY":
      block = workspace.newBlock("motion_set_y");
      setField(block, "Y", primitive(node.y, 0));
      return init(block);
    case "setDirection":
    case "pointInDirection":
      block = workspace.newBlock("motion_point_direction");
      setField(block, "DIRECTION", primitive(node.direction, 90));
      return init(block);
    case "ifOnEdgeBounce":
      return init(workspace.newBlock("motion_if_on_edge_bounce"));
    case "goToMouse":
      return init(workspace.newBlock("motion_go_to_mouse"));
    case "goToRandom":
      return init(workspace.newBlock("motion_go_to_random"));
    case "pointTowardMouse":
      return init(workspace.newBlock("motion_point_toward_mouse"));
    case "pointTowardCenter":
      return init(workspace.newBlock("motion_point_toward_center"));
    case "glideToPosition":
      block = workspace.newBlock("motion_glide_xy");
      return init(block);
    case "glideToMouse":
      block = workspace.newBlock("motion_glide_mouse");
      return init(block);
    case "say":
      block = workspace.newBlock("looks_say");
      setField(block, "TEXT", primitive(node.text, "Hello"));
      return init(block);
    case "sayForSeconds":
      block = workspace.newBlock("looks_say_for_seconds");
      setField(block, "TEXT", primitive(node.text, "Hello"));
      setField(block, "SECONDS", primitive(node.seconds, 2));
      return init(block);
    case "think":
      block = workspace.newBlock("looks_think");
      setField(block, "TEXT", primitive(node.text, "Hmm"));
      return init(block);
    case "thinkForSeconds":
      block = workspace.newBlock("looks_think_for_seconds");
      setField(block, "TEXT", primitive(node.text, "Hmm"));
      setField(block, "SECONDS", primitive(node.seconds, 2));
      return init(block);
    case "clearSpeech":
      return init(workspace.newBlock("looks_clear_speech"));
    case "changeSize":
      block = workspace.newBlock("looks_change_size");
      setField(block, "AMOUNT", primitive(node.amount, 10));
      return init(block);
    case "setSize":
      block = workspace.newBlock("looks_set_size");
      setField(block, "SIZE", primitive(node.size, 100));
      return init(block);
    case "setTone":
      block = workspace.newBlock("looks_set_tone");
      setField(block, "TONE", node.tone);
      return init(block);
    case "changeTone":
      block = workspace.newBlock("looks_change_tone");
      return init(block);
    case "show":
      return init(workspace.newBlock("looks_show"));
    case "hide":
        return init(workspace.newBlock("looks_hide"));
    case "goToLayer":
      block = workspace.newBlock("looks_go_to_layer");
      setField(block, "LAYER", node.layer);
      return init(block);
    case "changeLayer":
      block = workspace.newBlock("looks_change_layer");
      setField(block, "DIRECTION", node.direction);
      return init(block);
    case "switchBackdrop":
      block = workspace.newBlock("looks_switch_backdrop");
      setField(block, "BACKDROP", node.backdropId);
      return init(block);
    case "nextBackdrop":
      return init(workspace.newBlock("looks_next_backdrop"));
    case "broadcast":
    case "broadcastAndWait":
      return null;
    case "switchCostume":
      block = workspace.newBlock("looks_switch_costume");
      setField(block, "COSTUME", node.costumeId);
      return init(block);
    case "nextCostume":
      return init(workspace.newBlock("looks_next_costume"));
    case "playSound":
      block = workspace.newBlock(node.wait ? "sound_play_until_done" : "sound_play");
      setField(block, "SOUND", node.soundId);
      return init(block);
    case "stopAllSounds":
      return init(workspace.newBlock("sound_stop_all"));
    case "changeSoundEffect":
      block = workspace.newBlock("sound_change_effect");
      setField(block, "EFFECT", node.effect);
      setField(block, "AMOUNT", primitive(node.amount, 10));
      return init(block);
    case "setSoundEffect":
      block = workspace.newBlock("sound_set_effect");
      setField(block, "EFFECT", node.effect);
      setField(block, "VALUE", primitive(node.value, 0));
      return init(block);
    case "clearSoundEffects":
      return init(workspace.newBlock("sound_clear_effects"));
    case "changeVolume":
      block = workspace.newBlock("sound_change_volume");
      setField(block, "AMOUNT", primitive(node.amount, -10));
      return init(block);
    case "setVolume":
      block = workspace.newBlock("sound_set_volume");
      setField(block, "VOLUME", primitive(node.volume, 100));
      return init(block);
    case "setVariable":
    case "changeVariable":
      return null;
    case "listAdd":
      block = workspace.newBlock("list_add");
      setField(block, "LIST", node.list);
      return init(block);
    case "listDelete":
      block = workspace.newBlock(node.index === "all" ? "list_delete_all" : "list_delete");
      setField(block, "LIST", node.list);
      return init(block);
    case "listInsert":
      block = workspace.newBlock("list_insert");
      setField(block, "LIST", node.list);
      return init(block);
    case "listReplace":
      block = workspace.newBlock("list_replace");
      setField(block, "LIST", node.list);
      return init(block);
    case "showList":
      block = workspace.newBlock("list_show");
      setField(block, "LIST", node.list);
      return init(block);
    case "hideList":
      block = workspace.newBlock("list_hide");
      setField(block, "LIST", node.list);
      return init(block);
    case "wait":
      block = workspace.newBlock("control_wait");
      setField(block, "SECONDS", primitive(node.seconds, 1));
      return init(block);
    case "repeat":
      block = workspace.newBlock("control_repeat_times");
      setField(block, "TIMES", primitive(node.times, 3));
      init(block);
      connectStatements(block, "DO", node.body);
      return block;
      case "forever":
      block = init(workspace.newBlock("control_forever"));
      connectStatements(block, "DO", node.body);
      return block;
    case "repeatUntil":
      block = init(workspace.newBlock("control_repeat_until"));
      connectValue(block, "COND", createConditionBlock(workspace, node.condition));
      connectStatements(block, "DO", node.body);
      return block;
    case "waitUntil":
      block = init(workspace.newBlock("control_wait_until"));
      connectValue(block, "COND", createConditionBlock(workspace, node.condition));
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
    case "customCall":
      block = workspace.newBlock("custom_call");
      setField(block, "NAME", node.name);
      return init(block);
    case "aiIntent":
      block = workspace.newBlock("custom_call");
      setField(block, "NAME", node.prompt);
      return init(block);
  }

  return null;
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

export function programsToWorkspaceState(program: ScriptProgram, cloneProgram: ScriptProgram = [], broadcastPrograms: ScriptEventPrograms = {}, backdropPrograms: ScriptEventPrograms = {}) {
  const workspace = new Blockly.Workspace();

  const stacks: Array<{ hat: Blockly.Block; body: ScriptNode[] }> = [];
  for (const stack of program) {
    stacks.push({ hat: workspace.newBlock("event_start"), body: stack });
  }
  for (const stack of cloneProgram) {
    stacks.push({ hat: workspace.newBlock("event_clone_start"), body: stack });
  }
  for (const [message, stacksForMessage] of Object.entries(broadcastPrograms)) {
    for (const stack of stacksForMessage) {
      const hat = workspace.newBlock("event_when_broadcast");
      hat.setFieldValue(message, "MESSAGE");
      stacks.push({ hat, body: stack });
    }
  }
  for (const [backdropId, stacksForBackdrop] of Object.entries(backdropPrograms)) {
    for (const stack of stacksForBackdrop) {
      const hat = workspace.newBlock("event_when_backdrop");
      hat.setFieldValue(backdropId, "BACKDROP");
      stacks.push({ hat, body: stack });
    }
  }

  stacks.forEach(({ hat, body }, index) => {
    init(hat);
    hat.moveBy(260, 96 + index * 88);
    const first = createStatementStack(workspace, body);
    if (hat.nextConnection && first?.previousConnection) hat.nextConnection.connect(first.previousConnection);
  });

  return JSON.stringify(Blockly.serialization.workspaces.save(workspace));
}

export function insertAstUnderDefinition(definitionBlock: Blockly.Block, nodes: ScriptNode[]) {
  const first = createStatementStack(definitionBlock.workspace, nodes);

  if (definitionBlock.type === "procedures_defnoreturn") {
    const connection = definitionBlock.getInput("STACK")?.connection;
    connection?.targetBlock()?.dispose(false);
    if (first?.previousConnection && connection) {
      connection.connect(first.previousConnection);
    }
    (definitionBlock.workspace as Blockly.WorkspaceSvg).render();
    return;
  }

  const existing = definitionBlock.getNextBlock();
  existing?.dispose(false);

  if (first?.previousConnection && definitionBlock.nextConnection) {
    definitionBlock.nextConnection.connect(first.previousConnection);
  }

  (definitionBlock.workspace as Blockly.WorkspaceSvg).render();
}
