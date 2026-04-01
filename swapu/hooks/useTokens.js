// hooks/useTokens.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

export function useTokens() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_tokens')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      setBalance(data?.balance || 0);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const spendTokens = async (amount, type, relatedLikeId = null) => {
    if (!user) return { success: false, error: 'Not logged in' };
    
    try {
      // Check current balance first
      const { data: current, error: fetchError } = await supabase
        .from('user_tokens')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      if ((current?.balance || 0) < amount) {
        return { success: false, error: 'Insufficient tokens' };
      }
      
      // Deduct tokens
      const { error: updateError } = await supabase
        .from('user_tokens')
        .update({ 
          balance: current.balance - amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
      
      if (updateError) throw updateError;
      
      // Record transaction
      const { error: transError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: user.id,
          amount: -amount,
          type,
          related_like_id: relatedLikeId
        });
      
      if (transError) throw transError;
      
      // Update local state
      setBalance(prev => prev - amount);
      
      return { success: true };
    } catch (error) {
      console.error('Error spending tokens:', error);
      return { success: false, error: error.message };
    }
  };

  const addTokens = async (amount, type = 'purchase') => {
    if (!user) return;
    
    try {
      const { data: current } = await supabase
        .from('user_tokens')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      const newBalance = (current?.balance || 0) + amount;
      
      await supabase
        .from('user_tokens')
        .update({ balance: newBalance })
        .eq('user_id', user.id);
      
      await supabase
        .from('token_transactions')
        .insert({
          user_id: user.id,
          amount,
          type
        });
      
      setBalance(newBalance);
    } catch (error) {
      console.error('Error adding tokens:', error);
    }
  };

  useEffect(() => {
    fetchBalance();
    
    // Subscribe to changes
    const subscription = supabase
      .channel(`user_tokens:${user?.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_tokens', filter: `user_id=eq.${user?.id}` },
        fetchBalance
      )
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, [user, fetchBalance]);

  return {
    balance,
    loading,
    refresh: fetchBalance,
    spendTokens,
    addTokens
  };
}
