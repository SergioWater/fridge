import { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";

import { supabase } from "@/lib/supabase";
import { colors, fonts, radius, spacing } from "@/lib/theme";
import { useAuth } from "@/lib/useAuth";
import { Fridge } from "@/lib/useActiveFridge";
import { backfillFridgeItems } from "@/lib/enrichItem";

type Props = {
  onClose: () => void;
  onOpenStats: () => void;
  fridges: Fridge[];
  activeFridge: Fridge | null;
  setActiveFridge: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  onReplayWalkthrough: () => Promise<void>;
};

export default function Menu({
  onClose,
  onOpenStats,
  fridges,
  activeFridge,
  setActiveFridge,
  reload,
  onReplayWalkthrough,
}: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const isOwner = user?.id === activeFridge?.created_by;

  function handleCodeChange(text: string) {
    setCode(text.toUpperCase().replace(/\s/g, ""));
  }

  async function joinByCode() {
    setLoading(true);
    const { data, error } = await supabase.rpc("join_fridge", {
      p_code: code,
    });
    if (error) {
      Alert.alert("Join failed", error.message);
    } else {
      setCode("");
      await reload();
      if (data) await setActiveFridge(data as string);
    }
    setLoading(false);
  }

  async function pickFridge(f: Fridge) {
    if (renamingId === f.id) return;
    await setActiveFridge(f.id);
    onClose();
  }

  function startRename(f: Fridge) {
    setRenamingId(f.id);
    setRenameDraft(f.name);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameDraft("");
  }

  async function saveRename() {
    if (!renamingId) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      Alert.alert("Name cannot be empty");
      return;
    }
    setRenameSaving(true);
    const { error } = await supabase.rpc("rename_fridge", {
      _fridge_id: renamingId,
      _new_name: trimmed,
    });
    setRenameSaving(false);
    if (error) {
      Alert.alert("Rename failed", error.message);
      return;
    }
    cancelRename();
    await reload();
  }

  async function runBackfill() {
    if (!activeFridge) return;
    setBackfilling(true);
    try {
      const { updated, total } = await backfillFridgeItems(activeFridge.id);
      if (total === 0) {
        Alert.alert(
          "Nothing to backfill",
          "All items already have categories.",
        );
      } else {
        Alert.alert(
          "Backfill complete",
          `Updated ${updated} of ${total} item${total === 1 ? "" : "s"}.`,
        );
      }
    } catch (e: any) {
      Alert.alert("Backfill failed", e?.message ?? "Unknown error");
    } finally {
      setBackfilling(false);
    }
  }

  function confirmRegenerate() {
    Alert.alert(
      "Regenerate invite code?",
      "The old code will stop working. You'll need to share the new one with anyone who hasn't joined yet.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Regenerate", style: "destructive", onPress: doRegenerate },
      ],
    );
  }

  async function doRegenerate() {
    if (!activeFridge) return;
    setRegenLoading(true);
    const { data, error } = await supabase.rpc("regenerate_invite_code", {
      p_fridge_id: activeFridge.id,
    });
    setRegenLoading(false);
    if (error) {
      Alert.alert("Regenerate failed", error.message);
      return;
    }
    await reload();
    setNewCode(data as string);
  }

  async function copyCode() {
    if (!newCode) return;
    await Clipboard.setStringAsync(newCode);
  }

  async function shareCode() {
    if (!newCode) return;
    await Share.share({ message: `Join my fridge with code: ${newCode}` });
  }

  function confirmReplayWalkthrough() {
    Alert.alert(
      "Replay walkthrough?",
      "We'll show you the share code, how it works, and the first-add tour again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replay",
          onPress: onReplayWalkthrough,
        },
      ],
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.sub}>Signed in as {user?.email}</Text>

      <Text style={styles.section}>Your fridges</Text>
      <Text style={styles.hint}>Long-press a fridge to rename it.</Text>
      {fridges.length === 0 ? (
        <Text style={styles.empty}>No fridges yet.</Text>
      ) : null}
      {fridges.map((f) => {
        const isRenaming = renamingId === f.id;
        if (isRenaming) {
          return (
            <View key={f.id} style={styles.row}>
              <TextInput
                style={styles.renameInput}
                value={renameDraft}
                onChangeText={setRenameDraft}
                placeholder="Fridge name"
                placeholderTextColor={colors.textFaint}
                autoFocus
                maxLength={40}
                onSubmitEditing={saveRename}
                returnKeyType="done"
              />
              <Pressable
                style={[styles.renameBtn, renameSaving ? styles.disabled : null]}
                disabled={renameSaving}
                onPress={saveRename}
              >
                <Text style={styles.renameBtnText}>Save</Text>
              </Pressable>
              <Pressable
                style={styles.renameCancelBtn}
                disabled={renameSaving}
                onPress={cancelRename}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </Pressable>
            </View>
          );
        }
        return (
          <Pressable
            key={f.id}
            style={styles.row}
            onPress={() => pickFridge(f)}
            onLongPress={() => startRename(f)}
            delayLongPress={350}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{f.name}</Text>
              {f.invite_code ? (
                <Text style={styles.rowCode}>
                  Code: <Text style={styles.codeText}>{f.invite_code}</Text>
                </Text>
              ) : null}
            </View>
            {activeFridge?.id === f.id ? (
              <Text style={styles.check}>Active</Text>
            ) : null}
          </Pressable>
        );
      })}

      {isOwner && activeFridge ? (
        <Pressable
          style={[styles.row, regenLoading ? styles.disabled : null]}
          disabled={regenLoading}
          onPress={confirmRegenerate}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>
              {regenLoading ? "Regenerating..." : "Regenerate invite code"}
            </Text>
            <Text style={styles.rowCode}>
              Create a new code; the old one stops working
            </Text>
          </View>
          <Text style={styles.check}>→</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>Stats</Text>
      <Pressable
        style={styles.row}
        onPress={() => {
          onClose();
          onOpenStats();
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>Waste tracker</Text>
          <Text style={styles.rowCode}>See how much you're throwing out</Text>
        </View>
        <Text style={styles.check}>→</Text>
      </Pressable>

      <Text style={styles.section}>Maintenance</Text>
      <Pressable
        style={[styles.row, backfilling ? styles.disabled : null]}
        disabled={backfilling || !activeFridge}
        onPress={runBackfill}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>
            {backfilling ? "Backfilling..." : "Backfill old items"}
          </Text>
          <Text style={styles.rowCode}>
            Fill in category, price, and expiry for items added before smart
            enrichment
          </Text>
        </View>
        <Text style={styles.check}>→</Text>
      </Pressable>

      <Text style={styles.section}>Help</Text>
      <Pressable style={styles.row} onPress={confirmReplayWalkthrough}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>Replay walkthrough</Text>
        </View>
        <Text style={styles.check}>→</Text>
      </Pressable>

      <Text style={styles.section}>Join another fridge</Text>
      <View style={styles.joinRow}>
        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={handleCodeChange}
          placeholder="10-character invite code"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={10}
        />
        <Pressable
          style={[styles.joinBtn, (loading || code.length !== 10) ? styles.disabled : null]}
          disabled={loading || code.length !== 10}
          onPress={joinByCode}
        >
          <Text style={styles.joinBtnText}>Join</Text>
        </Pressable>
      </View>

      <Pressable style={styles.signOutRow} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Modal
        visible={newCode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNewCode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New invite code</Text>
            <Text style={styles.modalBody}>
              Share this with anyone you want to invite. The old code no longer
              works.
            </Text>
            <Text style={styles.modalCode}>{newCode}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={copyCode}>
                <Text style={styles.modalBtnText}>Copy</Text>
              </Pressable>
              <Pressable style={styles.modalBtn} onPress={shareCode}>
                <Text style={styles.modalBtnText}>Share</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.modalDoneBtn}
              onPress={() => setNewCode(null)}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    padding: spacing.xl,
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.displaySemibold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textFaint,
    marginBottom: spacing.xs,
  },
  empty: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textFaint,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  rowName: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  rowCode: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 1,
  },
  check: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    color: colors.accent,
  },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  renameBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  renameBtnText: {
    fontFamily: fonts.bodySemibold,
    color: colors.textInverse,
    fontSize: 13,
  },
  renameCancelBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  renameCancelText: {
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
    fontSize: 13,
  },
  joinRow: { flexDirection: "row", gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.bgCard,
  },
  codeInput: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 2,
  },
  joinBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  joinBtnText: {
    fontFamily: fonts.bodySemibold,
    color: colors.textInverse,
  },
  disabled: { opacity: 0.4 },
  signOutRow: { marginTop: spacing.xxl, alignItems: "center", padding: spacing.md },
  signOutText: {
    fontFamily: fonts.bodyMedium,
    color: colors.danger,
    fontSize: 15,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  modalTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  modalCode: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 24,
    letterSpacing: 3,
    color: colors.textPrimary,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  modalBtnText: {
    fontFamily: fonts.bodySemibold,
    color: colors.textInverse,
    fontSize: 15,
  },
  modalDoneBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  modalDoneText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textMuted,
  },
});
