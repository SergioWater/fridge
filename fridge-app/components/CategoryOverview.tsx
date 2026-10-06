import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { RefreshControl } from "react-native";
import { colors, fonts, radius, spacing } from "@/lib/theme";
import { CATEGORIES, normalizeCategory } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import { formatExpiry } from "@/lib/dates";
import CategoryTile from "./CategoryTile";

// Mirrors the Item type in Fridge.tsx — kept local to avoid premature shared
// types; structural compatibility lets them work together.
type Item = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  expiry_date: string | null;
  status: string;
  category: string | null;
  created_at: string | null;
};

type Props = {
  items: Item[];
  onPressCategory: (cat: Category) => void;
  consumeItem: (id: string) => void;
  wasteItem: (id: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
};

// Returns how many days until expiry. Negative = past.
function diffDaysFromToday(iso: string, today: Date): number {
  const d = new Date(iso + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function ExpiringSoonChip({
  item,
  onConsume,
  onWaste,
}: {
  item: Item;
  onConsume: (id: string) => void;
  onWaste: (id: string) => void;
}) {
  const expiry = formatExpiry(item.expiry_date);
  const expiryColor =
    expiry.tone === "danger" ? colors.danger : colors.warning;

  return (
    <View style={chipStyles.chip}>
      <Text style={chipStyles.name} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[chipStyles.expiry, { color: expiryColor }]}>
        {expiry.text}
      </Text>
      <View style={chipStyles.actions}>
        <Pressable
          style={chipStyles.usedBtn}
          onPress={() => onConsume(item.id)}
        >
          <Text style={chipStyles.usedText}>Used</Text>
        </Pressable>
        <Pressable
          style={chipStyles.tossBtn}
          onPress={() => onWaste(item.id)}
        >
          <Text style={chipStyles.tossText}>Toss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    width: 160,
  },
  name: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  expiry: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  usedBtn: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.bgBase,
    alignItems: "center",
  },
  usedText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  tossBtn: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
  },
  tossText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.danger,
  },
});

export default function CategoryOverview({
  items,
  onPressCategory,
  consumeItem,
  wasteItem,
  refreshing,
  onRefresh,
}: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Items expiring within 7 days (inclusive of overdue — those need action too).
  const expiringSoonItems = useMemo(
    () =>
      items.filter((it) => {
        if (!it.expiry_date) return false;
        return diffDaysFromToday(it.expiry_date, today) <= 7;
      }),
    [items, today],
  );

  // Per-category derived counts and recent-item preview used by the tiles.
  const categoryStats = useMemo(
    () =>
      CATEGORIES.map((cat) => {
        const catItems = items.filter(
          (it) => normalizeCategory(it.category) === cat,
        );
        let expiringSoonCount = 0;
        let overdueCount = 0;
        for (const it of catItems) {
          if (!it.expiry_date) continue;
          const diff = diffDaysFromToday(it.expiry_date, today);
          if (diff < 0) {
            overdueCount++;
          } else if (diff <= 3) {
            expiringSoonCount++;
          }
        }
        // Sort by created_at desc so the newest items appear at the top of the preview.
        const sorted = [...catItems].sort((a, b) => {
          if (!a.created_at && !b.created_at) return 0;
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          return b.created_at.localeCompare(a.created_at);
        });
        const recentItems = sorted
          .slice(0, 4)
          .map((it) => ({ id: it.id, name: it.name }));
        const extraCount = Math.max(0, catItems.length - 4);
        return {
          cat,
          itemCount: catItems.length,
          expiringSoonCount,
          overdueCount,
          recentItems,
          extraCount,
        };
      }),
    [items, today],
  );

  const listHeader =
    expiringSoonItems.length > 0 ? (
      <View style={styles.expiringSoonSection}>
        <Text style={styles.expiringSoonLabel}>Expiring soon</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={expiringSoonItems}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => (
            <ExpiringSoonChip
              item={item}
              onConsume={consumeItem}
              onWaste={wasteItem}
            />
          )}
        />
      </View>
    ) : null;

  return (
    <FlatList
      data={categoryStats}
      numColumns={2}
      keyExtractor={(stat) => stat.cat}
      ListHeaderComponent={listHeader}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      renderItem={({ item: stat }) => (
        <CategoryTile
          category={stat.cat}
          itemCount={stat.itemCount}
          expiringSoonCount={stat.expiringSoonCount}
          overdueCount={stat.overdueCount}
          recentItems={stat.recentItems}
          extraCount={stat.extraCount}
          onPress={() => onPressCategory(stat.cat)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxxl,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  expiringSoonSection: {
    paddingBottom: spacing.md,
  },
  expiringSoonLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  chipRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
});
