# Deployment

How to run Fee Tracker locally, deploy it on the AWS free tier, and sign in as a reviewer.

- [Demo logins](#demo-logins)
- [Run locally](#run-locally)
- [Environment variables](#environment-variables)
- [Deploy on AWS](#deploy-on-aws)
- [Update, reset and shut down](#update-reset-and-shut-down)
- [Troubleshooting](#troubleshooting)
- [Checks](#checks)

**Status:** not deployed yet. The AWS guide is written from the code and AWS documentation. A production build was started and tested locally, but the guide has not yet been run on a live AWS account.

## Demo logins

Pick a language, enter a number, and the 6-digit code appears on screen, because SMS is mocked. All people and numbers are fictional.

| Number | Role | What it shows |
|---|---|---|
| `9000000002` | Parent | Ishita Sharma: part paid, 23 days overdue |
| `9000000003` | Parent | Mohit Gurjar: due in 13 days |
| `9000000001` | Parent | Aarav Meena: up to date |
| `9000001035` | Parent | Two children |
| `9000000100` | Accounts staff | Dues, students, ledgers, reminders, call tasks and refunds |

**A short tour:**

1. Sign in as `9000000002` in Hindi. Agree to the consent notice, then pay through the test gateway. Try "Pay part" and "Pay too much" too.
2. Sign in as `9000000100`. Open Dues to see ageing, the unmatched queue and the Tally export.
3. Open Students, then Ishita Sharma, then Work out refund. Leaving on 12 Oct 2026 gives ₹10,808.
4. Open Reminders and press Run reminders now. Open Call tasks and mark a false flag.

The refund policy is public at `/refund-policy`.

## Run locally

You need Node 22 or later and Postgres 14 or later.

1. Get the code and install dependencies.

   ```
   git clone https://github.com/Siddhesh-source/coaching_institute.git
   cd coaching_institute
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

   Generate each secret with:

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
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

`npm run db:seed` resets all sample data, including test payments, consent and call tasks.

## Environment variables

Names only. Never commit the values.

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. Write a special character in the password as a URL code, such as `%40` for `@` |
| `SESSION_SECRET` | Yes | Signs sessions and pay links. At least 32 characters |
| `GATEWAY_WEBHOOK_SECRET` | Yes | Signs mock gateway webhooks. At least 32 characters |
| `CRON_SECRET` | Yes | Protects the daily reminders and risk routes. At least 32 characters |
| `APP_URL` | In production | Public address of the app, with `https://`. Defaults to `http://localhost:3000` |
| `DEMO_MODE` | For the demo | `true` shows the OTP on screen and enables the test gateway. Never use with real users |
| `APP_TODAY` | For the demo | Fixes today's date. Use `2026-11-02` to match the brief's sample data |

## Deploy on AWS

### What you are building

```
Browser -> Caddy on port 443 (free HTTPS) -> Next.js on port 3000 -> Postgres
                       one small EC2 server runs all three
           cron on the same server calls the two daily jobs
```

One server is the cheapest setup that works, and it suits a demo. A real rollout should move the database to RDS, as described in [Option: use RDS](#option-use-rds).

HTTPS is required, not optional. In production the session cookie is marked secure, so sign-in does not work over plain `http://`.

### Before you start: what "free" means now

- **New accounts get credits, not the old 12 free months.** AWS accounts created since 15 July 2025 get $100 in credits, and can earn up to $100 more by trying services.
- **The Free plan ends** after 6 months or when the credits run out, whichever comes first.
- **EC2 and storage use up your credits.** So does the public IP address, at $0.005 an hour unless your account has an allowance.
- **Older accounts** on the legacy Free Tier have their own limits, so check those instead.

AWS changes these terms. Confirm them on the [AWS Free Tier page](https://aws.amazon.com/free/) before you start.

### 1. Protect yourself from a bill

1. Create the account and sign in. Choose the **Free plan**, which cannot charge you beyond its credits.
2. Turn on multi-factor sign-in for the root user.
3. Open **Billing > Budgets** and create a monthly cost budget of $5 with an email alert. This also counts as one of the credit-earning activities.

### 2. Launch the server

In the EC2 console, pick the **Asia Pacific (Mumbai)** region, which is closest to Jaipur, then **Launch instance**.

| Setting | Value |
|---|---|
| Name | `fee-tracker` |
| Image | Ubuntu Server 24.04 LTS, x86 |
| Instance type | `t3.micro`, or another 1 GB or larger x86 type labelled **Free tier eligible** in the console. Eligibility varies, so trust that label |
| Key pair | Create one and download the `.pem` file |
| Storage | 20 GB gp3 |
| Inbound rules | SSH (22) from **My IP** only. HTTP (80) and HTTPS (443) from anywhere |

Do not open ports 3000 or 5432.

Then open **Elastic IPs**, allocate one, and associate it with this instance, so the address survives a restart. Below, `3.110.20.30` stands for your address.

### 3. Prepare the server

Connect, then add swap. Building Next.js on 1 GB of memory fails without it.

```
ssh -i fee-tracker.pem ubuntu@3.110.20.30

sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Install Node 22, Postgres and Caddy.

```
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql caddy git
```

### 4. Create the database

```
DB_PASSWORD=$(openssl rand -hex 16)
sudo -u postgres psql -c "CREATE USER fee_tracker WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres createdb -O fee_tracker fee_tracker
echo "$DB_PASSWORD"
```

Keep that password for the next step.

### 5. Install the app

The repository must be public first, or add a deploy key.

```
cd ~
git clone https://github.com/Siddhesh-source/coaching_institute.git
cd coaching_institute
npm ci
cp .env.example .env
chmod 600 .env
nano .env
```

Set these values. Run `openssl rand -hex 32` once for each secret.

```
DATABASE_URL=postgres://fee_tracker:YOUR_DB_PASSWORD@localhost:5432/fee_tracker
SESSION_SECRET=
GATEWAY_WEBHOOK_SECRET=
CRON_SECRET=
APP_URL=https://3-110-20-30.sslip.io
DEMO_MODE=true
APP_TODAY=2026-11-02
```

`sslip.io` is a free service that points that name at your IP address, so you get HTTPS without buying a domain. Note the dashes. If you own a domain, point it at the Elastic IP and use that instead.

Then build it.

```
npm run db:migrate
npm run db:seed
npm run build
```

### 6. Keep it running

```
sudo tee /etc/systemd/system/fee-tracker.service > /dev/null <<'EOF'
[Unit]
Description=Fee Tracker
After=network.target postgresql.service

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/coaching_institute
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now fee-tracker
```

### 7. Turn on HTTPS

```
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
3-110-20-30.sslip.io {
    reverse_proxy 127.0.0.1:3000
}
EOF

sudo systemctl reload caddy
```

Caddy gets and renews the certificate on its own. Open `https://3-110-20-30.sslip.io`.

### 8. Schedule the daily jobs

This runs reminders and the risk check at 9:00 in India, which is 3:30 on the server's UTC clock.

```
cat > ~/run-jobs.sh <<'EOF'
#!/bin/sh
SECRET=$(grep '^CRON_SECRET=' /home/ubuntu/coaching_institute/.env | cut -d= -f2)
for job in reminders risk; do
  curl -fsS -H "Authorization: Bearer $SECRET" "http://127.0.0.1:3000/api/cron/$job"
  echo
done
EOF
chmod 700 ~/run-jobs.sh
(crontab -l 2>/dev/null; echo '30 3 * * * /home/ubuntu/run-jobs.sh >> /home/ubuntu/jobs.log 2>&1') | crontab -
```

Both jobs are safe to run more than once.

### 9. Check it works

```
~/run-jobs.sh
```

You should see two lines of counts. Then, in a browser:

1. Sign in as `9000000100` and check that Dues shows figures.
2. Sign in as `9000000002`, agree to consent, and pay through the test gateway. The instalment should update, which proves the webhook reaches the app through `APP_URL`.
3. Call a job with no secret, which should return 401:

   ```
   curl -i https://3-110-20-30.sslip.io/api/cron/risk
   ```

Add the live address to the top of `docs/TDD.md`.

### Option: use RDS

For a managed database with backups, create an RDS PostgreSQL `db.t4g.micro`, Single-AZ, 20 GB, with no public access, and allow port 5432 only from the EC2 security group. Then set:

```
DATABASE_URL=postgres://USER:PASSWORD@YOUR-RDS-ENDPOINT:5432/fee_tracker?sslmode=require
```

RDS uses up credits faster than Postgres on the server. It is the right choice for real data, and more than a demo needs.

### Before real users

The demo settings are not for production. For a real rollout:

- Remove `APP_TODAY` and set `DEMO_MODE=false`, which also removes the test gateway.
- Connect a real SMS provider and payment gateway. Both are mocked here.
- Use RDS with backups, and your own domain.

## Update, reset and shut down

| Task | Commands |
|---|---|
| Deploy a new version | `cd ~/coaching_institute && git pull && npm ci && npm run db:migrate && npm run build && sudo systemctl restart fee-tracker` |
| Reset the demo data | `cd ~/coaching_institute && npm run db:seed` |
| Read the app log | `journalctl -u fee-tracker -f` |
| Read the job log | `tail ~/jobs.log` |

**After the review,** terminate the instance and release the Elastic IP. A stopped instance still pays for its storage, and an Elastic IP is charged even when idle.

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| Sign-in returns to the sign-in page | The site is on `http://`. Secure cookies need HTTPS. Use the `https://` address |
| Payment says it failed, though the page loaded | `APP_URL` does not match the public address, so the webhook cannot arrive. Fix `.env` and restart |
| `npm run build` is killed | Out of memory. Check the swap with `free -h` |
| App will not start, with an error about a variable | A required value in `.env` is missing, or a secret is under 32 characters |
| Caddy cannot get a certificate | Ports 80 and 443 must be open. `sslip.io` shares rate limits with other users, so use your own domain if it keeps failing |
| Password error from the database | Write special characters in the password as URL codes, or use a hex password |

## Checks

```
npm test            unit tests
npm run test:db     database tests, on a separate fee_tracker_test database
npm run typecheck
npm run lint
npm run build
```

GitHub Actions runs all of these on every push to `main`.

## Sources for the AWS terms

Checked on 5 Nov 2026. Most are third-party summaries, so confirm on the AWS pages.

- [AWS Free Tier documentation](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html)
- [What every new AWS account gets in 2026](https://builder.aws.com/content/3Iv9tJEEumjb9aFubl1zmd53SlP/the-aws-free-tier-changed-what-every-new-account-gets-in-2026-and-the-five-things-to-set-up-on-day-one)
- [Public IPv4 address charge](https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/)
- [Amazon VPC pricing](https://aws.amazon.com/vpc/pricing/)
