# Operations

How this runs for real: what it can carry, how to watch it, and what to change as it grows.

## Measured capacity

Run with `npm run test:load`, at Company A's real size: 2,600 students, 10,400 instalments, 31,200 attendance rows, on one laptop with Postgres. Your server's figures will differ, so run it again there.

| Work | Time |
|---|---|
| Dues, Scoreboard, month-end and Tally queries | 10 to 150 ms |
| Daily pipeline, first run | about 5 s |
| Daily pipeline, nothing new to send | about 1 s |
| Sending reminders through a 200 ms SMS provider, about 520 messages | 16 s, down from 114 s |
| Risk Lab replay of the term | 4 s, down from 245 s |
| Risk Lab learning new numbers | 4.5 s |

Testing at this size found two real problems, both fixed: reminders went out one at a time, and the Risk Lab was quadratic. Dashboards were already fast, so no indexes were added. Add one when a slow query shows up, not before.

**Not measured:** many users at once, a real SMS provider, or a real gateway.

## How it stays correct under load

| Risk | Control |
|---|---|
| The same webhook twice | Unique `gateway_ref` |
| Two payments on one balance | Row lock on the instalment |
| A reminder during a payment | The same lock, and a recheck at send |
| Two daily runs at once | A Postgres advisory lock, so the second one skips |
| A provider that hangs | A 10 second timeout, and the reminder stays queued |
| A failed stage | Recorded, and the next stage still runs |
| Abuse of sign-in | Limits per number and per address, held in Postgres |

## Monitoring

| Watch | Where | Alert when |
|---|---|---|
| App and database | `GET /api/health` | Not 200 for 2 minutes |
| The daily run | `lastPipelineRun` in `/api/health`, or the Scoreboard | Older than 1 day |
| Failed stages | `pipeline.finished` and `pipeline.stage_failed` in the logs, and `/api/cron/daily` returning 500 | Any |
| Money that needs a person | The queue on Close the Books | Older than 2 days |
| Refund deadlines | Refund Desk | Any past 10 days |

Logs are one JSON line per event on stdout, so any log service can read them. They hold ids and counts, never names, phone numbers or notes.

## Backups

Postgres is the only state. The app servers hold nothing.

```
pg_dump -Fc "$DATABASE_URL" > fee_tracker_$(date +%F).dump
pg_restore --clean -d "$DATABASE_URL" fee_tracker_YYYY-MM-DD.dump
```

Run the dump daily and keep it off the server. On RDS, use automated backups. A backup that has never been restored is not a backup, so test a restore before go-live.

## Releasing

1. Merge to `main`, once CI passes.
2. Run migrations first: `docker compose run --rm migrate`. They only add, so the old version keeps working.
3. Deploy the new image.
4. Check `/api/health`.

To roll back, deploy the previous image. Migrations stay in place.

## Growing

| When | Do this |
|---|---|
| Real use starts | Set `DEMO_MODE=false`, use a paid Gemini tier, connect a real gateway and SMS provider through `Sender` and the webhook |
| Sending takes too long | Raise `SEND_CONCURRENCY` and `DATABASE_POOL_MAX` together |
| More than one app server | It already works: sessions are signed, and limits and locks live in Postgres. Keep the total pool under Postgres's limit, or add PgBouncer. The time machine is demo only and needs one server |
| Payments reach thousands a day | Move sending to a queue with retries, so a send no longer holds a row lock |
| Risk Lab grows slow | Run it as a nightly job and store the result |
| Years of data | Partition `reminders` and `audit_events` by year, and archive old terms |
| More centres | Add per-centre access, which is the main missing control |

## Before real students use this

- Set `DEMO_MODE=false`. It shows sign-in codes on screen.
- Have Company A confirm the refund policy, GST treatment and Tally format.
- Get legal advice on the consent wording and on flagging minors.
- Get a native speaker to review the Hindi.
- Commission an independent security test.
