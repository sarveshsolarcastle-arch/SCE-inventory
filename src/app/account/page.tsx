import { redirect } from "next/navigation";
import { currentUser } from "@/lib/permissions";
import { changeOwnPassword } from "@/lib/actions/users";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import type { BadgeTone } from "@/components/ui/tones";
import type { Role } from "@/generated/prisma/enums";
import { ShieldCheck, KeyRound } from "lucide-react";

const ROLE_TONE: Record<Role, BadgeTone> = {
  ADMIN: "special",
  FINANCE: "info",
  EMPLOYEE: "ok",
};

const ROLE_BLURB: Record<Role, string> = {
  ADMIN: "You can do everything, including reversing and adjusting stock, accounts and backups.",
  FINANCE:
    "You receive deliveries, own the catalogue, dispatch to sites and record returns. You cannot reverse or adjust stock, manage sites or shelves, or reach accounts and backups.",
  EMPLOYEE:
    "You move material to and from sites. This role has been retired — ask an admin to move you to Finance, which now covers the same work and more.",
};

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader title="Your account" subtitle={user.name ?? undefined} />

      <Card>
        <CardHeader>
          <CardTitle
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            tone={ROLE_TONE[user.role]}
          >
            Role
          </CardTitle>
          <Badge tone={ROLE_TONE[user.role]}>{user.role}</Badge>
        </CardHeader>
        <CardBody className="space-y-2">
          <p className="text-sm font-medium text-ink-muted">{ROLE_BLURB[user.role]}</p>
          <p className="text-sm font-medium text-ink-subtle">
            Only an admin can change your role.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={<KeyRound className="h-3.5 w-3.5" />} tone="warn">
            Change your password
          </CardTitle>
        </CardHeader>
        <CardBody>
          <form action={changeOwnPassword} className="max-w-md space-y-4">
            <Field label="Current password" htmlFor="currentPassword">
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password" htmlFor="newPassword">
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirmPassword">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            <Button type="submit">Change password</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
