export type ExpiryTone = "danger" | "warning" | "neutral" | null;

export type FormattedExpiry = {
  text: string;
  tone: ExpiryTone;
};

/**
 * Formats an ISO date string into a human-readable expiry label with a
 * semantic tone for color-coding:
 *
 *  null / missing  →  "set expiry"  (tone: null — muted placeholder)
 *  past expiry     →  "MMM D"       (tone: danger — terracotta)
 *  today           →  "today"       (tone: danger — terracotta)
 *  within 7 days   →  "in N days"   (tone: warning — honey)
 *  this year       →  "MMM D"       (tone: neutral — warm grey)
 *  other year      →  "MMM D, YYYY" (tone: neutral — warm grey)
 */
export function formatExpiry(iso: string | null | undefined): FormattedExpiry {
  if (!iso) return { text: "set expiry", tone: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(iso + "T00:00:00");
  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const text = expiry.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(expiry.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
    });
    return { text, tone: "danger" };
  }

  if (diffDays === 0) return { text: "today", tone: "danger" };

  if (diffDays <= 7) {
    return { text: `in ${diffDays} day${diffDays === 1 ? "" : "s"}`, tone: "warning" };
  }

  const text = expiry.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(expiry.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
  return { text, tone: "neutral" };
}
