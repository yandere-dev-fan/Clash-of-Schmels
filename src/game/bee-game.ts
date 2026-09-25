/** Clash of Schmels: deterministic inventories, transport jobs and utility networks. */
import { migrateState as legacyMigrate } from "./bee-legacy";
export const MAP_SIZE = 42,
  SECTOR = 6,
  OFFLINE_SECONDS = 28800;
export const ORDER_HONEY = 120,
  ORDER_CENTS = 25,
  ORDER_SECONDS = 300;
export const RESOURCES = [
  "nectar",
  "honey",
  "wood",
  "wax",
  "planks",
  "gears",
  "ore",
  "copper",
  "water",
] as const;
export type Resource = (typeof RESOURCES)[number];
export type Cost = Partial<Record<Resource, number>>;
export type Stock = Record<Resource, number>;
export const RESOURCE_NAMES: Record<Resource, string> = {
  nectar: "Нектар",
  honey: "Мёд",
  wood: "Древесина",
  wax: "Воск",
  planks: "Доски",
  gears: "Шестерни",
  ore: "Руда",
  copper: "Медь",
  water: "Вода",
};
export type Role = "forager" | "carrier" | "engineer" | "forester";
export const ROLES: Record<
  Role,
  { name: string; color: string; seconds: number; cost: Cost }
> = {
  forager: {
    name: "Собиратель",
    color: "#e3b648",
    seconds: 60,
    cost: { honey: 12 },
  },
  carrier: {
    name: "Грузчик",
    color: "#75b8b1",
    seconds: 90,
    cost: { honey: 18 },
  },
  engineer: {
    name: "Механик",
    color: "#bc8770",
    seconds: 150,
    cost: { honey: 30, wood: 5 },
  },
  forester: {
    name: "Лесник",
    color: "#87a55e",
    seconds: 90,
    cost: { honey: 18 },
  },
};
export type BuildingKind =
  | "wild"
  | "hive"
  | "meadow"
  | "depot"
  | "nursery"
  | "logging"
  | "workshop"
  | "press"
  | "market"
  | "sawmill"
  | "pump"
  | "sanctuary"
  | "waterwheel"
  | "well"
  | "boiler"
  | "mine"
  | "smelter"
  | "dynamo"
  | "powerplant"
  | "centrifuge"
  | "relay";
