import assert from "node:assert/strict";
import { test } from "node:test";
import {
  act,
  initialState,
  capacity,
  advance,
  capacities,
  builders,
  tier,
  production,
  networks,
  emptyStock,
  syncStocks,
  routePath,
  RESOURCES,
  discovered,
  terrain,
  MAP_SIZE,
  TECH,
  type Role,
  type LinkKind,
  placementError,
  migrateState,
  index,
  type BeeState,
  type BuildingKind,
  type Building,
  ORDER_SECONDS,
} from "../src/game/bee-game";

const noon = Date.parse("2026-09-24T12:00:00Z");
function add(
  s: BeeState,
  kind: BuildingKind,
  x: number,
  y: number,
  level = 1,
): Building {
  const b: Building = {
    id: s.nextId++,
    kind,
    x,
    y,
    level,
    readyAt: s.lastTickAt,
    startedAt: s.lastTickAt,
    enabled: true,
    priority: 0,
    stock: emptyStock(),
    progress: 0,
  };
  s.buildings.push(b);
  return b;
}
function unit(s: BeeState, role: Role) {
  s.units.push({ id: s.nextBeeId++, role, job: null });
  syncStocks(s);
}
function link(
  s: BeeState,
  a: Building,
  b: Building,
  kind: LinkKind,
  filter: "auto" | "wood" = "auto",
) {
  s.links.push({
    id: s.nextId++,
    from: a.id,
    to: b.id,
    kind,
    filter,
    path: kind === "flight" ? [] : routePath(s, a.id, b.id, kind),
  });
}
function funded(era = 1) {
  const s = initialState(noon);
  s.era = era;
  s.forest.fill(0);
  for (const r of RESOURCES) s.buildings[0]!.stock[r] = 10000;
  return syncStocks(s);
}
function total(s: BeeState, r: (typeof RESOURCES)[number]) {
  return (
    s.buildings.reduce((n, b) => n + b.stock[r], 0) +
    s.jobs.filter((j) => j.resource === r).reduce((n, j) => n + j.amount, 0)
  );
}

test("free start grows three real foragers; honey needs a completed delivery", () => {
  assert.throws(
    () =>
      act(initialState(noon), { type: "train", id: 1, role: "engineer" }, noon),
    /Сначала/,
  );
  let s = act(initialState(noon), { type: "breed" }, noon).state;
  assert.throws(() => act(s, { type: "breed" }, noon));
  assert.equal(advance(s, noon + 14999).bees, 0);
  s = advance(s, noon + 15000);
  assert.equal(s.bees, 3);
  assert.equal(s.honey, 0);
  s = advance(s, noon + 18000);
  assert.equal(s.jobs.length, 3);
  assert.equal(s.honey, 0);
  assert.ok(
    s.jobs.every(
      (j) =>
        j.role === "forager" && j.path.length === 3 && j.pickupAt > j.startedAt,
    ),
  );
  s = advance(s, noon + 180000);
  assert.ok(s.honey > 5);
  assert.ok(s.honey < 24);
  assert.throws(() => act(s, { type: "breed" }, noon + 180000), /расплодник/);
});

test("local inventories: disconnected buildings cannot draw global stock; one carrier reserves one cargo", () => {
  let s = funded();
  const home = s.buildings[0]!;
  home.stock.nectar = 0;
  const press = add(s, "press", 24, 21);
  unit(s, "engineer");
  s = advance(s, noon + 60000);
  assert.equal(s.buildings.find((b) => b.id === press.id)!.stock.wax, 0);
  // No carrier: a free flight route alone cannot move anything.
  link(
    s,
    s.buildings[0]!,
    s.buildings.find((b) => b.id === press.id)!,
    "flight",
  );
  s = advance(s, noon + 120000);
  assert.equal(s.jobs.length, 0);
  unit(s, "carrier");
  const h = total(s, "honey");
  s = advance(s, noon + 122000);
  assert.equal(s.jobs.length, 1);
  assert.equal(s.jobs[0]!.amount, 4);
  assert.equal(total(s, "honey"), h);
  assert.equal(s.buildings.find((b) => b.id === press.id)!.stock.honey, 0);
  s = advance(s, noon + 180000);
  assert.ok(s.buildings.find((b) => b.id === press.id)!.stock.wax > 0);
  assert.equal(s.wax, 10000); // Product remains at the press until exported.
  assert.ok(s.jobs.filter((j) => j.bee !== null).length <= 1);
  for (const b of s.buildings)
    for (const r of RESOURCES) assert.ok(b.stock[r] >= 0);
});

