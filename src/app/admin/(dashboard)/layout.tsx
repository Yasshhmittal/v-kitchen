import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/session";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

/**
 * Guarded shell.
 *
 * Middleware already rejected requests with no valid access token, so if we're
 * rendering at all a token exists. This session read is the real check: it
 * confirms against the database that the account still exists and is active,
 * and loads name/role for the UI.
 *
 * Login lives outside this route group so it stays reachable without a session.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    // Passed middleware but the account was deleted or deactivated since the
    // token was issued.
    redirect("/admin/login");
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-secondary/40">
      <AdminSidebar role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar name={session.name} email={session.email} role={session.role} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
