"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/app/actions/auth";
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function LogoutButton() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
      // Fallback to client-side logout
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    }
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return null; // Don't show anything if user is not logged in
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="size-4" />
            <span className="truncate">{user.email}</span>
          </div>
          <form action={handleSignOut} className="w-full">
            <SidebarMenuButton asChild className="w-full justify-start">
              <button type="submit" className="w-full flex items-center gap-2">
                <LogOut className="size-4" />
                <span>Logout</span>
              </button>
            </SidebarMenuButton>
          </form>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
} 