"use client";

import { useActionState } from "react";
import { adminFormLoginAction } from "@/app/actions/auth-actions";
import { Shield, Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";

export function AdminLoginForm() {
  const [state, formAction, isPending] = useActionState(adminFormLoginAction, null);

  return (
    <div className="w-full max-w-[420px] rounded-card border border-line-card bg-card p-8 shadow-card">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-on-primary font-bold shadow-sm mb-3">
          <Shield className="size-6 text-on-primary" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-ink">Admin Portal</h1>
        <p className="text-xs text-muted mt-1">
          Enter your administrator credentials to access user provisioning
        </p>
      </div>

      {state?.error && (
        <div className="mb-5 flex items-start gap-2 rounded-control bg-danger-surface border border-danger-line p-3 text-xs text-danger font-medium">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-ink" htmlFor="admin-email">
            Admin Email ID
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 size-4 text-muted" />
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@resumepipeline.com or your email"
              className="h-10 w-full rounded-control border border-line-field bg-input pl-9 pr-3 text-field text-ink placeholder:text-muted focus:border-primary focus:outline-hidden text-xs"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-ink" htmlFor="admin-password">
            Admin Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 size-4 text-muted" />
            <input
              id="admin-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10 w-full rounded-control border border-line-field bg-input pl-9 pr-3 text-field text-ink placeholder:text-muted focus:border-primary focus:outline-hidden text-xs"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-control bg-primary text-on-primary font-semibold text-xs transition-colors hover:bg-primary-hover disabled:opacity-50 cursor-pointer shadow-raised"
        >
          {isPending ? "Authenticating…" : "Unlock Admin Portal"}
          <ArrowRight className="size-3.5" />
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-muted border-t border-line pt-4">
        Restricted to authorized system administrators only.
      </div>
    </div>
  );
}
