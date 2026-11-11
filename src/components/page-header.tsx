import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  before?: ReactNode;
};

export function PageHeader({ title, description, actions, before }: PageHeaderProps) {
  return (
    <div className="w-full shrink-0">
      <PageBar>
        <div className="flex min-w-0 items-center gap-3">
          {before}
          <h1 className="font-serif text-title text-pretty text-ink">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </PageBar>
      {description ? (
        <div className="max-w-[1240px] mx-auto w-full px-8 pt-3 pb-4">
          <p className="max-w-[760px] text-lead text-pretty text-muted">{description}</p>
        </div>
      ) : (
        <div aria-hidden="true" className="h-4" />
      )}
    </div>
  );
}

export function PageBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 bg-surface/90 backdrop-blur-sm border-b border-line">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-3 px-8 py-3.5 max-w-[1240px] mx-auto w-full">
        {children}
      </div>
    </div>
  );
}
