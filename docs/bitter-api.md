# Bitter API integration

The renderer consumes `BeeView` (`src/lib/bee.ts`) and sends the strict commands in `src/server/schema.ts`. The shared simulation preserves the existing v3 save schema and supports v1/v2 migration. There is no migration or reset merely for switching to Phaser.

| Method | Endpoint             | Request                        | Response                                  |
| ------ | -------------------- | ------------------------------ | ----------------------------------------- |
| GET    | `/api/bee`           | Session cookie                 | Latest `BeeView`                          |
| POST   | `/api/bee/heartbeat` | `{}`                           | Advanced state and active-time accounting |
| POST   | `/api/bee/action`    | Command plus UUID `requestKey` | Updated `BeeView`, optional `payoutCents` |

`serverNow` is authoritative. The client derives its display offset, predicts short intervals, and polls heartbeat every ten seconds only while visible. If a mutation response is lost, sessionStorage retains its request key; reload retries that receipt before fetching current state. A 4xx validation response clears the pending receipt; ambiguous server/network failures retain it.

In Bitter mode the gateway forwards the existing cookie and Origin; it does not invent a user, mint JWTs, log in, create a wallet, or bypass upstream checks. Serve the game behind the same authenticated origin or explicitly configure an authentication gateway. If testing from the original localhost hostname, cookies are shared across ports, subject to their normal attributes. A different hostname requires its own valid login.

The existing Bitter API must retain authorization, origin checks, rate limits, per-user transaction locks, immutable command receipts and funded ledger payouts. Those services belong to Bitter and are not republished in this separate game repository. Production deployment should use that backend, not the single-process local JSON store. Never import guest saves into funded accounts as a source of trusted earnings.

A future multi-instance independent backend needs transactional storage, real account authentication, shared idempotency/rate limiting and a separately designed reward service. It is not part of the local development server.
