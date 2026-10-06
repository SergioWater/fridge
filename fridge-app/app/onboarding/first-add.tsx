import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { useActiveFridge } from "@/lib/useActiveFridge";
import { enrichItems, shelfLifeToExpiryISO } from "@/lib/enrichItem";
import { normalizeCategory } from "@/lib/categories";
import { Plus } from "lucide-react-native";
import { colors, fonts, radius, spacing } from "@/lib/theme";

export default function FirstAddScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fridge, loading: fridgeLoading } = useActiveFridge(user?.id);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  // True only once we've confirmed the fridge has 0 active items.
  // Keeps the form hidden until then so there's no flash before the redirect.
  const [itemsChecked, setItemsChecked] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (fridgeLoading) return;

    // No fridge to add to. Let the tab router decide where this user belongs
    // instead of holding them on a spinner that never resolves.
    if (!fridge) {
      router.replace("/(tabs)");
      return;
    }

    let cancelled = false;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const { count, error } = await supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("fridge_id", fridge.id)
        .eq("status", "active");

      if (cancelled) return;

      // Replay scenario: the user already has items, so skip straight to tabs
      // where the closing tip shows. On a failed count we fall through and show
      // the form — adding a second item is a much smaller harm than a screen
      // that never finishes loading.
      if (!error && (count ?? 0) > 0) {
        router.replace("/(tabs)");
        return;
      }

      setItemsChecked(true);
      focusTimer = setTimeout(() => inputRef.current?.focus(), 300);
    })();

    return () => {
      cancelled = true;
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [fridge, fridgeLoading, router]);

  async function addItem() {
    if (!fridge || !user) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setAdding(true);
    Keyboard.dismiss();

    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        fridge_id: fridge.id,
        name: trimmed,
        quantity: 1,
        added_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      setAdding(false);
      // This is the first thing the app ever asks the user to do. If it fails
      // silently they are left tapping a button that does nothing.
      Alert.alert(
        "Couldn't add that",
        error?.message ?? "Something went wrong. Please try again.",
      );
      return;
    }

    // Fire enrichment in the background — FridgeScreen will pick up the update
    // via realtime subscription once the user lands on the tabs.
    const itemId = data.id;
    (async () => {
      const [enriched] = await enrichItems([trimmed]);
      if (!enriched) return;
      const expiryIso = shelfLifeToExpiryISO(enriched.shelf_life_days);
      await supabase
        .from("inventory_items")
        .update({
          category: normalizeCategory(enriched.category),
          estimated_price: enriched.price,
          expiry_date: expiryIso,
        })
        .eq("id", itemId);
    })().catch((e) => {
      // Enrichment is best-effort. The item is already saved; it just stays
      // uncategorized until the user runs a backfill from Settings.
      console.warn("[first-add] enrichment failed:", e);
    });

    router.replace("/(tabs)");
  }

  // Spinner while fridge is loading OR while we're checking whether items exist.
  if (fridgeLoading || !itemsChecked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.heading}>Add your first item.</Text>
        <Text style={styles.hint}>Try &quot;milk&quot; or &quot;eggs&quot;.</Text>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.pill}>
          <TextInput
            ref={inputRef}
            style={styles.pillInput}
            value={name}
            onChangeText={setName}
            placeholder="What's in your fridge?"
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={addItem}
            returnKeyType="done"
            editable={!adding}
          />
        </View>
        <Pressable
          style={[
            styles.addCircle,
            !name.trim() || adding ? styles.disabled : null,
          ]}
          onPress={addItem}
          disabled={!name.trim() || adding}
        >
          <Plus size={22} strokeWidth={2} color={colors.textInverse} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgBase,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    paddingHorizontal: spacing.xl,
    paddingTop: 100,
    paddingBottom: spacing.xxxl,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  heading: {
    fontFamily: fonts.displaySemibold,
    fontSize: 36,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  hint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 18,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
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
  disabled: { opacity: 0.4 },
});
