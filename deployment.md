# Deployment

## Run locally

You need Node 22 or later and Postgres.

1. Install dependencies.

   ```
   npm install
   ```

2. Create the database.

   ```
   createdb fee_tracker
   ```

3. Create your settings file, then fill it in using the table below.

   ```
   cp .env.example .env
   ```

4. Create the tables and load the sample data.

   ```
   npm run db:migrate
   npm run db:seed
   ```

5. Start the app, then open http://localhost:3000.

   ```
   npm run dev
   ```

`npm run db:seed` also resets all sample data, including test payments and consent.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. Write a special character in the password as a URL code, such as `%40` for `@` |
| `SESSION_SECRET` | Yes | Signs sessions and pay links. At least 32 characters |
| `GATEWAY_WEBHOOK_SECRET` | Yes | Signs mock gateway webhooks. At least 32 characters |
| `APP_URL` | In production | Public address of the app. Defaults to `http://localhost:3000` |
| `DEMO_MODE` | For the demo | `true` shows the OTP on screen and enables the test gateway. Never use with real users |
| `APP_TODAY` | For the demo | Fixes today's date. Use `2026-11-02` to match the brief's sample data |

To generate a secret:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Demo logins

Pick a language, enter a number, and the code appears on screen.

| Number | Role | What it shows |
|---|---|---|
| `9000000002` | Parent | Ishita Sharma: part paid, 23 days overdue |
| `9000000003` | Parent | Mohit Gurjar: due in 13 days |
| `9000000001` | Parent | Aarav Meena: up to date |
| `9000001035` | Parent | Two children |
| `9000000100` | Accounts staff | Student list, ledgers and manual payments |

All people and numbers are fictional.

## How it is deployed

**Not deployed yet.** The plan is one Node host and one managed Postgres database:

1. Create the database and set the variables above on the host.
2. Run `npm run db:migrate` and `npm run db:seed` against it.
3. Build with `npm run build` and start with `npm start`.

## Checks

```
npm test            unit tests
npm run test:db     database tests, on a separate fee_tracker_test database
npm run typecheck
npm run lint
```

GitHub Actions runs all of these and a production build on every push to `main`.
