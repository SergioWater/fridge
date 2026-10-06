import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MoreHorizontal } from "lucide-react-native";
import { colors, fonts, radius, shadows, spacing } from "@/lib/theme";
import { CATEGORIES, normalizeCategory } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import { formatExpiry } from "@/lib/dates";

// Mirrors Item in Fridge.tsx — kept local; structural typing makes them compatible.
export type Item = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  expiry_date: string | null;
  status: string;
  category: string | null;
};

type Props = {
  item: Item;
  onConsume: (id: string) => void;
  onWaste: (id: string) => void;
  onEditExpiry: (item: Item) => void;
  onChangeCategory: (id: string, newCategory: Category) => void;
};

export default function ItemTile({ item, onConsume, onWaste, onEditExpiry, onChangeCategory }: Props) {
  const expiry = formatExpiry(item.expiry_date);
  const expiryColor =
    expiry.tone === "danger"
      ? colors.danger
      : expiry.tone === "warning"
        ? colors.warning
        : expiry.tone === "neutral"
          ? colors.textMuted
          : colors.textFaint;

  const showQty = item.quantity > 1 || Boolean(item.unit);

  function showCategoryPicker() {
    const currentCat = normalizeCategory(item.category);
    // ✓ is the Unicode CHECK MARK symbol (not an emoji) — standard for
    // indicating the selected item in an iOS action sheet option list.
    const catOptions = CATEGORIES.map((cat) =>
      cat === currentCat ? `✓ ${cat}` : cat,
    );

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...catOptions, "Cancel"],
          cancelButtonIndex: catOptions.length,
        },
        (idx) => {
          if (idx < CATEGORIES.length) {
            const chosen = CATEGORIES[idx];
            if (chosen !== currentCat) {
              onChangeCategory(item.id, chosen);
            }
          }
        },
      );
    } else {
      Alert.alert(
        "Move to category",
        undefined,
        [
          ...CATEGORIES.map((cat) => ({
            text: cat === currentCat ? `✓ ${cat}` : cat,
            onPress: () => {
              if (cat !== currentCat) onChangeCategory(item.id, cat);
            },
          })),
          { text: "Cancel", style: "cancel" as const },
        ],
      );
    }
  }

  function showMenu() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Move to another category…", "Cancel"],
          cancelButtonIndex: 1,
        },
        (idx) => {
          if (idx === 0) showCategoryPicker();
        },
      );
    } else {
      Alert.alert(item.name, undefined, [
        { text: "Move to another category…", onPress: showCategoryPicker },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  return (
    <View style={styles.tile}>
      {/* Pressable body — tap to edit expiry */}
      <Pressable
        style={styles.body}
        onPress={() => onEditExpiry(item)}
      >
        <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
          {item.name}
        </Text>
        {showQty ? (
          <Text style={styles.qty}>
            {item.quantity > 1 ? `qty ${item.quantity}` : ""}
            {item.quantity > 1 && item.unit ? " " : ""}
            {item.unit ?? ""}
          </Text>
        ) : null}
        <Text style={[styles.expiry, { color: expiryColor }]}>
          {expiry.text}
        </Text>
      </Pressable>

      {/* Action buttons always at the bottom of the tile */}
      <View style={styles.actions}>
        <Pressable
          style={styles.usedBtn}
          onPress={() => onConsume(item.id)}
        >
          <Text style={styles.usedText}>Used</Text>
        </Pressable>
        <Pressable
          style={styles.tossBtn}
          onPress={() => onWaste(item.id)}
        >
          <Text style={styles.tossText}>Toss</Text>
        </Pressable>
      </View>

      {/* Three-dots menu — absolutely positioned so it overlays the body without
          affecting tile layout. Rendered last so it sits above the body Pressable
          in z-order and captures touches first. */}
      <Pressable style={styles.menuBtn} hitSlop={8} onPress={showMenu}>
        <MoreHorizontal size={18} strokeWidth={1.75} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 130,
    flexDirection: "column",
    ...shadows.card,
  },
  body: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
    // Right-side padding so the name text doesn't run under the dots button.
    paddingRight: spacing.lg,
  },
  qty: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  expiry: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  usedBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
  },
  usedText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  tossBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
  },
  tossText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.danger,
  },
  menuBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    opacity: 0.5,
  },
});
