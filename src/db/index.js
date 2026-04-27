import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const normalizeSupabaseUrl = (url) => {
  if (!url) return url;
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
};

const rawUrl = process.env.SUPABASE_URI || process.env.SUPABASE_URL;
export const supabaseUrl = normalizeSupabaseUrl(rawUrl);
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase URL:", supabaseUrl ? "Loaded" : "Missing");
console.log("Supabase Anon Key:", supabaseAnonKey ? "Loaded" : "Missing");
console.log("Supabase Service Key:", supabaseServiceRoleKey ? "Loaded" : "Missing");

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables");
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

export const createUserClient = (accessToken) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase not configured properly");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};