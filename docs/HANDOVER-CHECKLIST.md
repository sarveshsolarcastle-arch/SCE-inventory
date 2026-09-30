# Handover checklist

For the person taking this system over. Work through it in the first week. Nothing here needs
new code.

## 1. Get access to everything

- [ ] **GitHub** — admin access to the `SCE-inventory` repository, and the repository is
      **private** (Settings → General → Danger Zone → Change visibility).
- [ ] **Vercel** — access to the project that serves the app; check the deployment settings
      (region `bom1`, the Ignored Build Step for the `backups` branch, environment variables).
- [ ] **Turso** — access to the production database's dashboard.
- [ ] Ability to sign in to the app as an **admin**.

## 2. Rotate every credential

The people who built the system had these credentials. Assume they still have them.

- [ ] **Turso auth token** — create a new one in the Turso dashboard, revoke the old one, then
      update it in **both** Vercel and GitHub Actions secrets.
- [ ] **`AUTH_SECRET`** — generate a new random value in Vercel (`openssl rand -base64 32`).
      Everyone is signed out; that is expected.
- [ ] **`GITHUB_BACKUP_TOKEN`** — issue a new fine-grained, read-only token for this repository
      under a company-owned GitHub account; replace it in Vercel; delete the old one.
- [ ] **GitHub** — review who has access to the repository and remove anyone who should not.

## 3. Fix the app's own accounts

- [ ] Sign in as an admin and open **Users**. Change every password.
- [ ] **Deactivate** the seeded example accounts (`admin@example.com`, `finance@example.com`,
      `employee@example.com`) if they exist in production. Their passwords are in the README and
      in the seed script — they are public knowledge to anyone who has read the code.
- [ ] Confirm each real staff member has their own login (accounts are deactivated, never
      deleted — every stock movement is attributed to a user).

## 4. Confirm the backups actually work

- [ ] GitHub → Actions → **Nightly database backup** → *Run workflow*. Check it succeeds and a
      new file appears on the `backups` branch.
- [ ] Keep a second copy somewhere the company controls: on `/backups`, **Download** a dump and
      store it off-site (the GitHub branch is the only automatic copy).
- [ ] Do a **restore drill** while the data is small enough to risk: restore that fresh backup
      from `/backups`. Nobody has yet proven the Restore button against production.

## 5. Read, in this order

1. [README](../README.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [DEVELOPER-GUIDE.md](DEVELOPER-GUIDE.md)
4. [DEPLOYMENT.md](DEPLOYMENT.md)
5. [WORKFLOW.md](../WORKFLOW.md) — how the staff are meant to use it
6. [PROGRESS.md](../PROGRESS.md) §10 and [REDESIGN-PLAN.md](../REDESIGN-PLAN.md) — the reasoning
   behind the rules, including the ones that look wrong

## 6. Set up a development machine

- [ ] Follow the README quick start. Use `dev.db`, **never** the production database, for
      development. See the "two-database trap" in the developer guide before running any
      Prisma or script command.
- [ ] Run `npm test` — everything should pass on a clean checkout.
- [ ] Load the demo data (`npm run db:seed:demo`) and click through dispatch, delivery, transfer
      and a challan print as both an admin and a finance user.

## 7. Known open items at handover

These are recorded in more detail in [PROGRESS.md](../PROGRESS.md) §7 and
[STATUS.md](STATUS.md):

- A stale session cookie for a deleted user leaves a blank page with no way back in (workaround:
  clear cookies; fix designed but not built).
- The server actions have no automated tests; only the logic they call does.
- The restore drill above has not been done against production.
- The repository was public for part of its life and its `backups` branch history contains
  older database dumps. **Treat everything in those dumps as exposed** — including user password
  hashes — and change every real password (step 3).
- `docs/STATUS.md` and `PROGRESS.md` are dated history; where they disagree with the code, the
  code is right.