test("powered transport conserves cargo, shafts overload, electricity requires a separate wire network", () => {
  let s = funded(4);
  const home = s.buildings[0]!;
  home.stock.nectar = 0;
  const depot = add(s, "depot", 24, 21),
    wheel = add(s, "waterwheel", 18, 21);
  link(s, home, depot, "belt", "wood");
  s = advance(s, noon + 10000);
  assert.equal(s.buildings.find((b) => b.id === depot.id)!.stock.wood, 0);
  link(
    s,
    s.buildings.find((b) => b.id === wheel.id)!,
    s.buildings[0]!,
    "shaft",
  );
  const before = total(s, "wood");
  s = advance(s, noon + 30000);
  assert.ok(s.buildings.find((b) => b.id === depot.id)!.stock.wood > 0);
  assert.equal(total(s, "wood"), before);
  const saw = add(s, "sawmill", 21, 24, 4);
  saw.stock.wood = 20;
  unit(s, "engineer");
  link(s, s.buildings[0]!, saw, "shaft");
  assert.equal(
    networks(s).mechanical.find((n) => n.ids.includes(saw.id))!.ratio,
    0,
  );
  assert.equal(
    production(s).find((p) => p.id === saw.id)!.reason,
    "Перегрузка валов",
  );
  saw.enabled = false;
  const dynamo = add(s, "dynamo", 18, 24),
    centrifuge = add(s, "centrifuge", 24, 24);
  centrifuge.stock.nectar = 20;
  link(s, s.buildings[0]!, dynamo, "shaft");
  assert.equal(
    production(s).find((p) => p.id === centrifuge.id)!.reason,
    "Нет электричества",
  );
  link(s, dynamo, centrifuge, "wire");
  assert.equal(
    production(s).find((p) => p.id === centrifuge.id)!.running,
    true,
  );
  s = advance(s, noon + 40000);
  assert.ok(s.buildings.find((b) => b.id === centrifuge.id)!.stock.honey > 0);
});

test("specialist shortages and priority stop production; output buffer stops input consumption", () => {
  let s = funded();
  s.buildings[0]!.stock.nectar = 0;
  const press = add(s, "press", 24, 21),
    shop = add(s, "workshop", 21, 24);
  press.stock.honey = 30;
  shop.stock.wood = 20;
  unit(s, "engineer");
  assert.equal(production(s).find((p) => p.id === shop.id)!.workers, 0);
  s = act(s, { type: "priority", id: shop.id }, noon).state;
  assert.equal(production(s).find((p) => p.id === shop.id)!.workers, 1);
  const actual = s.buildings.find((b) => b.id === shop.id)!;
  actual.stock.planks = 40;
  const wood = actual.stock.wood;
  s = advance(s, noon + 60000);
  assert.equal(s.buildings.find((b) => b.id === shop.id)!.stock.wood, wood);
});

