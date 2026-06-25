
import { describe, expect, it } from "vitest";
import type { ProjectDocument } from "@/components/editor/NeurixEditor";
import { exportProjectToSb3, getSb3FileName, importProjectFromSb3 } from "@/lib/scratch/sb3";
const globalAny = globalThis as unknown as { window?: { btoa: typeof btoa; atob: typeof atob } };
globalAny.window ??= { btoa, atob };

function sampleDocument(): ProjectDocument {
  return {
    version: 1,
    cloudVariables: {},
    variables: { score: 5, greeting: "hi" },
    lists: { fruit: ["apple", "pear"] },
    variableWatchers: [],
    listWatchers: [],
    stage: {
      minX: -240,
      maxX: 240,
      minY: -180,
      maxY: 180,
      background: "#f5f5f7",
      backdrops: [
        {
          id: "backdrop-1",
          name: "Backdrop 1",
          fill: "#f5f5f7",
          image: "",
          imageFormat: "svg",
          rotationCenterX: 240,
          rotationCenterY: 180,
          artwork: { elements: [], pixelCells: [] },
        },
      ],
      currentBackdropId: "backdrop-1",
      workspaceState: null,
      program: [[{ type: "move", steps: 10 }]],
      broadcastPrograms: {},
      backdropPrograms: {},
      keyPressPrograms: {},
      stageClickedProgram: [],
      sounds: [],
      volume: 100,
    },
    sprites: [
      {
        id: "sprite-1",
        name: "Kite",
        x: 0,
        y: 0,
        size: 100,
        direction: 90,
        layer: 0,
        tone: "#56CBF9",
        visible: true,
        workspaceState: null,
        program: [[{ type: "say", text: "hi" }]],
        cloneProgram: [],
        broadcastPrograms: {},
        backdropPrograms: {},
        keyPressPrograms: {},
        spriteClickedProgram: [],
        stageClickedProgram: [],
        variables: {},
        lists: {},
        costumes: [
          {
            id: "costume-1",
            name: "Costume 1",
            image: "",
            imageFormat: "svg",
            rotationCenterX: 240,
            rotationCenterY: 180,
          },
        ],
        currentCostumeId: "costume-1",
        sounds: [],
        volume: 100,
      },
    ],
  } as unknown as ProjectDocument;
}

async function roundTrip(name: string, document: ProjectDocument) {
  const blob = await exportProjectToSb3(name, document);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return importProjectFromSb3(bytes as unknown as File);
}

