import type { Metadata } from "next";

/**
 * Applies to the whole admin surface including the login page.
 *
 * The actual guard lives in `(dashboard)/layout.tsx` — login must stay
 * reachable without a session, so it sits outside that route group.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