test("spacing, forest, shore, routing and fog prevent invalid construction; expansions are adjacent and bounded", () => {
  let s = funded(2);
  assert.match(placementError(s, "hive", 23, 21)!, /одну клетку/);
  assert.equal(placementError(s, "hive", 24, 21), null);
  assert.match(placementError(s, "hive", 3, 3)!, /сектор/);
  assert.match(placementError(s, "waterwheel", 24, 21)!, /берега/);
  assert.equal(placementError(s, "waterwheel", 15, 21), null);
  s.forest[index(24, 21)] = 100;
  assert.match(placementError(s, "hive", 24, 21)!, /деревья/);
  s.forest[index(24, 21)] = 0;
  const a = add(s, "relay", 24, 21),
    b = add(s, "relay", 27, 21);
  const path = routePath(s, a.id, b.id, "belt", [index(25, 23)]);
  assert.ok(path.includes(index(25, 23)));
  assert.throws(() => routePath(s, a.id, b.id, "belt", [index(0, 0)]));
  assert.throws(() => act(s, { type: "expand", x: 0, y: 0 }, noon));
  assert.throws(() => act(s, { type: "expand", x: -1, y: 18 }, noon));
  s = act(s, { type: "expand", x: 6, y: 18 }, noon).state;
  assert.equal(discovered(s, 6, 18), true);
});

test("training, construction and era research resolve on server time; days gate the later machinery", () => {
  let s = funded();
  const nursery = add(s, "nursery", 24, 21);
  add(s, "workshop", 21, 24);
  unit(s, "forager");
  s = act(s, { type: "train", id: nursery.id, role: "carrier" }, noon).state;
  assert.equal(s.bees, 1);
  s = advance(s, noon + 90000);
  assert.equal(s.units.filter((u) => u.role === "carrier").length, 1);
  assert.throws(
    () => act(s, { type: "research" }, noon + 90000),
    /исследования/,
  );
  s = act(s, { type: "research" }, noon + TECH[1]!.age * 1000).state;
  assert.equal(s.era, 1);
  s = advance(s, noon + (TECH[1]!.age + TECH[1]!.seconds) * 1000);
  assert.equal(s.era, 2);
  assert.throws(
    () => act(s, { type: "build", kind: "mine", x: 27, y: 27 }, s.lastTickAt),
    /эпоха/,
  );
  assert.equal(TECH[2]!.age, 30 * 3600);
  assert.equal(TECH[3]!.age, 72 * 3600);
  s.era = 3;
  s.forest[index(18, 18)] = 100;
  s.forest[index(18, 19)] = 100;
  s = act(s, { type: "chop", x: 18, y: 18 }, s.lastTickAt).state;
  assert.throws(
    () => act(s, { type: "chop", x: 18, y: 19 }, s.lastTickAt),
    /расчистки/,
  );
});

test("offline cap is deterministic and cannot be accelerated by request frequency", () => {
  let s = act(initialState(noon), { type: "breed" }, noon).state;
  const frozen = JSON.stringify(s);
  const direct = advance(s, noon + 180000);
  for (let t = 500; t <= 180000; t += 500) s = advance(s, noon + t);
  assert.equal(s.honey, direct.honey);
  assert.equal(s.totalHoney, direct.totalHoney);
  assert.deepEqual(s.jobs, direct.jobs);
  assert.equal(
    JSON.stringify(act(initialState(noon), { type: "breed" }, noon).state),
    frozen,
  );
  const offline = advance(s, noon + 86400000);
  assert.equal(offline.activeSeconds, 0);
  assert.ok(offline.honey <= capacity(offline));
  const h = act(s, { type: "heartbeat" }, noon + 181000).state;
  const again = act(h, { type: "heartbeat" }, noon + 181000).state;
  assert.equal(h.activeSeconds, again.activeSeconds);
});

