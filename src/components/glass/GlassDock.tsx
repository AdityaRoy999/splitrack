import React, { useEffect, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home2Icon } from '@solar-icons/react-native/bold/home-2';
import { BillListIcon } from '@solar-icons/react-native/bold/bill-list';
import { AddCircleIcon } from '@solar-icons/react-native/bold/add-circle';
import { UsersGroupTwoRoundedIcon } from '@solar-icons/react-native/bold/users-group-two-rounded';
import { PieChart2Icon } from '@solar-icons/react-native/bold/pie-chart-2';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { GlassSurface } from './GlassSurface';
import { NativeGlassContainer } from '../common/AppleNativeControls';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export type TabKey = 'home' | 'expenses' | 'split' | 'trips' | 'analytics';

interface GlassDockProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onQuickAdd: () => void;
}

interface NavItemConfig {
  key: TabKey;
  label: string;
  icon: (color: string) => React.ReactNode;
  isAction?: boolean;
}

const DockTabButton: React.FC<{
  item: NavItemConfig;
  isActive: boolean;
  isDark: boolean;
}> = ({ item, isActive, isDark }) => {
  const contentColor = item.isAction
    ? isDark
      ? '#FFFFFF'
      : '#111114'
    : isActive
      ? isDark
        ? '#FFFFFF'
        : '#09090B'
      : isDark
        ? '#A1A1AA'
        : '#64748B';

  return (
    <View
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={styles.tabBtn}
      pointerEvents="none"
    >
      <View style={styles.tabInner}>
        {item.icon(contentColor)}
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color: contentColor,
              fontWeight: isActive ? '600' : '400',
            },
          ]}
        >
          {item.label}
        </Text>
      </View>
    </View>
  );
};

/**
 * Floating pill capsule navbar with animated sliding active pill across sections.
 * Supports true iOS 26 Liquid Glass / BlurView translucency when Liquid Glass is active.
 */
export const GlassDock: React.FC<GlassDockProps> = ({
  currentTab,
  onTabChange,
  onQuickAdd,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const useSplitLiquidDock = Platform.OS === 'ios' && isLiquidGlassEnabled;
  const maxTotalWidth = Math.min(windowWidth - 28, 396);
  const capsuleWidth = useSplitLiquidDock ? maxTotalWidth - 74 : maxTotalWidth;
  const [rowWidth, setRowWidth] = useState(capsuleWidth - 12);

  const navItems: NavItemConfig[] = [
    {
      key: 'home',
      label: 'Home',
      icon: (color) => <Home2Icon size={19} color={color} />,
    },
    {
      key: 'expenses',
      label: 'Expenses',
      icon: (color) => <BillListIcon size={19} color={color} />,
    },
    {
      key: 'split',
      label: 'Split',
      isAction: true,
      icon: (color) => <AddCircleIcon size={21} color={color} />,
    },
    {
      key: 'trips',
      label: 'Trips',
      icon: (color) => <UsersGroupTwoRoundedIcon size={19} color={color} />,
    },
    {
      key: 'analytics',
      label: 'Analytics',
      icon: (color) => <PieChart2Icon size={19} color={color} />,
    },
  ];

  const mainNavItems = useSplitLiquidDock
    ? navItems.filter((item) => !item.isAction)
    : navItems;
  const splitActionItem = navItems.find((item) => item.isAction);

  const activeIndexRaw = mainNavItems.findIndex((item) => item.key === currentTab);
  const activeIndex = activeIndexRaw >= 0 ? activeIndexRaw : 0;
  const slotWidth = rowWidth / mainNavItems.length;

  const [slideX] = useState(() => new Animated.Value(activeIndex * slotWidth));
  const [stretchX] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const targetX = activeIndex * slotWidth;
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: targetX,
        stiffness: 380,
        damping: 26,
        mass: 0.9,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.sequence([
        Animated.timing(stretchX, {
          toValue: 1.09,
          duration: 110,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(stretchX, {
          toValue: 1,
          stiffness: 420,
          damping: 22,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();
  }, [activeIndex, slotWidth, slideX, stretchX]);

  const handleRowLayout = (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.width;
    if (measured > 0) {
      setRowWidth(measured);
    }
  };

  const handleTouch = (touchX: number) => {
    if (rowWidth <= 0 || mainNavItems.length === 0) return;
    const slot = Math.min(
      Math.max(Math.floor((touchX / rowWidth) * mainNavItems.length), 0),
      mainNavItems.length - 1
    );
    if (slot !== activeIndex) {
      triggerImpact(ImpactStyle.Light);
      const item = mainNavItems[slot];
      if (item) {
        if (item.isAction) onQuickAdd();
        else onTabChange(item.key);
      }
    }
  };

  const handleSplitAction = () => {
    triggerImpact(ImpactStyle.Light);
    onQuickAdd();
  };

  const bottomOffset = Math.max(16, insets.bottom - 8);
  const activePillBg = isLiquidGlassEnabled
    ? isDark
      ? 'rgba(255, 255, 255, 0.16)'
      : 'rgba(15, 23, 42, 0.08)'
    : isDark
      ? '#23232A'
      : '#EFEFF5';

  return (
    <View style={[styles.outerContainer, { bottom: bottomOffset }]} pointerEvents="box-none">
      <NativeGlassContainer spacing={10} style={styles.dockGroup}>
        <GlassSurface
          borderRadius={999}
          glassStyle="regular"
          interactive
          intensity={isDark ? 65 : 85}
          tintColor={isDark ? 'rgba(22, 22, 28, 0.65)' : 'rgba(255, 255, 255, 0.72)'}
          matteColor={isDark ? '#141418' : '#FFFFFF'}
          style={[styles.navbarCapsule, { width: capsuleWidth }]}
        >
          <View
            style={styles.navRow}
            onLayout={handleRowLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleTouch(e.nativeEvent.locationX)}
            onResponderMove={(e) => handleTouch(e.nativeEvent.locationX)}
            onResponderRelease={(e) => handleTouch(e.nativeEvent.locationX)}
          >
            {/* Sliding active section pill indicator */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeSliderPill,
                {
                  width: slotWidth,
                  backgroundColor: activePillBg,
                  transform: [{ translateX: slideX }, { scaleX: stretchX }],
                },
              ]}
            />

            {mainNavItems.map((item) => (
              <DockTabButton
                key={item.key}
                item={item}
                isActive={currentTab === item.key}
                isDark={isDark}
              />
            ))}
          </View>
        </GlassSurface>

        {useSplitLiquidDock && splitActionItem && (
          <GlassSurface
            borderRadius={32}
            glassStyle="regular"
            interactive
            intensity={isDark ? 65 : 85}
            tintColor={isDark ? 'rgba(22, 22, 28, 0.65)' : 'rgba(255, 255, 255, 0.72)'}
            matteColor={isDark ? '#141418' : '#FFFFFF'}
            style={styles.splitOrb}
          >
            <TouchableOpacity
              onPress={handleSplitAction}
              activeOpacity={0.8}
              accessibilityLabel="Add split expense"
              style={styles.splitOrbTouch}
            >
              <AddCircleIcon size={24} color={isDark ? '#FFFFFF' : '#09090B'} />
            </TouchableOpacity>
          </GlassSurface>
        )}
      </NativeGlassContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  dockGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  splitOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  splitOrbTouch: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarCapsule: {
    height: 64,
    borderRadius: 999,
    justifyContent: 'center',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingHorizontal: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    height: 52,
  },
  activeSliderPill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    zIndex: 2,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: -0.1,
  },
});
