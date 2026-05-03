"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as BlocklyEn from "blockly/msg/en";
import { blocklyToAst, blockStackToAst } from "@/lib/compiler/blocklyToAst";
import type { ScriptNode } from "@/lib/compiler/types";
import { insertAstUnderDefinition } from "@/lib/blockly/astToBlockly";

let customBlocksRegistered = false;

type BlocklyPanelProps = {
  activeSpriteId: string;
  activeSpriteName: string;
  workspaceState: string | null;
  onWorkspaceChange: (spriteId: string, workspaceState: string, program: ScriptNode[]) => void;
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
    type: "motion_change_x",
    message0: "change x by %1",
    args0: [{ type: "field_number", name: "DX", value: 10 }],
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
    type: "motion_change_y",
    message0: "change y by %1",
    args0: [{ type: "field_number", name: "DY", value: 10 }],
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
    type: "motion_point_direction",
    message0: "point in direction %1",
    args0: [{ type: "field_angle", name: "DIRECTION", angle: 90 }],
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
    type: "looks_think",
    message0: "think %1",
    args0: [{ type: "field_input", name: "TEXT", text: "Hmm" }],
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
    type: "looks_set_size",
    message0: "set size to %1 %",
    args0: [{ type: "field_number", name: "SIZE", value: 100, min: 1 }],
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
        options: [
          ["up arrow", "ArrowUp"],
          ["down arrow", "ArrowDown"],
          ["left arrow", "ArrowLeft"],
          ["right arrow", "ArrowRight"],
          ["space", "Space"],
        ],
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
        { kind: "block", type: "motion_change_x" },
        { kind: "block", type: "motion_set_x" },
        { kind: "block", type: "motion_change_y" },
        { kind: "block", type: "motion_set_y" },
        { kind: "block", type: "motion_point_direction" },
        { kind: "block", type: "motion_if_on_edge_bounce" },
        { kind: "block", type: "math_number" },
      ],
    },
    {
      kind: "category",
      name: "Looks",
      categorystyle: "looks_category",
      contents: [
        { kind: "block", type: "looks_say" },
        { kind: "block", type: "looks_say_for_seconds" },
        { kind: "block", type: "looks_think" },
        { kind: "block", type: "looks_think_for_seconds" },
        { kind: "block", type: "looks_clear_speech" },
        { kind: "block", type: "looks_change_size" },
        { kind: "block", type: "looks_set_size" },
        { kind: "block", type: "looks_show" },
        { kind: "block", type: "looks_hide" },
      ],
    },
    {
      kind: "category",
      name: "Control",
      categorystyle: "control_category",
      contents: [
        { kind: "block", type: "control_wait" },
        { kind: "block", type: "control_repeat_times" },
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
        { kind: "block", type: "operator_compare_numbers" },
        { kind: "block", type: "operator_and" },
        { kind: "block", type: "operator_or" },
        { kind: "block", type: "operator_not" },
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
    sensing_category: { colour: "#22C55E" },
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

function getSelectedAiDefinition(workspace: Blockly.WorkspaceSvg) {
  const selected = Blockly.common.getSelected();
  if (!(selected instanceof Blockly.Block)) return null;
  if (selected.workspace !== workspace || selected.type !== "ai_define") return null;
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
  const [selectedAiPrompt, setSelectedAiPrompt] = useState<string | null>(null);
  const [selectedAiBlockId, setSelectedAiBlockId] = useState<string | null>(null);
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

    const updateSelectedAiPrompt = () => {
      const definitionBlock = getSelectedAiDefinition(workspace);
      setSelectedAiPrompt(definitionBlock ? String(definitionBlock.getFieldValue("PROMPT") ?? "") : null);
      setSelectedAiBlockId(definitionBlock?.id ?? null);
    };

    const emitWorkspaceChange = () => {
      onWorkspaceChangeRef.current(
        initialSpriteIdRef.current,
        saveWorkspace(workspace),
        blocklyToAst(workspace),
      );
    };

    workspace.addChangeListener((event) => {
      updateSelectedAiPrompt();
      attachExplainContextMenus();
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

  const generateAiDefinition = async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const definitionBlock = selectedAiBlockId ? workspace.getBlockById(selectedAiBlockId) : null;
    if (!definitionBlock || definitionBlock.type !== "ai_define") {
      setAiMessage("Select an AI definition block first.");
      return;
    }

    const prompt = String(definitionBlock.getFieldValue("PROMPT") ?? "").trim();
    if (!prompt) {
      setAiMessage("Name the AI block first.");
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
      onWorkspaceChangeRef.current(
        initialSpriteIdRef.current,
        saveWorkspace(workspace),
        blocklyToAst(workspace),
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
      {selectedAiBlockId && (
        <div className="ai-generate-panel" onMouseDown={(event) => event.preventDefault()}>
          <button
            className="btn btn-primary"
            disabled={isGenerating}
            onClick={generateAiDefinition}
            type="button"
          >
            {isGenerating ? "Generating..." : "Generate with AI"}
          </button>
          <span>{selectedAiPrompt ? selectedAiPrompt : "AI definition"}</span>
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
