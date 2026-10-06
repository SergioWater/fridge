import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@/lib/useAuth";
import { useActiveFridge } from "@/lib/useActiveFridge";
import { colors, fonts, radius, spacing } from "@/lib/theme";

export default function ShareCodeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { fridge, loading } = useActiveFridge(user?.id);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleShare() {
    if (!fridge?.invite_code) return;
    const result = await Share.share({
      message: `Join my fridge with code: ${fridge.invite_code}`,
    });
    // Backing out of the share sheet is not a decision to move on.
    if (result.action === Share.sharedAction) {
      goNext();
    }
  }

  async function handleCopy() {
    if (!fridge?.invite_code) return;
    await Clipboard.setStringAsync(fridge.invite_code);
    setCopied(true);
  }

  function goNext() {
    router.replace("/onboarding/how-to-use");
  }

  if (loading) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Your fridge is ready.</Text>
        <Text style={styles.subhead}>
          Share this code with anyone you live with. They can join from the
          app's sign-in screen.
        </Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Invite code</Text>
          <Text style={styles.code}>{fridge?.invite_code ?? "—"}</Text>
        </View>

        <Pressable style={styles.primaryBtn} onPress={handleShare}>
          <Text style={styles.primaryBtnText}>Share code</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={handleCopy}>
          <Text style={styles.secondaryBtnText}>
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.skipBtn} onPress={goNext}>
        <Text style={styles.skipText}>I'll share later</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  heading: {
    fontFamily: fonts.displaySemibold,
    fontSize: 32,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subhead: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 24,
    marginBottom: spacing.xxxl,
  },
  codeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  code: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 28,
    letterSpacing: 4,
    color: colors.textPrimary,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  primaryBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.textInverse,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textMuted,
  },
});
