# Architecture

How the code is organised and why. Read this before the developer guide.

## The shape of the app

One Next.js application. There is **no separate API server**: pages read the database directly
on the server, and every write is a **server action** — an async function in
`src/lib/actions/*.ts` that a form or button calls. Deploying the app deploys everything.

```
browser ──► src/proxy.ts ──► page (server component) ──► prisma ──► SQLite / Turso
   │            (is anyone            reads data,
   │             signed in? may       renders HTML
   │             they see this URL?)
   │
   └─ form / button ──► server action ──► requireCapability() ──► prisma transaction
                                              (the real permission check)      │
                                                                  revalidatePath() + redirect()
```

## Folder map

| Path | What lives there |
|---|---|
| `prisma/schema.prisma` | The whole data model. Comments on the fields explain *why*, not just what. |
| `prisma/migrations/` | One folder per schema change, applied in date order. Never edit an applied one. |
| `src/app/` | One folder per URL. `page.tsx` is the page; `layout.tsx` wraps it. Route handlers are `route.ts`. |
| `src/components/` | React components shared between pages. `ui/` are the small building blocks (Button, Card, Field, Table…). Forms that need browser state are client components (`"use client"`). |
| `src/lib/` | Business logic. Most files here are **pure** — no database, no framework — so they can be unit tested. |
| `src/lib/actions/` | Server actions. Thin: authenticate, parse input, call the logic, revalidate, redirect. |
| `src/lib/approvals/` | The request-and-approve system (see below). |
| `src/lib/backup/` | Dump, restore, and reading backups from GitHub. |
| `src/proxy.ts` | Route protection. Next 16 calls what used to be `middleware.ts` a "proxy". |
| `src/generated/prisma/` | Generated Prisma client. **Gitignored**; `npm install` recreates it. |
| `scripts/` | Maintenance scripts. Each starts with a comment saying what it does and how to run it. |

## The ideas the design rests on

### 1. Stock is derived, and there are two truths — not three

- **`PackStock`** counts *sealed* packs by size (two sealed 400 m rolls are interchangeable).
- **`OpenPack`** tracks each *opened* pack individually with its own `remaining` (a 30 m and a
  50 m offcut are not interchangeable).
- **`Item.currentStock` / `scrapStock` are a cache** of those two. `recalcItemStock()` in
  `src/lib/packs.ts` is the only thing allowed to write them. Never assign to them directly.
- **A shelf slot records which item is in a box, never how much.** Quantity is derived.
- **A site's holding is derived by replaying the ledger** (`src/lib/siteBalance.ts`), never
  stored. This is why old transactions can never be purged.

### 2. Every movement is a `Transaction` row, in the item's base unit

`Transaction.quantity` is **always in the item's `baseUnit`** (metres, pieces…) for every type
(`STOCK_IN`, `ISSUE`, `RETURN`, `CONSUME`, `TRANSFER`, `ADJUSTMENT`, `REVERSAL`, …). Pack size and
piece lists on the row are display-only metadata — never do arithmetic on them. Each row also
carries `appliedPlan`, a record of exactly which packs it touched, which is what makes an exact
**reversal** possible later.

### 3. Nothing opens a sealed pack silently

`src/lib/allocation.ts` is a pure planner that decides which packs to cut from (best fit: the
smallest open pack that is big enough). If the plan needs a sealed pack opened, the user sees it
and confirms. On submit, `commitAllocation()` in `packs.ts` **re-plans inside the database
transaction** rather than trusting the client's plan — someone else may have taken stock in the
meantime — and refuses if more packs need opening than the user saw.

### 4. Permissions are capabilities, and asking is not having

- `src/lib/capabilities.ts` holds two tables: `CAPABILITIES` (what a role may do, alone, now) and
  `REQUESTABLE` (what a role may *ask an admin* to do). It imports nothing, so it is unit tested.
- `can(role, capability)` is the hard gate. **`canRequest()` never softens it.**
- `requireCapability()` inside each server action is the real enforcement. Hiding a button, or
  the route check in `proxy.ts`, is convenience only — server actions are network endpoints and
  can be called directly.
