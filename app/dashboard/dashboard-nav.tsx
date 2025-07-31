"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      <Link href="/dashboard/upload">
        <Button 
          variant={pathname === "/dashboard/upload" ? "secondary" : "ghost"}
          className="w-full justify-start"
          asChild
        >
          <span>Upload</span>
        </Button>
      </Link>
      <Link href="/dashboard/chat">
        <Button 
          variant={pathname === "/dashboard/chat" ? "secondary" : "ghost"}
          className="w-full justify-start"
          asChild
        >
          <span>Chat</span>
        </Button>
      </Link>
    </nav>
  );
} 