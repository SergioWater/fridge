import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BarChart3, CalendarClock, Camera, Receipt } from "lucide-react-native";
import { colors, fonts, radius, spacing } from "@/lib/theme";

// One screen the user leaves when they are ready, rather than a timed tour.
// Deliberately static: no data hooks, so nothing here can resolve late and
// yank the screen out from under someone mid-sentence.
const STEPS = [
  {
    Icon: Receipt,
    title: "Scan a receipt",
    body: "Photograph a receipt and we add every line item at once.",
  },
  {
    Icon: Camera,
    title: "Or scan an item",
    body: "Point at a barcode and we look up the product for you.",
  },
  {
    Icon: CalendarClock,
    title: "We watch the dates",
    body: "Everything gets an expiry date and a reminder before it turns. Tap any date to change it.",
  },
  {
    Icon: BarChart3,
    title: "Used or Toss",
    body: "Tap Used when you eat it, Toss when it goes bad. The Waste tab shows what you lost and what it cost.",
  },
];

export default function HowToUseScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Here&apos;s how it works.</Text>

        {STEPS.map(({ Icon, title, body }) => (
          <View key={title} style={styles.row}>
            <View style={styles.iconWrap}>
              <Icon size={20} strokeWidth={1.75} color={colors.accent} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{title}</Text>
              <Text style={styles.rowText}>{body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={styles.primaryBtn}
        onPress={() => router.replace("/onboarding/first-add")}
      >
        <Text style={styles.primaryBtnText}>Got it</Text>
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
  scroll: { paddingBottom: spacing.xl },
  heading: {
    fontFamily: fonts.displaySemibold,
    fontSize: 32,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  rowText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 21,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.textInverse,
  },
});
