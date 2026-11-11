import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in · Resume Pipeline",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
