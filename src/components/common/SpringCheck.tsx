import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { triggerSelection } from '../../utils/haptics';

export type StrikeSide = 'left' | 'center' | 'right' | 'none';

export interface SpringCheckProps {
  label?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  color?: string;
  fillColor?: string;
  checkColor?: string;
  boxSize?: number;
  boxRadius?: number;
  fontSize?: number;
  bounce?: number;
  strikeLag?: number;
  doneOpacity?: number;
  strike?: StrikeSide;
  ariaLabel?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  trailing?: React.ReactNode;
}

const TICK_PATH_D = 'M5 14.5C5 14.5 6.5 14.5 8.5 18C8.5 18 14.0588 8.83333 19 7';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export const SpringCheck: React.FC<SpringCheckProps> = ({
  label = 'Ship the build',
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  color = '#ffffff',
  fillColor = '#ffffff',
  checkColor = '#0b0b0f',
  boxSize = 24,
  boxRadius = 999,
  fontSize = 15,
  bounce = 0.2,
  strikeLag = 0.12,
  doneOpacity = 0.42,
  strike = 'left',
  ariaLabel,
  style,
  trailing,
}) => {
  const controlled = checked !== undefined;
  const [inner, setInner] = useState(defaultChecked);
  const on = controlled ? !!checked : inner;

  const [progress] = useState(() => new Animated.Value(on ? 1 : 0));
  const [boxSwell] = useState(() => new Animated.Value(1));
  const [labelWidth, setLabelWidth] = useState(0);

  useEffect(() => {
    const bounciness = Math.max(0, Math.min(1, bounce)) * 18;
    Animated.parallel([
      Animated.spring(progress, {
        toValue: on ? 1 : 0,
        bounciness: on ? bounciness : 0,
        speed: on ? 16 : 22,
        useNativeDriver: false,
      }),
      on
        ? Animated.sequence([
            Animated.timing(boxSwell, {
              toValue: 1 + 0.22 * Math.max(0.25, bounce),
              duration: 95,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.spring(boxSwell, {
              toValue: 1,
              bounciness,
              speed: 18,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ])
        : Animated.timing(boxSwell, {
            toValue: 1,
            duration: 140,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
    ]).start();
  }, [on, bounce, progress, boxSwell]);

  const handleToggle = () => {
    if (disabled) return;
    const next = !on;
    triggerSelection();
    if (!controlled) {
      setInner(next);
    }
    onChange?.(next);
  };

  const handleLabelLayout = (e: LayoutChangeEvent) => {
    setLabelWidth(e.nativeEvent.layout.width);
  };

  const fillScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.01, 1.02],
    extrapolate: 'clamp',
  });

  const fillOpacity = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });

  const tickSize = Math.round(boxSize * 0.68);
  const tickClipWidth = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0, tickSize],
    extrapolate: 'clamp',
  });

  const tickOpacity = progress.interpolate({
    inputRange: [0, 0.18, 0.3, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const textOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, doneOpacity],
    extrapolate: 'clamp',
  });

  const strikeClampedLag = Math.max(0, Math.min(0.6, strikeLag));
  const strikeProgress = progress.interpolate({
    inputRange: [0, strikeClampedLag, 0.88, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const strikeTranslateX =
    labelWidth > 0 && strike === 'left'
      ? strikeProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-labelWidth / 2, 0],
        })
      : labelWidth > 0 && strike === 'right'
        ? strikeProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [labelWidth / 2, 0],
          })
        : 0;

  const ringStrokeWidth = Math.max(1.4, boxSize * 0.068);
  const gap = Math.max(10, Math.round(boxSize * 0.45));
  const ruleHeight = Math.max(1.2, Math.round(fontSize * 0.08));
  const effectiveRadius = boxRadius >= boxSize / 2 ? boxSize / 2 : boxRadius;
  const accessibleName =
    ariaLabel || (typeof label === 'string' ? label : 'Checkbox');

  return (
    <Pressable
      onPress={handleToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibleName}
      accessibilityState={{ checked: on, disabled }}
      style={({ pressed }) => [
        styles.row,
        {
          gap,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.box,
          {
            width: boxSize,
            height: boxSize,
            borderRadius: effectiveRadius,
            borderWidth: ringStrokeWidth,
            borderColor: color,
            transform: [{ scale: boxSwell }],
          },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: fillColor,
              borderRadius: Math.max(0, effectiveRadius - 1),
              opacity: fillOpacity,
              transform: [{ scale: fillScale }],
            },
          ]}
        />
        <View style={{ width: tickSize, height: tickSize, alignItems: 'flex-start' }}>
          <Animated.View
            style={{
              width: tickClipWidth,
              height: tickSize,
              overflow: 'hidden',
              opacity: tickOpacity,
            }}
          >
            <Svg width={tickSize} height={tickSize} viewBox="0 0 24 24" fill="none">
              <Path
                d={TICK_PATH_D}
                stroke={checkColor}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>

      <View style={styles.labelContainer}>
        <View style={styles.labelWrapper} onLayout={handleLabelLayout}>
          {typeof label === 'string' || typeof label === 'number' ? (
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.labelText,
                {
                  color,
                  fontSize,
                  opacity: textOpacity,
                },
              ]}
            >
              {label}
            </Animated.Text>
          ) : (
            <Animated.View style={{ opacity: textOpacity }}>{label}</Animated.View>
          )}

          {strike !== 'none' && labelWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.strikeRule,
                {
                  height: ruleHeight,
                  backgroundColor: color,
                  opacity: progress.interpolate({
                    inputRange: [0, strikeClampedLag, 1],
                    outputRange: [0, 0.72, 0.72],
                  }),
                  transform: [
                    { translateX: strikeTranslateX },
                    { scaleX: strikeProgress },
                  ],
                },
              ]}
            />
          )}
        </View>
      </View>

      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  labelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  labelText: {
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  strikeRule: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 99,
  },
  trailing: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
});

export default SpringCheck;
