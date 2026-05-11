import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

export default defineSchema({
  projects: defineTable({
    ownerTokenIdentifier: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastOpenedAt: v.number(),
    thumbnailTone: v.string(),
    spriteCount: v.number(),
    isDeleted: v.boolean(),
  })
    .index("by_ownerTokenIdentifier_and_isDeleted_and_updatedAt", ["ownerTokenIdentifier", "isDeleted", "updatedAt"]),

  projectDocuments: defineTable({
    projectId: v.id("projects"),
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
    updatedAt: v.number(),
  }).index("by_projectId", ["projectId"]),

  projectSprites: defineTable({
    projectId: v.id("projects"),
    spriteKey: v.string(),
    sprite,
    order: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_and_spriteKey", ["projectId", "spriteKey"]),
});
