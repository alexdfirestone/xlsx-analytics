'use client'
import { createContext, useContext, useEffect, useState } from 'react';
import { UserInfo, getUserInfo } from '@/utils/auth/getUserInfo';

interface AuthContextType {
  userInfo: UserInfo | null | undefined;
  refreshUserInfo: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userInfo, setUserInfo] = useState<UserInfo | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refreshUserInfo = async () => {
    try {
      setLoading(true);
      const info = await getUserInfo();
      setUserInfo(info);
    } finally {
      setLoading(false);
    }
  };

  // Calculate isAuthenticated based on userInfo
  const isAuthenticated = userInfo !== null && userInfo !== undefined;

  useEffect(() => {
    refreshUserInfo();
  }, []);

  return (
    <AuthContext.Provider value={{ userInfo, refreshUserInfo, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 