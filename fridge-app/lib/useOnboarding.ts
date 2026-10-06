import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./useAuth";

export function useOnboarding() {
  const { user } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .single();
    if (error) {
      console.warn("[onboarding] refetch failed:", error.message, error.code);
      return;
    }
    setOnboarded(
      data?.onboarded_at !== null && data?.onboarded_at !== undefined,
    );
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setOnboarded(null);
      setLoading(false);
      return;
    }
    // Go back to loading for the real fetch. Without this the hook reports
    // "done" from the first render — before `user` even exists — so callers
    // gate on a null `onboarded`, paint the Fridge screen, and only then get
    // redirected into onboarding. That late redirect is the flash users see.
    let cancelled = false;
    setLoading(true);
    refetch().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, refetch]);

  // Edge case: users with onboarded_at = null who already have items will see
  // Step 1 on every launch until they dismiss the Step 3 tip. first-add.tsx
  // auto-redirects to tabs if items exist, so they skip Step 2.
  const markOnboarded = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id");
    if (error) {
      console.warn("[onboarding] markOnboarded error:", error.message, error.code);
    } else if (!data || data.length === 0) {
      console.warn(
        "[onboarding] markOnboarded: 0 rows updated — confirm profiles.onboarded_at column exists and RLS allows UPDATE for this user",
      );
    }
    // Dismiss locally either way. The user tapped "Got it" — the card has to go.
    // A failed write only means the tip returns on the next launch, which is far
    // better than a card that cannot be dismissed at all.
    setOnboarded(true);
  }, [user?.id]);

  // Resets onboarded_at to null so the tour can be replayed. Callers are
  // responsible for navigating to /onboarding/share-code after this returns.
  const replayOnboarding = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarded_at: null })
      .eq("id", user.id)
      .select("id");
    if (error) {
      console.warn("[onboarding] replayOnboarding error:", error.message, error.code);
      return;
    }
    if (!data || data.length === 0) {
      console.warn("[onboarding] replayOnboarding: 0 rows updated");
      return;
    }
    setOnboarded(false);
  }, [user?.id]);

  return { onboarded, markOnboarded, replayOnboarding, refetch, loading };
}
