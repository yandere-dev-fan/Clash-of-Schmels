export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryAfterSeconds = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
/** Keep one receipt for an uncertain mutation across reloads. A lost response
 * retries the same operation instead of creating a second payment. */
export async function receiptMutation<T>(
  path: string,
  input: Record<string, unknown>,
  method = "POST",
): Promise<T> {
  const { requestKey: ignored, ...payload } = input;
  const storageKey = `bitter:receipt:${path}`;
  const fingerprint = JSON.stringify(payload);
  let receipt: { fingerprint: string; key: string } | null = null;
  if (typeof window !== "undefined")
    try {
      receipt = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    } catch {
      /* storage unavailable */
    }
  if (receipt && receipt.fingerprint !== fingerprint)
    throw new ApiError(
      "Предыдущая операция ещё не подтверждена. Повторите её с прежними параметрами.",
      409,
      "pending_operation",
    );
  const requestKey =
    receipt?.key ??
    (typeof ignored === "string" ? ignored : crypto.randomUUID());
  if (typeof window !== "undefined")
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ fingerprint, key: requestKey }),
      );
    } catch {
      /* server receipt still protects this request */
    }
  try {
    const result = await apiFetch<T>(path, {
      method,
      body: JSON.stringify({ ...payload, requestKey }),
    });
    if (typeof window !== "undefined") sessionStorage.removeItem(storageKey);
    return result;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status < 500 &&
      error.status !== 429 &&
      typeof window !== "undefined"
    )
      sessionStorage.removeItem(storageKey);
    throw error;
  }
}

export function refreshEarningsBalance() {
  window.dispatchEvent(new Event("schmels:balance"));
}
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error ?? `Ошибка ${response.status}`,
      response.status,
      data.code,
    );
  return data as T;
}
