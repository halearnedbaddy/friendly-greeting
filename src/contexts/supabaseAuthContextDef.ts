import { createContext } from 'react';

interface User {
  id: string;
  phone?: string;
  name: string;
  email?: string;
  role: 'buyer' | 'seller' | 'admin';
}

export interface SupabaseAuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  loginEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { phone: string; name: string; email?: string; role?: string; otp: string }) => Promise<{ success: boolean; error?: string }>;
  registerEmail: (data: { email: string; password: string; name: string; role?: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestOTP: (phone: string, purpose: 'LOGIN' | 'REGISTRATION') => Promise<{ success: boolean; error?: string; otp?: string }>;
}

export type { User as SupabaseAuthUser };

export const SupabaseAuthContext = createContext<SupabaseAuthContextType | null>(null);
