import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, shadows, spacing } from "@/lib/theme";

type Props = {
  onDismiss: () => Promise<void>;
};

export default function OnboardingTip({ onDismiss }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Text style={styles.headline}>Nice.</Text>
        <Text style={styles.subtext}>
          We'll watch the expiry for you. Tip: tap Scan receipt to add a bunch
          at once.
        </Text>
      </View>
      <Pressable style={styles.btn} onPress={onDismiss}>
        <Text style={styles.btnText}>Got it</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.card,
  },
  body: { flex: 1 },
  headline: {
    fontFamily: fonts.displaySemibold,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtext: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  btnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    color: colors.textInverse,
  },
});
