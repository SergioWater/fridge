import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { useActiveFridge } from "@/lib/useActiveFridge";
import { CATEGORIES, normalizeCategory } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import { colors, fonts, spacing } from "@/lib/theme";
import ExpiryPicker from "@/components/ExpiryPicker";
import ItemTile from "@/components/ItemTile";
import type { Item } from "@/components/ItemTile";
import {
  cancelExpiryNotification,
  scheduleExpiryNotification,
} from "@/lib/notifications";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CategoryDetailScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { user } = useAuth();
  const { fridge, loading: fridgeLoading } = useActiveFridge(user?.id);

  // Validate the URL param — fall back to "Other" for any unknown value.
  const category: Category = CATEGORIES.includes(name as Category)
    ? (name as Category)
    : "Other";

  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const loadItems = useCallback(async () => {
    if (!fridge) return;

    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, name, quantity, unit, expiry_date, status, category")
      .eq("fridge_id", fridge.id)
      .eq("status", "active")
      .order("expiry_date", { ascending: true, nullsFirst: false });

    if (error) {
      Alert.alert("Load failed", error.message);
      setLoaded(true);
      return;
    }

    // Filter using the normalizer so legacy DB values (wrong case etc.) still match.
    const list = ((data ?? []) as Item[]).filter(
      (it) => normalizeCategory(it.category) === category,
    );
    setItems(list);
    setLoaded(true);
  }, [fridge, category]);

  useEffect(() => {
    loadItems();
    if (!fridge) return;

    const channel = supabase
      .channel(`category-detail:${fridge.id}:${category}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_items",
          filter: `fridge_id=eq.${fridge.id}`,
        },
        () => loadItems(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadItems, fridge, category]);

  async function consumeItem(id: string) {
    const { error } = await supabase
      .from("inventory_items")
      .update({ status: "consumed", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      Alert.alert("Update failed", error.message);
      return;
    }
    cancelExpiryNotification(id);
    loadItems();
  }

  async function wasteItem(id: string) {
    const { error } = await supabase
      .from("inventory_items")
      .update({ status: "wasted", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      Alert.alert("Update failed", error.message);
      return;
    }
    cancelExpiryNotification(id);
    loadItems();
  }

  async function changeCategory(itemId: string, newCategory: Category) {
    // Optimistic: remove from the current category view immediately.
    setItems((prev) => prev.filter((it) => it.id !== itemId));

    const { error } = await supabase
      .from("inventory_items")
      .update({ category: newCategory, updated_at: new Date().toISOString() })
      .eq("id", itemId);

    if (error) {
      console.warn("Category update failed:", error.message);
      loadItems();
    }
    // On success the realtime subscription on the overview will pick up the change.
  }

  async function updateItemExpiry(item: Item, newDate: Date | null) {
    const newIso = newDate ? toISODate(newDate) : null;

    // Optimistic update so the tile reacts immediately.
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, expiry_date: newIso } : it,
      ),
    );

    const { error } = await supabase
      .from("inventory_items")
      .update({ expiry_date: newIso, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    if (error) {
      Alert.alert("Update failed", error.message);
      loadItems();
      return;
    }

    cancelExpiryNotification(item.id);
    if (newIso) {
      scheduleExpiryNotification(item.id, item.name, newIso);
    }
  }

  const header = (
    <View style={styles.header}>
      <Pressable
        style={styles.backBtn}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <ArrowLeft size={20} strokeWidth={1.75} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title}>{category}</Text>
    </View>
  );

  if (fridgeLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <ActivityIndicator
          color={colors.accent}
          style={styles.loadingIndicator}
        />
      </SafeAreaView>
    );
  }

  const emptyState = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Nothing in {category} yet</Text>
      {/*
       * TODO: Commit 5 — wire pendingCategory preselect into the add bar so
       * this CTA drops the user on the Fridge tab with the category pre-set.
       * For now, router.back() returns to CategoryOverview (the Fridge tab).
       */}
      <Pressable style={styles.emptyBtn} onPress={() => router.back()}>
        <Text style={styles.emptyBtnText}>Add to {category}</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {header}

      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(it) => it.id}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadItems();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={loaded ? emptyState : (
          <ActivityIndicator
            color={colors.accent}
            style={styles.loadingIndicator}
          />
        )}
        renderItem={({ item }) => (
          <ItemTile
            item={item}
            onConsume={consumeItem}
            onWaste={wasteItem}
            onEditExpiry={(it) => setEditingItem(it)}
            onChangeCategory={changeCategory}
          />
        )}
      />

      {editingItem ? (
        <ExpiryPicker
          value={
            editingItem.expiry_date
              ? new Date(editingItem.expiry_date + "T00:00:00")
              : null
          }
          onChange={(d) => {
            const target = editingItem;
            setEditingItem(null);
            updateItemExpiry(target, d);
          }}
          autoOpen
          onDismiss={() => setEditingItem(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  title: {
    fontFamily: fonts.displaySemibold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.textPrimary,
  },
  loadingIndicator: {
    marginTop: spacing.xl,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  row: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    lineHeight: 26,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  emptyBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  emptyBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
    color: colors.textInverse,
  },
});
