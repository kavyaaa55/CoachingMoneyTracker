# Fee Tracker

A fee portal for a coaching institute. Parents see what they owe and pay in seconds, in Hindi or English. Accounts staff get one view of dues across all centres.

## Run locally

You need Node 22 or later and Postgres.

```
npm install
cp .env.example .env        # then fill it in, see deployment.md
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. With `DEMO_MODE=true`, the sign-in page lists demo numbers and shows the code on screen.

## Docs

- [Technical design](docs/TDD.md): architecture, decisions, data model, flows and limits
- [Deployment](deployment.md): setup, environment variables and demo logins
- [Design system](DESIGN.md): visual rules and screen plan
- [Client brief](docs/brief.txt)
- [Build order](prompt.md): what is done and what is next
