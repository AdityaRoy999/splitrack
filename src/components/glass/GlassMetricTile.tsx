import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from './GlassCard';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';

interface GlassMetricTileProps {
  label: string;
  sublabel?: string;
  amount: number;
  icon: React.ReactNode;
  iconBgColor?: string;
  onPress?: () => void;
}

export const GlassMetricTile: React.FC<GlassMetricTileProps> = ({
  label,
  sublabel = 'This month',
  amount,
  icon,
  iconBgColor = 'rgba(255, 255, 255, 0.08)',
  onPress,
}) => {
  const { formatAmount, themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.985}
      style={styles.container}
    >
      <GlassCard borderRadius={22} intensity={25} style={styles.card}>
        <View style={styles.contentRow}>
          <View style={styles.leftCol}>
            <View style={[styles.iconWrapper, { backgroundColor: iconBgColor }]}>
              {icon}
            </View>
            <View style={styles.labelWrapper}>
              <Text style={[styles.label, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                {label}
              </Text>
              <Text style={[styles.sublabel, { color: isDark ? '#71717A' : '#6B7280' }]}>
                {sublabel}
              </Text>
            </View>
          </View>
          <View style={styles.rightCol}>
            <Text style={[styles.amount, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              {formatAmount(amount)}
            </Text>
          </View>
        </View>
      </GlassCard>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    width: '100%',
  },
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 0,
  },
  labelWrapper: {
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  sublabel: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
});
