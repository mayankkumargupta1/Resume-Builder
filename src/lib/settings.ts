import { PaperSize } from "./enums";

export const DEFAULT_BASE_THEME = "editorial";

export type PageLimit = "1" | "2" | "none";

export const PAGE_LIMITS: readonly { value: PageLimit; label: string; pages: number | null }[] = [
  { value: "1", label: "One page", pages: 1 },
  { value: "2", label: "Up to two pages", pages: 2 },
  { value: "none", label: "No limit", pages: null },
];

export const maxPages = (limit: PageLimit): number | null =>
  PAGE_LIMITS.find((option) => option.value === limit)?.pages ?? null;

export const pagesInWords = (pages: number) =>
  pages === 1 ? "one page" : pages === 2 ? "two pages" : `${pages} pages`;
