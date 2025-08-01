import { createClient } from '@/utils/supabase/server';

export interface UserInfo {
  id: string;
  email: string;
  user_metadata?: any;
}

export async function getUserInfo(): Promise<UserInfo | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || '',
      user_metadata: user.user_metadata,
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return !!user;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
} 