import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { renderSolarIcon } from '../../constants/solarIconsCatalog';
import { Transaction } from '../../types';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassCard } from '../glass/GlassCard';

interface RecentTransactionsProps {
  onSelectTransaction?: (tx: Transaction) => void;
  onViewAll?: () => void;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  onSelectTransaction,
  onViewAll,
}) => {
  const { transactions, categories } = useSplitTrack();
  const { formatAmount, themeMode, palette } = useLiquidGlass();

  const isDarkSheet = themeMode === 'dark';

  const resolveTxIcon = (tx: Transaction) => {
    if (tx.type === 'income') return 'dollar-minimalistic';
    if (tx.type === 'settlement') return 'check-circle';
    const match = categories.find((c) => c.name.toLowerCase() === tx.category.toLowerCase());
    return match?.iconKey || tx.categoryIcon;
  };

  return (
    <View style={styles.outerWrap}>
      <GlassCard borderRadius={24} style={styles.sheetContainer}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: palette.sheetTextPrimary }]}>
            Recent Transactions
          </Text>
          <AnimatedPressable onPress={onViewAll} scaleTo={0.94} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.viewAllText, { color: isDarkSheet ? '#71717A' : '#64748B' }]}>
              View All
            </Text>
          </AnimatedPressable>
        </View>

        {/* List */}
        <View style={styles.list}>
          {transactions.slice(0, 5).map((tx, index, visibleList) => {
            const isIncome = tx.type === 'income' || (tx.type === 'settlement' && tx.amount > 0);
            const showDivider = index < visibleList.length - 1;

            const iconColor = isIncome ? '#10B981' : isDarkSheet ? '#F87171' : '#E11D48';
            const iconBoxStyle = isDarkSheet
              ? (isIncome ? styles.iconBoxIncomeDark : styles.iconBoxExpenseDark)
              : (isIncome ? styles.iconBoxIncomeLight : styles.iconBoxExpenseLight);

            return (
              <React.Fragment key={tx.id}>
                <AnimatedPressable
                  scaleTo={0.985}
                  onPress={() => onSelectTransaction && onSelectTransaction(tx)}
                  contentStyle={styles.txRow}
                >
                  <View style={styles.leftCol}>
                    <View style={[styles.iconBox, iconBoxStyle]}>
                      {renderSolarIcon(resolveTxIcon(tx), 18, iconColor)}
                    </View>
                    <View style={styles.infoCol}>
                      <Text style={[styles.txTitle, { color: palette.sheetTextPrimary }]} numberOfLines={1}>
                        {tx.title}
                      </Text>
                      <Text style={[styles.txSubtitle, { color: palette.sheetTextSecondary }]} numberOfLines={1}>
                        {[tx.subtitle || tx.time, tx.location].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rightCol}>
                    <Text
                      style={[
                        styles.txAmount,
                        isIncome ? styles.amountIncome : { color: palette.sheetTextPrimary },
                      ]}
                    >
                      {formatAmount(tx.amount, true)}
                    </Text>
                    {tx.splits && tx.splits.length > 0 && (
                      <Text
                        style={[
                          styles.splitIndicator,
                          { color: isDarkSheet ? '#71717A' : '#64748B' },
                        ]}
                      >
                        Split ({tx.splits.length})
                      </Text>
                    )}
                  </View>
                </AnimatedPressable>

                {showDivider && (
                  <View
                    style={[
                      styles.rowDivider,
                      {
                        backgroundColor: isDarkSheet
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(15, 23, 42, 0.07)',
                      },
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrap: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 10,
  },
  sheetContainer: {
    padding: 18,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '400',
  },
  list: {
    gap: 2,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  rowDivider: {
    height: 1,
    marginLeft: 58,
    marginVertical: 1,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 0,
  },
  iconBoxExpenseLight: {
    backgroundColor: '#FFF1F2',
  },
  iconBoxIncomeLight: {
    backgroundColor: '#ECFDF5',
  },
  iconBoxExpenseDark: {
    backgroundColor: '#1C1417',
    borderWidth: 0,
  },
  iconBoxIncomeDark: {
    backgroundColor: '#102018',
    borderWidth: 0,
  },
  infoCol: {
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  txSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  amountIncome: {
    color: '#10B981',
  },
  splitIndicator: {
    fontSize: 11,
    marginTop: 2,
  },
});
