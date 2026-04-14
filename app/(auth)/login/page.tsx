import { redirect } from "next/navigation";
import { getConnectionInputFromSession } from "@/lib/session/connection-session";
import { LoginForm } from "@/components/db-manager/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const activeSession = await getConnectionInputFromSession().catch(() => null);
  if (activeSession) {
    redirect("/connections");
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,hsl(var(--primary)/0.22),transparent_48%),radial-gradient(circle_at_88%_12%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]" />
      <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-12">
        <LoginForm />
      </main>
    </div>
  );
}
