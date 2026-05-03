"use client";

import Link from "next/link";
import type { CSSProperties, PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlocklyPanel } from "./BlocklyPanel";
import { astToJs } from "@/lib/compiler/astToJs";
import type { ScriptNode, ScriptProgram } from "@/lib/compiler/types";
import { runScript } from "@/lib/runtime/interpreter";
import {
  Play,
  Square,
  Save,
  RotateCcw,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
} from "lucide-react";

export type SavedSprite = {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  direction: number;
  tone: string;
  visible: boolean;
  workspaceState: string | null;
  program: ScriptProgram;
  cloneProgram?: ScriptProgram;
  sayText?: string;
  isClone?: boolean;
  sourceId?: string;
};

export type ProjectDocument = {
  version: number;
  stage: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    background: string | null;
  };
  sprites: SavedSprite[];
};

type NeurixEditorProps = {
  initialName?: string;
  initialDocument?: ProjectDocument;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onChange?: (name: string, document: ProjectDocument) => void;
  onSave?: (name: string, document: ProjectDocument) => void | Promise<void>;
};

const tones = ["#56CBF9", "#7FBEEB", "#AFBED1", "#EAC5D8", "#DBD8F0"];

const initialSprites: SavedSprite[] = [
  { id: "sprite-1", name: "Kite", x: 0, y: 0, size: 100, direction: 90, tone: "#56CBF9", visible: true, workspaceState: null, program: [], cloneProgram: [] },
  { id: "sprite-2", name: "Rook", x: -108, y: 56, size: 76, direction: 28, tone: "#7FBEEB", visible: true, workspaceState: null, program: [], cloneProgram: [] },
  { id: "sprite-3", name: "Moss", x: 122, y: 88, size: 64, direction: -18, tone: "#AFBED1", visible: true, workspaceState: null, program: [], cloneProgram: [] },
];

function normalizeProgram(program: unknown): ScriptProgram {
  if (!Array.isArray(program) || program.length === 0) return [];
  return Array.isArray(program[0]) ? program as ScriptProgram : [program as ScriptNode[]];
}

function flattenProgram(program: ScriptProgram) {
  return program.flat();
}

function normalizeSprite(sprite: SavedSprite): SavedSprite {
  return {
    ...sprite,
    program: normalizeProgram(sprite.program),
    cloneProgram: normalizeProgram(sprite.cloneProgram),
  };
}