export type LinkKind = "flight" | "belt" | "shaft" | "wire" | "pipe";
export const LINK_NAMES: Record<LinkKind, string> = {
  flight: "Маршрут пчёл",
  belt: "Конвейер",
  shaft: "Вал",
  wire: "Кабель",
  pipe: "Трубопровод",
};
export interface Recipe {
  input: Cost;
  output: Cost;
  seconds: number;
}
export interface BuildingDef {
  name: string;
  tier: number;
  size: number;
  cost: Cost;
  seconds: number;
  category: "colony" | "production" | "power" | "nature";
  role?: Role;
  workers: number;
  range: number;
  mechanical?: number;
  electric?: number;
  recipe?: Recipe;
  description: string;
}
export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  wild: {
    name: "Маточный улей",
    tier: 1,
    size: 2,
    cost: {},
    seconds: 0,
    category: "colony",
    workers: 0,
    range: 8,
    recipe: { input: { nectar: 2 }, output: { honey: 1 }, seconds: 8 },
    description:
      "Собиратели приносят нектар с цветов. Мёд хранится в центральных сотах.",
  },
  hive: {
    name: "Улей",
    tier: 1,
    size: 2,
    cost: { honey: 18, wood: 20 },
    seconds: 45,
    category: "colony",
    workers: 0,
    range: 8,
    recipe: { input: { nectar: 2 }, output: { honey: 1 }, seconds: 8 },
    description:
      "+6 мест. Требует собирателей и цветов. Мёд нужно вывезти в хранилище.",
  },
  meadow: {
    name: "Цветочная делянка",
    tier: 1,
    size: 2,
    cost: { honey: 14, wood: 8 },
    seconds: 30,
    category: "nature",
    workers: 0,
    range: 0,
    description:
      "Возобновляемый нектар. Собиратель забирает груз и возвращается в свой улей.",
  },
  depot: {
    name: "Хранилище сот",
    tier: 1,
    size: 2,
    cost: { honey: 35, wood: 30 },
    seconds: 60,
    category: "colony",
    workers: 0,
    range: 0,
    description:
      "Центральный запас для строительства. +1000 каждого ресурса за уровень. Требует доставки.",
  },
  nursery: {
    name: "Расплодник",
    tier: 1,
    size: 2,
    cost: { honey: 45, wood: 25 },
    seconds: 60,
    category: "colony",
    workers: 0,
    range: 0,
    description:
      "Выращивает и обучает собирателей, грузчиков, лесников и механиков. +6 мест.",
  },
  logging: {
    name: "Лесная станция",
    tier: 1,
    size: 2,
    cost: { honey: 30, wood: 20 },
    seconds: 45,
    category: "production",
    role: "forester",
    workers: 0,
    range: 6,
    description:
      "Лесники летают к деревьям и доставляют древесину на станцию. Нужен вывоз.",
  },
  workshop: {
    name: "Мастерская роя",
    tier: 1,
    size: 2,
    cost: { honey: 50, wood: 35 },
    seconds: 60,
    category: "production",
    role: "engineer",
    workers: 1,
    range: 0,
    description:
      "Ручное изготовление досок или шестерней. Рецепт выбирается в постройке.",
  },
  press: {
    name: "Восковый пресс",
    tier: 1,
    size: 2,
    cost: { honey: 65, wood: 30 },
    seconds: 60,
    category: "production",
    role: "engineer",
    workers: 1,
    range: 0,
    recipe: { input: { honey: 3 }, output: { wax: 1 }, seconds: 20 },
    description:
      "3 мёда → 1 воск. Нужен механик, доставка сырья и вывоз результата.",
  },
  market: {
    name: "Экспедиционные соты",
    tier: 1,
    size: 2,
    cost: { honey: 65, wood: 30 },
    seconds: 60,
    category: "colony",
    workers: 0,
    range: 0,
    description:
      "Мёд для заказов должен физически прибыть сюда. 120 мёда за доставку.",
  },
  sawmill: {
    name: "Пилорама",
    tier: 2,
    size: 2,
    cost: { honey: 100, wood: 50, gears: 6 },
    seconds: 120,
    category: "production",
    role: "engineer",
    workers: 1,
    range: 0,
    mechanical: 8,
    recipe: { input: { wood: 2 }, output: { planks: 2 }, seconds: 8 },
    description:
      "Вращение 8: 2 древесины → 2 доски. Без вала и мощности стоит.",
  },
  pump: {
    name: "Нектарная помпа",
    tier: 2,
    size: 2,
    cost: { honey: 160, planks: 35, gears: 10 },
    seconds: 180,
    category: "production",
    role: "engineer",
    workers: 1,
    range: 4,
    mechanical: 12,
    recipe: { input: { water: 1 }, output: { nectar: 4 }, seconds: 10 },
    description:
      "Вращение 12 и вода. Высасывает нектар из леса. Истощает деревья.",
  },
  sanctuary: {
    name: "Питомник леса",
    tier: 2,
    size: 2,
    cost: { honey: 120, planks: 30, wax: 15 },
    seconds: 120,
    category: "nature",
    role: "forester",
    workers: 1,
    range: 5,
    recipe: { input: { water: 2, honey: 1 }, output: {}, seconds: 15 },
    description: "Вода и мёд восстанавливают деревья вокруг. Нужен лесник.",
  },
  waterwheel: {
    name: "Водяное колесо",
    tier: 2,
    size: 2,
    cost: { wood: 60, planks: 20, gears: 5 },
    seconds: 120,
    category: "power",
    workers: 0,
    range: 0,
    description:
      "24 вращения. Только у реки. Соединяйте валы; перегрузка останавливает сеть.",
  },
  well: {
    name: "Водозабор",
    tier: 1,
    size: 2,
    cost: { honey: 25, wood: 20 },
    seconds: 45,
    category: "production",
    role: "engineer",
    workers: 1,
    range: 0,
    recipe: { input: {}, output: { water: 3 }, seconds: 12 },
    description:
      "Механик набирает воду у реки. Бочки перевозят грузчики; позже трубы.",
  },
  boiler: {
    name: "Паровой котёл",
    tier: 3,
    size: 2,
    cost: { honey: 250, planks: 80, gears: 25, copper: 10 },
    seconds: 300,
    category: "power",
    workers: 0,
    range: 0,
    recipe: { input: { wood: 1, water: 2 }, output: {}, seconds: 10 },
    description:
      "48 вращения из древесины и воды. Постоянная подача топлива обязательна.",
  },
  mine: {
    name: "Рудная бурильня",
    tier: 3,
    size: 2,
    cost: { honey: 180, planks: 50, gears: 20 },
    seconds: 180,
    category: "production",
    role: "engineer",
    workers: 1,
    range: 4,
    mechanical: 10,
    recipe: { input: {}, output: { ore: 2 }, seconds: 12 },
    description:
      "Вращение 10. Работает рядом с каменной жилой. Руда нужна для меди.",
  },
  smelter: {
    name: "Медная плавильня",
    tier: 3,
    size: 2,
    cost: { honey: 220, planks: 60, gears: 15 },
    seconds: 180,
    category: "production",
    role: "engineer",
    workers: 1,
    range: 0,
    recipe: { input: { ore: 3, wood: 1 }, output: { copper: 1 }, seconds: 25 },
    description: "3 руды + древесина → медь. Первая ступень электротехники.",
  },
  dynamo: {
    name: "Медовое динамо",
    tier: 4,
    size: 2,
    cost: { honey: 400, copper: 50, gears: 40 },
    seconds: 300,
    category: "power",
    workers: 0,
    range: 0,
    mechanical: 16,
    description: "16 вращения → 40 электричества. Вход валом, выход кабелем.",
  },
  powerplant: {
    name: "Электростанция",
    tier: 4,
    size: 2,
    cost: { honey: 700, copper: 90, gears: 70, planks: 100 },
    seconds: 600,
    category: "power",
    workers: 0,
    range: 0,
    recipe: { input: { wood: 2, water: 3 }, output: {}, seconds: 10 },
    description: "80 электричества. Непрерывно расходует топливо и воду.",
  },
  centrifuge: {
    name: "Медовая центрифуга",
    tier: 4,
    size: 2,
    cost: { honey: 450, copper: 40, gears: 35 },
    seconds: 240,
    category: "production",
    role: "engineer",
    workers: 1,
    range: 0,
    electric: 18,
    recipe: { input: { nectar: 4 }, output: { honey: 4, wax: 1 }, seconds: 8 },
    description:
      "18 электричества. Нектар превращается в мёд и воск. Вывозите оба продукта.",
  },
  relay: {
    name: "Перевалочные соты",
    tier: 1,
    size: 1,
    cost: { honey: 15, wood: 10 },
    seconds: 20,
    category: "colony",
    workers: 0,
    range: 0,
    description:
      "Промежуточный буфер для дальних маршрутов и развязки конвейеров.",
  },
};
export const BUILDABLE = Object.keys(BUILDINGS).filter(
  (k) => k !== "wild",
) as Exclude<BuildingKind, "wild">[];
export const TECH = [
  { name: "Рой", age: 0, seconds: 0, cost: {} },
  {
    name: "Механика",
    age: 6 * 3600,
    seconds: 1800,
    cost: { honey: 250, wood: 150, wax: 40, planks: 40, gears: 12 },
  },
  {
    name: "Пар",
    age: 30 * 3600,
    seconds: 7200,
    cost: { honey: 1500, planks: 250, gears: 80, wax: 150 },
  },
  {
    name: "Электричество",
    age: 72 * 3600,
    seconds: 21600,
    cost: { honey: 6000, copper: 400, gears: 300, wax: 500 },
  },
] satisfies { name: string; age: number; seconds: number; cost: Cost }[];
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
  stock: Stock;
  progress: number;
  recipe?: "planks" | "gears";
}
export interface TransportLink {
  id: number;
  from: number;
  to: number;
  kind: LinkKind;
  filter: Resource | "auto";
  path: number[];
}
export interface Bee {
  id: number;
  role: Role;
  job: number | null;
  at?: { x: number; y: number };
}
export interface Job {
  id: number;
  bee: number | null;
  role: Role | "belt" | "pipe";
  from: number;
  to: number;
  resource: Resource;
  amount: number;
  path: { x: number; y: number }[];
  startedAt: number;
  pickupAt: number;
  readyAt: number;
  harvest?: { tile: number; health: number; picked: boolean };
}
export interface BuildingNotice {
  id: number;
  building: number;
  kind: "produced" | "delivered";
  resource: Resource;
  amount: number;
  at: number;
}
export interface BeeState extends Stock {
  version: 3;
  /** Missing/zero keeps the original hand-authored valley. */
  seed?: number;
  totalHoney: number;
  bees: number;
  units: Bee[];
  buildings: Building[];
  links: TransportLink[];
  jobs: Job[];
  forest: number[];
  unlocked: number[];
  nextId: number;
  nextJobId: number;
  nextBeeId: number;
  /** A short authoritative event tail for world-space feedback. */
  notices?: BuildingNotice[];
  nextNoticeId?: number;
  transportCursor?: number;
  era: number;
  createdAt: number;
  clock: number;
  brood: {
    readyAt: number;
    startedAt: number;
    count: number;
    role: Role;
    building: number;
  } | null;
  clearing: {
    tile: number;
    readyAt: number;
    startedAt: number;
    plant: boolean;
    bee?: number;
    from?: { x: number; y: number };
    arriveAt?: number;
    pickupAt?: number;
    harvested?: boolean;
    amount?: number;
  } | null;
  research: { era: number; readyAt: number; startedAt: number } | null;
  lastTickAt: number;
  day: string;
  earnedToday: number;
  earnedTotal: number;
  ordersToday: number;
  activeSeconds: number;
  lastSeenAt: number;
  lastOrderAt: number;
  migrated?: boolean;
}
export type BeeAction =
  | { type: "heartbeat" | "breed" | "order" }
  | { type: "build"; kind: Exclude<BuildingKind, "wild">; x: number; y: number }
  | {
      type: "upgrade" | "toggle" | "priority" | "demolish" | "disconnect";
      id: number;
    }
  | { type: "move"; id: number; x: number; y: number }
  | { type: "chop" | "plant" | "expand"; x: number; y: number }
  | { type: "research" }
  | { type: "train"; role: Role; id: number }
  | { type: "recipe"; id: number; recipe: "planks" | "gears" }
  | {
      type: "link";
      from: number;
      to: number;
      kind: LinkKind;
      filter: Resource | "auto";
      via?: number[];
    }
  | { type: "unlink"; id: number }
  | { type: "retrain"; role: Role; bee: number };
export class BeeRuleError extends Error {}
export const emptyStock = (): Stock =>
  Object.fromEntries(RESOURCES.map((k) => [k, 0])) as Stock;