- Adding a role or changing what one can do is an edit to `capabilities.ts` and nothing else.

### 5. The approval queue

A **Finance** user who tries something only an admin may do gets an `ApprovalRequest` row instead
of a refusal. (Today that applies to two things only, **site deletion** and **stock adjustment**:
the other operations in the registry were moved to outright Finance permission on 2026-09-30 but
are kept registered so requests already queued can still be decided, and so a capability can be
put back behind approval by changing `REQUESTABLE` alone.) An admin sees it at `/approvals`, with a live check of what would happen *now*, and
approving **runs the operation** as the requester.

- `kinds.ts` — the list of request types and their argument shapes (pure).
- `registry.ts` — binds each type to the code that executes it.
- `ops/*.ts` — the operations themselves, as plain functions over a database transaction.
- `runOrRequest.ts` — the three-way gate every guarded action goes through:
  *holds the capability → do it now · may only ask → enqueue · neither → refuse*.
- The claim of a request and the work it triggers share one transaction, so two admins answering
  at once cannot run it twice.

**Naming trap:** "approval" is used for two unrelated things. `ApprovedOpens` / `needsApproval`
(packs, transactions, dispatches) is the *in-form* "yes, open this sealed pack" confirmation.
Everything under `approvals/` is the *role-based* queue. They share nothing.

**Accounts and backups can never go through the queue.** An approval flow that could create an
admin, or restore a backup (which would erase the record of who approved it), defeats itself.
Tests in `capabilities.test.ts` and `args.test.ts` enforce this.

### 6. `"use server"` files publish every export

Every async function exported from a `"use server"` file becomes a public HTTP endpoint. So
`src/lib/actions/*.ts` contain only the entry points, each one guarded. Anything that must run
*without* a permission check (for example the body of an approved operation) lives in a plain
module (`src/lib/approvals/ops/`) that the action files import — never the reverse.

### 7. Pure modules run in the browser too

`allocation.ts`, `units.ts`, `capabilities.ts` and similar are imported by client components.
They must not import Node APIs, Prisma or NextAuth, or the forms stop working.

## Documents (challans)

A **Dispatch** groups the `ISSUE` transactions of one batch to a site and carries a unique,
auto-generated challan number from the **`Sequence`** table (`SCE/DC/0042`). Transfers have
their own series (`SCE/TC/…`), and the per-site **Material Statement** is numbered by date.
Numbers come from an atomic `UPDATE … value = value + 1` inside the same transaction as the
dispatch, so a failed batch does not burn a number and two simultaneous batches cannot collide.
The printable sheet is `src/components/ChallanSheet.tsx`; print styling is in `globals.css`
under `@media print`.

Three rules that look like bugs and are not: reversed lines never print; the Total row is
suppressed when lines use different units; and challan numbers cannot be typed or edited.

**Site Delivery** (`/site-deliveries/new`) is a *paper-only* challan: free-text lines, no item,
no transaction, no effect on stock.

## Database access

- `src/lib/prisma.ts` is the only place a client is created. Prisma 7 needs an explicit
  **driver adapter**; this app uses the libSQL adapter for both the local file and Turso.
- `src/lib/databaseUrl.ts` refuses to start in production without `DATABASE_URL`, instead of
  silently using an empty local file.
- Multi-step writes use `prisma.$transaction(...)`. In production the interactive-transaction
  timeout is raised to 20 s (`runOrRequest.ts`) because sequential statements over a network to
  Turso add up — which is why `vercel.json` pins the hosting region next to the database.

## Testing

`npm test` runs every `src/**/*.test.ts` with Node's built-in runner. Pure modules are tested
directly. Database-touching tests use `src/lib/testDb.ts`, which builds a **fresh temporary
SQLite database** through the real migrations — never `dev.db`, never Turso.

What is **not** covered: the server actions themselves (they call NextAuth, which needs mocking
that does not exist). The logic they call is tested; the wiring is verified by hand in the
browser. Treat that as the biggest risk when changing an action.
