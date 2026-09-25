import {
  RESOURCES,
  storageLimit,
  type BeeState,
  type Building,
  type BuildingKind,
  type Job,
  type Resource,
} from "@/lib/bee";
export interface Placement {
  kind: BuildingKind | "plant";
  x: number;
  y: number;
  moving?: number;
}
export interface ValleyProps {
  state: BeeState;
  now: number;
  offset: number;
  selected: number | null;
  selectedTile: number | null;
  placement: Placement | null;
  onSelect: (id: number) => void;
  onTile: (tile: number) => void;
  onPlacement: (x: number, y: number) => void;
  layer: "normal" | "logistics" | "power";
  connecting: boolean;
  via: number[];
  draft: { x: number; y: number }[];
}
export const point = (x: number, y: number) => ({
  x: (x - y) * 38,
  y: (x + y) * 22,
});
export const cell = (x: number, y: number) => ({
  x: Math.round(x / 76 + y / 44),
  y: Math.round(y / 44 - x / 76),
});
export const RESOURCE_COLORS: Record<Resource, string> = {
  nectar: "#e8b674",
  honey: "#e9c15a",
  wood: "#a77d58",
  wax: "#f0da98",
  planks: "#cdab70",
  gears: "#aa9071",
  ore: "#8d9f95",
  copper: "#be8965",
  water: "#86b8ba",
};
export type BuildingLoadState = "normal" | "empty" | "full";
export function buildingLoadState(
  building: Building,
  reason = "",
): BuildingLoadState {
  if (
    reason === "Выход заполнен" ||
    RESOURCES.some(
      (resource) =>
        building.stock[resource] > 0 &&
        building.stock[resource] >= storageLimit(building, resource) - 1e-8,
    )
  )
    return "full";
  if (
    reason === "Нет сырья" ||
    RESOURCES.every((resource) => building.stock[resource] <= 1e-8)
  )
    return "empty";
  return "normal";
}
export function sample(job: Job, at: number) {
  const p = job.path;
  if (p.length < 2) return p[0] ?? { x: 0, y: 0 };
  if (p.length === 3 && !["belt", "pipe"].includes(job.role)) {
    const arrival =
      job.startedAt + Math.hypot(p[1]!.x - p[0]!.x, p[1]!.y - p[0]!.y) * 1800;
    if (at < arrival)
      return lerp(
        p[0]!,
        p[1]!,
        (at - job.startedAt) / (arrival - job.startedAt || 1),
      );
    if (at < job.pickupAt) return p[1]!;
    return lerp(
      p[1]!,
      p[2]!,
      (at - job.pickupAt) / (job.readyAt - job.pickupAt || 1),
    );
  }
  const lengths = p
    .slice(1)
    .map((v, i) => Math.hypot(v.x - p[i]!.x, v.y - p[i]!.y));
  let left =
    lengths.reduce((a, b) => a + b, 0) *
    Math.max(
      0,
      Math.min(1, (at - job.startedAt) / (job.readyAt - job.startedAt || 1)),
    );
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]!)
      return lerp(p[i]!, p[i + 1]!, left / (lengths[i] || 1));
    left -= lengths[i]!;
  }
  return p.at(-1)!;
}
export function lerp(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
) {
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
