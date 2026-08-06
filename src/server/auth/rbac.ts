import type { Role } from "@prisma/client";

/**
 * Role-based access control.
 *
 * Permissions are declared per role here and checked inside every admin route
 * handler. The sidebar also reads these to hide sections a user cannot use —
 * but hiding is cosmetic; the server check is the actual boundary.
 */

export const PERMISSIONS = [
  "orders.view",
  "orders.update",
  "orders.delete",
  "menu.view",
  "menu.manage",
  "products.view",
  "products.manage",
  "categories.manage",
  "requests.view",
  "requests.manage",
  "customers.view",
  "customers.manage",
  "reviews.manage",
  "coupons.manage",
  "media.manage",
  "settings.manage",
  "users.manage",
  "analytics.view",
  "logs.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MANAGER_PERMISSIONS: Permission[] = [
  "orders.view",
  "orders.update",
  "menu.view",
  "menu.manage",
  "products.view",
  "products.manage",
  "categories.manage",
  "requests.view",
  "requests.manage",
  "customers.view",
  "reviews.manage",
  "coupons.manage",
  "media.manage",
  "analytics.view",
];

const STAFF_PERMISSIONS: Permission[] = [
  "orders.view",
  "orders.update",
  "menu.view",
  "products.view",
  "requests.view",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  STAFF: STAFF_PERMISSIONS,
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: Role | undefined | null, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}
