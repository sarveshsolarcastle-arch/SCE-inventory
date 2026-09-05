import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, currentUser } from "@/lib/permissions";
import {
  createUser,
  setUserRole,
  setUserActive,
  resetUserPassword,
} from "@/lib/actions/users";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import { Field, Input, Select } from "@/components/ui/Field";
import type { BadgeTone } from "@/components/ui/tones";
import type { Role } from "@/generated/prisma/enums";
import { UserPlus, Users } from "lucide-react";

const ROLE_TONE: Record<Role, BadgeTone> = {
  ADMIN: "special",
  FINANCE: "info",
  EMPLOYEE: "ok",
};

/** What each role is *for*, shown next to the picker — not guessable from the
 * name, and less so since finance absorbed the employee workspace. */
const ROLE_BLURB: Record<Role, string> = {
  ADMIN: "Everything, including reversing and adjusting stock, accounts and backups.",
  FINANCE:
    "Day-to-day stock work: receives deliveries, owns the catalogue, dispatches to sites and records returns. Cannot reverse or adjust stock, manage sites or shelves, or touch accounts and backups.",
  EMPLOYEE:
    "Retired — do not assign. Moves material to and from sites; finance now does this too. Move anyone still on it to Finance.",
};

export default async function UsersPage() {
  const user = await currentUser();
  // Page-level gating is convenience; every action re-checks for itself.
  if (!can(user?.role, "user:manage")) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { transactions: true } },
    },
  });

  const activeAdmins = users.filter((u) => u.role === "ADMIN" && u.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        subtitle={`${users.length} account${users.length === 1 ? "" : "s"} · ${activeAdmins} active admin${activeAdmins === 1 ? "" : "s"}`}
      />

      {activeAdmins === 1 && (
        <Alert tone="warn">
          Only one active admin. If that account is lost there is no way back in from
          inside the app — consider promoting a second person.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon={<UserPlus className="h-3.5 w-3.5" />} tone="ok">
            Add someone
          </CardTitle>
        </CardHeader>
        <CardBody>
          <form action={createUser} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" required autoComplete="off" />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" required autoComplete="off" />
            </Field>
            <Field label="Temporary password" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="text"
                required
                minLength={8}
                autoComplete="off"
                placeholder="At least 8 characters"
              />
            </Field>
            <Field label="Role" htmlFor="role">
              {/* Defaults to Finance, not Employee: Employee is retired and a new
                  account should never land on it. It stays in the list only so an
                  existing holder's row can render its own value. */}
              <Select id="role" name="role" defaultValue="FINANCE" required>
                <option value="FINANCE">Finance</option>
                <option value="ADMIN">Admin</option>
                <option value="EMPLOYEE">Employee — retired, do not assign</option>
              </Select>
            </Field>
            <p className="text-sm font-medium text-ink-subtle sm:col-span-2">
              The password is shown as you type it so you can pass it on. Ask them to
              change it from their own Account page once they are in.
            </p>
            <div className="sm:col-span-2">
              <Button type="submit">Create account</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={<Users className="h-3.5 w-3.5" />} tone="info">
            Everyone
          </CardTitle>
          <span className="text-xs font-semibold text-ink-subtle">
            {users.filter((u) => u.isActive).length} active
          </span>
        </CardHeader>
        {users.length === 0 ? (
          <EmptyState>No accounts yet.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Movements</Th>
                  <Th>Reset password</Th>
                  <Th />
                </tr>
              </THead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <Tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                      <Td>
                        <span className="font-semibold text-ink">{u.name}</span>
                        {isSelf && (
                          <span className="ml-2 text-xs font-bold text-ink-subtle">you</span>
                        )}
                      </Td>
                      <Td>{u.email}</Td>
                      <Td>
                        <form action={setUserRole.bind(null, u.id)} className="flex gap-2">
                          <Select
                            name="role"
                            defaultValue={u.role}
                            disabled={isSelf}
                            title={isSelf ? "You cannot change your own role" : ROLE_BLURB[u.role]}
                            className="w-auto"
                          >
                            <option value="FINANCE">Finance</option>
                            <option value="ADMIN">Admin</option>
                            <option value="EMPLOYEE">Employee — retired</option>
                          </Select>
                          {!isSelf && (
                            <Button type="submit" variant="secondary" size="sm">
                              Save
                            </Button>
                          )}
                        </form>
                      </Td>
                      <Td>
                        <Badge tone={u.isActive ? ROLE_TONE[u.role] : "neutral"}>
                          {u.isActive ? "Active" : "Deactivated"}
                        </Badge>
                      </Td>
                      <Td>{u._count.transactions}</Td>
                      <Td>
                        <form
                          action={resetUserPassword.bind(null, u.id)}
                          className="flex gap-2"
                        >
                          <Input
                            name="password"
                            type="text"
                            required
                            minLength={8}
                            placeholder="New password"
                            autoComplete="off"
                            className="w-40"
                          />
                          <Button type="submit" variant="secondary" size="sm">
                            Set
                          </Button>
                        </form>
                      </Td>
                      <Td>
                        {!isSelf && (
                          <form action={setUserActive.bind(null, u.id, !u.isActive)}>
                            <Button
                              type="submit"
                              variant={u.isActive ? "danger" : "secondary"}
                              size="sm"
                            >
                              {u.isActive ? "Deactivate" : "Reactivate"}
                            </Button>
                          </form>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-sm font-medium text-ink-subtle">
        Accounts are deactivated rather than deleted — every stock movement carries the
        account that recorded it, and that history has to stay whole.
      </p>
    </div>
  );
}
