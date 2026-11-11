import type { Metadata } from "next";
import { fontVariables } from "@/fonts";
import { NavigationHeader } from "@/components/navigation-header";
import { Toaster } from "@/components/toast";
import { loadProfile } from "@/lib/profile-store";
import { getOptionalUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Pipeline - AI Resume Builder & Job Curator",
  description: "Curate tailored, ATS-compliant resumes with first-class project support and AI job matching.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let profile;
  let userEmail: string | undefined;
  let userRole: "admin" | "user" | undefined;
  try {
    const user = await getOptionalUser();
    if (user) {
      profile = await loadProfile(user.id);
      userEmail = user.email;
      userRole = user.role;
    }
  } catch {
    profile = undefined;
  }

  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-screen flex-col bg-paper text-ink font-sans antialiased">
        <NavigationHeader profile={profile} userEmail={userEmail} userRole={userRole} />
        <main className="flex flex-1 flex-col overflow-y-auto">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
