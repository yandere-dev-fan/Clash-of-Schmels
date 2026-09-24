import { z } from "zod";
const receipt = { requestKey: z.string().uuid() };
const coordinate = {
  x: z.number().int().min(0).max(41),
  y: z.number().int().min(0).max(41),
};
const buildingId = { id: z.number().int().positive().max(100000) };
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("breed"), ...receipt }).strict(),
  z.object({ type: z.literal("order"), ...receipt }).strict(),
  z
    .object({
      type: z.literal("build"),
      kind: z.enum([
        "hive",
        "meadow",
        "depot",
        "nursery",
        "sawmill",
        "press",
        "market",
        "pump",
        "sanctuary",
        "logging",
        "workshop",
        "waterwheel",
        "well",
        "boiler",
        "mine",
        "smelter",
        "dynamo",
        "powerplant",
        "centrifuge",
        "relay",
      ]),
      ...coordinate,
      ...receipt,
    })
    .strict(),
  z
    .object({
      type: z.literal("move"),
      ...buildingId,
      ...coordinate,
      ...receipt,
    })
    .strict(),
  z.object({ type: z.literal("upgrade"), ...buildingId, ...receipt }).strict(),
  z.object({ type: z.literal("toggle"), ...buildingId, ...receipt }).strict(),
  z.object({ type: z.literal("priority"), ...buildingId, ...receipt }).strict(),
  z.object({ type: z.literal("demolish"), ...buildingId, ...receipt }).strict(),
  z.object({ type: z.literal("chop"), ...coordinate, ...receipt }).strict(),
  z.object({ type: z.literal("plant"), ...coordinate, ...receipt }).strict(),
  z.object({ type: z.literal("expand"), ...coordinate, ...receipt }).strict(),
  z
    .object({
      type: z.literal("train"),
      role: z.enum(["forager", "carrier", "engineer", "forester"]),
      ...buildingId,
      ...receipt,
    })
    .strict(),
  z
    .object({
      type: z.literal("retrain"),
      role: z.enum(["forager", "carrier", "engineer", "forester"]),
      bee: z.number().int().positive(),
      ...receipt,
    })
    .strict(),
  z
    .object({
      type: z.literal("recipe"),
      recipe: z.enum(["planks", "gears"]),
      ...buildingId,
      ...receipt,
    })
    .strict(),
  z
    .object({ type: z.literal("disconnect"), ...buildingId, ...receipt })
    .strict(),
  z.object({ type: z.literal("unlink"), ...buildingId, ...receipt }).strict(),
  z
    .object({
      type: z.literal("link"),
      from: z.number().int().positive(),
      to: z.number().int().positive(),
      kind: z.enum(["flight", "belt", "shaft", "wire", "pipe"]),
      filter: z.enum([
        "auto",
        "nectar",
        "honey",
        "wood",
        "wax",
        "planks",
        "gears",
        "ore",
        "copper",
        "water",
      ]),
      via: z.array(z.number().int().min(0).max(1763)).max(12).optional(),
      ...receipt,
    })
    .strict(),
  z
    .object({
      type: z.literal("research"),

      ...receipt,
    })
    .strict(),
]);
