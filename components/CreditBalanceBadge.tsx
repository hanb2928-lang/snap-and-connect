import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Coins, Plus } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getCreditBalance, type CreditBalance } from '@/lib/credits';

interface CreditBalanceBadgeProps {
  onPress?: () => void;
  compact?: boolean;
}

export function CreditBalanceBadge({ onPress, compact = false }: CreditBalanceBadgeProps) {
  const [balance, setBalance] = useState<CreditBalance | null>(null);

  const loadBalance = useCallback(async () => {
    const data = await getCreditBalance();
    setBalance(data);
  }, []);

  useEffect(() => {
    loadBalance();
    const interval = setInterval(loadBalance, 15000);
    return () => clearInterval(interval);
  }, [loadBalance]);

  const isLow = balance !== null && balance.balance <= 3;

  return (
    <TouchableOpacity
      style={[styles.container, compact && styles.containerCompact, isLow && styles.containerLow]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Coins size={compact ? 14 : 16} color={isLow ? theme.colors.error[400] : theme.colors.warning[400]} strokeWidth={2} />
      <Text style={[styles.balance, isLow && styles.balanceLow]}>
        {balance ? balance.balance.toLocaleString() : '...'}
      </Text>
      {!compact && <Text style={styles.unit}>크레딧</Text>}
      <View style={[styles.plusIcon, compact && styles.plusIconCompact]}>
        <Plus size={compact ? 10 : 12} color="#fff" strokeWidth={2.5} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  containerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  containerLow: {
    backgroundColor: theme.colors.error[500] + '15',
  },
  balance: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  balanceLow: {
    color: theme.colors.error[400],
  },
  unit: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  plusIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  plusIconCompact: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
