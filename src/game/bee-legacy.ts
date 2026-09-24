/** Deterministic Bee Tycoon simulation. No DB, browser, random or wall-clock access. */
export const MAP_SIZE = 18;
export const OFFLINE_SECONDS = 7200;
export const ORDER_HONEY = 120,
  ORDER_CENTS = 25,
  ORDER_SECONDS = 300;
export type Resource = "honey" | "wood" | "wax";
export type Cost = Partial<Record<Resource, number>>;
export type BuildingKind =
  | "wild"
  | "hive"
  | "meadow"
  | "depot"
  | "nursery"
  | "sawmill"
  | "press"
  | "market"
  | "pump"
  | "sanctuary";
export type Doctrine = "none" | "garden" | "industry" | "balance";
export interface BuildingDef {
  name: string;
  tier: number;
  size: number;
  cost: Cost;
  seconds: number;
  workers: number;
  category: "colony" | "production" | "nature";
  range: number;
  description: string;
}
export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  wild: {
    name: "Дикий улей",
    tier: 1,
    size: 1,
    cost: {},
    seconds: 0,
    workers: 3,
    category: "colony",
    range: 3,
    description: "Матка, расплод и первые пчёлы. Сердце колонии.",
  },
  hive: {
    name: "Пчелиный дом",
    tier: 1,
    size: 2,
    cost: { honey: 18, wood: 20 },
    seconds: 25,
    workers: 3,
    category: "colony",
    range: 3,
    description:
      "+6 мест. 18 мёда/мин. Цветы и живой лес рядом усиливают сбор.",
  },
  meadow: {
    name: "Цветник",
    tier: 1,
    size: 2,
    cost: { honey: 14, wood: 8 },
    seconds: 20,
    workers: 0,
    category: "nature",
    range: 3,
    description: "+20% к соседним ульям. До двух цветников на улей.",
  },
  depot: {
    name: "Медовый амбар",
    tier: 1,
    size: 2,
    cost: { honey: 35, wood: 30 },
    seconds: 35,
    workers: 0,
    category: "colony",
    range: 0,
    description: "+400 мёда, +200 дерева и +100 воска к складу.",
  },
  nursery: {
    name: "Питомник",
    tier: 2,
    size: 2,
    cost: { honey: 65, wood: 35 },
    seconds: 45,
    workers: 0,
    category: "colony",
    range: 4,
    description: "+6 мест. Расплод вдвое быстрее рядом с диким ульем.",
  },
  sawmill: {
    name: "Лесопилка",
    tier: 2,
    size: 2,
    cost: { honey: 80, wood: 40 },
    seconds: 60,
    workers: 2,
    category: "production",
    range: 3,
    description: "12 дерева/мин. Постепенно вырубает деревья в радиусе.",
  },
  press: {
    name: "Восковая мастерская",
    tier: 2,
    size: 2,
    cost: { honey: 100, wood: 60 },
    seconds: 60,
    workers: 2,
    category: "production",
    range: 3,
    description: "18 мёда → 6 воска/мин. +15% соседним ульям.",
  },
  market: {
    name: "Торговая лавка",
    tier: 2,
    size: 2,
    cost: { honey: 65, wood: 30 },
    seconds: 45,
    workers: 0,
    category: "colony",
    range: 0,
    description: "Заказы в кошелёк. Нужна дорога к дикому улью.",
  },
  pump: {
    name: "Медовая помпа",
    tier: 3,
    size: 2,
    cost: { honey: 160, wood: 70, wax: 12 },
    seconds: 90,
    workers: 2,
    category: "production",
    range: 3,
    description: "32 мёда/мин за 3 дерева. Истощает лес; −35% соседним ульям.",
  },
  sanctuary: {
    name: "Лесной заповедник",
    tier: 3,
    size: 2,
    cost: { honey: 120, wood: 60, wax: 15 },
    seconds: 75,
    workers: 2,
    category: "nature",
    range: 3,
    description:
      "6 мёда/мин восстанавливают 15 ед. леса/мин. +15% соседним ульям.",
  },
};
export const BUILDABLE = Object.keys(BUILDINGS).filter(
  (k) => k !== "wild",
) as Exclude<BuildingKind, "wild">[];
export interface Building {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
  level: number;
  readyAt: number;
  startedAt: number;
  enabled: boolean;
  priority: number;
  pendingLevel?: number;
}
export interface BeeState {
  version: 2;
  honey: number;
  wood: number;
  wax: number;
  totalHoney: number;
  bees: number;
  buildings: Building[];
  forest: number[];
  roads: number[];
  nextId: number;
  brood: { readyAt: number; startedAt: number; count: number } | null;
  clearing: {
    tile: number;
    readyAt: number;
    startedAt: number;
    plant: boolean;
  } | null;
  doctrine: Doctrine;
  research: {
    doctrine: Exclude<Doctrine, "none">;
    readyAt: number;
    startedAt: number;
  } | null;
  lastTickAt: number;
  day: string;
  earnedToday: number;
  earnedTotal: number;
  ordersToday: number;
  activeSeconds: number;
  lastSeenAt: number;
  lastOrderAt: number;
}
export type BeeAction =
  | { type: "heartbeat" }
  | { type: "breed" }
  | { type: "order" }
  | { type: "build"; kind: Exclude<BuildingKind, "wild">; x: number; y: number }
  | { type: "upgrade" | "toggle" | "priority" | "demolish"; id: number }
  | { type: "move"; id: number; x: number; y: number }
  | { type: "chop" | "plant" | "road"; x: number; y: number }
  | { type: "research"; doctrine: Exclude<Doctrine, "none"> };
