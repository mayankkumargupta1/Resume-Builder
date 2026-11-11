"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, User, Sparkles, LogOut, LogIn, Sun, Moon, Shield, Briefcase } from "lucide-react";
import type { ProfileData } from "@/lib/profile";
import { logoutAction } from "@/app/actions/auth-actions";

export function NavigationHeader({
  profile,
  userEmail,
  userRole,
}: {
  profile?: ProfileData;
  userEmail?: string;
  userRole?: "admin" | "user";
}) {
  const pathname = usePathname();
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const saved = localStorage.getItem("rp_theme") as "light" | "dark" | null;
    if (saved) {
      setThemeMode(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setThemeMode(prefersDark ? "dark" : "light");
    }
  }, []);

  const toggleTheme = () => {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("rp_theme", next);
  };

  const isResume = pathname === "/" || pathname === "/resume";
  const isProfile = pathname.startsWith("/profile");
  const isTailor = pathname.startsWith("/tailor");
  const isApplications = pathname.startsWith("/applications");
  const isAdminPage = pathname.startsWith("/admin");
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  const firstName = profile?.basics.name.trim().split(" ")[0] || userEmail?.split("@")[0] || "Account";
  const isAdmin = userRole === "admin";

  return (
    <header className="no-print sticky top-0 z-40 flex h-13 shrink-0 items-center justify-between border-b border-line bg-paper/95 px-5 backdrop-blur-sm whitespace-nowrap">
      {/* Brand logo & title */}
      <Link href={isAdmin ? "/admin" : "/resume"} className="flex items-center gap-2.5 group cursor-pointer shrink-0">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-on-primary font-bold text-xs shadow-xs group-hover:opacity-90 transition-opacity">
          RP
        </div>
        <span className="font-serif text-base font-bold text-ink tracking-tight whitespace-nowrap">
          Resume Pipeline
        </span>
      </Link>

      {/* Center Navigation Pills */}
      {!isAuthPage ? (
        isAdmin ? (
          <nav className="flex items-center gap-1 rounded-full bg-track/80 p-0.5 border border-line" aria-label="Admin Navigation">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-card shadow-xs text-primary">
              <Shield className="size-3.5 text-primary" />
              <span>Admin Console</span>
            </div>
          </nav>
        ) : (
          <nav className="flex items-center gap-1 rounded-full bg-track/70 p-1 border border-line" aria-label="Main Navigation">
            <Link
              href="/resume"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all whitespace-nowrap ${
                isResume
                  ? "bg-card shadow-xs text-ink font-semibold"
                  : "text-muted hover:text-ink hover:bg-card/40"
              }`}
            >
              <FileText className="size-3.5" />
              <span>Resume</span>
            </Link>
            <Link
              href="/profile"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all whitespace-nowrap ${
                isProfile
                  ? "bg-card shadow-xs text-ink font-semibold"
                  : "text-muted hover:text-ink hover:bg-card/40"
              }`}
            >
              <User className="size-3.5" />
              <span>Profile</span>
            </Link>
            <Link
              href="/tailor"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all whitespace-nowrap ${
                isTailor
                  ? "bg-card shadow-xs text-accent font-semibold"
                  : "text-muted hover:text-ink hover:bg-card/40"
              }`}
            >
              <Sparkles className="size-3.5 text-accent" />
              <span>Tailor</span>
            </Link>
            <Link
              href="/applications"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all whitespace-nowrap ${
                isApplications
                  ? "bg-card shadow-xs text-primary font-semibold"
                  : "text-muted hover:text-ink hover:bg-card/40"
              }`}
            >
              <Briefcase className="size-3.5 text-primary" />
              <span>Applications</span>
            </Link>
          </nav>
        )
      ) : <div />}

      {/* Right User & Actions */}
      <div className="flex items-center gap-2.5 text-xs text-muted shrink-0">
        {/* Dark / Light Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
          aria-label="Toggle color theme"
          className="flex size-7 items-center justify-center rounded-md border border-line bg-card text-ink hover:bg-hover transition-colors cursor-pointer"
        >
          {themeMode === "dark" ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-slate-600" />}
        </button>

        {userEmail ? (
          <>
            <div className="h-4 w-px bg-line" />
            {isAdmin ? (
              <span className="font-semibold text-ink text-xs flex items-center gap-1.5">
                <span>Root</span>
                <span className="rounded bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.2 uppercase">
                  Admin
                </span>
              </span>
            ) : (
              <Link href="/profile" className="font-medium text-ink hover:underline text-xs">
                {firstName}
              </Link>
            )}

            <form action={logoutAction} className="flex items-center">
              <button
                type="submit"
                title="Sign Out"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
              >
                <LogOut className="size-3.5" />
                <span>Sign Out</span>
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-on-primary hover:bg-primary-hover shadow-xs"
          >
            <LogIn className="size-3.5" />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