function buildingNotice(
  s: BeeState,
  building: number,
  kind: BuildingNotice["kind"],
  resource: Resource,
  amount: number,
  at: number,
) {
  if (amount <= 0 || !building) return;
  const notices = (s.notices ??= []),
    previous = notices.at(-1);
  if (
    previous?.building === building &&
    previous.kind === kind &&
    previous.resource === resource &&
    at === previous.at
  ) {
    previous.amount += amount;
    previous.at = at;
  } else {
    const id = s.nextNoticeId ?? 1;
    s.nextNoticeId = id + 1;
    notices.push({
      id,
      building,
      kind,
      resource,
      amount,
      at,
    });
  }
  if (notices.length > 32) notices.splice(0, notices.length - 32);
}
export const index = (x: number, y: number) => y * MAP_SIZE + x;
export const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);
export const noise = (x: number, y: number, seed = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + 47 + seed * 0.173) * 43758.5453;
  return n - Math.floor(n);
};
export function terrain(
  x: number,
  y: number,
  seed = 0,
): "grass" | "water" | "rock" {
  if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return "rock";
  if (!seed) {
    if (x >= 12 && x <= 14 && y > 7 && y < 35) return "water";
    if ((x > 27 || y > 28) && noise(x, y) > 0.84) return "rock";
    return "grass";
  }
  // Every seed has an unbroken river and a straight reachable starter shore.
  const along = seed % 2 ? x : y,
    across = seed % 2 ? y : x;
  const bend =
    along >= 17 && along <= 25
      ? 0
      : Math.round(Math.sin((along + (seed % 17)) / 5) * 1.5);
  const river = 13 + (seed % 3) + bend;
  if (across >= river && across <= river + 1) return "water";
  if (Math.hypot(x - 21, y - 21) > 6 && noise(x, y, seed) > 0.88) return "rock";
  return "grass";
}
export const sector = (x: number, y: number) =>
  Math.floor(y / SECTOR) * 7 + Math.floor(x / SECTOR);
export const discovered = (s: BeeState, x: number, y: number) =>
  x >= 0 &&
  y >= 0 &&
  x < MAP_SIZE &&
  y < MAP_SIZE &&
  s.unlocked.includes(sector(x, y));
export const nativeForest = (x: number, y: number, seed = 0) =>
  terrain(x, y, seed) === "grass" &&
  Math.hypot(x - 21, y - 21) > 5 &&
  noise(x, y, seed) > (seed ? 0.32 + (seed % 7) * 0.035 : 0.4);
export const headquarters = (s: BeeState) =>
  s.buildings.find((b) => b.kind === "wild")!;
export const tier = (s: BeeState) => s.era;
export const complete = (b: Building, now: number) => b.readyAt <= now;
export function footprint(b: Pick<Building, "kind" | "x" | "y">) {
  const a: number[] = [];
  for (let y = b.y; y < b.y + BUILDINGS[b.kind].size; y++)
    for (let x = b.x; x < b.x + BUILDINGS[b.kind].size; x++)
      a.push(index(x, y));
  return a;
}
export const center = (b: Pick<Building, "kind" | "x" | "y">) => ({
  x: b.x + (BUILDINGS[b.kind].size - 1) / 2,
  y: b.y + (BUILDINGS[b.kind].size - 1) / 2,
});
export const distance = (
  a: Pick<Building, "kind" | "x" | "y">,
  b: Pick<Building, "kind" | "x" | "y">,
) => Math.hypot(center(a).x - center(b).x, center(a).y - center(b).y);
export const occupied = (s: BeeState, t: number, except?: number) =>
  s.buildings.some((b) => b.id !== except && footprint(b).includes(t));
