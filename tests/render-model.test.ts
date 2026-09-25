import { test } from "node:test";
import assert from "node:assert/strict";
import {
  point,
  cell,
  sample,
  buildingLoadState,
} from "../src/app/bee/phaser/model";
import { act, advance, initialState } from "../src/game/bee-game";
test("isometric picking round-trips every tile and flight reaches pickup and delivery", () => {
  for (let x = 0; x < 42; x++)
    for (let y = 0; y < 42; y++) {
      const p = point(x, y);
      assert.deepEqual(cell(p.x, p.y), { x, y });
    }
  const at = Date.UTC(2026, 8, 24),
    state = advance(
      act(initialState(at), { type: "breed" }, at).state,
      at + 18000,
    ),
    job = state.jobs[0]!;
  assert.deepEqual(sample(job, job.startedAt), job.path[0]);
  assert.deepEqual(sample(job, job.pickupAt), job.path[1]);
  assert.deepEqual(sample(job, job.readyAt), job.path.at(-1));
  assert.deepEqual(sample(job, job.readyAt + 10000), job.path.at(-1));
});

test("building load state distinguishes empty, operating and full buffers", () => {
  const building = initialState(Date.UTC(2026, 8, 24)).buildings[0]!;
  assert.equal(buildingLoadState(building), "empty");
  building.stock.honey = 1;
  assert.equal(buildingLoadState(building), "normal");
  assert.equal(buildingLoadState(building, "Нет сырья"), "empty");
  building.stock.honey = 800;
  assert.equal(buildingLoadState(building), "full");
});
