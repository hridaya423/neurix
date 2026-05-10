import JSZip from "jszip";
import type { ProjectDocument } from "@/components/editor/NeurixEditor";
import { programsToWorkspaceState } from "@/lib/blockly/astToBlockly";
import type { ScriptCondition, ScriptEventPrograms, ScriptNode, ScriptProgram, ScriptValue } from "@/lib/compiler/types";

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
  sounds: unknown[];
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
  monitors: unknown[];
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

type ScratchTargetWithBlocks = ScratchTarget & {
  blocks: Record<string, ScratchBlock>;
};


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

  const stageTarget: ScratchTarget = {
    isStage: true,
    name: "Stage",
    variables: stageVariables,
    lists: stageLists,
    broadcasts: {},
    blocks: {},
    comments: {},
    currentCostume: Math.max(0, stageCostumes.findIndex((c) => c.name === (stage.backdrops ?? [])[0]?.name)),
    costumes: stageCostumes.length > 0 ? stageCostumes : [{
      ...addAsset("Backdrop 1", undefined, stage.background, "svg"),
      name: "Backdrop 1",
      bitmapResolution: 1,
      rotationCenterX: 240,
      rotationCenterY: 180,
    }],
    sounds: [],
    volume: 100,
    layerOrder: 0,
    tempo: 60,
    videoTransparency: 50,
    videoState: "on",
    textToSpeechLanguage: null,
  };

  const spriteTargets: ScratchTarget[] = document.sprites.map((sprite, spriteIndex) => {
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
      sounds: [],
      volume: 100,
      layerOrder: sprite.layer ?? spriteIndex + 1,
      x: sprite.x,
      y: sprite.y,
      size: sprite.size,
      direction: sprite.direction,
      draggable: false,
      rotationStyle: "all around",
      visible: sprite.visible,
    };
  });

  const scratchProject: ScratchProjectJson = {
    targets: [stageTarget, ...spriteTargets],
    monitors: [],
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

function parseScratchVariables(target: ScratchTarget, spriteName?: string) {
  const entries = Object.values(target.variables ?? {});
  const out: Record<string, number | string> = {};
  for (const entry of entries) {
    const name = String(entry?.[0] ?? "").trim();
    if (!name) continue;
    const scoped = spriteName ? `${spriteName}: ${name}` : name;
    out[scoped] = (entry?.[1] ?? 0) as number | string;
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
    if (Array.isArray(candidate)) {
      for (let j = candidate.length - 1; j >= 0; j -= 1) {
        if (typeof candidate[j] === "string") return candidate[j];
      }
    }
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
    case "sensing_keypressed":
      return { type: "keyPressed", key: getFieldValue(block, "KEY_OPTION") || "space" };
    case "sensing_touchingobject":
      return { type: "touchingEdge" };
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
      const map: Record<string, "abs" | "floor" | "ceiling" | "sqrt" | "sin" | "cos" | "tan"> = {
        abs: "abs",
        floor: "floor",
        ceiling: "ceiling",
        sqrt: "sqrt",
        sin: "sin",
        cos: "cos",
        tan: "tan",
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
    default:
      return 0;
  }
}

function parseStack(startId: string | null, blocks: Record<string, ScratchBlock>): ScriptNode[] {
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
      case "motion_glidesecstoxy":
        nodes.push({ type: "glideToPosition", seconds: readInputValue(block, "SECS", blocks), x: readInputValue(block, "X", blocks), y: readInputValue(block, "Y", blocks) });
        break;
      case "motion_glideto":
        nodes.push({ type: "glideToMouse", seconds: readInputValue(block, "SECS", blocks) });
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
        nodes.push({ type: "switchCostume", costumeId: getFieldValue(block, "COSTUME") || "costume-1" });
        break;
      case "looks_nextcostume":
        nodes.push({ type: "nextCostume" });
        break;
      case "looks_switchbackdropto":
        nodes.push({ type: "switchBackdrop", backdropId: getFieldValue(block, "BACKDROP") || "backdrop-1" });
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
        nodes.push({ type: "broadcast", message: readInputValue(block, "BROADCAST_INPUT", blocks).toString() });
        break;
      case "event_broadcastandwait":
        nodes.push({ type: "broadcastAndWait", message: readInputValue(block, "BROADCAST_INPUT", blocks).toString() });
        break;
      case "control_wait":
        nodes.push({ type: "wait", seconds: readInputValue(block, "DURATION", blocks) });
        break;
      case "control_repeat":
        nodes.push({ type: "repeat", times: readInputValue(block, "TIMES", blocks), body: parseStack(readInputBlockId(block, "SUBSTACK"), blocks) });
        break;
      case "control_forever":
        nodes.push({ type: "forever", body: parseStack(readInputBlockId(block, "SUBSTACK"), blocks) });
        break;
      case "control_repeat_until":
        nodes.push({ type: "repeatUntil", condition: parseCondition(readInputBlockId(block, "CONDITION"), blocks), body: parseStack(readInputBlockId(block, "SUBSTACK"), blocks) });
        break;
      case "control_wait_until":
        nodes.push({ type: "waitUntil", condition: parseCondition(readInputBlockId(block, "CONDITION"), blocks) });
        break;
      case "control_if":
        nodes.push({ type: "if", condition: parseCondition(readInputBlockId(block, "CONDITION"), blocks), body: parseStack(readInputBlockId(block, "SUBSTACK"), blocks) });
        break;
      case "control_if_else":
        nodes.push({ type: "ifElse", condition: parseCondition(readInputBlockId(block, "CONDITION"), blocks), thenBody: parseStack(readInputBlockId(block, "SUBSTACK"), blocks), elseBody: parseStack(readInputBlockId(block, "SUBSTACK2"), blocks) });
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
      default:
        break;
    }

    currentId = block.next;
  }

  return nodes;
}

