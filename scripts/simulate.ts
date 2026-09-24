/** Deterministic new-player pacing check. No stock grants or state edits. */
import {
  act,
  advance,
  initialState,
  BUILDINGS,
  placementError,
  discovered,
  occupied,
  index,
  MAP_SIZE,
  RESOURCES,
  TECH,
  type BeeAction,
  type Cost,
  type BuildingKind,
  type Role,
} from "../src/game/bee-game";
const start = Date.parse("2026-09-24T12:00:00Z");
let now = start,
  s = initialState(start);
const timeline: object[] = [];
function wait(seconds: number) {
  now += seconds * 1000;
  s = advance(s, now);
  if (now - start > 40 * 3600000) throw Error("Progression stalled");
}
function action(a: BeeAction) {
  s = act(s, a, now).state;
}
function mark(event: string) {
  timeline.push({
    minute: Math.round((now - start) / 60000),
    event,
    bees: s.bees,
    honey: Math.floor(s.honey),
    wood: Math.floor(s.wood),
    wax: Math.floor(s.wax),
    planks: Math.floor(s.planks),
    gears: Math.floor(s.gears),
  });
}
function chop() {
  const t = s.forest.findIndex(
    (n, t) =>
      n > 0 &&
      discovered(s, t % MAP_SIZE, Math.floor(t / MAP_SIZE)) &&
      !occupied(s, t),
  );
  if (t < 0) throw Error("No timber");
  action({ type: "chop", x: t % MAP_SIZE, y: Math.floor(t / MAP_SIZE) });
  wait(Math.ceil((s.clearing!.readyAt - now) / 1000));
}
function afford(cost: Cost) {
  let tries = 0;
  while (RESOURCES.some((r) => s[r] < (cost[r] ?? 0))) {
    if (++tries > 10000) throw Error(`Cannot afford ${JSON.stringify(cost)}`);
    if (s.wood < (cost.wood ?? 0)) chop();
    else wait(10);
  }
}
function build(kind: Exclude<BuildingKind, "wild">) {
  afford(BUILDINGS[kind].cost);
  let spot: { x: number; y: number } | undefined;
  for (let r = 0; r < 9 && !spot; r++)
    for (let y = 21 - r; y <= 21 + r && !spot; y++)
      for (let x = 21 - r; x <= 21 + r && !spot; x++)
        if (!placementError(s, kind, x, y)) spot = { x, y };
  if (!spot) throw Error(`No slot: ${kind}`);
  action({ type: "build", kind, ...spot });
  wait(BUILDINGS[kind].seconds);
  const b = s.buildings.at(-1)!;
  mark(kind);
  return b.id;
}
function train(id: number, role: Role) {
  afford({
    honey: role === "engineer" ? 30 : role === "carrier" ? 18 : 12,
    wood: role === "engineer" ? 5 : 0,
  });
  action({ type: "train", id, role });
  wait(role === "engineer" ? 150 : role === "carrier" ? 90 : 60);
  mark(role);
}
function flight(
  from: number,
  to: number,
  filter: "auto" | "wood" | "honey" | "wax" | "planks" | "gears" = "auto",
) {
  action({ type: "link", from, to, kind: "flight", filter });
}
action({ type: "breed" });
wait(15);
mark("first 3 bees");
const nursery = build("nursery");
train(nursery, "carrier");
train(nursery, "engineer");
train(nursery, "carrier");
train(nursery, "engineer");
const meadow = build("meadow");
const hive = build("hive");
flight(hive, 1, "honey");
train(nursery, "forager");
train(nursery, "forager");
const press = build("press");
flight(1, press, "honey");
flight(press, 1, "wax");
const workshop = build("workshop");
flight(1, workshop, "wood");
flight(workshop, 1, "planks");
afford({ wood: 300, wax: 65, planks: 70 });
action({ type: "toggle", id: press });
action({ type: "recipe", id: workshop, recipe: "gears" });
flight(1, workshop, "planks");
flight(1, workshop, "wax");
flight(workshop, 1, "gears");
afford({ gears: 12 });
mark("first gears");
action({ type: "toggle", id: workshop });
afford(TECH[1]!.cost);
mark("mechanics resources ready");
if (now < start + TECH[1]!.age * 1000)
  wait((start + TECH[1]!.age * 1000 - now) / 1000);
action({ type: "research" });
wait(TECH[1]!.seconds);
mark("mechanical era");
console.table(timeline);
console.log(
  JSON.stringify({
    timeline,
    earliestSteamHours: (TECH[2]!.age + TECH[2]!.seconds) / 3600,
    earliestElectricHours: (TECH[3]!.age + TECH[3]!.seconds) / 3600,
  }),
);
