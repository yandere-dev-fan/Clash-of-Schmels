"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "@/components/auth";
import { apiFetch, receiptMutation, refreshEarningsBalance } from "@/lib/api";
import {
  advance,
  BUILDINGS,
  MAP_SIZE,
  center,
  BUILDABLE,
  ROLES,
  RESOURCES,
  RESOURCE_NAMES,
  LINK_NAMES,
  TECH,
  capacities,
  builders,
  headquarters,
  placementError,
  production,
  networks,
  recipeFor,
  costForUpgrade,
  upgradeRequirement,
  researchRequirement,
  storageLimit,
  discovered,
  terrain,
  routePath,
  beeMoney,
  recoverBeeAction,
  type BeeView,
  type BeeAction,
  type BuildingKind,
  type Resource,
  type Role,
  type Cost,
  type LinkKind,
} from "@/lib/bee";
import Valley, { type Placement, RESOURCE_COLORS } from "./Valley";
import BuildingArt from "./BuildingArt";
import { AssetProvider, Sprite } from "./Artwork";
import GameIcon, { type IconName } from "./GameIcon";
import styles from "./schmels.module.css";
import Onboarding, { GUIDES, eraProgress } from "./Onboarding";
const icons: Record<Resource, IconName> = {
  nectar: "nectar",
  honey: "honey",
  wood: "wood",
  wax: "wax",
  planks: "planks",
  gears: "gears",
  ore: "ore",
  copper: "copper",
  water: "water",
};
const f = (n: number) => Math.floor(n).toLocaleString("ru");
const duration = (s: number) =>
  s >= 3600
    ? `${Math.floor(s / 3600)}ч ${Math.ceil((s % 3600) / 60)}м`
    : s >= 60
      ? `${Math.floor(s / 60)}:${String(Math.ceil(s % 60)).padStart(2, "0")}`
      : `${Math.max(0, Math.ceil(s))}с`;
