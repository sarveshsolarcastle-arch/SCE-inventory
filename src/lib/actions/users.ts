"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { currentUser, requireCapability } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma/enums";

/** Same cost factor the seed uses, so hashes are consistent across origins. */
const BCRYPT_ROUNDS = 10;

const ROLES: Role[] = ["ADMIN", "FINANCE", "EMPLOYEE"];

/** Long enough to not be guessable, short enough that nobody writes it on a
 * sticky note. There is no password-strength library here and adding one for
 * an under-10-person office would be ceremony. */
const MIN_PASSWORD_LENGTH = 8;

function parseRole(value: FormDataEntryValue | null): Role {
  const role = String(value ?? "");
  if (!ROLES.includes(role as Role)) throw new Error("Pick a role");
  return role as Role;
}

function assertPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

export async function createUser(formData: FormData) {
  "use server";
  await requireCapability("user:manage");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));

  if (!name) throw new Error("Name is required");
  if (!email) throw new Error("Email is required");
  assertPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with that email already exists");

  await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    },
  });

  revalidatePath("/users");
}

export async function setUserRole(userId: string, formData: FormData) {
  "use server";
  const admin = await requireCapability("user:manage");
  const role = parseRole(formData.get("role"));

  // Demoting yourself out of ADMIN could leave the system with no admin at
  // all, and no way back in short of editing the database by hand.
  if (userId === admin.id && role !== "ADMIN") {
    throw new Error("You cannot change your own role. Ask another admin.");
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/users");
}

export async function setUserActive(userId: string, isActive: boolean) {
  "use server";
  const admin = await requireCapability("user:manage");

  if (userId === admin.id && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  // Refuse to remove the last way in. Counting rather than trusting that
  // another admin exists, because being locked out has no in-app remedy.
  if (!isActive) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: userId } },
    });
    if (otherActiveAdmins === 0) {
      throw new Error("That is the last active admin. Promote someone else first.");
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath("/users");
}

/** Admin resets someone else's password — for the person who forgot theirs,
 * since there is no email-based reset flow and, for an office of this size,
 * does not need to be one. */
export async function resetUserPassword(userId: string, formData: FormData) {
  "use server";
  await requireCapability("user:manage");

  const password = String(formData.get("password") ?? "");
  assertPassword(password);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
  });

  revalidatePath("/users");
}

/** Changing your OWN password. Deliberately NOT capability-gated: every
 * signed-in account may do this, and requiring a capability would mean an
 * account could be unable to fix its own credentials. */
export async function changeOwnPassword(formData: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) throw new Error("The new passwords do not match");
  assertPassword(newPassword);

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) throw new Error("Not signed in");

  // Proving the current password is what stops an unattended, still-signed-in
  // machine being used to lock the real owner out of their own account.
  const valid = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!valid) throw new Error("Your current password is not correct");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
  });

  revalidatePath("/account");
}
