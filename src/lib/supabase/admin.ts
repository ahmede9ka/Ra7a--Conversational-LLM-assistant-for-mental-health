import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseSecretKey } from "./env";
import type { Database } from "./database.types";

export function createSupabaseAdminClient() {
  const env = getSupabasePublicEnv();
  const secretKey = getSupabaseSecretKey();
  if (!env || !secretKey) throw new Error("Privileged Supabase configuration is missing.");

  return createClient<Database>(env.url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
