import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type DbCtx = QueryCtx | MutationCtx;

type SavedSprite = {
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
  program: unknown[];
  cloneProgram?: unknown[];
  broadcastPrograms?: unknown;
  backdropPrograms?: unknown;
  variables?: unknown;
  lists?: unknown;
  costumes?: SpriteCostume[];
  currentCostumeId?: string;
  sounds?: ProjectSound[];
  volume?: number;
};

type ProjectSound = {
  id: string;
  name: string;
  dataUrl: string;
  dataFormat: "wav" | "mp3";
  storageId?: string;
  rate?: number;
  sampleCount?: number;
  duration?: number;
  assetId?: string;
};

type SpriteCostume = {
  id: string;
  name: string;
  image: string;
  imageFormat: "svg" | "png" | "jpg";
  rotationCenterX?: number;
  rotationCenterY?: number;
};

function createSpriteCostumeSvg(tone: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="none"/><g transform="translate(240 180)"><path d="M0 -112C62 -112 112 -62 112 0C112 62 62 112 0 112C-62 112 -112 62 -112 0C-112 -62 -62 -112 0 -112Z" fill="${tone}"/><path d="M-38 -18C-20 -42 20 -42 38 -18" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" opacity="0.72"/><circle cx="-34" cy="22" r="12" fill="#ffffff" opacity="0.72"/><circle cx="34" cy="22" r="12" fill="#ffffff" opacity="0.72"/></g></svg>`;
}

function defaultCostume(tone: string): SpriteCostume {
  return {
    id: "costume-1",
    name: "Costume 1",
    image: createSpriteCostumeSvg(tone),
    imageFormat: "svg",
    rotationCenterX: 240,
    rotationCenterY: 180,
  };
}

function initialSprite(sprite: Omit<SavedSprite, "costumes" | "currentCostumeId">): SavedSprite {
  const costume = defaultCostume(sprite.tone);
  return { ...sprite, costumes: [costume], currentCostumeId: costume.id, sounds: [], volume: 100 };
}

const initialBackdrop = {
  id: "backdrop-1",
  name: "Backdrop 1",
  fill: "#f5f5f7",
  image: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#f5f5f7"/></svg>',
  imageFormat: "svg" as const,
  rotationCenterX: 240,
  rotationCenterY: 180,
  artwork: { elements: [], pixelCells: [] },
};

const stage = {
  minX: -240,
  maxX: 240,
  minY: -180,
  maxY: 180,
  background: initialBackdrop.fill,
  backdrops: [initialBackdrop],
  currentBackdropId: initialBackdrop.id,
  workspaceState: null,
  program: [],
  broadcastPrograms: {},
  backdropPrograms: {},
  sounds: [],
  volume: 100,
};

const initialSprites: SavedSprite[] = [
  initialSprite({ id: "sprite-1", name: "Kite", x: 0, y: 0, size: 100, direction: 90, layer: 0, tone: "#56CBF9", visible: true, workspaceState: null, program: [] }),
  initialSprite({ id: "sprite-2", name: "Rook", x: -108, y: 56, size: 76, direction: 28, layer: 1, tone: "#7FBEEB", visible: true, workspaceState: null, program: [] }),
  initialSprite({ id: "sprite-3", name: "Moss", x: 122, y: 88, size: 64, direction: -18, layer: 2, tone: "#AFBED1", visible: true, workspaceState: null, program: [] }),
];

const maxCloudValue = 999_999_999;

function sanitizeCloudValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-maxCloudValue, Math.min(maxCloudValue, Math.round(number * 1000) / 1000));
}

function sanitizeCloudVariables(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeCloudValue(entry)]));
}

const costume = v.object({
  id: v.string(),
  name: v.string(),
  image: v.string(),
  imageFormat: v.union(v.literal("svg"), v.literal("png"), v.literal("jpg")),
  rotationCenterX: v.optional(v.number()),
  rotationCenterY: v.optional(v.number()),
});

const sound = v.object({
  id: v.string(),
  name: v.string(),
  dataUrl: v.string(),
  dataFormat: v.union(v.literal("wav"), v.literal("mp3")),
  storageId: v.optional(v.string()),
  rate: v.optional(v.number()),
  sampleCount: v.optional(v.number()),
  duration: v.optional(v.number()),
  assetId: v.optional(v.string()),
});

