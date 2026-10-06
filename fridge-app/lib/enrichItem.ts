import { supabase } from "./supabase";

export type Enrichment = {
  name: string;
  category: string;
  shelf_life_days: number;
  price: number | null;
};

export async function enrichItems(names: string[]): Promise<Enrichment[]> {
  if (names.length === 0) return [];
  const { data, error } = await supabase.functions.invoke("enrich-item", {
    body: { names },
  });
  if (error) {
    console.warn("enrich-item failed:", error.message);
    return [];
  }
  if (!data || !Array.isArray(data.items)) return [];
  return data.items as Enrichment[];
}

// Fetches the per-category shelf-life offsets the household has learned over time.
// Returns a map: category -> offset_days (e.g. { produce: +3, dairy: -2 }).
export async function fetchShelfLifeOffsets(
  fridgeId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("shelf_life_adjustments")
    .select("category, offset_days")
    .eq("fridge_id", fridgeId);
  if (error || !data) return {};
  const map: Record<string, number> = {};
  for (const row of data as { category: string; offset_days: number }[]) {
    map[row.category] = row.offset_days;
  }
  return map;
}

// Combines model shelf life with household adjustment and clamps to a sane range.
export function adjustedShelfLife(
  modelDays: number,
  category: string,
  offsets: Record<string, number>,
): number {
  const offset = offsets[category] ?? 0;
  return Math.max(1, Math.min(730, modelDays + offset));
}

// Add a number of days to today and return ISO date string (YYYY-MM-DD).
export function shelfLifeToExpiryISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export async function backfillFridgeItems(
  fridgeId: string,
): Promise<{ updated: number; total: number }> {
  // 1. Find items in this fridge that are still active and missing a category.
  const { data: rows, error } = await supabase
    .from("inventory_items")
    .select("id, name, expiry_date")
    .eq("fridge_id", fridgeId)
    .eq("status", "active")
    .is("category", null);

  if (error) {
    console.warn("backfill query failed:", error.message);
    return { updated: 0, total: 0 };
  }

  const items = (rows ?? []) as {
    id: string;
    name: string;
    expiry_date: string | null;
  }[];

  if (items.length === 0) return { updated: 0, total: 0 };

  // 2. One Gemini batch call for all of them.
  const names = items.map((r) => r.name);
  const enriched = await enrichItems(names);
  if (enriched.length === 0) return { updated: 0, total: items.length };

  // 3. Fetch household offsets so backfill respects learned shelf life.
  const offsets = await fetchShelfLifeOffsets(fridgeId);

  // 4. Patch each row.
  let updated = 0;
  await Promise.all(
    items.map(async (row, idx) => {
      const e = enriched[idx];
      if (!e) return;

      const adjusted = adjustedShelfLife(
        e.shelf_life_days,
        e.category,
        offsets,
      );
      // Only overwrite expiry if the row doesn't already have one.
      const expiryIso = row.expiry_date ?? shelfLifeToExpiryISO(adjusted);

      const { error: updErr } = await supabase
        .from("inventory_items")
        .update({
          category: e.category,
          estimated_price: e.price,
          expiry_date: expiryIso,
        })
        .eq("id", row.id);

      if (updErr) {
        console.warn(`backfill update failed for ${row.name}:`, updErr.message);
        return;
      }
      updated += 1;
    }),
  );

  return { updated, total: items.length };
}
