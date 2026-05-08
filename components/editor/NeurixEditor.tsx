"use client";

import Link from "next/link";
import type { CSSProperties, PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlocklyPanel } from "./BlocklyPanel";
import { ScratchPaintBackdropEditor } from "./ScratchPaintBackdropEditor";
import type { ScriptNode, ScriptProgram } from "@/lib/compiler/types";
import { runScript } from "@/lib/runtime/interpreter";
import {
  Play,
  Square,
  Save,
  RotateCcw,
  Plus,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Copy,
  Trash2,
} from "lucide-react";

type BackdropPoint = { x: number; y: number };

type BackdropPixelCell = { x: number; y: number; color: string };

type BackdropElement =
  | { id: string; type: "path"; points: BackdropPoint[]; stroke: string; strokeWidth: number; opacity?: number }
  | { id: string; type: "rect"; x: number; y: number; width: number; height: number; fill: string; stroke: string; strokeWidth: number; opacity?: number }
  | { id: string; type: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: string; stroke: string; strokeWidth: number; opacity?: number }
  | { id: string; type: "text"; x: number; y: number; text: string; fill: string; fontSize: number; fontWeight?: number };

type BackdropArtwork = {
  elements: BackdropElement[];
  pixelCells: BackdropPixelCell[];
};

export type StageBackdrop = {
  id: string;
  name: string;
  fill: string;
  image?: string;
  imageFormat?: "svg" | "png" | "jpg";
  rotationCenterX?: number;
  rotationCenterY?: number;
  artwork?: BackdropArtwork;
};

export type SpriteCostume = {
  id: string;
  name: string;
  image: string;
  imageFormat: "svg" | "png" | "jpg";
  rotationCenterX?: number;
  rotationCenterY?: number;
};

export type SavedSprite = {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  direction: number;
  layer?: number;
  tone: string;
  visible: boolean;
  workspaceState: string | null;
  program: ScriptProgram;
  cloneProgram?: ScriptProgram;
  costumes?: SpriteCostume[];
  currentCostumeId?: string;
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
    backdrops?: StageBackdrop[];
    currentBackdropId?: string;
    workspaceState?: string | null;
    program?: ScriptProgram;
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

const backdropFills = ["#f5f5f7", "#EAF6FF", "#FFF4DE", "#EEF8EA", "#F6ECFF", "#F8EFE8"];

const spriteCostumeCanvas = { width: 480, height: 360 };

function createSpriteCostumeSvg(tone: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${spriteCostumeCanvas.width}" height="${spriteCostumeCanvas.height}" viewBox="0 0 ${spriteCostumeCanvas.width} ${spriteCostumeCanvas.height}"><rect width="${spriteCostumeCanvas.width}" height="${spriteCostumeCanvas.height}" fill="none"/><g transform="translate(240 180)"><path d="M0 -112C62 -112 112 -62 112 0C112 62 62 112 0 112C-62 112 -112 62 -112 0C-112 -62 -62 -112 0 -112Z" fill="${tone}"/><path d="M-38 -18C-20 -42 20 -42 38 -18" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" opacity="0.72"/><circle cx="-34" cy="22" r="12" fill="#ffffff" opacity="0.72"/><circle cx="34" cy="22" r="12" fill="#ffffff" opacity="0.72"/></g></svg>`;
}

function defaultCostume(tone: string, name = "Costume 1", id = "costume-1"): SpriteCostume {
  return {
    id,
    name,
    image: createSpriteCostumeSvg(tone),
    imageFormat: "svg",
    rotationCenterX: spriteCostumeCanvas.width / 2,
    rotationCenterY: spriteCostumeCanvas.height / 2,
  };
}

function initialSprite(sprite: Omit<SavedSprite, "costumes" | "currentCostumeId">): SavedSprite {
  const costume = defaultCostume(sprite.tone);
  return { ...sprite, costumes: [costume], currentCostumeId: costume.id };
}

const initialSprites: SavedSprite[] = [
  initialSprite({ id: "sprite-1", name: "Kite", x: 0, y: 0, size: 100, direction: 90, layer: 0, tone: "#56CBF9", visible: true, workspaceState: null, program: [], cloneProgram: [] }),
  initialSprite({ id: "sprite-2", name: "Rook", x: -108, y: 56, size: 76, direction: 28, layer: 1, tone: "#7FBEEB", visible: true, workspaceState: null, program: [], cloneProgram: [] }),
  initialSprite({ id: "sprite-3", name: "Moss", x: 122, y: 88, size: 64, direction: -18, layer: 2, tone: "#AFBED1", visible: true, workspaceState: null, program: [], cloneProgram: [] }),
];

function normalizeProgram(program: unknown): ScriptProgram {
  if (!Array.isArray(program) || program.length === 0) return [];
  return Array.isArray(program[0]) ? program as ScriptProgram : [program as ScriptNode[]];
}

function normalizeSprite(sprite: SavedSprite, index = 0): SavedSprite {
  const costumes = Array.isArray(sprite.costumes) && sprite.costumes.length > 0
    ? sprite.costumes.map((costume, costumeIndex) => ({
      id: costume.id || `costume-${costumeIndex + 1}`,
      name: costume.name?.trim() || `Costume ${costumeIndex + 1}`,
      image: costume.image || createSpriteCostumeSvg(sprite.tone),
      imageFormat: costume.imageFormat ?? (costume.image?.trim().startsWith("<svg") ? "svg" : "png"),
      rotationCenterX: typeof costume.rotationCenterX === "number" ? costume.rotationCenterX : spriteCostumeCanvas.width / 2,
      rotationCenterY: typeof costume.rotationCenterY === "number" ? costume.rotationCenterY : spriteCostumeCanvas.height / 2,
    }))
    : [defaultCostume(sprite.tone)];
  const currentCostumeId = costumes.some((costume) => costume.id === sprite.currentCostumeId)
    ? sprite.currentCostumeId
    : costumes[0].id;

  return {
    ...sprite,
    layer: typeof sprite.layer === "number" ? sprite.layer : index,
    program: normalizeProgram(sprite.program),
    cloneProgram: normalizeProgram(sprite.cloneProgram),
    costumes,
    currentCostumeId,
  };
}

function getSpriteLayer(sprite: SavedSprite) {
  return typeof sprite.layer === "number" ? sprite.layer : 0;
}

function normalizeLayerOrder(sprites: SavedSprite[]) {
  return [...sprites]
    .sort((a, b) => getSpriteLayer(a) - getSpriteLayer(b))
    .map((sprite, index) => ({ ...sprite, layer: index }));
}

function moveSpriteToLayer(sprites: SavedSprite[], spriteId: string, targetIndex: number) {
  const ordered = normalizeLayerOrder(sprites);
  const currentIndex = ordered.findIndex((sprite) => sprite.id === spriteId);
  if (currentIndex === -1) return ordered;

  const [sprite] = ordered.splice(currentIndex, 1);
  ordered.splice(clamp(targetIndex, 0, ordered.length), 0, sprite);
  return ordered.map((item, index) => ({ ...item, layer: index }));
}

function moveSpriteByLayers(sprites: SavedSprite[], spriteId: string, direction: "forward" | "backward", amount: number) {
  const ordered = normalizeLayerOrder(sprites);
  const currentIndex = ordered.findIndex((sprite) => sprite.id === spriteId);
  if (currentIndex === -1) return ordered;

  const delta = Math.max(0, Math.floor(amount));
  const targetIndex = direction === "forward" ? currentIndex + delta : currentIndex - delta;
  return moveSpriteToLayer(ordered, spriteId, targetIndex);
}

const stageRange = { minX: -240, maxX: 240, minY: -180, maxY: 180 };

const backdropCanvas = { width: 480, height: 360, pixelColumns: 48, pixelRows: 36 };
type WorkspaceTab = "scripts" | "art";
type ActiveTarget = "sprite" | "stage";

function createBackdropSvg(fill: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${backdropCanvas.width}" height="${backdropCanvas.height}" viewBox="0 0 ${backdropCanvas.width} ${backdropCanvas.height}"><rect width="${backdropCanvas.width}" height="${backdropCanvas.height}" fill="${fill}"/></svg>`;
}

function getBackdropPaintImage(backdrop: StageBackdrop) {
  return backdrop.image ?? createBackdropSvg(backdrop.fill);
}

function getBackdropImageSource(backdrop: StageBackdrop) {
  const image = getBackdropPaintImage(backdrop);
  if (image.trim().startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image)}`;
  }
  return image;
}

function getImageSource(image: string) {
  if (image.trim().startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image)}`;
  }
  return image;
}

