"use client";

import { useEffect, useRef } from "react";
import type * as BlocklyType from "blockly";

const HERO_BLOCKS = [
  {
    type: "hero_when",
    message0: "when clicked",
    nextStatement: null,
    style: "event_blocks",
    hat: "cap",
  },
  {
    type: "hero_ai",
    message0: "ask AI for %1",
    args0: [{ type: "field_input", name: "PROMPT", text: "jump script" }],
    previousStatement: null,
    nextStatement: null,
    style: "custom_blocks",
  },
  {
    type: "hero_move",
    message0: "move %1 steps",
    args0: [{ type: "field_number", name: "STEPS", value: 10 }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "hero_bounce",
    message0: "if on edge, bounce",
    previousStatement: null,
    nextStatement: null,
    style: "motion_blocks",
  },
  {
    type: "hero_sound",
    message0: "play sound %1",
    args0: [{ type: "field_dropdown", name: "SOUND", options: [["pop", "pop"]] }],
    previousStatement: null,
    nextStatement: null,
    style: "sound_blocks",
  },
  {
    type: "hero_repeat",
    message0: "repeat %1",
    args0: [{ type: "field_number", name: "TIMES", value: 10, min: 1, precision: 1 }],
    message1: "%1",
    args1: [{ type: "input_statement", name: "DO" }],
    previousStatement: null,
    nextStatement: null,
    style: "control_blocks",
  },
];

const SCRIPT = {
  blocks: {
    blocks: [
      {
        type: "hero_when",
        x: 24,
        y: 24,
        next: {
          block: {
            type: "hero_ai",
            fields: { PROMPT: "jump script" },
            next: {
              block: {
                type: "hero_repeat",
                fields: { TIMES: 10 },
                inputs: {
                  DO: {
                    block: {
                      type: "hero_move",
                      fields: { STEPS: 10 },
                      next: {
                        block: {
                          type: "hero_bounce",
                          next: {
                            block: {
                              type: "hero_sound",
                              fields: { SOUND: "pop" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
};

function heroTheme(Blockly: typeof BlocklyType) {
  return Blockly.Theme.defineTheme("neurix_hero", {
    name: "neurix_hero",
    base: Blockly.Themes.Zelos,
    blockStyles: {
      event_blocks: { colourPrimary: "#4C97FF", colourSecondary: "#4280D7", colourTertiary: "#3373CC", hat: "cap" },
      motion_blocks: { colourPrimary: "#59C059", colourSecondary: "#46B946", colourTertiary: "#389438" },
      control_blocks: { colourPrimary: "#FFAB19", colourSecondary: "#EC9C13", colourTertiary: "#CF8B17" },
      sound_blocks: { colourPrimary: "#CF63CF", colourSecondary: "#C94FC9", colourTertiary: "#BD42BD" },
      custom_blocks: { colourPrimary: "#FF6680", colourSecondary: "#FF4D6A", colourTertiary: "#E0445F" },
    },
    componentStyles: {
      workspaceBackgroundColour: "transparent",
    },
    fontStyle: {
      family: "var(--font-geist-sans), sans-serif",
      size: 14,
      weight: "600",
    },
  });
}

export default function HeroBlocks() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let workspace: BlocklyType.WorkspaceSvg | undefined;
    let cancelled = false;
    let onResize: (() => void) | undefined;

    (async () => {
      const Blockly = await import("blockly");
      const host = hostRef.current;
      if (cancelled || !host) return;

      const toDefine = HERO_BLOCKS.filter((b) => !Blockly.Blocks[b.type]);
      if (toDefine.length) Blockly.common.defineBlocksWithJsonArray(toDefine);

      workspace = Blockly.inject(host, {
        renderer: "zelos",
        theme: heroTheme(Blockly),
        readOnly: true,
        trashcan: false,
        sounds: false,
        move: { drag: false, scrollbars: false, wheel: false },
        zoom: { controls: false, wheel: false, startScale: 0.85 },
      });

      Blockly.serialization.workspaces.load(SCRIPT, workspace);

      const fit = () => {
        if (!workspace) return;
        Blockly.svgResize(workspace);
        const box = workspace.getBlocksBoundingBox();
        const metrics = workspace.getMetrics();
        const pad = 18;
        const scale = Math.min(
          (metrics.viewWidth - pad * 2) / (box.right - box.left),
          (metrics.viewHeight - pad * 2) / (box.bottom - box.top),
          1,
        );
        workspace.setScale(scale);
        Blockly.svgResize(workspace);
        const m2 = workspace.getMetrics();
        const b2 = workspace.getBlocksBoundingBox();
        workspace.scroll(pad - b2.left * scale, pad - b2.top * scale + Math.max(0, (m2.viewHeight - (b2.bottom - b2.top) * scale - pad * 2) / 2));
      };

      fit();
      onResize = () => fit();
      window.addEventListener("resize", onResize);
    })();

    return () => {
      cancelled = true;
      if (onResize) window.removeEventListener("resize", onResize);
      if (workspace) workspace.dispose();
    };
  }, []);

  return <div ref={hostRef} className="lp-blockly" aria-hidden="true" />;
}