function parseScratchTargetPrograms(target: ScratchTargetWithBlocks) {
  const start: ScriptProgram = [];
  const cloneStart: ScriptProgram = [];
  const broadcasts: ScriptEventPrograms = {};
  const backdrops: ScriptEventPrograms = {};

  for (const block of Object.values(target.blocks ?? {})) {
    if (!block?.topLevel) continue;
    if (block.opcode === "event_whenflagclicked") {
      start.push(parseStack(block.next, target.blocks));
      continue;
    }
    if (block.opcode === "control_start_as_clone") {
      cloneStart.push(parseStack(block.next, target.blocks));
      continue;
    }
    if (block.opcode === "event_whenbroadcastreceived") {
      const message = getFieldValue(block, "BROADCAST_OPTION") || "message1";
      if (!broadcasts[message]) broadcasts[message] = [];
      broadcasts[message].push(parseStack(block.next, target.blocks));
      continue;
    }
    if (block.opcode === "event_whenbackdropswitchesto") {
      const backdrop = getFieldValue(block, "BACKDROP") || "backdrop-1";
      if (!backdrops[backdrop]) backdrops[backdrop] = [];
      backdrops[backdrop].push(parseStack(block.next, target.blocks));
      continue;
    }
    if (block.opcode === "event_whenkeypressed") {
      start.push(parseStack(block.next, target.blocks));
    }
  }

  return { start, cloneStart, broadcasts, backdrops };
}


export async function importProjectFromSb3(file: File): Promise<{ name: string; document: ProjectDocument }> {
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file("project.json");
  if (!projectFile) throw new Error("Invalid .sb3: missing project.json");

  const parsed = JSON.parse(await projectFile.async("text")) as ScratchProjectJson;
  const embeddedDocument = parsed.meta?.neurixDocument;
  if (embeddedDocument) {
    const document = JSON.parse(base64Decode(embeddedDocument)) as ProjectDocument;
    return { name: parsed.meta?.neurixName || file.name.replace(/\.sb3$/i, "") || "Imported Project", document };
  }

  const stageTarget = parsed.targets.find((target) => target.isStage) ?? parsed.targets[0];
  if (!stageTarget) throw new Error("Invalid .sb3: no targets found");

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
  const stagePrograms = parseScratchTargetPrograms(stageTarget as ScratchTargetWithBlocks);
  const sprites = await Promise.all(spriteTargets.map(async (target, targetIndex) => {
    const spritePrograms = parseScratchTargetPrograms(target as ScratchTargetWithBlocks);
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
      workspaceState: programsToWorkspaceState(spritePrograms.start, spritePrograms.cloneStart, spritePrograms.broadcasts, spritePrograms.backdrops),
      program: spritePrograms.start,
      cloneProgram: spritePrograms.cloneStart,
      broadcastPrograms: spritePrograms.broadcasts,
      backdropPrograms: spritePrograms.backdrops,
      variables: parseScratchVariables(target, target.name),
      lists: parseScratchLists(target, target.name),
      costumes,
      currentCostumeId: costumes[Math.max(0, target.currentCostume ?? 0)]?.id ?? costumes[0]?.id ?? "costume-1",
    };
  }));

  const document: ProjectDocument = {
    version: 1,
    cloudVariables: {},
    variables: parseScratchVariables(stageTarget),
    lists: parseScratchLists(stageTarget),
    variableWatchers: [],
    listWatchers: [],
    stage: {
      minX: -240,
      maxX: 240,
      minY: -180,
      maxY: 180,
      background: "#f5f5f7",
      backdrops: stageCostumes,
      currentBackdropId: stageCostumes[Math.max(0, stageTarget.currentCostume ?? 0)]?.id ?? stageCostumes[0]?.id,
      workspaceState: programsToWorkspaceState(stagePrograms.start, stagePrograms.cloneStart, stagePrograms.broadcasts, stagePrograms.backdrops),
      program: stagePrograms.start,
      broadcastPrograms: stagePrograms.broadcasts,
      backdropPrograms: stagePrograms.backdrops,
    },
    sprites,
  };

  return { name: file.name.replace(/\.sb3$/i, "") || "Imported Project", document };
}

export function getSb3FileName(projectName: string) {
  return `${sanitizeFileName(projectName)}.sb3`;
}
