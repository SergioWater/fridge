import { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { colors, spacing, radius, fonts } from "@/lib/theme";

type Mode = "create" | "join";

type Props = {
  onCreated?: () => void;
};

export default function CreateFridge({ onCreated }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function createFridge() {
    if (!name.trim()) {
      Alert.alert("Give your fridge a name first.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("create_fridge", {
      _name: name.trim(),
    });
    if (error) {
      Alert.alert("Create failed", error.message);
    } else {
      onCreated?.();
    }
    setLoading(false);
  }

  async function joinFridge() {
    setLoading(true);
    const { error } = await supabase.rpc("join_fridge", {
      p_code: code,
    });
    if (error) Alert.alert("Join failed", error.message);
    else Alert.alert("Joined!", "You've been added to the fridge.");
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function handleCodeChange(text: string) {
    setCode(text.toUpperCase().replace(/\s/g, ""));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {mode === "create" ? "Create a fridge" : "Join a fridge"}
      </Text>
      <Text style={styles.sub}>Signed in as {user?.email}</Text>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, mode === "create" ? styles.tabActive : null]}
          onPress={() => setMode("create")}
        >
          <Text
            style={[styles.tabText, mode === "create" ? styles.tabTextActive : null]}
          >
            Create
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === "join" ? styles.tabActive : null]}
          onPress={() => setMode("join")}
        >
          <Text
            style={[styles.tabText, mode === "join" ? styles.tabTextActive : null]}
          >
            Join
          </Text>
        </Pressable>
      </View>

      {mode === "create" ? (
        <>
          <Text style={styles.label}>Fridge name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Kitchen, Garage, Mom's house..."
            placeholderTextColor={colors.textFaint}
          />
          <Pressable
            style={[styles.button, loading ? styles.disabled : null]}
            disabled={loading}
            onPress={createFridge}
          >
            <Text style={styles.buttonText}>Create</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>Invite code</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={handleCodeChange}
            placeholder="Enter 10-character code"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
          />
          <Pressable
            style={[styles.button, (loading || code.length !== 10) ? styles.disabled : null]}
            disabled={loading || code.length !== 10}
            onPress={joinFridge}
          >
            <Text style={styles.buttonText}>Join</Text>
          </Pressable>
        </>
      )}

      <Pressable style={styles.linkRow} onPress={signOut}>
        <Text style={styles.link}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
    backgroundColor: colors.bgBase,
  },
  title: {
    fontFamily: fonts.displaySemibold,
    fontSize: 28,
    textAlign: "center",
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.xs,
  },
  tabs: {
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
    fontFamily: fonts.bodyMedium,
    color: colors.textMuted,
  },
  tabTextActive: {
    fontFamily: fonts.bodySemibold,
    color: colors.textPrimary,
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
    color: colors.textPrimary,
    backgroundColor: colors.bgCard,
  },
  codeInput: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 2,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: {
    fontFamily: fonts.bodySemibold,
    color: colors.textInverse,
    fontSize: 16,
  },
  disabled: { opacity: 0.4 },
  linkRow: { marginTop: spacing.xl, alignItems: "center" },
  link: {
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
    fontSize: 14,
  },
});