test("v1 and v2 saves migrate without losing buildings, level, bees, stocks or payout counters", async () => {
  const { initialState: oldInitial } = await import("../src/game/bee-legacy");
  const old = oldInitial(noon);
  old.honey = 1800;
  old.wood = 600;
  old.wax = 90;
  old.bees = 19;
  old.earnedTotal = 125;
  old.earnedToday = 25;
  old.ordersToday = 1;
  old.totalHoney = 2222;
  old.buildings[0]!.level = 3;
  old.buildings.push({
    ...old.buildings[0]!,
    id: 2,
    kind: "hive",
    x: 10,
    y: 9,
    level: 2,
  });
  const saved = JSON.stringify(old),
    s = migrateState(old, noon);
  assert.equal(s.version, 3);
  assert.equal(s.honey, 1800);
  assert.equal(s.wood, 600);
  assert.equal(s.wax, 90);
  assert.equal(s.bees, 19);
  assert.equal(s.earnedTotal, 125);
  assert.equal(s.earnedToday, 25);
  assert.equal(s.totalHoney, 2222);
  assert.equal(s.buildings.length, 2);
  assert.equal(s.buildings.find((b) => b.id === 2)!.level, 2);
  assert.equal(s.era, 2);
  for (const b of s.buildings)
    assert.equal(placementError(s, b.kind, b.x, b.y, b.id), null);
  assert.equal(JSON.stringify(old), saved);
  const v1 = migrateState(
    { version: 1, honey: 800, bees: 8, totalHoney: 1200, earnedTotal: 50 },
    noon,
  );
  assert.equal(v1.honey, 800);
  assert.equal(v1.bees, 8);
  assert.equal(v1.earnedTotal, 50);
});

test("finite extraction respects fog; restoration consumes delivered water and honey", () => {
  let s = funded(2);
  s.buildings[0]!.stock.nectar = 0;
  const wheel = add(s, "waterwheel", 24, 25),
    pump = add(s, "pump", 27, 25);
  pump.stock.water = 10;
  unit(s, "engineer");
  link(s, wheel, pump, "shaft");
  const hidden = index(30, 25),
    visible = index(29, 25);
  s.forest[hidden] = 100;
  s.forest[visible] = 12;
  s = advance(s, noon + 60000);
  assert.equal(s.forest[hidden], 100);
  assert.equal(s.forest[visible], 0);
  assert.equal(s.buildings.find((b) => b.id === pump.id)!.stock.nectar, 12);
  assert.equal(
    production(s).find((p) => p.id === pump.id)!.reason,
    "Лес исчерпан",
  );
  const sanctuary = add(s, "sanctuary", 24, 28);
  sanctuary.stock.water = 10;
  sanctuary.stock.honey = 5;
  unit(s, "forester");
  const before = s.forest.reduce((a, b) => a + b, 0);
  s = advance(s, noon + 80000);
  assert.ok(s.forest.reduce((a, b) => a + b, 0) > before);
  assert.ok(s.buildings.find((b) => b.id === sanctuary.id)!.stock.water < 10);
});

test("orders debit delivered market honey; cap and UTC reset retain total earnings and cooldown", () => {
  let s = initialState(noon);
  const market = add(s, "market", 24, 21);
  market.stock.honey = 5000;
  s.activeSeconds = 4000;
  for (let i = 0; i < 12; i++)
    s = act(s, { type: "order" }, noon + i * ORDER_SECONDS * 1000).state;
  assert.equal(s.earnedToday, 300);
  assert.equal(s.earnedTotal, 300);
  assert.throws(
    () => act(s, { type: "order" }, noon + 12 * ORDER_SECONDS * 1000),
    /лимит/,
  );
  s = advance(s, noon + 86400000);
  assert.equal(s.earnedToday, 0);
  assert.equal(s.activeSeconds, 0);
  assert.equal(s.earnedTotal, 300);
  s.activeSeconds = 4000;
  s.lastOrderAt = noon + 86400000 - 10000;
  assert.throws(() => act(s, { type: "order" }, noon + 86400000), /готовится/);
});