export const index = (x: number, y: number) => y * MAP_SIZE + x;
export const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);
export function noise(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + 47) * 43758.5453;
  return n - Math.floor(n);
}
export function terrain(x: number, y: number): "grass" | "water" | "rock" {
  if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return "rock";
  if ((x < 3 && y > 5 && y < 14) || (x === 3 && y > 8 && y < 12))
    return "water";
  if (((x > 14 && y < 4) || (y > 15 && x > 13)) && noise(x, y) > 0.42)
    return "rock";
  return "grass";
}
export function nativeForest(x: number, y: number) {
  return (
    terrain(x, y) === "grass" &&
    Math.hypot(x - 9, y - 9) > 3.9 &&
    noise(x, y) > 0.37
  );
}
export function initialState(now: number): BeeState {
  return {
    version: 2,
    honey: 0,
    wood: 0,
    wax: 0,
    totalHoney: 0,
    bees: 0,
    buildings: [
      {
        id: 1,
        kind: "wild",
        x: 9,
        y: 9,
        level: 1,
        readyAt: now,
        startedAt: now,
        enabled: true,
        priority: 100000,
      },
    ],
    forest: Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, i) =>
      nativeForest(i % MAP_SIZE, Math.floor(i / MAP_SIZE)) ? 100 : 0,
    ),
    roads: [],
    nextId: 2,
    brood: null,
    clearing: null,
    doctrine: "none",
    research: null,
    lastTickAt: now,
    day: dayKey(now),
    earnedToday: 0,
    earnedTotal: 0,
    ordersToday: 0,
    activeSeconds: 0,
    lastSeenAt: now,
    lastOrderAt: 0,
  };
}
export const headquarters = (s: BeeState) =>
  s.buildings.find((b) => b.kind === "wild")!;
export const tier = (s: BeeState) => headquarters(s).level;
export const complete = (b: Building, now: number) => b.readyAt <= now;
export function footprint(b: Pick<Building, "x" | "y" | "kind">) {
  const out: number[] = [];
  for (let y = b.y; y < b.y + BUILDINGS[b.kind].size; y++)
    for (let x = b.x; x < b.x + BUILDINGS[b.kind].size; x++)
      out.push(index(x, y));
  return out;
}
export const occupied = (s: BeeState, tile: number, except?: number) =>
  s.buildings.some((b) => b.id !== except && footprint(b).includes(tile));
