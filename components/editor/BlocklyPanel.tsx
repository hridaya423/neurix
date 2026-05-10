"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as BlocklyEn from "blockly/msg/en";
import { blocklyToAst, blocklyToPrograms, blockStackToAst } from "@/lib/compiler/blocklyToAst";
import type { ScriptEventPrograms, ScriptNode, ScriptProgram } from "@/lib/compiler/types";
import { insertAstUnderDefinition } from "@/lib/blockly/astToBlockly";

let customBlocksRegistered = false;
const customCallShapeSignatures = new WeakMap<Blockly.Block, string>();
const customDefinitionsByWorkspace = new WeakMap<Blockly.Workspace, CustomDefinitionData[]>();
const customDefinitionRepairTimers = new WeakMap<Blockly.Workspace, number[]>();

type BlocklyPanelProps = {
  activeSpriteId: string;
  activeSpriteName: string;
  targetType?: "sprite" | "stage";
  backdrops: { id: string; name: string }[];
  costumes?: { id: string; name: string }[];
  variableNames?: string[];
  cloudVariableNames?: string[];
  listNames?: string[];
  visibleWatcherNames?: string[];
  visibleListWatcherNames?: string[];
  workspaceState: string | null;
  onWorkspaceChange: (spriteId: string, workspaceState: string, program: ScriptProgram, cloneProgram: ScriptProgram, broadcastPrograms: ScriptEventPrograms, backdropPrograms: ScriptEventPrograms) => void;
  onVariableCreate?: (name: string) => void;
  onCloudVariableCreate?: (name: string) => void;
  onVariableWatcherToggle?: (name: string) => void;
  onListWatcherVisibleChange?: (name: string, visible: boolean) => void;
  onListCreate?: (name: string) => void;
};

type AiProcessResponse = {
  ast?: ScriptNode[];
  explanation?: string;
  error?: string;
};

type AiExplainResponse = {
  title?: string;
  summary?: string;
  steps?: string[];
  error?: string;
};

type AiAskResponse = {
  answer?: string;
  error?: string;
};

type CustomBlockArg = {
  id: string;
  name: string;
  kind: "value" | "boolean";
};

type CustomBlockPart = CustomBlockArg | {
  id: string;
  kind: "label";
  text: string;
};

type CustomDefinitionData = {
  name?: string;
  args?: CustomBlockArg[];
  parts?: CustomBlockPart[];
};

type VariableScope = "sprite" | "project" | "cloud";
type ListScope = "sprite" | "project";

function getCloudVariableName(name: string) {
  return `☁ ${name}`;
}

const KEY_OPTIONS = [
  ["space", " "], ["enter", "Enter"], ["tab", "Tab"], ["backspace", "Backspace"], ["escape", "Escape"],
  ["up arrow", "ArrowUp"], ["down arrow", "ArrowDown"], ["left arrow", "ArrowLeft"], ["right arrow", "ArrowRight"],
  ["shift", "Shift"], ["control", "Control"], ["alt", "Alt"], ["meta", "Meta"],
  ..."abcdefghijklmnopqrstuvwxyz".split("").map((key) => [key, key] as [string, string]),
  ..."0123456789".split("").map((key) => [key, key] as [string, string]),
  ["-", "-"], ["=", "="], ["[", "["], ["]", "]"], [";", ";"], ["'", "'"], [",", ","], [".", "."], ["/", "/"], ["\\", "\\"],
] satisfies [string, string][];

const backdropOptionsByWorkspace = new WeakMap<Blockly.Workspace, [string, string][]>();
const costumeOptionsByWorkspace = new WeakMap<Blockly.Workspace, [string, string][]>();
const listOptionsByWorkspace = new WeakMap<Blockly.Workspace, [string, string][]>();
const variableControlsByWorkspace = new WeakMap<Blockly.Workspace, {
  visibleNames: Set<string>;
  toggle: (name: string) => void;
}>();
const listControlsByWorkspace = new WeakMap<Blockly.Workspace, {
  visibleNames: Set<string>;
  setVisible: (name: string, visible: boolean) => void;
}>();

