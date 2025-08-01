'use client'
import { UploadClient } from "./upload-client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function UploadPage() {
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
    <div className="flex justify-center">
      <div className="w-full max-w-lg">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Upload Excel File</h1>
            <p className="text-muted-foreground">
              Select an Excel file to analyze your data
            </p>
          </div>
          
          <UploadClient />
        </div>
      </div>
    </div>
  );
}