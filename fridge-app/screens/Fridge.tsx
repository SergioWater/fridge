import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Alert,
  Keyboard,
  LayoutAnimation,
  SectionList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { useActiveFridge } from "@/lib/useActiveFridge";
import CategoryOverview from "@/components/CategoryOverview";
import OnboardingTip from "@/components/OnboardingTip";
import ScanBarcode from "./ScanBarcode";
import ScanReceipt from "./ScanReceipt";
import { lookupBarcode } from "@/lib/productLookup";
import { ParsedItem } from "@/lib/parseReceipt";
import ExpiryPicker from "@/components/ExpiryPicker";
import { Camera, Pencil, Plus, Receipt } from "lucide-react-native";
import { colors, fonts, radius, spacing, type } from "@/lib/theme";
import { CATEGORIES, normalizeCategory } from "@/lib/categories";
import { useFridgeLayout } from "@/lib/useFridgeLayout";
import { formatExpiry } from "@/lib/dates";
import {
  enrichItems,
  shelfLifeToExpiryISO,
} from "@/lib/enrichItem";
import {
  requestNotificationPermissions,
  scheduleExpiryNotification,
  cancelExpiryNotification,
  rescheduleAllFromItems,
} from "@/lib/notifications";

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

type Section = {
  title: string;
  data: Item[];
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}


type Props = {
  onboarded: boolean;
  onMarkOnboarded: () => Promise<void>;
};

