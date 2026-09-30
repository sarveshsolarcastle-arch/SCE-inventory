# Developer guide

Day-to-day working on the codebase, by hand. Read [ARCHITECTURE.md](ARCHITECTURE.md) first.

The code carries a lot of explanatory comments on purpose. When you open a file, read its
opening comment block: it says what the file is for, and most of the non-obvious files also say
what *not* to do to it and why.

## Before you commit — every time

```bash
npx tsc --noEmit    # types
npm run lint        # style/bugs
npm test            # unit tests
```

All three must pass. For anything visible, also run `npm run dev`, click through the change
**as each role that can reach it**, and **look at the browser console** — several real bugs
here passed every automated check and only showed as console errors.

## The two-database trap

The same code runs against a local SQLite file (`dev.db`) and the live Turso database. Which one
you hit is decided by `DATABASE_URL`, and **nothing on screen tells you which**.

- `next dev` reads `.env.local` *before* `.env`.
- The **Prisma CLI** (`prisma migrate`, `prisma studio`, `prisma generate`) and every
  `tsx scripts/*.ts` read **`.env` only** — they do not know about `.env.local`.

So if a `.env` on your machine points at production, `npm run dev` can be made safe with a
`.env.local` override, but `npx prisma migrate …` and any script **will still hit production**.
Two habits fix this:

1. Do not keep production credentials in `.env` on a development machine at all.
2. Prefix anything database-related with the target, e.g.
   `DATABASE_URL="file:./dev.db" npx prisma migrate deploy`
   (on Windows PowerShell: `$env:DATABASE_URL="file:./dev.db"; npx prisma migrate deploy`).

Scripts that change data require you to type a fragment of the URL you believe you are pointed
at (`--yes-wipe <fragment>` and similar) and refuse if it does not match. Do not work around that.

## Recipes

### Add a page

1. Create `src/app/<path>/page.tsx` (a server component — it can `await prisma…` directly).
2. If only some roles should see it, add its prefix to `ROUTE_CAPABILITIES` in `src/proxy.ts`
   **and** call `await requireCapability("…")` at the top of the page. The proxy is a courtesy;
   the call in the page is what counts.
3. To put it in the sidebar, add an entry to `NAV_GROUPS` in `src/components/nav/navLinks.ts`
   (`capability: null` means every signed-in user sees it).
4. Use the building blocks in `src/components/ui/` so it looks like the rest of the app.

### Add a write action (a button or form that changes data)

Copy the shape of `src/lib/actions/items.ts`:

```ts
"use server";
export async function doThing(formData: FormData) {
  "use server";
  await requireCapability("some:capability");   // 1. authorise FIRST
  const args = parse(formData);                 // 2. validate; never trust the form
  await prisma.$transaction(async (tx) => {     // 3. one transaction for the whole write
    …
  });
  revalidatePath("/affected-page");             // 4. refresh cached pages
  redirect("/where-to-go-next");                // 5. redirect LAST, outside the transaction
}
```

Rules that have bitten this project:

- `redirect()` works by throwing. Inside a `try` or a transaction it aborts the write. Call it
  last, outside both.
- Never export a helper from a `"use server"` file "for internal use" — it becomes a public
  endpoint. Put shared logic in a plain module under `src/lib/`.
- Read only the form fields you mean to, by name, then validate. Looping over all of `FormData`
  once broke stock counting for two phases because it swept up a text field.
- Anything that changes stock must end by calling `recalcItemStock()` for the item, and must
  create a `Transaction` row with the quantity in the item's `baseUnit`.

### Add or change a permission

Edit `src/lib/capabilities.ts` only:

1. Add the name to the `Capability` type and to `ALL_CAPABILITIES`.
2. Grant it to roles in `CAPABILITIES`.
3. If a role may *ask* for it instead of holding it, list it in `REQUESTABLE` (never for
   `user:manage` or `backup:manage`).
4. Update `capabilities.test.ts` — it pins the exact tables, so the test fails until you say on
   purpose what changed.
