'use client'
import { Suspense } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';

function AuthRefreshContent() {
  const { refreshUserInfo } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const authRefresh = searchParams.get('auth_refresh');

  useEffect(() => {
    async function handleRefresh() {
      if (authRefresh === 'true') {
        await refreshUserInfo();
        // Remove the auth_refresh parameter from the URL
        const newUrl = window.location.pathname;
        router.replace(newUrl);
      }
    }

    handleRefresh();
  }, [authRefresh, refreshUserInfo, router]);

  return null;
}

export function AuthRefresh() {
  return (
    <Suspense>
      <AuthRefreshContent />
    </Suspense>
  );
} 