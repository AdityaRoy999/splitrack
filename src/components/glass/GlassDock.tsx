import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
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
import { measureNodeInWindow, type ViewRefNode } from '../../utils/measureWindow';

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
  onPress: () => void;
}> = ({ item, isActive, isDark, onPress }) => {
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
    <TouchableOpacity
      accessibilityRole={item.isAction ? 'button' : 'tab'}
      accessibilityLabel={item.isAction ? 'Add split expense' : item.label}
      accessibilityState={item.isAction ? undefined : { selected: isActive }}
      aria-selected={item.isAction ? undefined : isActive}
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.tabBtn}
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
    </TouchableOpacity>
  );
};

/**
 * Floating pill capsule navbar with real-time zero-delay sliding gestures
 * and authentic iOS Liquid Glass jelly physics (holding expansion, stretch & squish bounce).
 */
export const GlassDock = memo(function GlassDock({
  currentTab,
  onTabChange,
  onQuickAdd,
}: GlassDockProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const useSplitLiquidDock = Platform.OS === 'ios';
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
  const [capsuleScale] = useState(() => new Animated.Value(1));

  const [hoverSlot, setHoverSlot] = useState<number>(activeIndex);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const hoverSlotRef = useRef<number>(activeIndex);
  const rowRef = useRef<ViewRefNode>(null);
  const rowXRef = useRef((windowWidth - maxTotalWidth) / 2 + 6);
  const touchStartRef = useRef({ x: 0, y: 0 });

  // Sync position with currentTab with smooth native spring
  useEffect(() => {
    if (isDraggingRef.current) return;
    hoverSlotRef.current = activeIndex;
    setHoverSlot(activeIndex);
    const targetX = activeIndex * slotWidth;

    Animated.spring(slideX, {
      toValue: targetX,
      stiffness: 480,
      damping: 32,
      mass: 0.55,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [activeIndex, slotWidth, slideX]);

  const handleRowLayout = (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.width;
    if (measured > 0) {
      setRowWidth(measured);
      measureNodeInWindow(rowRef.current, (rect) => { rowXRef.current = rect.x; });
    }
  };

  const getTouchX = (event: GestureResponderEvent) =>
    event.nativeEvent.pageX - rowXRef.current;

  const getSlotFromX = (touchX: number) => {
    if (rowWidth <= 0 || mainNavItems.length === 0) return 0;
    return Math.min(
      Math.max(Math.floor((touchX / rowWidth) * mainNavItems.length), 0),
      mainNavItems.length - 1
    );
  };

  const onTouchGrant = (touchX: number) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    const initialSlot = getSlotFromX(touchX);
    hoverSlotRef.current = initialSlot;
    setHoverSlot(initialSlot);

    // Slide cleanly to slot center
    const targetX = initialSlot * slotWidth;
    Animated.spring(slideX, {
      toValue: targetX,
      stiffness: 500,
      damping: 30,
      mass: 0.5,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    // Subtle press-down scale
    Animated.spring(capsuleScale, {
      toValue: 0.985,
      stiffness: 400,
      damping: 24,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    triggerImpact(ImpactStyle.Light);

  };

  const onTouchMove = (touchX: number) => {
    if (!isDraggingRef.current || rowWidth <= 0) return;

    const newSlot = getSlotFromX(touchX);
    if (newSlot !== hoverSlotRef.current) {
      hoverSlotRef.current = newSlot;
      setHoverSlot(newSlot);
      triggerImpact(ImpactStyle.Light);
      const targetX = newSlot * slotWidth;
      Animated.spring(slideX, {
        toValue: targetX,
        stiffness: 500,
        damping: 30,
        mass: 0.5,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }
  };

  const onTouchRelease = (touchX?: number) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const finalSlot = touchX === undefined ? activeIndex : getSlotFromX(touchX);
    const finalItem = mainNavItems[finalSlot];
    const restingSlot = finalItem?.isAction ? activeIndex : finalSlot;
    hoverSlotRef.current = restingSlot;
    setHoverSlot(restingSlot);

    Animated.parallel([
      Animated.spring(capsuleScale, {
        toValue: 1,
        stiffness: 450,
        damping: 26,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(slideX, {
        toValue: restingSlot * slotWidth,
        stiffness: 500,
        damping: 30,
        mass: 0.5,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    // Open the modal only after the gesture ends, so its backdrop cannot
    // receive the remainder of the opening press. Cancellation never opens it.
    if (touchX !== undefined && finalItem) {
      if (finalItem.isAction) onQuickAdd();
      else onTabChange(finalItem.key);
    }
  };

  const handleSplitAction = () => {
    triggerImpact(ImpactStyle.Light);
    onQuickAdd();
  };

  const bottomOffset = Math.max(16, insets.bottom - 8);
  const activePillBg = isLiquidGlassEnabled
    ? isDark
      ? 'rgba(255, 255, 255, 0.18)'
      : 'rgba(15, 23, 42, 0.08)'
    : isDark
      ? '#23232A'
      : '#EFEFF5';

  return (
    <View style={[styles.outerContainer, { bottom: bottomOffset }]} pointerEvents="box-none">
      <NativeGlassContainer spacing={10} style={styles.dockGroup}>
        <Animated.View style={{ transform: [{ scale: capsuleScale }] }}>
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
              ref={rowRef}
              collapsable={false}
              style={styles.navRow}
              onLayout={handleRowLayout}
              onStartShouldSetResponderCapture={(e) => {
                touchStartRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                return false;
              }}
              onMoveShouldSetResponderCapture={(e) => {
                const dx = Math.abs(e.nativeEvent.pageX - touchStartRef.current.x);
                const dy = Math.abs(e.nativeEvent.pageY - touchStartRef.current.y);
                return dx > 8 && dx > dy;
              }}
              onResponderGrant={(e) => onTouchGrant(getTouchX(e))}
              onResponderMove={(e) => onTouchMove(getTouchX(e))}
              onResponderRelease={(e) => onTouchRelease(getTouchX(e))}
              onResponderTerminate={() => onTouchRelease()}
            >
              {/* Sliding active section pill indicator */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.activeSliderPill,
                  {
                    width: slotWidth,
                    backgroundColor: activePillBg,
                    transform: [{ translateX: slideX }],
                  },
                ]}
              />

              {mainNavItems.map((item, idx) => (
                <DockTabButton
                  key={item.key}
                  item={item}
                  isActive={isDragging ? hoverSlot === idx : currentTab === item.key}
                  isDark={isDark}
                  onPress={() => {
                    triggerImpact(ImpactStyle.Light);
                    if (item.isAction) onQuickAdd();
                    else onTabChange(item.key);
                  }}
                />
              ))}
            </View>
          </GlassSurface>
        </Animated.View>

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
});

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
