'use client'
import { ResizableChatInterface } from "./ResizableChatInterface";
import { SuspenseErrorBoundary } from "./ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ChatPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-7rem)]">
      <SuspenseErrorBoundary>
        <ResizableChatInterface />
      </SuspenseErrorBoundary>
    </div>
  );
}