const sprite = v.object({
  id: v.string(),
  name: v.string(),
  x: v.number(),
  y: v.number(),
  size: v.number(),
  direction: v.number(),
  layer: v.optional(v.number()),
  tone: v.string(),
  visible: v.boolean(),
  workspaceState: v.union(v.string(), v.null()),
  program: v.array(v.any()),
  cloneProgram: v.optional(v.array(v.any())),
  broadcastPrograms: v.optional(v.any()),
  backdropPrograms: v.optional(v.any()),
  variables: v.optional(v.any()),
  lists: v.optional(v.any()),
  costumes: v.optional(v.array(costume)),
  currentCostumeId: v.optional(v.string()),
  sounds: v.optional(v.array(sound)),
  volume: v.optional(v.number()),
});

const backdrop = v.object({
  id: v.string(),
  name: v.string(),
  fill: v.string(),
  image: v.optional(v.string()),
  imageFormat: v.optional(v.union(v.literal("svg"), v.literal("png"), v.literal("jpg"))),
  rotationCenterX: v.optional(v.number()),
  rotationCenterY: v.optional(v.number()),
  artwork: v.optional(v.any()),
});

const documentArg = v.object({
  version: v.number(),
  cloudVariables: v.optional(v.any()),
  variables: v.optional(v.any()),
  lists: v.optional(v.any()),
  variableWatchers: v.optional(v.any()),
  listWatchers: v.optional(v.any()),
  stage: v.object({
    minX: v.number(),
    maxX: v.number(),
    minY: v.number(),
    maxY: v.number(),
    background: v.union(v.string(), v.null()),
    backdrops: v.optional(v.array(backdrop)),
    currentBackdropId: v.optional(v.string()),
    workspaceState: v.optional(v.union(v.string(), v.null())),
    program: v.optional(v.array(v.any())),
    broadcastPrograms: v.optional(v.any()),
    backdropPrograms: v.optional(v.any()),
    sounds: v.optional(v.array(sound)),
    volume: v.optional(v.number()),
  }),
  sprites: v.array(sprite),
});

async function requireIdentity(ctx: DbCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Not authenticated.");
  }

  return identity;
}

async function requireProject(ctx: DbCtx, projectId: Id<"projects">) {
  const identity = await requireIdentity(ctx);
  const project = await ctx.db.get(projectId);

  if (!project || project.isDeleted || project.ownerTokenIdentifier !== identity.tokenIdentifier) {
    throw new Error("Project not found.");
  }

  return { identity, project };
}

async function getDocument(ctx: DbCtx, projectId: Id<"projects">) {
  return ctx.db
    .query("projectDocuments")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .unique();
}

async function getProjectSprites(ctx: DbCtx, projectId: Id<"projects">) {
  const rows = await ctx.db
    .query("projectSprites")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .take(200);

  return rows.sort((a, b) => a.order - b.order).map((row) => row.sprite);
}

async function replaceProjectSprites(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  sprites: SavedSprite[],
  updatedAt: number,
) {
  const existing = await ctx.db
    .query("projectSprites")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .take(500);
  const incomingKeys = new Set(sprites.map((item) => item.id));

  for (const row of existing) {
    if (!incomingKeys.has(row.spriteKey)) {
      await ctx.db.delete(row._id);
    }
  }

  for (const [order, item] of sprites.entries()) {
    const existingSprite = await ctx.db
      .query("projectSprites")
      .withIndex("by_projectId_and_spriteKey", (q) => q.eq("projectId", projectId).eq("spriteKey", item.id))
      .unique();

    if (existingSprite) {
      await ctx.db.patch(existingSprite._id, { sprite: item, order, updatedAt });
    } else {
      await ctx.db.insert("projectSprites", {
        projectId,
        spriteKey: item.id,
        sprite: item,
        order,
        updatedAt,
      });
    }
  }
}

async function hydrateSounds(ctx: QueryCtx, sounds: ProjectSound[] | undefined) {
  if (!Array.isArray(sounds)) return [];
  return await Promise.all(sounds.map(async (sound) => ({
    ...sound,
    dataUrl: sound.storageId ? await ctx.storage.getUrl(sound.storageId as Id<"_storage">) ?? sound.dataUrl : sound.dataUrl,
  })));
}

