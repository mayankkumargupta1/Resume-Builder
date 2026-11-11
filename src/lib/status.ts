import { ApplicationStatus, FunnelStage } from "@/lib/enums";

export type StatusGroup = "in-progress" | "closed";

export type StatusInfo = {
  value: ApplicationStatus;
  label: string;
  color: string;
  group: StatusGroup;
  toast: string;
};

export const STATUSES: readonly StatusInfo[] = [
  { value: ApplicationStatus.DRAFT, label: "Draft", color: "var(--color-status-draft, #94a3b8)", group: "in-progress", toast: "Moved back to draft." },
  { value: ApplicationStatus.SENT, label: "Sent", color: "var(--color-status-sent, #3b82f6)", group: "in-progress", toast: "Marked as sent. Fingers crossed!" },
  { value: ApplicationStatus.SCREENING, label: "Screening", color: "var(--color-status-screening, #8b5cf6)", group: "in-progress", toast: "In screening. They're taking a look." },
  { value: ApplicationStatus.INTERVIEW, label: "Interview", color: "var(--color-status-interview, #f59e0b)", group: "in-progress", toast: "An interview! You've got this." },
  { value: ApplicationStatus.OFFER, label: "Offer", color: "var(--color-status-offer, #10b981)", group: "in-progress", toast: "An offer. Congratulations!" },
  { value: ApplicationStatus.ACCEPTED, label: "Accepted", color: "var(--color-status-accepted, #059669)", group: "closed", toast: "Accepted. Huge congratulations!" },
  { value: ApplicationStatus.REJECTED, label: "Rejected", color: "var(--color-status-rejected, #ef4444)", group: "closed", toast: "Sorry, that's a tough one. On to the next." },
  { value: ApplicationStatus.DECLINED, label: "Declined", color: "var(--color-status-declined, #64748b)", group: "closed", toast: "Declined. Good on you for choosing well." },
];

export function statusInfo(status: ApplicationStatus): StatusInfo {
  const info = STATUSES.find((entry) => entry.value === status);
  if (!info) return STATUSES[0];
  return info;
}

export function isInProgress(status: ApplicationStatus): boolean {
  return statusInfo(status).group === "in-progress";
}
