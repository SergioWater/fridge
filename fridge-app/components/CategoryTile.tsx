import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, shadows, spacing } from "@/lib/theme";
import { CATEGORY_ICONS } from "@/lib/categories";
import type { Category } from "@/lib/categories";

type Props = {
  category: Category;
  itemCount: number;
  expiringSoonCount: number;
  overdueCount: number;
  recentItems: { id: string; name: string }[];
  extraCount: number;
  onPress: () => void;
};

// Typography note: using Fraunces Semibold 16 rather than type.sectionHeader (22)
// because a 2-column tile (~170px wide) is too narrow for a 22px serif without
// truncation. Still editorial-feeling; just scaled to fit.

export default function CategoryTile({
  category,
  itemCount,
  expiringSoonCount,
  overdueCount,
  recentItems,
  extraCount,
  onPress,
}: Props) {
  const Icon = CATEGORY_ICONS[category];
  const hasDots = expiringSoonCount > 0 || overdueCount > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed ? styles.tilePressed : null]}
      onPress={onPress}
    >
      <View style={styles.tileContent}>
        {/* Left column: icon, name, count, status dots */}
        <View style={styles.leftCol}>
          <Icon size={24} strokeWidth={1.75} color={colors.accent} />
          <Text style={styles.name}>{category}</Text>
          <Text style={styles.count}>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </Text>
          {hasDots ? (
            <View style={styles.dots}>
              {expiringSoonCount > 0 ? (
                <View style={[styles.dot, styles.dotWarning]} />
              ) : null}
              {overdueCount > 0 ? (
                <View style={[styles.dot, styles.dotDanger]} />
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Right column: up to 4 recent item names */}
        <View style={styles.rightCol}>
          {recentItems.map((it) => (
            <Text
              key={it.id}
              style={styles.previewName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {it.name}
            </Text>
          ))}
          {extraCount > 0 ? (
            <Text style={styles.previewMore}>+{extraCount} more</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 140,
    ...shadows.card,
  },
  tilePressed: {
    backgroundColor: colors.bgElevated,
  },
  tileContent: {
    flex: 1,
    flexDirection: "row",
  },
  leftCol: {
    flexShrink: 0,
    paddingRight: spacing.sm,
  },
  rightCol: {
    flex: 1,
    overflow: "hidden",
    paddingTop: spacing.xs,
  },
  name: {
    fontFamily: fonts.displaySemibold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  count: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  dots: {
    flexDirection: "row",
    gap: 4,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotWarning: {
    backgroundColor: colors.warning,
  },
  dotDanger: {
    backgroundColor: colors.danger,
  },
  previewName: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textPrimary,
    opacity: 0.65,
    marginBottom: spacing.xs,
  },
  previewMore: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textPrimary,
    opacity: 0.5,
  },
});
