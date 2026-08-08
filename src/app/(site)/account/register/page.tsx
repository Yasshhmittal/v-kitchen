import { redirect } from "next/navigation";

/**
 * There is no separate sign-up any more.
 *
 * Signing in with a phone number creates the account on first use, so this
 * route only exists to keep older links and bookmarks working.
 */
export default function RegisterPage() {
  redirect("/account/login");
}
