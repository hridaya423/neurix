"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlocklyPanel } from "../components/editor/BlocklyPanel";
import { astToJs } from "@/lib/compiler/astToJs";
import type { ScriptNode } from "@/lib/compiler/types";
import { runScript } from "@/lib/runtime/interpreter";

type Sprite = {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  direction: number;
  tone: string;
  workspaceState: string | null;
  program: ScriptNode[];
  sayText?: string;
};

const tones = ["#56CBF9", "#7FBEEB", "#AFBED1", "#EAC5D8", "#DBD8F0"];

const initialSprites: Sprite[] = [
  { id: "sprite-1", name: "Kite", x: 0, y: 0, size: 100, direction: 90, tone: "#56CBF9", workspaceState: null, program: [] },
  { id: "sprite-2", name: "Rook", x: -108, y: 56, size: 76, direction: 28, tone: "#7FBEEB", workspaceState: null, program: [] },
  { id: "sprite-3", name: "Moss", x: 122, y: 88, size: 64, direction: -18, tone: "#AFBED1", workspaceState: null, program: [] },
];

const stageRange = { minX: -240, maxX: 240, minY: -180, maxY: 180 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getStageStyle(sprite: Sprite): CSSProperties {
  const x = clamp(sprite.x, stageRange.minX, stageRange.maxX);
  const y = clamp(sprite.y, stageRange.minY, stageRange.maxY);
  const px = ((x - stageRange.minX) / (stageRange.maxX - stageRange.minX)) * 100;
  const py = ((stageRange.maxY - y) / (stageRange.maxY - stageRange.minY)) * 100;
  const size = clamp(16 + sprite.size * 0.2, 18, 42);
  return {
    left: `${px}%`,
    top: `${py}%`,
    width: `${size}px`,
    height: `${size}px`,
    transform: `translate(-50%, -50%) rotate(${sprite.direction}deg)`,
  };
}

function getStageBubbleStyle(sprite: Sprite): CSSProperties {
  const x = clamp(sprite.x, stageRange.minX, stageRange.maxX);
  const y = clamp(sprite.y, stageRange.minY, stageRange.maxY);
  const px = ((x - stageRange.minX) / (stageRange.maxX - stageRange.minX)) * 100;
  const py = ((stageRange.maxY - y) / (stageRange.maxY - stageRange.minY)) * 100;

  return {
    left: `${px}%`,
    top: `${py}%`,
  };
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export default function Home() {
  const [sprites, setSprites] = useState<Sprite[]>(initialSprites);
  const [activeId, setActiveId] = useState<string>(initialSprites[0].id);
  const [isRunning, setIsRunning] = useState(false);
  const runIdRef = useRef(0);
  const pressedKeysRef = useRef(new Set<string>());

  const activeSprite = useMemo(
    () => sprites.find((s) => s.id === activeId) ?? sprites[0],
    [activeId, sprites],
  );

  const activeGeneratedCode = useMemo(() => {
    return astToJs(activeSprite?.program ?? []);
  }, [activeSprite?.program]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      pressedKeysRef.current.add(event.key);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const updateActive = (changes: Partial<Sprite>) => {
    setSprites((curr) =>
      curr.map((s) => (s.id === activeId ? { ...s, ...changes } : s)),
    );
  };

  const updateSprite = useCallback((spriteId: string, changes: Partial<Sprite>) => {
    setSprites((curr) =>
      curr.map((sprite) => (sprite.id === spriteId ? { ...sprite, ...changes } : sprite)),
    );
  }, []);

  const handleWorkspaceChange = useCallback(
    (spriteId: string, workspaceState: string, program: ScriptNode[]) => {
      setSprites((curr) =>
        curr.map((sprite) =>
          sprite.id === spriteId ? { ...sprite, workspaceState, program } : sprite,
        ),
      );
    },
    [],
  );

  const addSprite = () => {
    const id = `sprite-${Date.now()}`;
    const tone = tones[sprites.length % tones.length];
    const next: Sprite = {
      id,
      name: `Sprite ${sprites.length + 1}`,
      x: Math.round((Math.random() - 0.5) * 200),
      y: Math.round((Math.random() - 0.5) * 140),
      size: 88,
      direction: 90,
      tone,
      workspaceState: null,
      program: [],
    };
    setSprites((curr) => [...curr, next]);
    setActiveId(id);
  };

  const duplicateSprite = () => {
    if (!activeSprite) return;
    const id = `sprite-${Date.now()}`;
    const copy: Sprite = {
      ...activeSprite,
      id,
      name: `${activeSprite.name} copy`,
      x: activeSprite.x + 16,
      y: activeSprite.y - 16,
    };
    setSprites((curr) => [...curr, copy]);
    setActiveId(id);
  };

  const deleteActive = () => {
    if (!activeSprite || sprites.length === 1) return;
    const filtered = sprites.filter((s) => s.id !== activeSprite.id);
    setSprites(filtered);
    setActiveId(filtered[0].id);
  };

  const runProgram = useCallback(
    async (spriteId: string, program: ScriptNode[], runId: number) => {
      await runScript(program, {
        isCancelled: () => runIdRef.current !== runId,
        wait,
        nextFrame: () => wait(16),
        keyDown: (key) => pressedKeysRef.current.has(key),
        move: (steps) => {
          setSprites((curr) =>
            curr.map((sprite) => {
              if (sprite.id !== spriteId) return sprite;
              const radians = (sprite.direction * Math.PI) / 180;
              return {
                ...sprite,
                x: clamp(sprite.x + Math.sin(radians) * steps, stageRange.minX, stageRange.maxX),
                y: clamp(sprite.y + Math.cos(radians) * steps, stageRange.minY, stageRange.maxY),
              };
            }),
          );
        },
        turn: (degrees) => {
          setSprites((curr) =>
            curr.map((sprite) =>
              sprite.id === spriteId
                ? { ...sprite, direction: (sprite.direction + degrees) % 360 }
                : sprite,
            ),
          );
        },
        setPosition: (x, y) => {
          updateSprite(spriteId, {
            x: clamp(x, stageRange.minX, stageRange.maxX),
            y: clamp(y, stageRange.minY, stageRange.maxY),
          });
        },
        changeX: (dx) => {
          setSprites((curr) =>
            curr.map((sprite) =>
              sprite.id === spriteId
                ? { ...sprite, x: clamp(sprite.x + dx, stageRange.minX, stageRange.maxX) }
                : sprite,
            ),
          );
        },
        changeY: (dy) => {
          setSprites((curr) =>
            curr.map((sprite) =>
              sprite.id === spriteId
                ? { ...sprite, y: clamp(sprite.y + dy, stageRange.minY, stageRange.maxY) }
                : sprite,
            ),
          );
        },
        say: (text) => {
          updateSprite(spriteId, { sayText: text });
        },
      });
    },
    [updateSprite],
  );

  const runAllSprites = async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setIsRunning(true);
    setSprites((curr) => curr.map((sprite) => ({ ...sprite, sayText: undefined })));

    const jobs = sprites.map((sprite) => runProgram(sprite.id, sprite.program, runId));
    await Promise.all(jobs);

    if (runIdRef.current === runId) {
      setIsRunning(false);
    }
  };

  const stopAllSprites = () => {
    runIdRef.current += 1;
    setIsRunning(false);
    setSprites((curr) => curr.map((sprite) => ({ ...sprite, sayText: undefined })));
  };

  const resetSprites = () => {
    stopAllSprites();
    setSprites((curr) =>
      curr.map((sprite) => ({ ...sprite, x: 0, y: 0, direction: 90, sayText: undefined })),
    );
  };

  return (
    <div className="studio">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>


      <header className="toolbar">
        <div className="toolbar-left">
          <div className="toolbar-brand">
            <div className="toolbar-brand-mark">
              <div className="toolbar-brand-mark-inner" />
            </div>
            Neurix
          </div>
          <input
            className="toolbar-project-name"
            defaultValue="Untitled Project"
            aria-label="Project name"
          />
        </div>

        <div className="toolbar-right">
          <button className="btn btn-ghost" type="button">
            Share
          </button>
          <button className="btn btn-secondary" type="button">
            Tutorials
          </button>
          <button className="btn btn-primary" type="button">
            Save
          </button>
        </div>
      </header>


      <div className="main-grid">

        <section className="workspace-area" id="workspace">
          <div className="workspace-card">
            <div className="workspace-header">
              <div>
                <div className="workspace-title">Scripts</div>
                <div className="workspace-subtitle">
                  Build behavior with blocks
                </div>
              </div>
              <div className="workspace-actions">
                <button
                  className="btn btn-primary"
                  style={{ height: 32, padding: "0 16px", fontSize: "0.82rem" }}
                  onClick={runAllSprites}
                  type="button"
                >
                  {isRunning ? "Running" : "Run"}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ height: 32, padding: "0 16px", fontSize: "0.82rem" }}
                  onClick={stopAllSprites}
                  type="button"
                >
                  Stop
                </button>
              </div>
            </div>
            <div className="workspace-body">
              {activeSprite && (
                <BlocklyPanel
                  key={activeSprite.id}
                  activeSpriteId={activeSprite.id}
                  workspaceState={activeSprite.workspaceState}
                  onWorkspaceChange={handleWorkspaceChange}
                />
              )}
            </div>
          </div>
        </section>


        <aside className="right-panel">

          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title">Stage</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-ghost"
                  style={{ height: 26, padding: "0 10px", fontSize: "0.75rem" }}
                  onClick={resetSprites}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="stage-viewport">
              <div className="stage-grid-bg" />
              {sprites.map((sprite) => (
                <div
                  key={sprite.id}
                  className={`stage-sprite ${sprite.id === activeId ? "stage-sprite-active" : ""}`}
                  style={getStageStyle(sprite)}
                >
                  <div
                    className="stage-sprite-core"
                    style={{ color: sprite.tone }}
                  />
                </div>
              ))}
              {sprites.map((sprite) =>
                sprite.sayText ? (
                  <div
                    className="stage-speech-bubble"
                    key={`${sprite.id}-speech`}
                    style={getStageBubbleStyle(sprite)}
                  >
                    {sprite.sayText}
                  </div>
                ) : null,
              )}
              <div className="stage-empty">
                <p className="stage-empty-title">Press Run to preview</p>
                <p className="stage-empty-sub">
                  Selected: {activeSprite?.name ?? "none"}
                </p>
              </div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <span className="panel-title">Sprites</span>
              <button
                className="btn btn-ghost"
                style={{ height: 26, padding: "0 10px", fontSize: "0.75rem" }}
                onClick={addSprite}
                type="button"
              >
                Add
              </button>
            </div>
            <div className="sprite-strip">
              {sprites.map((sprite) => (
                <button
                  key={sprite.id}
                  className={`sprite-item ${sprite.id === activeId ? "sprite-item-active" : ""}`}
                  data-name={sprite.name}
                  onClick={() => setActiveId(sprite.id)}
                  type="button"
                >
                  <div
                    className="sprite-item-core"
                    style={{ backgroundColor: sprite.tone }}
                  />
                </button>
              ))}
              <button
                className="sprite-item sprite-item-add"
                onClick={addSprite}
                type="button"
                aria-label="Add sprite"
              >
                +
              </button>
            </div>


            {activeSprite && (
              <div className="inspector">
                <div className="inspector-row">
                  <div
                    className="inspector-avatar"
                    style={{ backgroundColor: activeSprite.tone }}
                  />
                  <input
                    className="inspector-name-input"
                    value={activeSprite.name}
                    onChange={(e) => updateActive({ name: e.target.value })}
                    aria-label="Sprite name"
                  />
                </div>
                <div className="inspector-grid">
                  <div className="inspector-cell">
                    <label>x</label>
                    <input
                      type="number"
                      value={activeSprite.x}
                      onChange={(e) => updateActive({ x: Number(e.target.value) || 0 })}
                      aria-label="X position"
                    />
                  </div>
                  <div className="inspector-cell">
                    <label>y</label>
                    <input
                      type="number"
                      value={activeSprite.y}
                      onChange={(e) => updateActive({ y: Number(e.target.value) || 0 })}
                      aria-label="Y position"
                    />
                  </div>
                  <div className="inspector-cell">
                    <label>size</label>
                    <input
                      type="number"
                      value={activeSprite.size}
                      onChange={(e) => updateActive({ size: Number(e.target.value) || 0 })}
                      aria-label="Size"
                    />
                  </div>
                  <div className="inspector-cell">
                    <label>dir</label>
                    <input
                      type="number"
                      value={activeSprite.direction}
                      onChange={(e) => updateActive({ direction: Number(e.target.value) || 0 })}
                      aria-label="Direction"
                    />
                  </div>
                </div>
                <div className="inspector-actions">
                  <button
                    className="btn btn-ghost"
                    style={{ height: 28, padding: "0 10px", fontSize: "0.75rem" }}
                    type="button"
                  >
                    Show
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ height: 28, padding: "0 10px", fontSize: "0.75rem" }}
                    onClick={duplicateSprite}
                    type="button"
                  >
                    Duplicate
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{
                      height: 28,
                      padding: "0 10px",
                      fontSize: "0.75rem",
                      opacity: sprites.length === 1 ? 0.4 : 1,
                      cursor: sprites.length === 1 ? "not-allowed" : "pointer",
                    }}
                    disabled={sprites.length === 1}
                    onClick={deleteActive}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
                <details className="code-preview">
                  <summary>Generated JS</summary>
                  <pre>{activeGeneratedCode}</pre>
                </details>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
