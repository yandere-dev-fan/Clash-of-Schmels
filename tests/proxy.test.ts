import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/bee/[[...path]]/route";

test("Bitter adapter forwards session, origin and receipt; preserves upstream denial; rejects cross-origin writes", async () => {
  const seen: {
    path?: string;
    cookie?: string;
    origin?: string;
    body?: string;
  } = {};
  const upstream = createServer(async (req, res) => {
    seen.path = req.url;
    seen.cookie = req.headers.cookie;
    seen.origin = req.headers.origin;
    let body = "";
    for await (const chunk of req) body += chunk;
    seen.body = body;
    res.writeHead(req.method === "GET" ? 401 : 200, {
      "content-type": "application/json",
    });
    res.end(
      JSON.stringify(
        req.method === "GET" ? { error: "Войдите в Bitter" } : { ok: true },
      ),
    );
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  const address = upstream.address() as { port: number };
  const previous = process.env.BITTER_API_ORIGIN;
  process.env.BITTER_API_ORIGIN = `http://127.0.0.1:${address.port}`;
  try {
    const denied = await GET(
      new NextRequest("http://game.test/api/bee", {
        headers: { host: "game.test", cookie: "session=test-only" },
      }),
    );
    assert.equal(denied.status, 401);
    assert.equal(seen.cookie, "session=test-only");
    const body = JSON.stringify({ type: "breed", requestKey: "test-receipt" });
    const response = await POST(
      new NextRequest("http://game.test/api/bee/action", {
        method: "POST",
        headers: {
          host: "game.test",
          origin: "http://game.test",
          cookie: "session=test-only",
          "Content-Type": "application/json",
        },
        body,
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(seen.body, body);
    assert.equal(seen.origin, "http://game.test");
    assert.equal(seen.path, "/api/bee/action");
    const csrf = await POST(
      new NextRequest("http://game.test/api/bee/action", {
        method: "POST",
        headers: { host: "game.test", origin: "http://other.test" },
        body,
      }),
    );
    assert.equal(csrf.status, 403);
  } finally {
    if (previous === undefined) delete process.env.BITTER_API_ORIGIN;
    else process.env.BITTER_API_ORIGIN = previous;
    await new Promise<void>((r, j) => upstream.close((e) => (e ? j(e) : r())));
  }
});
