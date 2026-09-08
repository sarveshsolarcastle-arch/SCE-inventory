/* -------------------------------------------------------------------------
 * Who we are, for anything that gets printed.
 *
 * One constant rather than literals in the challan page, so the day a phone
 * number changes it changes in one place — and so switching back to pre-printed
 * letterhead is a matter of blanking these fields rather than editing a layout.
 *
 * FILL THESE IN. Every field is optional to the renderer: a blank string is
 * omitted from the printed block entirely rather than printed as an empty
 * label, so an unfinished value shows as absent instead of as "GSTIN: —".
 * ---------------------------------------------------------------------- */

export type CompanyDetails = {
  name: string;
  /** Lines of the postal address, printed one per line. */
  addressLines: readonly string[];
  phone: string;
  email: string;
  website: string;
  gstin: string;
};

export const COMPANY: CompanyDetails = {
  name: "Solar Castle Energy Pvt Ltd",
  addressLines: [
    "H. No. 923/207, Raghuram, Aradi Socorro,",
    "Opposite 20 Point Programme, Porvorim, Goa – 403501",
  ],
  phone: "9226552908",
  email: "sales@solarcastle.in",
  website: "www.solarcastle.in",
  gstin: "",
};

/** The labelled lines of the company block, with blanks dropped. Pure, so the
 * "omit rather than print an empty label" rule is testable and cannot drift
 * between the header block and anywhere else that prints these. */
export function companyContactLines(
  company: CompanyDetails = COMPANY,
): { label: string; value: string }[] {
  return (
    [
      { label: "Phone No.", value: company.phone },
      { label: "Email", value: company.email },
      { label: "Website", value: company.website },
      { label: "GSTIN", value: company.gstin },
    ] as const
  )
    .filter((line) => line.value.trim().length > 0)
    .map((line) => ({ label: line.label, value: line.value.trim() }));
}
