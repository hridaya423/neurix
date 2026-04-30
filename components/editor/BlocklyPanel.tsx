"use client";

import { useEffect, useRef } from "react";
import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as BlocklyEn from "blockly/msg/en";
import { blocklyToAst } from "@/lib/compiler/blocklyToAst";
import type { ScriptNode } from "@/lib/compiler/types";

let customBlocksRegistered = false;

type BlocklyPanelProps = {
  activeSpriteId: string;
  workspaceState: string | null;
  onWorkspaceChange: (spriteId: string, workspaceState: string, program: ScriptNode[]) => void;
};

const CUSTOM_BLOCKS = [
  {
    type: "event_start",
    message0: "when start",
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
    type: "motion_go_home",
    message0: "go to center",
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
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
    type: "ai_define",
    message0: "define AI block %1",
    args0: [
      { type: "field_input", name: "PROMPT", text: "full movement" },
    ],
    nextStatement: null,
    style: "ai_blocks",
    hat: "cap",
  },
  {
    type: "ai_use",
    message0: "run AI block %1",
    args0: [
      { type: "field_input", name: "PROMPT", text: "full movement" },
    ],
    previousStatement: null,
    nextStatement: null,
    style: "ai_blocks",
  },
];

const TOOLBOX: Blockly.utils.toolbox.ToolboxInfo = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Events",
      categorystyle: "event_category",
      contents: [{ kind: "block", type: "event_start" }],
    },
    {
      kind: "category",
      name: "Motion",
      categorystyle: "motion_category",
      contents: [
        { kind: "block", type: "motion_move_steps" },
        { kind: "block", type: "motion_turn_degrees" },
        { kind: "block", type: "motion_set_xy" },
        { kind: "block", type: "motion_go_home" },
        { kind: "block", type: "math_number" },
      ],
    },
    {
      kind: "category",
      name: "Looks",
      categorystyle: "looks_category",
      contents: [{ kind: "block", type: "looks_say" }],
    },
    {
      kind: "category",
      name: "Control",
      categorystyle: "control_category",
      contents: [
        { kind: "block", type: "control_wait" },
        { kind: "block", type: "control_repeat_times" },
      ],
    },
    {
      kind: "category",
      name: "AI",
      categorystyle: "ai_category",
      contents: [
        { kind: "block", type: "ai_define" },
        { kind: "block", type: "ai_use" },
      ],
    },
    {
      kind: "category",
      name: "Operators",
      categorystyle: "operators_category",
      contents: [
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "math_arithmetic" },
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
    ai_blocks: {
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
    operators_category: { colour: "#FBBF24" },
    ai_category: { colour: "#56CBF9" },
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

function registerCustomBlocks() {
  Blockly.setLocale(BlocklyEn as unknown as Record<string, string>);
  if (customBlocksRegistered) return;
  Blockly.common.defineBlocksWithJsonArray(CUSTOM_BLOCKS);
  customBlocksRegistered = true;
}

export function BlocklyPanel({ activeSpriteId, workspaceState, onWorkspaceChange }: BlocklyPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const initialSpriteIdRef = useRef(activeSpriteId);
  const initialWorkspaceStateRef = useRef(workspaceState);
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);

  useEffect(() => {
    onWorkspaceChangeRef.current = onWorkspaceChange;
  }, [onWorkspaceChange]);

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
    loadWorkspace(workspace, initialWorkspaceStateRef.current);

    const emitWorkspaceChange = () => {
      onWorkspaceChangeRef.current(
        initialSpriteIdRef.current,
        saveWorkspace(workspace),
        blocklyToAst(workspace),
      );
    };

    workspace.addChangeListener((event) => {
      if (event.isUiEvent) return;
      emitWorkspaceChange();
    });

    emitWorkspaceChange();

    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(workspace);
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, []);

  return (
    <div className="neurix-blockly">
      <div className="blockly-host" ref={hostRef} />
    </div>
  );
}
