import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/useAuth";
import { useActiveFridge } from "@/lib/useActiveFridge";
import { useOnboarding } from "@/lib/useOnboarding";
import Menu from "@/screens/Menu";
import { colors } from "@/lib/theme";

export default function SettingsTab() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    fridge,
    fridges,
    loading: fridgeLoading,
    setActiveFridge,
    reload,
  } = useActiveFridge(user?.id);
  const { replayOnboarding } = useOnboarding();

  async function handleReplayWalkthrough() {
    await replayOnboarding();
    router.push("/onboarding/share-code");
  }

  if (authLoading || fridgeLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!fridge) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Menu
        onClose={() => {}}
        onOpenStats={() => router.push("/(tabs)/stats")}
        fridges={fridges ?? []}
        activeFridge={fridge}
        setActiveFridge={setActiveFridge}
        reload={reload}
        onReplayWalkthrough={handleReplayWalkthrough}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgBase,
  },
});
