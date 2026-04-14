import { redirect } from "next/navigation";
import { getConnectionInputFromSession } from "@/lib/session/connection-session";

export default async function HomePage() {
  const activeSession = await getConnectionInputFromSession().catch(() => null);
  if (activeSession) {
    redirect("/connections");
  }
  redirect("/login");
}
