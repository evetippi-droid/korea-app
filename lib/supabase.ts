import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

// 🔴 PANE SIIA ÕIGED VÄÄRTUSED (copy Supabase dashboardist)
const supabaseUrl = "https://dxidmvumtfgezeuppeyl.supabase.co";
const supabaseAnonKey = "sb_publishable_aoL6bp8tVUygdxGQPR86_A_Pbp3OtE1";

// debug (võid hiljem eemaldada)
console.log("SUPABASE URL:", supabaseUrl);
console.log("SUPABASE URL OK:", !!supabaseUrl);
console.log("SUPABASE KEY OK:", !!supabaseAnonKey);

const isWeb = Platform.OS === "web";

// localStorage wrapper webile
const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

// ✅ Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isWeb ? webStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});