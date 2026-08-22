import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/** The house pattern that stops a wide table breaking the page. Only this
 * primitive may clip overflow — Card never does (see Card.tsx). */
export function TableWrap({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`overflow-x-auto ${className}`} {...props} />;
}

export function Table({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableElement> & { bare?: boolean }) {
  return <table className={`w-full border-collapse text-sm ${className}`} {...props} />;
}

export function THead({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-surface-sunken ${className}`} {...props} />;
}

export function Th({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`border-b border-line px-4 py-2.5 text-left text-[11px] font-bold tracking-wide text-ink-subtle uppercase whitespace-nowrap ${className}`}
      {...props}
    />
  );
}

export function Tr({
  tone,
  className = "",
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { tone?: "danger" }) {
  return (
    <tr
      className={`border-b border-line last:border-0 hover:bg-surface-sunken ${
        tone === "danger" ? "bg-danger-soft" : ""
      } ${className}`}
      {...props}
    />
  );
}

export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 align-middle ${className}`} {...props} />;
}
