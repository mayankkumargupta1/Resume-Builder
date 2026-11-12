"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  login,
  logout,
  adminLoginWithPassword,
  adminCreateUser,
  getCurrentUser,
} from "@/lib/auth";
import { deleteUser, setUserDisabled } from "@/lib/db";

export async function loginAction(prevState: any, formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please enter both email and password." };
  }

  const result = await login(email, password);
  if (!result.success || !result.user) {
    return { error: result.error || "Login failed. Please check your credentials." };
  }

  if (result.user.role === "admin") {
    redirect("/admin");
  } else {
    redirect("/resume");
  }
}

export async function adminFormLoginAction(prevState: any, formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please enter your admin email ID and password." };
  }

  const result = await adminLoginWithPassword(email, password);
  if (!result.success) {
    return { error: result.error || "Invalid administrator credentials." };
  }

  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

export async function adminCreateUserAction(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const role = (formData.get("role") as "admin" | "user") || "user";

  if (!name || !email || !password) {
    return { error: "Please fill in all fields." };
  }

  const result = await adminCreateUser(email, password, name, role);
  if (!result.success) {
    return { error: result.error || "Failed to create user." };
  }

  revalidatePath("/admin");
  return { success: true, message: `Account created successfully for ${email} (${role})!` };
}

export async function adminDeleteUserAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  const current = await getCurrentUser();
  if (!current || current.role !== "admin") {
    return;
  }
  await deleteUser(userId);
  revalidatePath("/admin");
}

export async function adminToggleUserStatusAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  const currentStatus = formData.get("currentStatus") as string; // "active" or "disabled"
  const current = await getCurrentUser();
  if (!current || current.role !== "admin") {
    return;
  }
  const shouldDisable = currentStatus === "active";
  await setUserDisabled(userId, shouldDisable);
  revalidatePath("/admin");
}
