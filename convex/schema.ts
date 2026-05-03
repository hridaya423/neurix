import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const sprite = v.object({
  id: v.string(),
  name: v.string(),
  x: v.number(),
  y: v.number(),
  size: v.number(),
  direction: v.number(),
  tone: v.string(),
  visible: v.boolean(),
  workspaceState: v.union(v.string(), v.null()),
  program: v.array(v.any()),
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
    stage: v.object({
      minX: v.number(),
      maxX: v.number(),
      minY: v.number(),
      maxY: v.number(),
      background: v.union(v.string(), v.null()),
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
