import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DashboardNav } from "./dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] min-h-screen">
      {/* Sidebar */}
      <aside className="bg-muted p-4">
        <DashboardNav />
      </aside>

      {/* Main content */}
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}