describe("sb3 persistence", () => {
  it("round-trips a Neurix project document without loss", async () => {
    const document = sampleDocument();
    const result = await roundTrip("My Game", document);
    expect(result.name).toBe("My Game");
    expect(result.document).toEqual(document);
  });

  it("preserves variables, lists and scripts through the embedded document", async () => {
    const result = await roundTrip("Vars", sampleDocument());
    expect(result.document.variables).toEqual({ score: 5, greeting: "hi" });
    expect(result.document.lists).toEqual({ fruit: ["apple", "pear"] });
    expect(result.document.sprites[0].program).toEqual([[{ type: "say", text: "hi" }]]);
  });

  it("produces a valid .sb3 zip containing project.json", async () => {
    const blob = await exportProjectToSb3("Zip Check", sampleDocument());
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const projectJson = zip.file("project.json");
    expect(projectJson).not.toBeNull();
    const parsed = JSON.parse(await projectJson!.async("text"));
    expect(parsed.meta.agent).toBe("Neurix");
    expect(parsed.meta.neurixName).toBe("Zip Check");
    expect(parsed.targets[0].isStage).toBe(true);
  });

  it("exports visible watchers as Scratch monitors", async () => {
    const document = sampleDocument();
    document.variableWatchers = [{ id: "score-watch", name: "score", visible: true, mode: "large", x: 10, y: 20 }];
    document.listWatchers = [{ id: "fruit-watch", name: "fruit", visible: true, x: 30, y: 40 }];

    const blob = await exportProjectToSb3("Watchers", document);
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const parsed = JSON.parse(await zip.file("project.json")!.async("text"));

    expect(parsed.monitors).toMatchObject([
      { id: "score", mode: "large", opcode: "data_variable", params: { VARIABLE: "score" }, x: 48, y: 72, visible: true },
      { id: "fruit", mode: "list", opcode: "data_listcontents", params: { LIST: "fruit" }, x: 144, y: 144, visible: true },
    ]);
  });

  it("exports selected costumes and volumes", async () => {
    const document = sampleDocument();
    document.stage.volume = 41;
    document.stage.backdrops!.push({
      id: "backdrop-2",
      name: "Backdrop 2",
      fill: "#ffffff",
      image: "",
      imageFormat: "svg",
      rotationCenterX: 240,
      rotationCenterY: 180,
      artwork: { elements: [], pixelCells: [] },
    });
    document.stage.currentBackdropId = "backdrop-2";
    document.sprites[0].volume = 62;
    document.sprites[0].draggable = true;
    document.sprites[0].costumes!.push({
      id: "costume-2",
      name: "Costume 2",
      image: "",
      imageFormat: "svg",
      rotationCenterX: 240,
      rotationCenterY: 180,
    });
    document.sprites[0].currentCostumeId = "costume-2";

    const blob = await exportProjectToSb3("State", document);
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const parsed = JSON.parse(await zip.file("project.json")!.async("text"));

    expect(parsed.targets[0]).toMatchObject({ currentCostume: 1, volume: 41 });
    expect(parsed.targets[1]).toMatchObject({ currentCostume: 1, volume: 62, draggable: true });
  });

  it("exports and imports Scratch cloud variables separately", async () => {
    const document = sampleDocument();
    document.cloudVariables = { "☁ Highscore": 99 };

    const blob = await exportProjectToSb3("Clouds", document);
    const { default: JSZip } = await import("jszip");
    const exportedZip = await JSZip.loadAsync(await blob.arrayBuffer());
    const exported = JSON.parse(await exportedZip.file("project.json")!.async("text"));
    expect(exported.targets[0].variables.var_cloud_0).toEqual(["☁ Highscore", 99, true]);

    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({
      targets: [{
        isStage: true,
        name: "Stage",
        variables: {
          cloudId: ["☁ Highscore", 123, true],
          scoreId: ["score", 7],
        },
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [],
        sounds: [],
        volume: 100,
        layerOrder: 0,
      }],
      monitors: [],
      extensions: [],
      meta: { semver: "3.0.0", vm: "0.2.0", agent: "Scratch" },
    }));
    const bytes = Object.assign(await zip.generateAsync({ type: "uint8array" }), { name: "scratch-cloud.sb3" });
    const result = await importProjectFromSb3(bytes as unknown as File);

    expect(result.document.cloudVariables).toEqual({ "☁ Highscore": 123 });
    expect(result.document.variables).toEqual({ score: 7 });
  });

  it("imports Scratch variable and list monitors as watchers", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({
      targets: [{
        isStage: true,
        name: "Stage",
        variables: { scoreId: ["score", 7] },
        lists: { fruitId: ["fruit", ["apple"]] },
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [],
        sounds: [],
        volume: 100,
        layerOrder: 0,
      }],
      monitors: [
        { id: "score", mode: "slider", opcode: "data_variable", params: { VARIABLE: "score" }, x: 48, y: 72, visible: true },
        { id: "fruit", mode: "list", opcode: "data_listcontents", params: { LIST: "fruit" }, x: 144, y: 144, visible: true },
      ],
      extensions: [],
      meta: { semver: "3.0.0", vm: "0.2.0", agent: "Scratch" },
    }));

    const bytes = Object.assign(await zip.generateAsync({ type: "uint8array" }), { name: "scratch-watchers.sb3" });
    const result = await importProjectFromSb3(bytes as unknown as File);

    expect(result.document.variableWatchers).toEqual([{ id: "score", name: "score", visible: true, mode: "slider", x: 10, y: 20 }]);
    expect(result.document.listWatchers).toEqual([{ id: "fruit", name: "fruit", visible: true, x: 30, y: 40 }]);
  });

  it("imports Scratch menu inputs without losing selected values", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({
      targets: [
        {
          isStage: true,
          name: "Stage",
          variables: {},
          lists: {},
          broadcasts: { msg: "Launch" },
          blocks: {},
          comments: {},
          currentCostume: 0,
          costumes: [
            { assetId: "backdrop", name: "Backdrop 1", md5ext: "missing.svg", dataFormat: "svg", bitmapResolution: 1, rotationCenterX: 240, rotationCenterY: 180 },
            { assetId: "backdrop2", name: "Backdrop 2", md5ext: "missing2.svg", dataFormat: "svg", bitmapResolution: 1, rotationCenterX: 240, rotationCenterY: 180 },
          ],
          sounds: [],
          volume: 100,
          layerOrder: 0,
        },
        {
          isStage: false,
          name: "Sprite1",
          variables: { scoreId: ["score", 0] },
          lists: { fruitId: ["fruit", ["apple", "pear"]] },
          broadcasts: {},
          blocks: {
            hat: { opcode: "event_whenflagclicked", next: "broadcast", parent: null, topLevel: true },
            broadcast: { opcode: "event_broadcast", next: "broadcastWait", parent: "hat", inputs: { BROADCAST_INPUT: [1, "broadcastMenu"] } },
            broadcastMenu: { opcode: "event_broadcast_menu", next: null, parent: "broadcast", fields: { BROADCAST_OPTION: ["Launch", "msg"] } },
            broadcastWait: { opcode: "event_broadcastandwait", next: "costume", parent: "broadcast", inputs: { BROADCAST_INPUT: [1, "broadcastMenu2"] } },
            broadcastMenu2: { opcode: "event_broadcast_menu", next: null, parent: "broadcastWait", fields: { BROADCAST_OPTION: ["Land", "msg2"] } },
            costume: { opcode: "looks_switchcostumeto", next: "backdrop", parent: "broadcastWait", inputs: { COSTUME: [1, "costumeMenu"] } },
            costumeMenu: { opcode: "looks_costume", next: null, parent: "costume", fields: { COSTUME: ["Costume 2", null] } },
            backdrop: { opcode: "looks_switchbackdropto", next: "goto", parent: "costume", inputs: { BACKDROP: [1, "backdropMenu"] } },
            backdropMenu: { opcode: "looks_backdrops", next: null, parent: "backdrop", fields: { BACKDROP: ["Backdrop 2", null] } },
            goto: { opcode: "motion_goto", next: "say", parent: "backdrop", inputs: { TO: [1, "gotoMenu"] } },
            gotoMenu: { opcode: "motion_goto_menu", next: null, parent: "goto", fields: { TO: ["_random_", null] } },
            say: { opcode: "looks_say", next: "think", parent: "goto", inputs: { MESSAGE: [1, "distance"] } },
            distance: { opcode: "sensing_distanceto", next: null, parent: "say", inputs: { DISTANCETOMENU: [1, "distanceMenu"] } },
            distanceMenu: { opcode: "sensing_distancetomenu", next: null, parent: "distance", fields: { DISTANCETOMENU: ["_edge_", null] } },
            think: { opcode: "looks_think", next: "waitAny", parent: "say", inputs: { MESSAGE: [1, "log"] } },
            log: { opcode: "operator_mathop", next: null, parent: "think", fields: { OPERATOR: ["log", null] }, inputs: { NUM: [1, [4, "100"]] } },
            waitAny: { opcode: "control_wait_until", next: "ifEdge", parent: "think", inputs: { CONDITION: [1, "anyKey"] } },
            anyKey: { opcode: "sensing_keypressed", next: null, parent: "waitAny", inputs: { KEY_OPTION: [1, "anyKeyMenu"] } },
            anyKeyMenu: { opcode: "sensing_keyoptions", next: null, parent: "anyKey", fields: { KEY_OPTION: ["any", null] } },
            ifEdge: { opcode: "control_if", next: "replaceLast", parent: "waitAny", inputs: { CONDITION: [1, "touchEdge"], SUBSTACK: [2, "edgeSay"] } },
            touchEdge: { opcode: "sensing_touchingobject", next: null, parent: "ifEdge", inputs: { TOUCHINGOBJECTMENU: [1, "edgeMenu"] } },
            edgeMenu: { opcode: "sensing_touchingobjectmenu", next: null, parent: "touchEdge", fields: { TOUCHINGOBJECTMENU: ["_edge_", null] } },
            edgeSay: { opcode: "looks_say", next: null, parent: "ifEdge", inputs: { MESSAGE: [1, [10, "edge"]] } },
            replaceLast: { opcode: "data_replaceitemoflist", next: "setScore", parent: "ifEdge", fields: { LIST: ["fruit", "fruitId"] }, inputs: { INDEX: [1, [7, "last"]], ITEM: [1, [10, "plum"]] } },
            setScore: { opcode: "data_setvariableto", next: "stop", parent: "replaceLast", fields: { VARIABLE: ["score", "scoreId"] }, inputs: { VALUE: [1, "scoreReporter"] } },
            scoreReporter: { opcode: "data_variable", next: null, parent: "setScore", fields: { VARIABLE: ["score", "scoreId"] } },
            stop: { opcode: "control_stop", next: null, parent: "setScore", fields: { STOP_OPTION: ["this script", null] } },
          },
          comments: {},
          currentCostume: 0,
          costumes: [
            { assetId: "costume", name: "Costume 1", md5ext: "missing.svg", dataFormat: "svg", bitmapResolution: 1, rotationCenterX: 240, rotationCenterY: 180 },
            { assetId: "costume2", name: "Costume 2", md5ext: "missing2.svg", dataFormat: "svg", bitmapResolution: 1, rotationCenterX: 240, rotationCenterY: 180 },
          ],
          sounds: [],
          volume: 100,
          layerOrder: 1,
          x: 0,
          y: 0,
          size: 100,
          direction: 90,
          draggable: true,
          visible: true,
        },
      ],
      monitors: [],
      extensions: [],
      meta: { semver: "3.0.0", vm: "0.2.0", agent: "Scratch" },
    }));

    const bytes = Object.assign(await zip.generateAsync({ type: "uint8array" }), { name: "scratch-menus.sb3" });
    const result = await importProjectFromSb3(bytes as unknown as File);

    expect(result.document.sprites[0].program).toEqual([[
      { type: "broadcast", message: "Launch" },
      { type: "broadcastAndWait", message: "Land" },
      { type: "switchCostume", costumeId: "costume-2" },
      { type: "switchBackdrop", backdropId: "backdrop-2" },
      { type: "goToObject", object: "random position" },
      { type: "say", text: { type: "distanceToObject", object: "edge" } },
      { type: "think", text: { type: "math", operator: "log", value: 100 } },
      { type: "waitUntil", condition: { type: "anyKeyPressed" } },
      { type: "if", condition: { type: "touchingObject", object: "edge" }, body: [{ type: "say", text: "edge" }] },
      { type: "listReplace", list: "Sprite1: fruit", index: "last", item: "plum" },
      { type: "setVariable", name: "Sprite1: score", value: { type: "variable", name: "Sprite1: score" } },
      { type: "stop", mode: "thisScript" },
    ]]);
    expect(result.document.sprites[0].draggable).toBe(true);
    expect(result.document.sprites[0].variables).toEqual({ "Sprite1: score": 0 });
    expect(result.document.sprites[0].lists).toEqual({ "Sprite1: fruit": ["apple", "pear"] });
  });

  it("warns and skips Scratch greater-than event hats instead of treating them as green flag", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({
      targets: [
        {
          isStage: true,
          name: "Stage",
          variables: {},
          lists: {},
          broadcasts: {},
          blocks: {},
          comments: {},
          currentCostume: 0,
          costumes: [],
          sounds: [],
          volume: 100,
          layerOrder: 0,
        },
        {
          isStage: false,
          name: "Sprite1",
          variables: {},
          lists: {},
          broadcasts: {},
          blocks: {
            hat: { opcode: "event_whengreaterthan", next: "say", parent: null, topLevel: true, fields: { WHENGREATERTHANMENU: ["TIMER", null] }, inputs: { VALUE: [1, [4, "1"]] } },
            say: { opcode: "looks_say", next: null, parent: "hat", inputs: { MESSAGE: [1, [10, "timer"]] } },
          },
          comments: {},
          currentCostume: 0,
          costumes: [],
          sounds: [],
          volume: 100,
          layerOrder: 1,
          x: 0,
          y: 0,
          size: 100,
          direction: 90,
          visible: true,
        },
      ],
      monitors: [],
      extensions: [],
      meta: { semver: "3.0.0", vm: "0.2.0", agent: "Scratch" },
    }));

    const bytes = Object.assign(await zip.generateAsync({ type: "uint8array" }), { name: "scratch-greater-than.sb3" });
    const result = await importProjectFromSb3(bytes as unknown as File);

    expect(result.warnings).toEqual(["Unsupported Scratch opcodes skipped: event_whengreaterthan"]);
    expect(result.document.sprites[0].program).toEqual([]);
  });

  it("warns and skips Scratch custom block definitions instead of running them on green flag", async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({
      targets: [
        {
          isStage: true,
          name: "Stage",
          variables: {},
          lists: {},
          broadcasts: {},
          blocks: {},
          comments: {},
          currentCostume: 0,
          costumes: [],
          sounds: [],
          volume: 100,
          layerOrder: 0,
        },
        {
          isStage: false,
          name: "Sprite1",
          variables: {},
          lists: {},
          broadcasts: {},
          blocks: {
            def: { opcode: "procedures_definition", next: "say", parent: null, topLevel: true },
            say: { opcode: "looks_say", next: null, parent: "def", inputs: { MESSAGE: [1, [10, "definition"]] } },
          },
          comments: {},
          currentCostume: 0,
          costumes: [],
          sounds: [],
          volume: 100,
          layerOrder: 1,
          x: 0,
          y: 0,
          size: 100,
          direction: 90,
          visible: true,
        },
      ],
      monitors: [],
      extensions: [],
      meta: { semver: "3.0.0", vm: "0.2.0", agent: "Scratch" },
    }));

    const bytes = Object.assign(await zip.generateAsync({ type: "uint8array" }), { name: "scratch-custom-def.sb3" });
    const result = await importProjectFromSb3(bytes as unknown as File);

    expect(result.warnings).toEqual(["Unsupported Scratch opcodes skipped: procedures_definition"]);
    expect(result.document.sprites[0].program).toEqual([]);
  });

  it("sanitizes the export file name", () => {
    expect(getSb3FileName("My Project!")).toBe("My_Project_.sb3");
    expect(getSb3FileName("   ")).toBe("project.sb3");
  });
});
