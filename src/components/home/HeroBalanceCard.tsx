import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View, Text, StyleSheet } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Aurora } from '../effects/Aurora';
import { EyeIcon } from '@solar-icons/react-native/bold/eye';
import { EyeClosedIcon } from '@solar-icons/react-native/bold/eye-closed';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { CheckCircleIcon } from '@solar-icons/react-native/bold/check-circle';
import { UsersGroupRoundedIcon } from '@solar-icons/react-native/bold/users-group-rounded';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';
import { useSplitTrack } from '../../store/SplitTrackStore';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { currencies } from '../../theme/colors';
import { GlassPill } from '../glass/GlassPill';
import { GlassSurface } from '../glass/GlassSurface';
import { AnimatedPressable } from '../common/MotionPrimitives';

interface HeroBalanceCardProps {
  onAddExpense?: () => void;
  onSettle?: () => void;
  onOpenTrips?: () => void;
}

export const HeroBalanceCard: React.FC<HeroBalanceCardProps> = ({
  onAddExpense,
  onSettle,
  onOpenTrips,
}) => {
  const { totalBalance, monthlyExpenses, netFriendBalance } = useSplitTrack();
  const {
    formatAmount,
    hideAmounts,
    toggleHideAmounts,
    themeMode,
    currency,
    setCurrency,
    isLiquidGlassEnabled,
  } = useLiquidGlass();

  const isDark = themeMode === 'dark';
  const [hideAnim] = useState(() => new Animated.Value(hideAmounts ? 1 : 0));

  useEffect(() => {
    Animated.timing(hideAnim, {
      toValue: hideAmounts ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [hideAmounts, hideAnim]);

  const currConfig = currencies[currency] || currencies.INR;
  const convertedBalance = totalBalance * (currency === 'INR' ? 1 : currConfig.exchangeRate);
  const absBalance = Math.abs(convertedBalance);
  const unmaskedBalance = `${totalBalance < 0 ? '-' : ''}${currConfig.symbol}${absBalance.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const balanceTranslateY = hideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -32],
  });
  const balanceOpacity = hideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const dotsTranslateY = hideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [32, 0],
  });
  const dotsOpacity = hideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleToggleHide = () => {
    triggerImpact(ImpactStyle.Light);
    toggleHideAmounts();
  };

  const cycleCurrency = () => {
    triggerImpact(ImpactStyle.Light);
    const order: ('INR' | 'USD' | 'EUR' | 'GBP')[] = ['INR', 'USD', 'EUR', 'GBP'];
    const nextIdx = (order.indexOf(currency) + 1) % order.length;
    setCurrency(order[nextIdx]);
  };

  return (
    <View style={styles.container}>
      <GlassSurface
        borderRadius={24}
        glassStyle="regular"
        matteColor={isDark ? '#111114' : '#FFFFFF'}
        style={styles.heroCard}
      >
        {/* Permanent grounding baseline gradient: always stays flush with the bottom edge */}
        <ExpoLinearGradient
          colors={
            isDark
              ? ['transparent', 'rgba(82, 39, 255, 0.24)', 'rgba(124, 255, 103, 0.44)']
              : ['transparent', 'rgba(56, 189, 248, 0.28)', 'rgba(52, 211, 153, 0.5)']
          }
          start={{ x: 0, y: 0.12 }}
          end={{ x: 0.85, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
        />

        {/* Anchored bottom strip guaranteeing the lower part never moves away from the bottom line */}
        <ExpoLinearGradient
          colors={
            isDark
              ? ['transparent', 'rgba(82, 39, 255, 0.32)', 'rgba(124, 255, 103, 0.48)']
              : ['transparent', 'rgba(56, 189, 248, 0.38)', 'rgba(52, 211, 153, 0.54)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bottomAnchorGradient}
        />

        <Aurora
          colorStops={['#5227FF', '#7cff67', '#5227FF']}
          amplitude={0.95}
          blend={0.62}
          height={0.88}
          speed={0.85}
          glow={0.7}
          layers={2}
          direction="bottom"
          opacity={isDark ? 0.88 : 0.76}
          lightMode={!isDark}
          style={{ borderRadius: 24 }}
        />
        {/* Foreground Card Content */}
        <View style={styles.cardContent}>
          {/* Top Header: Net Balance + Eye Toggle */}
          <View style={styles.topRow}>
            <View style={styles.balanceHeaderGroup}>
              <Text style={[styles.balanceLabel, { color: isDark ? 'rgba(255,255,255,0.86)' : '#18181B' }]}>
                Net Balance
              </Text>
              <AnimatedPressable
                onPress={handleToggleHide}
                scaleTo={0.88}
                accessibilityLabel="Toggle amount privacy"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                contentStyle={styles.eyeBtn}
              >
                {hideAmounts ? (
                  <EyeClosedIcon size={16} color={isDark ? 'rgba(255,255,255,0.72)' : '#3F3F46'} />
                ) : (
                  <EyeIcon size={16} color={isDark ? 'rgba(255,255,255,0.72)' : '#3F3F46'} />
                )}
              </AnimatedPressable>
            </View>

            {/* Currency Pill */}
            <AnimatedPressable
              onPress={cycleCurrency}
              scaleTo={0.94}
              contentStyle={[
                styles.currencyPill,
                {
                  backgroundColor: isLiquidGlassEnabled
                    ? isDark
                      ? 'rgba(255, 255, 255, 0.16)'
                      : 'rgba(255, 255, 255, 0.56)'
                    : isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(24, 24, 27, 0.06)',
                },
              ]}
            >
              <Text style={[styles.currencyPillText, { color: isDark ? '#FFFFFF' : '#18181B' }]}>
                {currency} ▾
              </Text>
            </AnimatedPressable>
          </View>

          {/* Animated Balance Amount (slides up into dots when hidden) */}
          <View style={styles.amountContainer}>
            <Animated.View
              pointerEvents={hideAmounts ? 'none' : 'auto'}
              style={[
                styles.amountLayer,
                {
                  opacity: balanceOpacity,
                  transform: [{ translateY: balanceTranslateY }],
                },
              ]}
            >
              <Text style={[styles.amountText, { color: isDark ? '#FFFFFF' : '#09090B' }]}>
                {unmaskedBalance}
              </Text>
            </Animated.View>

            <Animated.View
              pointerEvents={hideAmounts ? 'auto' : 'none'}
              style={[
                styles.amountLayer,
                {
                  opacity: dotsOpacity,
                  transform: [{ translateY: dotsTranslateY }],
                },
              ]}
            >
              <Text style={[styles.amountText, styles.dotsText, { color: isDark ? '#FFFFFF' : '#09090B' }]}>
                ••••••
              </Text>
            </Animated.View>
          </View>

          {/* Monthly Expense Tracker Summary Strip */}
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryBadge,
                {
                  backgroundColor: isLiquidGlassEnabled
                    ? isDark
                      ? 'rgba(12, 14, 20, 0.56)'
                      : 'rgba(255, 255, 255, 0.78)'
                    : isDark
                      ? 'rgba(12, 14, 20, 0.52)'
                      : 'rgba(255, 255, 255, 0.72)',
                },
              ]}
            >
              <Text style={[styles.summaryText, { color: isDark ? '#F4F4F5' : '#18181B' }]}>
                Spent {formatAmount(monthlyExpenses)} this month
              </Text>
            </View>

            <View
              style={[
                styles.summaryBadge,
                {
                  backgroundColor: isLiquidGlassEnabled
                    ? isDark
                      ? 'rgba(12, 14, 20, 0.56)'
                      : 'rgba(255, 255, 255, 0.78)'
                    : isDark
                      ? 'rgba(12, 14, 20, 0.52)'
                      : 'rgba(255, 255, 255, 0.72)',
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryText,
                  {
                    color:
                      netFriendBalance === 0
                        ? isDark
                          ? '#D4D4D8'
                          : '#52525B'
                        : netFriendBalance > 0
                          ? isDark
                            ? '#34D399'
                            : '#059669'
                          : '#EF4444',
                  },
                ]}
              >
                {netFriendBalance >= 0 ? 'Owed ' : 'You owe '}
                {formatAmount(Math.abs(netFriendBalance))}
              </Text>
            </View>
          </View>

          {/* Expense Tracker Action Pills */}
          <View style={styles.actionRow}>
            <GlassPill
              label="Expense"
              icon={<AddCircleIcon size={16} color={isDark ? '#000000' : '#FFFFFF'} />}
              onPress={onAddExpense || (() => {})}
              variant="accent"
              size="md"
              style={styles.actionPill}
            />
            <GlassPill
              label="Settle"
              icon={<CheckCircleIcon size={16} color={isDark ? '#FFFFFF' : '#18181B'} />}
              onPress={onSettle || (() => {})}
              variant="dark"
              size="md"
              style={styles.actionPill}
            />
            <GlassPill
              label="Trips"
              icon={<UsersGroupRoundedIcon size={16} color={isDark ? '#FFFFFF' : '#18181B'} />}
              onPress={onOpenTrips || (() => {})}
              variant="dark"
              size="md"
              style={styles.actionPill}
            />
          </View>
        </View>
      </GlassSurface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
  },
  heroCard: {
    width: '100%',
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  bottomAnchorGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  cardContent: {
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 18,
    position: 'relative',
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  eyeBtn: {
    padding: 4,
  },
  currencyPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 0,
  },
  currencyPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  amountContainer: {
    marginTop: 10,
    marginBottom: 8,
    height: 44,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  amountLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
  },
  amountText: {
    fontSize: 34,
    fontWeight: '500',
    letterSpacing: -0.8,
  },
  dotsText: {
    letterSpacing: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  summaryBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 0,
  },
  summaryText: {
    fontSize: 11,
    fontWeight: '400',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  actionPill: {
    flex: 1,
  },
});
