import { randomInt, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  act,
  advance,
  initialState,
  ORDER_SECONDS,
  type BeeState,
  type BeeAction,
} from "../game/bee-game";
import { actionSchema } from "./schema";
interface Profile {
  state: BeeState;
  receipts: Record<
    string,
    { fingerprint: string; view: ReturnType<typeof view> }
  >;
}
type Store = Record<string, Profile>;
function view(state: BeeState, now: number) {
  return {
    state,
    serverNow: now,
    rewards: {
      enabled: false,
      funded: false,
      dailyCapCents: 0,
      currency: "USD" as const,
      orderCents: 25,
      secondsUntilOrder: Math.max(
        0,
        ORDER_SECONDS - (now - state.lastOrderAt) / 1000,
      ),
    },
  };
}
/** One process per local save directory. Production money stays in Bitter's ledger. */
export class LocalRuleError extends Error {}
export class LocalStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private directory = resolve(process.env.SCHMELS_DATA_DIR ?? "./data"),
  ) {}
  run(id: string | undefined, action: unknown, heartbeat = false) {
    const result = this.queue.then(() => this.execute(id, action, heartbeat));
    this.queue = result.catch(() => {});
    return result;
  }
  private async execute(
    id: string | undefined,
    body: unknown,
    heartbeat: boolean,
  ) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const file = resolve(this.directory, "colonies.json");
    let db: Store = {};
    try {
      db = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const valid = id && /^[a-f0-9-]{36}$/.test(id) && Object.hasOwn(db, id);
    const player = valid ? id! : randomUUID(),
      now = Date.now();
    const profile = valid
      ? db[player]!
      : { state: initialState(now, randomInt(1, 2147483647)), receipts: {} };
    let response;
    if (body !== undefined) {
      const { requestKey, ...action } = actionSchema.parse(body),
        fingerprint = JSON.stringify(action),
        receipt = profile.receipts[requestKey];
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new LocalRuleError("Ключ операции уже использован");
        return { id: player, view: receipt.view };
      }
      if (action.type === "order")
        throw new LocalRuleError(
          "Денежные выплаты доступны только через сервер Bitter",
        );
      profile.state = act(profile.state, action as BeeAction, now, 0).state;
      response = view(profile.state, now);
      profile.receipts[requestKey] = { fingerprint, view: response };
      // Receipts stay durable: a retry must never replay a completed mutation.
    } else {
      profile.state = heartbeat
        ? act(profile.state, { type: "heartbeat" }, now, 0).state
        : advance(profile.state, now);
      response = view(profile.state, now);
    }
    db[player] = profile;
    const tmp = file + "." + randomUUID() + ".tmp";
    await writeFile(tmp, JSON.stringify(db), { mode: 0o600 });
    await rename(tmp, file);
    return { id: player, view: response };
  }
}
