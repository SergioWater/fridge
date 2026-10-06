import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/useAuth";
import { useActiveFridge } from "@/lib/useActiveFridge";
import StatsScreen from "@/screens/Stats";
import { colors, spacing, type } from "@/lib/theme";

export default function StatsTab() {
  const { user, loading: authLoading } = useAuth();
  const { fridge, loading: fridgeLoading } = useActiveFridge(user?.id);

  if (authLoading || fridgeLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.empty}>Sign in to see your stats.</Text>
      </SafeAreaView>
    );
  }

  if (!fridge) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.empty}>Join or create a fridge first.</Text>
      </SafeAreaView>
    );
  }

  return <StatsScreen fridgeId={fridge.id} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  empty: {
    ...type.body,
    color: colors.textMuted,
  },
});
