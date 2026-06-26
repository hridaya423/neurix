import JSZip from "jszip";
import type { ProjectDocument } from "@/components/editor/NeurixEditor";
import { programsToWorkspaceState } from "@/lib/blockly/astToBlockly";
import type { GraphicEffect, ScriptCondition, ScriptEventPrograms, ScriptNode, ScriptProgram, ScriptValue } from "@/lib/compiler/types";

type ScratchVariableTuple = [string, number | string, boolean?];
type ScratchListTuple = [string, Array<number | string>];

type ScratchTarget = {
  isStage: boolean;
  name: string;
  variables: Record<string, ScratchVariableTuple>;
  lists: Record<string, ScratchListTuple>;
  broadcasts: Record<string, string>;
  blocks: Record<string, unknown>;
  comments: Record<string, unknown>;
  currentCostume: number;
  costumes: Array<{
    assetId: string;
    name: string;
    md5ext: string;
    dataFormat: "svg" | "png" | "jpg";
    bitmapResolution: number;
    rotationCenterX: number;
    rotationCenterY: number;
  }>;
  sounds: Array<{
    assetId: string;
    name: string;
    dataFormat: "wav" | "mp3";
    format?: string;
    rate?: number;
    sampleCount?: number;
    md5ext: string;
  }>;
  volume: number;
  layerOrder: number;
  tempo?: number;
  videoTransparency?: number;
  videoState?: "on" | "off" | "on-flipped";
  textToSpeechLanguage?: string | null;
  x?: number;
  y?: number;
  size?: number;
  direction?: number;
  draggable?: boolean;
  rotationStyle?: "all around" | "left-right" | "don't rotate";
  visible?: boolean;
};

type ScratchProjectJson = {
  targets: ScratchTarget[];
  monitors: ScratchMonitor[];
  extensions: string[];
  meta: {
    semver: string;
    vm: string;
    agent: string;
    neurixDocument?: string;
    neurixName?: string;
  };
};

type ScratchBlock = {
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  topLevel?: boolean;
};

type ScratchMonitor = {
  id: string;
  mode: "default" | "large" | "slider" | "list";
  opcode: "data_variable" | "data_listcontents" | string;
  params?: Record<string, string>;
  spriteName?: string | null;
  x?: number;
  y?: number;
  visible?: boolean;
};

type ScratchTargetWithBlocks = ScratchTarget & {
  blocks: Record<string, ScratchBlock>;
};

type ScratchAssetMaps = {
  backdrops?: Record<string, string>;
  costumes?: Record<string, string>;
};

const supportedStatementOpcodes = new Set<string>([
  "motion_movesteps",
  "motion_turnright",
  "motion_turnleft",
  "motion_gotoxy",
  "motion_changexby",
  "motion_setx",
  "motion_changeyby",
  "motion_sety",
  "motion_pointindirection",
  "motion_ifonedgebounce",
  "motion_goto",
  "motion_pointtowards",
  "motion_glidesecstoxy",
  "motion_glideto",
  "looks_say",
  "looks_sayforsecs",
  "looks_think",
  "looks_thinkforsecs",
  "looks_show",
  "looks_hide",
  "looks_changesizeby",
  "looks_setsizeto",
  "looks_switchcostumeto",
  "looks_nextcostume",
  "looks_switchbackdropto",
  "looks_switchbackdropandwait",
  "looks_nextbackdrop",
  "looks_gotofrontback",
  "looks_goforwardbackwardlayers",
  "event_broadcast",
  "event_broadcastandwait",
  "control_wait",
  "control_repeat",
  "control_forever",
  "control_repeat_until",
  "control_wait_until",
  "control_if",
  "control_if_else",
  "control_create_clone_of",
  "control_delete_this_clone",
  "data_setvariableto",
  "data_changevariableby",
  "data_addtolist",
  "data_deleteoflist",
  "data_deletealloflist",
  "data_insertatlist",
  "data_replaceitemoflist",
  "data_showlist",
  "data_hidelist",
  "data_showvariable",
  "data_hidevariable",
  "control_stop",
  "looks_changeeffectby",
  "looks_seteffectto",
  "looks_cleargraphiceffects",
  "sound_play",
  "sound_playuntildone",
  "sound_stopallsounds",
  "sound_changeeffectby",
  "sound_seteffectto",
  "sound_cleareffects",
  "sound_changevolumeby",
  "sound_setvolumeto",
  "pen_clear",
  "pen_stamp",
  "pen_pendown",
  "pen_penup",
  "pen_setpencolortocolor",
  "pen_changepencolorby",
  "pen_setpencolortonum",
  "pen_changepensizeby",
  "pen_setpensizeto",
  "sensing_askandwait",
  "sensing_setdragmode",
  "sensing_resettimer",
  "procedures_callnoreturn",
]);

const supportedReporterOpcodes = new Set<string>([
  "math_number",
  "text",
  "sensing_mousex",
  "sensing_mousey",
  "sensing_timer",
  "looks_size",
  "motion_xposition",
  "motion_yposition",
  "motion_direction",
  "operator_add",
  "operator_subtract",
  "operator_multiply",
  "operator_divide",
  "operator_random",
  "operator_round",
  "operator_mathop",
  "operator_join",
  "operator_letter_of",
  "operator_length",
  "data_variable",
  "data_itemoflist",
  "data_itemnumoflist",
  "data_lengthoflist",
  "operator_mod",
  "looks_costumenumbername",
  "looks_backdropnumbername",
  "sensing_answer",
  "sensing_of",
  "sensing_current",
  "sensing_dayssince2000",
  "sensing_username",
  "sensing_loudness",
  "sound_volume",
  "sensing_distanceto",
  "sensing_touchingobjectmenu",
  "sensing_distancetomenu",
  "sensing_keyoptions",
  "sensing_of_object_menu",
  "sound_sounds_menu",
  "event_broadcast_menu",
  "looks_costume",
  "looks_backdrops",
  "motion_goto_menu",
  "motion_glideto_menu",
  "motion_pointtowards_menu",
  "argument_reporter_string_number",
  "argument_reporter_boolean",
  "procedures_callreturn",
]);

const supportedConditionOpcodes = new Set<string>([
  "operator_and",
  "operator_or",
  "operator_not",
  "operator_equals",
  "operator_gt",
  "operator_lt",
  "sensing_keypressed",
  "sensing_touchingobject",
  "sensing_mousedown",
  "operator_contains",
  "data_listcontainsitem",
  "operator_bool",
  "sensing_touchingcolor",
  "sensing_coloristouchingcolor",
  "argument_reporter_boolean",
]);

const supportedHatOpcodes = new Set<string>([
  "event_whenflagclicked",
  "control_start_as_clone",
  "event_whenbroadcastreceived",
  "event_whenbackdropswitchesto",
  "event_whenkeypressed",
  "event_whenstageclicked",
  "event_whenthisspriteclicked",
]);


function base64Encode(text: string) {
  return window.btoa(unescape(encodeURIComponent(text)));
}

function base64Decode(text: string) {
  return decodeURIComponent(escape(window.atob(text)));
}

function sanitizeFileName(name: string) {
  return name.trim().replace(/[^a-z0-9-_]+/gi, "_") || "project";
}

