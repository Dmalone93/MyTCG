/**
 * Stub auth module — replaces Clerk while SSO is disabled.
 * Uses a hardcoded user ID so the app remains functional.
 */

const STUB_USER_ID = "user_default";

/** Server-side: returns a userId (replaces Clerk's auth()) */
export async function auth(): Promise<{ userId: string }> {
  return { userId: STUB_USER_ID };
}

/** Server-side: returns a user object (replaces Clerk's currentUser()) */
export async function currentUser() {
  return {
    id: STUB_USER_ID,
    firstName: "Collector",
    lastName: "",
    fullName: "Collector",
    imageUrl: null,
    emailAddresses: [],
  };
}
