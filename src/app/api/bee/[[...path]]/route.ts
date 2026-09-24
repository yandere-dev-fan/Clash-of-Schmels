import { NextRequest, NextResponse } from "next/server";
import { BeeRuleError } from "@/game/bee-game";
import { ZodError } from "zod";
import { LocalStore, LocalRuleError } from "@/server/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const shared = globalThis as typeof globalThis & { schmelsStore?: LocalStore };
const store = (shared.schmelsStore ??= new LocalStore());
async function handler(req: NextRequest) {
  const path = new URL(req.url).pathname;
  if (!["/api/bee", "/api/bee/action", "/api/bee/heartbeat"].includes(path))
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if ((req.method === "GET") !== (path === "/api/bee"))
    return NextResponse.json({ error: "Метод не разрешён" }, { status: 405 });
  const origin = req.headers.get("origin");
  if (
    req.method === "POST" &&
    origin &&
    new URL(origin).host !== req.headers.get("host")
  )
    return NextResponse.json(
      { error: "Недопустимый источник запроса" },
      { status: 403 },
    );
  const upstream = process.env.BITTER_API_ORIGIN;
  if (upstream) {
    const target = new URL(upstream);
    if (!["https:", "http:"].includes(target.protocol))
      throw Error("Invalid API origin");
    const response = await fetch(new URL(path, target.origin), {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
        ...(origin ? { origin } : {}),
      },
      body: req.method === "POST" ? await req.text() : undefined,
      cache: "no-store",
      redirect: "error",
    });
    const headers = new Headers({
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    });
    for (const cookie of response.headers.getSetCookie())
      headers.append("set-cookie", cookie);
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  }
  try {
    const text = req.method === "POST" ? await req.text() : "";
    if (text.length > 16384)
      return NextResponse.json(
        { error: "Слишком большой запрос" },
        { status: 413 },
      );
    let body;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }
    if (path.endsWith("/action") && body === undefined)
      return NextResponse.json({ error: "Нужна операция" }, { status: 400 });
    if (path.endsWith("/heartbeat") && (!body || Object.keys(body).length))
      throw new LocalRuleError("Неверный heartbeat");
    const result = await store.run(
      req.cookies.get("schmels_player")?.value,
      path.endsWith("/action") ? body : undefined,
      path.endsWith("/heartbeat"),
    );
    const response = NextResponse.json(result.view, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set("schmels_player", result.id, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(req.url).protocol === "https:",
      path: "/",
      maxAge: 31536000,
    });
    return response;
  } catch (e) {
    const expected =
      e instanceof LocalRuleError ||
      e instanceof BeeRuleError ||
      e instanceof ZodError;
    return NextResponse.json(
      {
        error: expected
          ? e.message
          : "Не удалось сохранить игру. Повторите запрос.",
      },
      { status: expected ? 400 : 500 },
    );
  }
}
export const GET = handler;
export const POST = handler;
