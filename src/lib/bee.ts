import { apiFetch, receiptMutation } from "./api";
import type { BeeState } from "../game/bee-game";
export * from "../game/bee-game";
export interface BeeView {
  state: BeeState;
  serverNow: number;
  rewards: {
    enabled: boolean;
    funded: boolean;
    dailyCapCents: number;
    currency: "USD" | "BITTER";
    orderCents: number;
    orderHoney: number;
    secondsUntilOrder: number;
  };
  payoutCents?: number;
}
export const beeMoney = (cents: number, currency: string) =>
  currency === "USD"
    ? `$${(cents / 100).toFixed(2)}`
    : `${(cents / 100).toFixed(2)} B`;
export async function recoverBeeAction(): Promise<BeeView | null> {
  let pending: { fingerprint: string; key: string } | null = null;
  try {
    pending = JSON.parse(
      sessionStorage.getItem("bitter:receipt:/api/bee/action") ?? "null",
    );
  } catch {
    return null;
  }
  if (!pending) return null;
  const action: Record<string, unknown> = JSON.parse(pending.fingerprint);
  const result = await receiptMutation<BeeView>("/api/bee/action", {
    ...action,
    requestKey: pending.key,
  });
  const current = await apiFetch<BeeView>("/api/bee");
  return { ...current, payoutCents: result.payoutCents };
}
