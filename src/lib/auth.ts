import { cookies } from "next/headers";
import {
  createUser,
  createSession,
  deleteSession,
  getUserByEmail,
  getUserFromSession,
  verifyPassword,
  ensureAdminUser,
  getRootAdminCredentials,
  type UserRecord,
} from "./db";

export const SESSION_COOKIE_NAME = "rp_session";
export { ensureAdminUser, getRootAdminCredentials };

export async function getCurrentUser(): Promise<UserRecord | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      const user = await getUserFromSession(token);
      if (user) return user;
    }
  } catch {
    // In background or build contexts where cookies() is unavailable
  }

  return null;
}

export async function requireCurrentUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required. Please sign in.");
  }
  return user;
}

export async function getOptionalUser(): Promise<UserRecord | null> {
  return getCurrentUser();
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: UserRecord }> {
  const trimmed = email.toLowerCase().trim();
  const rootCreds = getRootAdminCredentials();
  const lookup = (trimmed === "admin" || trimmed === rootCreds.username) ? rootCreds.username : trimmed;

  const user = await getUserByEmail(lookup);
  if (!user) {
    return { success: false, error: "No account found with this email." };
  }

  const isValid = verifyPassword(password, user.password_hash);
  if (!isValid) {
    return { success: false, error: "Incorrect password." };
  }

  if (user.is_disabled) {
    return { success: false, error: "This account has been disabled. Please contact the administrator." };
  }

  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return { success: true, user };
}

export async function adminLoginWithPassword(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: UserRecord }> {
  const trimmed = email.toLowerCase().trim();
  const rootCreds = getRootAdminCredentials();
  const lookup = (trimmed === "admin" || trimmed === rootCreds.username) ? rootCreds.username : trimmed;

  const user = await getUserByEmail(lookup);
  if (!user) {
    return { success: false, error: "No account found with this email." };
  }

  const isValid = verifyPassword(password, user.password_hash);
  if (!isValid) {
    return { success: false, error: "Incorrect password." };
  }

  if (user.is_disabled) {
    return { success: false, error: "This account has been disabled. Please contact the administrator." };
  }

  if (user.role !== "admin") {
    return { success: false, error: "Access denied. Only the root administrator has access." };
  }

  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return { success: true, user };
}

export async function signup(
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; error?: string; user?: UserRecord }> {
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (!password || password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const user = await createUser(email, password, name || "New User");
  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return { success: true, user };
}

export async function adminCreateUser(
  email: string,
  password: string,
  name: string,
  _role: "admin" | "user" = "user"
): Promise<{ success: boolean; error?: string; user?: UserRecord }> {
  const current = await getCurrentUser();
  if (!current || current.role !== "admin") {
    return { success: false, error: "Unauthorized. Root admin privileges required." };
  }

  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (!password || password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  // System rule: Exactly one root administrator is configured via .env; all created users have standard user role
  const user = await createUser(email, password, name || "New User", "user");
  return { success: true, user };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(token);
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}
