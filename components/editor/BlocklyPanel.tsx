"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as BlocklyEn from "blockly/msg/en";
import { blocklyToAst, blocklyToPrograms, blockStackToAst } from "@/lib/compiler/blocklyToAst";
import type { ScriptNode, ScriptProgram } from "@/lib/compiler/types";
import { insertAstUnderDefinition } from "@/lib/blockly/astToBlockly";

let customBlocksRegistered = false;

type BlocklyPanelProps = {
  activeSpriteId: string;
  activeSpriteName: string;
  workspaceState: string | null;
  onWorkspaceChange: (spriteId: string, workspaceState: string, program: ScriptProgram, cloneProgram: ScriptProgram) => void;
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

const KEY_OPTIONS = [
  ["space", " "], ["enter", "Enter"], ["tab", "Tab"], ["backspace", "Backspace"], ["escape", "Escape"],
  ["up arrow", "ArrowUp"], ["down arrow", "ArrowDown"], ["left arrow", "ArrowLeft"], ["right arrow", "ArrowRight"],
  ["shift", "Shift"], ["control", "Control"], ["alt", "Alt"], ["meta", "Meta"],
  ..."abcdefghijklmnopqrstuvwxyz".split("").map((key) => [key, key] as [string, string]),
  ..."0123456789".split("").map((key) => [key, key] as [string, string]),
  ["-", "-"], ["=", "="], ["[", "["], ["]", "]"], [";", ";"], ["'", "'"], [",", ","], [".", "."], ["/", "/"], ["\\", "\\"],
] satisfies [string, string][];

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
    type: "motion_move_steps",
    message0: "move %1 steps",
    args0: [
      { type: "field_number", name: "STEPS", value: 10 },
    ],
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
      custom: "VARIABLE",
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

function saveWorkspace(workspace: Blockly.WorkspaceSvg) {
  return JSON.stringify(Blockly.serialization.workspaces.save(workspace));
}

function loadWorkspace(workspace: Blockly.WorkspaceSvg, state: string | null) {
  workspace.clear();
  if (!state) {
    seedWorkspace(workspace);
    return;
  }

  try {
    Blockly.serialization.workspaces.load(JSON.parse(state), workspace);
  } catch {
    seedWorkspace(workspace);
  }
}

function getCustomBlockNames(workspace: Blockly.Workspace) {
  const names: string[] = [];
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === "custom_define" || block.type === "ai_define") {
      const name = String(block.getFieldValue("NAME") ?? block.getFieldValue("PROMPT") ?? "").trim();
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names.sort();
}

function getCustomBlockDropdownOptions(workspace: Blockly.Workspace): [string, string][] {
  const names = getCustomBlockNames(workspace);
  return names.length > 0 ? names.map((name) => [name, name] as [string, string]) : [["(no blocks yet)", ""]];
}

function customBlocksFlyout(workspace: Blockly.Workspace): Blockly.utils.toolbox.FlyoutItemInfoArray {
  const names = getCustomBlockNames(workspace);
  const items: Blockly.utils.toolbox.FlyoutItemInfoArray = [
    { kind: "button", text: "Create block", callbackkey: "CREATE_CUSTOM_BLOCK" },
  ];
  if (names.length > 0) {
    items.push({ kind: "block", type: "custom_call" });
  }
  return items as unknown as Blockly.utils.toolbox.FlyoutItemInfoArray;
}

function createCustomDefinition(workspace: Blockly.WorkspaceSvg) {
  const rawName = window.prompt("Name this block", "full movement");
  const name = rawName?.trim().replace(/\s+/g, " ");
  if (!name) return;

  const definitionCount = workspace.getTopBlocks(false).filter((item) => item.type === "custom_define").length;
  const block = workspace.newBlock("custom_define") as Blockly.BlockSvg;
  block.setFieldValue(name, "NAME");
  block.initSvg();
  block.render();
  block.moveBy(260, 150 + definitionCount * 64);
  workspace.refreshToolboxSelection();
}

function registerCustomFlyout(workspace: Blockly.WorkspaceSvg) {
  workspace.registerToolboxCategoryCallback("CUSTOM_BLOCKS", customBlocksFlyout);
  workspace.registerButtonCallback("CREATE_CUSTOM_BLOCK", () => createCustomDefinition(workspace));
}

function registerCustomBlocks() {
  Blockly.setLocale(BlocklyEn as unknown as Record<string, string>);
  if (customBlocksRegistered) return;
  Blockly.common.defineBlocksWithJsonArray(CUSTOM_BLOCKS);

  Blockly.Blocks["custom_define"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("define")
        .appendField(new Blockly.FieldTextInput("full movement"), "NAME");
      this.setNextStatement(true);
      this.setStyle("custom_blocks");
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
              field.getOptions(false);
              field.setValue(newName);
            }
          }
        }
      }
    },
  };

  Blockly.Blocks["custom_call"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("run")
        .appendField(
          new Blockly.FieldDropdown(function () {
            const sourceBlock = this.getSourceBlock();
            if (!sourceBlock) return [["(no blocks yet)", ""]];
            return getCustomBlockDropdownOptions(sourceBlock.workspace);
          }),
          "NAME",
        );
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setStyle("custom_blocks");
    },
  };

  customBlocksRegistered = true;
}

