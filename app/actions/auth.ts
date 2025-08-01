"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return redirect("/login");
  } catch (error) {
    console.error("Server logout error:", error);
    // If server action fails, we'll handle it in the client
    throw error;
  }
} 