async function hydrateDocumentSounds(ctx: QueryCtx, document: NonNullable<Awaited<ReturnType<typeof getDocument>>>, sprites: SavedSprite[]) {
  return {
    ...document,
    stage: {
      ...document.stage,
      sounds: await hydrateSounds(ctx, document.stage.sounds),
    },
    sprites: await Promise.all(sprites.map(async (sprite) => ({
      ...sprite,
      sounds: await hydrateSounds(ctx, sprite.sounds),
    }))),
  };
}

export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("projects")
      .withIndex("by_ownerTokenIdentifier_and_isDeleted_and_updatedAt", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier).eq("isDeleted", false),
      )
      .order("desc")
      .take(100);
  },
});

export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project } = await requireProject(ctx, args.projectId);
    const document = await getDocument(ctx, args.projectId);

    if (!document) {
      throw new Error("Project document not found.");
    }

    const sprites = await getProjectSprites(ctx, args.projectId);
    return {
      project,
      document: await hydrateDocumentSounds(ctx, document, sprites),
    };
  },
});

export const generateSoundUploadUrl = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createProject = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const now = Date.now();
    const name = args.name?.trim() || "Untitled Project";

    const projectId = await ctx.db.insert("projects", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      name,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      thumbnailTone: "#56CBF9",
      spriteCount: initialSprites.length,
      isDeleted: false,
    });

    await ctx.db.insert("projectDocuments", {
      projectId,
      version: 1,
      cloudVariables: {},
      variables: {},
      lists: {},
      variableWatchers: [],
      listWatchers: [],
      stage,
      updatedAt: now,
    });

    await replaceProjectSprites(ctx, projectId, initialSprites, now);

    return projectId;
  },
});

export const saveProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    document: documentArg,
  },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    const now = Date.now();
    const document = await getDocument(ctx, args.projectId);

    if (!document) {
      await ctx.db.insert("projectDocuments", {
        projectId: args.projectId,
        version: args.document.version,
        cloudVariables: sanitizeCloudVariables(args.document.cloudVariables),
        variables: args.document.variables ?? {},
        lists: args.document.lists ?? {},
        variableWatchers: args.document.variableWatchers ?? [],
        listWatchers: args.document.listWatchers ?? [],
        stage: args.document.stage,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(document._id, {
        version: args.document.version,
        cloudVariables: sanitizeCloudVariables(args.document.cloudVariables),
        variables: args.document.variables ?? {},
        lists: args.document.lists ?? {},
        variableWatchers: args.document.variableWatchers ?? [],
        listWatchers: args.document.listWatchers ?? [],
        stage: args.document.stage,
        updatedAt: now,
      });
    }

    await replaceProjectSprites(ctx, args.projectId, args.document.sprites, now);

    await ctx.db.patch(args.projectId, {
      name: args.name.trim() || "Untitled Project",
      updatedAt: now,
      lastOpenedAt: now,
      spriteCount: args.document.sprites.length,
      thumbnailTone: args.document.sprites[0]?.tone ?? "#56CBF9",
    });
  },
});

export const touchProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project } = await requireProject(ctx, args.projectId);
    const now = Date.now();

    if (now - project.lastOpenedAt < 60_000) {
      return;
    }

    await ctx.db.patch(args.projectId, { lastOpenedAt: now });
  },
});

export const softDeleteProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    await ctx.db.patch(args.projectId, { isDeleted: true, updatedAt: Date.now() });
  },
});

export const renameProject = mutation({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    await ctx.db.patch(args.projectId, {
      name: args.name.trim() || "Untitled Project",
      updatedAt: Date.now(),
    });
  },
});

export const duplicateProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { identity, project } = await requireProject(ctx, args.projectId);
    const document = await getDocument(ctx, args.projectId);

    if (!document) {
      throw new Error("Project document not found.");
    }

    const sprites = await getProjectSprites(ctx, args.projectId);

    const now = Date.now();
    const newProjectId = await ctx.db.insert("projects", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      name: `${project.name} copy`,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      thumbnailTone: project.thumbnailTone,
      spriteCount: project.spriteCount,
      isDeleted: false,
    });

    await ctx.db.insert("projectDocuments", {
      projectId: newProjectId,
      version: document.version,
      cloudVariables: document.cloudVariables ?? {},
      variables: document.variables ?? {},
      lists: document.lists ?? {},
      variableWatchers: document.variableWatchers ?? [],
      listWatchers: document.listWatchers ?? [],
      stage: document.stage,
      updatedAt: now,
    });

    await replaceProjectSprites(ctx, newProjectId, sprites, now);

    return newProjectId;
  },
});