function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <GameIcon name={name} size={size} />;
}
function ResourceIcon({ r, size = 20 }: { r: Resource; size?: number }) {
  return (
    <span
      className={styles.resourceIcon}
      title={RESOURCE_NAMES[r]}
      style={{ color: RESOURCE_COLORS[r] }}
    >
      <Icon name={icons[r]} size={size} />
    </span>
  );
}
function Prices({
  cost,
  stock,
}: {
  cost: Cost;
  stock?: Partial<Record<Resource, number>>;
}) {
  return (
    <span className={styles.prices}>
      {Object.entries(cost)
        .filter(([, v]) => v > 0)
        .map(([r, v]) => (
          <span
            key={r}
            title={RESOURCE_NAMES[r as Resource]}
            className={
              stock && (stock[r as Resource] ?? 0) < v ? styles.short : ""
            }
          >
            <ResourceIcon r={r as Resource} size={16} />
            {f(v)}
          </span>
        ))}
    </span>
  );
}
export default function Page() {
  return (
    <AuthGate>
      <AssetProvider>
        <Game />
      </AssetProvider>
    </AuthGate>
  );
}
function Game() {
  const [data, setData] = useState<BeeView | null>(null),
    [now, setNow] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const offset = useRef(0),
    lock = useRef(false),
    mounted = useRef(true);
  const [detailKind, setDetailKind] = useState<BuildingKind>("hive"),
    [tutorialReplay, setTutorialReplay] = useState(0);
  const [selected, setSelected] = useState<number | null>(null),
    [tile, setTile] = useState<number | null>(null),
    [placement, setPlacement] = useState<Placement | null>(null),
    [shop, setShop] = useState(false),
    [category, setCategory] = useState<
      "colony" | "production" | "power" | "nature"
    >("colony"),
    [layer, setLayer] = useState<"normal" | "logistics" | "power">("normal");
  const [dialog, setDialog] = useState<
      | "tech"
      | "stocks"
      | "swarm"
      | "orders"
      | "help"
      | "info"
      | "catalogInfo"
      | null
    >(null),
    [connection, setConnection] = useState<{
      from: number;
      to?: number;
      kind: LinkKind;
      filter: Resource | "auto";
      via: number[];
    } | null>(null),
    [destroy, setDestroy] = useState(false);
  const receive = useCallback((view: BeeView) => {
    if (!mounted.current) return;
    offset.current = view.serverNow - Date.now();
    setData(view);
    setNow(view.serverNow);
    setError("");
  }, []);
  const load = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    try {
      receive(
        (await recoverBeeAction()) ?? (await apiFetch<BeeView>("/api/bee")),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Нет связи");
    } finally {
      lock.current = false;
    }
  }, [receive]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const clock = setInterval(() => setNow(Date.now() + offset.current), 1000),
      heart = setInterval(async () => {
        if (document.hidden || lock.current) return;
        lock.current = true;
        try {
          receive(
            await apiFetch<BeeView>("/api/bee/heartbeat", {
              method: "POST",
              body: "{}",
            }),
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Нет связи");
        } finally {
          lock.current = false;
        }
      }, 10000);
    return () => {
      mounted.current = false;
      clearInterval(clock);
      clearInterval(heart);
    };
  }, [load, receive]);
  useEffect(() => {
    if (!data || (!notice && !error)) return;
    const t = setTimeout(() => {
      setError("");
      setNotice("");
    }, 7000);
    return () => clearTimeout(t);
  }, [notice, error, data]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDialog(null);
        setPlacement(null);
        setConnection(null);
        setShop(false);
        setDestroy(false);
      }
      if (e.key === "Tab" && dialog) {
        const el = document.querySelector('[role="dialog"]'),
          items = el
            ? Array.from(
                el.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),a[href],select",
                ),
              )
            : [],
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dialog]);
  const state = useMemo(
    () =>
      data ? advance(data.state, Math.min(now, data.serverNow + 15000)) : null,
    [data, now],
  );
  async function act(action: Exclude<BeeAction, { type: "heartbeat" }>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const recovered = await recoverBeeAction(),
        result =
          recovered ??
          (await receiptMutation<BeeView>("/api/bee/action", {
            ...action,
            requestKey: crypto.randomUUID(),
          }));
      receive(result);
      if (result.payoutCents) {
        refreshEarningsBalance();
        setNotice(`+${beeMoney(result.payoutCents, result.rewards.currency)}`);
      }
      return !recovered;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!data || !state)
    return (
      <main className={styles.loading}>
        <div>
          <BuildingArt kind="wild" id="loading" />
        </div>
        <strong>Clash of Schmels</strong>
        <span>{error || "Рой возвращается…"}</span>
        {error && <button onClick={() => void load()}>Повторить</button>}
      </main>
    );
  const s = state,
    home = headquarters(s),
    cap = capacities(s, now),
    build = builders(s, now),
    rates = production(s, now),
    power = networks(s),
    b = s.buildings.find((b) => b.id === selected),
    p = rates.find((p) => p.id === selected),
    recipe = b ? recipeFor(b) : undefined,
    afford = (cost: Cost) =>
      Object.entries(cost).every(([r, v]) => s[r as Resource] + 1e-6 >= v);
  const x = tile === null ? 0 : tile % 42,
    y = tile === null ? 0 : Math.floor(tile / 42),
    known = discovered(s, x, y),
    nextTech = TECH[s.era],
    techError = researchRequirement(s, now),
    health = Math.round(
      (s.forest.reduce((a, n) => a + n, 0) /
        Math.max(1, s.forest.filter((n) => n > 0).length * 100)) *
        100,
    );
  const jobsByRole = (role: Role) =>
      s.units.filter((u) => u.role === role && u.job).length,
    hasNursery = s.buildings.find(
      (a) => a.kind === "nursery" && a.enabled && a.readyAt <= now,
    ),
    hasMarket = s.buildings.find(
      (a) =>
        a.kind === "market" &&
        a.enabled &&
        a.readyAt <= now &&
        a.stock.honey >= 120,
    ),
    orderWait = Math.max(
      0,
      data.rewards.secondsUntilOrder -
        Math.min(10, (now - data.serverNow) / 1000),
    );
  const epoch = eraProgress(s, now);
  const detail = BUILDINGS[detailKind];
  const placementCost: Cost = placement?.moving
    ? {}
    : placement?.kind === "plant"
      ? { honey: 8 }
      : placement
        ? BUILDINGS[placement.kind].cost
        : {};
  const placementProblem = placement
    ? placement.kind === "plant"
      ? !discovered(s, placement.x, placement.y) ||
        terrain(placement.x, placement.y, s.seed) !== "grass"
        ? "Участок недоступен"
        : null
      : placementError(
          s,
          placement.kind,
          placement.x,
          placement.y,
          placement.moving,
        )
    : null;
  let pathError = "",
    path: number[] = [];
  if (connection?.to) {
    try {
      path = routePath(
        s,
        connection.from,
        connection.to,
        connection.kind,
        connection.via,
      );
    } catch (e) {
      pathError = e instanceof Error ? e.message : "Нет трассы";
    }
  }
  const routeCost: Cost =
    connection?.kind === "flight"
      ? {}
      : connection?.kind === "wire"
        ? { copper: Math.max(1, path.length - 2) }
        : connection?.kind === "pipe"
          ? { copper: Math.ceil(path.length / 3) }
          : connection?.kind === "shaft"
            ? { wood: Math.max(1, path.length - 2), gears: 1 }
            : { wood: Math.max(1, path.length - 2), wax: 2 };
  function select(id: number) {
    if (connection) {
      setConnection({ ...connection, to: id });
      return;
    }
    setSelected(id);
    setTile(null);
    setShop(false);
    setDestroy(false);
  }
  function choose(kind: Placement["kind"], moving?: number) {
    setPlacement({ kind, moving, x: home.x + 3, y: home.y });
    setShop(false);
    setTile(null);
    setConnection(null);
  }
  async function place() {
    if (!placement) return;
    const p = placement;
    const ok = await act(
      p.kind === "plant"
        ? { type: "plant", x: p.x, y: p.y }
        : p.moving
          ? { type: "move", id: p.moving, x: p.x, y: p.y }
          : {
              type: "build",
              kind: p.kind as Exclude<BuildingKind, "wild">,
              x: p.x,
              y: p.y,
            },
    );
    if (ok) {
      setPlacement(null);
      setSelected(null);
      setNotice(p.moving ? "Площадка переносится" : "Работа началась");
    }
  }
  return (
    <main className={styles.game}>
      <Valley
        state={s}
        now={now}
        offset={offset.current}
        selected={selected}
        selectedTile={tile}
        placement={placement}
        onSelect={select}
        onTile={(t) => {
          if (connection) {
            setConnection((c) => c && { ...c, via: [...c.via, t].slice(-12) });
            return;
          }
          setTile(t);
          setSelected(null);
          setShop(false);
        }}
        onPlacement={(x, y) => setPlacement((p) => p && { ...p, x, y })}
        layer={layer}
        connecting={Boolean(connection)}
        via={connection?.via ?? []}
        draft={
          connection?.to && !pathError
            ? connection.kind === "flight"
              ? [
                  center(s.buildings.find((b) => b.id === connection.from)!),
                  center(s.buildings.find((b) => b.id === connection.to)!),
                ]
              : path.map((t) => ({
                  x: t % MAP_SIZE,
                  y: Math.floor(t / MAP_SIZE),
                }))
            : []
        }
      />
      <header className={styles.topHud}>
        <div className={styles.brand}>
          <Link
            href={process.env.NEXT_PUBLIC_BITTER_WEB_URL ?? "/"}
            aria-label="На главную"
          >
            <Icon name="back" size={18} />
          </Link>
          <button
            onClick={() => setDialog("tech")}
            title={`Эпоха ${TECH[s.era - 1]!.name}`}
          >
            <Icon name="star" size={40} />
            <b>{s.era}</b>
          </button>
          <div>
            <strong>Clash of Schmels</strong>
            <span>
              {TECH[s.era - 1]!.name}
              {s.research &&
                ` · ${duration((s.research.readyAt - now) / 1000)}`}
            </span>
          </div>
        </div>
        <div className={styles.resources}>
          {(["honey", "wood", "wax", "gears"] as Resource[]).map((r) => (
            <button
              key={r}
              onClick={() => setDialog("stocks")}
              title={`${RESOURCE_NAMES[r]} в хранилищах: ${f(s[r])}/${cap[r]}`}
            >
              <ResourceIcon r={r} size={25} />
              <span>
                <strong>{f(s[r])}</strong>
                <i>
                  <b
                    style={{
                      width: `${Math.min(100, (s[r] / cap[r]) * 100)}%`,
                      background: RESOURCE_COLORS[r],
                    }}
                  />
                </i>
              </span>
            </button>
          ))}
        </div>
        <button
          className={styles.cash}
          onClick={() => setDialog("orders")}
          title="Экспедиции"
        >
          <Icon name="coin" />
          <strong>{beeMoney(s.earnedToday, data.rewards.currency)}</strong>
        </button>
      </header>
      <button
        className={styles.eraProgress}
        onClick={() => setDialog("tech")}
        title={epoch.label}
        aria-label={`${epoch.label}: ${Math.floor(epoch.value * 100)}%`}
      >
        <span>
          {epoch.label}
          <b>{Math.floor(epoch.value * 100)}%</b>
        </span>
        <progress max={1} value={epoch.value} />
      </button>
      <div
        hidden={Boolean(
          dialog ||
            shop ||
            placement ||
            connection ||
            selected !== null ||
            tile !== null,
        )}
      >
        <Onboarding
          state={s}
          replay={tutorialReplay}
          onClose={() => {}}
          onBuild={(kind) => {
            const target = s.buildings.find((b) => b.kind === kind);
            if (target) select(target.id);
            else {
              setCategory(BUILDINGS[kind].category);
              setShop(true);
            }
          }}
          onSwarm={() => setDialog("swarm")}
          onTech={() => setDialog("tech")}
        />
      </div>
      <aside className={styles.leftHud}>
        <button onClick={() => setDialog("swarm")} title="Рой и профессии">
          <Icon name="bee" />
          <b>
            {s.bees}
            <small>/{cap.bees}</small>
          </b>
          <i>{s.jobs.filter((j) => j.bee !== null).length} ↗</i>
        </button>
        <button
          onClick={() => {
            const job = s.buildings.find((b) => b.readyAt > now);
            if (job) select(job.id);
            else setShop(true);
          }}
          title="Свободные строители"
        >
          <Icon name="hammer" />
          <b>
            {build.max - build.busy}
            <small>/{build.max}</small>
          </b>
        </button>
        <button onClick={() => setDialog("tech")} title="Исследования">
          <Icon name="flask" />
          <b>
            {s.era} <small>/4</small>
          </b>
        </button>
      </aside>
      <aside className={styles.rightHud}>
        <button
          aria-label="Слой логистики"
          aria-pressed={layer === "logistics"}
          onClick={() =>
            setLayer(layer === "logistics" ? "normal" : "logistics")
          }
        >
          <Icon name="road" />
        </button>
        <button
          aria-label="Слой энергии"
          aria-pressed={layer === "power"}
          onClick={() => setLayer(layer === "power" ? "normal" : "power")}
        >
          <Icon name="settings" />
        </button>
        <button
          aria-label="Помощь и сохранение"
          onClick={() => setDialog("help")}
        >
          <Icon name="info" />
        </button>
      </aside>
      {layer === "power" && (
        <div className={styles.powerHud}>
          <span title="Суммарная механическая нагрузка и мощность. Отдельные сети проверяются независимо.">
            <Icon name="settings" size={17} />
            {power.mechanical.reduce((n, p) => n + p.demand, 0)} /{" "}
            {power.mechanical.reduce((n, p) => n + p.supply, 0)}
          </span>
          <span title="Электричество: нагрузка / генерация">
            ϟ {power.electric.reduce((n, p) => n + p.demand, 0)} /{" "}
            {power.electric.reduce((n, p) => n + p.supply, 0)}
          </span>
        </div>
      )}
      {(error || notice) && (
        <div
          className={`${styles.toast} ${error ? styles.error : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || notice}
        </div>
      )}
      {!shop && !placement && !connection && (
        <button
          className={styles.buildButton}
          onClick={() => {
            setShop(true);
            setSelected(null);
            setTile(null);
          }}
        >
          <Icon name="hammer" size={27} />
          Строить
        </button>
      )}
      {b && !shop && !placement && !connection && (
        <section className={styles.selection} aria-label="Выбранная постройка">
          <div className={styles.selectionHead}>
            <div className={styles.miniArt}>
              <BuildingArt kind={b.kind} id="selection" active={p?.running} />
            </div>
            <div>
              <strong>{BUILDINGS[b.kind].name}</strong>
              <span>Уровень {b.level}</span>
            </div>
            <button aria-label="О постройке" onClick={() => setDialog("info")}>
              <Icon name="info" size={18} />
            </button>
            <button
              aria-label="Закрыть постройку"
              onClick={() => setSelected(null)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className={styles.statusLine}>
            {b.readyAt > now ? (
              <>
                <Icon name="hammer" size={15} />
                {duration((b.readyAt - now) / 1000)}
              </>
            ) : (
              <>
                <span
                  className={p?.running ? styles.running : styles.stopped}
                />
                {p?.reason || (p?.running ? "Работает" : "Готово")}
                {p?.needed ? (
                  <small>
                    {p.workers}/{p.needed}{" "}
                    {ROLES[BUILDINGS[b.kind].role!].name.toLowerCase()}
                  </small>
                ) : null}
              </>
            )}
          </div>
          {recipe && (
            <div className={styles.recipeLine}>
              <Prices cost={recipe.input} />
              <span>→</span>
              <Prices cost={recipe.output} />
              <small>{recipe.seconds}с</small>
            </div>
          )}
          <div className={styles.localStock}>
            {RESOURCES.filter(
              (r) => b.stock[r] > 0 || recipe?.input[r] || recipe?.output[r],
            )
              .slice(0, 5)
              .map((r) => (
                <span key={r} title={`${RESOURCE_NAMES[r]} внутри постройки`}>
                  <ResourceIcon r={r} size={16} />
                  {f(b.stock[r])}
                  <small>/{storageLimit(b, r)}</small>
                </span>
              ))}
          </div>
          {b.readyAt > now ? (
            <div className={styles.progress}>
              <i
                style={{
                  width: `${Math.min(100, ((now - b.startedAt) / (b.readyAt - b.startedAt)) * 100)}%`,
                }}
              />
            </div>
          ) : (
            <>
              {b.kind === "wild" && s.bees === 0 && (
                <button
                  className={styles.primary}
                  disabled={busy || Boolean(s.brood)}
                  onClick={() => void act({ type: "breed" })}
                >
                  <Icon name="bee" />
                  {s.brood
                    ? duration((s.brood.readyAt - now) / 1000)
                    : "Первый рой · бесплатно"}
                </button>
              )}
              {b.kind === "nursery" && (
                <div className={styles.training}>
                  {(Object.keys(ROLES) as Role[]).map((role) => (
                    <button
                      key={role}
                      title={`${ROLES[role].name}: ${duration(ROLES[role].seconds)}`}
                      disabled={
                        busy ||
                        Boolean(s.brood) ||
                        !afford(ROLES[role].cost) ||
                        s.bees >= cap.bees
                      }
                      onClick={() =>
                        void act({ type: "train", role, id: b.id })
                      }
                    >
                      <span style={{ background: ROLES[role].color }}>
                        <Icon name="bee" size={17} />
                      </span>
                      <small>{ROLES[role].name}</small>
                      <Prices cost={ROLES[role].cost} />
                    </button>
                  ))}
                </div>
              )}
              {b.kind === "workshop" && (
                <div className={styles.recipeSwitch}>
                  {(["planks", "gears"] as const).map((r) => (
                    <button
                      key={r}
                      aria-pressed={(b.recipe ?? "planks") === r}
                      disabled={busy}
                      onClick={() =>
                        void act({ type: "recipe", id: b.id, recipe: r })
                      }
                    >
                      {RESOURCE_NAMES[r]}
                    </button>
                  ))}
                </div>
              )}
              {s.brood?.building === b.id && (
                <div className={styles.queue}>
                  <Icon name="bee" size={16} />
                  {ROLES[s.brood.role].name}
                  <span>{duration((s.brood.readyAt - now) / 1000)}</span>
                </div>
              )}
              <div className={styles.actions}>
                <button
                  className={styles.connectButton}
                  onClick={() => {
                    setConnection({
                      from: b.id,
                      kind: "flight",
                      filter: "auto",
                      via: [],
                    });
                    setLayer("logistics");
                  }}
                >
                  <Icon name="road" size={18} />
                  Соединить
                </button>
                <button
                  aria-label={
                    b.enabled ? "Остановить постройку" : "Включить постройку"
                  }
                  title={b.enabled ? "Остановить" : "Включить"}
                  onClick={() => void act({ type: "toggle", id: b.id })}
                  disabled={busy}
                >
                  <Icon name={b.enabled ? "pause" : "play"} size={18} />
                </button>
                {b.kind !== "wild" && (
                  <button
                    aria-label="Перенести постройку"
                    title="Перенести"
                    disabled={
                      busy || build.busy >= build.max || Boolean(s.clearing)
                    }
                    onClick={() => choose(b.kind, b.id)}
                  >
                    <Icon name="move" size={18} />
                  </button>
                )}
                <button
                  aria-label="Улучшить постройку"
                  title={upgradeRequirement(s, b) || "Улучшить"}
                  disabled={
                    busy ||
                    build.busy >= build.max ||
                    Boolean(upgradeRequirement(s, b)) ||
                    !afford(costForUpgrade(b))
                  }
                  onClick={() => void act({ type: "upgrade", id: b.id })}
                >
                  <Icon name="up" size={18} />
                </button>
              </div>
              <div className={styles.smallActions}>
                <button
                  disabled={busy}
                  onClick={() => void act({ type: "priority", id: b.id })}
                >
                  Приоритет рабочих
                </button>
                {b.kind !== "wild" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      destroy
                        ? void act({ type: "demolish", id: b.id }).then(
                            (ok) => {
                              if (ok) setSelected(null);
                            },
                          )
                        : setDestroy(true)
                    }
                  >
                    {destroy ? "Снести пустую постройку?" : "Снести"}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}
      {tile !== null && !shop && !placement && !connection && (
        <section className={styles.tilePanel}>
          <button
            className={styles.close}
            aria-label="Закрыть участок"
            onClick={() => setTile(null)}
          >
            <Icon name="close" size={16} />
          </button>
          {!known ? (
            <>
              <Icon name="leaf" size={28} />
              <strong>Неизведанный лес</strong>
              <small>Сектор 6×6</small>
              <Prices
                cost={{
                  honey: 80 + 60 * (s.unlocked.length - 9),
                  wood: 40 + 15 * (s.unlocked.length - 9),
                }}
                stock={s}
              />
              <button
                className={styles.primary}
                disabled={busy}
                onClick={() =>
                  void act({ type: "expand", x, y }).then((ok) => {
                    if (ok) setNotice("Сектор разведан");
                  })
                }
              >
                Разведать
              </button>
            </>
          ) : (
            <>
              <strong>
                {s.forest[tile]! > 0
                  ? "Дерево"
                  : terrain(x, y, s.seed) === "water"
                    ? "Река"
                    : terrain(x, y, s.seed) === "rock"
                      ? "Рудная жила"
                      : "Поляна"}
              </strong>
              {s.forest[tile]! > 0 ? (
                <button
                  className={styles.primary}
                  disabled={
                    busy || build.busy >= build.max || Boolean(s.clearing)
                  }
                  onClick={() =>
                    void act({ type: "chop", x, y }).then((ok) => {
                      if (ok) {
                        setTile(null);
                        setNotice("Рабочий вылетел к дереву");
                      }
                    })
                  }
                >
                  <Icon name="axe" size={19} />+
                  {Math.floor((25 * s.forest[tile]!) / 100)}{" "}
                  <ResourceIcon r="wood" size={17} />
                  <small>10с + полёт</small>
                </button>
              ) : (
                terrain(x, y, s.seed) === "grass" && (
                  <button
                    className={styles.primary}
                    onClick={() => {
                      setShop(true);
                      setTile(null);
                    }}
                  >
                    Строить
                  </button>
                )
              )}
            </>
          )}
        </section>
      )}
      {shop && (
        <section className={styles.catalog} aria-label="Каталог строительства">
          <div className={styles.catalogHead}>
            <div>
              {(["colony", "production", "power", "nature"] as const).map(
                (c, i) => (
                  <button
                    key={c}
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                  >
                    {["Рой", "Фабрика", "Энергия", "Лес"][i]}
                  </button>
                ),
              )}
            </div>
            <button aria-label="Закрыть каталог" onClick={() => setShop(false)}>
              <Icon name="close" size={19} />
            </button>
          </div>
          <div className={styles.cards}>
            {BUILDABLE.filter((k) => BUILDINGS[k].category === category).map(
              (kind) => {
                const d = BUILDINGS[kind];
                return (
                  <article key={kind} className={styles.catalogItem}>
                    <button
                      disabled={d.tier > s.era}
                      onClick={() => choose(kind)}
                      title={d.description}
                    >
                      <div className={styles.cardArt}>
                        <BuildingArt kind={kind} id={`catalog-${kind}`} />
                      </div>
                      <strong>{d.name}</strong>
                      {d.tier > s.era ? (
                        <small>
                          <Icon name="lock" size={12} />
                          {TECH[d.tier - 1]!.name}
                        </small>
                      ) : (
                        <Prices cost={d.cost} stock={s} />
                      )}
                      <em>{duration(d.seconds)}</em>
                    </button>
                    <button
                      className={styles.cardInfo}
                      aria-label={`О здании: ${d.name}`}
                      onClick={() => {
                        setDetailKind(kind);
                        setDialog("catalogInfo");
                      }}
                    >
                      <Icon name="info" size={18} />
                    </button>
                  </article>
                );
              },
            )}
            {category === "nature" && (
              <button onClick={() => choose("plant")}>
                <div className={styles.cardArt}>
                  <svg viewBox="0 0 160 180" aria-hidden="true">
                    <Sprite name="terrain.tree" width={160} />
                  </svg>
                </div>
                <strong>Новое дерево</strong>
                <Prices cost={{ honey: 8 }} />
                <em>30с</em>
              </button>
            )}
          </div>
        </section>
      )}
      {placement && (
        <section className={styles.placement}>
          <div>
            <strong>
              {placement.moving
                ? "Перенос"
                : placement.kind === "plant"
                  ? "Дерево"
                  : BUILDINGS[placement.kind].name}
            </strong>
            <small>
              {placementProblem ||
                `Клетка ${placement.x + 1}:${placement.y + 1}`}
            </small>
          </div>
          <Prices cost={placementCost} stock={s} />
          <button
            aria-label="Отменить размещение"
            onClick={() => setPlacement(null)}
          >
            <Icon name="close" />
          </button>
          <button
            className={styles.confirm}
            aria-label="Подтвердить строительство"
            disabled={
              busy ||
              Boolean(placementProblem) ||
              !afford(placementCost) ||
              build.busy >= build.max
            }
            onClick={() => void place()}
          >
            <Icon name="check" />
          </button>
        </section>
      )}
      {connection && (
        <section className={styles.connection} aria-label="Проект соединения">
          <div className={styles.connectionTitle}>
            <strong>
              {
                BUILDINGS[
                  s.buildings.find((b) => b.id === connection.from)!.kind
                ].name
              }{" "}
              →{" "}
              {connection.to
                ? BUILDINGS[
                    s.buildings.find((b) => b.id === connection.to)!.kind
                  ].name
                : "выберите приёмник"}
            </strong>
            <button
              aria-label="Отменить соединение"
              onClick={() => setConnection(null)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className={styles.selects}>
            <select
              aria-label="Тип соединения"
              value={connection.kind}
              onChange={(e) =>
                setConnection({
                  ...connection,
                  kind: e.target.value as LinkKind,
                })
              }
            >
              {(Object.keys(LINK_NAMES) as LinkKind[]).map((k) => (
                <option
                  key={k}
                  value={k}
                  disabled={
                    s.era <
                    { flight: 1, belt: 2, shaft: 2, pipe: 3, wire: 4 }[k]
                  }
                >
                  {LINK_NAMES[k]}
                </option>
              ))}
            </select>
            {!["shaft", "wire"].includes(connection.kind) && (
              <select
                aria-label="Фильтр ресурса"
                value={connection.filter}
                onChange={(e) =>
                  setConnection({
                    ...connection,
                    filter: e.target.value as Resource | "auto",
                  })
                }
              >
                <option value="auto">По потребности</option>
                {RESOURCES.map((r) => (
                  <option key={r} value={r}>
                    {RESOURCE_NAMES[r]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <small>
            {pathError || connection.kind === "flight"
              ? ""
              : `${path.length} клеток. Промежуточные точки: нажмите на землю.`}
          </small>
          {pathError && <p className={styles.error}>{pathError}</p>}
          {connection.kind === "belt" && (
            <small>
              Привод валом к источнику. Нагрузка{" "}
              {Math.max(1, Math.ceil(path.length / 6))}.
            </small>
          )}
          <div className={styles.connectionBottom}>
            <Prices cost={routeCost} stock={s} />
            {connection.via.length > 0 && (
              <button onClick={() => setConnection({ ...connection, via: [] })}>
                Сброс трассы
              </button>
            )}
            <button
              className={styles.primary}
              disabled={
                busy ||
                !connection.to ||
                Boolean(pathError) ||
                !afford(routeCost)
              }
              onClick={() =>
                void act({
                  type: "link",
                  from: connection.from,
                  to: connection.to!,
                  kind: connection.kind,
                  filter: connection.filter,
                  via: connection.via,
                }).then((ok) => {
                  if (ok) {
                    setConnection(null);
                    setNotice("Соединение готово");
                  }
                })
              }
            >
              Соединить
            </button>
          </div>
        </section>
      )}
      {dialog && (
        <div className={styles.backdrop} onClick={() => setDialog(null)}>
          <section
            className={`${styles.modal} ${dialog === "tech" ? styles.techModal : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              {
                tech: "Эпохи",
                stocks: "Хранилища",
                swarm: "Рой",
                orders: "Экспедиции",
                help: "Помощь и сохранение",
                info: "О постройке",
                catalogInfo: "Справка о здании",
              }[dialog]
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className={styles.close}
              aria-label="Закрыть окно"
              onClick={() => setDialog(null)}
            >
              <Icon name="close" />
            </button>
            {dialog === "catalogInfo" && (
              <>
                <div className={styles.modalArt}>
                  <BuildingArt kind={detailKind} />
                </div>
                <h2>{detail.name}</h2>
                <p>{GUIDES[detailKind]}</p>
                <div className={styles.recipeLine}>
                  <Prices cost={detail.cost} stock={s} />
                  <small>{duration(detail.seconds)}</small>
                </div>
                <p>
                  {detail.workers
                    ? `${detail.workers} × ${ROLES[detail.role!].name}. `
                    : ""}
                  {detail.mechanical ? `Вращение: ${detail.mechanical}. ` : ""}
                  {detail.electric ? `Электричество: ${detail.electric}. ` : ""}
                  Эпоха: {TECH[detail.tier - 1]!.name}.
                </p>
                {detail.recipe && (
                  <div className={styles.recipeLine}>
                    <Prices cost={detail.recipe.input} />
                    <span>→</span>
                    <Prices cost={detail.recipe.output} />
                    <small>{duration(detail.recipe.seconds)}</small>
                  </div>
                )}
                <button
                  className={styles.primary}
                  disabled={detail.tier > s.era}
                  onClick={() => {
                    setDialog(null);
                    choose(detailKind);
                  }}
                >
                  {detail.tier > s.era
                    ? `Нужна эпоха ${TECH[detail.tier - 1]!.name}`
                    : "Разместить"}
                </button>
              </>
            )}
            {dialog === "stocks" && (
              <>
                <h2>Хранилища</h2>
                <p>
                  Доступно для строительства. Грузы в пути и запасы фабрик
                  показаны отдельно.
                </p>
                <div className={styles.stockGrid}>
                  {RESOURCES.map((r) => (
                    <div key={r}>
                      <ResourceIcon r={r} size={27} />
                      <span>
                        {RESOURCE_NAMES[r]}
                        <strong>
                          {f(s[r])}
                          <small> / {cap[r]}</small>
                        </strong>
                      </span>
                      <i
                        style={{
                          width: `${Math.min(100, (s[r] / cap[r]) * 100)}%`,
                          background: RESOURCE_COLORS[r],
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p>
                  В пути: {s.jobs.reduce((n, j) => n + j.amount, 0)} единиц.
                  Грузчиков занято: {jobsByRole("carrier")}.
                </p>
              </>
            )}
            {dialog === "tech" && (
              <>
                <h2>От роя к индустрии</h2>
                <div className={styles.epochDetails}>
                  <strong>
                    {epoch.label} · {Math.floor(epoch.value * 100)}%
                  </strong>
                  <progress max={1} value={epoch.value} />
                  {!s.research && nextTech && (
                    <div>
                      <span>
                        Время <b>{Math.floor(epoch.age * 100)}%</b>
                      </span>
                      <span>
                        Материалы <b>{Math.floor(epoch.stock * 100)}%</b>
                      </span>
                      <span>
                        Мастерская <b>{epoch.workshop ? "✓" : "—"}</b>
                      </span>
                    </div>
                  )}
                </div>
                <div className={styles.eras}>
                  {TECH.map((tech, i) => (
                    <div
                      key={tech.name}
                      className={s.era === i + 1 ? styles.currentEra : ""}
                    >
                      <span>{i + 1}</span>
                      <div>
                        <strong>{tech.name}</strong>
                        <p>
                          {
                            [
                              "Нектар, ручные инструменты, обучение роя",
                              "Водяные колёса, валы, конвейеры, помпы",
                              "Котлы, руда, медь и трубопроводы",
                              "Динамо, электрические сети и центрифуги",
                            ][i]
                          }
                        </p>
                        {i > 0 && s.era < i + 1 && (
                          <>
                            <Prices cost={tech.cost} stock={s} />
                            <small>
                              Развитие {tech.age / 3600} ч · исследование{" "}
                              {duration(tech.seconds)}
                            </small>
                          </>
                        )}
                      </div>
                      {s.era > i && <Icon name="check" size={18} />}
                    </div>
                  ))}
                </div>
                {nextTech && (
                  <button
                    className={styles.primary}
                    disabled={
                      busy || Boolean(techError) || !afford(nextTech.cost)
                    }
                    onClick={() => void act({ type: "research" })}
                  >
                    {s.research
                      ? duration((s.research.readyAt - now) / 1000)
                      : techError || `Исследовать: ${nextTech.name}`}
                  </button>
                )}
                <p>
                  Эпохи открываются по возрасту колонии и производственным
                  ресурсам. Время идёт и вне игры.
                </p>
              </>
            )}
            {dialog === "swarm" && (
              <>
                <h2>
                  Рой{" "}
                  <small>
                    {s.bees}/{cap.bees}
                  </small>
                </h2>
                <div className={styles.swarmRows}>
                  {(Object.keys(ROLES) as Role[]).map((role) => (
                    <div key={role}>
                      <span
                        className={styles.roleBadge}
                        style={{ background: ROLES[role].color }}
                      >
                        <Icon name="bee" />
                      </span>
                      <span>
                        <strong>{ROLES[role].name}</strong>
                        <small>
                          {role === "forager"
                            ? "Цветы → улей"
                            : role === "carrier"
                              ? "Грузы между постройками"
                              : role === "forester"
                                ? "Лес и восстановление"
                                : "Работа на механизмах"}
                        </small>
                      </span>
                      <b>{s.units.filter((u) => u.role === role).length}</b>
                      <button
                        disabled={!hasNursery}
                        title="Открыть расплодник"
                        onClick={() => {
                          if (hasNursery) {
                            select(hasNursery.id);
                            setDialog(null);
                          }
                        }}
                      >
                        <Icon name="plus" size={17} />
                      </button>
                    </div>
                  ))}
                </div>
                {s.brood && (
                  <p>
                    {ROLES[s.brood.role].name}:{" "}
                    {duration((s.brood.readyAt - now) / 1000)}
                  </p>
                )}
                <p>
                  {hasNursery
                    ? "Обучение и переобучение доступны в расплоднике. Пчела с грузом сначала завершает доставку."
                    : "Постройте расплодник, чтобы выращивать пчёл и обучать профессиям."}
                </p>
                {hasNursery && (
                  <details>
                    <summary>Переобучить свободную пчелу · 8 мёда</summary>
                    <div className={styles.retrain}>
                      {s.units
                        .filter((u) => !u.job)
                        .map((u) => (
                          <label key={u.id}>
                            №{u.id} {ROLES[u.role].name}
                            <select
                              aria-label={`Профессия пчелы ${u.id}`}
                              value={u.role}
                              disabled={busy || Boolean(s.brood)}
                              onChange={(e) =>
                                void act({
                                  type: "retrain",
                                  bee: u.id,
                                  role: e.target.value as Role,
                                })
                              }
                            >
                              {(Object.keys(ROLES) as Role[]).map((r) => (
                                <option key={r} value={r}>
                                  {ROLES[r].name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                    </div>
                  </details>
                )}
              </>
            )}
            {dialog === "orders" && (
              <>
                <div className={styles.modalArt}>
                  <BuildingArt kind="market" id="orders" />
                </div>
                <h2>Экспедиция мёда</h2>
                <div className={styles.trade}>
                  <Prices cost={{ honey: 120 }} />
                  <span>→</span>
                  <strong>{beeMoney(25, data.rewards.currency)}</strong>
                </div>
                <p>
                  В экспедиционных сотах:{" "}
                  {f(
                    s.buildings
                      .filter((b) => b.kind === "market")
                      .reduce((n, b) => n + b.stock.honey, 0),
                  )}{" "}
                  мёда.
                </p>
                <div className={styles.rewardTrack}>
                  {Array.from(
                    { length: Math.floor(data.rewards.dailyCapCents / 25) },
                    (_, i) => (
                      <i
                        key={i}
                        className={i < s.ordersToday ? styles.paid : ""}
                      />
                    ),
                  )}
                </div>
                <button
                  className={styles.primary}
                  disabled={
                    busy ||
                    !hasMarket ||
                    !data.rewards.enabled ||
                    !data.rewards.funded ||
                    orderWait > 0 ||
                    s.earnedToday + 25 > data.rewards.dailyCapCents
                  }
                  onClick={() => void act({ type: "order" })}
                >
                  {!data.rewards.enabled
                    ? "Выплаты на паузе"
                    : !data.rewards.funded
                      ? "Фонд пуст"
                      : !hasMarket
                        ? "Доставьте мёд по маршруту"
                        : s.earnedToday + 25 > data.rewards.dailyCapCents
                          ? "Лимит на сегодня"
                          : orderWait > 0
                            ? duration(orderWait)
                            : "Отправить"}
                </button>
                <p>
                  До{" "}
                  {beeMoney(data.rewards.dailyCapCents, data.rewards.currency)}{" "}
                  в день из фонда Bitter. Один заказ за 5 минут в открытой игре.
                </p>
              </>
            )}
            {dialog === "info" && b && (
              <>
                <div className={styles.modalArt}>
                  <BuildingArt kind={b.kind} id="info" active={p?.running} />
                </div>
                <h2>{BUILDINGS[b.kind].name}</h2>
                <p>{GUIDES[b.kind]}</p>
                {recipe && (
                  <div className={styles.trade}>
                    <Prices cost={recipe.input} />
                    <span>→</span>
                    <Prices cost={recipe.output} />
                  </div>
                )}
                <p>
                  Улучшение: <Prices cost={costForUpgrade(b)} stock={s} />
                  <br />
                  {upgradeRequirement(s, b)}
                </p>
                <h3>Соединения</h3>
                <div className={styles.linkList}>
                  {s.links
                    .filter((l) => l.from === b.id || l.to === b.id)
                    .map((l) => (
                      <div key={l.id}>
                        <span>
                          {
                            BUILDINGS[
                              s.buildings.find((b) => b.id === l.from)!.kind
                            ].name
                          }{" "}
                          →{" "}
                          {
                            BUILDINGS[
                              s.buildings.find((b) => b.id === l.to)!.kind
                            ].name
                          }
                          <small>
                            {LINK_NAMES[l.kind]} ·{" "}
                            {l.filter === "auto"
                              ? "по потребности"
                              : RESOURCE_NAMES[l.filter]}
                          </small>
                        </span>
                        <button
                          aria-label={`Удалить соединение ${l.id}`}
                          disabled={busy}
                          onClick={() => void act({ type: "unlink", id: l.id })}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    ))}
                </div>
                {!s.links.some((l) => l.from === b.id || l.to === b.id) && (
                  <p>Соединений пока нет.</p>
                )}
                {["mechanical", "electric"].map((kind) => {
                  const network = power[kind as "mechanical" | "electric"].find(
                    (n) => n.ids.includes(b.id),
                  );
                  return network && network.supply + network.demand > 0 ? (
                    <p key={kind}>
                      {kind === "mechanical" ? "Вращение" : "Электричество"}:{" "}
                      {network.demand}/{network.supply}
                      {network.ratio ? " · работает" : " · сеть остановлена"}
                    </p>
                  ) : null;
                })}
              </>
            )}
            {dialog === "help" && (
              <>
                <h2>Clash of Schmels</h2>
                <button
                  className={styles.primary}
                  onClick={() => {
                    setDialog(null);
                    setSelected(null);
                    setTile(null);
                    setShop(false);
                    setTutorialReplay((n) => n + 1);
                  }}
                >
                  Пройти короткое обучение
                </button>
                <div className={styles.helpRows}>
                  <p>
                    <Icon name="hammer" />
                    Строить → клетка → ✓. Между площадками остаётся проход.
                  </p>
                  <p>
                    <Icon name="road" />
                    Выберите источник → «Соединить» → тип → приёмник. Для трассы
                    можно указать промежуточные клетки.
                  </p>
                  <p>
                    <Icon name="bee" />
                    Собиратели носят нектар; грузчики обслуживают маршруты.
                    Профессии обучаются в расплоднике.
                  </p>
                  <p>
                    <Icon name="settings" />
                    Колесо → вал → механизм. Привод конвейера подаётся на
                    источник. Перегрузка останавливает сеть.
                  </p>
                  <p>
                    <Icon name="leaf" />
                    Нажмите на тёмный лес, чтобы разведать соседний сектор.
                  </p>
                </div>
                <p>
                  Автосохранение на сервере. Производство до 8 часов офлайн;
                  эпохи продолжают исследоваться.
                </p>
                <p>
                  В самостоятельном режиме колония хранится на этом сервере. При
                  подключении API Bitter используется ваш аккаунт и его
                  прогресс.
                </p>
                <a
                  href="/bee/assets/CREDITS.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Авторы графики
                </a>
                <Link href={process.env.NEXT_PUBLIC_BITTER_WEB_URL ?? "/"}>
                  На главную
                </Link>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
