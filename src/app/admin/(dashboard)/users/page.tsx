import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { UsersScreen } from "@/components/admin/users-screen";

/**
 * Staff accounts.
 *
 * A server component so the signed-in user's id reaches the table: the rules
 * about who may not be demoted or deactivated are enforced in the service, but
 * the screen should grey those actions out rather than let someone click into
 * a refusal.
 */
export default async function UsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  // The route group's layout already required a session; this is the
  // permission check, and it happens again inside every /api/admin/users call.
  if (!can(session.role, "users.manage")) {
    redirect("/admin");
  }

  return <UsersScreen currentUserId={session.userId} />;
}
