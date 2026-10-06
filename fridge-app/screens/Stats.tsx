import { useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius, spacing, type } from "@/lib/theme";
import { CATEGORY_ICONS, normalizeCategory } from "@/lib/categories";
import type { Category } from "@/lib/categories";

type SettledItem = {
  id: string;
  name: string;
  quantity: number | null;
  category: string | null;
  status: string;
  estimated_price: number | null;
  settled_at: string | null;
  updated_at: string | null;
};

type Props = {
  fridgeId: string;
};

type RangeKey = "week" | "month" | "all";

const RANGE_LABELS: Record<RangeKey, string> = {
  week: "This week",
  month: "This month",
  all: "All time",
};

const RANGE_DAYS: Record<RangeKey, number | null> = {
  week: 7,
  month: 30,
  all: null,
};

// Anything that left the fridge without being eaten is waste. Items the user
// tapped Toss on are 'wasted'; items that quietly ran out of time are 'expired'
// (sweep_expired_items sets that on load). Counting only 'wasted' hides the
// waste of anyone who never taps Toss — which is most people.
const WASTE_STATUSES = ["wasted", "expired"];

function isWaste(item: SettledItem): boolean {
  return WASTE_STATUSES.includes(item.status);
}

// settled_at is set by trg_set_settled_at when an item leaves 'active'. Rows
// settled before that trigger existed fall back to updated_at.
function settledTime(item: SettledItem): number | null {
  const iso = item.settled_at ?? item.updated_at;
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function formatSettled(item: SettledItem): string {
  const t = settledTime(item);
  if (t === null) return "";
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function StatsScreen({ fridgeId }: Props) {
  const [range, setRange] = useState<RangeKey>("month");
  const [items, setItems] = useState<SettledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // One query feeds the whole screen, so the headline figure and the list below
  // it are always derived from the same rows and can never disagree.
  const load = useCallback(async () => {
    setError(null);
    const { data, error: loadError } = await supabase
      .from("inventory_items")
      .select(
        "id, name, quantity, category, status, estimated_price, settled_at, updated_at",
      )
      .eq("fridge_id", fridgeId)
      .in("status", ["consumed", ...WASTE_STATUSES])
      .order("settled_at", { ascending: false, nullsFirst: false })
      .limit(500);

    if (loadError) {
      setError(loadError.message);
      setItems([]);
    } else {
      setItems((data ?? []) as SettledItem[]);
    }
    setLoading(false);
  }, [fridgeId]);

  // Fires on mount and every time the tab regains focus, so marking something
  // Used or Toss on the Fridge tab shows up here straight away.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Switching range filters rows already in memory — no refetch, no spinner.
  const windowed = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (days === null) return items;
    const cutoff = Date.now() - days * 86400000;
    return items.filter((item) => {
      const t = settledTime(item);
      // A row with no timestamp can't be placed in a window, so it appears only
      // under All time rather than being attributed to the wrong one.
      return t !== null && t >= cutoff;
    });
  }, [items, range]);

  const wasted = useMemo(() => windowed.filter(isWaste), [windowed]);

  const usedCount = useMemo(
    () => windowed.filter((item) => item.status === "consumed").length,
    [windowed],
  );

  const wastedValue = useMemo(
    () =>
      wasted.reduce((sum, item) => sum + (Number(item.estimated_price) || 0), 0),
    [wasted],
  );

  const byCategory = useMemo(() => {
    const totals = new Map<Category, { used: number; wasted: number }>();
    for (const item of windowed) {
      const category = normalizeCategory(item.category);
      const row = totals.get(category) ?? { used: 0, wasted: 0 };
      if (isWaste(item)) {
        row.wasted += 1;
      } else {
        row.used += 1;
      }
      totals.set(category, row);
    }
    return Array.from(totals.entries())
      .map(([category, counts]) => ({ category, ...counts }))
      .sort((a, b) => b.wasted - a.wasted || b.used - a.used);
  }, [windowed]);

  const wastedCount = wasted.length;
  const unpricedCount = wasted.filter(
    (item) => item.estimated_price == null,
  ).length;
  const rangeSuffix =
    range === "all" ? "yet" : range === "week" ? "this week" : "this month";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.title}>Waste</Text>

      <View style={styles.rangeTabs}>
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <Pressable
            key={key}
            style={[styles.tab, range === key ? styles.tabActive : null]}
            onPress={() => setRange(key)}
          >
            <Text
              style={[
                styles.tabText,
                range === key ? styles.tabTextActive : null,
              ]}
            >
              {RANGE_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn&apos;t load your waste</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View
            style={[styles.hero, wastedCount === 0 ? styles.heroGood : null]}
          >
            {wastedCount === 0 ? (
              <>
                <Text style={styles.heroGoodAmount}>$0.00</Text>
                <Text style={styles.heroGoodLabel}>
                  Nothing wasted {rangeSuffix}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.heroAmount}>${wastedValue.toFixed(2)}</Text>
                <Text style={styles.heroLabel}>
                  wasted • {wastedCount} item{wastedCount === 1 ? "" : "s"}
                </Text>
              </>
            )}
          </View>

          <View style={styles.usedNote}>
            <Text style={styles.usedNoteText}>Used in time: {usedCount}</Text>
          </View>

          {wastedCount > 0 ? (
            <>
              <Text style={styles.section}>What you lost</Text>
              {wasted.map((item) => {
                const category = normalizeCategory(item.category);
                const Icon = CATEGORY_ICONS[category];
                const when = formatSettled(item);
                return (
                  <View key={item.id} style={styles.wasteRow}>
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      color={colors.danger}
                    />
                    <View style={styles.wasteMain}>
                      <Text style={styles.wasteName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.wasteMeta}>
                        {category} •{" "}
                        {item.status === "expired" ? "expired" : "tossed"}
                        {when ? ` • ${when}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.wastePrice}>
                      {item.estimated_price != null
                        ? `$${Number(item.estimated_price).toFixed(2)}`
                        : "—"}
                    </Text>
                  </View>
                );
              })}
            </>
          ) : null}

          {byCategory.length > 0 ? (
            <>
              <Text style={styles.section}>By category</Text>
              {byCategory.map((row) => {
                const total = row.used + row.wasted;
                const pct = total === 0 ? 0 : (row.wasted / total) * 100;
                return (
                  <View key={row.category} style={styles.catRow}>
                    <View style={styles.catHeader}>
                      <Text style={styles.catName}>{row.category}</Text>
                      <Text style={styles.catCounts}>
                        {row.used} used • {row.wasted} wasted
                      </Text>
                    </View>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}

          {windowed.length === 0 ? (
            <Text style={styles.empty}>
              Nothing settled {rangeSuffix}. Mark items Used or Toss on the
              Fridge tab and they show up here.
            </Text>
          ) : null}

          {unpricedCount > 0 ? (
            <Text style={styles.disclaimer}>
              {unpricedCount} item{unpricedCount === 1 ? " has" : "s have"} no
              estimated price yet, so the total above is conservative.
            </Text>
          ) : null}

          <Text style={styles.disclaimer}>
            Tossed and expired items both count as waste. Dollar values are
            estimates based on average category prices.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
  },
  scrollContent: { paddingBottom: spacing.xxxl + spacing.md },
  title: {
    ...type.h1,
    marginBottom: spacing.lg,
  },
  rangeTabs: {
    flexDirection: "row",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  tabActive: { backgroundColor: colors.bgCard },
  tabText: {
    ...type.caption,
  },
  tabTextActive: {
    fontFamily: fonts.bodySemibold,
    color: colors.textPrimary,
  },
  loadingBox: { alignItems: "center", paddingVertical: spacing.xxxl },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
  },
  errorTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 18,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  errorBody: {
    ...type.caption,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryBtn: {
    backgroundColor: colors.danger,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  retryText: {
    ...type.button,
    color: colors.textInverse,
  },
  hero: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.xl + spacing.xs,
    alignItems: "center",
  },
  heroGood: { backgroundColor: colors.accentSoft },
  heroAmount: {
    fontFamily: fonts.displaySemibold,
    fontSize: 48,
    letterSpacing: -1,
    color: colors.danger,
  },
  heroLabel: {
    ...type.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  heroGoodAmount: {
    fontFamily: fonts.displaySemibold,
    fontSize: 48,
    letterSpacing: -1,
    color: colors.accent,
  },
  heroGoodLabel: {
    ...type.caption,
    color: colors.accentDeep,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  usedNote: { alignItems: "center", marginTop: spacing.md },
  usedNoteText: {
    ...type.caption,
  },
  section: {
    ...type.sectionLabel,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  // Item-level waste list
  wasteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  wasteMain: { flex: 1 },
  wasteName: {
    ...type.bodyStrong,
    fontSize: 15,
  },
  wasteMeta: {
    ...type.caption,
    fontSize: 12,
    marginTop: 2,
  },
  wastePrice: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
    color: colors.danger,
  },
  // Category breakdown
  catRow: { marginBottom: spacing.lg },
  catHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs + 2,
  },
  catName: {
    ...type.captionStrong,
    fontSize: 14,
  },
  catCounts: {
    ...type.caption,
    fontSize: 12,
  },
  barBg: {
    height: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: colors.danger },
  empty: {
    ...type.caption,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
  disclaimer: {
    ...type.caption,
    fontSize: 11,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
