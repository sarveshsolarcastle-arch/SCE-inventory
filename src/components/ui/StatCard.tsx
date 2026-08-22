import Link from "next/link";
import type { ReactNode } from "react";
import type { BadgeTone } from "./tones";

const ICON_TONE: Record<BadgeTone, string> = {
  ok: "bg-ok-soft text-ok-ink",
  warn: "bg-warn-soft text-warn-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  special: "bg-special-soft text-special-ink",
  neutral: "bg-surface-sunken text-ink-muted",
};

/** A thin coloured edge along the top of the card — enough to tell the cards
 * apart at a glance without tinting whole card backgrounds, which would fight
 * the light/warm direction the rest of the app uses. */
const EDGE_TONE: Record<BadgeTone, string> = {
  ok: "bg-ok-ink",
  warn: "bg-warn-ink",
  danger: "bg-danger-ink",
  info: "bg-info-ink",
  special: "bg-special-ink",
  neutral: "bg-line-strong",
};

function StatCardBody({
  label,
  value,
  tone,
  alert,
  icon,
  note,
}: {
  label: string;
  value: ReactNode;
  tone: BadgeTone;
  alert?: boolean;
  icon?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <>
      <span className={`absolute inset-x-0 top-0 h-1 rounded-t-card ${EDGE_TONE[tone]}`} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-ink-muted">{label}</p>
        {icon && (
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-control ${ICON_TONE[tone]}`}
          >
            {icon}
          </div>
        )}
      </div>
      <p
        className={`mt-2 text-2xl font-extrabold tracking-tight ${
          alert ? "text-danger-ink" : "text-ink"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-xs font-semibold text-ink-subtle">{note}</p>}
    </>
  );
}

export default function StatCard(props: {
  label: string;
  value: ReactNode;
  /** Explicit prop rather than a className override: competing Tailwind
   * declarations resolve by CSS source order, not prop order. */
  tone?: BadgeTone;
  /** Forces the danger tone and reddens the figure — for a count that is bad
   * news only when it is non-zero. */
  alert?: boolean;
  icon?: ReactNode;
  note?: ReactNode;
  href?: string;
}) {
  const { href, tone, alert, ...rest } = props;
  const resolvedTone: BadgeTone = alert ? "danger" : (tone ?? "info");
  const classes =
    "relative block overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-raised";
  const body = <StatCardBody {...rest} tone={resolvedTone} alert={alert} />;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  return <div className={classes}>{body}</div>;
}