function parseDataUrl(source: string): { format: "svg" | "png" | "jpg"; bytes: Uint8Array } | null {
  const match = source.match(/^data:image\/(svg\+xml|png|jpeg|jpg);base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const format = mime === "svg+xml" ? "svg" : mime === "jpeg" ? "jpg" : (mime as "png" | "jpg");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { format, bytes };
}

function parseAudioDataUrl(source: string): { format: "wav" | "mp3"; bytes: Uint8Array } | null {
  const match = source.match(/^data:audio\/(x-wav|wav|wave|mpeg|mp3);base64,(.+)$/i);
  if (!match) return null;
  const format = match[1].toLowerCase() === "mpeg" || match[1].toLowerCase() === "mp3" ? "mp3" : "wav";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { format, bytes };
}

function toSvgBytesFromFill(name: string, fill: string) {
  const safeFill = fill || "#f5f5f7";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="${safeFill}"/><text x="20" y="34" fill="#1d1d1f" font-size="16" font-family="Helvetica, Arial, sans-serif">${name}</text></svg>`;
  return new TextEncoder().encode(svg);
}

function splitSpriteScopedName(name: string) {
  const marker = name.indexOf(": ");
  if (marker < 0) return null;
  return { spriteName: name.slice(0, marker), localName: name.slice(marker + 2) };
}

function clampPercent(value: number, max: number) {
  return Math.max(0, Math.min(max, value));
}

function watcherNameParts(name: string) {
  const split = splitSpriteScopedName(name);
  return split ? split : { spriteName: null, localName: name };
}

function nameToIdMap(items: Array<{ name: string; id: string }>) {
  return Object.fromEntries(items.map((item) => [item.name, item.id]));
}

function scratchDataNameMap(target: ScratchTarget, spriteName: string, kind: "variables" | "lists") {
  return Object.fromEntries(Object.values(target[kind] ?? {}).flatMap((entry) => {
    const name = String(entry?.[0] ?? "").trim();
    return name ? [[name, `${spriteName}: ${name}`]] : [];
  }));
}

function mapName(name: string, names: Record<string, string>) {
  return names[name] ?? name;
}

function mapAssetName(name: string, map: Record<string, string> | undefined) {
  return map?.[name] ?? name;
}

function scratchObjectName(name: string) {
  if (name === "_mouse_") return "mouse-pointer";
  if (name === "_edge_") return "edge";
  if (name === "_stage_") return "Stage";
  if (name === "_random_") return "random position";
  return name;
}

function scopeValue(value: ScriptValue, variableNames: Record<string, string>, listNames: Record<string, string>): ScriptValue {
  if (typeof value === "number" || typeof value === "string") return value;
  switch (value.type) {
    case "variable":
      return { ...value, name: mapName(value.name, variableNames) };
    case "random":
      return { ...value, from: scopeValue(value.from, variableNames, listNames), to: scopeValue(value.to, variableNames, listNames) };
    case "arithmetic":
      return { ...value, left: scopeValue(value.left, variableNames, listNames), right: scopeValue(value.right, variableNames, listNames) };
    case "round":
    case "math":
      return { ...value, value: scopeValue(value.value, variableNames, listNames) };
    case "lengthOf":
      return { ...value, text: scopeValue(value.text, variableNames, listNames) };
    case "join":
      return { ...value, values: value.values.map((item) => scopeValue(item, variableNames, listNames)) };
    case "letterOf":
      return { ...value, index: scopeValue(value.index, variableNames, listNames), text: scopeValue(value.text, variableNames, listNames) };
    case "listItem":
      return { ...value, list: mapName(value.list, listNames), index: scopeValue(value.index, variableNames, listNames) };
    case "listIndex":
      return { ...value, list: mapName(value.list, listNames), item: scopeValue(value.item, variableNames, listNames) };
    case "listLength":
      return { ...value, list: mapName(value.list, listNames) };
    default:
      return value;
  }
}

function scopeCondition(condition: ScriptCondition, variableNames: Record<string, string>, listNames: Record<string, string>): ScriptCondition {
  switch (condition.type) {
    case "not":
      return { ...condition, condition: scopeCondition(condition.condition, variableNames, listNames) };
    case "and":
    case "or":
      return { ...condition, left: scopeCondition(condition.left, variableNames, listNames), right: scopeCondition(condition.right, variableNames, listNames) };
    case "compare":
      return { ...condition, left: scopeValue(condition.left, variableNames, listNames), right: scopeValue(condition.right, variableNames, listNames) };
    case "contains":
      return { ...condition, text: scopeValue(condition.text, variableNames, listNames), search: scopeValue(condition.search, variableNames, listNames) };
    case "listContains":
      return { ...condition, list: mapName(condition.list, listNames), item: scopeValue(condition.item, variableNames, listNames) };
    default:
      return condition;
  }
}

function scopeNode(node: ScriptNode, variableNames: Record<string, string>, listNames: Record<string, string>): ScriptNode {
  switch (node.type) {
    case "move":
      return { ...node, steps: scopeValue(node.steps, variableNames, listNames) };
    case "turn":
      return { ...node, degrees: scopeValue(node.degrees, variableNames, listNames) };
    case "setPosition":
      return { ...node, x: scopeValue(node.x, variableNames, listNames), y: scopeValue(node.y, variableNames, listNames) };
    case "changeX":
      return { ...node, dx: scopeValue(node.dx, variableNames, listNames) };
    case "changeY":
      return { ...node, dy: scopeValue(node.dy, variableNames, listNames) };
    case "setX":
      return { ...node, x: scopeValue(node.x, variableNames, listNames) };
    case "setY":
      return { ...node, y: scopeValue(node.y, variableNames, listNames) };
    case "setDirection":
    case "pointInDirection":
      return { ...node, direction: scopeValue(node.direction, variableNames, listNames) };
    case "glideToPosition":
      return { ...node, seconds: scopeValue(node.seconds, variableNames, listNames), x: scopeValue(node.x, variableNames, listNames), y: scopeValue(node.y, variableNames, listNames) };
    case "glideToObject":
      return { ...node, seconds: scopeValue(node.seconds, variableNames, listNames) };
    case "say":
    case "think":
      return { ...node, text: scopeValue(node.text, variableNames, listNames) };
    case "sayForSeconds":
    case "thinkForSeconds":
      return { ...node, text: scopeValue(node.text, variableNames, listNames), seconds: scopeValue(node.seconds, variableNames, listNames) };
    case "changeSize":
      return { ...node, amount: scopeValue(node.amount, variableNames, listNames) };
    case "setSize":
      return { ...node, size: scopeValue(node.size, variableNames, listNames) };
    case "changeGraphicEffect":
      return { ...node, amount: scopeValue(node.amount, variableNames, listNames) };
    case "setGraphicEffect":
      return { ...node, value: scopeValue(node.value, variableNames, listNames) };
    case "changeSoundEffect":
      return { ...node, amount: scopeValue(node.amount, variableNames, listNames) };
    case "setSoundEffect":
      return { ...node, value: scopeValue(node.value, variableNames, listNames) };
    case "changeVolume":
      return { ...node, amount: scopeValue(node.amount, variableNames, listNames) };
    case "setVolume":
      return { ...node, volume: scopeValue(node.volume, variableNames, listNames) };
    case "setVariable":
      return { ...node, name: mapName(node.name, variableNames), value: scopeValue(node.value, variableNames, listNames) };
    case "changeVariable":
      return { ...node, name: mapName(node.name, variableNames), amount: scopeValue(node.amount, variableNames, listNames) };
    case "showVariable":
    case "hideVariable":
      return { ...node, name: mapName(node.name, variableNames) };
    case "listAdd":
      return { ...node, list: mapName(node.list, listNames), item: scopeValue(node.item, variableNames, listNames) };
    case "listDelete":
      return { ...node, list: mapName(node.list, listNames), index: node.index === "all" ? "all" : scopeValue(node.index, variableNames, listNames) };
    case "listInsert":
      return { ...node, list: mapName(node.list, listNames), index: scopeValue(node.index, variableNames, listNames), item: scopeValue(node.item, variableNames, listNames) };
    case "listReplace":
      return { ...node, list: mapName(node.list, listNames), index: scopeValue(node.index, variableNames, listNames), item: scopeValue(node.item, variableNames, listNames) };
    case "showList":
    case "hideList":
      return { ...node, list: mapName(node.list, listNames) };
    case "wait":
      return { ...node, seconds: scopeValue(node.seconds, variableNames, listNames) };
    case "repeat":
      return { ...node, times: scopeValue(node.times, variableNames, listNames), body: scopeStack(node.body, variableNames, listNames) };
    case "repeatUntil":
      return { ...node, condition: scopeCondition(node.condition, variableNames, listNames), body: scopeStack(node.body, variableNames, listNames) };
    case "waitUntil":
      return { ...node, condition: scopeCondition(node.condition, variableNames, listNames) };
    case "forever":
      return { ...node, body: scopeStack(node.body, variableNames, listNames) };
    case "if":
      return { ...node, condition: scopeCondition(node.condition, variableNames, listNames), body: scopeStack(node.body, variableNames, listNames) };
    case "ifElse":
      return { ...node, condition: scopeCondition(node.condition, variableNames, listNames), thenBody: scopeStack(node.thenBody, variableNames, listNames), elseBody: scopeStack(node.elseBody, variableNames, listNames) };
    default:
      return node;
  }
}

function scopeStack(stack: ScriptNode[], variableNames: Record<string, string>, listNames: Record<string, string>) {
  return stack.map((node) => scopeNode(node, variableNames, listNames));
}

function scopePrograms(programs: ReturnType<typeof parseScratchTargetPrograms>, variableNames: Record<string, string>, listNames: Record<string, string>): ReturnType<typeof parseScratchTargetPrograms> {
  const mapProgram = (program: ScriptProgram) => program.map((stack) => scopeStack(stack, variableNames, listNames));
  return {
    start: mapProgram(programs.start),
    cloneStart: mapProgram(programs.cloneStart),
    broadcasts: Object.fromEntries(Object.entries(programs.broadcasts).map(([key, program]) => [key, mapProgram(program)])),
    backdrops: Object.fromEntries(Object.entries(programs.backdrops).map(([key, program]) => [key, mapProgram(program)])),
    keyPresses: Object.fromEntries(Object.entries(programs.keyPresses).map(([key, program]) => [key, mapProgram(program)])),
    spriteClicked: mapProgram(programs.spriteClicked),
    stageClicked: mapProgram(programs.stageClicked),
  };
}

function createScratchMonitors(document: ProjectDocument): ScratchMonitor[] {
  const variableMonitors = (document.variableWatchers ?? []).map((watcher) => {
    const { spriteName, localName } = watcherNameParts(watcher.name);
    return {
      id: `${spriteName ? `${spriteName}:` : ""}${localName}`,
      mode: watcher.mode === "large" || watcher.mode === "slider" ? watcher.mode : "default",
      opcode: "data_variable",
      params: { VARIABLE: localName },
      spriteName,
      x: Math.round(clampPercent(watcher.x, 100) * 4.8),
      y: Math.round(clampPercent(watcher.y, 100) * 3.6),
      visible: watcher.visible !== false,
    } satisfies ScratchMonitor;
  });

  const listMonitors = (document.listWatchers ?? []).map((watcher) => {
    const { spriteName, localName } = watcherNameParts(watcher.name);
    return {
      id: `${spriteName ? `${spriteName}:` : ""}${localName}`,
      mode: "list",
      opcode: "data_listcontents",
      params: { LIST: localName },
      spriteName,
      x: Math.round(clampPercent(watcher.x, 100) * 4.8),
      y: Math.round(clampPercent(watcher.y, 100) * 3.6),
      visible: watcher.visible !== false,
    } satisfies ScratchMonitor;
  });

  return [...variableMonitors, ...listMonitors];
}

export async function exportProjectToSb3(projectName: string, document: ProjectDocument) {
  const zip = new JSZip();
  const stage = document.stage;

  let assetIndex = 0;
  const addAsset = (name: string, source: string | undefined, fill: string | null | undefined, preferredFormat?: "svg" | "png" | "jpg") => {
    const parsed = source ? parseDataUrl(source) : null;
    const format = parsed?.format ?? preferredFormat ?? "svg";
    const bytes = parsed?.bytes ?? toSvgBytesFromFill(name, fill ?? "#f5f5f7");
    const assetId = `asset_${assetIndex.toString().padStart(4, "0")}`;
    assetIndex += 1;
    const md5ext = `${assetId}.${format}`;
    zip.file(md5ext, bytes);
    return { assetId, md5ext, dataFormat: format };
  };

  const addSoundAsset = async (sound: { name: string; dataUrl: string; dataFormat?: "wav" | "mp3"; rate?: number; sampleCount?: number }, fallbackName: string) => {
    const parsed = parseAudioDataUrl(sound.dataUrl);
    const fetchedBytes = !parsed && sound.dataUrl ? new Uint8Array(await (await fetch(sound.dataUrl)).arrayBuffer()) : null;
    const format = parsed?.format ?? sound.dataFormat ?? "wav";
    const assetId = `sound_${assetIndex.toString().padStart(4, "0")}`;
    assetIndex += 1;
    const md5ext = `${assetId}.${format}`;
    zip.file(md5ext, parsed?.bytes ?? fetchedBytes ?? new Uint8Array());
    return {
      assetId,
      name: sound.name || fallbackName,
      dataFormat: format,
      format: "",
      rate: sound.rate ?? 44100,
      sampleCount: sound.sampleCount ?? 0,
      md5ext,
    };
  };

  const stageVariables: Record<string, ScratchVariableTuple> = {};
  const stageLists: Record<string, ScratchListTuple> = {};
  let stageVarIndex = 0;
  let stageListIndex = 0;

  for (const [name, value] of Object.entries(document.cloudVariables ?? {})) {
    stageVariables[`var_cloud_${stageVarIndex}`] = [name, value, true];
    stageVarIndex += 1;
  }
  for (const [name, value] of Object.entries(document.variables ?? {})) {
    if (splitSpriteScopedName(name)) continue;
    stageVariables[`var_stage_${stageVarIndex}`] = [name, value];
    stageVarIndex += 1;
  }
  for (const [name, values] of Object.entries(document.lists ?? {})) {
    if (splitSpriteScopedName(name)) continue;
    stageLists[`list_stage_${stageListIndex}`] = [name, values];
    stageListIndex += 1;
  }

  const stageCostumes = (stage.backdrops ?? []).map((backdrop, index) => {
    const asset = addAsset(backdrop.name || `Backdrop ${index + 1}`, backdrop.image, backdrop.fill, backdrop.imageFormat);
    return {
      assetId: asset.assetId,
      name: backdrop.name || `Backdrop ${index + 1}`,
      md5ext: asset.md5ext,
      dataFormat: asset.dataFormat,
      bitmapResolution: 1,
      rotationCenterX: backdrop.rotationCenterX ?? 240,
      rotationCenterY: backdrop.rotationCenterY ?? 180,
    };
  });

  const stageSounds = await Promise.all((stage.sounds ?? []).map((sound, index) => addSoundAsset(sound, `Sound ${index + 1}`)));

  const stageTarget: ScratchTarget = {
    isStage: true,
    name: "Stage",
    variables: stageVariables,
    lists: stageLists,
    broadcasts: {},
    blocks: {},
    comments: {},
    currentCostume: Math.max(0, (stage.backdrops ?? []).findIndex((backdrop) => backdrop.id === stage.currentBackdropId)),
    costumes: stageCostumes.length > 0 ? stageCostumes : [{
      ...addAsset("Backdrop 1", undefined, stage.background, "svg"),
      name: "Backdrop 1",
      bitmapResolution: 1,
      rotationCenterX: 240,
      rotationCenterY: 180,
    }],
    sounds: stageSounds,
    volume: typeof stage.volume === "number" ? stage.volume : 100,
    layerOrder: 0,
    tempo: 60,
    videoTransparency: 50,
    videoState: "on",
    textToSpeechLanguage: null,
  };

  const spriteTargets: ScratchTarget[] = await Promise.all(document.sprites.map(async (sprite, spriteIndex) => {
    const spriteVariables: Record<string, ScratchVariableTuple> = {};
    const spriteLists: Record<string, ScratchListTuple> = {};
    let spriteVarIndex = 0;
    let spriteListIndex = 0;

    for (const [name, value] of Object.entries(sprite.variables ?? {})) {
      const split = splitSpriteScopedName(name);
      spriteVariables[`var_sprite_${spriteIndex}_${spriteVarIndex}`] = [split?.localName ?? name, value];
      spriteVarIndex += 1;
    }
    for (const [name, values] of Object.entries(sprite.lists ?? {})) {
      const split = splitSpriteScopedName(name);
      spriteLists[`list_sprite_${spriteIndex}_${spriteListIndex}`] = [split?.localName ?? name, values];
      spriteListIndex += 1;
    }

    const costumes = (sprite.costumes ?? []).map((costume, costumeIndex) => {
      const asset = addAsset(costume.name || `Costume ${costumeIndex + 1}`, costume.image, "#ffffff", costume.imageFormat);
      return {
        assetId: asset.assetId,
        name: costume.name || `Costume ${costumeIndex + 1}`,
        md5ext: asset.md5ext,
        dataFormat: asset.dataFormat,
        bitmapResolution: 1,
        rotationCenterX: costume.rotationCenterX ?? 240,
        rotationCenterY: costume.rotationCenterY ?? 180,
      };
    });

    const currentCostume = Math.max(0, (sprite.costumes ?? []).findIndex((costume) => costume.id === sprite.currentCostumeId));

    return {
      isStage: false,
      name: sprite.name,
      variables: spriteVariables,
      lists: spriteLists,
      broadcasts: {},
      blocks: {},
      comments: {},
      currentCostume: currentCostume >= 0 ? currentCostume : 0,
      costumes: costumes.length > 0 ? costumes : [{
        ...addAsset("Costume 1", undefined, "#56CBF9", "svg"),
        name: "Costume 1",
        bitmapResolution: 1,
        rotationCenterX: 240,
        rotationCenterY: 180,
      }],
      sounds: await Promise.all((sprite.sounds ?? []).map((sound, soundIndex) => addSoundAsset(sound, `Sound ${soundIndex + 1}`))),
      volume: typeof sprite.volume === "number" ? sprite.volume : 100,
      layerOrder: sprite.layer ?? spriteIndex + 1,
      x: sprite.x,
      y: sprite.y,
      size: sprite.size,
      direction: sprite.direction,
      draggable: sprite.draggable === true,
      rotationStyle: "all around",
      visible: sprite.visible,
    };
  }));

  const scratchProject: ScratchProjectJson = {
    targets: [stageTarget, ...spriteTargets],
    monitors: createScratchMonitors(document),
    extensions: [],
    meta: {
      semver: "3.0.0",
      vm: "0.2.0",
      agent: "Neurix",
      neurixName: projectName,
      neurixDocument: base64Encode(JSON.stringify(document)),
    },
  };

  zip.file("project.json", JSON.stringify(scratchProject));
  return zip.generateAsync({ type: "blob" });
}

function toDataUrl(bytes: Uint8Array, format: "svg" | "png" | "jpg") {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const mime = format === "svg" ? "image/svg+xml" : format === "jpg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${base64}`;
}

function toAudioDataUrl(bytes: Uint8Array, format: "wav" | "mp3") {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const mime = format === "mp3" ? "audio/mpeg" : "audio/wav";
  return `data:${mime};base64,${base64}`;
}

function parseScratchVariables(target: ScratchTarget, spriteName?: string) {
  const entries = Object.values(target.variables ?? {});
  const out: Record<string, number | string> = {};
  for (const entry of entries) {
    if (!spriteName && entry?.[2] === true) continue;
    const name = String(entry?.[0] ?? "").trim();
    if (!name) continue;
    const scoped = spriteName ? `${spriteName}: ${name}` : name;
    out[scoped] = (entry?.[1] ?? 0) as number | string;
  }
  return out;
}

function parseScratchCloudVariables(target: ScratchTarget) {
  const entries = Object.values(target.variables ?? {});
  const out: Record<string, number> = {};
  for (const entry of entries) {
    if (entry?.[2] !== true) continue;
    const name = String(entry?.[0] ?? "").trim();
    if (!name) continue;
    const value = Number(entry?.[1] ?? 0);
    out[name] = Number.isFinite(value) ? value : 0;
  }
  return out;
}

function parseScratchLists(target: ScratchTarget, spriteName?: string) {
  const entries = Object.values(target.lists ?? {});
  const out: Record<string, Array<number | string>> = {};
  for (const entry of entries) {
    const name = String(entry?.[0] ?? "").trim();
    if (!name) continue;
    const scoped = spriteName ? `${spriteName}: ${name}` : name;
    out[scoped] = Array.isArray(entry?.[1]) ? entry[1] : [];
  }
  return out;
}

function monitorName(monitor: ScratchMonitor, key: "VARIABLE" | "LIST") {
  const name = String(monitor.params?.[key] ?? "").trim();
  if (!name) return "";
  return monitor.spriteName ? `${monitor.spriteName}: ${name}` : name;
}

function parseScratchMonitors(monitors: ScratchMonitor[]) {
  const variableWatchers: NonNullable<ProjectDocument["variableWatchers"]> = monitors.flatMap((monitor, index) => {
    if (monitor.opcode !== "data_variable") return [];
    const name = monitorName(monitor, "VARIABLE");
    if (!name) return [];
    return [{
      id: monitor.id || `watcher-${index}-${name}`,
      name,
      visible: monitor.visible !== false,
      mode: monitor.mode === "large" || monitor.mode === "slider" ? monitor.mode : "normal",
      x: typeof monitor.x === "number" ? clampPercent((monitor.x / 480) * 100, 92) : 4,
      y: typeof monitor.y === "number" ? clampPercent((monitor.y / 360) * 100, 92) : 4 + index * 8,
    }];
  });

  const listWatchers: NonNullable<ProjectDocument["listWatchers"]> = monitors.flatMap((monitor, index) => {
    if (monitor.opcode !== "data_listcontents") return [];
    const name = monitorName(monitor, "LIST");
    if (!name) return [];
    return [{
      id: monitor.id || `list-watcher-${index}-${name}`,
      name,
      visible: monitor.visible !== false,
      x: typeof monitor.x === "number" ? clampPercent((monitor.x / 480) * 100, 84) : 4,
      y: typeof monitor.y === "number" ? clampPercent((monitor.y / 360) * 100, 76) : 14 + index * 10,
    }];
  });

  return { variableWatchers, listWatchers };
}

async function parseScratchSounds(target: ScratchTarget, zip: JSZip) {
  return await Promise.all((target.sounds ?? []).map(async (sound, index) => {
    const asset = zip.file(sound.md5ext);
    const bytes = asset ? new Uint8Array(await asset.async("uint8array")) : new Uint8Array();
    const format = (sound.dataFormat || "wav") as "wav" | "mp3";
    return {
      id: `sound-${index + 1}`,
      name: sound.name || `Sound ${index + 1}`,
      dataUrl: toAudioDataUrl(bytes, format),
      dataFormat: format,
      rate: sound.rate,
      sampleCount: sound.sampleCount,
      duration: sound.rate && sound.sampleCount ? sound.sampleCount / sound.rate : undefined,
      assetId: sound.assetId,
    };
  }));
}

function getFieldValue(block: ScratchBlock | undefined, name: string) {
  const field = block?.fields?.[name];
  if (!Array.isArray(field)) return "";
  return String(field[0] ?? "");
}

function readInput(block: ScratchBlock | undefined, name: string) {
  return block?.inputs?.[name];
}

function readInputBlockId(block: ScratchBlock | undefined, name: string) {
  const input = readInput(block, name);
  if (!Array.isArray(input)) return null;
  for (let i = input.length - 1; i >= 0; i -= 1) {
    const candidate = input[i];
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

function readInputLiteral(block: ScratchBlock | undefined, name: string): ScriptValue | null {
  const input = readInput(block, name);
  if (!Array.isArray(input)) return null;

  const candidates = [...input].reverse();
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    if (typeof candidate[0] === "number" && candidate.length >= 2) {
      const value = candidate[1];
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const asNumber = Number(value);
        if (Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(value.trim())) return asNumber;
        return value;
      }
    }
  }
  return null;
}

function readInputValue(block: ScratchBlock | undefined, name: string, blocks: Record<string, ScratchBlock>): ScriptValue {
  const blockId = readInputBlockId(block, name);
  if (blockId) return parseReporter(blockId, blocks);
  return readInputLiteral(block, name) ?? 0;
}

function readMenuValue(block: ScratchBlock | undefined, inputName: string, fieldName: string, blocks: Record<string, ScratchBlock>, fallback: string) {
  const menuId = readInputBlockId(block, inputName);
  const menu = menuId ? blocks[menuId] : undefined;
  return getFieldValue(menu, fieldName) || getFieldValue(block, fieldName) || fallback;
}

function readSoundName(block: ScratchBlock | undefined, blocks: Record<string, ScratchBlock>) {
  return readMenuValue(block, "SOUND_MENU", "SOUND_MENU", blocks, getFieldValue(block, "SOUND") || "sound-1");
}

function parseCondition(blockId: string | null, blocks: Record<string, ScratchBlock>): ScriptCondition {
  if (!blockId) return { type: "boolean", value: false };
  const block = blocks[blockId];
  if (!block) return { type: "boolean", value: false };

  switch (block.opcode) {
    case "operator_and":
      return { type: "and", left: parseCondition(readInputBlockId(block, "OPERAND1"), blocks), right: parseCondition(readInputBlockId(block, "OPERAND2"), blocks) };
    case "operator_or":
      return { type: "or", left: parseCondition(readInputBlockId(block, "OPERAND1"), blocks), right: parseCondition(readInputBlockId(block, "OPERAND2"), blocks) };
    case "operator_not":
      return { type: "not", condition: parseCondition(readInputBlockId(block, "OPERAND"), blocks) };
    case "operator_equals":
      return { type: "compare", operator: "=", left: readInputValue(block, "OPERAND1", blocks), right: readInputValue(block, "OPERAND2", blocks) };
    case "operator_gt":
      return { type: "compare", operator: ">", left: readInputValue(block, "OPERAND1", blocks), right: readInputValue(block, "OPERAND2", blocks) };
    case "operator_lt":
      return { type: "compare", operator: "<", left: readInputValue(block, "OPERAND1", blocks), right: readInputValue(block, "OPERAND2", blocks) };
    case "sensing_keypressed": {
      const key = readMenuValue(block, "KEY_OPTION", "KEY_OPTION", blocks, "space").toLowerCase();
      return key === "any" ? { type: "anyKeyPressed" } : { type: "keyPressed", key };
    }
    case "sensing_touchingobject": {
      const obj = readMenuValue(block, "TOUCHINGOBJECTMENU", "TOUCHINGOBJECTMENU", blocks, getFieldValue(block, "OBJECT") || "edge");
      return { type: "touchingObject", object: scratchObjectName(obj) };
    }
    case "sensing_mousedown":
      return { type: "mouseDown" };
    case "operator_contains":
      return { type: "contains", text: readInputValue(block, "STRING1", blocks), search: readInputValue(block, "STRING2", blocks) };
    case "data_listcontainsitem":
      return { type: "listContains", list: getFieldValue(block, "LIST"), item: readInputValue(block, "ITEM", blocks) };
    case "operator_bool": {
      const value = getFieldValue(block, "BOOL");
      return { type: "boolean", value: value.toLowerCase() === "true" };
    }
    case "sensing_touchingcolor": {
      const color = readInputValue(block, "COLOR", blocks);
      return { type: "touchingColor", color: typeof color === "string" ? color : "#52c3f0" };
    }
    case "sensing_coloristouchingcolor": {
      const color = readInputValue(block, "COLOR", blocks);
      const touching = readInputValue(block, "COLOR2", blocks);
      return {
        type: "colorTouchingColor",
        color: typeof color === "string" ? color : "#5b6d7c",
        touching: typeof touching === "string" ? touching : "#d5e04a",
      };
    }
    case "argument_reporter_boolean":
      return { type: "boolean", value: false };
    default:
      return { type: "boolean", value: false };
  }
}

function parseReporter(blockId: string | null, blocks: Record<string, ScratchBlock>): ScriptValue {
  if (!blockId) return 0;
  const block = blocks[blockId];
  if (!block) return 0;

  switch (block.opcode) {
    case "math_number":
      return Number(getFieldValue(block, "NUM") || 0);
    case "text":
      return getFieldValue(block, "TEXT");
    case "sensing_mousex":
      return { type: "sensing", property: "mouseX" };
    case "sensing_mousey":
      return { type: "sensing", property: "mouseY" };
    case "sensing_timer":
      return { type: "sensing", property: "timer" };
    case "looks_size":
      return { type: "spriteProperty", property: "size" };
    case "motion_xposition":
      return { type: "spriteProperty", property: "x" };
    case "motion_yposition":
      return { type: "spriteProperty", property: "y" };
    case "motion_direction":
      return { type: "spriteProperty", property: "direction" };
    case "operator_add":
      return { type: "arithmetic", operator: "+", left: readInputValue(block, "NUM1", blocks), right: readInputValue(block, "NUM2", blocks) };
    case "operator_subtract":
      return { type: "arithmetic", operator: "-", left: readInputValue(block, "NUM1", blocks), right: readInputValue(block, "NUM2", blocks) };
    case "operator_multiply":
      return { type: "arithmetic", operator: "*", left: readInputValue(block, "NUM1", blocks), right: readInputValue(block, "NUM2", blocks) };
    case "operator_divide":
      return { type: "arithmetic", operator: "/", left: readInputValue(block, "NUM1", blocks), right: readInputValue(block, "NUM2", blocks) };
    case "operator_random":
      return { type: "random", from: readInputValue(block, "FROM", blocks), to: readInputValue(block, "TO", blocks) };
    case "operator_round":
      return { type: "round", value: readInputValue(block, "NUM", blocks) };
    case "operator_mathop": {
      const operator = getFieldValue(block, "OPERATOR").toLowerCase();
      const map: Record<string, "abs" | "floor" | "ceiling" | "sqrt" | "sin" | "cos" | "tan" | "asin" | "acos" | "atan" | "ln" | "log" | "e^" | "10^"> = {
        abs: "abs",
        floor: "floor",
        ceiling: "ceiling",
        sqrt: "sqrt",
        sin: "sin",
        cos: "cos",
        tan: "tan",
        asin: "asin",
        acos: "acos",
        atan: "atan",
        ln: "ln",
        log: "log",
        "e ^": "e^",
        "10 ^": "10^",
        "e^": "e^",
        "10^": "10^",
      };
      return { type: "math", operator: map[operator] ?? "abs", value: readInputValue(block, "NUM", blocks) };
    }
    case "operator_join":
      return { type: "join", values: [readInputValue(block, "STRING1", blocks), readInputValue(block, "STRING2", blocks)] };
    case "operator_letter_of":
      return { type: "letterOf", index: readInputValue(block, "LETTER", blocks), text: readInputValue(block, "STRING", blocks) };
    case "operator_length":
      return { type: "lengthOf", text: readInputValue(block, "STRING", blocks) };
    case "data_variable":
      return { type: "variable", name: getFieldValue(block, "VARIABLE") };
    case "data_itemoflist":
      return { type: "listItem", list: getFieldValue(block, "LIST"), index: readInputValue(block, "INDEX", blocks) };
    case "data_itemnumoflist":
      return { type: "listIndex", list: getFieldValue(block, "LIST"), item: readInputValue(block, "ITEM", blocks) };
    case "data_lengthoflist":
      return { type: "listLength", list: getFieldValue(block, "LIST") };
    case "operator_mod":
      return { type: "arithmetic", operator: "%", left: readInputValue(block, "NUM1", blocks), right: readInputValue(block, "NUM2", blocks) };
    case "looks_costumenumbername": {
      const kind = getFieldValue(block, "NUMBER_NAME").toLowerCase();
      return { type: "costumeProperty", property: kind === "name" ? "costumeName" : "costumeNumber" };
    }
    case "looks_backdropnumbername": {
      const kind = getFieldValue(block, "NUMBER_NAME").toLowerCase();
      return { type: "stageProperty", property: kind === "name" ? "backdropName" : "backdropNumber" };
    }
    case "sensing_answer":
      return { type: "answer" };
    case "sensing_of": {
      const rawProperty = (getFieldValue(block, "PROPERTY") || getFieldValue(block, "PROPERTYOF") || "x position").toLowerCase();
      const rawObject = readInputValue(block, "OBJECT", blocks);
      const object = scratchObjectName(typeof rawObject === "string" && rawObject.trim().length > 0 ? rawObject : (getFieldValue(block, "OBJECT") || "Stage"));
      const property = rawProperty.includes("x")
        ? "x"
        : rawProperty.includes("y")
          ? "y"
          : rawProperty.includes("direction")
            ? "direction"
            : rawProperty.includes("costume") && rawProperty.includes("name")
              ? "costumeName"
              : rawProperty.includes("costume")
                ? "costumeNumber"
                : rawProperty.includes("size")
                  ? "size"
                  : rawProperty.includes("volume")
                    ? "volume"
                    : "x";
      return { type: "propertyOf", property, object };
    }
    case "sensing_current": {
      const unit = getFieldValue(block, "CURRENTMENU").toLowerCase();
      const property = unit === "year"
        ? "currentYear"
        : unit === "month"
          ? "currentMonth"
          : unit === "date"
            ? "currentDate"
            : unit === "dayofweek"
              ? "currentDayOfWeek"
              : unit === "hour"
                ? "currentHour"
                : unit === "minute"
                  ? "currentMinute"
                  : "currentSecond";
      return { type: "sensing", property };
    }
    case "sensing_dayssince2000":
      return { type: "sensing", property: "daysSince2000" };
    case "sensing_username":
      return { type: "sensing", property: "username" };
    case "sensing_loudness":
      return { type: "sensing", property: "loudness" };
    case "sound_volume":
      return { type: "soundVolume" };
    case "sensing_distanceto": {
      const obj = readMenuValue(block, "DISTANCETOMENU", "DISTANCETOMENU", blocks, getFieldValue(block, "OBJECT") || "center");
      return { type: "distanceToObject", object: scratchObjectName(obj) };
    }
    case "sensing_touchingobjectmenu":
      return getFieldValue(block, "TOUCHINGOBJECTMENU");
    case "sensing_distancetomenu":
      return getFieldValue(block, "DISTANCETOMENU");
    case "sensing_keyoptions":
      return getFieldValue(block, "KEY_OPTION");
    case "sensing_of_object_menu":
      return getFieldValue(block, "OBJECT");
    case "sound_sounds_menu":
      return getFieldValue(block, "SOUND_MENU");
    case "event_broadcast_menu":
      return getFieldValue(block, "BROADCAST_OPTION");
    case "looks_costume":
      return getFieldValue(block, "COSTUME");
    case "looks_backdrops":
      return getFieldValue(block, "BACKDROP");
    case "motion_goto_menu":
    case "motion_glideto_menu":
      return getFieldValue(block, "TO");
    case "motion_pointtowards_menu":
      return getFieldValue(block, "TOWARDS");
    case "argument_reporter_string_number":
      return getFieldValue(block, "VALUE");
    case "argument_reporter_boolean":
      return getFieldValue(block, "VALUE").toLowerCase() === "true" ? 1 : 0;
    case "procedures_callreturn":
      return 0;
    default:
      return 0;
  }
}

function parseStack(startId: string | null, blocks: Record<string, ScratchBlock>, assetMaps: ScratchAssetMaps = {}): ScriptNode[] {
  const nodes: ScriptNode[] = [];
  let currentId = startId;

  while (currentId) {
    const block = blocks[currentId];
    if (!block) break;

    switch (block.opcode) {
      case "motion_movesteps":
        nodes.push({ type: "move", steps: readInputValue(block, "STEPS", blocks) });
        break;
      case "motion_turnright":
        nodes.push({ type: "turn", degrees: readInputValue(block, "DEGREES", blocks) });
        break;
      case "motion_turnleft": {
        const deg = readInputValue(block, "DEGREES", blocks);
        nodes.push({ type: "turn", degrees: typeof deg === "number" ? -deg : { type: "arithmetic", operator: "*", left: deg, right: -1 } });
        break;
      }
      case "motion_gotoxy":
        nodes.push({ type: "setPosition", x: readInputValue(block, "X", blocks), y: readInputValue(block, "Y", blocks) });
        break;
      case "motion_changexby":
        nodes.push({ type: "changeX", dx: readInputValue(block, "DX", blocks) });
        break;
      case "motion_setx":
        nodes.push({ type: "setX", x: readInputValue(block, "X", blocks) });
        break;
      case "motion_changeyby":
        nodes.push({ type: "changeY", dy: readInputValue(block, "DY", blocks) });
        break;
      case "motion_sety":
        nodes.push({ type: "setY", y: readInputValue(block, "Y", blocks) });
        break;
      case "motion_pointindirection":
        nodes.push({ type: "pointInDirection", direction: readInputValue(block, "DIRECTION", blocks) });
        break;
      case "motion_ifonedgebounce":
        nodes.push({ type: "ifOnEdgeBounce" });
        break;
      case "motion_goto": {
        const gotoObj = readMenuValue(block, "TO", "TO", blocks, "_mouse_");
        nodes.push({ type: "goToObject", object: scratchObjectName(gotoObj) });
        break;
      }
      case "motion_pointtowards": {
        const pointObj = readMenuValue(block, "TOWARDS", "TOWARDS", blocks, "_mouse_");
        nodes.push({ type: "pointTowardObject", object: scratchObjectName(pointObj) });
        break;
      }
      case "motion_glidesecstoxy":
        nodes.push({ type: "glideToPosition", seconds: readInputValue(block, "SECS", blocks), x: readInputValue(block, "X", blocks), y: readInputValue(block, "Y", blocks) });
        break;
      case "motion_glideto": {
        const glideObj = readMenuValue(block, "TO", "TO", blocks, "_mouse_");
        nodes.push({ type: "glideToObject", seconds: readInputValue(block, "SECS", blocks), object: scratchObjectName(glideObj) });
        break;
      }
        break;
      case "looks_say":
        nodes.push({ type: "say", text: readInputValue(block, "MESSAGE", blocks) });
        break;
      case "looks_sayforsecs":
        nodes.push({ type: "sayForSeconds", text: readInputValue(block, "MESSAGE", blocks), seconds: readInputValue(block, "SECS", blocks) });
        break;
      case "looks_think":
        nodes.push({ type: "think", text: readInputValue(block, "MESSAGE", blocks) });
        break;
      case "looks_thinkforsecs":
        nodes.push({ type: "thinkForSeconds", text: readInputValue(block, "MESSAGE", blocks), seconds: readInputValue(block, "SECS", blocks) });
        break;
      case "looks_show":
        nodes.push({ type: "show" });
        break;
      case "looks_hide":
        nodes.push({ type: "hide" });
        break;
      case "looks_changesizeby":
        nodes.push({ type: "changeSize", amount: readInputValue(block, "CHANGE", blocks) });
        break;
      case "looks_setsizeto":
        nodes.push({ type: "setSize", size: readInputValue(block, "SIZE", blocks) });
        break;
      case "looks_switchcostumeto":
        nodes.push({ type: "switchCostume", costumeId: mapAssetName(readMenuValue(block, "COSTUME", "COSTUME", blocks, "costume-1"), assetMaps.costumes) });
        break;
      case "looks_nextcostume":
        nodes.push({ type: "nextCostume" });
        break;
      case "looks_switchbackdropto":
        nodes.push({ type: "switchBackdrop", backdropId: mapAssetName(readMenuValue(block, "BACKDROP", "BACKDROP", blocks, "backdrop-1"), assetMaps.backdrops) });
        break;
      case "looks_switchbackdropandwait":
        nodes.push({ type: "switchBackdropAndWait", backdropId: mapAssetName(readMenuValue(block, "BACKDROP", "BACKDROP", blocks, "backdrop-1"), assetMaps.backdrops) });
        break;
      case "looks_nextbackdrop":
        nodes.push({ type: "nextBackdrop" });
        break;
      case "looks_gotofrontback": {
        const where = getFieldValue(block, "FRONT_BACK").toLowerCase();
        nodes.push({ type: "goToLayer", layer: where.includes("back") ? "back" : "front" });
        break;
      }
      case "looks_goforwardbackwardlayers": {
        const direction = getFieldValue(block, "FORWARD_BACKWARD").toLowerCase();
        nodes.push({ type: "changeLayer", direction: direction.includes("backward") ? "backward" : "forward", amount: readInputValue(block, "NUM", blocks) });
        break;
      }
      case "event_broadcast":
        nodes.push({ type: "broadcast", message: String(readInputValue(block, "BROADCAST_INPUT", blocks) || "message1") });
        break;
      case "event_broadcastandwait":
        nodes.push({ type: "broadcastAndWait", message: String(readInputValue(block, "BROADCAST_INPUT", blocks) || "message1") });
        break;
      case "control_wait":
        nodes.push({ type: "wait", seconds: readInputValue(block, "DURATION", blocks) });
        break;
      case "control_repeat":
        nodes.push({ type: "repeat", times: readInputValue(block, "TIMES", blocks), body: parseStack(readInputBlockId(block, "SUBSTACK"), blocks, assetMaps) });
        break;
      case "control_forever":
        nodes.push({ type: "forever", body: parseStack(readInputBlockId(block, "SUBSTACK"), blocks, assetMaps) });
        break;
      case "control_repeat_until":
        nodes.push({ type: "repeatUntil", condition: parseCondition(readInputBlockId(block, "CONDITION"), blocks), body: parseStack(readInputBlockId(block, "SUBSTACK"), blocks, assetMaps) });
        break;
      case "control_wait_until":
        nodes.push({ type: "waitUntil", condition: parseCondition(readInputBlockId(block, "CONDITION"), blocks) });
        break;
      case "control_if":
        nodes.push({ type: "if", condition: parseCondition(readInputBlockId(block, "CONDITION"), blocks), body: parseStack(readInputBlockId(block, "SUBSTACK"), blocks, assetMaps) });
        break;
      case "control_if_else":
        nodes.push({ type: "ifElse", condition: parseCondition(readInputBlockId(block, "CONDITION"), blocks), thenBody: parseStack(readInputBlockId(block, "SUBSTACK"), blocks, assetMaps), elseBody: parseStack(readInputBlockId(block, "SUBSTACK2"), blocks, assetMaps) });
        break;
      case "control_create_clone_of":
        nodes.push({ type: "createClone" });
        break;
      case "control_delete_this_clone":
        nodes.push({ type: "deleteClone" });
        break;
      case "data_setvariableto":
        nodes.push({ type: "setVariable", name: getFieldValue(block, "VARIABLE"), value: readInputValue(block, "VALUE", blocks) });
        break;
      case "data_changevariableby":
        nodes.push({ type: "changeVariable", name: getFieldValue(block, "VARIABLE"), amount: readInputValue(block, "VALUE", blocks) });
        break;
      case "data_addtolist":
        nodes.push({ type: "listAdd", list: getFieldValue(block, "LIST"), item: readInputValue(block, "ITEM", blocks) });
        break;
      case "data_deleteoflist":
        nodes.push({ type: "listDelete", list: getFieldValue(block, "LIST"), index: readInputValue(block, "INDEX", blocks) });
        break;
      case "data_deletealloflist":
        nodes.push({ type: "listDelete", list: getFieldValue(block, "LIST"), index: "all" });
        break;
      case "data_insertatlist":
        nodes.push({ type: "listInsert", list: getFieldValue(block, "LIST"), index: readInputValue(block, "INDEX", blocks), item: readInputValue(block, "ITEM", blocks) });
        break;
      case "data_replaceitemoflist":
        nodes.push({ type: "listReplace", list: getFieldValue(block, "LIST"), index: readInputValue(block, "INDEX", blocks), item: readInputValue(block, "ITEM", blocks) });
        break;
      case "data_showlist":
        nodes.push({ type: "showList", list: getFieldValue(block, "LIST") });
        break;
      case "data_hidelist":
        nodes.push({ type: "hideList", list: getFieldValue(block, "LIST") });
        break;
      case "sound_play":
        nodes.push({ type: "playSound", soundId: readSoundName(block, blocks), wait: false });
        break;
      case "sound_playuntildone":
        nodes.push({ type: "playSound", soundId: readSoundName(block, blocks), wait: true });
        break;
      case "sound_stopallsounds":
        nodes.push({ type: "stopAllSounds" });
        break;
      case "sound_changeeffectby": {
        const effect = getFieldValue(block, "EFFECT").toLowerCase().includes("pan") ? "pan" : "pitch";
        nodes.push({ type: "changeSoundEffect", effect, amount: readInputValue(block, "VALUE", blocks) });
        break;
      }
      case "sound_seteffectto": {
        const effect = getFieldValue(block, "EFFECT").toLowerCase().includes("pan") ? "pan" : "pitch";
        nodes.push({ type: "setSoundEffect", effect, value: readInputValue(block, "VALUE", blocks) });
        break;
      }
      case "sound_cleareffects":
        nodes.push({ type: "clearSoundEffects" });
        break;
      case "sound_changevolumeby":
        nodes.push({ type: "changeVolume", amount: readInputValue(block, "VOLUME", blocks) });
        break;
      case "sound_setvolumeto":
        nodes.push({ type: "setVolume", volume: readInputValue(block, "VOLUME", blocks) });
        break;
      case "data_showvariable":
        nodes.push({ type: "showVariable", name: getFieldValue(block, "VARIABLE") || "variable" });
        break;
      case "data_hidevariable":
        nodes.push({ type: "hideVariable", name: getFieldValue(block, "VARIABLE") || "variable" });
        break;
      case "control_stop": {
        const stopMode = (getFieldValue(block, "STOP_OPTION") || getFieldValue(block, "STOP") || "all").toLowerCase().replace(/[_\s-]/g, "");
        nodes.push({ type: "stop", mode: stopMode === "thisscript" ? "thisScript" : "all" });
        break;
      }
      case "sensing_resettimer":
        nodes.push({ type: "resetTimer" });
        break;
      case "pen_clear":
      case "pen_stamp":
      case "pen_pendown":
      case "pen_penup":
      case "pen_setpencolortocolor":
      case "pen_changepencolorby":
      case "pen_setpencolortonum":
      case "pen_changepensizeby":
      case "pen_setpensizeto":
        break;
      case "sensing_askandwait":
        nodes.push({ type: "askAndWait", question: readInputValue(block, "QUESTION", blocks) });
        break;
      case "sensing_setdragmode": {
        const mode = (getFieldValue(block, "DRAG_MODE") || "draggable").toLowerCase();
        nodes.push({ type: "setDragMode", mode: mode.includes("not") ? "not draggable" : "draggable" });
        break;
      }
      case "looks_changeeffectby": {
        const effect = (getFieldValue(block, "EFFECT") ?? "color").toLowerCase().replace(/\s/g, "") as GraphicEffect;
        const validEffects: GraphicEffect[] = ["color", "fisheye", "whirl", "pixelate", "mosaic", "brightness", "ghost"];
        nodes.push({ type: "changeGraphicEffect", effect: validEffects.includes(effect) ? effect : "color", amount: readInputValue(block, "CHANGE", blocks) });
        break;
      }
      case "looks_seteffectto": {
        const effect = (getFieldValue(block, "EFFECT") ?? "color").toLowerCase().replace(/\s/g, "") as GraphicEffect;
        const validEffects: GraphicEffect[] = ["color", "fisheye", "whirl", "pixelate", "mosaic", "brightness", "ghost"];
        nodes.push({ type: "setGraphicEffect", effect: validEffects.includes(effect) ? effect : "color", value: readInputValue(block, "VALUE", blocks) });
        break;
      }
      case "looks_cleargraphiceffects":
        nodes.push({ type: "clearGraphicEffects" });
        break;
      case "procedures_callnoreturn":
        nodes.push({ type: "customCall", name: getFieldValue(block, "VALUE") || "block" });
        break;
      default:
        break;
    }

    currentId = block.next;
  }

  return nodes;
}

function parseScratchTargetPrograms(target: ScratchTargetWithBlocks, assetMaps: ScratchAssetMaps = {}) {
  const start: ScriptProgram = [];
  const cloneStart: ScriptProgram = [];
  const broadcasts: ScriptEventPrograms = {};
  const backdrops: ScriptEventPrograms = {};
  const keyPresses: ScriptEventPrograms = {};
  const spriteClicked: ScriptProgram = [];
  const stageClicked: ScriptProgram = [];

  for (const block of Object.values(target.blocks ?? {})) {
    if (!block?.topLevel) continue;
    if (block.opcode === "event_whenflagclicked") {
      start.push(parseStack(block.next, target.blocks, assetMaps));
      continue;
    }
    if (block.opcode === "control_start_as_clone") {
      cloneStart.push(parseStack(block.next, target.blocks, assetMaps));
      continue;
    }
    if (block.opcode === "event_whenbroadcastreceived") {
      const message = getFieldValue(block, "BROADCAST_OPTION") || "message1";
      if (!broadcasts[message]) broadcasts[message] = [];
      broadcasts[message].push(parseStack(block.next, target.blocks, assetMaps));
      continue;
    }
    if (block.opcode === "event_whenbackdropswitchesto") {
      const backdrop = mapAssetName(getFieldValue(block, "BACKDROP") || "backdrop-1", assetMaps.backdrops);
      if (!backdrops[backdrop]) backdrops[backdrop] = [];
      backdrops[backdrop].push(parseStack(block.next, target.blocks, assetMaps));
      continue;
    }
    if (block.opcode === "event_whenkeypressed") {
      const key = (getFieldValue(block, "KEY_OPTION") || "space").toLowerCase();
      if (!keyPresses[key]) keyPresses[key] = [];
      keyPresses[key].push(parseStack(block.next, target.blocks, assetMaps));
      continue;
    }
    if (block.opcode === "event_whenstageclicked") {
      stageClicked.push(parseStack(block.next, target.blocks, assetMaps));
      continue;
    }
    if (block.opcode === "event_whenthisspriteclicked") {
      spriteClicked.push(parseStack(block.next, target.blocks, assetMaps));
      continue;
    }
  }

  return { start, cloneStart, broadcasts, backdrops, keyPresses, spriteClicked, stageClicked };
}

function safeProgramsToWorkspaceState(programs: ReturnType<typeof parseScratchTargetPrograms>) {
  try {
    return programsToWorkspaceState(programs.start, programs.cloneStart, programs.broadcasts, programs.backdrops, programs.keyPresses, programs.spriteClicked, programs.stageClicked);
  } catch {
    return null;
  }
}


export async function importProjectFromSb3(file: File): Promise<{ name: string; document: ProjectDocument; warnings?: string[] }> {
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file("project.json");
  if (!projectFile) throw new Error("Invalid .sb3: missing project.json");

  const parsed = JSON.parse(await projectFile.async("text")) as ScratchProjectJson;
  const warnings: string[] = [];
  const embeddedDocument = parsed.meta?.neurixDocument;
  if (embeddedDocument) {
    const document = JSON.parse(base64Decode(embeddedDocument)) as ProjectDocument;
    return { name: parsed.meta?.neurixName || file.name.replace(/\.sb3$/i, "") || "Imported Project", document, warnings };
  }

  const stageTarget = parsed.targets.find((target) => target.isStage) ?? parsed.targets[0];
  if (!stageTarget) throw new Error("Invalid .sb3: no targets found");

  const allOpcodes = new Set<string>();
  for (const target of parsed.targets as ScratchTargetWithBlocks[]) {
    for (const block of Object.values(target.blocks ?? {})) {
      if (block?.opcode) allOpcodes.add(block.opcode);
    }
  }
  const unsupportedOpcodes = [...allOpcodes].filter((opcode) => !supportedStatementOpcodes.has(opcode) && !supportedReporterOpcodes.has(opcode) && !supportedConditionOpcodes.has(opcode) && !supportedHatOpcodes.has(opcode));
  if (unsupportedOpcodes.length > 0) {
    warnings.push(`Unsupported Scratch opcodes skipped: ${unsupportedOpcodes.sort().join(", ")}`);
  }

  const stageCostumes = await Promise.all((stageTarget.costumes ?? []).map(async (costume, index) => {
    const asset = zip.file(costume.md5ext);
    const bytes = asset ? new Uint8Array(await asset.async("uint8array")) : toSvgBytesFromFill(costume.name || `Backdrop ${index + 1}`, "#f5f5f7");
    const format = (costume.dataFormat || "svg") as "svg" | "png" | "jpg";
    return {
      id: `backdrop-${index + 1}`,
      name: costume.name || `Backdrop ${index + 1}`,
      fill: "#f5f5f7",
      image: toDataUrl(bytes, format),
      imageFormat: format,
      rotationCenterX: costume.rotationCenterX,
      rotationCenterY: costume.rotationCenterY,
      artwork: { elements: [], pixelCells: [] },
    };
  }));

  const spriteTargets = parsed.targets.filter((target) => !target.isStage);
  const backdropNameToId = nameToIdMap(stageCostumes);
  const stagePrograms = parseScratchTargetPrograms(stageTarget as ScratchTargetWithBlocks, { backdrops: backdropNameToId });
  const stageSounds = await parseScratchSounds(stageTarget, zip);
  const { variableWatchers, listWatchers } = parseScratchMonitors(parsed.monitors ?? []);
  const sprites = await Promise.all(spriteTargets.map(async (target, targetIndex) => {
    const costumes = await Promise.all((target.costumes ?? []).map(async (costume, index) => {
      const asset = zip.file(costume.md5ext);
      const bytes = asset ? new Uint8Array(await asset.async("uint8array")) : toSvgBytesFromFill(costume.name || `Costume ${index + 1}`, "#56CBF9");
      const format = (costume.dataFormat || "svg") as "svg" | "png" | "jpg";
      return {
        id: `costume-${index + 1}`,
        name: costume.name || `Costume ${index + 1}`,
        image: toDataUrl(bytes, format),
        imageFormat: format,
        rotationCenterX: costume.rotationCenterX,
        rotationCenterY: costume.rotationCenterY,
      };
    }));
    const spritePrograms = scopePrograms(
      parseScratchTargetPrograms(target as ScratchTargetWithBlocks, { backdrops: backdropNameToId, costumes: nameToIdMap(costumes) }),
      scratchDataNameMap(target, target.name, "variables"),
      scratchDataNameMap(target, target.name, "lists"),
    );

    return {
      id: `sprite-${targetIndex + 1}`,
      name: target.name || `Sprite ${targetIndex + 1}`,
      x: target.x ?? 0,
      y: target.y ?? 0,
      size: target.size ?? 100,
      direction: target.direction ?? 90,
      layer: target.layerOrder ?? targetIndex,
      tone: "#56CBF9",
      visible: target.visible !== false,
      draggable: target.draggable === true,
      sounds: await parseScratchSounds(target, zip),
      volume: typeof target.volume === "number" ? target.volume : 100,
      workspaceState: safeProgramsToWorkspaceState(spritePrograms),
      program: spritePrograms.start,
      cloneProgram: spritePrograms.cloneStart,
      broadcastPrograms: spritePrograms.broadcasts,
      backdropPrograms: spritePrograms.backdrops,
      keyPressPrograms: spritePrograms.keyPresses,
      spriteClickedProgram: spritePrograms.spriteClicked,
      stageClickedProgram: spritePrograms.stageClicked,
      variables: parseScratchVariables(target, target.name),
      lists: parseScratchLists(target, target.name),
      costumes,
      currentCostumeId: costumes[Math.max(0, target.currentCostume ?? 0)]?.id ?? costumes[0]?.id ?? "costume-1",
    };
  }));

  const document: ProjectDocument = {
    version: 1,
    cloudVariables: parseScratchCloudVariables(stageTarget),
    variables: parseScratchVariables(stageTarget),
    lists: parseScratchLists(stageTarget),
    variableWatchers,
    listWatchers,
    stage: {
      minX: -240,
      maxX: 240,
      minY: -180,
      maxY: 180,
      background: "#f5f5f7",
      backdrops: stageCostumes,
      currentBackdropId: stageCostumes[Math.max(0, stageTarget.currentCostume ?? 0)]?.id ?? stageCostumes[0]?.id,
      workspaceState: safeProgramsToWorkspaceState(stagePrograms),
      program: stagePrograms.start,
      broadcastPrograms: stagePrograms.broadcasts,
      backdropPrograms: stagePrograms.backdrops,
      keyPressPrograms: stagePrograms.keyPresses,
      stageClickedProgram: stagePrograms.stageClicked,
      sounds: stageSounds,
      volume: typeof stageTarget.volume === "number" ? stageTarget.volume : 100,
    },
    sprites,
  };

  return { name: file.name.replace(/\.sb3$/i, "") || "Imported Project", document, warnings };
}

export function getSb3FileName(projectName: string) {
  return `${sanitizeFileName(projectName)}.sb3`;
}
