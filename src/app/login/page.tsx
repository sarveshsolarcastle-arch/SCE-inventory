import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { Field, Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

async function login(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center">
      <div className="absolute top-0 right-0">
        <ThemeToggle />
      </div>
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-card border border-line bg-surface p-6 shadow-raised"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6.5 10 3l7 3.5-7 3.5-7-3.5Z" />
              <path d="M3 6.5v7L10 17l7-3.5v-7" />
              <path d="M10 10.5V17" />
            </svg>
          </div>
          <h1 className="text-lg font-extrabold text-ink">Sign in</h1>
        </div>
        {error && <Alert tone="danger">Invalid email or password.</Alert>}
        <Field label="Email">
          <Input name="email" type="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" required />
        </Field>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}