export function nearbyTiles(b: Building, r: number) {
  const c = center(b),
    out: number[] = [];
  for (let y = Math.max(0, b.y - r); y < Math.min(MAP_SIZE, b.y + r + 2); y++)
    for (let x = Math.max(0, b.x - r); x < Math.min(MAP_SIZE, b.x + r + 2); x++)
      if (Math.hypot(x - c.x, y - c.y) <= r) out.push(index(x, y));
  return out;
}
const bank = (b: Building) => b.kind === "wild" || b.kind === "depot";
export function storageLimit(b: Building, r: Resource) {
  return bank(b)
    ? b.kind === "depot"
      ? 1000 * b.level
      : {
          honey: 800,
          wood: 300,
          wax: 200,
          nectar: 120,
          planks: 200,
          gears: 100,
          ore: 200,
          copper: 100,
          water: 100,
        }[r]
    : b.kind === "market"
      ? 240 * b.level
      : b.kind === "relay"
        ? 100 * b.level
        : b.kind === "meadow"
          ? 40 * b.level
          : 40 * b.level;
}
export function capacities(s: BeeState, now = s.lastTickAt) {
  const out = { ...emptyStock(), bees: 3 };
  for (const b of s.buildings.filter(
    (b) => complete(b, now) || b.pendingLevel,
  )) {
    if (bank(b)) for (const r of RESOURCES) out[r] += storageLimit(b, r);
    if (b.kind === "hive" || b.kind === "nursery") out.bees += 6 * b.level;
  }
  return out;
}
export const capacity = (s: BeeState) => capacities(s).honey;
export function syncStocks(s: BeeState) {
  for (const r of RESOURCES)
    s[r] = s.buildings.filter(bank).reduce((n, b) => n + b.stock[r], 0);
  s.bees = s.units.length;
  return s;
}
export function builders(s: BeeState, now = s.lastTickAt) {
  return {
    max: s.era >= 3 ? 2 : 1,
    busy:
      s.buildings.filter((b) => !complete(b, now)).length +
      (s.clearing ? 1 : 0),
  };
}
function makeBuilding(
  s: BeeState,
  kind: BuildingKind,
  x: number,
  y: number,
  now: number,
  level = 1,
) {
  const b: Building = {
    id: s.nextId++,
    kind,
    x,
    y,
    level,
    readyAt: now,
    startedAt: now,
    enabled: true,
    priority: 0,
    stock: emptyStock(),
    progress: 0,
  };
  s.buildings.push(b);
  return b;
}
export function initialState(now: number, seed = 0): BeeState {
  const s: BeeState = {
    ...emptyStock(),
    version: 3,
    seed,
    totalHoney: 0,
    bees: 0,
    units: [],
    buildings: [],
    links: [],
    jobs: [],
    forest: Array.from({ length: MAP_SIZE ** 2 }, (_, t) =>
      nativeForest(t % MAP_SIZE, Math.floor(t / MAP_SIZE), seed) ? 100 : 0,
    ),
    unlocked: [16, 17, 18, 23, 24, 25, 30, 31, 32],
    nextId: 1,
    nextJobId: 1,
    nextBeeId: 1,
    notices: [],
    nextNoticeId: 1,
    era: 1,
    createdAt: now,
    clock: now,
    brood: null,
    clearing: null,
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
  makeBuilding(s, "wild", 21, 21, now);
  return syncStocks(s);
}
export function placementError(
  s: BeeState,
  kind: BuildingKind,
  x: number,
  y: number,
  except?: number,
  ignoreForest = false,
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
    return "За границей леса";
  for (let yy = y; yy < y + size; yy++)
    for (let xx = x; xx < x + size; xx++) {
      const t = index(xx, yy);
      if (!discovered(s, xx, yy)) return "Сначала исследуйте сектор";
      if (terrain(xx, yy, s.seed) !== "grass") return "Нужна сухая площадка";
      if (!ignoreForest && s.forest[t]! > 0)
        return "Сначала расчистите деревья";
      if (s.clearing?.tile === t) return "Здесь работает строитель";
      if (s.links.some((l) => l.kind !== "flight" && l.path.includes(t)))
        return "Здесь проходит соединение";
    }
  for (const b of s.buildings) {
    if (b.id === except) continue;
    const bs = BUILDINGS[b.kind].size;
    if (
      x < b.x + bs + 1 &&
      x + size > b.x - 1 &&
      y < b.y + bs + 1 &&
      y + size > b.y - 1
    )
      return "Оставьте одну клетку между площадками";
  }
  if (
    (kind === "waterwheel" || kind === "well") &&
    !nearWater(x, y, size, s.seed)
  )
    return "Поставьте у берега реки";
  if (
    kind === "mine" &&
    !nearbyTiles({ kind, x, y } as Building, 4).some(
      (t) => terrain(t % MAP_SIZE, Math.floor(t / MAP_SIZE), s.seed) === "rock",
    )
  )
    return "Нужна каменная жила в радиусе 4";
  return null;
}
function nearWater(x: number, y: number, size: number, seed = 0) {
  for (let yy = y - 1; yy <= y + size; yy++)
    for (let xx = x - 1; xx <= x + size; xx++)
      if (terrain(xx, yy, seed) === "water") return true;
  return false;
}
export function recipeFor(b: Building): Recipe | undefined {
  return b.kind === "workshop"
    ? b.recipe === "gears"
      ? { input: { planks: 2, wax: 1 }, output: { gears: 1 }, seconds: 25 }
      : { input: { wood: 2 }, output: { planks: 1 }, seconds: 18 }
    : BUILDINGS[b.kind].recipe;
}
function needs(b: Building, r: Resource) {
  if (b.kind === "market") return r === "honey" ? 240 : 0;
  if (bank(b) || b.kind === "relay") return storageLimit(b, r);
  if (b.kind === "hive" || b.kind === "wild") return r === "nectar" ? 20 : 0;
  return (recipeFor(b)?.input[r] ?? 0) * 8;
}
function outputResource(b: Building, r: Resource) {
  return (
    (bank(b) && !(b.kind === "wild" && r === "nectar")) ||
    b.kind === "relay" ||
    (b.kind === "logging" && r === "wood") ||
    Boolean(recipeFor(b)?.output[r])
  );
}
function room(s: BeeState, b: Building, r: Resource) {
  return Math.max(
    0,
    storageLimit(b, r) -
      b.stock[r] -
      s.jobs
        .filter((j) => j.to === b.id && j.resource === r)
        .reduce((v, j) => v + j.amount, 0),
  );
}
function debit(s: BeeState, cost: Cost) {
  syncStocks(s);
  for (const [r, n] of Object.entries(cost))
    if (s[r as Resource] + 1e-7 < n)
      throw new BeeRuleError("Не хватает ресурсов в хранилищах");
  for (const [r, n] of Object.entries(cost)) {
    let left = n;
    for (const b of s.buildings.filter(bank)) {
      const use = Math.min(b.stock[r as Resource], left);
      b.stock[r as Resource] -= use;
      left -= use;
    }
  }
  syncStocks(s);
}
function putBank(s: BeeState, r: Resource, n: number, preserveOverflow = true) {
  for (const b of s.buildings.filter(bank)) {
    const use = Math.min(
      n,
      preserveOverflow
        ? Math.max(0, storageLimit(b, r) - b.stock[r])
        : room(s, b, r),
    );
    b.stock[r] += use;
    n -= use;
    if (n <= 0) return;
  }
  if (n > 0 && preserveOverflow) headquarters(s).stock[r] += n;
}
export function costForUpgrade(b: Building): Cost {
  return {
    honey: Math.ceil((BUILDINGS[b.kind].cost.honey ?? 60) * 1.7 ** b.level),
    wood: 30 * b.level,
    wax: 10 * b.level,
    ...(b.level >= 2 ? { gears: 10 * b.level } : {}),
  };
}
export function upgradeRequirement(s: BeeState, b: Building) {
  if (b.level >= 4) return "Максимальный уровень";
  if (b.level >= s.era)
    return `Нужна эпоха: ${TECH[b.level]?.name ?? "Электричество"}`;
  return null;
}
export function researchRequirement(s: BeeState, now = s.lastTickAt) {
  if (s.era >= 4) return "Все эпохи открыты";
  if (s.research) return "Исследование уже идёт";
  const tech = TECH[s.era]!;
  if (now < s.createdAt + tech.age * 1000)
    return `До исследования ${Math.ceil((s.createdAt + tech.age * 1000 - now) / 3600000)} ч`;
  if (!s.buildings.some((b) => b.kind === "workshop" && complete(b, now)))
    return "Нужна мастерская роя";
  return null;
}
function getBuilding(s: BeeState, id: number) {
  const b = s.buildings.find((b) => b.id === id);
  if (!b) throw new BeeRuleError("Постройка не найдена");
  return b;
}
function freeBuilder(s: BeeState, now: number) {
  if (builders(s, now).busy >= builders(s, now).max)
    throw new BeeRuleError("Строитель занят");
}
function adjacent(t: number) {
  const x = t % MAP_SIZE,
    y = Math.floor(t / MAP_SIZE);
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]
    .filter(([x, y]) => x! >= 0 && y! >= 0 && x! < MAP_SIZE && y! < MAP_SIZE)
    .map(([x, y]) => index(x!, y!));
}
export function routePath(
  s: BeeState,
  from: number,
  to: number,
  kind: LinkKind,
  via: number[] = [],
): number[] {
  const a = getBuilding(s, from),
    b = getBuilding(s, to);
  if (from === to) throw new BeeRuleError("Нужны две разные постройки");
  if (kind === "flight") {
    if (distance(a, b) > 12)
      throw new BeeRuleError("Слишком далеко. Нужны перевалочные соты");
    return [];
  }
  const blocked = new Set(
    s.buildings.filter((n) => n.id !== from && n.id !== to).flatMap(footprint),
  );
  const used = new Set(
    s.links.filter((l) => l.kind === kind).flatMap((l) => l.path.slice(1, -1)),
  );
  const targets = [...via, footprint(b)[0]!];
  let start = footprint(a)[0]!;
  const all: number[] = [start];
  for (const end of targets) {
    const queue = [start],
      prev = new Map<number, number>([[start, -1]]);
    for (let i = 0; i < queue.length && !prev.has(end); i++) {
      for (const n of adjacent(queue[i]!)) {
        if (
          prev.has(n) ||
          blocked.has(n) ||
          !discovered(s, n % MAP_SIZE, Math.floor(n / MAP_SIZE)) ||
          terrain(n % MAP_SIZE, Math.floor(n / MAP_SIZE), s.seed) !== "grass" ||
          s.forest[n]! > 0 ||
          (used.has(n) && n !== end)
        )
          continue;
        prev.set(n, queue[i]!);
        queue.push(n);
      }
    }
    if (!prev.has(end))
      throw new BeeRuleError("Нет свободной трассы. Расчистите коридор");
    const segment: number[] = [];
    let n = end;
    while (n !== start) {
      segment.push(n);
      n = prev.get(n)!;
    }
    all.push(...segment.reverse());
    start = end;
  }
  if (all.length > 90) throw new BeeRuleError("Трасса слишком длинная");
  return all;
}
interface Network {
  ids: number[];
  supply: number;
  demand: number;
  ratio: number;
}
function components(s: BeeState, kind: "shaft" | "wire") {
  const ids = s.buildings
      .filter((b) => b.enabled && complete(b, s.clock))
      .map((b) => b.id),
    seen = new Set<number>(),
    out: number[][] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const q = [id];
    seen.add(id);
    for (let i = 0; i < q.length; i++)
      for (const l of s.links.filter(
        (l) => l.kind === kind && (l.from === q[i] || l.to === q[i]),
      )) {
        const other = l.from === q[i] ? l.to : l.from;
        if (ids.includes(other) && !seen.has(other)) {
          seen.add(other);
          q.push(other);
        }
      }
    out.push(q);
  }
  return out;
}
const fueled = (b: Building) =>
  Object.entries(recipeFor(b)?.input ?? {}).every(
    ([r, n]) => b.stock[r as Resource] >= n,
  );
