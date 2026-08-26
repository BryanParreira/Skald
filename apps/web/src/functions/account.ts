import { createServerFn } from "@tanstack/react-start";

import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from "@/functions/supabase";

export const deleteAccount = createServerFn({ method: "POST" }).handler(
  async () => {
    const supabase = getSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return { success: false, error: "Not authenticated" };
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userData.user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabase.auth.signOut({ scope: "local" });
    return { success: true };
  },
);
