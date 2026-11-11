import React, { useEffect, useState } from 'react';
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
 * Clean borderless double-layer surface card with subtle matte tonal separation,
 * optional full-bleed faded backdrop cover photo that highlights on tap while
 * fading inner details, and zero outer glow or borders.
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
  const { themeMode } = useLiquidGlass();
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
    outputRange: [isDark ? 0.72 : 0.78, 0],
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

  const innerPanelContent = (
    <View
      style={[
        styles.innerPanel,
        {
          backgroundColor: innerBg,
          borderRadius: innerRadius,
        },
        panelStyle,
      ]}
    >
      {coverImageUri ? (
        <>
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
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? '#111114' : '#F4F5F8',
                opacity: scrimOpacity,
              },
            ]}
          />
        </>
      ) : null}

      <Animated.View
        pointerEvents={isHighlighted ? 'none' : 'box-none'}
        style={[styles.panelContent, { opacity: detailsOpacity }]}
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
      style={{ borderRadius: innerRadius, overflow: 'hidden' }}
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
    <View
      style={[
        styles.outerCard,
        {
          backgroundColor: outerBg,
          borderRadius,
        },
        style,
      ]}
    >
      {wrappedInnerPanel}
      {wrappedFooter}
    </View>
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
  innerPanel: {
    width: '100%',
    padding: 16,
    borderWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  backdropImage: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
  panelContent: {
    position: 'relative',
    zIndex: 2,
  },
  footerSlot: {
    paddingTop: 12,
    paddingHorizontal: 6,
    paddingBottom: 2,
  },
});

export default SpotlightCard;