5. Use it: `requireCapability("…")` in the action, `ROUTE_CAPABILITIES` in `proxy.ts`, and
   `capabilityMode(role, "…")` in the UI to decide between "Do it", "Request it" and "hidden".

### Make a new action go through the approval queue

See the header of `src/lib/approvals/registry.ts`. In short: add a kind and argument type in
`kinds.ts`, a parser in `args.ts`, the operation in `ops/`, register it in `registry.ts`, add its
one-line summary in `summary.ts` and the pages to refresh in `revalidate.ts`, then call it from
the action with `runOrRequest("your.kind", args)`. `args.test.ts` has an invariant that every
kind must be requestable by some role.

### Change the database schema

1. Edit `prisma/schema.prisma`.
2. `DATABASE_URL="file:./dev.db" npm run db:migrate:dev -- --name short_description` — creates a
   folder in `prisma/migrations/` and applies it to `dev.db`. Open the generated SQL and read it.
3. **Restart the dev server.** It caches the generated client; a stale one shows up as baffling
   "Unknown argument" errors that look like code bugs.
4. If the migration backfills existing rows, **test it against a scratch database holding several
   rows in awkward order** — one migration once numbered every row `1` because the development
   database happened to contain a single row.
5. Add the new field to `prisma/seed.ts` / `scripts/seed-demo.ts` if demo data should show it.
   (The demo seeder has fallen behind new models twice — check it.)
6. Production is migrated separately: see [DEPLOYMENT.md](DEPLOYMENT.md#migrating-the-production-database).
   **Deploy order matters** when a migration adds a NOT NULL column with no default: the old code
   must not run against the new schema.
7. Never edit a migration that has already been applied anywhere.

### Change stock logic

`src/lib/allocation.ts` (planning) and `src/lib/packs.ts` (applying) are the heart of the app.
Both have tests; read `allocation.test.ts` and `packs.test.ts` first and add a case for your
change before touching the code. Note that `planAllocation` deliberately *mutates* the snapshot
it is given (so a batch of rows competes for the same stock) — pass `cloneSnapshot()` if you need
the original.

### Write a test

Put `something.test.ts` next to the file. Import with **relative paths and `.ts` extensions**
(the runner does not understand the `@/` alias). For database behaviour use
`createTestDb()` from `src/lib/testDb.ts` (a throwaway migrated SQLite file). Keep logic in pure
functions where you can; they are trivial to test.

## Making a data fix in production

Do not edit the production database by hand. Write a script in `scripts/` modelled on
`reset-data.ts` or `cleanup-prod-2026-09-24.ts`:

- takes the confirmation-fragment argument and refuses on mismatch;
- takes a backup first (`dumpDatabase()` from `src/lib/backup/dump.ts`);
- does the change in one transaction and prints what it changed;
- is run against a copy of the data (`dev.db`) first.

The dated scripts already in `scripts/` are the record of what was done to production and are
good worked examples. Do not re-run them.

## Known sharp edges

- **A stale login cookie can lock a user out** (a valid cookie naming a user that no longer
  exists leaves a blank page and `/login` bounces them back). Clearing site cookies is the escape.
  Details and the intended fix are in PROGRESS.md §7.
- **`Item.currentStock` is a cache.** If a number on screen looks wrong, check the packs first.
- **Server actions are the untested layer.** After changing one, exercise it in the browser as
  every role, including one that should be refused.
- **`vercel.json` region.** Do not remove it; see [DEPLOYMENT.md](DEPLOYMENT.md).
- **`src/lib/backup/github.ts` hard-codes the GitHub owner and repository name.** If the
  repository is ever renamed or moved to a different owner, update `OWNER` and `REPO` there or
  the in-app Backups page will look in the wrong place.

## Style

- TypeScript strict; no `any` without a comment saying why.
- Comment the *why*: the constraint, the past bug, the rejected alternative. The code already
  says what it does. Keep comments true — update them in the same commit as the code.
- Prefer deriving a value over storing it; prefer making a wrong state impossible over
  documenting that nobody should create it.