export function networks(s: BeeState) {
  const mechanical: Network[] = components(s, "shaft").map((ids) => {
    let supply = 0,
      demand = 0;
    for (const b of s.buildings.filter((b) => ids.includes(b.id))) {
      if (b.kind === "waterwheel") supply += 24 * b.level;
      if (b.kind === "boiler" && fueled(b)) supply += 48 * b.level;
      demand += (BUILDINGS[b.kind].mechanical ?? 0) * b.level;
    }
    demand += s.links
      .filter((l) => l.kind === "belt" && ids.includes(l.from))
      .reduce((n, l) => n + Math.max(1, Math.ceil(l.path.length / 6)), 0);
    return {
      ids,
      supply,
      demand,
      ratio: supply >= demand && supply > 0 ? 1 : 0,
    };
  });
  const electric: Network[] = components(s, "wire").map((ids) => {
    let supply = 0,
      demand = 0;
    for (const b of s.buildings.filter((b) => ids.includes(b.id))) {
      if (
        b.kind === "dynamo" &&
        mechanical.some((n) => n.ids.includes(b.id) && n.ratio === 1)
      )
        supply += 40 * b.level;
      if (b.kind === "powerplant" && fueled(b)) supply += 80 * b.level;
      demand += (BUILDINGS[b.kind].electric ?? 0) * b.level;
    }
    return {
      ids,
      supply,
      demand,
      ratio: supply >= demand && supply > 0 ? 1 : 0,
    };
  });
  return { mechanical, electric };
}
export interface Production {
  id: number;
  workers: number;
  needed: number;
  honey: number;
  wood: number;
  wax: number;
  reason: string;
  running: boolean;
  mechanical: number;
  electric: number;
}
export function production(s: BeeState, now = s.clock): Production[] {
  const ns = networks(s),
    free: Record<Role, number> = {
      forager: 0,
      carrier: 0,
      engineer: 0,
      forester: 0,
    };
  for (const u of s.units) if (!u.job) free[u.role]++;
  return [...s.buildings]
    .sort((a, b) => b.priority - a.priority || a.id - b.id)
    .map((b) => {
      const d = BUILDINGS[b.kind],
        p: Production = {
          id: b.id,
          workers: 0,
          needed: d.workers,
          honey: 0,
          wood: 0,
          wax: 0,
          reason: "",
          running: false,
          mechanical: 0,
          electric: 0,
        };
      if (!complete(b, now) || !b.enabled) {
        p.reason = b.enabled ? "Строится" : "Остановлено";
        return p;
      }
      p.workers = d.role ? Math.min(free[d.role], d.workers) : 0;
      if (d.role) free[d.role] -= p.workers;
      if (p.workers < d.workers) {
        p.reason = `Нужен ${ROLES[d.role!].name.toLowerCase()}`;
        return p;
      }
      if (d.mechanical) {
        const n = ns.mechanical.find((n) => n.ids.includes(b.id));
        p.mechanical = n?.supply ?? 0;
        if (!n?.ratio) {
          p.reason = n?.supply ? "Перегрузка валов" : "Нет вращения";
          return p;
        }
      }
      if (d.electric) {
        const n = ns.electric.find((n) => n.ids.includes(b.id));
        p.electric = n?.supply ?? 0;
        if (!n?.ratio) {
          p.reason = n?.supply
            ? "Не хватает электричества"
            : "Нет электричества";
          return p;
        }
      }
      const recipe = recipeFor(b);
      if (recipe) {
        if (!fueled(b)) {
          p.reason = "Нет сырья";
          return p;
        }
        if (
          Object.entries(recipe.output).some(
            ([r, n]) => room(s, b, r as Resource) < n,
          )
        ) {
          p.reason = "Выход заполнен";
          return p;
        }
        if (
          b.kind === "pump" &&
          !nearbyTiles(b, d.range).some(
            (t) =>
              discovered(s, t % MAP_SIZE, Math.floor(t / MAP_SIZE)) &&
              availableTree(s, t) > 0,
          )
        ) {
          p.reason = "Лес исчерпан";
          return p;
        }
        const speed = (60 / recipe.seconds) * (1 + 0.4 * (b.level - 1));
        p.honey =
          ((recipe.output.honey ?? 0) - (recipe.input.honey ?? 0)) * speed;
        p.wood = ((recipe.output.wood ?? 0) - (recipe.input.wood ?? 0)) * speed;
        p.wax = (recipe.output.wax ?? 0) * speed;
        p.running = true;
      } else if (b.kind === "waterwheel" || b.kind === "dynamo")
        p.running = true;
      else if (b.kind === "logging")
        p.running = s.jobs.some((j) => j.to === b.id);
      else if (b.kind === "meadow") p.running = true;
      return p;
    });
}
function dispatch(
  s: BeeState,
  bee: Bee | null,
  role: Job["role"],
  from: number,
  to: number,
  r: Resource,
  amount: number,
  path: { x: number; y: number }[],
  at: number,
  pickup = 0,
  duration?: number,
) {
  const length = path
    .slice(1)
    .reduce((n, p, i) => n + Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y), 0);
  const job: Job = {
    id: s.nextJobId++,
    bee: bee?.id ?? null,
    role,
    from,
    to,
    resource: r,
    amount,
    path,
    startedAt: at,
    pickupAt:
      at +
      (path.length > 2
        ? Math.hypot(path[1]!.x - path[0]!.x, path[1]!.y - path[0]!.y) * 1.8 +
          pickup
        : 0) *
        1000,
    readyAt: at + (duration ?? Math.max(4, length * 1.8 + pickup)) * 1000,
  };
  s.jobs.push(job);
  if (bee) bee.job = job.id;
  return job;
}
function availableTree(s: BeeState, t: number) {
  if (s.clearing?.tile === t) return 0;
  return Math.max(
    0,
    s.forest[t]! -
      s.jobs
        .filter((j) => j.harvest?.tile === t && !j.harvest.picked)
        .reduce((n, j) => n + j.harvest!.health, 0),
  );
}
function finish(s: BeeState, at: number) {
  for (const j of s.jobs)
    if (j.harvest && !j.harvest.picked && j.pickupAt <= at) {
      s.forest[j.harvest.tile] = Math.max(
        0,
        s.forest[j.harvest.tile]! - j.harvest.health,
      );
      j.harvest.picked = true;
    }
  if (
    s.clearing?.pickupAt &&
    s.clearing.pickupAt <= at &&
    !s.clearing.harvested
  ) {
    s.clearing.harvested = true;
    s.forest[s.clearing.tile] = 0;
  }
  for (const b of s.buildings)
    if (b.pendingLevel && b.readyAt <= at) {
      b.level = b.pendingLevel;
      delete b.pendingLevel;
    }
  if (s.brood && s.brood.readyAt <= at) {
    for (let i = 0; i < s.brood.count; i++)
      s.units.push({ id: s.nextBeeId++, role: s.brood.role, job: null });
    s.brood = null;
  }
  if (s.clearing && s.clearing.readyAt <= at) {
    const t = s.clearing.tile;
    if (s.clearing.plant) s.forest[t] = 100;
    else {
      putBank(s, "wood", s.clearing.amount ?? (25 * s.forest[t]!) / 100, false);
      s.forest[t] = 0;
    }
    if (s.clearing.bee) {
      const bee = s.units.find((u) => u.id === s.clearing!.bee);
      if (bee) {
        bee.job = null;
        bee.at = center(headquarters(s));
      }
    }
    s.clearing = null;
  }
  if (s.research && s.research.readyAt <= at) {
    s.era = s.research.era;
    s.research = null;
  }
  for (const job of s.jobs.filter((j) => j.readyAt <= at)) {
    const target = s.buildings.find((b) => b.id === job.to);
    if (target) {
      target.stock[job.resource] += job.amount;
      buildingNotice(s, target.id, "delivered", job.resource, job.amount, at);
    } else putBank(s, job.resource, job.amount);
    const bee = s.units.find((u) => u.id === job.bee);
    if (bee) {
      bee.job = null;
      bee.at = target ? center(target) : center(headquarters(s));
    }
  }
  s.jobs = s.jobs.filter((j) => j.readyAt > at);
}
function tick(s: BeeState, at: number) {
  s.clock = at;
  finish(s, at);
  const rates = production(s, at);
  for (const b of s.buildings) {
    if (!complete(b, at) || !b.enabled) continue;
    if (b.kind === "meadow") {
      b.stock.nectar = Math.min(
        storageLimit(b, "nectar"),
        b.stock.nectar + 2 * b.level,
      );
      continue;
    }
    const recipe = recipeFor(b),
      p = rates.find((p) => p.id === b.id);
    if (!recipe || !p?.running) continue;
    b.progress += 2 * (1 + 0.4 * (b.level - 1));
    if (b.progress + 1e-8 < recipe.seconds) continue;
    b.progress -= recipe.seconds;
    for (const [r, n] of Object.entries(recipe.input))
      b.stock[r as Resource] = Math.max(0, b.stock[r as Resource] - n);
    for (const [r, n] of Object.entries(recipe.output))
      b.stock[r as Resource] += n;
    for (const [r, n] of Object.entries(recipe.output))
      buildingNotice(s, b.id, "produced", r as Resource, n, at);
    s.totalHoney += recipe.output.honey ?? 0;
    if (b.kind === "pump") {
      let left = 4;
      for (const t of nearbyTiles(b, 4)) {
        if (!discovered(s, t % MAP_SIZE, Math.floor(t / MAP_SIZE))) continue;
        const n = Math.min(left, availableTree(s, t));
        s.forest[t]! -= n;
        left -= n;
        if (left <= 0) break;
      }
    }
    if (b.kind === "sanctuary") {
      const t = nearbyTiles(b, 5).find(
        (t) =>
          discovered(s, t % MAP_SIZE, Math.floor(t / MAP_SIZE)) &&
          s.forest[t]! < 100 &&
          nativeForest(t % MAP_SIZE, Math.floor(t / MAP_SIZE), s.seed) &&
          !occupied(s, t) &&
          !s.links.some((l) => l.path.includes(t)),
      );
      if (t !== undefined) s.forest[t] = Math.min(100, s.forest[t]! + 6);
    }
  }
  const ready = s.buildings.filter((b) => b.enabled && complete(b, at));
  for (const bee of s.units.filter((u) => u.role === "forager" && !u.job)) {
    const home = ready
      .filter(
        (b) =>
          (b.kind === "wild" || b.kind === "hive") &&
          room(s, b, "nectar") >= 3 &&
          b.stock.nectar +
            s.jobs
              .filter((j) => j.to === b.id && j.resource === "nectar")
              .reduce((a, j) => a + j.amount, 0) <
            20,
      )
      .sort((a, b) => a.stock.nectar - b.stock.nectar || a.id - b.id)[0];
    if (!home) break;
    const flower = ready
      .filter(
        (b) =>
          b.kind === "meadow" && b.stock.nectar >= 3 && distance(home, b) <= 8,
      )
      .sort((a, b) => distance(a, home) - distance(b, home))[0];
    const c = center(home);
    if (flower) {
      flower.stock.nectar -= 3;
      dispatch(
        s,
        bee,
        "forager",
        flower.id,
        home.id,
        "nectar",
        3,
        [bee.at ?? c, center(flower), c],
        at,
        6,
      );
    } else {
      const tile = nearbyTiles(home, 6).find(
        (t) =>
          discovered(s, t % MAP_SIZE, Math.floor(t / MAP_SIZE)) &&
          !occupied(s, t) &&
          terrain(t % MAP_SIZE, Math.floor(t / MAP_SIZE), s.seed) === "grass" &&
          noise(t % MAP_SIZE, Math.floor(t / MAP_SIZE), s.seed) > 0.8,
      );
      if (tile !== undefined)
        dispatch(
          s,
          bee,
          "forager",
          0,
          home.id,
          "nectar",
          2,
          [
            bee.at ?? c,
            { x: tile % MAP_SIZE, y: Math.floor(tile / MAP_SIZE) },
            c,
          ],
          at,
          8,
        );
    }
  }
  const reservedForesters = rates
    .filter(
      (p) =>
        p.workers > 0 &&
        s.buildings.find((b) => b.id === p.id)?.kind === "sanctuary",
    )
    .reduce((n, p) => n + p.workers, 0);
  for (const bee of s.units
    .filter((u) => u.role === "forester" && !u.job)
    .slice(reservedForesters)) {
    const station = ready
      .filter((b) => b.kind === "logging" && room(s, b, "wood") >= 3)
      .find((b) =>
        nearbyTiles(b, 6).some(
          (t) =>
            discovered(s, t % MAP_SIZE, Math.floor(t / MAP_SIZE)) &&
            availableTree(s, t) >= 12 &&
            !occupied(s, t),
        ),
      );
    if (!station) break;
    const t = nearbyTiles(station, 6).find(
      (t) =>
        discovered(s, t % MAP_SIZE, Math.floor(t / MAP_SIZE)) &&
        availableTree(s, t) >= 12 &&
        !occupied(s, t),
    )!;
    if (t === undefined) continue;
    const harvestJob = dispatch(
      s,
      bee,
      "forester",
      0,
      station.id,
      "wood",
      3,
      [
        bee.at ?? center(station),
        { x: t % MAP_SIZE, y: Math.floor(t / MAP_SIZE) },
        center(station),
      ],
      at,
      6,
    );
    harvestJob.harvest = { tile: t, health: 12, picked: false };
  }
  const transportPower = networks(s);
  const cursor = (s.transportCursor ?? 0) % Math.max(1, s.links.length);
  const orderedLinks = [...s.links.slice(cursor), ...s.links.slice(0, cursor)];
  for (const l of orderedLinks) {
    if (["shaft", "wire"].includes(l.kind)) continue;
    if (
      l.kind === "belt" &&
      !transportPower.mechanical.some(
        (n) => n.ids.includes(l.from) && n.ratio === 1,
      )
    )
      continue;
    const a = ready.find((b) => b.id === l.from),
      b = ready.find((b) => b.id === l.to);
    if (!a || !b) continue;
    const r = RESOURCES.find(
      (r) =>
        (l.filter === "auto" || l.filter === r) &&
        (outputResource(a, r) || l.filter === r) &&
        a.stock[r] >= 1 &&
        Math.min(
          room(s, b, r),
          needs(b, r) -
            b.stock[r] -
            s.jobs
              .filter((j) => j.to === b.id && j.resource === r)
              .reduce((n, j) => n + j.amount, 0),
        ) >= 1 &&
        !(l.kind === "pipe" && !["water", "nectar", "honey"].includes(r)),
    );
    if (!r) continue;
    const amount = Math.min(
      l.kind === "flight" ? 4 : l.kind === "pipe" ? 3 : 2,
      a.stock[r],
      room(s, b, r),
      needs(b, r) -
        b.stock[r] -
        s.jobs
          .filter((j) => j.to === b.id && j.resource === r)
          .reduce((n, j) => n + j.amount, 0),
    );
    if (amount < 1) continue;
    if (l.kind === "flight") {
      const bee = s.units.find((u) => u.role === "carrier" && !u.job);
      if (!bee) continue;
      s.transportCursor = (s.links.indexOf(l) + 1) % s.links.length;
      a.stock[r] -= amount;
      dispatch(
        s,
        bee,
        "carrier",
        a.id,
        b.id,
        r,
        amount,
        [bee.at ?? center(headquarters(s)), center(a), center(b)],
        at,
        0,
      );
    } else {
      if (
        s.jobs.some(
          (j) =>
            j.from === a.id &&
            j.to === b.id &&
            j.role === l.kind &&
            at - j.startedAt < 2000,
        )
      )
        continue;
      a.stock[r] -= amount;
      dispatch(
        s,
        null,
        l.kind as "belt" | "pipe",
        a.id,
        b.id,
        r,
        amount,
        l.path.map((t) => ({ x: t % MAP_SIZE, y: Math.floor(t / MAP_SIZE) })),
        at,
        0,
        Math.max(2, l.path.length * (l.kind === "belt" ? 0.8 : 0.4)),
      );
    }
  }
  syncStocks(s);
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
export function advance(input: BeeState, now: number): BeeState {
  const s = structuredClone(input),
    end = Math.max(now, s.lastTickAt);
  let at = s.clock;
  if (end - at > OFFLINE_SECONDS * 1000) {
    at = end - OFFLINE_SECONDS * 1000;
    s.clock = at;
    finish(s, at);
  }
  while (at + 2000 <= end) {
    at += 2000;
    tick(s, at);
  }
  finish(s, end);
  s.lastTickAt = end;
  syncStocks(s);
  return normalize(s, end);
}
export function migrateState(input: unknown, now: number): BeeState {
  const raw = input as { version?: number };
  if (raw.version === 3) return input as BeeState;
  const old = legacyMigrate(input, now);
  const s = initialState(now);
  s.buildings = [];
  s.nextId = 1;
  s.era =
    old.buildings[0]!.level >= 4 ? 3 : old.buildings[0]!.level >= 2 ? 2 : 1;
  s.createdAt = now - TECH[s.era - 1]!.age * 1000;
  s.migrated = true;
  for (const key of [
    "totalHoney",
    "earnedToday",
    "earnedTotal",
    "ordersToday",
    "activeSeconds",
    "lastOrderAt",
    "day",
  ] as const)
    (s as any)[key] = old[key];
  for (let y = 0; y < 18; y++)
    for (let x = 0; x < 18; x++)
      if (terrain(x + 12, y + 12) === "grass")
        s.forest[index(x + 12, y + 12)] = old.forest[y * 18 + x] ?? 0;
  for (const oldB of old.buildings) {
    const kind = oldB.kind;
    let x = oldB.x + 12,
      y = oldB.y + 12;
    let found = false;
    for (let radius = 0; radius < 25 && !found; radius++)
      for (let dy = -radius; dy <= radius && !found; dy++)
        for (let dx = -radius; dx <= radius && !found; dx++) {
          if (radius && Math.max(Math.abs(dx), Math.abs(dy)) !== radius)
            continue;
          if (!placementError(s, kind, x + dx, y + dy, undefined, true)) {
            x += dx;
            y += dy;
            found = true;
          }
        }
    if (!found) throw new BeeRuleError("Не удалось перенести площадку");
    const b = makeBuilding(s, kind, x, y, now, oldB.level);
    b.id = oldB.id;
    b.enabled = oldB.enabled;
    b.priority = oldB.priority;
    b.readyAt = Math.max(now, oldB.readyAt);
    b.startedAt = oldB.startedAt;
    if (oldB.pendingLevel) b.pendingLevel = oldB.pendingLevel;
    for (const t of footprint(b)) s.forest[t] = 0;
  }
  s.nextId = Math.max(...s.buildings.map((b) => b.id)) + 1;
  for (const r of ["honey", "wood", "wax"] as const) putBank(s, r, old[r]);
  for (let i = 0; i < old.bees; i++) {
    const role: Role =
      i % 6 === 0 || i % 6 === 1
        ? "forager"
        : i % 6 === 2 || i % 6 === 3
          ? "carrier"
          : i % 6 === 4
            ? "engineer"
            : "forester";
    s.units.push({ id: s.nextBeeId++, role, job: null });
  }
  if (old.clearing) {
    const x = (old.clearing.tile % 18) + 12,
      y = Math.floor(old.clearing.tile / 18) + 12;
    if (terrain(x, y) === "grass" && !occupied(s, index(x, y)))
      s.clearing = { ...old.clearing, tile: index(x, y) };
    else if (!old.clearing.plant)
      putBank(s, "wood", (25 * (old.forest[old.clearing.tile] ?? 0)) / 100);
    else putBank(s, "honey", 8);
  }
  // The retired doctrine has no v3 equivalent: return its paid research cost.
  if (old.research || old.doctrine !== "none") {
    putBank(s, "honey", 150);
    putBank(s, "wax", 30);
  }
  if (old.brood)
    s.brood = { ...old.brood, role: "forager", building: headquarters(s).id };
  const home = headquarters(s);
  for (const b of s.buildings.filter(
    (b) => b.id !== home.id && b.kind !== "meadow",
  ))
    if (distance(home, b) <= 12) {
      s.links.push({
        id: s.nextId++,
        from: home.id,
        to: b.id,
        kind: "flight",
        filter: "auto",
        path: [],
      });
      if (!bank(b))
        s.links.push({
          id: s.nextId++,
          from: b.id,
          to: home.id,
          kind: "flight",
          filter: "auto",
          path: [],
        });
    }
  return syncStocks(s);
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
      const dt = Math.max(0, (now - s.lastSeenAt) / 1000);
      if (dt <= 20) s.activeSeconds = Math.min(86400, s.activeSeconds + dt);
      s.lastSeenAt = Math.max(now, s.lastSeenAt);
      break;
    }
    case "breed":
    case "train": {
      if (s.brood) throw new BeeRuleError("Расплод уже растёт");
      const first = s.units.length === 0,
        role = action.type === "train" ? action.role : "forager",
        b =
          action.type === "train" ? getBuilding(s, action.id) : headquarters(s);
      if (!first && (b.kind !== "nursery" || !complete(b, now) || !b.enabled))
        throw new BeeRuleError("Нужен работающий расплодник");
      if (first && action.type !== "breed")
        throw new BeeRuleError(
          "Сначала вырастите трёх собирателей в маточном улье",
        );
      const count = first ? 3 : 1;
      if (s.bees + count > capacities(s, now).bees)
        throw new BeeRuleError("Не хватает мест в ульях");
      debit(s, first ? {} : ROLES[role].cost);
      s.brood = {
        role,
        count,
        building: b.id,
        startedAt: now,
        readyAt: now + (first ? 15 : ROLES[role].seconds) * 1000,
      };
      break;
    }
    case "retrain": {
      if (
        !s.buildings.some(
          (b) => b.kind === "nursery" && b.enabled && complete(b, now),
        )
      )
        throw new BeeRuleError("Нужен расплодник");
      if (s.brood) throw new BeeRuleError("Питомник занят");
      const bee = s.units.find((u) => u.id === action.bee);
      if (!bee || bee.job) throw new BeeRuleError("Пчела занята перевозкой");
      if (bee.role === action.role) throw new BeeRuleError("Уже обучена");
      debit(s, { honey: 8 });
      s.units = s.units.filter((u) => u.id !== bee.id);
      s.brood = {
        role: action.role,
        count: 1,
        building: s.buildings.find((b) => b.kind === "nursery")!.id,
        startedAt: now,
        readyAt: now + 60000,
      };
      break;
    }
    case "build": {
      const d = BUILDINGS[action.kind];
      if (d.tier > s.era)
        throw new BeeRuleError(`Нужна эпоха ${TECH[d.tier - 1]!.name}`);
      if (s.buildings.length >= 80) throw new BeeRuleError("Лимит построек");
      freeBuilder(s, now);
      const e = placementError(s, action.kind, action.x, action.y);
      if (e) throw new BeeRuleError(e);
      debit(s, d.cost);
      const b = makeBuilding(s, action.kind, action.x, action.y, now);
      b.readyAt = now + d.seconds * 1000;
      break;
    }
    case "move":
    case "demolish": {
      const b = getBuilding(s, action.id);
      if (b.kind === "wild" || !complete(b, now))
        throw new BeeRuleError("Постройка недоступна");
      if (
        s.jobs.some((j) => j.from === b.id || j.to === b.id) ||
        s.brood?.building === b.id
      )
        throw new BeeRuleError(
          "Сначала остановите постройку и дождитесь грузов",
        );
      if (action.type === "move") {
        freeBuilder(s, now);
        const e = placementError(s, b.kind, action.x, action.y, b.id);
        if (e) throw new BeeRuleError(e);
        b.x = action.x;
        b.y = action.y;
        b.startedAt = now;
        b.readyAt = now + 15000;
      } else {
        if (RESOURCES.some((r) => b.stock[r] > 0))
          throw new BeeRuleError("Сначала вывезите ресурсы");
        const remaining = {
          ...s,
          buildings: s.buildings.filter((a) => a.id !== b.id),
        };
        if (capacities(remaining, now).bees < s.bees + (s.brood?.count ?? 0))
          throw new BeeRuleError("Не хватает жилья");
        s.buildings = remaining.buildings;
        for (const [r, n] of Object.entries(BUILDINGS[b.kind].cost))
          putBank(s, r as Resource, Math.floor(n * 0.5));
      }
      s.links = s.links.filter((l) => l.from !== b.id && l.to !== b.id);
      break;
    }
    case "upgrade": {
      const b = getBuilding(s, action.id);
      freeBuilder(s, now);
      if (!complete(b, now)) throw new BeeRuleError("Строится");
      const e = upgradeRequirement(s, b);
      if (e) throw new BeeRuleError(e);
      debit(s, costForUpgrade(b));
      b.pendingLevel = b.level + 1;
      b.startedAt = now;
      b.readyAt = now + 120 * b.level * 1000;
      break;
    }
    case "toggle": {
      const b = getBuilding(s, action.id);
      b.enabled = !b.enabled;
      break;
    }
    case "priority": {
      const b = getBuilding(s, action.id);
      b.priority = Math.min(
        99999,
        Math.max(...s.buildings.map((b) => b.priority)) + 1,
      );
      break;
    }
    case "recipe": {
      const b = getBuilding(s, action.id);
      if (b.kind !== "workshop") throw new BeeRuleError("Рецепт недоступен");
      b.recipe = action.recipe;
      b.progress = 0;
      break;
    }
    case "link": {
      if (s.links.length >= 200) throw new BeeRuleError("Лимит соединений");
      if (
        s.links.some(
          (l) =>
            l.from === action.from &&
            l.to === action.to &&
            l.kind === action.kind &&
            l.filter === action.filter,
        )
      )
        throw new BeeRuleError("Соединение уже есть");
      const required = { flight: 1, belt: 2, shaft: 2, pipe: 3, wire: 4 }[
        action.kind
      ];
      if (s.era < required)
        throw new BeeRuleError(`Нужна эпоха ${TECH[required - 1]!.name}`);
      const path = routePath(
        s,
        action.from,
        action.to,
        action.kind,
        action.via,
      );
      const cost: Cost =
        action.kind === "flight"
          ? {}
          : action.kind === "wire"
            ? { copper: Math.max(1, path.length - 2) }
            : action.kind === "pipe"
              ? { copper: Math.ceil(path.length / 3) }
              : action.kind === "shaft"
                ? { wood: Math.max(1, path.length - 2), gears: 1 }
                : { wood: Math.max(1, path.length - 2), wax: 2 };
      debit(s, cost);
      s.links.push({
        id: s.nextId++,
        from: action.from,
        to: action.to,
        kind: action.kind,
        filter: action.filter,
        path,
      });
      break;
    }
    case "unlink":
      s.links = s.links.filter((l) => l.id !== action.id);
      break;
    case "disconnect":
      s.links = s.links.filter(
        (l) => l.from !== action.id && l.to !== action.id,
      );
      break;
    case "chop":
    case "plant": {
      const { x, y } = action,
        t = index(x, y);
      if (
        !discovered(s, x, y) ||
        terrain(x, y, s.seed) !== "grass" ||
        occupied(s, t) ||
        s.links.some((l) => l.kind !== "flight" && l.path.includes(t))
      )
        throw new BeeRuleError("Участок недоступен");
      freeBuilder(s, now);
      if (s.clearing) throw new BeeRuleError("Дождитесь завершения расчистки");
      if (action.type === "chop" && s.forest[t]! <= 0)
        throw new BeeRuleError("Здесь нет дерева");
      if (action.type === "plant") {
        if (s.forest[t]! > 0) throw new BeeRuleError("Здесь уже дерево");
        debit(s, { honey: 8 });
      }
      if (
        action.type === "chop" &&
        s.jobs.some((j) => j.harvest?.tile === t && !j.harvest.picked)
      )
        throw new BeeRuleError("Лесник уже рубит это дерево");
      s.clearing = {
        tile: t,
        plant: action.type === "plant",
        startedAt: now,
        readyAt: now + (action.type === "plant" ? 30 : 10) * 1000,
      };
      if (action.type === "chop") {
        const reserved = production(s)
          .filter(
            (p) =>
              p.workers &&
              s.buildings.find((b) => b.id === p.id)?.kind === "sanctuary",
          )
          .reduce((n, p) => n + p.workers, 0);
        const bee = s.units.filter((u) => u.role === "forester" && !u.job)[
          reserved
        ];
        const home = center(headquarters(s)),
          from = bee?.at ?? home;
        const arriveAt =
          now + Math.max(1000, Math.hypot(x - from.x, y - from.y) * 1200);
        s.clearing = {
          ...s.clearing,
          bee: bee?.id,
          from,
          arriveAt,
          pickupAt: arriveAt + 10000,
          readyAt:
            arriveAt +
            10000 +
            Math.max(1000, Math.hypot(x - home.x, y - home.y) * 1200),
          amount: (25 * s.forest[t]!) / 100,
        };
        if (bee) bee.job = -1;
      }
      break;
    }
    case "expand": {
      if (
        !Number.isInteger(action.x) ||
        !Number.isInteger(action.y) ||
        action.x < 0 ||
        action.y < 0 ||
        action.x >= MAP_SIZE ||
        action.y >= MAP_SIZE
      )
        throw new BeeRuleError("За границей леса");
      const n = sector(action.x, action.y);
      if (n < 0 || n >= 49 || s.unlocked.includes(n))
        throw new BeeRuleError("Этот сектор уже открыт");
      if (
        ![n - 1, n + 1, n - 7, n + 7].some(
          (k) =>
            s.unlocked.includes(k) &&
            Math.abs((k % 7) - (n % 7)) +
              Math.abs(Math.floor(k / 7) - Math.floor(n / 7)) ===
              1,
        )
      )
        throw new BeeRuleError("Начните с соседнего сектора");
      if (s.unlocked.length >= 9 + s.era * 4)
        throw new BeeRuleError("Для расширения нужна следующая эпоха");
      const nExtra = s.unlocked.length - 9;
      debit(s, { honey: 80 + 60 * nExtra, wood: 40 + 15 * nExtra });
      s.unlocked.push(n);
      break;
    }
    case "research": {
      const e = researchRequirement(s, now);
      if (e) throw new BeeRuleError(e);
      const tech = TECH[s.era]!;
      debit(s, tech.cost);
      s.research = {
        era: s.era + 1,
        startedAt: now,
        readyAt: now + tech.seconds * 1000,
      };
      break;
    }
    case "order": {
      const market = s.buildings.find(
        (b) =>
          b.kind === "market" &&
          b.enabled &&
          complete(b, now) &&
          b.stock.honey >= ORDER_HONEY,
      );
      if (!market)
        throw new BeeRuleError("Доставьте 120 мёда в экспедиционные соты");
      if (s.earnedToday + ORDER_CENTS > dailyCap)
        throw new BeeRuleError("Дневной лимит достигнут");
      if (
        s.activeSeconds < (s.ordersToday + 1) * ORDER_SECONDS ||
        now - s.lastOrderAt < ORDER_SECONDS * 1000
      )
        throw new BeeRuleError("Заказ ещё готовится");
      market.stock.honey -= ORDER_HONEY;
      s.earnedToday += ORDER_CENTS;
      s.earnedTotal += ORDER_CENTS;
      s.ordersToday++;
      s.lastOrderAt = now;
      payout = ORDER_CENTS;
      break;
    }
  }
  return { state: syncStocks(s), payout };
}
