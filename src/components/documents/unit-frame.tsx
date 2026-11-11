"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import styles from "./unit-frame.module.css";

export type UnitFrameProps = {
  id: string;
  className?: string;
  head?: ReactNode;
  children: ReactNode;
  label?: string;
  initialText: string;
  isBullet?: boolean;
  editing: boolean;
  saving?: boolean;
  busy?: boolean;
  flashing?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (text: string) => void;
  onRegenerate?: () => void;
  onAskAi?: () => void;
};

const toolButton =
  "rounded-[6px] px-[9px] py-[5px] text-white hover:bg-white/14 focus-visible:outline-white focus-visible:-outline-offset-2 transition-colors cursor-pointer";

export function UnitFrame({
  id,
  className,
  head,
  children,
  label = "section",
  initialText,
  isBullet = false,
  editing,
  saving = false,
  busy = false,
  flashing = false,
  onEdit,
  onCancel,
  onSave,
  onRegenerate,
  onAskAi,
}: UnitFrameProps) {
  const frame = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(editing);

  useLayoutEffect(() => {
    if (wasEditing.current && !editing && (!document.activeElement || document.activeElement === document.body)) {
      frame.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  return (
    <div
      ref={frame}
      className={cn(className, styles.frame, flashing && styles.flash, busy && styles.busy, editing && styles.editing)}
      data-unit={id}
      role="group"
      aria-label={label}
      aria-busy={busy || undefined}
      tabIndex={editing ? -1 : 0}
    >
      <div className={styles.content}>
        {head}
        {!editing && children}
      </div>

      {editing && (
        <UnitEditor
          id={id}
          label={label}
          initialText={initialText}
          isBullet={isBullet}
          saving={saving}
          onCancel={onCancel}
          onSave={onSave}
        />
      )}

      {busy ? (
        <span className={cn(styles.status, "rounded-[6px] border border-line-popover bg-card px-2 py-1 font-sans text-[11.5px] leading-[1.2] text-muted")}>
          Rewriting…
        </span>
      ) : (
        !editing && (
          <div
            className={cn(
              styles.toolbar,
              "gap-0.5 rounded-[8px] bg-slate-900 text-white p-[3px] font-sans text-xs leading-[1.2] font-medium whitespace-nowrap shadow-xl"
            )}
          >
            <button type="button" className={toolButton} onClick={onEdit}>
              Edit in place
            </button>
            {onRegenerate && (
              <button type="button" className={toolButton} onClick={onRegenerate}>
                Regenerate
              </button>
            )}
            {onAskAi && (
              <button type="button" className={toolButton} onClick={onAskAi}>
                Ask AI
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}

function UnitEditor({
  id,
  label,
  initialText,
  isBullet,
  saving,
  onCancel,
  onSave,
}: {
  id: string;
  label: string;
  initialText: string;
  isBullet: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  const [value, setValue] = useState(initialText);
  const rows = Math.max(3, value.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 70)), 1));

  return (
    <div className={cn(styles.editor, "mt-1 flex flex-col gap-2 font-sans")} dir="auto">
      <textarea
        aria-label={`Edit ${label}`}
        autoFocus
        value={value}
        rows={rows}
        disabled={saving}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSave(value);
          }
        }}
        className="max-h-[calc(60vh/var(--preview-scale,1))] w-full resize-y rounded-control border border-primary bg-input px-3 py-2.5 text-control leading-[1.55] text-ink focus-visible:outline-offset-0 disabled:opacity-60 shadow-inner"
      />
      <div className="flex items-center justify-end gap-1.5">
        {isBullet && (
          <span className="mr-auto text-xs text-muted">
            One bullet per line · Ctrl+Enter to save
          </span>
        )}
        <Button variant="secondary" size="sm" className="min-h-[calc(var(--px)*30)] bg-input" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" className="min-h-[calc(var(--px)*30)]" onClick={() => onSave(value)} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
