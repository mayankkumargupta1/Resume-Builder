"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth-actions";
import { ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-[420px] rounded-card border border-line-card bg-card p-8 shadow-card">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-on-primary font-bold text-lg shadow-sm mb-3">
            RP
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink">Sign in</h1>
          <p className="text-xs text-muted mt-1">Enter your account credentials to continue</p>
        </div>

        {/* Error message */}
        {state?.error && (
          <div className="mb-5 flex items-start gap-2 rounded-control bg-danger-surface border border-danger-line p-3 text-xs text-danger font-medium">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        )}

        {/* Login Form */}
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted" />
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="h-10 w-full rounded-control border border-line-field bg-input pl-9 pr-3 text-field text-ink placeholder:text-muted focus:border-primary focus:outline-hidden text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 size-4 text-muted" />
              <input
                id="password"
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
            {isPending ? "Authenticating…" : "Sign In"}
            <ArrowRight className="size-3.5" />
          </button>
        </form>

        <div className="mt-8 rounded-control bg-paper/70 border border-line p-3.5 text-center text-xs text-muted">
          User accounts are provisioned exclusively by administrators. There is no public self-registration.
        </div>
      </div>
    </div>
  );
}
