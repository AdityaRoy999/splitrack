import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

export type SplitTextEffect = 'rise' | 'fade' | 'blur' | 'flip' | 'pop' | 'skew' | 'wave';

export interface SplitTextTweenVars {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotationX?: number;
  skewX?: number;
}

export interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  ease?: string | ((t: number) => number);
  splitType?: 'chars' | 'words' | 'lines' | 'words, chars';
  from?: SplitTextTweenVars;
  to?: SplitTextTweenVars;
  threshold?: number;
  rootMargin?: string;
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  staggerFrom?: 'start' | 'center' | 'end' | 'edges' | 'random';
  mask?: boolean;
  effect?: SplitTextEffect;
  trigger?: 'view' | 'load' | 'hover' | 'click';
  loop?: boolean;
  loopDelay?: number;
  hoverEffect?: 'none' | 'lift' | 'wave';
  color?: string;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  onLetterAnimationComplete?: () => void;
}

function resolveEffectRange(effect: SplitTextEffect): {
  from: SplitTextTweenVars;
  to: SplitTextTweenVars;
  easing: (t: number) => number;
} {
  switch (effect) {
    case 'fade':
      return {
        from: { opacity: 0 },
        to: { opacity: 1 },
        easing: Easing.inOut(Easing.ease),
      };
    case 'blur':
      return {
        from: { opacity: 0, y: 6, scale: 0.96 },
        to: { opacity: 1, y: 0, scale: 1 },
        easing: Easing.out(Easing.cubic),
      };
    case 'flip':
      return {
        from: { opacity: 0, y: 14, scale: 0.9 },
        to: { opacity: 1, y: 0, scale: 1 },
        easing: Easing.out(Easing.cubic),
      };
    case 'pop':
      return {
        from: { opacity: 0, scale: 0 },
        to: { opacity: 1, scale: 1 },
        easing: Easing.out(Easing.back(1.6)),
      };
    case 'skew':
      return {
        from: { opacity: 0, x: -16 },
        to: { opacity: 1, x: 0 },
        easing: Easing.out(Easing.exp),
      };
    case 'wave':
      return {
        from: { opacity: 0, y: 16 },
        to: { opacity: 1, y: 0 },
        easing: Easing.out(Easing.sin),
      };
    case 'rise':
    default:
      return {
        from: { opacity: 0, y: 28 },
        to: { opacity: 1, y: 0 },
        easing: Easing.out(Easing.cubic),
      };
  }
}

function getStaggerRanks(
  count: number,
  staggerFrom: NonNullable<SplitTextProps['staggerFrom']>
): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  if (staggerFrom === 'end') {
    return indices.map((i) => count - 1 - i);
  }
  if (staggerFrom === 'center') {
    const mid = (count - 1) / 2;
    return indices.map((i) => Math.abs(i - mid));
  }
  if (staggerFrom === 'edges') {
    const mid = (count - 1) / 2;
    return indices.map((i) => mid - Math.abs(i - mid));
  }
  if (staggerFrom === 'random') {
    const shuffled = [...indices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (i * 7 + 3) % (i + 1);
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    return shuffled;
  }
  return indices;
}

export const SplitText: React.FC<SplitTextProps> = ({
  text,
  delay = 50,
  duration = 0.8,
  ease,
  splitType = 'chars',
  from,
  to,
  textAlign = 'center',
  staggerFrom = 'start',
  mask = false,
  effect = 'rise',
  color,
  accentColor,
  style,
  textStyle,
  onLetterAnimationComplete,
}) => {
  const tokens = useMemo(() => {
    if (!text) return [];
    if (splitType === 'words') {
      return text.split(/(\s+)/).filter((part) => part.length > 0);
    }
    if (splitType === 'lines') {
      return text.split('\n');
    }
    return Array.from(text);
  }, [text, splitType]);

  const progressValues = useMemo(
    () => tokens.map(() => new Animated.Value(0)),
    [tokens]
  );

  const onCompleteRef = useRef(onLetterAnimationComplete);
  const completedRef = useRef<string | null>(null);

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete;
  }, [onLetterAnimationComplete]);

  const preset = useMemo(() => resolveEffectRange(effect), [effect]);
  const fromVars = useMemo(() => ({ ...preset.from, ...from }), [preset, from]);
  const toVars = useMemo(() => ({ ...preset.to, ...to }), [preset, to]);
  const ranks = useMemo(
    () => getStaggerRanks(tokens.length, staggerFrom),
    [tokens.length, staggerFrom]
  );

  useEffect(() => {
    if (tokens.length === 0) return;

    const customEase = typeof ease === 'function' ? ease : preset.easing;
    const durationMs = Math.max(120, Math.round(duration * 1000));

    progressValues.forEach((v) => v.setValue(0));

    const animations = progressValues.map((val, idx) =>
      Animated.timing(val, {
        toValue: 1,
        duration: durationMs,
        delay: Math.max(0, Math.round(ranks[idx] * delay)),
        easing: customEase,
        useNativeDriver: !accentColor,
      })
    );

    const parallel = Animated.parallel(animations);
    parallel.start(({ finished }) => {
      if (finished && completedRef.current !== text) {
        completedRef.current = text;
        onCompleteRef.current?.();
      }
    });

    return () => {
      parallel.stop();
    };
  }, [text, tokens.length, delay, duration, ease, preset, ranks, progressValues, accentColor]);

  const justifyContent: ViewStyle['justifyContent'] =
    textAlign === 'left'
      ? 'flex-start'
      : textAlign === 'right'
        ? 'flex-end'
        : 'center';

  const startOpacity = fromVars.opacity ?? 0;
  const endOpacity = toVars.opacity ?? 1;
  const startX = fromVars.x ?? 0;
  const endX = toVars.x ?? 0;
  const startY = fromVars.y ?? 0;
  const endY = toVars.y ?? 0;
  const startScale = fromVars.scale ?? 1;
  const endScale = toVars.scale ?? 1;

  return (
    <View style={[styles.row, { justifyContent }, style]}>
      {tokens.map((piece, idx) => {
        const anim = progressValues[idx];
        const opacity = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [startOpacity, endOpacity],
        });
        const translateX = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [startX, endX],
        });
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [startY, endY],
        });
        const scale = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [startScale, endScale],
        });

        const baseColor = color || '#FFFFFF';
        const interpolatedColor = accentColor
          ? anim.interpolate({
              inputRange: [0, 0.45, 1],
              outputRange: [accentColor, accentColor, baseColor],
            })
          : baseColor;

        const isSpace = piece === ' ';

        return (
          <View
            key={`${idx}-${piece}`}
            style={mask ? styles.clipBox : undefined}
          >
            <Animated.Text
              style={[
                styles.charText,
                textStyle,
                {
                  color: interpolatedColor as any,
                  opacity,
                  transform: [{ translateX }, { translateY }, { scale }],
                },
                isSpace && styles.spaceChar,
              ]}
            >
              {piece}
            </Animated.Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  clipBox: {
    overflow: 'hidden',
  },
  charText: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  spaceChar: {
    width: 8,
  },
});

export default SplitText;
