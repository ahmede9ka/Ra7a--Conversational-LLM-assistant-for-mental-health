import "server-only";

import { getSupabasePublicEnv } from "./env";
import { createSupabaseServerClient } from "./server";

export async function getAuthenticatedUser() {
  if (!getSupabasePublicEnv()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { supabase, user: data.user };
  } catch {
    return null;
  }
}
