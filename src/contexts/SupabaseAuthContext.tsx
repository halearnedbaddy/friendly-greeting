import { useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getCurrentUser,
  requestOTP as supabaseRequestOTP,
  loginWithPhone,
  loginWithEmail as supabaseLoginWithEmail,
  registerWithPhone,
  registerWithEmail as supabaseRegisterWithEmail,
  logout as supabaseLogout,
} from '@/services/supabaseAuth';
import { api } from '@/services/api';
import { SupabaseAuthContext } from './supabaseAuthContextDef';
import type { SupabaseAuthUser as User } from './supabaseAuthContextDef';

// Default to Supabase so auth runs without backend (set VITE_USE_SUPABASE=false to use Express auth)
const useSupabaseOnly = import.meta.env.VITE_USE_SUPABASE !== 'false';

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // IMPORTANT: Edge functions like wallet-api require a REAL Supabase session.
  // We must not treat a stale localStorage "user" as authenticated if there is no session,
  // otherwise the app will call functions without an Authorization header and receive 401.
  useEffect(() => {
    let mounted = true;

    const applySession = (session: typeof supabase.auth.getSession extends () => Promise<infer R>
      ? R extends { data: { session: infer S } }
        ? S
        : never
      : never) => {
      if (!mounted) return;

      if (session?.user) {
        const u: User = {
          id: session.user.id,
          name: session.user.user_metadata?.name ?? session.user.email ?? 'User',
          email: session.user.email,
          role: (session.user.user_metadata?.role ?? 'buyer') as User['role'],
        };
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
      } else {
        // No session => definitely not authenticated
        setUser(null);
        localStorage.removeItem('user');
      }

      setIsLoading(false);
    };

    if (useSupabaseOnly) {
      // Subscribe FIRST, then fetch session
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        applySession(session);
      });

      supabase.auth.getSession().then(({ data: { session } }) => {
        applySession(session);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    // Express backend mode (legacy)
    const storedUser = getCurrentUser();
    if (storedUser) setUser(storedUser);
    setIsLoading(false);
    return () => {
      mounted = false;
    };
  }, []);

  const requestOTP = useCallback(async (phone: string, purpose: 'LOGIN' | 'REGISTRATION') => {
    if (useSupabaseOnly) {
      const response = await supabaseRequestOTP(phone, purpose);
      return { success: response.success, error: response.error, otp: response.otp };
    }
    const response = await api.requestOTP(phone, purpose) as { success: boolean; error?: string; otp?: string };
    return { success: response.success, error: response.error, otp: response.otp };
  }, []);

  const login = useCallback(async (phone: string, otp: string) => {
    if (useSupabaseOnly) {
      const response = await loginWithPhone(phone, otp);
      if (response.success && response.data?.user) {
        setUser(response.data.user as User);
        return { success: true };
      }
      return { success: false, error: response.error || 'Login failed' };
    }
    const response = await api.login(phone, otp);
    if (response.success && response.data?.user) {
      setUser(response.data.user as User);
      return { success: true };
    }
    return { success: false, error: response.error || 'Login failed' };
  }, []);

  const loginEmail = useCallback(async (email: string, password: string) => {
    if (useSupabaseOnly) {
      const response = await supabaseLoginWithEmail(email, password);
      if (response.success && response.data?.user) {
        setUser(response.data.user as User);
        return { success: true };
      }
      return { success: false, error: response.error || 'Login failed' };
    }
    // Express backend mode
    try {
      const backendResponse = await api.loginWithEmail(email, password);
      if (backendResponse.success && backendResponse.data?.user) {
        const u: User = {
          id: backendResponse.data.user.id,
          name: backendResponse.data.user.name,
          email: backendResponse.data.user.email,
          role: (backendResponse.data.user.role?.toLowerCase() as User['role']) || 'buyer',
        };
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
        return { success: true };
      }
      return { success: false, error: (backendResponse as any).error || 'Invalid credentials' };
    } catch {
      return { success: false, error: 'Login failed' };
    }
  }, []);

  const adminLogin = useCallback(async (email: string, password: string) => {
    try {
      // Use direct Supabase auth instead of edge function to avoid project mismatch
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return { success: false, error: authError?.message || 'Invalid credentials' };
      }

      const u: User = {
        id: authData.user.id,
        name: authData.user.user_metadata?.name ?? authData.user.email ?? 'Admin',
        email: authData.user.email,
        role: 'admin',
      };

      // Check user_roles table for admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        await supabase.auth.signOut();
        setUser(null);
        return { success: false, error: 'Access denied. Admin credentials required.' };
      }

      setUser(u);
      localStorage.setItem('user', JSON.stringify(u));
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Login failed' };
    }
  }, []);

  const register = useCallback(async (data: { phone: string; name: string; email?: string; role?: string; otp: string }) => {
    if (useSupabaseOnly) {
      const response = await registerWithPhone(data);
      if (response.success && response.data?.user) {
        setUser(response.data.user as User);
        return { success: true };
      }
      return { success: false, error: response.error || 'Registration failed' };
    }
    const response = await api.register(data);
    if (response.success && response.data?.user) {
      setUser(response.data.user as User);
      return { success: true };
    }
    return { success: false, error: response.error || 'Registration failed' };
  }, []);

  const registerEmail = useCallback(async (data: { email: string; password: string; name: string; role?: string; phone?: string }) => {
    if (useSupabaseOnly) {
      const response = await supabaseRegisterWithEmail(data);
      if (response.success && response.data?.user) {
        setUser(response.data.user as User);
        return { success: true };
      }
      return { success: false, error: response.error || 'Registration failed' };
    }
    const response = await api.registerWithEmail(data);
    if (response.success && response.data?.user) {
      setUser(response.data.user as User);
      return { success: true };
    }
    return { success: false, error: response.error || 'Registration failed' };
  }, []);

  const logout = useCallback(async () => {
    // Always clear backend tokens if present
    try { await api.logout(); } catch { /* ignore */ }
    // Also sign out of Supabase if in Supabase mode
    if (useSupabaseOnly) {
      await supabaseLogout();
    }
    setUser(null);
    localStorage.removeItem('user');
  }, []);

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginEmail,
        adminLogin,
        register,
        registerEmail,
        logout,
        requestOTP,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export { SupabaseAuthContext };

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}
