import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { triggerSelection } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassSurface } from './GlassSurface';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface SpotlightCardProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
  spotlightColor?: string;
  onPress?: () => void;
  coverImageUri?: string;
  highlightableCover?: boolean;
  onCoverToggle?: (highlighted: boolean) => void;
  style?: StyleProp<ViewStyle>;
  panelStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

/**
 * Clean borderless double-layer surface card with subtle tonal or Liquid Glass separation,
 * full-bleed faded backdrop cover photo that highlights on tap while fading inner details,
 * and zero outer glow or borders.
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  footer,
  onPress,
  coverImageUri,
  highlightableCover = false,
  onCoverToggle,
  style,
  panelStyle,
  borderRadius = 24,
}) => {
  const { themeMode, isLiquidGlassEnabled } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [isHighlighted, setIsHighlighted] = useState(false);
  const [highlightAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(highlightAnim, {
      toValue: isHighlighted ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [isHighlighted, highlightAnim]);

  const outerBg = isDark ? '#111114' : '#FFFFFF';
  const innerBg = isDark ? '#17171C' : '#F4F5F8';

  const canToggleCover = Boolean(coverImageUri && highlightableCover);

  const handleToggleHighlight = () => {
    if (!canToggleCover) return;
    triggerSelection();
    setIsHighlighted((prev) => {
      const next = !prev;
      onCoverToggle?.(next);
      return next;
    });
  };

  const scrimOpacity = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? 0.64 : 0.68, 0],
  });

  const detailsOpacity = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const photoScale = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const innerRadius = Math.max(14, borderRadius - 6);

  // Extract justifyContent / minHeight from panelStyle without adding padding onto the
  // positioned backdrop container (percentage sizes + padding on iOS Yoga shrink backdrop images).
  const flattenedPanel = useMemo(() => StyleSheet.flatten(panelStyle) || {}, [panelStyle]);
  const {
    padding: _p,
    paddingHorizontal: _ph,
    paddingVertical: _pv,
    paddingTop: _pt,
    paddingBottom: _pb,
    paddingLeft: _pl,
    paddingRight: _pr,
    justifyContent,
    ...panelBoxRest
  } = flattenedPanel;

  const innerPanelContent = (
    <View
      style={[
        styles.innerPanel,
        {
          backgroundColor: isLiquidGlassEnabled
            ? isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(15, 23, 42, 0.04)'
            : innerBg,
          borderRadius: innerRadius,
        },
        panelBoxRest,
      ]}
    >
      {coverImageUri ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: innerRadius, overflow: 'hidden' }]}>
          <Animated.Image
            source={{ uri: coverImageUri }}
            resizeMode="cover"
            style={[
              StyleSheet.absoluteFill,
              styles.backdropImage,
              { transform: [{ scale: photoScale }] },
            ]}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? '#111114' : '#F4F5F8',
                opacity: scrimOpacity,
              },
            ]}
          />
        </View>
      ) : null}

      <Animated.View
        pointerEvents={isHighlighted ? 'none' : 'box-none'}
        style={[
          styles.panelContent,
          justifyContent ? { justifyContent } : null,
          { opacity: detailsOpacity },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );

  const wrappedInnerPanel = canToggleCover ? (
    <Pressable
      onPress={handleToggleHighlight}
      accessibilityRole="button"
      accessibilityLabel={isHighlighted ? 'Restore trip card details' : 'Highlight trip cover photo'}
      style={[styles.innerPressWrap, { borderRadius: innerRadius }]}
    >
      {innerPanelContent}
    </Pressable>
  ) : (
    innerPanelContent
  );

  const wrappedFooter =
    footer && onPress && canToggleCover ? (
      <AnimatedPressable scaleTo={0.98} onPress={onPress} contentStyle={styles.footerSlot}>
        {footer}
      </AnimatedPressable>
    ) : footer ? (
      <View style={styles.footerSlot}>{footer}</View>
    ) : null;

  const cardInner = (
    <GlassSurface
      borderRadius={borderRadius}
      glassStyle="regular"
      matteColor={outerBg}
      style={[styles.outerCard, style]}
    >
      {wrappedInnerPanel}
      {wrappedFooter}
    </GlassSurface>
  );

  if (onPress && !canToggleCover) {
    return (
      <AnimatedPressable scaleTo={0.985} onPress={onPress} style={styles.pressWrapper}>
        {cardInner}
      </AnimatedPressable>
    );
  }

  return <View style={styles.pressWrapper}>{cardInner}</View>;
};

const styles = StyleSheet.create({
  pressWrapper: {
    width: '100%',
  },
  outerCard: {
    width: '100%',
    padding: 12,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  innerPressWrap: {
    width: '100%',
    overflow: 'hidden',
  },
  innerPanel: {
    width: '100%',
    padding: 0,
    borderWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  backdropImage: {
    borderWidth: 0,
  },
  panelContent: {
    flexGrow: 1,
    padding: 16,
    position: 'relative',
    zIndex: 2,
    justifyContent: 'space-between',
  },
  footerSlot: {
    paddingTop: 12,
    paddingHorizontal: 6,
    paddingBottom: 2,
  },
});

export default SpotlightCard;
