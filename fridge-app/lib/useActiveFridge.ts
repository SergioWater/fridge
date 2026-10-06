import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type Fridge = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  invite_code: string | null;
};

const ACTIVE_KEY = "active_fridge_id";

export function useActiveFridge(userId: string | undefined) {
  const [fridges, setFridges] = useState<Fridge[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFridges = useCallback(async () => {
    if (!userId) {
      setFridges([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("fridges")
      .select("*")
      .order("created_at", { ascending: true });
    const list = (data ?? []) as Fridge[];
    setFridges(list);

    // Restore the previously-active fridge if it still exists,
    // otherwise pick the first one.
    const stored = await AsyncStorage.getItem(ACTIVE_KEY);
    const chosen = list.find((f) => f.id === stored) ?? list[0] ?? null;
    setActiveId(chosen?.id ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadFridges();
  }, [loadFridges]);

  // Subscribe to changes in fridge_members so a new join triggers a reload.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(
        `user-fridges-watch:${userId}:${Math.random().toString(36).slice(2)}`,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fridge_members" },
        () => loadFridges(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, loadFridges]);

  const setActiveFridge = useCallback(async (id: string) => {
    setActiveId(id);
    await AsyncStorage.setItem(ACTIVE_KEY, id);
  }, []);

  const active = fridges.find((f) => f.id === activeId) ?? null;

  return {
    fridge: active,
    fridges,
    loading,
    setActiveFridge,
    reload: loadFridges,
  };
}
