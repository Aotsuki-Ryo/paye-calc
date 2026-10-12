import type { Residency } from "@/lib/tax/calculate";
import type { PayeFormValues } from "@/lib/validation/paye-schema";

/**
 * Saved calculations, kept in localStorage.
 *
 * Only the INPUTS are stored, never the results. If the rate table is ever revised,
 * historical entries recompute against the current table instead of displaying
 * numbers that no longer follow the published rates.
 *
 * The two directions take different inputs, so an entry is a discriminated union
 * rather than a bag of half-empty fields.
 */

const STORAGE_KEY = "gra-paye-calculator/history/v1";

export const HISTORY_LIMIT = 6;

type EntryBase = {
  id: string;
  /** Epoch milliseconds. */
  savedAt: number;
};

export type MonthlyHistoryEntry = EntryBase & {
  period: "monthly";
  residency: Residency;
  grossPay: number;
  allowance: number;
};

export type AnnualHistoryEntry = EntryBase & {
  period: "annual";
  taxCharged: number;
};

export type HistoryEntry = MonthlyHistoryEntry | AnnualHistoryEntry;

export type NewHistoryEntry =
  | Omit<MonthlyHistoryEntry, "id" | "savedAt">
  | Omit<AnnualHistoryEntry, "id" | "savedAt">;

function isResidency(value: unknown): value is Residency {
  return value === "citizen" || value === "foreigner";
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;

  const entry = value as Record<string, unknown>;
  const hasBase =
    typeof entry.id === "string" && typeof entry.savedAt === "number";

  if (!hasBase) return false;

  if (entry.period === "monthly") {
    return (
      isResidency(entry.residency) &&
      typeof entry.grossPay === "number" &&
      typeof entry.allowance === "number"
    );
  }

  if (entry.period === "annual") {
    return typeof entry.taxCharged === "number";
  }

  return false;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Reads saved entries. Safe on the server and against corrupt storage. */
function readStorage(): HistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isEntry).slice(0, HISTORY_LIMIT);
  } catch {
    // Storage can be disabled or hold junk from an older version. A calculator
    // that refuses to open is worse than one that forgets.
    return [];
  }
}

/**
 * The saved list is external state that lives outside React, so it is read through
 * `useSyncExternalStore` rather than copied into component state by an effect.
 *
 * `getHistorySnapshot` must return a REFERENTIALLY STABLE value — parsing storage on
 * every call would hand React a new array each render and loop forever — so the
 * parsed result is cached and invalidated whenever anything writes.
 */
const EMPTY_HISTORY: HistoryEntry[] = [];
const listeners = new Set<() => void>();
let cachedHistory: HistoryEntry[] | null = null;

export function getHistorySnapshot(): HistoryEntry[] {
  cachedHistory ??= readStorage();
  return cachedHistory;
}

/** Nothing is stored during server rendering, and this must be a stable reference. */
export function getHistoryServerSnapshot(): HistoryEntry[] {
  return EMPTY_HISTORY;
}

export function subscribeToHistory(listener: () => void): () => void {
  const onExternalWrite = () => {
    // Another tab changed storage, so the cache is stale and must be re-read.
    cachedHistory = null;
    listener();
  };

  listeners.add(listener);
  window.addEventListener("storage", onExternalWrite);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onExternalWrite);
  };
}

export function writeHistory(entries: HistoryEntry[]): void {
  cachedHistory = entries;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Quota or private-mode failure — the in-memory list still works this session.
    }
  }

  for (const listener of listeners) listener();
}

export function createEntry(input: NewHistoryEntry): HistoryEntry {
  const base = { id: createId(), savedAt: Date.now() };

  return input.period === "monthly" ? { ...base, ...input } : { ...base, ...input };
}

/**
 * Newest first, and an identical set of inputs moves to the top rather than
 * appearing twice.
 */
export function addEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry
): HistoryEntry[] {
  const isSameInputs = (existing: HistoryEntry) => {
    if (existing.period === "monthly" && entry.period === "monthly") {
      return (
        existing.residency === entry.residency &&
        existing.grossPay === entry.grossPay &&
        existing.allowance === entry.allowance
      );
    }

    if (existing.period === "annual" && entry.period === "annual") {
      return existing.taxCharged === entry.taxCharged;
    }

    return false;
  };

  return [entry, ...entries.filter((existing) => !isSameInputs(existing))].slice(
    0,
    HISTORY_LIMIT
  );
}

/** Turns a saved entry back into form values, ready to refill the inputs. */
export function toFormValues(entry: HistoryEntry): PayeFormValues {
  if (entry.period === "annual") {
    return {
      period: "annual",
      residency: "citizen",
      grossPay: "",
      allowance: "",
      taxCharged: String(entry.taxCharged),
    };
  }

  return {
    period: "monthly",
    residency: entry.residency,
    grossPay: String(entry.grossPay),
    allowance: entry.allowance === 0 ? "" : String(entry.allowance),
    taxCharged: "",
  };
}