function refreshCustomCallFields(workspace: Blockly.Workspace) {
  const names = getCustomBlockNames(workspace);
  for (const block of workspace.getBlocksByType("custom_call", false)) {
    const field = block.getField("NAME");
    if (!field) continue;
    const current = field.getValue();
    if (names.length > 0 && !names.includes(current)) {
      field.setValue(names[0]);
    }
  }
}

function getCustomBlockName(block: Blockly.Block) {
  return block.getField("NAME")?.getText() ?? String(block.getFieldValue("PROMPT") ?? "");
}

function isCustomDefinitionBlock(block: Blockly.Block) {
  return block.type === "custom_define" || block.type === "ai_define";
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

export function BlocklyPanel({ activeSpriteId, activeSpriteName, workspaceState, onWorkspaceChange }: BlocklyPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const initialSpriteIdRef = useRef(activeSpriteId);
  const activeSpriteNameRef = useRef(activeSpriteName);
  const initialWorkspaceStateRef = useRef(workspaceState);
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
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

  useEffect(() => {
    onWorkspaceChangeRef.current = onWorkspaceChange;
  }, [onWorkspaceChange]);

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
      toolbox: TOOLBOX,
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
    registerCustomFlyout(workspace);
    loadWorkspace(workspace, initialWorkspaceStateRef.current);
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
        };
      }
    };

    const updateSelectedCustomName = () => {
      const definitionBlock = getSelectedCustomDefinition(workspace);
      setSelectedCustomName(definitionBlock ? getCustomBlockName(definitionBlock) : null);
      setSelectedCustomBlockId(definitionBlock?.id ?? null);
    };

    const emitWorkspaceChange = () => {
      const programs = blocklyToPrograms(workspace);
      onWorkspaceChangeRef.current(
        initialSpriteIdRef.current,
        saveWorkspace(workspace),
        programs.start,
        programs.cloneStart,
      );
    };

    let lastCustomBlockNames = "";
    workspace.addChangeListener((event) => {
      updateSelectedCustomName();
      attachExplainContextMenus();

      const customNames = getCustomBlockNames(workspace).join(",");
      if (customNames !== lastCustomBlockNames) {
        lastCustomBlockNames = customNames;
        refreshCustomCallFields(workspace);
        workspace.refreshToolboxSelection();
      }

      if (event.isUiEvent) return;
      if (isHydratingWorkspace) return;
      emitWorkspaceChange();
    });

    attachExplainContextMenus();
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
      resizeObserver.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [explainBlock, openAskAi]);

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
    </div>
  );
}
