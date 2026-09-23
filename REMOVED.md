# Removed — what was taken out, and how to get it back

A holding place for code and copy deleted during cleanup, so a removal is a
decision that can be reviewed rather than something that quietly vanished.

**Do not let this file become a junkyard.** Once a removal has survived a few
weeks and nobody has wanted it back, delete its entry — git history is the
permanent record, and this file is only for things that are either (a) not yet
committed anywhere, or (b) likely to be asked about again.

---

## 2026-09-23 — comment and copy cleanup

### Recoverable straight from git

These were all committed before being edited, so the original is one command
away. `HEAD` here is `a342fd1`.

| What | Ping | Recover with |
| --- | --- | --- |
| The whole pre-prune `TransactionForm` — the `ISSUE` option, `planAllocation` preview, the "this needs a sealed pack opened" confirm screen, `approvedOpens`, and the dead `isStockIn` branches | [TransactionForm.tsx](src/components/TransactionForm.tsx) | `git show HEAD:src/components/TransactionForm.tsx` |
| "Stock-in is never against a site; the paired direct-to-site form **arrives in a later phase**." | [transactions.ts:155](src/lib/actions/transactions.ts) | `git show HEAD:src/lib/actions/transactions.ts` |
| The seven-line `noticeFor` header that quoted outcome.ts back to itself | [labels.ts:69](src/lib/approvals/labels.ts) | `git show HEAD:src/lib/approvals/labels.ts` |
| "…what a later stage branches on… **Until then** the message carries the whole meaning" | [outcome.ts:13](src/lib/approvals/outcome.ts) | `git show HEAD:src/lib/approvals/outcome.ts` |

### NOT recoverable from git — kept verbatim below

`DeliveryForm.tsx` was reworked from a destination `PillToggle` into two
separate pages (`mode: "store" | "site"`) in another session, and **that rework
is still uncommitted**. So `HEAD` holds the older toggle version, not the one
this was cut from. The text survives at `HEAD` line 351; the mode-based JSX
around it does not.

Removed from the store branch of the Destination card —
[DeliveryForm.tsx](src/components/DeliveryForm.tsx), which now renders that card
only when `destination === "SITE"`:

```tsx
          ) : (
            <Badge tone="ok">Into the store</Badge>
          )}
          <p className="text-xs font-semibold text-ink-subtle">
            One destination per challan. A supplier splitting a shipment is two deliveries.
          </p>
```

**Why it went:** in store mode nothing in that card was interactive. It stated
the destination the page had already committed to — the subtitle two inches
above reads "Goods received from a supplier, into the store" — and the "one
destination per challan" advice answered a question the UI no longer asks, since
destination stopped being a toggle when the pages were split. **Put it back if**
the two pages are ever merged again.

Also trimmed, same file: the site-mode warning went from three sentences to one
(the middle sentence restated the first), and the paste box's closing line
"Every row is yours to check before it is recorded." was dropped — the form
shows the rows, so the sentence carried no information. The load-bearing half
was kept, because it can cost real stock: *a plain number is loose stock, and
`2 x 400` is two sealed packs of 400.*

---

## Standing note: the real exposure is uncommitted work

Nothing above is as at-risk as the working tree itself. As of 2026-09-23 the
following are **uncommitted**, and a stray `git checkout --` or a crash loses
them outright:

- the `DeliveryForm` store/site mode rework (another session's work),
- the Stock_In / Stock_Out / Material Delivery / Site Returns renames,
- the `TransactionForm` prune,
- the doc updates to PROGRESS.md, README.md, REDESIGN-PLAN.md and WORKFLOW.md.

Committing is what makes a deletion reversible. This file is a second line of
defence, not the first one.
