import { cookies } from "next/headers";
import { ok, fail } from "@/lib/api";
import { ACTIVE_SESSION_COOKIE } from "@/lib/session/constants";

export async function POST() {
  try {
    (await cookies()).delete(ACTIVE_SESSION_COOKIE);
    return ok({ loggedOut: true });
  } catch (error) {
    return fail(error);
  }
}
