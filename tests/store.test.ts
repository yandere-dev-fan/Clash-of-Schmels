import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { LocalStore } from "../src/server/store";

test("local API store persists colonies and serializes idempotent actions across restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "schmels-"));
  try {
    const a = new LocalStore(dir),
      first = await a.run(undefined, undefined),
      key = randomUUID();
    assert.ok(first.view.state.seed);
    assert.equal(first.view.state.bees, 0);
    const [x, y] = await Promise.all([
      a.run(first.id, { type: "breed", requestKey: key }),
      a.run(first.id, { type: "breed", requestKey: key }),
    ]);
    assert.deepEqual(x, y);
    assert.ok(x.view.state.brood);
    const restarted = new LocalStore(dir),
      saved = await restarted.run(first.id, undefined);
    assert.equal(saved.id, first.id);
    assert.equal(saved.view.state.seed, first.view.state.seed);
    assert.deepEqual(
      (await restarted.run(first.id, { type: "breed", requestKey: key })).view,
      x.view,
    );
    await assert.rejects(
      restarted.run(first.id, { type: "chop", x: 0, y: 0, requestKey: key }),
      /Ключ/,
    );
    await assert.rejects(
      restarted.run(first.id, { type: "order", requestKey: randomUUID() }),
      /Bitter/,
    );
    await assert.rejects(
      restarted.run(first.id, {
        type: "build",
        kind: "hive",
        x: -1,
        y: 99,
        requestKey: randomUUID(),
      }),
    );
    const second = await a.run(undefined, undefined);
    assert.notEqual(first.id, second.id);
    assert.equal(second.view.state.brood, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
