/**
 * Wallet Hook
 * Manages wallet state and operations using Supabase
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCloudAuth } from '@/contexts/CloudAuthContext';

interface Wallet {
  id: string;
  user_id: string;
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_spent: number;
}

interface WalletTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  reference: string;
  status: string;
  payment_method: string;
  created_at: string;
}

export function useWallet() {
  const { user, session } = useCloudAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch wallet data
  const fetchWallet = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setWallet(data as Wallet);
      } else {
        // Create wallet if it doesn't exist
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            available_balance: 0,
            pending_balance: 0,
            total_earned: 0,
            total_spent: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        setWallet(newWallet as Wallet);
      }
    } catch (err) {
      console.error('Error fetching wallet:', err);
      setError('Failed to load wallet');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Fetch transaction history
  const fetchTransactions = useCallback(async (limit = 20) => {
    if (!user?.id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      setTransactions((data as WalletTransaction[]) || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [user?.id]);

  // Initialize Paystack top-up
  const initializeTopup = useCallback(async (amount: number, email?: string) => {
    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('paystack-api/wallet-topup/initialize', {
        body: { amount, email },
      });

      if (error) throw error;
      
      if (data?.success) {
        return { success: true, data: data.data };
      }
      
      return { success: false, error: data?.error || 'Failed to initialize top-up' };
    } catch (err) {
      console.error('Top-up init error:', err);
      return { success: false, error: 'Failed to initialize top-up' };
    }
  }, [session?.access_token]);

  // Verify top-up and update balance
  const verifyTopup = useCallback(async (reference: string) => {
    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('paystack-api/wallet-topup/verify', {
        body: { reference },
      });

      if (error) throw error;
      
      if (data?.success) {
        // Update local wallet state immediately
        setWallet(prev => prev ? {
          ...prev,
          available_balance: data.data.new_balance,
        } : null);

        // Refresh transactions
        await fetchTransactions();

        return { success: true, data: data.data };
      }
      
      return { success: false, error: data?.error || 'Failed to verify top-up' };
    } catch (err) {
      console.error('Top-up verify error:', err);
      return { success: false, error: 'Failed to verify top-up' };
    }
  }, [session?.access_token, fetchTransactions]);

  // Load wallet on mount
  useEffect(() => {
    if (user?.id) {
      fetchWallet();
      fetchTransactions();
    }
  }, [user?.id, fetchWallet, fetchTransactions]);

  return {
    wallet,
    transactions,
    isLoading,
    error,
    fetchWallet,
    fetchTransactions,
    initializeTopup,
    verifyTopup,
    balance: wallet?.available_balance || 0,
    pendingBalance: wallet?.pending_balance || 0,
  };
}