const CUSTOM_BLOCKS = [
  {
    type: "event_start",
    message0: "when start",
    nextStatement: null,
    style: "event_blocks",
    hat: "cap",
  },
  {
    type: "event_clone_start",
    message0: "when I start as a clone",
    nextStatement: null,
    style: "event_blocks",
    hat: "cap",
  },
  {
    type: "event_when_broadcast",
    message0: "when I receive %1",
    args0: [{ type: "field_input", name: "MESSAGE", text: "message1" }],
    nextStatement: null,
    style: "event_blocks",
    hat: "cap",
  },
  {
    type: "event_broadcast",
    message0: "broadcast %1",
    args0: [{ type: "field_input", name: "MESSAGE", text: "message1" }],
    previousStatement: null,
    nextStatement: null,
    style: "event_blocks",
  },
  {
    type: "event_broadcast_wait",
    message0: "broadcast %1 and wait",
    args0: [{ type: "field_input", name: "MESSAGE", text: "message1" }],
    previousStatement: null,
    nextStatement: null,
    style: "event_blocks",
  },
  {
    type: "event_when_backdrop",
    message0: "when backdrop switches to %1",
    args0: [{ type: "field_dropdown", name: "BACKDROP", options: [["Backdrop 1", "backdrop-1"]] }],
    nextStatement: null,
    style: "event_blocks",
    hat: "cap",
  },
  {
    type: "motion_move_steps",
    message0: "move %1 steps",
    args0: [
      { type: "field_number", name: "STEPS", value: 10 },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_move_value",
    message0: "move %1 steps",
    args0: [{ type: "input_value", name: "STEPS", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_turn_degrees",
    message0: "turn %1 degrees",
    args0: [
      { type: "field_number", name: "DEGREES", value: 15 },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_turn_value",
    message0: "turn %1 degrees",
    args0: [{ type: "input_value", name: "DEGREES", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_set_xy",
    message0: "go to x %1 y %2",
    args0: [
      { type: "field_number", name: "X", value: 0 },
      { type: "field_number", name: "Y", value: 0 },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_set_xy_value",
    message0: "go to x %1 y %2",
    args0: [
      { type: "input_value", name: "X", check: "Number" },
      { type: "input_value", name: "Y", check: "Number" },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_go_home",
    message0: "go to center",
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_change_x",
    message0: "change x by %1",
    args0: [{ type: "field_number", name: "DX", value: 10 }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_change_x_value",
    message0: "change x by %1",
    args0: [{ type: "input_value", name: "DX", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_set_x",
    message0: "set x to %1",
    args0: [{ type: "field_number", name: "X", value: 0 }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_set_x_value",
    message0: "set x to %1",
    args0: [{ type: "input_value", name: "X", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_change_y",
    message0: "change y by %1",
    args0: [{ type: "field_number", name: "DY", value: 10 }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_change_y_value",
    message0: "change y by %1",
    args0: [{ type: "input_value", name: "DY", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_set_y",
    message0: "set y to %1",
    args0: [{ type: "field_number", name: "Y", value: 0 }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_set_y_value",
    message0: "set y to %1",
    args0: [{ type: "input_value", name: "Y", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_point_direction",
    message0: "point in direction %1",
    args0: [{ type: "field_angle", name: "DIRECTION", angle: 90 }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_point_direction_value",
    message0: "point in direction %1",
    args0: [{ type: "input_value", name: "DIRECTION", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_if_on_edge_bounce",
    message0: "if on edge, bounce",
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  { type: "motion_go_to_mouse", message0: "go to mouse", previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_go_to_random", message0: "go to random position", previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_point_toward_mouse", message0: "point toward mouse", previousStatement: null, nextStatement: null, style: "motion_blocks" },
  { type: "motion_point_toward_center", message0: "point toward center", previousStatement: null, nextStatement: null, style: "motion_blocks" },
  {
    type: "motion_glide_xy",
    message0: "glide %1 sec to x %2 y %3",
    args0: [
      { type: "input_value", name: "SECONDS", check: "Number" },
      { type: "input_value", name: "X", check: "Number" },
      { type: "input_value", name: "Y", check: "Number" },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "motion_glide_mouse",
    message0: "glide %1 sec to mouse",
    args0: [{ type: "input_value", name: "SECONDS", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  { type: "motion_x_position", message0: "x position", output: "Number", style: "motion_blocks" },
  { type: "motion_y_position", message0: "y position", output: "Number", style: "motion_blocks" },
  { type: "motion_direction_reporter", message0: "direction", output: "Number", style: "motion_blocks" },
  {
    type: "looks_say",
    message0: "say %1",
    args0: [
      { type: "field_input", name: "TEXT", text: "Hello" },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_say_value",
    message0: "say %1",
    args0: [{ type: "input_value", name: "TEXT" }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_say_for_seconds",
    message0: "say %1 for %2 seconds",
    args0: [
      { type: "field_input", name: "TEXT", text: "Hello" },
      { type: "field_number", name: "SECONDS", value: 2, min: 0 },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_say_value_for_seconds",
    message0: "say %1 for %2 seconds",
    args0: [
      { type: "input_value", name: "TEXT" },
      { type: "input_value", name: "SECONDS", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_think",
    message0: "think %1",
    args0: [{ type: "field_input", name: "TEXT", text: "Hmm" }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_think_value",
    message0: "think %1",
    args0: [{ type: "input_value", name: "TEXT" }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_think_for_seconds",
    message0: "think %1 for %2 seconds",
    args0: [
      { type: "field_input", name: "TEXT", text: "Hmm" },
      { type: "field_number", name: "SECONDS", value: 2, min: 0 },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_clear_speech",
    message0: "clear speech",
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_change_size",
    message0: "change size by %1",
    args0: [{ type: "field_number", name: "AMOUNT", value: 10 }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_change_size_value",
    message0: "change size by %1",
    args0: [{ type: "input_value", name: "AMOUNT", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_set_size",
    message0: "set size to %1 %",
    args0: [{ type: "field_number", name: "SIZE", value: 100, min: 1 }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_set_size_value",
    message0: "set size to %1 %",
    args0: [{ type: "input_value", name: "SIZE", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_show",
    message0: "show",
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_hide",
    message0: "hide",
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_go_to_layer",
    message0: "go to %1 layer",
    args0: [{ type: "field_dropdown", name: "LAYER", options: [["front", "front"], ["back", "back"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_change_layer",
    message0: "go %1 %2 layers",
    args0: [
      { type: "field_dropdown", name: "DIRECTION", options: [["forward", "forward"], ["backward", "backward"]] },
      { type: "input_value", name: "AMOUNT", check: "Number" },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_switch_backdrop",
    message0: "switch backdrop to %1",
    args0: [{ type: "field_dropdown", name: "BACKDROP", options: [["Backdrop 1", "backdrop-1"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_next_backdrop",
    message0: "next backdrop",
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  { type: "looks_backdrop_name", message0: "backdrop name", output: "String", style: "looks_blocks" },
  { type: "looks_backdrop_number", message0: "backdrop number", output: "Number", style: "looks_blocks" },
  {
    type: "looks_switch_costume",
    message0: "switch costume to %1",
    args0: [{ type: "field_dropdown", name: "COSTUME", options: [["Costume 1", "costume-1"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_next_costume",
    message0: "next costume",
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  { type: "looks_costume_name", message0: "costume name", output: "String", style: "looks_blocks" },
  { type: "looks_costume_number", message0: "costume number", output: "Number", style: "looks_blocks" },
  { type: "looks_size_reporter", message0: "size", output: "Number", style: "looks_blocks" },
  {
    type: "looks_set_tone",
    message0: "set color to %1",
    args0: [{ type: "field_colour", name: "TONE", colour: "#56CBF9" }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "looks_change_tone",
    message0: "change color by %1",
    args0: [{ type: "input_value", name: "AMOUNT", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "looks_blocks",
  },
  {
    type: "control_wait",
    message0: "wait %1 sec",
    args0: [
      { type: "field_number", name: "SECONDS", value: 1, min: 0 },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_wait_value",
    message0: "wait %1 sec",
    args0: [{ type: "input_value", name: "SECONDS", check: "Number" }],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_repeat_times",
    message0: "repeat %1 times",
    args0: [
      { type: "field_number", name: "TIMES", value: 3, min: 1, precision: 1 },
    ],
    message1: "do %1",
    args1: [
      { type: "input_statement", name: "DO" },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_repeat_value",
    message0: "repeat %1 times",
    args0: [{ type: "input_value", name: "TIMES", check: "Number" }],
    message1: "do %1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_repeat_until",
    message0: "repeat until %1",
    args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
    message1: "do %1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_wait_until",
    message0: "wait until %1",
    args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_create_clone",
    message0: "create clone of myself",
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_delete_clone",
    message0: "delete this clone",
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_forever",
    message0: "forever",
    message1: "do %1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_if",
    message0: "if %1 then",
    args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
    message1: "do %1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "control_if_else",
    message0: "if %1 then",
    args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
    message1: "do %1",
    args1: [{ type: "input_statement", name: "DO" }],
    message2: "else %1",
    args2: [{ type: "input_statement", name: "ELSE" }],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
  {
    type: "sensing_key_pressed",
    message0: "key %1 pressed?",
    args0: [
      {
        type: "field_dropdown",
        name: "KEY",
          options: KEY_OPTIONS,
      },
    ],
    output: "Boolean",
    style: "sensing_blocks",
  },
  {
    type: "sensing_touching_edge",
    message0: "touching edge?",
    output: "Boolean",
    style: "sensing_blocks",
  },
  { type: "sensing_mouse_down", message0: "mouse down?", output: "Boolean", style: "sensing_blocks" },
  { type: "sensing_any_key_pressed", message0: "any key pressed?", output: "Boolean", style: "sensing_blocks" },
  { type: "sensing_mouse_x", message0: "mouse x", output: "Number", style: "sensing_blocks" },
  { type: "sensing_mouse_y", message0: "mouse y", output: "Number", style: "sensing_blocks" },
  { type: "sensing_timer", message0: "timer", output: "Number", style: "sensing_blocks" },
  { type: "sensing_distance_to_center", message0: "distance to center", output: "Number", style: "sensing_blocks" },
  { type: "sensing_last_key", message0: "last key", output: "String", style: "sensing_blocks" },
  {
    type: "sensing_current_time",
    message0: "current %1",
    args0: [{ type: "field_dropdown", name: "UNIT", options: [["second", "SECOND"], ["minute", "MINUTE"], ["hour", "HOUR"]] }],
    output: "Number",
    style: "sensing_blocks",
  },
  {
    type: "operator_compare_numbers",
    message0: "%1 %2 %3",
    args0: [
      { type: "field_number", name: "LEFT", value: 1 },
      {
        type: "field_dropdown",
        name: "OPERATOR",
        options: [["=", "="], ["<", "<"], [">", ">"]],
      },
      { type: "field_number", name: "RIGHT", value: 1 },
    ],
    inputsInline: true,
    output: "Boolean",
    style: "operators_blocks",
  },
  {
    type: "operator_compare_values",
    message0: "%1 %2 %3",
    args0: [
      { type: "input_value", name: "LEFT" },
      { type: "field_dropdown", name: "OPERATOR", options: [["=", "="], ["<", "<"], [">", ">"], ["≤", "≤"], ["≥", "≥"], ["≠", "≠"]] },
      { type: "input_value", name: "RIGHT" },
    ],
    inputsInline: true,
    output: "Boolean",
    style: "operators_blocks",
  },
  {
    type: "operator_join",
    message0: "join %1 %2",
    args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }],
    inputsInline: true,
    output: "String",
    style: "operators_blocks",
  },
  {
    type: "operator_contains",
    message0: "%1 contains %2?",
    args0: [{ type: "input_value", name: "TEXT" }, { type: "input_value", name: "SEARCH" }],
    inputsInline: true,
    output: "Boolean",
    style: "operators_blocks",
  },
  {
    type: "operator_and",
    message0: "%1 and %2",
    args0: [
      { type: "input_value", name: "LEFT", check: "Boolean" },
      { type: "input_value", name: "RIGHT", check: "Boolean" },
    ],
    inputsInline: true,
    output: "Boolean",
    style: "operators_blocks",
  },
  {
    type: "operator_or",
    message0: "%1 or %2",
    args0: [
      { type: "input_value", name: "LEFT", check: "Boolean" },
      { type: "input_value", name: "RIGHT", check: "Boolean" },
    ],
    inputsInline: true,
    output: "Boolean",
    style: "operators_blocks",
  },
  {
    type: "operator_not",
    message0: "not %1",
    args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
    inputsInline: true,
    output: "Boolean",
    style: "operators_blocks",
  },
  {
    type: "list_add",
    message0: "add %1 to %2",
    args0: [{ type: "input_value", name: "ITEM" }, { type: "field_dropdown", name: "LIST", options: [["list", "list"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "list_blocks",
  },
  {
    type: "list_delete",
    message0: "delete %1 of %2",
    args0: [{ type: "input_value", name: "INDEX" }, { type: "field_dropdown", name: "LIST", options: [["list", "list"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "list_blocks",
  },
  {
    type: "list_delete_all",
    message0: "delete all of %1",
    args0: [{ type: "field_dropdown", name: "LIST", options: [["list", "list"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "list_blocks",
  },
  {
    type: "list_insert",
    message0: "insert %1 at %2 of %3",
    args0: [{ type: "input_value", name: "ITEM" }, { type: "input_value", name: "INDEX" }, { type: "field_dropdown", name: "LIST", options: [["list", "list"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "list_blocks",
  },
  {
    type: "list_replace",
    message0: "replace item %1 of %2 with %3",
    args0: [{ type: "input_value", name: "INDEX" }, { type: "field_dropdown", name: "LIST", options: [["list", "list"]] }, { type: "input_value", name: "ITEM" }],
    previousStatement: null,
    nextStatement: null,
    style: "list_blocks",
  },
  {
    type: "list_item",
    message0: "item %1 of %2",
    args0: [{ type: "input_value", name: "INDEX" }, { type: "field_dropdown", name: "LIST", options: [["list", "list"]] }],
    output: null,
    style: "list_blocks",
  },
  {
    type: "list_index",
    message0: "item # of %1 in %2",
    args0: [{ type: "input_value", name: "ITEM" }, { type: "field_dropdown", name: "LIST", options: [["list", "list"]] }],
    output: "Number",
    style: "list_blocks",
  },
  {
    type: "list_length",
    message0: "length of %1",
    args0: [{ type: "field_dropdown", name: "LIST", options: [["list", "list"]] }],
    output: "Number",
    style: "list_blocks",
  },
  {
    type: "list_contains",
    message0: "%1 contains %2?",
    args0: [{ type: "field_dropdown", name: "LIST", options: [["list", "list"]] }, { type: "input_value", name: "ITEM" }],
    output: "Boolean",
    style: "list_blocks",
  },
  {
    type: "list_show",
    message0: "show list %1",
    args0: [{ type: "field_dropdown", name: "LIST", options: [["list", "list"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "list_blocks",
  },
  {
    type: "list_hide",
    message0: "hide list %1",
    args0: [{ type: "field_dropdown", name: "LIST", options: [["list", "list"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "list_blocks",
  },
  {
    type: "ai_define",
    message0: "define %1",
    args0: [
      { type: "field_input", name: "PROMPT", text: "full movement" },
    ],
    nextStatement: null,
    style: "custom_blocks",
    hat: "cap",
  },
  {
    type: "ai_use",
    message0: "run %1",
    args0: [
      { type: "field_input", name: "PROMPT", text: "full movement" },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "custom_blocks",
  },
];

const TOOLBOX: Blockly.utils.toolbox.ToolboxInfo = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Events",
      categorystyle: "event_category",
      contents: [
        { kind: "block", type: "event_start" },
        { kind: "block", type: "event_when_broadcast" },
        { kind: "block", type: "event_broadcast" },
        { kind: "block", type: "event_broadcast_wait" },
        { kind: "block", type: "event_when_backdrop" },
        { kind: "block", type: "event_clone_start" },
      ],
    },
    {
      kind: "category",
      name: "Motion",
      categorystyle: "motion_category",
      contents: [
        { kind: "block", type: "motion_move_value", inputs: { STEPS: { shadow: { type: "math_number", fields: { NUM: 10 } } } } },
        { kind: "block", type: "motion_turn_value", inputs: { DEGREES: { shadow: { type: "math_number", fields: { NUM: 15 } } } } },
        { kind: "block", type: "motion_set_xy_value", inputs: { X: { shadow: { type: "math_number", fields: { NUM: 0 } } }, Y: { shadow: { type: "math_number", fields: { NUM: 0 } } } } },
        { kind: "block", type: "motion_go_home" },
        { kind: "block", type: "motion_change_x_value", inputs: { DX: { shadow: { type: "math_number", fields: { NUM: 10 } } } } },
        { kind: "block", type: "motion_set_x_value", inputs: { X: { shadow: { type: "math_number", fields: { NUM: 0 } } } } },
        { kind: "block", type: "motion_change_y_value", inputs: { DY: { shadow: { type: "math_number", fields: { NUM: 10 } } } } },
        { kind: "block", type: "motion_set_y_value", inputs: { Y: { shadow: { type: "math_number", fields: { NUM: 0 } } } } },
        { kind: "block", type: "motion_point_direction_value", inputs: { DIRECTION: { shadow: { type: "math_number", fields: { NUM: 90 } } } } },
        { kind: "block", type: "motion_point_toward_mouse" },
        { kind: "block", type: "motion_point_toward_center" },
        { kind: "block", type: "motion_if_on_edge_bounce" },
        { kind: "block", type: "motion_go_to_mouse" },
        { kind: "block", type: "motion_go_to_random" },
        { kind: "block", type: "motion_glide_xy", inputs: { SECONDS: { shadow: { type: "math_number", fields: { NUM: 1 } } }, X: { shadow: { type: "math_number", fields: { NUM: 0 } } }, Y: { shadow: { type: "math_number", fields: { NUM: 0 } } } } },
        { kind: "block", type: "motion_glide_mouse", inputs: { SECONDS: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
        { kind: "block", type: "motion_x_position" },
        { kind: "block", type: "motion_y_position" },
        { kind: "block", type: "motion_direction_reporter" },
      ],
    },
    {
      kind: "category",
      name: "Looks",
      categorystyle: "looks_category",
      contents: [
        { kind: "block", type: "looks_say_value", inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "Hello" } } } } },
        { kind: "block", type: "looks_say_value_for_seconds", inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "Hello" } } }, SECONDS: { shadow: { type: "math_number", fields: { NUM: 2 } } } } },
        { kind: "block", type: "looks_clear_speech" },
        { kind: "block", type: "looks_change_size_value", inputs: { AMOUNT: { shadow: { type: "math_number", fields: { NUM: 10 } } } } },
        { kind: "block", type: "looks_set_size_value", inputs: { SIZE: { shadow: { type: "math_number", fields: { NUM: 100 } } } } },
        { kind: "block", type: "looks_set_tone" },
        { kind: "block", type: "looks_change_tone", inputs: { AMOUNT: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
        { kind: "block", type: "looks_show" },
        { kind: "block", type: "looks_hide" },
        { kind: "block", type: "looks_go_to_layer" },
        { kind: "block", type: "looks_change_layer", inputs: { AMOUNT: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
        { kind: "block", type: "looks_switch_costume" },
        { kind: "block", type: "looks_next_costume" },
        { kind: "block", type: "looks_costume_name" },
        { kind: "block", type: "looks_costume_number" },
        { kind: "block", type: "looks_switch_backdrop" },
        { kind: "block", type: "looks_next_backdrop" },
        { kind: "block", type: "looks_backdrop_name" },
        { kind: "block", type: "looks_backdrop_number" },
        { kind: "block", type: "looks_size_reporter" },
      ],
    },
    {
      kind: "category",
      name: "Control",
      categorystyle: "control_category",
      contents: [
        { kind: "block", type: "control_wait_value", inputs: { SECONDS: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
        { kind: "block", type: "control_repeat_value", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 3 } } } } },
        { kind: "block", type: "control_repeat_until" },
        { kind: "block", type: "control_wait_until" },
        { kind: "block", type: "control_create_clone" },
        { kind: "block", type: "control_delete_clone" },
        { kind: "block", type: "control_forever" },
        { kind: "block", type: "control_if" },
        { kind: "block", type: "control_if_else" },
      ],
    },
    {
      kind: "category",
      name: "Sensing",
      categorystyle: "sensing_category",
      contents: [
        { kind: "block", type: "sensing_key_pressed" },
        { kind: "block", type: "sensing_touching_edge" },
        { kind: "block", type: "sensing_mouse_down" },
        { kind: "block", type: "sensing_any_key_pressed" },
        { kind: "block", type: "sensing_mouse_x" },
        { kind: "block", type: "sensing_mouse_y" },
        { kind: "block", type: "sensing_timer" },
        { kind: "block", type: "sensing_distance_to_center" },
        { kind: "block", type: "sensing_last_key" },
        { kind: "block", type: "sensing_current_time" },
      ],
    },
    {
      kind: "category",
      name: "Custom",
      categorystyle: "custom_category",
      custom: "CUSTOM_BLOCKS",
    },
    {
      kind: "category",
      name: "Variables",
      categorystyle: "variables_category",
      custom: "NEURIX_VARIABLES",
    },
    {
      kind: "category",
      name: "Lists",
      categorystyle: "lists_category",
      custom: "NEURIX_LISTS",
    },
    {
      kind: "category",
      name: "Operators",
      categorystyle: "operators_category",
      contents: [
        { kind: "block", type: "logic_boolean" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
      ],
    },
    {
      kind: "category",
      name: "Math",
      categorystyle: "math_category",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "math_random_int" },
        { kind: "block", type: "math_round" },
        { kind: "block", type: "math_modulo" },
        { kind: "block", type: "math_single" },
        { kind: "block", type: "math_trig" },
      ],
    },
    {
      kind: "category",
      name: "Text",
      categorystyle: "text_category",
      contents: [
        { kind: "block", type: "text" },
        { kind: "block", type: "operator_join" },
        { kind: "block", type: "operator_contains" },
        { kind: "block", type: "text_length" },
        { kind: "block", type: "text_charAt" },
      ],
    },
  ],
};

const STAGE_TOOLBOX: Blockly.utils.toolbox.ToolboxInfo = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Events",
      categorystyle: "event_category",
      contents: [
        { kind: "block", type: "event_start" },
        { kind: "block", type: "event_when_broadcast" },
        { kind: "block", type: "event_broadcast" },
        { kind: "block", type: "event_broadcast_wait" },
        { kind: "block", type: "event_when_backdrop" },
      ],
    },
    {
      kind: "category",
      name: "Looks",
      categorystyle: "looks_category",
      contents: [
        { kind: "block", type: "looks_switch_backdrop" },
        { kind: "block", type: "looks_next_backdrop" },
        { kind: "block", type: "looks_backdrop_name" },
        { kind: "block", type: "looks_backdrop_number" },
      ],
    },
    {
      kind: "category",
      name: "Control",
      categorystyle: "control_category",
      contents: [
        { kind: "block", type: "control_wait_value", inputs: { SECONDS: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
        { kind: "block", type: "control_repeat_value", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 3 } } } } },
        { kind: "block", type: "control_repeat_until" },
        { kind: "block", type: "control_wait_until" },
        { kind: "block", type: "control_forever" },
        { kind: "block", type: "control_if" },
        { kind: "block", type: "control_if_else" },
      ],
    },
    {
      kind: "category",
      name: "Sensing",
      categorystyle: "sensing_category",
      contents: [
        { kind: "block", type: "sensing_key_pressed" },
        { kind: "block", type: "sensing_mouse_down" },
        { kind: "block", type: "sensing_any_key_pressed" },
        { kind: "block", type: "sensing_mouse_x" },
        { kind: "block", type: "sensing_mouse_y" },
        { kind: "block", type: "sensing_timer" },
        { kind: "block", type: "sensing_last_key" },
        { kind: "block", type: "sensing_current_time" },
      ],
    },
    {
      kind: "category",
      name: "Custom",
      categorystyle: "custom_category",
      custom: "CUSTOM_BLOCKS",
    },
    {
      kind: "category",
      name: "Variables",
      categorystyle: "variables_category",
      custom: "NEURIX_VARIABLES",
    },
    {
      kind: "category",
      name: "Lists",
      categorystyle: "lists_category",
      custom: "NEURIX_LISTS",
    },
    {
      kind: "category",
      name: "Operators",
      categorystyle: "operators_category",
      contents: [
        { kind: "block", type: "logic_boolean" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
      ],
    },
    {
      kind: "category",
      name: "Math",
      categorystyle: "math_category",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "math_random_int" },
        { kind: "block", type: "math_round" },
        { kind: "block", type: "math_modulo" },
        { kind: "block", type: "math_single" },
        { kind: "block", type: "math_trig" },
      ],
    },
    {
      kind: "category",
      name: "Text",
      categorystyle: "text_category",
      contents: [
        { kind: "block", type: "text" },
        { kind: "block", type: "operator_join" },
        { kind: "block", type: "operator_contains" },
        { kind: "block", type: "text_length" },
        { kind: "block", type: "text_charAt" },
      ],
    },
  ],
};

const THEME = Blockly.Theme.defineTheme("neurix_light", {
  name: "neurix_light",
  base: Blockly.Themes.Zelos,
  blockStyles: {
    event_blocks: {
      colourPrimary: "#38BDF8",
      colourSecondary: "#0EA5E9",
      colourTertiary: "#0284C7",
      hat: "cap",
    },
    motion_blocks: {
      colourPrimary: "#34D399",
      colourSecondary: "#10B981",
      colourTertiary: "#059669",
    },
    looks_blocks: {
      colourPrimary: "#A78BFA",
      colourSecondary: "#8B5CF6",
      colourTertiary: "#7C3AED",
    },
    control_blocks: {
      colourPrimary: "#F472B6",
      colourSecondary: "#EC4899",
      colourTertiary: "#DB2777",
    },
    operators_blocks: {
      colourPrimary: "#FBBF24",
      colourSecondary: "#F59E0B",
      colourTertiary: "#D97706",
    },
    sensing_blocks: {
      colourPrimary: "#22C55E",
      colourSecondary: "#16A34A",
      colourTertiary: "#15803D",
    },
    custom_blocks: {
      colourPrimary: "#56CBF9",
      colourSecondary: "#7FBEEB",
      colourTertiary: "#2BAED9",
    },
    list_blocks: {
      colourPrimary: "#FF8C42",
      colourSecondary: "#E86F1D",
      colourTertiary: "#C85A14",
    },
    procedure_blocks: {
      colourPrimary: "#56CBF9",
      colourSecondary: "#7FBEEB",
      colourTertiary: "#2BAED9",
    },
  },
  categoryStyles: {
    event_category: { colour: "#38BDF8" },
    motion_category: { colour: "#34D399" },
    looks_category: { colour: "#A78BFA" },
    control_category: { colour: "#F472B6" },
    sensing_category: { colour: "#22C55E" },
    operators_category: { colour: "#FBBF24" },
    custom_category: { colour: "#56CBF9" },
    variables_category: { colour: "#FF8C42" },
    lists_category: { colour: "#FF8C42" },
    math_category: { colour: "#F59E0B" },
    text_category: { colour: "#06B6D4" },
  },
  componentStyles: {
    workspaceBackgroundColour: "transparent",
    toolboxBackgroundColour: "#fafafc",
    toolboxForegroundColour: "#6e6e73",
    flyoutBackgroundColour: "#f5f5f7",
    flyoutForegroundColour: "#6e6e73",
    flyoutOpacity: 1,
    scrollbarColour: "rgba(0, 0, 0, 0.06)",
    insertionMarkerColour: "#38BDF8",
    insertionMarkerOpacity: 0.2,
  },
  fontStyle: {
    family: "var(--font-geist-sans), sans-serif",
    size: 13,
    weight: "600",
  },
});

function seedWorkspace(workspace: Blockly.WorkspaceSvg) {
  const eventBlock = workspace.newBlock("event_start");
  eventBlock.initSvg();
  eventBlock.render();
  eventBlock.moveBy(260, 100);

  const moveBlock = workspace.newBlock("motion_move_steps");
  moveBlock.initSvg();
  moveBlock.render();

  if (eventBlock.nextConnection && moveBlock.previousConnection) {
    eventBlock.nextConnection.connect(moveBlock.previousConnection);
  }
}

type SerializedBlockState = {
  type?: string;
  inputs?: Record<string, unknown>;
  next?: { block?: unknown };
  block?: unknown;
  shadow?: unknown;
};

function stripCustomDefinitionArgumentInputs(blockState: unknown) {
  if (!blockState || typeof blockState !== "object") return;
  const state = blockState as SerializedBlockState;
  if (state.type === "custom_define" && state.inputs && typeof state.inputs === "object") {
    for (const inputName of Object.keys(state.inputs)) {
      if (/^DEFARG\d+$/.test(inputName)) delete state.inputs[inputName];
    }
  }

  if (state.inputs && typeof state.inputs === "object") {
    for (const input of Object.values(state.inputs)) {
      if (!input || typeof input !== "object") continue;
      const item = input as SerializedBlockState;
      stripCustomDefinitionArgumentInputs(item.block);
      stripCustomDefinitionArgumentInputs(item.shadow);
    }
  }
  stripCustomDefinitionArgumentInputs(state.next?.block);
}

function stripCustomDefinitionArgumentInputsFromWorkspaceState(state: Record<string, unknown>) {
  const blocks = state.blocks;
  if (!blocks || typeof blocks !== "object") return;
  const blockList = (blocks as { blocks?: unknown }).blocks;
  if (Array.isArray(blockList)) {
    for (const block of blockList) stripCustomDefinitionArgumentInputs(block);
  }
}

function saveWorkspace(workspace: Blockly.WorkspaceSvg) {
  rememberCustomDefinitions(workspace);
  const state = Blockly.serialization.workspaces.save(workspace) as Record<string, unknown>;
  stripCustomDefinitionArgumentInputsFromWorkspaceState(state);
  state.neurixCustomDefinitions = getWorkspaceCustomDefinitions(workspace);
  return JSON.stringify(state);
}

function loadWorkspace(workspace: Blockly.WorkspaceSvg, state: string | null) {
  workspace.clear();
  if (!state) {
    seedWorkspace(workspace);
    return;
  }

  try {
    const parsed = JSON.parse(state) as Record<string, unknown>;
    setWorkspaceCustomDefinitions(workspace, Array.isArray(parsed.neurixCustomDefinitions) ? parsed.neurixCustomDefinitions : []);
    stripCustomDefinitionArgumentInputsFromWorkspaceState(parsed);
    Blockly.serialization.workspaces.load(parsed, workspace);
    rememberCustomDefinitions(workspace);
  } catch {
    seedWorkspace(workspace);
  }
}

function getDefinitionWorkspace(workspace: Blockly.Workspace) {
  return (workspace as Blockly.WorkspaceSvg).targetWorkspace ?? workspace;
}

function normalizeCustomDefinitionName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeCustomName(name: string) {
  return normalizeCustomDefinitionName(name).toLowerCase();
}

function cleanCustomDefinitionParts(parts: unknown): CustomBlockPart[] {
  if (!Array.isArray(parts)) return [];
  return parts.reduce<CustomBlockPart[]>((cleanParts, part, index) => {
    if (!part || typeof part !== "object") return cleanParts;
    const item = part as Partial<CustomBlockPart>;
    if (item.kind === "label") {
      const text = String(item.text ?? "").trim().replace(/\s+/g, " ");
      if (text) cleanParts.push({ id: String(item.id ?? `label-${index}`), kind: "label", text });
      return cleanParts;
    }
    if (item.kind === "boolean" || item.kind === "value") {
      cleanParts.push({
        id: String(item.id ?? `arg-${index}`),
        kind: item.kind,
        name: String(item.name ?? `input${index + 1}`).trim().replace(/\s+/g, " ") || `input${index + 1}`,
      });
    }
    return cleanParts;
  }, []);
}

function cleanCustomDefinitionData(definition: unknown): CustomDefinitionData | null {
  if (!definition || typeof definition !== "object") return null;
  const item = definition as CustomDefinitionData;
  const name = normalizeCustomDefinitionName(String(item.name ?? ""));
  if (!name) return null;
  const parts = cleanCustomDefinitionParts(item.parts);
  return { name, args: parts.filter(isCustomInputPart), parts };
}

function getWorkspaceCustomDefinitions(workspace: Blockly.Workspace) {
  return customDefinitionsByWorkspace.get(getDefinitionWorkspace(workspace)) ?? [];
}

function setWorkspaceCustomDefinitions(workspace: Blockly.Workspace, definitions: unknown[]) {
  const cleanDefinitions: CustomDefinitionData[] = [];
  for (const definition of definitions) {
    const cleanDefinition = cleanCustomDefinitionData(definition);
    if (!cleanDefinition) continue;
    const key = normalizeCustomName(cleanDefinition.name ?? "");
    if (!key || cleanDefinitions.some((item) => normalizeCustomName(item.name ?? "") === key)) continue;
    cleanDefinitions.push(cleanDefinition);
  }
  customDefinitionsByWorkspace.set(getDefinitionWorkspace(workspace), cleanDefinitions);
}

function getWorkspaceCustomDefinition(workspace: Blockly.Workspace, name: string) {
  const key = normalizeCustomName(name);
  return getWorkspaceCustomDefinitions(workspace).find((definition) => normalizeCustomName(definition.name ?? "") === key) ?? null;
}

function upsertWorkspaceCustomDefinition(workspace: Blockly.Workspace, name: string, parts: CustomBlockPart[]) {
  const cleanName = normalizeCustomDefinitionName(name) || "block name";
  const definition: CustomDefinitionData = { name: cleanName, args: parts.filter(isCustomInputPart), parts };
  const key = normalizeCustomName(cleanName);
  customDefinitionsByWorkspace.set(
    getDefinitionWorkspace(workspace),
    [definition, ...getWorkspaceCustomDefinitions(workspace).filter((item) => normalizeCustomName(item.name ?? "") !== key)],
  );
}

function removeWorkspaceCustomDefinition(workspace: Blockly.Workspace, name: string) {
  const key = normalizeCustomName(name);
  customDefinitionsByWorkspace.set(
    getDefinitionWorkspace(workspace),
    getWorkspaceCustomDefinitions(workspace).filter((item) => normalizeCustomName(item.name ?? "") !== key),
  );
}

function rememberCustomDefinitions(workspace: Blockly.Workspace) {
  for (const block of getDefinitionWorkspace(workspace).getTopBlocks(false)) {
    if (!isCustomDefinitionBlock(block)) continue;
    const name = getCustomBlockName(block).trim();
    if (!name) continue;
    upsertWorkspaceCustomDefinition(workspace, name, getCustomDefinitionParts(block));
  }
}

function getCustomBlockNames(workspace: Blockly.Workspace) {
  const names: string[] = [];
  const definitionWorkspace = getDefinitionWorkspace(workspace);
  for (const definition of getWorkspaceCustomDefinitions(definitionWorkspace)) {
    const name = String(definition.name ?? "").trim();
    if (name && !names.includes(name)) names.push(name);
  }
  for (const block of definitionWorkspace.getTopBlocks(false)) {
    if (block.type === "custom_define" || block.type === "ai_define" || block.type === "procedures_defnoreturn") {
      const name = getCustomBlockName(block).trim();
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names.sort();
}

function readCustomDefinitionData(block: Blockly.Block | null): CustomDefinitionData {
  if (!block) return {};

  try {
    const data = (block as Blockly.Block & { data?: string | null }).data;
    return data ? JSON.parse(data) as CustomDefinitionData : {};
  } catch {
    return {};
  }
}

function getCustomDefinitionBlock(workspace: Blockly.Workspace, name: string) {
  const targetWorkspace = (workspace as Blockly.WorkspaceSvg).targetWorkspace;
  const definitionWorkspace = targetWorkspace ?? workspace;
  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, " ");
  return definitionWorkspace.getTopBlocks(false).find((block) => isCustomDefinitionBlock(block) && getCustomBlockName(block).trim().toLowerCase().replace(/\s+/g, " ") === normalizedName) ?? null;
}

function isCustomInputPart(part: CustomBlockPart): part is CustomBlockArg {
  return part.kind === "value" || part.kind === "boolean";
}

function getCustomDefinitionParts(block: Blockly.Block | null): CustomBlockPart[] {
  if (!block) return [];

  const data = readCustomDefinitionData(block);
  const stored = {
    args: Array.isArray(data.args) ? data.args : [],
    parts: Array.isArray(data.parts) ? data.parts : [],
  };

  if (stored.parts.length > 0) return stored.parts;

  const procedure = block as unknown as Partial<{ getProcedureDef: () => [string, string[], boolean] }>;
  const names = procedure.getProcedureDef?.()[1] ?? stored.args.map((arg) => arg.name);
  return names.map((name, index) => {
    const storedArg = stored.args.find((arg) => arg.name === name) ?? stored.args[index];
    return {
      id: storedArg?.id ?? `arg-${index}`,
      name,
      kind: storedArg?.kind === "boolean" ? "boolean" : "value",
    };
  });
}

function setCustomDefinitionData(block: Blockly.Block, name: string, parts: CustomBlockPart[]) {
  (block as Blockly.Block & { data?: string }).data = JSON.stringify({
    name,
    args: parts.filter(isCustomInputPart),
    parts,
  });
}

function attachCustomArgumentReporter(definitionBlock: Blockly.Block, input: Blockly.Input, part: CustomBlockArg) {
  const connection = input.connection;
  if (!connection) return;

  const reporter = definitionBlock.workspace.newBlock(part.kind === "boolean" ? "custom_arg_boolean" : "custom_arg_value") as Blockly.BlockSvg;
  reporter.setShadow((definitionBlock as Blockly.BlockSvg & { isInFlyout?: boolean }).isInFlyout === true);
  reporter.getField("NAME")?.setValue(part.kind === "boolean" ? `  ${part.name}  ` : part.name);
  reporter.initSvg();
  reporter.render();
  connection.connect(reporter.outputConnection);
}

function isBlocklyFlyoutBlock(block: Blockly.Block) {
  return (block as Blockly.BlockSvg & { isInFlyout?: boolean }).isInFlyout === true;
}

function updateCustomDefinitionShape(block: Blockly.Block) {
  if (block.type !== "custom_define") return;
  const name = getCustomBlockName(block) || "block name";
  const parts = getCustomDefinitionParts(block);

  for (const input of [...block.inputList]) {
    if (input.name === "HEADER" || /^(DEFARG|DEFPART)\d+$/.test(input.name)) {
      if (/^DEFARG\d+$/.test(input.name)) input.connection?.targetBlock()?.dispose(false);
      block.removeInput(input.name, true);
    }
  }

  block.appendDummyInput("HEADER")
    .appendField("define")
    .appendField(name);

  parts.forEach((part, index) => {
    if (!isCustomInputPart(part)) {
      block.appendDummyInput(`DEFPART${index}`).appendField(part.text);
      return;
    }

    const input = block.appendValueInput(`DEFARG${index}`);
    if (part.kind === "boolean") input.setCheck("Boolean");
    attachCustomArgumentReporter(block, input, part);
  });

  setCustomDefinitionData(block, name, parts);

  block.setInputsInline(true);
  if ((block as Blockly.BlockSvg).rendered) {
    (block as Blockly.BlockSvg).render();
  }
}

function repairCustomDefinitionArgumentReporters(block: Blockly.Block) {
  if (block.type !== "custom_define") return;
  const isFlyoutBlock = isBlocklyFlyoutBlock(block);
  const parts = getCustomDefinitionParts(block);
  parts.forEach((part, index) => {
    if (!isCustomInputPart(part)) return;
    const input = block.getInput(`DEFARG${index}`);
    if (!input?.connection) return;
    const targetBlock = input.connection.targetBlock();
    if (targetBlock) {
      if (!isFlyoutBlock && typeof targetBlock.setShadow === "function") targetBlock.setShadow(false);
      return;
    }
    attachCustomArgumentReporter(block, input, part);
  });
  if ((block as Blockly.BlockSvg).rendered) (block as Blockly.BlockSvg).render();
}

function repairAllCustomDefinitionArgumentReporters(workspace: Blockly.Workspace) {
  for (const block of workspace.getBlocksByType("custom_define", false)) {
    repairCustomDefinitionArgumentReporters(block);
  }
}

function scheduleCustomDefinitionArgumentReporterRepair(workspace: Blockly.Workspace) {
  for (const timer of customDefinitionRepairTimers.get(workspace) ?? []) window.clearTimeout(timer);
  customDefinitionRepairTimers.set(workspace, [
    window.setTimeout(() => repairAllCustomDefinitionArgumentReporters(workspace), 0),
    window.setTimeout(() => repairAllCustomDefinitionArgumentReporters(workspace), 50),
  ]);
}

function getCustomBlockDropdownOptions(workspace: Blockly.Workspace): [string, string][] {
  const names = getCustomBlockNames(workspace);
  return names.length > 0 ? names.map((name) => [name, name] as [string, string]) : [["(no blocks yet)", ""]];
}

function customBlockMenuGenerator(this: Blockly.FieldDropdown): [string, string][] {
  const sourceBlock = this.getSourceBlock();
  if (!sourceBlock) return [["(no blocks yet)", ""]];
  const targetWorkspace = (sourceBlock.workspace as Blockly.WorkspaceSvg).targetWorkspace;
  return getCustomBlockDropdownOptions(targetWorkspace ?? sourceBlock.workspace);
}

function setCustomCallName(field: Blockly.FieldDropdown, name: string) {
  field.setOptions(customBlockMenuGenerator);
  field.setValue(name);
}

function updateCustomCallShape(block: Blockly.Block) {
  const name = String(block.getFieldValue("NAME") ?? "");
  const definition = getCustomDefinitionBlock(block.workspace, name);
  const storedDefinition = getWorkspaceCustomDefinition(block.workspace, name);
  const parts = definition ? getCustomDefinitionParts(definition) : storedDefinition?.parts ?? getStoredCustomCallParts(block);
  const signature = JSON.stringify({ name, parts });
  if (customCallShapeSignatures.get(block) === signature) return;
  customCallShapeSignatures.set(block, signature);
  (block as Blockly.Block & { data?: string }).data = JSON.stringify({ parts });

  for (const input of [...block.inputList]) {
    if (/^(ARG|PART)\d+$/.test(input.name)) {
      block.removeInput(input.name, true);
    }
  }

  let inputIndex = 0;
  parts.forEach((part, index) => {
    if (!isCustomInputPart(part)) {
      block.appendDummyInput(`PART${index}`).appendField(part.text);
      return;
    }

    const input = block.appendValueInput(`ARG${inputIndex}`);
    if (part.kind === "boolean") input.setCheck("Boolean");
    inputIndex += 1;
  });
  block.setInputsInline(true);

  if ((block as Blockly.BlockSvg).rendered) {
    (block as Blockly.BlockSvg).render();
  }
}

function getStoredCustomCallParts(block: Blockly.Block): CustomBlockPart[] {
  try {
    const data = (block as Blockly.Block & { data?: string | null }).data;
    const parsed = data ? JSON.parse(data) as { parts?: CustomBlockPart[] } : null;
    return Array.isArray(parsed?.parts) ? parsed.parts : [];
  } catch {
    return [];
  }
}

function refreshCustomDefinitionShapes(workspace: Blockly.Workspace) {
  for (const block of workspace.getAllBlocks(false)) {
    updateCustomDefinitionShape(block);
  }
}

function refreshAllCustomCallShapes(workspace: Blockly.Workspace) {
  for (const block of workspace.getBlocksByType("custom_call", false)) {
    updateCustomCallShape(block);
  }
}

function backdropMenuGenerator(this: Blockly.FieldDropdown): [string, string][] {
  const sourceBlock = this.getSourceBlock();
  if (!sourceBlock) return [["Backdrop 1", "backdrop-1"]];
  return backdropOptionsByWorkspace.get(sourceBlock.workspace) ?? [["Backdrop 1", "backdrop-1"]];
}

function costumeMenuGenerator(this: Blockly.FieldDropdown): [string, string][] {
  const sourceBlock = this.getSourceBlock();
  if (!sourceBlock) return [["Costume 1", "costume-1"]];
  return costumeOptionsByWorkspace.get(sourceBlock.workspace) ?? [["Costume 1", "costume-1"]];
}

function listMenuGenerator(this: Blockly.FieldDropdown): [string, string][] {
  const sourceBlock = this.getSourceBlock();
  if (!sourceBlock) return [["list", "list"]];
  return listOptionsByWorkspace.get(sourceBlock.workspace) ?? [["list", "list"]];
}

function formatBackdropOptions(backdrops: { id: string; name: string }[]) {
  return backdrops.length > 0
    ? backdrops.map((backdrop, index) => [backdrop.name.trim() || `Backdrop ${index + 1}`, backdrop.id] as [string, string])
    : [["Backdrop 1", "backdrop-1"] as [string, string]];
}

function formatCostumeOptions(costumes: { id: string; name: string }[]) {
  return costumes.length > 0
    ? costumes.map((costume, index) => [costume.name.trim() || `Costume ${index + 1}`, costume.id] as [string, string])
    : [["Costume 1", "costume-1"] as [string, string]];
}

function formatListOptions(lists: string[]) {
  return lists.length > 0
    ? lists.map((name) => [name, name] as [string, string])
    : [["list", "list"] as [string, string]];
}

function refreshBackdropFields(workspace: Blockly.Workspace, backdrops: { id: string; name: string }[]) {
  const options = formatBackdropOptions(backdrops);
  const ids = new Set(options.map(([, id]) => id));
  backdropOptionsByWorkspace.set(workspace, options);

  for (const block of [
    ...workspace.getBlocksByType("looks_switch_backdrop", false),
    ...workspace.getBlocksByType("event_when_backdrop", false),
  ]) {
    const field = block.getField("BACKDROP") as Blockly.FieldDropdown | null;
    if (!field) continue;
    field.setOptions(backdropMenuGenerator);
    if (!ids.has(field.getValue() ?? "")) {
      field.setValue(options[0][1]);
    }
  }
}

function refreshCostumeFields(workspace: Blockly.Workspace, costumes: { id: string; name: string }[]) {
  const options = formatCostumeOptions(costumes);
  const ids = new Set(options.map(([, id]) => id));
  costumeOptionsByWorkspace.set(workspace, options);

  for (const block of workspace.getBlocksByType("looks_switch_costume", false)) {
    const field = block.getField("COSTUME") as Blockly.FieldDropdown | null;
    if (!field) continue;
    field.setOptions(costumeMenuGenerator);
    if (!ids.has(field.getValue() ?? "")) {
      field.setValue(options[0][1]);
    }
  }
}

function refreshListFields(workspace: Blockly.Workspace, lists: string[]) {
  const options = formatListOptions(lists);
  const ids = new Set(options.map(([, id]) => id));
  listOptionsByWorkspace.set(workspace, options);

  for (const type of ["list_add", "list_delete", "list_delete_all", "list_insert", "list_replace", "list_item", "list_index", "list_length", "list_contains", "list_show", "list_hide"]) {
    for (const block of workspace.getBlocksByType(type, false)) {
      const field = block.getField("LIST") as Blockly.FieldDropdown | null;
      if (!field) continue;
      field.setOptions(listMenuGenerator);
      if (!ids.has(field.getValue() ?? "")) field.setValue(options[0][1]);
    }
  }
}

function customBlocksFlyout(workspace: Blockly.Workspace): Blockly.utils.toolbox.FlyoutItemInfoArray {
  scheduleVariableWatcherCheckboxCleanup(workspace);
  rememberCustomDefinitions(workspace);
  const definitionWorkspace = getDefinitionWorkspace(workspace);
  const names = getCustomBlockNames(workspace);
  const definitions = getWorkspaceCustomDefinitions(workspace).filter((definition) => definition.name && names.includes(definition.name));
  const selectedArgs = getCustomDefinitionParts(getSelectedCustomDefinition(getDefinitionWorkspace(workspace) as Blockly.WorkspaceSvg)).filter(isCustomInputPart);
  const items: Blockly.utils.toolbox.FlyoutItemInfoArray = [
    { kind: "button", text: "Make a Block", callbackkey: "CREATE_CUSTOM_BLOCK" },
  ];
  for (const arg of selectedArgs) {
    items.push({
      kind: "block",
      type: arg.kind === "boolean" ? "custom_arg_boolean" : "custom_arg_value",
      fields: { NAME: arg.name },
    });
  }
  for (const definition of definitions) {
    const name = String(definition.name ?? "");
    if (!name || getCustomDefinitionBlock(definitionWorkspace, name)) continue;
    items.push({
      kind: "block",
      type: "custom_define",
      extraState: { data: JSON.stringify(definition) },
    });
  }
  if (names.length > 0) {
    items.push({ kind: "block", type: "custom_call", fields: { NAME: names[0] } });
  }
  return items as unknown as Blockly.utils.toolbox.FlyoutItemInfoArray;
}

function variablesFlyout(workspace: Blockly.WorkspaceSvg): Blockly.utils.toolbox.FlyoutItemInfoArray {
  removeAllVariableWatcherCheckboxes(workspace);
  const items = Blockly.Variables.flyoutCategory(workspace, false).filter((item) => {
    if (item.kind === "button") return false;
    const blockItem = item as Partial<Blockly.utils.toolbox.BlockInfo>;
    if (item.kind === "block" && (blockItem.type === "variables_get" || blockItem.type === "variables_get_dynamic")) return false;
    return true;
  });
  const controls = variableControlsByWorkspace.get(workspace);
  const variables = workspace.getAllVariables().map((variable) => variable.getName()).filter(Boolean).sort();
  const watcherBlocks = variables.map((name) => ({
    kind: "block",
    type: "variable_watcher_toggle",
    extraState: { name, checked: controls?.visibleNames.has(name) ?? false },
    fields: {
      NAME: name,
    },
  }));
  return [
    { kind: "button", text: "Make a Variable", callbackkey: "NEURIX_CREATE_VARIABLE" },
    ...watcherBlocks,
    ...items,
  ] as Blockly.utils.toolbox.FlyoutItemInfoArray;
}

type VariableWatcherToggleBlock = Blockly.BlockSvg & {
  isInFlyout?: boolean;
  watcherChecked_?: boolean;
  watcherName_?: string;
  watcherShifted_?: boolean;
};

function listsFlyout(workspace: Blockly.WorkspaceSvg): Blockly.utils.toolbox.FlyoutItemInfoArray {
  scheduleWatcherCheckboxCleanup(workspace);
  const options = listOptionsByWorkspace.get(workspace) ?? [["list", "list"]];
  const hasLists = options.some(([, value]) => value !== "list");
  const firstList = hasLists ? options[0][1] : "list";
  const controls = listControlsByWorkspace.get(workspace);
  const items: Blockly.utils.toolbox.FlyoutItemInfoArray = [
    { kind: "button", text: "Make a List", callbackkey: "NEURIX_CREATE_LIST" },
  ];
  if (hasLists) {
    const watcherBlocks = options
      .map(([, value]) => value)
      .filter((value) => value !== "list")
      .map((name) => ({
        kind: "block",
        type: "list_watcher_toggle",
        extraState: { name, checked: controls?.visibleNames.has(name) ?? false },
        fields: { NAME: name },
      }));
    items.push(...watcherBlocks);
    items.push(
      { kind: "block", type: "list_add", fields: { LIST: firstList }, inputs: { ITEM: { shadow: { type: "text", fields: { TEXT: "thing" } } } } },
      { kind: "block", type: "list_delete", fields: { LIST: firstList }, inputs: { INDEX: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
      { kind: "block", type: "list_delete_all", fields: { LIST: firstList } },
      { kind: "block", type: "list_insert", fields: { LIST: firstList }, inputs: { ITEM: { shadow: { type: "text", fields: { TEXT: "thing" } } }, INDEX: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
      { kind: "block", type: "list_replace", fields: { LIST: firstList }, inputs: { INDEX: { shadow: { type: "math_number", fields: { NUM: 1 } } }, ITEM: { shadow: { type: "text", fields: { TEXT: "thing" } } } } },
      { kind: "block", type: "list_item", fields: { LIST: firstList }, inputs: { INDEX: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
      { kind: "block", type: "list_index", fields: { LIST: firstList }, inputs: { ITEM: { shadow: { type: "text", fields: { TEXT: "thing" } } } } },
      { kind: "block", type: "list_length", fields: { LIST: firstList } },
      { kind: "block", type: "list_contains", fields: { LIST: firstList }, inputs: { ITEM: { shadow: { type: "text", fields: { TEXT: "thing" } } } } },
      { kind: "block", type: "list_show", fields: { LIST: firstList } },
      { kind: "block", type: "list_hide", fields: { LIST: firstList } },
    );
  }
  return items as Blockly.utils.toolbox.FlyoutItemInfoArray;
}

function ensureCloudVariables(workspace: Blockly.WorkspaceSvg, names: string[]) {
  for (const name of names) {
    if (!workspace.getVariable(name)) workspace.createVariable(name);
  }
  workspace.refreshToolboxSelection();
}

function ensureVariables(workspace: Blockly.WorkspaceSvg, names: string[]) {
  for (const name of names) {
    if (!workspace.getVariable(name)) workspace.createVariable(name);
  }
  workspace.refreshToolboxSelection();
}

function getVariableWatcherToggleName(block: Blockly.Block) {
  const svgBlock = block as VariableWatcherToggleBlock;
  return svgBlock.watcherName_ || block.getField("NAME")?.getText() || String(block.getFieldValue("NAME") ?? "");
}

function setVariableWatcherToggleName(block: Blockly.Block, name: string) {
  const nextName = String(name ?? "");
  const svgBlock = block as VariableWatcherToggleBlock;
  svgBlock.watcherName_ = nextName;
  block.getField("NAME")?.setValue(nextName);
}

function removeVariableWatcherCheckbox(block: Blockly.Block) {
  const canvas = (block.workspace as Blockly.WorkspaceSvg).getCanvas?.();
  canvas?.querySelector(`[data-neurix-variable-checkbox="${block.id}"]`)?.remove();
}

function getWorkspaceCanvases(workspace: Blockly.Workspace) {
  const canvases: SVGElement[] = [];
  const svgWorkspace = workspace as Blockly.WorkspaceSvg;
  const workspaceCanvas = svgWorkspace.getCanvas?.();
  if (workspaceCanvas) canvases.push(workspaceCanvas);

  const flyoutCanvas = svgWorkspace.getFlyout?.()?.getWorkspace?.()?.getCanvas?.();
  if (flyoutCanvas && !canvases.includes(flyoutCanvas)) canvases.push(flyoutCanvas);

  const targetWorkspace = svgWorkspace.targetWorkspace as Blockly.WorkspaceSvg | undefined;
  const targetFlyoutCanvas = targetWorkspace?.getFlyout?.()?.getWorkspace?.()?.getCanvas?.();
  if (targetFlyoutCanvas && !canvases.includes(targetFlyoutCanvas)) canvases.push(targetFlyoutCanvas);

  return canvases;
}

function removeStaleVariableWatcherCheckboxes(workspace: Blockly.Workspace) {
  for (const canvas of getWorkspaceCanvases(workspace)) {
    canvas.querySelectorAll<SVGGElement>(".neurix-variable-monitor-checkbox, .neurix-list-monitor-checkbox").forEach((checkbox) => {
      const blockId = checkbox.getAttribute("data-neurix-variable-checkbox");
      if (!blockId || !workspace.getBlockById(blockId)) checkbox.remove();
    });
  }
}

function removeAllVariableWatcherCheckboxes(workspace: Blockly.Workspace) {
  for (const canvas of getWorkspaceCanvases(workspace)) {
    canvas.querySelectorAll(".neurix-variable-monitor-checkbox").forEach((checkbox) => checkbox.remove());
  }
}

function removeAllWatcherCheckboxes(workspace: Blockly.Workspace) {
  for (const canvas of getWorkspaceCanvases(workspace)) {
    canvas.querySelectorAll(".neurix-variable-monitor-checkbox, .neurix-list-monitor-checkbox").forEach((checkbox) => checkbox.remove());
  }
}

function scheduleVariableWatcherCheckboxCleanup(workspace: Blockly.Workspace) {
  removeAllWatcherCheckboxes(workspace);
  window.setTimeout(() => removeAllWatcherCheckboxes(workspace), 0);
  window.setTimeout(() => removeAllWatcherCheckboxes(workspace), 50);
}

function scheduleWatcherCheckboxCleanup(workspace: Blockly.Workspace) {
  scheduleVariableWatcherCheckboxCleanup(workspace);
}

function drawVariableWatcherCheckbox(block: Blockly.Block) {
  const svgBlock = block as VariableWatcherToggleBlock;
  const isFlyoutBlock = svgBlock.isInFlyout === true;
  const root = svgBlock.getSvgRoot();
  if (!root) return;

  removeStaleVariableWatcherCheckboxes(block.workspace);
  root.classList.toggle("neurix-variable-row-block", isFlyoutBlock);
  removeVariableWatcherCheckbox(block);
  if (!isFlyoutBlock) return;

  if (!svgBlock.watcherShifted_) {
    Blockly.Events.disable();
    try {
      svgBlock.moveBy(44, 0);
      svgBlock.watcherShifted_ = true;
    } finally {
      Blockly.Events.enable();
    }
  }

  const name = getVariableWatcherToggleName(block).trim();
  const xy = svgBlock.getRelativeToSurfaceXY();
  const { height } = svgBlock.getHeightWidth();
  const size = 30;
  const canvas = (block.workspace as Blockly.WorkspaceSvg).getCanvas();
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const checked = svgBlock.watcherChecked_ === true;
  group.setAttribute("class", `neurix-variable-monitor-checkbox ${checked ? "neurix-variable-monitor-checkbox-checked" : ""}`);
  group.setAttribute("data-neurix-variable-checkbox", block.id);
  group.setAttribute("transform", `translate(${xy.x - 42}, ${xy.y + Math.max(0, (height - size) / 2)})`);
  group.setAttribute("role", "button");
  group.setAttribute("aria-label", `${checked ? "Hide" : "Show"} ${name || "variable"}`);

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", String(size));
  rect.setAttribute("height", String(size));
  rect.setAttribute("rx", "5");
  rect.setAttribute("ry", "5");
  group.appendChild(rect);

  if (checked) {
    const check = document.createElementNS("http://www.w3.org/2000/svg", "path");
    check.setAttribute("d", "M7.5 15.8 13 21.4 23.8 9.4");
    check.setAttribute("fill", "none");
    check.setAttribute("stroke", "#fff");
    check.setAttribute("stroke-width", "4");
    check.setAttribute("stroke-linecap", "round");
    check.setAttribute("stroke-linejoin", "round");
    group.appendChild(check);
  }

  group.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  group.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!name) return;
    const targetWorkspace = getDefinitionWorkspace(block.workspace);
    variableControlsByWorkspace.get(targetWorkspace)?.toggle(name);
    window.setTimeout(() => (targetWorkspace as Blockly.WorkspaceSvg).refreshToolboxSelection(), 0);
  });

  canvas.appendChild(group);
}

function drawListWatcherCheckbox(block: Blockly.Block) {
  const svgBlock = block as VariableWatcherToggleBlock;
  const isFlyoutBlock = svgBlock.isInFlyout === true;
  const root = svgBlock.getSvgRoot();
  if (!root) return;

  removeStaleVariableWatcherCheckboxes(block.workspace);
  root.classList.toggle("neurix-list-row-block", isFlyoutBlock);
  removeVariableWatcherCheckbox(block);
  if (!isFlyoutBlock) return;

  if (!svgBlock.watcherShifted_) {
    Blockly.Events.disable();
    try {
      svgBlock.moveBy(44, 0);
      svgBlock.watcherShifted_ = true;
    } finally {
      Blockly.Events.enable();
    }
  }

  const name = getVariableWatcherToggleName(block).trim();
  const xy = svgBlock.getRelativeToSurfaceXY();
  const { height } = svgBlock.getHeightWidth();
  const size = 30;
  const canvas = (block.workspace as Blockly.WorkspaceSvg).getCanvas();
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const checked = svgBlock.watcherChecked_ === true;
  group.setAttribute("class", `neurix-list-monitor-checkbox ${checked ? "neurix-list-monitor-checkbox-checked" : ""}`);
  group.setAttribute("data-neurix-variable-checkbox", block.id);
  group.setAttribute("transform", `translate(${xy.x - 42}, ${xy.y + Math.max(0, (height - size) / 2)})`);
  group.setAttribute("role", "button");
  group.setAttribute("aria-label", `${checked ? "Hide" : "Show"} ${name || "list"}`);

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", String(size));
  rect.setAttribute("height", String(size));
  rect.setAttribute("rx", "5");
  rect.setAttribute("ry", "5");
  group.appendChild(rect);

  if (checked) {
    const check = document.createElementNS("http://www.w3.org/2000/svg", "path");
    check.setAttribute("d", "M7.5 15.8 13 21.4 23.8 9.4");
    check.setAttribute("fill", "none");
    check.setAttribute("stroke", "#fff");
    check.setAttribute("stroke-width", "4");
    check.setAttribute("stroke-linecap", "round");
    check.setAttribute("stroke-linejoin", "round");
    group.appendChild(check);
  }

  group.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  group.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!name) return;
    const targetWorkspace = getDefinitionWorkspace(block.workspace);
    listControlsByWorkspace.get(targetWorkspace)?.setVisible(name, !checked);
    window.setTimeout(() => (targetWorkspace as Blockly.WorkspaceSvg).refreshToolboxSelection(), 0);
  });

  canvas.appendChild(group);
}

function createCustomDefinition(workspace: Blockly.WorkspaceSvg, name: string, parts: CustomBlockPart[]) {
  const definitionCount = workspace.getTopBlocks(false).filter((item) => isCustomDefinitionBlock(item)).length;
  const block = workspace.newBlock("custom_define") as Blockly.BlockSvg;
  setCustomDefinitionData(block, name, parts);
  upsertWorkspaceCustomDefinition(workspace, name, parts);
  updateCustomDefinitionShape(block);
  block.initSvg();
  block.render();
  block.moveBy(260, 150 + definitionCount * 64);
  workspace.refreshToolboxSelection();
  return block;
}

function registerCustomFlyout(workspace: Blockly.WorkspaceSvg, openCustomBlockDialog: () => void, openVariableDialog: () => void, openListDialog: () => void) {
  workspace.registerToolboxCategoryCallback("CUSTOM_BLOCKS", customBlocksFlyout);
  workspace.registerToolboxCategoryCallback("NEURIX_VARIABLES", variablesFlyout);
  workspace.registerToolboxCategoryCallback("NEURIX_LISTS", listsFlyout);
  workspace.registerButtonCallback("CREATE_CUSTOM_BLOCK", openCustomBlockDialog);
  workspace.registerButtonCallback("NEURIX_CREATE_VARIABLE", openVariableDialog);
  workspace.registerButtonCallback("NEURIX_CREATE_LIST", openListDialog);
}

function registerCustomBlocks() {
  Blockly.setLocale(BlocklyEn as unknown as Record<string, string>);
  for (const menuId of ["blockInline", "blockHelp", "blockDisable", "blockCollapseExpand"]) {
    if (Blockly.ContextMenuRegistry.registry.getItem(menuId)) {
      Blockly.ContextMenuRegistry.registry.unregister(menuId);
    }
  }
  if (customBlocksRegistered) return;
  Blockly.FlyoutButton.TEXT_MARGIN_X = 18;
  Blockly.FlyoutButton.TEXT_MARGIN_Y = 9;
  Blockly.FlyoutButton.BORDER_RADIUS = 7;
  Blockly.common.defineBlocksWithJsonArray(CUSTOM_BLOCKS);

  Blockly.Blocks["custom_define"] = {
    init: function () {
      this.setNextStatement(true);
      this.setStyle("custom_blocks");
      updateCustomDefinitionShape(this as Blockly.Block);
    },
    onchange: function (event: Blockly.Events.Abstract) {
      const changeEvent = event as unknown as Partial<{ type: string; blockId: string; element: string; name: string; oldValue: unknown; newValue: unknown }>;
      if (
        changeEvent.type === "change" &&
        changeEvent.blockId === this.id &&
        changeEvent.element === "field" &&
        changeEvent.name === "NAME"
      ) {
        const oldName = String(changeEvent.oldValue ?? "");
        const newName = String(changeEvent.newValue ?? "");
        if (oldName && oldName !== newName) {
          for (const callBlock of this.workspace.getBlocksByType("custom_call", false)) {
            const field = callBlock.getField("NAME") as Blockly.FieldDropdown | null;
            if (field && field.getValue() === oldName) {
              setCustomCallName(field, newName);
            }
          }
        }
      }
    },
    saveExtraState: function () {
      return { data: (this as Blockly.Block & { data?: string | null }).data ?? "" };
    },
    loadExtraState: function (state: { data?: string }) {
      (this as Blockly.Block & { data?: string }).data = state.data ?? "";
      updateCustomDefinitionShape(this as Blockly.Block);
    },
  };

  Blockly.Blocks["custom_arg_value"] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldLabelSerializable("input"), "NAME");
      this.setOutput(true);
      this.setStyle("custom_blocks");
      this.setTooltip("Custom block input value.");
    },
  };

  Blockly.Blocks["custom_arg_boolean"] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldLabelSerializable("condition"), "NAME");
      this.setOutput(true, "Boolean");
      this.setStyle("custom_blocks");
      this.setTooltip("Custom block condition input.");
    },
  };

  Blockly.Blocks["variable_watcher_toggle"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(""), "NAME");
      this.setOutput(true);
      this.setStyle("list_blocks");
      this.setTooltip("Show or hide this variable on the stage.");
      drawVariableWatcherCheckbox(this as Blockly.Block);
    },
    onchange: function () {
      drawVariableWatcherCheckbox(this as Blockly.Block);
    },
    saveExtraState: function () {
      return {
        name: getVariableWatcherToggleName(this as Blockly.Block),
        checked: (this as VariableWatcherToggleBlock).watcherChecked_ === true,
      };
    },
    loadExtraState: function (state: { name?: string; checked?: boolean }) {
      const block = this as Blockly.Block;
      const svgBlock = this as VariableWatcherToggleBlock;
      svgBlock.watcherChecked_ = state.checked === true;
      if (state.name) setVariableWatcherToggleName(block, state.name);
      window.setTimeout(() => drawVariableWatcherCheckbox(this as Blockly.Block), 0);
    },
  };

  Blockly.Blocks["list_watcher_toggle"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(""), "NAME");
      this.setOutput(true);
      this.setStyle("list_blocks");
      this.setTooltip("Show or hide this list on the stage.");
      drawListWatcherCheckbox(this as Blockly.Block);
    },
    onchange: function () {
      drawListWatcherCheckbox(this as Blockly.Block);
    },
    saveExtraState: function () {
      return {
        name: getVariableWatcherToggleName(this as Blockly.Block),
        checked: (this as VariableWatcherToggleBlock).watcherChecked_ === true,
      };
    },
    loadExtraState: function (state: { name?: string; checked?: boolean }) {
      const block = this as Blockly.Block;
      const svgBlock = this as VariableWatcherToggleBlock;
      svgBlock.watcherChecked_ = state.checked === true;
      if (state.name) setVariableWatcherToggleName(block, state.name);
      window.setTimeout(() => drawListWatcherCheckbox(this as Blockly.Block), 0);
    },
  };

  Blockly.Blocks["custom_call"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("run")
        .appendField(new Blockly.FieldDropdown(customBlockMenuGenerator), "NAME");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setStyle("custom_blocks");
      updateCustomCallShape(this as Blockly.Block);
    },
    onchange: function (event: Blockly.Events.Abstract) {
      const changeEvent = event as unknown as Partial<{ type: string; blockId: string; element: string; name: string }>;
      if (
        changeEvent.type === "change" &&
        changeEvent.blockId === this.id &&
        changeEvent.element === "field" &&
        changeEvent.name === "NAME"
      ) {
        updateCustomCallShape(this as Blockly.Block);
      }
    },
    saveExtraState: function () {
      return { data: (this as Blockly.Block & { data?: string | null }).data ?? "" };
    },
    loadExtraState: function (state: { data?: string }) {
      (this as Blockly.Block & { data?: string }).data = state.data ?? "";
      updateCustomCallShape(this as Blockly.Block);
    },
  };

  Blockly.Blocks["looks_switch_backdrop"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("switch backdrop to")
        .appendField(new Blockly.FieldDropdown(backdropMenuGenerator), "BACKDROP");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle("looks_blocks");
    },
  };

  Blockly.Blocks["event_when_backdrop"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("when backdrop switches to")
        .appendField(new Blockly.FieldDropdown(backdropMenuGenerator), "BACKDROP");
      this.setNextStatement(true);
      this.setStyle("event_blocks");
      this.hat = "cap";
    },
  };

  Blockly.Blocks["looks_switch_costume"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("switch costume to")
        .appendField(new Blockly.FieldDropdown(costumeMenuGenerator), "COSTUME");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle("looks_blocks");
    },
  };

  customBlocksRegistered = true;
}

function refreshCustomCallFields(workspace: Blockly.Workspace) {
  const names = getCustomBlockNames(workspace);
  for (const block of workspace.getBlocksByType("custom_call", false)) {
    const field = block.getField("NAME") as Blockly.FieldDropdown | null;
    if (!field) continue;
    field.setOptions(customBlockMenuGenerator);
    const current = field.getValue() ?? "";
    if (names.length > 0 && !names.includes(current)) {
      field.setValue(names[0]);
    }
    updateCustomCallShape(block);
  }
}

function getCustomBlockName(block: Blockly.Block) {
  const procedure = block as unknown as Partial<{ getProcedureDef: () => [string, string[], boolean] }>;
  if (typeof procedure.getProcedureDef === "function") {
    return procedure.getProcedureDef()[0];
  }
  const storedName = readCustomDefinitionData(block).name?.trim();
  if (storedName) return storedName;
  return block.getField("NAME")?.getText() ?? String(block.getFieldValue("PROMPT") ?? "");
}

function isCustomDefinitionBlock(block: Blockly.Block) {
  return block.type === "custom_define" || block.type === "ai_define" || block.type === "procedures_defnoreturn";
}

function getSelectedCustomDefinition(workspace: Blockly.WorkspaceSvg) {
  const selected = Blockly.common.getSelected();
  if (!(selected instanceof Blockly.Block)) return null;
  if (selected.workspace !== workspace || !isCustomDefinitionBlock(selected)) return null;
  return selected;
}

async function readTextStream(response: Response, onChunk: (text: string) => void) {
  if (!response.body) {
    onChunk(await response.text());
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export function BlocklyPanel({ activeSpriteId, activeSpriteName, targetType = "sprite", backdrops, costumes = [], variableNames = [], cloudVariableNames = [], listNames = [], visibleWatcherNames = [], visibleListWatcherNames = [], workspaceState, onWorkspaceChange, onVariableCreate, onCloudVariableCreate, onVariableWatcherToggle, onListWatcherVisibleChange, onListCreate }: BlocklyPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const initialSpriteIdRef = useRef(activeSpriteId);
  const activeSpriteNameRef = useRef(activeSpriteName);
  const initialWorkspaceStateRef = useRef(workspaceState);
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
  const backdropsRef = useRef(backdrops);
  const costumesRef = useRef(costumes);
  const variableNamesRef = useRef(variableNames);
  const cloudVariableNamesRef = useRef(cloudVariableNames);
  const listNamesRef = useRef(listNames);
  const visibleWatcherNamesRef = useRef(visibleWatcherNames);
  const visibleListWatcherNamesRef = useRef(visibleListWatcherNames);
  const [selectedCustomName, setSelectedCustomName] = useState<string | null>(null);
  const [selectedCustomBlockId, setSelectedCustomBlockId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState<AiExplainResponse | null>(null);
  const [askBlockId, setAskBlockId] = useState<string | null>(null);
  const [askQuestion, setAskQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [askResponse, setAskResponse] = useState<AiAskResponse | null>(null);
  const [isCustomBlockDialogOpen, setIsCustomBlockDialogOpen] = useState(false);
  const [editingCustomBlockId, setEditingCustomBlockId] = useState<string | null>(null);
  const [customBlockName, setCustomBlockName] = useState("block name");
  const [customBlockParts, setCustomBlockParts] = useState<CustomBlockPart[]>([]);
  const [runWithoutRefresh, setRunWithoutRefresh] = useState(false);
  const [isVariableDialogOpen, setIsVariableDialogOpen] = useState(false);
  const [variableName, setVariableName] = useState("score");
  const [variableScope, setVariableScope] = useState<VariableScope>("sprite");
  const [isListDialogOpen, setIsListDialogOpen] = useState(false);
  const [listName, setListName] = useState("items");
  const [listScope, setListScope] = useState<ListScope>("project");

  useEffect(() => {
    onWorkspaceChangeRef.current = onWorkspaceChange;
  }, [onWorkspaceChange]);

  useEffect(() => {
    backdropsRef.current = backdrops;
    const workspace = workspaceRef.current;
    if (workspace) {
      refreshBackdropFields(workspace, backdrops);
      workspace.refreshToolboxSelection();
    }
  }, [backdrops]);

  useEffect(() => {
    costumesRef.current = costumes;
    const workspace = workspaceRef.current;
    if (workspace) {
      refreshCostumeFields(workspace, costumes);
      workspace.refreshToolboxSelection();
    }
  }, [costumes]);

  useEffect(() => {
    variableNamesRef.current = variableNames;
    const workspace = workspaceRef.current;
    if (workspace) ensureVariables(workspace, variableNames);
  }, [variableNames]);

  useEffect(() => {
    cloudVariableNamesRef.current = cloudVariableNames;
    const workspace = workspaceRef.current;
    if (workspace) ensureCloudVariables(workspace, cloudVariableNames);
  }, [cloudVariableNames]);

  useEffect(() => {
    listNamesRef.current = listNames;
    const workspace = workspaceRef.current;
    if (workspace) {
      refreshListFields(workspace, listNames);
      workspace.refreshToolboxSelection();
    }
  }, [listNames]);

  useEffect(() => {
    visibleWatcherNamesRef.current = visibleWatcherNames;
    const workspace = workspaceRef.current;
    if (workspace) {
      variableControlsByWorkspace.set(workspace, {
        visibleNames: new Set(visibleWatcherNames),
        toggle: (name) => onVariableWatcherToggle?.(name),
      });
      workspace.refreshToolboxSelection();
    }
  }, [onVariableWatcherToggle, visibleWatcherNames]);

  useEffect(() => {
    visibleListWatcherNamesRef.current = visibleListWatcherNames;
    const workspace = workspaceRef.current;
    if (workspace) {
      listControlsByWorkspace.set(workspace, {
        visibleNames: new Set(visibleListWatcherNames),
        setVisible: (name, visible) => onListWatcherVisibleChange?.(name, visible),
      });
      workspace.refreshToolboxSelection();
    }
  }, [onListWatcherVisibleChange, visibleListWatcherNames]);

  useEffect(() => {
    activeSpriteNameRef.current = activeSpriteName;
  }, [activeSpriteName]);

  const explainBlock = useCallback(async (blockId: string) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const block = workspace.getBlockById(blockId);
    if (!block) return;

    const selectedAst = blockStackToAst(workspace, block);
    if (selectedAst.length === 0) {
      setExplanation({ error: "This block does not have any connected logic to explain." });
      return;
    }

    setIsExplaining(true);
    setExplanation({ title: "Explaining blocks", summary: "" });

    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spriteName: activeSpriteNameRef.current,
          selectedAst,
          fullAst: blocklyToAst(workspace),
          stream: true,
        }),
      });

      if (!response.ok) {
        const payload = await response.json() as AiExplainResponse;
        throw new Error(payload.error ?? "Could not explain these blocks.");
      }

      let streamedText = "";
      await readTextStream(response, (text) => {
        streamedText += text;
        setExplanation({ title: "AI Explain", summary: streamedText });
      });
    } catch (error) {
      setExplanation({ error: error instanceof Error ? error.message : "Could not explain these blocks." });
    } finally {
      setIsExplaining(false);
    }
  }, []);

  const openAskAi = useCallback((blockId: string) => {
    setAskBlockId(blockId);
    setAskQuestion("");
    setAskResponse(null);
  }, []);

  const persistWorkspace = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const programs = blocklyToPrograms(workspace);
    onWorkspaceChangeRef.current(
      initialSpriteIdRef.current,
      saveWorkspace(workspace),
      programs.start,
      programs.cloneStart,
      programs.broadcasts,
      programs.backdrops,
    );
  }, []);

  const closeCustomBlockDialog = useCallback(() => {
    setIsCustomBlockDialogOpen(false);
    setEditingCustomBlockId(null);
  }, []);

  const openCustomBlockDialog = useCallback((blockId?: string) => {
    const workspace = workspaceRef.current;
    const block = blockId && workspace ? workspace.getBlockById(blockId) : null;

    if (block?.type === "custom_define") {
      setEditingCustomBlockId(block.id);
      setCustomBlockName(getCustomBlockName(block) || "block name");
      setCustomBlockParts(getCustomDefinitionParts(block).map((part) => ({ ...part })));
    } else {
      setEditingCustomBlockId(null);
      setCustomBlockName("block name");
      setCustomBlockParts([]);
    }
    setRunWithoutRefresh(false);
    setIsCustomBlockDialogOpen(true);
  }, []);

  const openVariableDialog = useCallback(() => {
    setVariableName("score");
    setVariableScope(targetType === "stage" ? "project" : "sprite");
    setIsVariableDialogOpen(true);
  }, [targetType]);

  const openListDialog = useCallback(() => {
    setListName("items");
    setListScope(targetType === "stage" ? "project" : "sprite");
    setIsListDialogOpen(true);
  }, [targetType]);

  const addCustomBlockArg = (kind: CustomBlockArg["kind"]) => {
    setCustomBlockParts((curr) => {
      const label = kind === "boolean" ? "condition" : "input";
      const inputCount = curr.filter(isCustomInputPart).length;
      return [...curr, { id: `arg-${Date.now()}-${curr.length}`, name: `${label}${inputCount + 1}`, kind }];
    });
  };

  const updateCustomBlockPart = (id: string, value: string) => {
    setCustomBlockParts((curr) => curr.map((part) => {
      if (part.id !== id) return part;
      return isCustomInputPart(part) ? { ...part, name: value } : { ...part, text: value };
    }));
  };

  const removeCustomBlockPart = (id: string) => {
    setCustomBlockParts((curr) => curr.filter((part) => part.id !== id));
  };

  const moveCustomBlockPart = (id: string, direction: -1 | 1) => {
    setCustomBlockParts((curr) => {
      const index = curr.findIndex((part) => part.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= curr.length) return curr;
      const next = [...curr];
      const [part] = next.splice(index, 1);
      next.splice(nextIndex, 0, part);
      return next;
    });
  };

  const submitCustomBlockDialog = () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const name = customBlockName.trim().replace(/\s+/g, " ") || "block name";
    const seenInputNames = new Set<string>();
    const parts: CustomBlockPart[] = [];
    customBlockParts.forEach((part, index) => {
      if (!isCustomInputPart(part)) {
        const text = part.text.trim().replace(/\s+/g, " ");
        if (text) parts.push({ ...part, text });
        return;
      }

      const inputName = part.name.trim().replace(/\s+/g, " ") || `input${index + 1}`;
      const key = inputName.toLowerCase();
      if (seenInputNames.has(key)) return;
      seenInputNames.add(key);
      parts.push({ ...part, name: inputName });
    });

    const editingBlock = editingCustomBlockId ? workspace.getBlockById(editingCustomBlockId) : null;
    const oldName = editingBlock ? getCustomBlockName(editingBlock) : "";
    const block = editingBlock?.type === "custom_define" ? editingBlock as Blockly.BlockSvg : createCustomDefinition(workspace, name, parts);

    if (editingBlock?.type === "custom_define") {
      if (oldName && normalizeCustomName(oldName) !== normalizeCustomName(name)) removeWorkspaceCustomDefinition(workspace, oldName);
      setCustomDefinitionData(editingBlock, name, parts);
      upsertWorkspaceCustomDefinition(workspace, name, parts);
      updateCustomDefinitionShape(editingBlock);

      for (const callBlock of workspace.getBlocksByType("custom_call", false)) {
        const field = callBlock.getField("NAME") as Blockly.FieldDropdown | null;
        if (field && field.getValue() === oldName) setCustomCallName(field, name);
      }
      refreshCustomCallFields(workspace);
      workspace.refreshToolboxSelection();
    }

    if (block) Blockly.common.setSelected(block);
    persistWorkspace();
    closeCustomBlockDialog();
  };

  const submitVariableDialog = () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const name = variableName.trim().replace(/\s+/g, " ");
    if (!name) return;
    const scopedName = variableScope === "cloud"
      ? getCloudVariableName(name)
      : variableScope === "sprite" && targetType === "sprite" ? `${activeSpriteNameRef.current}: ${name}` : name;
    const existing = workspace.getVariable(scopedName);
    if (!existing) workspace.createVariable(scopedName);
    if (variableScope !== "cloud") onVariableCreate?.(scopedName);
    if (variableScope === "cloud") onCloudVariableCreate?.(scopedName);
    workspace.refreshToolboxSelection();
    setIsVariableDialogOpen(false);
  };

  const submitListDialog = () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const name = listName.trim().replace(/\s+/g, " ");
    if (!name) return;
    const scopedName = listScope === "sprite" && targetType === "sprite" ? `${activeSpriteNameRef.current}: ${name}` : name;
    onListCreate?.(scopedName);
    refreshListFields(workspace, [...new Set([...listNamesRef.current, scopedName])]);
    workspace.refreshToolboxSelection();
    setIsListDialogOpen(false);
  };

  const askAi = async () => {
    const workspace = workspaceRef.current;
    if (!workspace || !askBlockId) return;

    const block = workspace.getBlockById(askBlockId);
    if (!block) {
      setAskResponse({ error: "That block is no longer available." });
      return;
    }

    const question = askQuestion.trim();
    if (!question) {
      setAskResponse({ error: "Ask a question first." });
      return;
    }

    setIsAsking(true);
    setAskResponse(null);

    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spriteName: activeSpriteNameRef.current,
          question,
          selectedAst: blockStackToAst(workspace, block),
          fullAst: blocklyToAst(workspace),
          stream: true,
        }),
      });

      if (!response.ok) {
        const payload = await response.json() as AiAskResponse;
        throw new Error(payload.error ?? "Could not answer that.");
      }

      let streamedText = "";
      await readTextStream(response, (text) => {
        streamedText += text;
        setAskResponse({ answer: streamedText });
      });
    } catch (error) {
      setAskResponse({ error: error instanceof Error ? error.message : "Could not answer that." });
    } finally {
      setIsAsking(false);
    }
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    registerCustomBlocks();

    const workspace = Blockly.inject(host, {
      toolbox: targetType === "stage" ? STAGE_TOOLBOX : TOOLBOX,
      renderer: "zelos",
      theme: THEME,
      trashcan: true,
      sounds: false,
      move: {
        drag: true,
        scrollbars: true,
        wheel: true,
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.92,
        maxScale: 3,
        minScale: 0.3,
        pinch: true,
      },
      grid: {
        spacing: 24,
        length: 2,
        colour: "rgba(0, 0, 0, 0.04)",
        snap: false,
      },
    });

    workspaceRef.current = workspace;
    refreshBackdropFields(workspace, backdropsRef.current);
    refreshCostumeFields(workspace, costumesRef.current);
    refreshListFields(workspace, listNamesRef.current);
    variableControlsByWorkspace.set(workspace, {
      visibleNames: new Set(visibleWatcherNamesRef.current),
      toggle: (name) => onVariableWatcherToggle?.(name),
    });
    listControlsByWorkspace.set(workspace, {
      visibleNames: new Set(visibleListWatcherNamesRef.current),
      setVisible: (name, visible) => onListWatcherVisibleChange?.(name, visible),
    });
    registerCustomFlyout(workspace, openCustomBlockDialog, openVariableDialog, openListDialog);
    loadWorkspace(workspace, initialWorkspaceStateRef.current);
    ensureVariables(workspace, variableNamesRef.current);
    ensureCloudVariables(workspace, cloudVariableNamesRef.current);
    refreshCustomDefinitionShapes(workspace);
    scheduleCustomDefinitionArgumentReporterRepair(workspace);
    refreshAllCustomCallShapes(workspace);
    let isHydratingWorkspace = true;

    const attachExplainContextMenus = () => {
      const blocks = workspace.getAllBlocks(false) as Blockly.BlockSvg[];

      for (const block of blocks) {
        block.customContextMenu = (options) => {
          options.unshift({
            text: "Explain with AI",
            enabled: true,
            callback: () => {
              void explainBlock(block.id);
            },
          });
          options.unshift({
            text: "Ask AI",
            enabled: true,
            callback: () => {
              openAskAi(block.id);
            },
          });
          if (block.type === "custom_define") {
            options.unshift({
              text: "Edit block",
              enabled: true,
              callback: () => {
                openCustomBlockDialog(block.id);
              },
            });
          }
        };
      }
    };

    const handleWorkspaceDoubleClick = (event: MouseEvent) => {
      const selected = Blockly.common.getSelected();
      if (!(selected instanceof Blockly.Block)) return;
      if (selected.workspace !== workspace || selected.type !== "custom_define") return;
      event.preventDefault();
      openCustomBlockDialog(selected.id);
    };

    let lastSelectedCustomDefinitionId: string | null = null;
    const updateSelectedCustomName = () => {
      const definitionBlock = getSelectedCustomDefinition(workspace);
      const nextSelectedCustomDefinitionId = definitionBlock?.id ?? null;
      setSelectedCustomName(definitionBlock ? getCustomBlockName(definitionBlock) : null);
      setSelectedCustomBlockId(nextSelectedCustomDefinitionId);
      if (lastSelectedCustomDefinitionId !== nextSelectedCustomDefinitionId) {
        lastSelectedCustomDefinitionId = nextSelectedCustomDefinitionId;
        workspace.refreshToolboxSelection();
      }
    };

    const emitWorkspaceChange = () => {
      const programs = blocklyToPrograms(workspace);
      onWorkspaceChangeRef.current(
        initialSpriteIdRef.current,
        saveWorkspace(workspace),
        programs.start,
        programs.cloneStart,
        programs.broadcasts,
        programs.backdrops,
      );
    };

    let lastCustomBlockNames = "";
    workspace.addChangeListener((event) => {
      updateSelectedCustomName();
      attachExplainContextMenus();

      const customNames = getCustomBlockNames(workspace).join(",");
      if (customNames !== lastCustomBlockNames) {
        lastCustomBlockNames = customNames;
        refreshCustomDefinitionShapes(workspace);
        refreshCustomCallFields(workspace);
        workspace.refreshToolboxSelection();
      }

      const changeEvent = event as unknown as Partial<{ type: string; blockId?: string; element?: string; name?: string }>;
      if (
        changeEvent.type === "create" ||
        changeEvent.type === "delete" ||
        changeEvent.type === "move" ||
        (changeEvent.type === "change" && changeEvent.element === "field")
      ) {
        repairAllCustomDefinitionArgumentReporters(workspace);
        scheduleCustomDefinitionArgumentReporterRepair(workspace);
        refreshAllCustomCallShapes(workspace);
        refreshListFields(workspace, listNamesRef.current);
      }

      if (event.isUiEvent) return;
      if (isHydratingWorkspace) return;
      emitWorkspaceChange();
    });

    attachExplainContextMenus();
    host.addEventListener("dblclick", handleWorkspaceDoubleClick);
    const hydrationTimer = window.setTimeout(() => {
      isHydratingWorkspace = false;
      emitWorkspaceChange();
    }, 0);

    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(workspace);
    });
    resizeObserver.observe(host);

    return () => {
      window.clearTimeout(hydrationTimer);
      for (const timer of customDefinitionRepairTimers.get(workspace) ?? []) window.clearTimeout(timer);
      customDefinitionRepairTimers.delete(workspace);
      host.removeEventListener("dblclick", handleWorkspaceDoubleClick);
      resizeObserver.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [explainBlock, onListWatcherVisibleChange, onVariableWatcherToggle, openAskAi, openCustomBlockDialog, openListDialog, openVariableDialog, targetType]);

  const generateCustomDefinition = async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const definitionBlock = selectedCustomBlockId ? workspace.getBlockById(selectedCustomBlockId) : null;
    if (!definitionBlock || !isCustomDefinitionBlock(definitionBlock)) {
      setAiMessage("Select a custom block definition first.");
      return;
    }

    const prompt = getCustomBlockName(definitionBlock).trim();
    if (!prompt) {
      setAiMessage("Name the custom block first.");
      return;
    }

    setIsGenerating(true);
    setAiMessage(null);

    try {
      const response = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, spriteName: activeSpriteName }),
      });
      const payload = await response.json() as AiProcessResponse;

      if (!response.ok || !payload.ast) {
        throw new Error(payload.error ?? "Could not generate blocks.");
      }

      insertAstUnderDefinition(definitionBlock, payload.ast);
      const programs = blocklyToPrograms(workspace);
      onWorkspaceChangeRef.current(
        initialSpriteIdRef.current,
        saveWorkspace(workspace),
        programs.start,
        programs.cloneStart,
        programs.broadcasts,
        programs.backdrops,
      );
      setAiMessage(payload.explanation ?? "Inserted generated blocks.");
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : "Could not generate blocks.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="neurix-blockly">
      {selectedCustomBlockId && (
        <div className="ai-generate-panel" onMouseDown={(event) => event.preventDefault()}>
          <button
            className="btn btn-primary"
            disabled={isGenerating}
            onClick={generateCustomDefinition}
            type="button"
          >
            {isGenerating ? "Generating..." : "Generate with AI"}
          </button>
          <span>{selectedCustomName ? selectedCustomName : "custom block"}</span>
          {aiMessage && <span>{aiMessage}</span>}
        </div>
      )}
      <div className="blockly-host" ref={hostRef} />
      {(explanation || isExplaining) && (
        <div className="ai-explain-card">
          <div className="ai-explain-card-header">
            <div>
              <p>AI Explain</p>
              <h3>{explanation?.title ?? "Explaining blocks"}</h3>
            </div>
            <button className="ai-explain-close" onClick={() => setExplanation(null)} type="button">
              Close
            </button>
          </div>
          {explanation?.error ? (
            <p className="ai-explain-error">{explanation.error}</p>
          ) : (
            <>
              <p className="ai-explain-summary">
                {explanation?.summary ?? "Reading this block stack..."}
              </p>
              {explanation?.steps && explanation.steps.length > 0 && (
                <div className="ai-explain-section">
                  <span>What happens</span>
                  <ol>
                    {explanation.steps.map((step, index) => (
                      <li key={`${step}-${index}`}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {askBlockId && (
        <div className="ai-ask-card">
          <div className="ai-ask-card-header">
            <div>
              <p>Ask AI</p>
              <h3>Question about these blocks</h3>
            </div>
            <button className="ai-explain-close" onClick={() => setAskBlockId(null)} type="button">
              Close
            </button>
          </div>
          <textarea
            className="ai-ask-input"
            value={askQuestion}
            onChange={(event) => setAskQuestion(event.target.value)}
            placeholder="Why does this move? How can I make it faster?"
            rows={3}
          />
          <div className="ai-ask-actions">
            <button className="btn btn-primary" disabled={isAsking} onClick={askAi} type="button">
              {isAsking ? "Asking..." : "Ask"}
            </button>
          </div>
          {askResponse?.error && <p className="ai-explain-error">{askResponse.error}</p>}
          {askResponse?.answer && (
            <div className="ai-ask-answer">
              <p>{askResponse.answer}</p>
            </div>
          )}
        </div>
      )}
      {isCustomBlockDialogOpen && (
        <div className="custom-block-dialog-backdrop" role="dialog" aria-modal="true" aria-label={editingCustomBlockId ? "Edit Block" : "Make a Block"}>
          <div className="custom-block-dialog">
            <div className="custom-block-dialog-header">
              <div>
                <h3>{editingCustomBlockId ? "Edit Block" : "Make a Block"}</h3>
                <span>{editingCustomBlockId ? "Change this block's name, inputs, and conditions." : "Create a simple reusable block for this project."}</span>
              </div>
              <button onClick={closeCustomBlockDialog} type="button" aria-label="Close">×</button>
            </div>

            <div className="custom-block-dialog-body">
              <label className="custom-block-name-field">
                <span>Block name</span>
                <input value={customBlockName} onChange={(event) => setCustomBlockName(event.target.value)} aria-label="Block name" autoFocus />
              </label>

              <div className="custom-block-preview-shell">
                <span className="custom-block-section-label">Preview</span>
                <div className="custom-block-preview">
                  <span>define</span>
                  <strong>{customBlockName.trim() || "block name"}</strong>
                  {customBlockParts.map((part) => (
                    <span className={`custom-block-chip custom-block-chip-${part.kind}`} key={part.id}>
                      <input
                        aria-label={part.kind === "label" ? "Label text" : "Input name"}
                        style={{ "--part-length": String((isCustomInputPart(part) ? part.name : part.text).length || 4) } as React.CSSProperties}
                        value={isCustomInputPart(part) ? part.name : part.text}
                        onChange={(event) => updateCustomBlockPart(part.id, event.target.value)}
                      />
                      <span className="custom-block-chip-controls">
                        <button className="custom-block-chip-move" disabled={customBlockParts[0]?.id === part.id} onClick={() => moveCustomBlockPart(part.id, -1)} type="button" title="Move left" aria-label="Move left">‹</button>
                        <button className="custom-block-chip-move" disabled={customBlockParts[customBlockParts.length - 1]?.id === part.id} onClick={() => moveCustomBlockPart(part.id, 1)} type="button" title="Move right" aria-label="Move right">›</button>
                        <button className="custom-block-chip-remove" onClick={() => removeCustomBlockPart(part.id)} type="button" title="Remove part" aria-label="Remove part">×</button>
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <span className="custom-block-section-label">Add to block</span>
              <div className="custom-block-options">
                <button onClick={() => addCustomBlockArg("value")} type="button">
                  <strong>123</strong>
                  <div>
                    <span>Input</span>
                    <small>number or text</small>
                  </div>
                </button>
                <button onClick={() => addCustomBlockArg("boolean")} type="button">
                  <strong>?</strong>
                  <div>
                    <span>Condition</span>
                    <small>true / false</small>
                  </div>
                </button>
              </div>

              <label className="custom-block-refresh-option">
                <input checked={runWithoutRefresh} onChange={(event) => setRunWithoutRefresh(event.target.checked)} type="checkbox" />
                Run without screen refresh
              </label>
            </div>
            <div className="custom-block-dialog-actions">
              <button onClick={closeCustomBlockDialog} type="button">Cancel</button>
              <button onClick={submitCustomBlockDialog} type="button">{editingCustomBlockId ? "Save changes" : "Create block"}</button>
            </div>
          </div>
        </div>
      )}
      {isVariableDialogOpen && (
        <div className="custom-block-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Make a Variable">
          <div className="custom-block-dialog variable-dialog">
            <div className="custom-block-dialog-header variable-dialog-header">
              <div>
                <h3>New Variable</h3>
                <span>Name it, choose where it lives, then use it from Variables.</span>
              </div>
              <button onClick={() => setIsVariableDialogOpen(false)} type="button" aria-label="Close">×</button>
            </div>
            <div className="variable-dialog-body">
              <label className="variable-name-field">
                <span>Variable name</span>
                <input value={variableName} onChange={(event) => setVariableName(event.target.value)} autoFocus />
              </label>
              <div className="variable-option-group">
                <span>Available to</span>
                <div>
                  <button className={variableScope === "project" ? "variable-option-active" : ""} onClick={() => setVariableScope("project")} type="button">All sprites</button>
                  <button className={variableScope === "sprite" ? "variable-option-active" : ""} disabled={targetType === "stage"} onClick={() => setVariableScope("sprite")} type="button">This sprite</button>
                  <button className={variableScope === "cloud" ? "variable-option-active" : ""} onClick={() => setVariableScope("cloud")} type="button">Cloud</button>
                </div>
              </div>
              <div className="variable-preview">
                <small>Creates</small>
                <span>{variableScope === "cloud" ? "☁ " : variableScope === "sprite" && targetType === "sprite" ? `${activeSpriteNameRef.current}: ` : ""}{variableName.trim() || "variable"}</span>
              </div>
              {variableScope === "cloud" && <p className="variable-helper-text">Cloud variables are shared across the project and store numbers only.</p>}
            </div>
            <div className="custom-block-dialog-actions">
              <button onClick={() => setIsVariableDialogOpen(false)} type="button">Cancel</button>
              <button onClick={submitVariableDialog} type="button">Create variable</button>
            </div>
          </div>
        </div>
      )}
      {isListDialogOpen && (
        <div className="custom-block-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Make a List">
          <div className="custom-block-dialog variable-dialog">
            <div className="custom-block-dialog-header variable-dialog-header">
              <div>
                <h3>New List</h3>
                <span>Name it, choose where it lives, then use it from Lists.</span>
              </div>
              <button onClick={() => setIsListDialogOpen(false)} type="button" aria-label="Close">×</button>
            </div>
            <div className="variable-dialog-body">
              <label className="variable-name-field">
                <span>List name</span>
                <input value={listName} onChange={(event) => setListName(event.target.value)} autoFocus />
              </label>
              <div className="variable-option-group">
                <span>Available to</span>
                <div>
                  <button className={listScope === "project" ? "variable-option-active" : ""} onClick={() => setListScope("project")} type="button">All sprites</button>
                  <button className={listScope === "sprite" ? "variable-option-active" : ""} disabled={targetType === "stage"} onClick={() => setListScope("sprite")} type="button">This sprite</button>
                </div>
              </div>
              <div className="variable-preview">
                <small>Creates</small>
                <span>{listScope === "sprite" && targetType === "sprite" ? `${activeSpriteNameRef.current}: ` : ""}{listName.trim() || "list"}</span>
              </div>
            </div>
            <div className="custom-block-dialog-actions">
              <button onClick={() => setIsListDialogOpen(false)} type="button">Cancel</button>
              <button onClick={submitListDialog} type="button">Create list</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