export default function FridgeScreen({ onboarded, onMarkOnboarded }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { fridge, loading: fridgeLoading } = useActiveFridge(user?.id);

  const [items, setItems] = useState<Item[]>([]);
  const mode = useFridgeLayout(items.length);
  const [newName, setNewName] = useState("");
  const [newExpiry, setNewExpiry] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);

  const [scanOpen, setScanOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const inputRef = useRef<TextInput | null>(null);

  // Show the expiry picker below the pill only when the user has typed something.
  const showExpiry = newName.length > 0;
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [showExpiry]);

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  const loadItems = useCallback(async () => {
    if (!fridge) return;

    await supabase.rpc("sweep_expired_items", { _fridge_id: fridge.id });

    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, name, quantity, unit, expiry_date, status, category, created_at")
      .eq("fridge_id", fridge.id)
      .eq("status", "active")
      .order("expiry_date", { ascending: true, nullsFirst: false });
    if (error) {
      Alert.alert("Load failed", error.message);
      return;
    }
    const list = (data ?? []) as Item[];
    setItems(list);
    rescheduleAllFromItems(list);
  }, [fridge]);

  useEffect(() => {
    loadItems();
    if (!fridge) return;

    const channel = supabase
      .channel(`inventory:${fridge.id}:${Math.random().toString(36).slice(2)}`)
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
  }, [loadItems, fridge]);

  // Group items into sections, one per category. Empty categories still appear.
  const sections = useMemo<Section[]>(() => {
    return CATEGORIES.map((cat) => ({
      title: cat,
      data: items.filter((it) => normalizeCategory(it.category) === cat),
    }));
  }, [items]);

  async function addItem() {
    if (!fridge || !user) return;
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    setNewName("");
    Keyboard.dismiss();
    const chosenExpiry = newExpiry ? toISODate(newExpiry) : null;
    setNewExpiry(null);

    // Capture and clear the pending category so the closure below can use it.
    const capturedCategory = pendingCategory;
    setPendingCategory(null);

    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        fridge_id: fridge.id,
        name: trimmedName,
        quantity: 1,
        expiry_date: chosenExpiry,
        added_by: user.id,
        category: capturedCategory,
      })
      .select("id")
      .single();

    if (error) {
      Alert.alert("Add failed", error.message);
      return;
    }

    const itemId = data?.id;
    loadItems();

    if (itemId && chosenExpiry) {
      scheduleExpiryNotification(itemId, trimmedName, chosenExpiry);
    }

    (async () => {
      if (!itemId) return;
      const [enriched] = await enrichItems([trimmedName]);
      if (!enriched) return;

      const expiryIso =
        chosenExpiry ?? shelfLifeToExpiryISO(enriched.shelf_life_days);

      const { error: updateErr } = await supabase
        .from("inventory_items")
        .update({
          // Preserve user-chosen category; only let Gemini set it if unknown.
          ...(capturedCategory ? {} : { category: normalizeCategory(enriched.category) }),
          estimated_price: enriched.price,
          expiry_date: expiryIso,
        })
        .eq("id", itemId);

      if (updateErr) {
        console.warn("Background enrichment update failed:", updateErr.message);
        return;
      }

      if (!chosenExpiry && expiryIso) {
        scheduleExpiryNotification(itemId, trimmedName, expiryIso);
      }
    })();
  }

  async function addBulk(parsed: ParsedItem[]) {
    if (!fridge || !user) return;
    if (parsed.length === 0) return;

    const rows = parsed.map((p) => ({
      fridge_id: fridge.id,
      name: p.name.trim(),
      quantity: Math.max(1, Math.round(p.quantity || 1)),
      unit: p.unit,
      added_by: user.id,
    }));

    const { data, error } = await supabase
      .from("inventory_items")
      .insert(rows)
      .select("id, name");

    if (error) {
      throw new Error(error.message);
    }
    loadItems();

    const inserted = (data ?? []) as { id: string; name: string }[];
    if (inserted.length === 0) return;

    (async () => {
      const names = inserted.map((r) => r.name);
      const enriched = await enrichItems(names);
      if (enriched.length === 0) return;

      await Promise.all(
        inserted.map(async (row, idx) => {
          const e = enriched[idx];
          if (!e) return;
          const expiryIso = shelfLifeToExpiryISO(e.shelf_life_days);
          const { error: updErr } = await supabase
            .from("inventory_items")
            .update({
              category: normalizeCategory(e.category),
              estimated_price: e.price,
              expiry_date: expiryIso,
            })
            .eq("id", row.id);
          if (updErr) {
            console.warn(
              `Enrich update failed for ${row.name}:`,
              updErr.message,
            );
            return;
          }
          scheduleExpiryNotification(row.id, row.name, expiryIso);
        }),
      );
    })();
  }

  async function handleScanned(barcode: string) {
    setScanOpen(false);
    const product = await lookupBarcode(barcode);
    if (product.name) {
      setNewName(product.name);
    } else {
      setNewName(`Item ${barcode}`);
    }
  }

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

  async function updateItemExpiry(item: Item, newDate: Date | null) {
    if (!fridge) return;
    const newIso = newDate ? toISODate(newDate) : null;
    const originalIso = item.expiry_date;

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

    if (item.category && originalIso && newIso) {
      const delta = daysBetween(originalIso, newIso);
      if (delta !== 0) {
        const { error: rpcErr } = await supabase.rpc(
          "record_shelf_life_adjustment",
          {
            _fridge_id: fridge.id,
            _category: item.category,
            _delta_days: delta,
          },
        );
        if (rpcErr) {
          console.warn("record_shelf_life_adjustment failed:", rpcErr.message);
        }
      }
    }
  }

  function renderItem({ item }: { item: Item }) {
    const expiry = formatExpiry(item.expiry_date);
    const expiryColor =
      expiry.tone === "danger"
        ? colors.danger
        : expiry.tone === "warning"
          ? colors.warning
          : expiry.tone === "neutral"
            ? colors.textMuted
            : colors.textFaint;

    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>
            qty {item.quantity}
            {item.unit ? ` ${item.unit}` : ""}
          </Text>
          <Pressable
            onPress={() => setEditingItem(item)}
            hitSlop={6}
            style={styles.expiryRow}
          >
            <Text style={[styles.itemExpiry, { color: expiryColor }]}>
              {expiry.text}
            </Text>
            <Pencil size={12} color={expiryColor} strokeWidth={1.75} />
          </Pressable>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            style={styles.consumeBtn}
            onPress={() => consumeItem(item.id)}
          >
            <Text style={styles.consumeText}>Used</Text>
          </Pressable>
          <Pressable
            style={styles.wasteBtn}
            onPress={() => wasteItem(item.id)}
          >
            <Text style={styles.wasteText}>Toss</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderSectionHeader({ section }: { section: Section }) {
    const isEmpty = section.data.length === 0;
    return (
      <View
        style={[
          styles.sectionHeader,
          isEmpty ? styles.sectionHeaderEmpty : null,
        ]}
      >
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {section.data.length > 0 ? (
          <Text style={styles.sectionCount}>{section.data.length}</Text>
        ) : null}
        <View style={{ flex: 1 }} />
        {isEmpty ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              setPendingCategory(section.title);
              inputRef.current?.focus();
            }}
          >
            <Text style={styles.sectionAddLink}>Add to {section.title}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (fridgeLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>Loading fridge...</Text>
      </View>
    );
  }

  if (!fridge) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>No fridge yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{fridge.name}</Text>
        {fridge.invite_code ? (
          <Text style={styles.inviteCode}>Code: {fridge.invite_code}</Text>
        ) : null}
      </View>

      <View style={styles.scanChipRow}>
        <Pressable
          style={styles.scanChip}
          hitSlop={8}
          onPress={() => setScanOpen(true)}
        >
          <View style={styles.scanChipContent}>
            <Camera size={16} strokeWidth={1.75} color={colors.textPrimary} />
            <Text style={styles.scanChipText}>Scan item</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.scanChip}
          hitSlop={8}
          onPress={() => setReceiptOpen(true)}
        >
          <View style={styles.scanChipContent}>
            <Receipt size={16} strokeWidth={1.75} color={colors.textPrimary} />
            <Text style={styles.scanChipText}>Scan receipt</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.pillRow}>
        <View style={styles.pill}>
          <TextInput
            ref={inputRef}
            style={styles.pillInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Add an item"
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={addItem}
            returnKeyType="done"
          />
        </View>
        <Pressable style={styles.addCircle} onPress={addItem}>
          <Plus size={22} strokeWidth={2} color={colors.textInverse} />
        </Pressable>
      </View>

      {showExpiry ? (
        <View style={styles.expiryPickerRow}>
          <ExpiryPicker value={newExpiry} onChange={setNewExpiry} />
        </View>
      ) : null}

      {!onboarded && items.length > 0 ? (
        <OnboardingTip onDismiss={onMarkOnboarded} />
      ) : null}

      {mode === "grid" ? (
        <CategoryOverview
          items={items}
          // Route typed once app/(tabs)/category/[name].tsx lands in Commit 4.6.
          onPressCategory={(cat) => router.push(`/category/${cat}` as any)}
          consumeItem={consumeItem}
          wasteItem={wasteItem}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadItems();
            setRefreshing(false);
          }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(it) => it.id}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
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
        />
      )}

      {scanOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <ScanBarcode
            onScanned={handleScanned}
            onClose={() => setScanOpen(false)}
          />
        </View>
      ) : null}

      {receiptOpen ? (
        <View style={StyleSheet.absoluteFill}>
          <ScanReceipt
            onClose={() => setReceiptOpen(false)}
            onConfirm={addBulk}
          />
        </View>
      ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 72,
    backgroundColor: colors.bgBase,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgBase,
  },
  centerText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    color: colors.textMuted,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.displaySemibold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  inviteCode: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  scanChipRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  scanChip: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scanChipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    opacity: 0.8,
  },
  scanChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pillInput: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  addCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  expiryPickerRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bgBase,
  },
  sectionHeaderEmpty: {
    opacity: 0.4,
  },
  sectionTitle: {
    ...type.sectionHeader,
  },
  sectionCount: {
    ...type.sectionMeta,
    marginLeft: spacing.xs,
    alignSelf: "flex-end",
    marginBottom: 2,
  },
  sectionAddLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.accent,
  },
  // Item rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowActions: { flexDirection: "row", gap: 6 },
  itemName: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  itemMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 3,
  },
  itemExpiry: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
  },
  consumeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.bgElevated,
  },
  consumeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  wasteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.dangerSoft,
  },
  wasteText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.danger,
  },
});
