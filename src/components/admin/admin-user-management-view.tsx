"use client";

import { useActionState } from "react";
import {
  adminCreateUserAction,
  adminDeleteUserAction,
  adminToggleUserStatusAction,
} from "@/app/actions/auth-actions";
import { UserPlus, Shield, User, Trash2, CheckCircle2, AlertCircle, Ban } from "lucide-react";
import type { UserRecord } from "@/lib/db";

export function AdminUserManagementView({
  users,
  currentUserId,
}: {
  users: (UserRecord & { projectsCount: number })[];
  currentUserId: string;
}) {
  const [createState, createAction, isCreating] = useActionState(adminCreateUserAction, null);

  return (
    <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-8 px-8 py-8 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-line pb-6">
        <div className="flex items-center gap-2">
          <Shield className="size-6 text-primary" />
          <h1 className="font-serif text-3xl font-bold text-ink">User Administration</h1>
        </div>
        <p className="text-sm text-muted">
          Create, provision, and manage team accounts. Real accounts are initialized with clean, blank profiles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Create User Form */}
        <div className="lg:col-span-1 rounded-card border border-line-card bg-card p-6 shadow-xs flex flex-col gap-5">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <UserPlus className="size-4 text-primary" />
            <h2 className="font-serif text-lg font-semibold text-ink">Create New User</h2>
          </div>

          {createState?.error && (
            <div className="flex items-start gap-2 rounded-control bg-danger-surface border border-danger-line p-3 text-xs text-danger font-medium">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{createState.error}</span>
            </div>
          )}

          {createState?.success && (
            <div className="flex items-start gap-2 rounded-control bg-success/10 border border-success/30 p-3 text-xs text-success font-medium">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <span>{createState.message}</span>
            </div>
          )}

          <form action={createAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink" htmlFor="create-name">
                Full Name
              </label>
              <input
                id="create-name"
                name="name"
                type="text"
                required
                placeholder="Jane Doe"
                className="h-9 w-full rounded-control border border-line-field bg-input px-3 text-field text-ink placeholder:text-muted focus:border-primary focus:outline-hidden text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink" htmlFor="create-email">
                Email Address
              </label>
              <input
                id="create-email"
                name="email"
                type="email"
                required
                placeholder="jane@company.com"
                className="h-9 w-full rounded-control border border-line-field bg-input px-3 text-field text-ink placeholder:text-muted focus:border-primary focus:outline-hidden text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink" htmlFor="create-password">
                Password
              </label>
              <input
                id="create-password"
                name="password"
                type="password"
                required
                placeholder="At least 6 characters"
                className="h-9 w-full rounded-control border border-line-field bg-input px-3 text-field text-ink placeholder:text-muted focus:border-primary focus:outline-hidden text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink" htmlFor="create-role">
                Account Role
              </label>
              <input type="hidden" name="role" value="user" />
              <div className="flex h-9 w-full items-center rounded-control border border-line-field bg-track/40 px-3 text-xs text-ink/80 font-medium">
                Standard User (Root Admin configured via .env)
              </div>
            </div>

            <p className="text-[11px] text-muted">
              Note: Created users receive a 100% clean, blank master profile with no dummy data.
            </p>

            <button
              type="submit"
              disabled={isCreating}
              className="mt-1 flex h-9 w-full items-center justify-center gap-1.5 rounded-control bg-primary text-on-primary font-semibold text-xs transition-colors hover:bg-primary-hover disabled:opacity-50 cursor-pointer shadow-raised"
            >
              <UserPlus className="size-3.5" />
              {isCreating ? "Provisioning…" : "Provision Account"}
            </button>
          </form>
        </div>

        {/* Right Column: Existing Users List */}
        <div className="lg:col-span-2 rounded-card border border-line-card bg-card p-6 shadow-xs flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <h2 className="font-serif text-lg font-semibold text-ink">Active Accounts</h2>
            </div>
            <span className="rounded-full bg-track px-2.5 py-0.5 text-xs font-semibold text-ink">
              {users.length} {users.length === 1 ? "User" : "Users"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 pr-4">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Projects</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => {
                  const isCurrent = u.id === currentUserId;
                  const isDisabled = Boolean(u.is_disabled);

                  return (
                    <tr key={u.id} className="hover:bg-hover/50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-ink flex items-center gap-1.5">
                            {u.name || "Unnamed"}
                            {isCurrent && (
                              <span className="rounded-[4px] bg-primary/10 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                                You
                              </span>
                            )}
                          </span>
                          <span className="text-muted text-[11px]">{u.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            u.role === "admin"
                              ? "bg-primary text-on-primary"
                              : "bg-track text-muted"
                          }`}
                        >
                          {u.role === "admin" ? <Shield className="size-3" /> : null}
                          {u.role === "admin" ? "Root Admin" : u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {isDisabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 text-danger border border-danger/30 px-2 py-0.5 text-[11px] font-semibold">
                            <Ban className="size-3" />
                            Disabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success border border-success/30 px-2 py-0.5 text-[11px] font-semibold">
                            <CheckCircle2 className="size-3" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-ink">
                        {u.projectsCount} {u.projectsCount === 1 ? "project" : "projects"}
                      </td>
                      <td className="py-3 px-3 text-muted whitespace-nowrap text-[11px]">
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isCurrent && u.role !== "admin" && u.id !== "usr_root" && (
                            <>
                              {/* Toggle Disable / Enable Account */}
                              <form action={adminToggleUserStatusAction} className="inline">
                                <input type="hidden" name="userId" value={u.id} />
                                <input type="hidden" name="currentStatus" value={isDisabled ? "disabled" : "active"} />
                                <button
                                  type="submit"
                                  title={isDisabled ? "Enable account" : "Disable account"}
                                  className={`inline-flex items-center gap-1 p-1 rounded-control cursor-pointer transition-colors ${
                                    isDisabled
                                      ? "text-success hover:bg-success/15"
                                      : "text-amber-600 hover:bg-amber-500/15"
                                  }`}
                                >
                                  {isDisabled ? <CheckCircle2 className="size-3.5" /> : <Ban className="size-3.5" />}
                                  <span className="sr-only">{isDisabled ? "Enable" : "Disable"}</span>
                                </button>
                              </form>

                              {/* Delete Account */}
                              <form action={adminDeleteUserAction} className="inline">
                                <input type="hidden" name="userId" value={u.id} />
                                <button
                                  type="submit"
                                  title="Delete account"
                                  onClick={(e) => {
                                    if (!confirm(`Delete account for ${u.email}? This cannot be undone.`)) {
                                      e.preventDefault();
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-danger hover:text-danger-fill-hover p-1 rounded-control hover:bg-danger-surface cursor-pointer transition-colors"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span className="sr-only">Delete</span>
                                </button>
                              </form>
                            </>
                          )}
                          {isCurrent && <span className="text-[11px] text-muted italic">Active</span>}
                          {u.role === "admin" && !isCurrent && (
                            <span className="text-[11px] text-muted italic">Root</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
