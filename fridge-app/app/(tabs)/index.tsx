import { useEffect, useState, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { useOnboarding } from "../../lib/useOnboarding";
import SignIn from "../../screens/SignIn";
import CreateFridge from "../../screens/CreateFridge";
import FridgeScreen from "../../screens/Fridge";
import { colors } from "../../lib/theme";

// Module-level flag: prevents re-routing to onboarding when the user
// navigates back to tabs mid-flow (e.g., share-code → first-add → tabs).
// Resets only on full app restart, which is the correct behavior — a user
// who hasn't dismissed the Step 3 tip should see share-code again on re-launch.
let onboardingRedirectFired = false;

export default function Home() {
  const router = useRouter();
  const { session, user, loading: authLoading } = useAuth();
  const { onboarded, markOnboarded, refetch: refetchOnboarding, loading: onboardingLoading } = useOnboarding();
  const [hasFridge, setHasFridge] = useState<boolean | null>(null);

  const checkFridge = useCallback(async () => {
    if (!user) {
      setHasFridge(null);
      return;
    }
    const { count } = await supabase
      .from("fridges")
      .select("id", { count: "exact", head: true });
    setHasFridge((count ?? 0) > 0);
  }, [user]);

  useEffect(() => {
    checkFridge();
  }, [checkFridge]);

  // Re-run the check whenever a fridge row is inserted.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`membership-watch:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fridges" },
        () => checkFridge(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fridge_members" },
        () => checkFridge(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, checkFridge]);

  // Re-read the onboarding flag from the DB when this tab gains focus. This
  // ensures that after a replay (Settings → share-code → first-add → tabs),
  // the FridgeScreen picks up onboarded=false and shows the Step 3 tip.
  useFocusEffect(
    useCallback(() => {
      refetchOnboarding();
    }, [refetchOnboarding]),
  );

  // Route unboarded users to the onboarding flow — once per session.
  useEffect(() => {
    if (onboardingRedirectFired) return;
    if (hasFridge && onboarded === false) {
      onboardingRedirectFired = true;
      router.push("/onboarding/share-code");
    }
  }, [hasFridge, onboarded]);

  const handleFridgeCreated = useCallback(() => {
    // Set the flag so the useEffect above won't also try to route.
    onboardingRedirectFired = true;
    router.push("/onboarding/share-code");
  }, []);

  const isLoading =
    authLoading ||
    (!!session && hasFridge === null) ||
    // Only block render while onboarding loads if we know the user has a fridge
    // (prevents a spinner for every signed-in launch).
    (!!session && hasFridge === true && onboardingLoading);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgBase }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!session) return <SignIn />;
  if (!hasFridge) return <CreateFridge onCreated={handleFridgeCreated} />;
  return (
    <FridgeScreen
      onboarded={onboarded === true}
      onMarkOnboarded={markOnboarded}
    />
  );
}
