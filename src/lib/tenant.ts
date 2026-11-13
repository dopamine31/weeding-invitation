export type Role = "OWNER" | "EDITOR" | "VIEWER";
const RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export interface MembershipLike {
  workspaceId: string;
  role: string;
}

export function hasRole(role: string, min: Role): boolean {
  return (RANK[role as Role] ?? 0) >= RANK[min];
}

/** Pure decision used by requireEventAccess: may this user touch data of `workspaceId`? */
export function canAccessWorkspace(
  user: { role: string; memberships: MembershipLike[] },
  workspaceId: string,
  min: Role,
): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  const m = user.memberships.find((x) => x.workspaceId === workspaceId);
  return !!m && hasRole(m.role, min);
}
