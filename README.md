# Fee Tracker

A fee portal for a coaching institute. Parents see what they owe and pay in seconds, in Hindi or English. Accounts staff get one view of dues across all centres.

## Run locally

You need Node 22 or later and Postgres.

```
npm install
cp .env.example .env        # then set DATABASE_URL and SESSION_SECRET
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. With `DEMO_MODE=true`, the sign-in page lists demo numbers and shows the code on screen.

## Docs

- `docs/brief.txt`: the client brief
- `DESIGN.md`: design system and screen plan
- `prompt.md`: build order and status