function getSpriteCostume(sprite: SavedSprite): SpriteCostume {
  const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
  return costumes.find((costume) => costume.id === sprite.currentCostumeId) ?? costumes[0];
}

function defaultBackdrop(fill = "#f5f5f7"): StageBackdrop {
  return {
    id: "backdrop-1",
    name: "Backdrop 1",
    fill,
    image: createBackdropSvg(fill),
    imageFormat: "svg",
    rotationCenterX: backdropCanvas.width / 2,
    rotationCenterY: backdropCanvas.height / 2,
    artwork: { elements: [], pixelCells: [] },
  };
}

function normalizeArtwork(artwork: StageBackdrop["artwork"]): BackdropArtwork {
  return {
    elements: Array.isArray(artwork?.elements) ? artwork.elements : [],
    pixelCells: Array.isArray(artwork?.pixelCells) ? artwork.pixelCells : [],
  };
}

function getBackdropArtwork(backdrop: StageBackdrop): BackdropArtwork {
  return normalizeArtwork(backdrop.artwork);
}

function pointToPath(points: BackdropPoint[]) {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function renderBackdropElement(element: BackdropElement) {
  switch (element.type) {
    case "path":
      return (
        <path
          d={pointToPath(element.points)}
          fill="none"
          stroke={element.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={element.strokeWidth}
          opacity={element.opacity ?? 1}
        />
      );
    case "rect":
      return (
        <rect
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          fill={element.fill}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          opacity={element.opacity ?? 1}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={element.cx}
          cy={element.cy}
          rx={element.rx}
          ry={element.ry}
          fill={element.fill}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          opacity={element.opacity ?? 1}
        />
      );
    case "text":
      return (
        <text
          x={element.x}
          y={element.y}
          fill={element.fill}
          fontFamily="var(--font-geist-sans), sans-serif"
          fontSize={element.fontSize}
          fontWeight={element.fontWeight ?? 700}
        >
          {element.text}
        </text>
      );
  }
}

function BackdropArtworkContents({ backdrop }: { backdrop: StageBackdrop }) {
  const artwork = getBackdropArtwork(backdrop);
  const cellWidth = backdropCanvas.width / backdropCanvas.pixelColumns;
  const cellHeight = backdropCanvas.height / backdropCanvas.pixelRows;

  return (
    <>
      {artwork.pixelCells.map((cell) => (
        <rect
          fill={cell.color}
          height={cellHeight}
          key={`${cell.x}-${cell.y}`}
          width={cellWidth}
          x={cell.x * cellWidth}
          y={cell.y * cellHeight}
        />
      ))}
      {artwork.elements.map((element) => (
        <g key={element.id}>{renderBackdropElement(element)}</g>
      ))}
    </>
  );
}

function BackdropArtworkLayer({ backdrop, className }: { backdrop: StageBackdrop; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${backdropCanvas.width} ${backdropCanvas.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <BackdropArtworkContents backdrop={backdrop} />
    </svg>
  );
}

function normalizeStage(stage: ProjectDocument["stage"]): ProjectDocument["stage"] {
  const backdrops = Array.isArray(stage.backdrops) && stage.backdrops.length > 0
    ? stage.backdrops.map((backdrop, index) => ({
      id: backdrop.id || `backdrop-${index + 1}`,
      name: backdrop.name?.trim() || `Backdrop ${index + 1}`,
      fill: backdrop.fill || stage.background || "#f5f5f7",
      image: backdrop.image,
      imageFormat: backdrop.imageFormat ?? (backdrop.image?.trim().startsWith("<svg") ? "svg" : backdrop.image ? "png" : undefined),
      rotationCenterX: typeof backdrop.rotationCenterX === "number" ? backdrop.rotationCenterX : backdropCanvas.width / 2,
      rotationCenterY: typeof backdrop.rotationCenterY === "number" ? backdrop.rotationCenterY : backdropCanvas.height / 2,
      artwork: normalizeArtwork(backdrop.artwork),
    }))
    : [defaultBackdrop(stage.background ?? "#f5f5f7")];
  const currentBackdropId = backdrops.some((backdrop) => backdrop.id === stage.currentBackdropId)
    ? stage.currentBackdropId
    : backdrops[0].id;

  return {
    ...stageRange,
    background: backdrops.find((backdrop) => backdrop.id === currentBackdropId)?.fill ?? backdrops[0].fill,
    backdrops,
    currentBackdropId,
    workspaceState: stage.workspaceState ?? null,
    program: normalizeProgram(stage.program),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatInspectorNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  const safeValue = Object.is(rounded, -0) ? 0 : rounded;
  return Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(1);
}

function getStageStyle(sprite: SavedSprite): CSSProperties {
  const x = clamp(sprite.x, stageRange.minX, stageRange.maxX);
  const y = clamp(sprite.y, stageRange.minY, stageRange.maxY);
  const px = ((x - stageRange.minX) / (stageRange.maxX - stageRange.minX)) * 100;
  const py = ((stageRange.maxY - y) / (stageRange.maxY - stageRange.minY)) * 100;
  const sizeScale = clamp(sprite.size, 1, 1000) / 100;
  return {
    left: `${px}%`,
    top: `${py}%`,
    width: `${25 * sizeScale}%`,
    height: `${33.333 * sizeScale}%`,
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
  const backdrop = defaultBackdrop();

  return {
    version: 1,
    stage: { ...stageRange, background: backdrop.fill, backdrops: [backdrop], currentBackdropId: backdrop.id, workspaceState: null, program: [] },
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
  const [stageState, setStageState] = useState(() => normalizeStage(initialDocument.stage));
  const [sprites, setSprites] = useState<SavedSprite[]>(() =>
    normalizeLayerOrder((initialDocument.sprites.length > 0 ? initialDocument.sprites : initialSprites).map(normalizeSprite)),
  );
  const [activeId, setActiveId] = useState<string>((initialDocument.sprites[0] ?? initialSprites[0]).id);
  const [activeTarget, setActiveTarget] = useState<ActiveTarget>("sprite");
  const [isRunning, setIsRunning] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("scripts");
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const runIdRef = useRef(0);
  const deletedCloneIdsRef = useRef(new Set<string>());
  const pressedKeysRef = useRef(new Set<string>());
  const lastKeyRef = useRef("");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const timerStartRef = useRef(0);
  const stageStateRef = useRef(stageState);
  const spritesRef = useRef(sprites);
  const runProgramRef = useRef<((spriteId: string, program: ScriptProgram, runId: number) => Promise<void>) | null>(null);

  const activeSprite = useMemo(
    () => sprites.find((s) => s.id === activeId) ?? sprites[0],
    [activeId, sprites],
  );
  const activeCostume = useMemo(
    () => activeSprite ? getSpriteCostume(activeSprite) : null,
    [activeSprite],
  );

  const stageSprites = useMemo(() => normalizeLayerOrder(sprites), [sprites]);
  const currentBackdrop = useMemo(
    () => stageState.backdrops?.find((backdrop) => backdrop.id === stageState.currentBackdropId) ?? stageState.backdrops?.[0] ?? defaultBackdrop(),
    [stageState.backdrops, stageState.currentBackdropId],
  );
  const backdropOptions = useMemo(
    () => (stageState.backdrops ?? [currentBackdrop]).map((backdrop) => ({ id: backdrop.id, name: backdrop.name })),
    [currentBackdrop, stageState.backdrops],
  );
  const costumeOptions = useMemo(
    () => activeTarget === "sprite" && activeSprite
      ? (activeSprite.costumes ?? [defaultCostume(activeSprite.tone)]).map((costume) => ({ id: costume.id, name: costume.name }))
      : [],
    [activeSprite, activeTarget],
  );

  const projectDocument = useMemo<ProjectDocument>(() => ({
    version: 1,
    stage: {
      ...stageRange,
      background: currentBackdrop.fill,
      backdrops: stageState.backdrops ?? [currentBackdrop],
      currentBackdropId: currentBackdrop.id,
      workspaceState: stageState.workspaceState ?? null,
      program: stageState.program ?? [],
    },
    sprites: sprites.filter((sprite) => !sprite.isClone).map((sprite) => ({
      id: sprite.id,
      name: sprite.name,
      x: sprite.x,
      y: sprite.y,
      size: sprite.size,
      direction: sprite.direction,
      layer: getSpriteLayer(sprite),
      tone: sprite.tone,
      visible: sprite.visible,
      workspaceState: sprite.workspaceState,
      program: sprite.program,
      cloneProgram: sprite.cloneProgram ?? [],
      costumes: sprite.costumes ?? [defaultCostume(sprite.tone)],
      currentCostumeId: sprite.currentCostumeId,
    })),
  }), [currentBackdrop, sprites, stageState.backdrops, stageState.program, stageState.workspaceState]);

  useEffect(() => {
    stageStateRef.current = stageState;
  }, [stageState]);

  useEffect(() => {
    spritesRef.current = sprites;
  }, [sprites]);

  useEffect(() => {
    if (!isStageFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsStageFullscreen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStageFullscreen]);

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
    (targetId: string, workspaceState: string, program: ScriptProgram, cloneProgram: ScriptProgram) => {
      if (targetId === "stage") {
        setStageState((curr) => ({ ...curr, workspaceState, program }));
        return;
      }

      setSprites((curr) =>
        curr.map((sprite) =>
          sprite.id === targetId ? { ...sprite, workspaceState, program, cloneProgram } : sprite,
        ),
      );
    },
    [],
  );

  const renderStageViewport = (variant: "panel" | "fullscreen" = "panel") => (
    <div
      className={`stage-viewport ${variant === "fullscreen" ? "stage-viewport-fullscreen" : "stage-viewport-panel"}`}
      ref={stageRef}
      style={{ background: currentBackdrop.fill }}
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
      {currentBackdrop.image ? (
        <span className="stage-backdrop-image" style={{ backgroundImage: `url("${getBackdropImageSource(currentBackdrop)}")` }} />
      ) : (
        <BackdropArtworkLayer backdrop={currentBackdrop} className="stage-backdrop-artwork" />
      )}
      {stageSprites.map((sprite) => sprite.visible ? (
        <div
          key={sprite.id}
          className="stage-sprite"
          style={getStageStyle(sprite)}
        >
          <span
            className="stage-sprite-costume"
            style={{ backgroundImage: `url("${getImageSource(getSpriteCostume(sprite).image)}")` }}
          />
        </div>
      ) : null)}
      {stageSprites.map((sprite) =>
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
      {!stageSprites.some((sprite) => sprite.visible) && (
        <div className="stage-empty">
          <p className="stage-empty-title">No visible sprites</p>
          <p className="stage-empty-sub">Use the eye control below to show one.</p>
        </div>
      )}
    </div>
  );

  const updateBackdropById = (backdropId: string, updater: (backdrop: StageBackdrop) => StageBackdrop) => {
    setStageState((curr) => {
      const backdrops = curr.backdrops ?? [defaultBackdrop(curr.background ?? "#f5f5f7")];
      const nextBackdrops = backdrops.map((backdrop) => backdrop.id === backdropId ? updater(backdrop) : backdrop);
      const current = nextBackdrops.find((backdrop) => backdrop.id === curr.currentBackdropId) ?? nextBackdrops[0];
      const nextStage = { ...curr, background: current.fill, backdrops: nextBackdrops, currentBackdropId: current.id };
      stageStateRef.current = nextStage;
      return nextStage;
    });
  };

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
      layer: Math.max(-1, ...sprites.map(getSpriteLayer)) + 1,
      tone,
      visible: true,
      workspaceState: null,
      program: [],
      cloneProgram: [],
      costumes: [defaultCostume(tone)],
      currentCostumeId: "costume-1",
    };
    setSprites((curr) => [...curr, next]);
    setActiveId(id);
    setActiveTarget("sprite");
  };

  const addBackdrop = () => {
    setStageState((curr) => {
      const backdrops = curr.backdrops ?? [defaultBackdrop(curr.background ?? "#f5f5f7")];
      const id = `backdrop-${Date.now()}`;
      const nextBackdrop = {
        id,
        name: `Backdrop ${backdrops.length + 1}`,
        fill: backdropFills[backdrops.length % backdropFills.length],
        image: createBackdropSvg(backdropFills[backdrops.length % backdropFills.length]),
        imageFormat: "svg" as const,
        rotationCenterX: backdropCanvas.width / 2,
        rotationCenterY: backdropCanvas.height / 2,
        artwork: { elements: [], pixelCells: [] },
      };
      const nextStage = {
        ...curr,
        background: nextBackdrop.fill,
        backdrops: [...backdrops, nextBackdrop],
        currentBackdropId: id,
      };
      stageStateRef.current = nextStage;
      return nextStage;
    });
  };

  const duplicateBackdrop = (backdropId: string) => {
    setStageState((curr) => {
      const backdrops = curr.backdrops ?? [defaultBackdrop(curr.background ?? "#f5f5f7")];
      const source = backdrops.find((backdrop) => backdrop.id === backdropId) ?? backdrops[0];
      const id = `backdrop-${Date.now()}`;
      const nextBackdrop: StageBackdrop = {
        ...source,
        id,
        name: `${source.name || "Backdrop"} copy`,
        artwork: normalizeArtwork(source.artwork),
      };
      const nextStage = {
        ...curr,
        background: nextBackdrop.fill,
        backdrops: [...backdrops, nextBackdrop],
        currentBackdropId: id,
      };
      stageStateRef.current = nextStage;
      return nextStage;
    });
  };

  const selectBackdrop = (backdropId: string) => {
    setStageState((curr) => {
      const backdrops = curr.backdrops ?? [defaultBackdrop(curr.background ?? "#f5f5f7")];
      const backdrop = backdrops.find((item) => item.id === backdropId);
      if (!backdrop) return curr;
      const nextStage = { ...curr, background: backdrop.fill, backdrops, currentBackdropId: backdrop.id };
      stageStateRef.current = nextStage;
      return nextStage;
    });
  };

  const renameBackdrop = (backdropId: string, name: string) => {
    setStageState((curr) => ({
      ...curr,
      backdrops: (curr.backdrops ?? [defaultBackdrop(curr.background ?? "#f5f5f7")]).map((backdrop) =>
        backdrop.id === backdropId ? { ...backdrop, name } : backdrop,
      ),
    }));
  };

  const deleteBackdrop = (backdropId: string) => {
    setStageState((curr) => {
      const backdrops = curr.backdrops ?? [defaultBackdrop(curr.background ?? "#f5f5f7")];
      if (backdrops.length <= 1) return curr;
      const removedIndex = backdrops.findIndex((backdrop) => backdrop.id === backdropId);
      const remaining = backdrops.filter((backdrop) => backdrop.id !== backdropId);
      const nextCurrent = curr.currentBackdropId === backdropId
        ? remaining[Math.min(Math.max(removedIndex, 0), remaining.length - 1)]
        : remaining.find((backdrop) => backdrop.id === curr.currentBackdropId) ?? remaining[0];
      const nextStage = { ...curr, background: nextCurrent.fill, backdrops: remaining, currentBackdropId: nextCurrent.id };
      stageStateRef.current = nextStage;
      return nextStage;
    });
  };

  const updateCostumeById = (spriteId: string, costumeId: string, updater: (costume: SpriteCostume) => SpriteCostume) => {
    setSprites((curr) => curr.map((sprite) => {
      if (sprite.id !== spriteId) return sprite;
      const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
      const nextCostumes = costumes.map((costume) => costume.id === costumeId ? updater(costume) : costume);
      const currentCostume = nextCostumes.find((costume) => costume.id === sprite.currentCostumeId) ?? nextCostumes[0];
      return { ...sprite, costumes: nextCostumes, currentCostumeId: currentCostume.id };
    }));
  };

  const addCostume = (spriteId: string) => {
    setSprites((curr) => curr.map((sprite) => {
      if (sprite.id !== spriteId) return sprite;
      const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
      const id = `costume-${Date.now()}`;
      const nextCostume = defaultCostume(sprite.tone, `Costume ${costumes.length + 1}`, id);
      return { ...sprite, costumes: [...costumes, nextCostume], currentCostumeId: id };
    }));
  };

  const duplicateCostume = (spriteId: string, costumeId: string) => {
    setSprites((curr) => curr.map((sprite) => {
      if (sprite.id !== spriteId) return sprite;
      const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
      const source = costumes.find((costume) => costume.id === costumeId) ?? costumes[0];
      const id = `costume-${Date.now()}`;
      const nextCostume: SpriteCostume = { ...source, id, name: `${source.name || "Costume"} copy` };
      return { ...sprite, costumes: [...costumes, nextCostume], currentCostumeId: id };
    }));
  };

  const selectCostume = (spriteId: string, costumeId: string) => {
    setSprites((curr) => curr.map((sprite) => {
      if (sprite.id !== spriteId) return sprite;
      const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
      return costumes.some((costume) => costume.id === costumeId)
        ? { ...sprite, costumes, currentCostumeId: costumeId }
        : sprite;
    }));
  };

  const renameCostume = (spriteId: string, costumeId: string, name: string) => {
    updateCostumeById(spriteId, costumeId, (costume) => ({ ...costume, name }));
  };

  const deleteCostume = (spriteId: string, costumeId: string) => {
    setSprites((curr) => curr.map((sprite) => {
      if (sprite.id !== spriteId) return sprite;
      const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
      if (costumes.length <= 1) return sprite;
      const removedIndex = costumes.findIndex((costume) => costume.id === costumeId);
      const remaining = costumes.filter((costume) => costume.id !== costumeId);
      const nextCurrent = sprite.currentCostumeId === costumeId
        ? remaining[Math.min(Math.max(removedIndex, 0), remaining.length - 1)]
        : remaining.find((costume) => costume.id === sprite.currentCostumeId) ?? remaining[0];
      return { ...sprite, costumes: remaining, currentCostumeId: nextCurrent.id };
    }));
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
      layer: Math.max(-1, ...sprites.map(getSpriteLayer)) + 1,
    };
    setSprites((curr) => [...curr, copy]);
    setActiveId(id);
    setActiveTarget("sprite");
  };

  const deleteActive = () => {
    if (activeTarget !== "sprite" || !activeSprite || sprites.length === 1) return;
    const filtered = sprites.filter((s) => s.id !== activeSprite.id);
    setSprites(filtered);
    setActiveId(filtered[0].id);
    setActiveTarget("sprite");
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
        getBackdropName: () => {
          const stage = stageStateRef.current;
          const backdrops = stage.backdrops ?? [defaultBackdrop(stage.background ?? "#f5f5f7")];
          return backdrops.find((backdrop) => backdrop.id === stage.currentBackdropId)?.name ?? backdrops[0].name;
        },
        getBackdropNumber: () => {
          const stage = stageStateRef.current;
          const backdrops = stage.backdrops ?? [defaultBackdrop(stage.background ?? "#f5f5f7")];
          const index = backdrops.findIndex((backdrop) => backdrop.id === stage.currentBackdropId);
          return index >= 0 ? index + 1 : 1;
        },
        getCostumeName: () => {
          const sprite = spritesRef.current.find((item) => item.id === spriteId);
          return sprite ? getSpriteCostume(sprite).name : "";
        },
        getCostumeNumber: () => {
          const sprite = spritesRef.current.find((item) => item.id === spriteId);
          if (!sprite) return 0;
          const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
          const index = costumes.findIndex((costume) => costume.id === sprite.currentCostumeId);
          return index >= 0 ? index + 1 : 1;
        },
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
            layer: Math.max(-1, ...spritesRef.current.map(getSpriteLayer)) + 1,
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
        goToLayer: (layer) => {
          setSprites((curr) => moveSpriteToLayer(curr, spriteId, layer === "front" ? curr.length - 1 : 0));
        },
        changeLayer: (direction, amount) => {
          setSprites((curr) => moveSpriteByLayers(curr, spriteId, direction, amount));
        },
        switchBackdrop: (backdropId) => {
          setStageState((curr) => {
            const backdrops = curr.backdrops ?? [defaultBackdrop(curr.background ?? "#f5f5f7")];
            const backdrop = backdrops.find((item) => item.id === backdropId);
            if (!backdrop) return curr;
            const nextStage = { ...curr, background: backdrop.fill, backdrops, currentBackdropId: backdrop.id };
            stageStateRef.current = nextStage;
            return nextStage;
          });
        },
        nextBackdrop: () => {
          setStageState((curr) => {
            const backdrops = curr.backdrops ?? [defaultBackdrop(curr.background ?? "#f5f5f7")];
            const index = Math.max(0, backdrops.findIndex((backdrop) => backdrop.id === curr.currentBackdropId));
            const nextBackdrop = backdrops[(index + 1) % backdrops.length];
            const nextStage = { ...curr, background: nextBackdrop.fill, backdrops, currentBackdropId: nextBackdrop.id };
            stageStateRef.current = nextStage;
            return nextStage;
          });
        },
        switchCostume: (costumeId) => {
          setSprites((curr) => curr.map((sprite) => {
            if (sprite.id !== spriteId) return sprite;
            const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
            return costumes.some((costume) => costume.id === costumeId)
              ? { ...sprite, costumes, currentCostumeId: costumeId }
              : sprite;
          }));
          spritesRef.current = spritesRef.current.map((sprite) => {
            if (sprite.id !== spriteId) return sprite;
            const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
            return costumes.some((costume) => costume.id === costumeId)
              ? { ...sprite, costumes, currentCostumeId: costumeId }
              : sprite;
          });
        },
        nextCostume: () => {
          const getNextSprite = (sprite: SavedSprite) => {
            const costumes = sprite.costumes && sprite.costumes.length > 0 ? sprite.costumes : [defaultCostume(sprite.tone)];
            const index = Math.max(0, costumes.findIndex((costume) => costume.id === sprite.currentCostumeId));
            return { ...sprite, costumes, currentCostumeId: costumes[(index + 1) % costumes.length].id };
          };
          setSprites((curr) => curr.map((sprite) => sprite.id === spriteId ? getNextSprite(sprite) : sprite));
          spritesRef.current = spritesRef.current.map((sprite) => sprite.id === spriteId ? getNextSprite(sprite) : sprite);
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

    const jobs = [
      runProgramStacks("stage", normalizeProgram(stageStateRef.current.program), runId),
      ...runnableSprites.map((sprite) => runProgramStacks(sprite.id, sprite.program, runId)),
    ];
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
              <div className="workspace-tabs" role="tablist" aria-label="Workspace modes">
                <button
                  className={`workspace-tab ${workspaceTab === "scripts" ? "workspace-tab-active" : ""}`}
                  onClick={() => setWorkspaceTab("scripts")}
                  role="tab"
                  type="button"
                  aria-selected={workspaceTab === "scripts"}
                >
                  Scripts
                </button>
                <button
                  className={`workspace-tab ${workspaceTab === "art" ? "workspace-tab-active" : ""}`}
                  onClick={() => setWorkspaceTab("art")}
                  role="tab"
                  type="button"
                  aria-selected={workspaceTab === "art"}
                >
                  Art
                </button>
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
              {workspaceTab === "scripts" && (activeTarget === "stage" || activeSprite) && (
                <BlocklyPanel
                  key={activeTarget === "stage" ? "stage" : activeSprite.id}
                  activeSpriteId={activeTarget === "stage" ? "stage" : activeSprite.id}
                  activeSpriteName={activeTarget === "stage" ? "Stage" : activeSprite.name}
                  targetType={activeTarget}
                  backdrops={backdropOptions}
                  costumes={costumeOptions}
                  workspaceState={activeTarget === "stage" ? stageState.workspaceState ?? null : activeSprite.workspaceState}
                  onWorkspaceChange={handleWorkspaceChange}
                />
              )}
              {workspaceTab === "art" && activeTarget === "stage" && (
                <div className="scratch-backdrops-workspace">
                  <aside className="scratch-backdrop-pane">
                    <div className="scratch-backdrop-pane-header">
                      <span>Backdrops</span>
                      <button className="panel-icon-btn" onClick={addBackdrop} type="button" title="Add backdrop">
                        <Plus size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                    <div className="scratch-backdrop-assets">
                      {(stageState.backdrops ?? [currentBackdrop]).map((backdrop, index, backdrops) => (
                        <button
                          className={`scratch-backdrop-asset ${backdrop.id === currentBackdrop.id ? "scratch-backdrop-asset-active" : ""}`}
                          key={backdrop.id}
                          onClick={() => selectBackdrop(backdrop.id)}
                          type="button"
                        >
                          <span className="scratch-backdrop-index">{index + 1}</span>
                          <span className="scratch-backdrop-thumb" style={{ background: backdrop.fill }}>
                            {backdrop.image && <span className="backdrop-image-layer" style={{ backgroundImage: `url("${getBackdropImageSource(backdrop)}")` }} />}
                            {!backdrop.image && <BackdropArtworkLayer backdrop={backdrop} className="backdrop-preview-artwork" />}
                          </span>
                          <input
                            value={backdrop.name}
                            onChange={(event) => renameBackdrop(backdrop.id, event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label="Backdrop name"
                          />
                          <span
                            className="scratch-backdrop-delete"
                            aria-disabled={backdrops.length === 1}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (backdrops.length > 1) deleteBackdrop(backdrop.id);
                            }}
                          >
                            <Trash2 size={12} strokeWidth={2} />
                          </span>
                          <span
                            className="scratch-backdrop-duplicate"
                            onClick={(event) => {
                              event.stopPropagation();
                              duplicateBackdrop(backdrop.id);
                            }}
                          >
                            <Copy size={12} strokeWidth={2} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </aside>
                  <ScratchPaintBackdropEditor
                    key={currentBackdrop.id}
                    image={getBackdropPaintImage(currentBackdrop)}
                    imageFormat={currentBackdrop.imageFormat ?? "svg"}
                    imageId={currentBackdrop.id}
                    name={currentBackdrop.name}
                    rotationCenterX={currentBackdrop.rotationCenterX ?? backdropCanvas.width / 2}
                    rotationCenterY={currentBackdrop.rotationCenterY ?? backdropCanvas.height / 2}
                    onRename={(name) => renameBackdrop(currentBackdrop.id, name)}
                    onChange={(payload) => {
                      updateBackdropById(currentBackdrop.id, (backdrop) => ({
                        ...backdrop,
                        image: payload.image,
                        imageFormat: payload.imageFormat,
                        rotationCenterX: payload.rotationCenterX,
                        rotationCenterY: payload.rotationCenterY,
                        artwork: { elements: [], pixelCells: [] },
                      }));
                    }}
                  />
                </div>
              )}
              {workspaceTab === "art" && activeTarget === "sprite" && activeSprite && activeCostume && (
                <div className="scratch-backdrops-workspace scratch-costumes-workspace">
                  <aside className="scratch-backdrop-pane">
                    <div className="scratch-backdrop-pane-header">
                      <span>Costumes</span>
                      <button className="panel-icon-btn" onClick={() => addCostume(activeSprite.id)} type="button" title="Add costume">
                        <Plus size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                    <div className="scratch-backdrop-assets">
                      {(activeSprite.costumes ?? [defaultCostume(activeSprite.tone)]).map((costume, index, costumes) => (
                        <button
                          className={`scratch-backdrop-asset ${costume.id === activeCostume.id ? "scratch-backdrop-asset-active" : ""}`}
                          key={costume.id}
                          onClick={() => selectCostume(activeSprite.id, costume.id)}
                          type="button"
                        >
                          <span className="scratch-backdrop-index">{index + 1}</span>
                          <span className="scratch-backdrop-thumb scratch-costume-thumb">
                            <span className="backdrop-image-layer" style={{ backgroundImage: `url("${getImageSource(costume.image)}")` }} />
                          </span>
                          <input
                            value={costume.name}
                            onChange={(event) => renameCostume(activeSprite.id, costume.id, event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label="Costume name"
                          />
                          <span
                            className="scratch-backdrop-delete"
                            aria-disabled={costumes.length === 1}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (costumes.length > 1) deleteCostume(activeSprite.id, costume.id);
                            }}
                          >
                            <Trash2 size={12} strokeWidth={2} />
                          </span>
                          <span
                            className="scratch-backdrop-duplicate"
                            onClick={(event) => {
                              event.stopPropagation();
                              duplicateCostume(activeSprite.id, costume.id);
                            }}
                          >
                            <Copy size={12} strokeWidth={2} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </aside>
                  <ScratchPaintBackdropEditor
                    key={`${activeSprite.id}-${activeCostume.id}`}
                    image={activeCostume.image}
                    imageFormat={activeCostume.imageFormat}
                    imageId={`${activeSprite.id}-${activeCostume.id}`}
                    name={activeCostume.name}
                    rotationCenterX={activeCostume.rotationCenterX ?? spriteCostumeCanvas.width / 2}
                    rotationCenterY={activeCostume.rotationCenterY ?? spriteCostumeCanvas.height / 2}
                    assetLabel="Costume"
                    onRename={(name) => renameCostume(activeSprite.id, activeCostume.id, name)}
                    onChange={(payload) => {
                      updateCostumeById(activeSprite.id, activeCostume.id, (costume) => ({
                        ...costume,
                        image: payload.image,
                        imageFormat: payload.imageFormat,
                        rotationCenterX: payload.rotationCenterX,
                        rotationCenterY: payload.rotationCenterY,
                      }));
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="right-panel">

          <div className="panel-card stage-card">
            <div className="panel-header">
              <span className="panel-title">Stage</span>
              <div className="stage-header-actions">
                <button className="panel-icon-btn" onClick={() => setIsStageFullscreen(true)} type="button" title="Fullscreen">
                  <Maximize2 size={13} strokeWidth={2} />
                </button>
                <button className="panel-icon-btn" onClick={resetSprites} type="button" title="Reset">
                  <RotateCcw size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
            {renderStageViewport()}
          </div>

          <div className="panel-card targets-card">
            {activeTarget === "sprite" && activeSprite && (
              <div className="sprite-inspector-bar">
                <div className="sprite-inspector-identity">
                  <div className="inspector-avatar" style={{ backgroundColor: activeSprite.tone }} />
                  <input
                    className="inspector-name-input"
                    value={activeSprite.name}
                    onChange={(e) => updateActive({ name: e.target.value })}
                    aria-label="Sprite name"
                  />
                  <div className="inspector-actions">
                    <button className="inspector-icon-btn" onClick={() => updateActive({ visible: !activeSprite.visible })} type="button" title={activeSprite.visible ? "Hide" : "Show"}>
                      {activeSprite.visible ? <Eye size={14} strokeWidth={2} /> : <EyeOff size={14} strokeWidth={2} />}
                    </button>
                    <button className="inspector-icon-btn" onClick={duplicateSprite} type="button" title="Duplicate">
                      <Copy size={13} strokeWidth={2} />
                    </button>
                    <button className="inspector-icon-btn inspector-icon-btn-danger" disabled={sprites.length === 1} onClick={deleteActive} type="button" title="Delete">
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div className="inspector-grid">
                  <div className="inspector-cell">
                    <label>x</label>
                    <input type="number" step="0.1" value={formatInspectorNumber(activeSprite.x)} onChange={(e) => updateActive({ x: Number(e.target.value) || 0 })} aria-label="X position" />
                  </div>
                  <div className="inspector-cell">
                    <label>y</label>
                    <input type="number" step="0.1" value={formatInspectorNumber(activeSprite.y)} onChange={(e) => updateActive({ y: Number(e.target.value) || 0 })} aria-label="Y position" />
                  </div>
                  <div className="inspector-cell">
                    <label>size</label>
                    <input type="number" step="0.1" value={formatInspectorNumber(activeSprite.size)} onChange={(e) => updateActive({ size: Number(e.target.value) || 0 })} aria-label="Size" />
                  </div>
                </div>
              </div>
            )}

            <div className="targets-tray">
              <section className="target-section sprite-target-section" aria-label="Sprites">
                <div className="target-section-header">
                  <span>Sprites</span>
                  <button className="panel-icon-btn" onClick={addSprite} type="button" title="Add sprite">
                    <Plus size={13} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="sprite-strip">
                  {sprites.filter((sprite) => !sprite.isClone).map((sprite) => (
                    <button
                      key={sprite.id}
                      className={`sprite-item ${activeTarget === "sprite" && sprite.id === activeId ? "sprite-item-active" : ""}`}
                      data-name={sprite.name}
                      onClick={() => { setActiveId(sprite.id); setActiveTarget("sprite"); }}
                      type="button"
                    >
                      <div className="sprite-item-core" style={{ backgroundColor: sprite.tone }} />
                      <span>{sprite.name}</span>
                    </button>
                  ))}
                  <button className="sprite-item sprite-item-add" onClick={addSprite} type="button" aria-label="Add sprite">
                    +
                  </button>
                </div>
              </section>

              <section className="target-section stage-target-section" aria-label="Stage and backdrops">
                <div className="target-section-header">
                  <span>Stage</span>
                </div>
                <div className="stage-target-body">
                  <div className={`stage-selector-card ${activeTarget === "stage" ? "stage-selector-card-active" : ""}`}>
                    <button className="stage-selector-preview" onClick={() => { setActiveTarget("stage"); setWorkspaceTab("scripts"); }} type="button" aria-label="Select Stage scripts">
                      <span className="backdrop-preview-surface" style={{ background: currentBackdrop.fill }}>
                        {currentBackdrop.image ? (
                          <span className="backdrop-image-layer" style={{ backgroundImage: `url("${getBackdropImageSource(currentBackdrop)}")` }} />
                        ) : (
                          <BackdropArtworkLayer backdrop={currentBackdrop} className="backdrop-preview-artwork" />
                        )}
                      </span>
                    </button>
                    <span className="stage-selector-label">Backdrops</span>
                    <strong>{(stageState.backdrops ?? [currentBackdrop]).length}</strong>
                    <button className="stage-selector-add" onClick={addBackdrop} type="button" title="Add backdrop">
                      <Plus size={20} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </aside>
      </div>

      {isStageFullscreen && (
        <div className="stage-fullscreen-overlay" role="dialog" aria-modal="true" aria-label="Fullscreen stage">
          <div className="stage-fullscreen-header">
            <div>
              <span className="panel-title">Stage</span>
              <p>{currentBackdrop.name}</p>
            </div>
            <div className="stage-header-actions">
              <button className="panel-icon-btn" onClick={resetSprites} type="button" title="Reset">
                <RotateCcw size={14} strokeWidth={2} />
              </button>
              <button className="panel-icon-btn" onClick={() => setIsStageFullscreen(false)} type="button" title="Exit fullscreen">
                <Minimize2 size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="stage-fullscreen-shell">
            {renderStageViewport("fullscreen")}
          </div>
        </div>
      )}

    </div>
  );
}