const stageRange = { minX: -240, maxX: 240, minY: -180, maxY: 180 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getStageStyle(sprite: SavedSprite): CSSProperties {
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

function getStageBubbleStyle(sprite: SavedSprite): CSSProperties {
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

function normalizeDirection(direction: number) {
  return ((direction % 360) + 360) % 360;
}

export function createDefaultProjectDocument(): ProjectDocument {
  return {
    version: 1,
    stage: { ...stageRange, background: null },
    sprites: initialSprites,
  };
}

export default function NeurixEditor({
  initialName = "Untitled Project",
  initialDocument = createDefaultProjectDocument(),
  saveStatus = "idle",
  onChange,
  onSave,
}: NeurixEditorProps) {
  const [projectName, setProjectName] = useState(initialName);
  const [sprites, setSprites] = useState<SavedSprite[]>(() =>
    (initialDocument.sprites.length > 0 ? initialDocument.sprites : initialSprites).map(normalizeSprite),
  );
  const [activeId, setActiveId] = useState<string>((initialDocument.sprites[0] ?? initialSprites[0]).id);
  const [isRunning, setIsRunning] = useState(false);
  const runIdRef = useRef(0);
  const deletedCloneIdsRef = useRef(new Set<string>());
  const pressedKeysRef = useRef(new Set<string>());
  const lastKeyRef = useRef("");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const timerStartRef = useRef(0);
  const spritesRef = useRef(sprites);
  const runProgramRef = useRef<((spriteId: string, program: ScriptProgram, runId: number) => Promise<void>) | null>(null);

  const activeSprite = useMemo(
    () => sprites.find((s) => s.id === activeId) ?? sprites[0],
    [activeId, sprites],
  );

  const activeGeneratedCode = useMemo(() => {
    return astToJs(flattenProgram(activeSprite?.program ?? []));
  }, [activeSprite?.program]);

  const projectDocument = useMemo<ProjectDocument>(() => ({
    version: 1,
    stage: { ...stageRange, background: initialDocument.stage.background },
    sprites: sprites.filter((sprite) => !sprite.isClone).map((sprite) => ({
      id: sprite.id,
      name: sprite.name,
      x: sprite.x,
      y: sprite.y,
      size: sprite.size,
      direction: sprite.direction,
      tone: sprite.tone,
      visible: sprite.visible,
      workspaceState: sprite.workspaceState,
      program: sprite.program,
      cloneProgram: sprite.cloneProgram ?? [],
    })),
  }), [initialDocument.stage.background, sprites]);

  useEffect(() => {
    spritesRef.current = sprites;
  }, [sprites]);

  useEffect(() => {
    timerStartRef.current = Date.now();
  }, []);

  useEffect(() => {
    onChange?.(projectName, projectDocument);
  }, [onChange, projectDocument, projectName]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      pressedKeysRef.current.add(event.key);
      lastKeyRef.current = event.key;
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key);
    };
    const handlePointerUp = () => {
      mouseRef.current.down = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    if (saveStatus !== "idle") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  const updateActive = (changes: Partial<SavedSprite>) => {
    setSprites((curr) =>
      curr.map((s) => (s.id === activeId ? { ...s, ...changes } : s)),
    );
  };

  const updateSprite = useCallback((spriteId: string, changes: Partial<SavedSprite>) => {
    setSprites((curr) =>
      curr.map((sprite) => (sprite.id === spriteId ? { ...sprite, ...changes } : sprite)),
    );
  }, []);

  const updateMousePosition = (event: PointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratioX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const ratioY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    mouseRef.current.x = Math.round(stageRange.minX + ratioX * (stageRange.maxX - stageRange.minX));
    mouseRef.current.y = Math.round(stageRange.maxY - ratioY * (stageRange.maxY - stageRange.minY));
  };

  const handleWorkspaceChange = useCallback(
    (spriteId: string, workspaceState: string, program: ScriptProgram, cloneProgram: ScriptProgram) => {
      setSprites((curr) =>
        curr.map((sprite) =>
          sprite.id === spriteId ? { ...sprite, workspaceState, program, cloneProgram } : sprite,
        ),
      );
    },
    [],
  );

  const addSprite = () => {
    const id = `sprite-${Date.now()}`;
    const tone = tones[sprites.length % tones.length];
    const next: SavedSprite = {
      id,
      name: `Sprite ${sprites.length + 1}`,
      x: Math.round((Math.random() - 0.5) * 200),
      y: Math.round((Math.random() - 0.5) * 140),
      size: 88,
      direction: 90,
      tone,
      visible: true,
      workspaceState: null,
      program: [],
    };
    setSprites((curr) => [...curr, next]);
    setActiveId(id);
  };

  const duplicateSprite = () => {
    if (!activeSprite) return;
    const id = `sprite-${Date.now()}`;
    const copy: SavedSprite = {
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
        isCancelled: () => runIdRef.current !== runId || deletedCloneIdsRef.current.has(spriteId),
        wait,
        nextFrame: () => wait(16),
        keyDown: (key) => pressedKeysRef.current.has(key) || (key === "Space" && pressedKeysRef.current.has(" ")),
        anyKeyDown: () => pressedKeysRef.current.size > 0,
        lastKey: () => lastKeyRef.current,
        mouseDown: () => mouseRef.current.down,
        getMouseX: () => mouseRef.current.x,
        getMouseY: () => mouseRef.current.y,
        getTimerSeconds: () => (Date.now() - timerStartRef.current) / 1000,
        getX: () => spritesRef.current.find((item) => item.id === spriteId)?.x ?? 0,
        getY: () => spritesRef.current.find((item) => item.id === spriteId)?.y ?? 0,
        getDirection: () => spritesRef.current.find((item) => item.id === spriteId)?.direction ?? 90,
        getSize: () => spritesRef.current.find((item) => item.id === spriteId)?.size ?? 100,
        touchingEdge: () => {
          const sprite = spritesRef.current.find((item) => item.id === spriteId);
          if (!sprite) return false;
          const padding = clamp(sprite.size * 0.12, 4, 36);
          return sprite.x <= stageRange.minX + padding || sprite.x >= stageRange.maxX - padding || sprite.y <= stageRange.minY + padding || sprite.y >= stageRange.maxY - padding;
        },
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
        setX: (x) => {
          updateSprite(spriteId, { x: clamp(x, stageRange.minX, stageRange.maxX) });
        },
        setY: (y) => {
          updateSprite(spriteId, { y: clamp(y, stageRange.minY, stageRange.maxY) });
        },
        setDirection: (direction) => {
          updateSprite(spriteId, { direction: normalizeDirection(direction) });
        },
        ifOnEdgeBounce: () => {
          setSprites((curr) =>
            curr.map((sprite) => {
              if (sprite.id !== spriteId) return sprite;
              const padding = clamp(sprite.size * 0.12, 4, 36);
              const minX = stageRange.minX + padding;
              const maxX = stageRange.maxX - padding;
              const minY = stageRange.minY + padding;
              const maxY = stageRange.maxY - padding;
              const hitX = sprite.x <= minX || sprite.x >= maxX;
              const hitY = sprite.y <= minY || sprite.y >= maxY;
              if (!hitX && !hitY) return sprite;

              let nextDirection = sprite.direction;
              if (hitX && hitY) nextDirection += 180;
              else if (hitX) nextDirection = 360 - sprite.direction;
              else nextDirection = 180 - sprite.direction;

              return {
                ...sprite,
                x: clamp(sprite.x, minX, maxX),
                y: clamp(sprite.y, minY, maxY),
                direction: normalizeDirection(nextDirection),
              };
            }),
          );
        },
        say: (text) => {
          updateSprite(spriteId, { sayText: text });
        },
        changeSize: (amount) => {
          setSprites((curr) =>
            curr.map((sprite) =>
              sprite.id === spriteId
                ? { ...sprite, size: clamp(sprite.size + amount, 1, 300) }
                : sprite,
            ),
          );
        },
        setSize: (size) => {
          updateSprite(spriteId, { size: clamp(size, 1, 300) });
        },
        setTone: (tone) => {
          updateSprite(spriteId, { tone });
        },
        changeTone: (amount) => {
          setSprites((curr) =>
            curr.map((sprite) => {
              if (sprite.id !== spriteId) return sprite;
              const currentIndex = Math.max(0, tones.indexOf(sprite.tone));
              const nextIndex = ((currentIndex + Math.round(amount)) % tones.length + tones.length) % tones.length;
              return { ...sprite, tone: tones[nextIndex] };
            }),
          );
        },
        createClone: () => {
          const source = spritesRef.current.find((item) => item.id === spriteId);
          if (!source) return;
          const baseId = source.sourceId ?? source.id;
          const base = spritesRef.current.find((item) => item.id === baseId) ?? source;
          const cloneCount = spritesRef.current.filter((item) => item.isClone).length;
          if (cloneCount >= 50) return;
          const cloneId = `clone-${baseId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const clone: SavedSprite = {
            ...source,
            id: cloneId,
            name: `${base.name} clone`,
            sourceId: baseId,
            isClone: true,
            workspaceState: base.workspaceState,
            program: base.program,
            cloneProgram: base.cloneProgram ?? [],
            sayText: undefined,
          };
          setSprites((curr) => [...curr, clone]);
          spritesRef.current = [...spritesRef.current, clone];
          if ((base.cloneProgram ?? []).length > 0) {
            void runProgramRef.current?.(cloneId, base.cloneProgram ?? [], runId);
          }
        },
        deleteClone: () => {
          const sprite = spritesRef.current.find((item) => item.id === spriteId);
          if (!sprite?.isClone) return;
          deletedCloneIdsRef.current.add(spriteId);
          spritesRef.current = spritesRef.current.filter((item) => item.id !== spriteId);
          setSprites((curr) => curr.filter((item) => item.id !== spriteId));
        },
        show: () => {
          updateSprite(spriteId, { visible: true });
        },
        hide: () => {
          updateSprite(spriteId, { visible: false, sayText: undefined });
        },
      });
    },
    [updateSprite],
  );

  const runProgramStacks = useCallback(
    async (spriteId: string, program: ScriptProgram, runId: number) => {
      await Promise.all(program.map((stack) => runProgram(spriteId, stack, runId)));
    },
    [runProgram],
  );

  useEffect(() => {
    runProgramRef.current = runProgramStacks;
  }, [runProgramStacks]);

  const runAllSprites = async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    deletedCloneIdsRef.current.clear();
    timerStartRef.current = Date.now();
    setIsRunning(true);
    const runnableSprites = sprites.filter((sprite) => !sprite.isClone);
    setSprites(runnableSprites.map((sprite) => ({ ...sprite, sayText: undefined })));
    spritesRef.current = runnableSprites.map((sprite) => ({ ...sprite, sayText: undefined }));

    const jobs = runnableSprites.map((sprite) => runProgramStacks(sprite.id, sprite.program, runId));
    await Promise.all(jobs);

    if (runIdRef.current === runId) {
      setIsRunning(false);
    }
  };

  const saveProject = async () => {
    await onSave?.(projectName, projectDocument);
  };

  const stopAllSprites = () => {
    runIdRef.current += 1;
    deletedCloneIdsRef.current.clear();
    setIsRunning(false);
    setSprites((curr) => curr.filter((sprite) => !sprite.isClone).map((sprite) => ({ ...sprite, sayText: undefined })));
  };

  const resetSprites = () => {
    stopAllSprites();
    setSprites((curr) =>
      curr.map((sprite) => ({ ...sprite, x: 0, y: 0, direction: 90, visible: true, sayText: undefined })),
    );
  };

  return (
    <div className="studio">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>

      <header className="toolbar">
        <div className="toolbar-left">
          <Link href="/dashboard" className="toolbar-brand">
            <div className="toolbar-brand-mark">
              <div className="toolbar-brand-mark-inner" />
            </div>
            <span>Neurix</span>
          </Link>
          <input
            className="toolbar-project-name"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            aria-label="Project name"
          />
        </div>

        <div className="toolbar-right">
          {saveStatus !== "saved" && (
            <span className={`toolbar-status toolbar-status-${saveStatus}`}>
              {saveStatus === "saving" ? "Saving" : saveStatus === "error" ? "Error" : "Unsaved"}
            </span>
          )}
          <button className="toolbar-btn toolbar-btn-save" type="button" onClick={saveProject}>
            <Save size={14} strokeWidth={2} />
            Save
          </button>
        </div>
      </header>

      <div className="main-grid">

        <section className="workspace-area" id="workspace">
          <div className="workspace-card">
            <div className="workspace-header">
              <div className="workspace-header-title">
                <span>Scripts</span>
                <span>Build behavior with blocks</span>
              </div>
              <div className="workspace-actions">
                <button
                  className={`workspace-run-btn ${isRunning ? "workspace-run-btn-active" : ""}`}
                  onClick={runAllSprites}
                  type="button"
                >
                  <Play size={14} strokeWidth={2.5} fill={isRunning ? "currentColor" : "none"} />
                  {isRunning ? "Running" : "Run"}
                </button>
                <button
                  className="workspace-stop-btn"
                  onClick={stopAllSprites}
                  type="button"
                >
                  <Square size={12} strokeWidth={2.5} />
                  Stop
                </button>
              </div>
            </div>
            <div className="workspace-body">
              {activeSprite && (
                <BlocklyPanel
                  key={activeSprite.id}
                  activeSpriteId={activeSprite.id}
                  activeSpriteName={activeSprite.name}
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
              <button
                className="panel-icon-btn"
                onClick={resetSprites}
                type="button"
                title="Reset"
              >
                <RotateCcw size={13} strokeWidth={2} />
              </button>
            </div>
            <div
              className="stage-viewport"
              ref={stageRef}
              onPointerMove={updateMousePosition}
              onPointerDown={(event) => {
                updateMousePosition(event);
                mouseRef.current.down = true;
              }}
              onPointerUp={() => {
                mouseRef.current.down = false;
              }}
              onPointerLeave={() => {
                mouseRef.current.down = false;
              }}
            >
              <div className="stage-grid-bg" />
              {sprites.map((sprite) => sprite.visible ? (
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
              ) : null)}
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
                className="panel-icon-btn"
                onClick={addSprite}
                type="button"
                title="Add sprite"
              >
                <Plus size={13} strokeWidth={2.5} />
              </button>
            </div>
            <div className="sprite-strip">
              {sprites.filter((sprite) => !sprite.isClone).map((sprite) => (
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
                    className="inspector-icon-btn"
                    onClick={() => updateActive({ visible: !activeSprite.visible })}
                    type="button"
                    title={activeSprite.visible ? "Hide" : "Show"}
                  >
                    {activeSprite.visible ? <Eye size={14} strokeWidth={2} /> : <EyeOff size={14} strokeWidth={2} />}
                  </button>
                  <button
                    className="inspector-icon-btn"
                    onClick={duplicateSprite}
                    type="button"
                    title="Duplicate"
                  >
                    <Copy size={13} strokeWidth={2} />
                  </button>
                  <button
                    className="inspector-icon-btn inspector-icon-btn-danger"
                    disabled={sprites.length === 1}
                    onClick={deleteActive}
                    type="button"
                    title="Delete"
                  >
                    <Trash2 size={13} strokeWidth={2} />
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