export function distance(
  a: Pick<Building, "x" | "y" | "kind">,
  b: Pick<Building, "x" | "y" | "kind">,
) {
  const ac = (BUILDINGS[a.kind].size - 1) / 2,
    bc = (BUILDINGS[b.kind].size - 1) / 2;
  return Math.hypot(a.x + ac - b.x - bc, a.y + ac - b.y - bc);
}
export function nearbyTiles(b: Building, range: number) {
  const out: number[] = [];
  const c = (BUILDINGS[b.kind].size - 1) / 2;
  for (
    let y = Math.max(0, b.y - range);
    y < Math.min(MAP_SIZE, b.y + BUILDINGS[b.kind].size + range);
    y++
  )
    for (
      let x = Math.max(0, b.x - range);
      x < Math.min(MAP_SIZE, b.x + BUILDINGS[b.kind].size + range);
      x++
    )
      if (Math.hypot(x - b.x - c, y - b.y - c) <= range) out.push(index(x, y));
  return out;
}
export function capacities(s: BeeState, now = s.lastTickAt) {
  let honey = 200,
    wood = 100,
    wax = 60,
    bees = 3;
  for (const b of s.buildings.filter(
    (b) => complete(b, now) || b.pendingLevel,
  )) {
    if (b.kind === "depot") {
      honey += 400 * b.level;
      wood += 200 * b.level;
      wax += 100 * b.level;
    }
    if (b.kind === "hive" || b.kind === "nursery") bees += 6 * b.level;
  }
  return { honey, wood, wax, bees };
}
export const capacity = (s: BeeState) => capacities(s).honey;
export function builders(s: BeeState, now = s.lastTickAt) {
  const max = s.doctrine === "balance" ? 2 : 1;
  const busy =
    s.buildings.filter((b) => !complete(b, now)).length + (s.clearing ? 1 : 0);
  return { max, busy };
}
export function placementError(
  s: BeeState,
  kind: BuildingKind,
  x: number,
  y: number,
  except?: number,
): string | null {
  const size = BUILDINGS[kind].size;
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x + size > MAP_SIZE ||
    y + size > MAP_SIZE
  )
    return "За границей долины";
  for (let yy = y; yy < y + size; yy++)
    for (let xx = x; xx < x + size; xx++) {
      const t = index(xx, yy);
      if (terrain(xx, yy) !== "grass") return "Нельзя строить на воде и камнях";
      if (s.forest[t]! > 0) return "Сначала расчистите деревья";
      if (s.clearing?.tile === t) return "Здесь ещё идёт работа";
      if (occupied(s, t, except)) return "Место занято";
    }
  return null;
}
function neighbors(tile: number) {
  const x = tile % MAP_SIZE,
    y = Math.floor(tile / MAP_SIZE);
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]
    .filter(([a, b]) => a! >= 0 && b! >= 0 && a! < MAP_SIZE && b! < MAP_SIZE)
    .map(([a, b]) => index(a!, b!));
}
export function connections(s: BeeState) {
  const home = footprint(headquarters(s)),
    road = new Set(s.roads),
    seen = new Set<number>(home),
    q = [...home];
  for (let i = 0; i < q.length; i++)
    for (const n of neighbors(q[i]!))
      if (road.has(n) && !seen.has(n)) {
        seen.add(n);
        q.push(n);
      }
  return new Set(
    s.buildings
      .filter((b) =>
        footprint(b).some(
          (t) => seen.has(t) || neighbors(t).some((n) => seen.has(n)),
        ),
      )
      .map((b) => b.id),
  );
}
export interface Production {
  id: number;
  workers: number;
  needed: number;
  honey: number;
  wood: number;
  wax: number;
  connected: boolean;
  bonus: number;
  reason: string;
  trees: number[];
  restore: number[];
}
export function production(s: BeeState, now = s.lastTickAt): Production[] {
  const connected = connections(s),
    live = s.buildings.filter((b) => b.enabled && complete(b, now));
  let free = s.bees;
  const occupiedTiles = new Set(s.buildings.flatMap(footprint));
  const ordered = [...s.buildings].sort(
    (a, b) => b.priority - a.priority || a.id - b.id,
  );
  const staffById = new Map<number, number>();
  for (const b of ordered) {
    const n =
      b.enabled && complete(b, now)
        ? Math.min(free, BUILDINGS[b.kind].workers)
        : 0;
    staffById.set(b.id, n);
    free -= n;
  }
  const supporting = live.filter(
    (b) => !BUILDINGS[b.kind].workers || (staffById.get(b.id) ?? 0) > 0,
  );
  return ordered.map((b) => {
    const def = BUILDINGS[b.kind],
      working = b.enabled && complete(b, now);
    const workers = staffById.get(b.id) ?? 0;
    const trees = nearbyTiles(b, def.range).filter(
      (t) => s.forest[t]! > 0 && !occupiedTiles.has(t),
    );
    const restore = nearbyTiles(b, def.range).filter(
      (t) =>
        nativeForest(t % MAP_SIZE, Math.floor(t / MAP_SIZE)) &&
        s.forest[t]! < 100 &&
        !occupiedTiles.has(t) &&
        s.clearing?.tile !== t &&
        !s.roads.includes(t),
    );
    const p: Production = {
      id: b.id,
      workers,
      needed: def.workers,
      honey: 0,
      wood: 0,
      wax: 0,
      connected: connected.has(b.id),
      bonus: 1,
      reason: "",
      trees,
      restore,
    };
    if (!working) {
      p.reason = b.enabled ? "Строится" : "Пауза";
      return p;
    }
    if (def.workers && !workers) {
      p.reason = "Нужны пчёлы";
      return p;
    }
    const staff = def.workers ? workers / def.workers : 1,
      level = 1.6 ** (b.level - 1),
      haul = p.connected ? 1.15 : 1;
    const gardens = live
      .filter((a) => a.kind === "meadow" && distance(a, b) <= 3)
      .reduce((v, a) => v + a.level, 0);
    const press =
      s.honey > 0 &&
      s.wax < capacities(s, now).wax &&
      supporting.some((a) => a.kind === "press" && distance(a, b) <= 3);
    const refuge =
      s.honey > 0 &&
      supporting.some((a) => a.kind === "sanctuary" && distance(a, b) <= 3);
    const pollution =
      s.wood > 0
        ? supporting.filter(
            (a) =>
              a.kind === "pump" &&
              distance(a, b) <= 4 &&
              nearbyTiles(a, 3).some((t) => s.forest[t]! > 0),
          ).length
        : 0;
    if (b.kind === "wild" || b.kind === "hive") {
      const forestBonus = Math.min(
        0.3,
        trees.reduce((v, t) => v + s.forest[t]! / 100, 0) * 0.025,
      );
      p.bonus =
        (1 +
          Math.min(2, gardens) * 0.2 +
          forestBonus +
          (press ? 0.15 : 0) +
          (refuge ? 0.15 : 0)) *
        Math.max(0.3, 1 - pollution * 0.35);
      if (s.doctrine === "garden") p.bonus *= 1.3;
      if (s.doctrine === "balance") p.bonus *= 1.1;
      // The free wild hive remains a recovery source even after a forest collapse.
      p.honey = (b.kind === "wild" ? 12 : 18) * staff * level * p.bonus * haul;
    }
    if (b.kind === "sawmill") {
      if (!trees.length) p.reason = "Лес исчерпан";
      else p.wood = 12 * staff * level * haul;
    }
    if (b.kind === "press") {
      if (s.honey <= 0) p.reason = "Нужен мёд";
      else {
        p.honey = -18 * staff * level;
        p.wax = 6 * staff * level * haul;
      }
    }
    if (b.kind === "pump") {
      if (!trees.length) p.reason = "Лес исчерпан";
      else if (s.wood <= 0) p.reason = "Нужно дерево";
      else {
        p.honey =
          32 *
          staff *
          level *
          haul *
          (s.doctrine === "industry"
            ? 1.35
            : s.doctrine === "garden"
              ? 0.85
              : s.doctrine === "balance"
                ? 1.1
                : 1);
        p.wood = -3 * staff * level;
      }
    }
    if (b.kind === "sanctuary") {
      if (!restore.length || s.honey <= 0)
        p.reason = restore.length ? "Нужен мёд" : "Лес здоров";
      else p.honey = -6 * staff * level;
    }
    return p;
  });
}
function debit(s: BeeState, cost: Cost) {
  for (const [key, n] of Object.entries(cost))
    if (s[key as Resource] + 1e-8 < n)
      throw new BeeRuleError("Не хватает ресурсов");
  for (const [key, n] of Object.entries(cost))
    s[key as Resource] = Math.max(0, s[key as Resource] - n);
}
export function costForUpgrade(b: Building): Cost {
  if (b.kind === "wild")
    return (
      [
        { honey: 60, wood: 40 },
        { honey: 200, wood: 100, wax: 20 },
        { honey: 700, wood: 250, wax: 100 },
      ][b.level - 1] ?? {}
    );
  const base = BUILDINGS[b.kind].cost;
  return {
    honey: Math.ceil((base.honey ?? 10) * 1.7 ** b.level),
    wood: Math.ceil((base.wood ?? 5) * 1.5 ** b.level),
    wax: b.level * 8,
  };
}
export function upgradeRequirement(s: BeeState, b: Building): string | null {
  if (b.kind === "wild") {
    if (b.level >= 4) return "Максимальный уровень";
    const needed = [120, 500, 1600][b.level - 1]!;
    if (s.totalHoney < needed) return `Соберите всего ${needed} мёда`;
    const bees = [6, 12, 18][b.level - 1]!;
    if (s.bees < bees) return `Нужно ${bees} пчёл`;
  } else if (b.level >= 4 || b.level >= tier(s))
    return b.level >= 4
      ? "Максимальный уровень"
      : `Нужна колония ${b.level + 1}`;
  return null;
}
export class BeeRuleError extends Error {}
export function migrateState(input: unknown, now: number): BeeState {
  const old = input as BeeState & { version: number };
  if (old.version === 2) return old;
  const previous = input as Partial<BeeState>;
  const s = initialState(now);
  for (const key of [
    "honey",
    "totalHoney",
    "earnedToday",
    "earnedTotal",
    "ordersToday",
    "activeSeconds",
    "lastOrderAt",
  ] as const)
    if (typeof previous[key] === "number") s[key] = previous[key]!;
  s.honey = Math.max(0, s.honey);
  s.bees = Math.max(3, Math.min(12, Number(previous.bees) || 3));
  if (s.bees > 3)
    s.buildings.push({
      id: s.nextId++,
      kind: "hive",
      x: 10,
      y: 8,
      level: Math.ceil((s.bees - 3) / 6),
      enabled: true,
      readyAt: now,
      startedAt: now,
      priority: 0,
    });
  // Preserve all old honey, even if it requires an introductory depot.
  if (s.honey > 200)
    s.buildings.push({
      id: s.nextId++,
      kind: "depot",
      x: 7,
      y: 8,
      level: Math.min(3, Math.ceil((s.honey - 200) / 400)),
      enabled: true,
      readyAt: now,
      startedAt: now,
      priority: 0,
    });
  s.day = typeof previous.day === "string" ? previous.day : dayKey(now);
  return s;
}
export function normalize(s: BeeState, now: number): BeeState {
  return s.day === dayKey(now)
    ? s
    : {
        ...s,
        day: dayKey(now),
        earnedToday: 0,
        ordersToday: 0,
        activeSeconds: 0,
        lastSeenAt: now,
      };
}
function drain(s: BeeState, tiles: number[], amount: number) {
  let left = amount;
  for (const tile of tiles) {
    const use = Math.min(s.forest[tile]!, left);
    s.forest[tile] = Math.max(0, s.forest[tile]! - use);
    left -= use;
    if (left <= 0) break;
  }
}
function finishEvents(s: BeeState, at: number) {
  for (const b of s.buildings)
    if (b.pendingLevel && b.readyAt <= at) {
      b.level = b.pendingLevel;
      delete b.pendingLevel;
    }
  if (s.brood && s.brood.readyAt <= at) {
    s.bees += s.brood.count;
    s.brood = null;
  }
  if (s.clearing && s.clearing.readyAt <= at) {
    const t = s.clearing.tile;
    if (s.clearing.plant) s.forest[t] = 100;
    else {
      s.wood = Math.min(
        capacities(s, at).wood,
        s.wood + (25 * s.forest[t]!) / 100,
      );
      s.forest[t] = 0;
    }
    s.clearing = null;
  }
  if (s.research && s.research.readyAt <= at) {
    s.doctrine = s.research.doctrine;
    s.research = null;
  }
}
export function advance(input: BeeState, now: number): BeeState {
  const s = structuredClone(input);
  const end = Math.max(now, s.lastTickAt);
  let at = Math.max(s.lastTickAt, end - OFFLINE_SECONDS * 1000);
  finishEvents(s, at);
  while (at < end) {
    const events = [
      s.brood?.readyAt,
      s.clearing?.readyAt,
      s.research?.readyAt,
      ...s.buildings.map((b) => b.readyAt),
    ].filter((n): n is number => typeof n === "number" && n > at);
    const next = Math.min(end, at + 10000, ...events);
    const dt = (next - at) / 60000;
    const cap = capacities(s, at);
    for (const p of production(s, at)) {
      const b = s.buildings.find((b) => b.id === p.id)!;
      let ratio = 1;
      if (p.honey < 0) ratio = Math.min(ratio, s.honey / (-p.honey * dt));
      if (p.wood < 0) ratio = Math.min(ratio, s.wood / (-p.wood * dt));
      if (p.honey > 0)
        ratio = Math.min(
          ratio,
          Math.max(0, cap.honey - s.honey) / (p.honey * dt),
        );
      if (p.wood > 0)
        ratio = Math.min(ratio, Math.max(0, cap.wood - s.wood) / (p.wood * dt));
      if (p.wax > 0)
        ratio = Math.min(ratio, Math.max(0, cap.wax - s.wax) / (p.wax * dt));
      const factor =
        (p.workers / (BUILDINGS[b.kind].workers || 1)) * 1.6 ** (b.level - 1);
      const depletion =
        b.kind === "pump" && p.honey > 0
          ? 20 * factor * (s.doctrine === "industry" ? 1.3 : 1)
          : b.kind === "sawmill"
            ? p.wood * 4
            : 0;
      if (depletion > 0)
        ratio = Math.min(
          ratio,
          p.trees.reduce((sum, t) => sum + s.forest[t]!, 0) / (depletion * dt),
        );
      ratio = Math.max(0, ratio);
      s.honey = Math.max(0, s.honey + p.honey * dt * ratio);
      s.wood = Math.max(0, s.wood + p.wood * dt * ratio);
      s.wax = Math.max(0, s.wax + p.wax * dt * ratio);
      s.totalHoney += Math.max(0, p.honey * dt * ratio);
      if (depletion > 0) drain(s, p.trees, depletion * dt * ratio);
      if (
        b.kind === "sanctuary" &&
        !p.reason &&
        p.workers &&
        p.restore.length
      ) {
        let growth = -p.honey * dt * ratio * 2.5;
        for (const t of p.restore) {
          const gain = Math.min(100 - s.forest[t]!, growth);
          s.forest[t]! += gain;
          growth -= gain;
          if (growth <= 0) break;
        }
      }
    }
    at = next;
    finishEvents(s, at);
  }
  s.lastTickAt = end;
  return normalize(s, end);
}
function freeBuilder(s: BeeState, now: number) {
  if (builders(s, now).busy >= builders(s, now).max)
    throw new BeeRuleError("Строитель занят");
}
function getBuilding(s: BeeState, id: number) {
  const b = s.buildings.find((b) => b.id === id);
  if (!b) throw new BeeRuleError("Постройка не найдена");
  return b;
}
export function act(
  input: BeeState,
  action: BeeAction,
  now: number,
  dailyCap = 300,
): { state: BeeState; payout: number } {
  const s = advance(input, now);
  let payout = 0;
  switch (action.type) {
    case "heartbeat": {
      const delta = Math.max(0, (now - s.lastSeenAt) / 1000);
      if (delta <= 20)
        s.activeSeconds = Math.min(86400, s.activeSeconds + delta);
      s.lastSeenAt = Math.max(now, s.lastSeenAt);
      break;
    }
    case "breed": {
      if (s.brood) throw new BeeRuleError("Расплод уже растёт");
      if (s.bees + 3 > capacities(s, now).bees)
        throw new BeeRuleError("Постройте ещё один пчелиный дом");
      const first = s.bees === 0;
      debit(s, { honey: first ? 0 : 8 });
      const fast = s.buildings.some(
        (b) =>
          b.kind === "nursery" &&
          b.enabled &&
          complete(b, now) &&
          distance(b, headquarters(s)) <= 4,
      );
      const seconds = first ? 15 : fast ? 15 : 30;
      s.brood = { count: 3, startedAt: now, readyAt: now + seconds * 1000 };
      break;
    }
    case "build": {
      const def = BUILDINGS[action.kind];
      if (def.tier > tier(s))
        throw new BeeRuleError(`Нужна колония ${def.tier}`);
      if (s.buildings.length >= 48) throw new BeeRuleError("Долина заполнена");
      freeBuilder(s, now);
      const error = placementError(s, action.kind, action.x, action.y);
      if (error) throw new BeeRuleError(error);
      debit(s, def.cost);
      s.roads = s.roads.filter(
        (t) =>
          !footprint({ kind: action.kind, x: action.x, y: action.y }).includes(
            t,
          ),
      );
      s.buildings.push({
        id: s.nextId++,
        kind: action.kind,
        x: action.x,
        y: action.y,
        level: 1,
        startedAt: now,
        readyAt: now + def.seconds * 1000,
        enabled: true,
        priority: 0,
      });
      break;
    }
    case "upgrade": {
      const b = getBuilding(s, action.id);
      if (!complete(b, now)) throw new BeeRuleError("Дождитесь завершения");
      freeBuilder(s, now);
      const error = upgradeRequirement(s, b);
      if (error) throw new BeeRuleError(error);
      debit(s, costForUpgrade(b));
      b.pendingLevel = b.level + 1;
      b.startedAt = now;
      b.readyAt =
        now +
        (b.kind === "wild"
          ? [0, 0, 45, 90, 180][b.pendingLevel]!
          : BUILDINGS[b.kind].seconds * b.pendingLevel) *
          1000;
      break;
    }
    case "move": {
      const b = getBuilding(s, action.id);
      if (b.kind === "wild")
        throw new BeeRuleError("Дикий улей нельзя переносить");
      if (!complete(b, now)) throw new BeeRuleError("Дождитесь завершения");
      freeBuilder(s, now);
      const error = placementError(s, b.kind, action.x, action.y, b.id);
      if (error) throw new BeeRuleError(error);
      b.x = action.x;
      b.y = action.y;
      s.roads = s.roads.filter((t) => !footprint(b).includes(t));
      b.startedAt = now;
      b.readyAt = now + 15000;
      break;
    }
    case "toggle": {
      const b = getBuilding(s, action.id);
      if (b.kind === "wild") throw new BeeRuleError("Матка всегда работает");
      b.enabled = !b.enabled;
      break;
    }
    case "priority": {
      const b = getBuilding(s, action.id);
      if (b.kind !== "wild")
        b.priority = Math.min(
          99999,
          Math.max(
            0,
            ...s.buildings
              .filter((a) => a.kind !== "wild")
              .map((a) => a.priority),
          ) + 1,
        );
      break;
    }
    case "demolish": {
      const b = getBuilding(s, action.id);
      if (b.kind === "wild" || !complete(b, now))
        throw new BeeRuleError("Эту постройку сейчас нельзя снести");
      const remaining = {
        ...s,
        buildings: s.buildings.filter((a) => a.id !== b.id),
      };
      if (capacities(remaining, now).bees < s.bees + (s.brood?.count ?? 0))
        throw new BeeRuleError("Пчёлам сначала нужен новый дом");
      const cap = capacities(remaining, now);
      if (s.honey > cap.honey || s.wood > cap.wood || s.wax > cap.wax)
        throw new BeeRuleError("Сначала освободите склад");
      s.buildings = remaining.buildings;
      for (const [r, n] of Object.entries(BUILDINGS[b.kind].cost))
        s[r as Resource] = Math.min(
          cap[r as Resource],
          s[r as Resource] + Math.floor(n * 0.5),
        );
      break;
    }
    case "chop":
    case "plant":
    case "road": {
      const x = action.x,
        y = action.y;
      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        terrain(x, y) !== "grass"
      )
        throw new BeeRuleError("Недоступная клетка");
      const t = index(x, y);
      if (occupied(s, t) || s.clearing?.tile === t)
        throw new BeeRuleError("Место занято");
      if (action.type === "road") {
        if (s.forest[t]! > 0) throw new BeeRuleError("Сначала уберите дерево");
        if (s.roads.includes(t)) s.roads = s.roads.filter((n) => n !== t);
        else {
          debit(s, { wood: 1 });
          s.roads.push(t);
        }
        break;
      }
      freeBuilder(s, now);
      if (action.type === "chop" && s.forest[t]! <= 0)
        throw new BeeRuleError("Здесь нет дерева");
      if (action.type === "plant") {
        if (s.forest[t]! > 0 || s.roads.includes(t))
          throw new BeeRuleError("Место занято");
        debit(s, { honey: 8 });
      }
      s.clearing = {
        tile: t,
        plant: action.type === "plant",
        startedAt: now,
        readyAt: now + (action.type === "plant" ? 30 : 10) * 1000,
      };
      break;
    }
    case "research": {
      if (tier(s) < 3) throw new BeeRuleError("Нужна колония 3");
      if (s.research) throw new BeeRuleError("Исследование уже идёт");
      if (s.doctrine === action.doctrine)
        throw new BeeRuleError("Уже исследовано");
      debit(s, { honey: 150, wax: 30 });
      s.research = {
        doctrine: action.doctrine,
        startedAt: now,
        readyAt: now + 90000,
      };
      break;
    }
    case "order": {
      if (
        !s.buildings.some(
          (b) =>
            b.kind === "market" &&
            b.enabled &&
            complete(b, now) &&
            connections(s).has(b.id),
        )
      )
        throw new BeeRuleError("Торговой лавке нужна дорога к дикому улью");
      if (s.earnedToday + ORDER_CENTS > dailyCap)
        throw new BeeRuleError("Дневной лимит достигнут");
      if (
        s.activeSeconds < (s.ordersToday + 1) * ORDER_SECONDS ||
        now - s.lastOrderAt < ORDER_SECONDS * 1000
      )
        throw new BeeRuleError("Заказ ещё готовится");
      debit(s, { honey: ORDER_HONEY });
      s.earnedToday += ORDER_CENTS;
      s.earnedTotal += ORDER_CENTS;
      s.ordersToday++;
      s.lastOrderAt = now;
      payout = ORDER_CENTS;
      break;
    }
  }
  return { state: s, payout };
}