test("manual clearing cannot bypass warehouse capacity", () => {
  let s = initialState(noon);
  s.buildings[0]!.stock.wood = 295;
  s.forest[index(18, 18)] = 100;
  s = act(s, { type: "chop", x: 18, y: 18 }, noon).state;
  s = advance(s, s.clearing!.readyAt);
  assert.equal(s.wood, 300);
  assert.equal(s.forest[index(18, 18)], 0);
});

test("seeded valleys differ, always have a connected river, a starter shore, timber and nectar", () => {
  const maps = new Set<string>();
  for (let seed = 1; seed <= 64; seed++) {
    const s = initialState(noon, seed);
    assert.deepEqual(s, initialState(noon, seed));
    const water: number[] = [];
    let shore = false,
      wood = 0;
    for (let y = 0; y < MAP_SIZE; y++)
      for (let x = 0; x < MAP_SIZE; x++) {
        if (terrain(x, y, seed) === "water") water.push(index(x, y));
        if (discovered(s, x, y)) {
          wood += s.forest[index(x, y)]!;
          if (!placementError(s, "waterwheel", x, y, undefined, true))
            shore = true;
        }
      }
    const seen = new Set([water[0]!]),
      queue = [water[0]!],
      wet = new Set(water);
    for (let i = 0; i < queue.length; i++) {
      const t = queue[i]!;
      for (const next of [t - 1, t + 1, t - MAP_SIZE, t + MAP_SIZE])
        if (wet.has(next) && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
    }
    assert.equal(seen.size, water.length);
    assert.ok(shore, `seed ${seed}: no shore`);
    assert.ok(wood >= 500);
    assert.equal(terrain(21, 21, seed), "grass");
    assert.equal(placementError(s, "wild", 21, 21, 1), null);
    maps.add(JSON.stringify(water) + JSON.stringify(s.forest));
    const started = act(s, { type: "breed" }, noon).state;
    assert.ok(
      advance(started, noon + 180000).honey > 0,
      `seed ${seed}: no nectar`,
    );
  }
  assert.equal(maps.size, 64);
  const old = initialState(noon);
  assert.equal(terrain(13, 21, old.seed), "water");
  assert.equal(old.seed, 0);
});

test("forester reserves a tree, chops only on arrival and delivers only on return", () => {
  let s = funded();
  s.buildings[0]!.enabled = false;
  const station = add(s, "logging", 24, 21);
  const tile = index(25, 20);
  s.forest[tile] = 100;
  unit(s, "forester");
  s = advance(s, noon + 2000);
  const job = s.jobs.find((j) => j.role === "forester")!;
  assert.ok(job.harvest);
  assert.equal(s.forest[tile], 100);
  assert.equal(station.stock.wood, 0);
  assert.throws(
    () => act(s, { type: "chop", x: 25, y: 20 }, noon + 2000),
    /уже рубит/,
  );
  s = advance(s, job.pickupAt);
  assert.equal(s.forest[tile], 88);
  assert.equal(s.buildings.find((b) => b.id === station.id)!.stock.wood, 0);
  s = advance(s, job.readyAt);
  assert.equal(s.buildings.find((b) => b.id === station.id)!.stock.wood, 3);
});

test("manual clearing flies, harvests, returns cargo and releases its forester", () => {
  let s = initialState(noon);
  unit(s, "forester");
  const tile = index(18, 18);
  s.forest[tile] = 100;
  s = act(s, { type: "chop", x: 18, y: 18 }, noon).state;
  const job = { ...s.clearing! };
  assert.ok(job.arriveAt! > noon);
  assert.equal(s.units[0]!.job, -1);
  s = advance(s, job.pickupAt! - 1);
  assert.equal(s.forest[tile], 100);
  assert.equal(s.wood, 0);
  s = advance(s, job.pickupAt!);
  assert.equal(s.forest[tile], 0);
  assert.equal(s.wood, 0);
  s = advance(s, job.readyAt);
  assert.equal(s.wood, 25);
  assert.equal(s.clearing, null);
  assert.equal(s.units[0]!.job, null);
});
