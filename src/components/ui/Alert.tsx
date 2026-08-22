import type { HTMLAttributes } from "react";
import type { BadgeTone } from "./tones";

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: "border-ok-line bg-ok-soft text-ok-ink",
  warn: "border-warn-line bg-warn-soft text-warn-ink",
  danger: "border-danger-line bg-danger-soft text-danger-ink",
  info: "border-info-line bg-info-soft text-info-ink",
  special: "border-special-line bg-special-soft text-special-ink",
  neutral: "border-line-strong bg-surface-sunken text-ink-muted",
};

export default function Alert({
  tone = "info",
  role,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: BadgeTone }) {
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : undefined)}
      className={`rounded-control border px-3.5 py-2.5 text-sm font-medium ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
