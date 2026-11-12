import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { SplitText } from '../effects/SplitText';

interface PreloaderSplashProps {
  onFinish: () => void;
}

const HERO_ICON_SIZE = 112;
const SHRUNK_ICON_SIZE = 52;
const SHRUNK_SCALE = SHRUNK_ICON_SIZE / HERO_ICON_SIZE;
const ICON_TEXT_GAP = 14;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export const PreloaderSplash: React.FC<PreloaderSplashProps> = ({ onFinish }) => {
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [textWidth, setTextWidth] = useState(156);
  const [showWordmark, setShowWordmark] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const [introOpacity] = useState(() => new Animated.Value(0));
  const [introScale] = useState(() => new Animated.Value(0.8));
  const [shrinkProgress] = useState(() => new Animated.Value(0));
  const [overlayOpacity] = useState(() => new Animated.Value(1));
  const [exitScale] = useState(() => new Animated.Value(1));

  const lockupShiftStartedRef = useRef(false);
  const exitedRef = useRef(false);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const triggerExit = useCallback(() => {
    if (exitedRef.current) return;
    exitedRef.current = true;
    setIsFadingOut(true);

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(exitScale, {
        toValue: 1.04,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      finishRef.current();
    });
  }, [exitScale, overlayOpacity]);

  useEffect(() => {
    // Stage 1: Pop the app icon into the center of the screen
    const introAnim = Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(introScale, {
        toValue: 1,
        friction: 7,
        tension: 95,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    introAnim.start();

    // Stage 2: Shrink icon & glide left, then reveal "SplitTrack" via SplitText
    const shrinkTimer = setTimeout(() => {
      lockupShiftStartedRef.current = true;
      Animated.timing(shrinkProgress, {
        toValue: 1,
        duration: 540,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }, 460);

    const textTimer = setTimeout(() => {
      setShowWordmark(true);
    }, 640);

    // Safety fail-safe in case animation callback doesn't fire (e.g. reduced motion/backgrounded)
    const fallbackTimer = setTimeout(() => {
      triggerExit();
    }, 2600);

    return () => {
      introAnim.stop();
      clearTimeout(shrinkTimer);
      clearTimeout(textTimer);
      clearTimeout(fallbackTimer);
    };
  }, [introOpacity, introScale, shrinkProgress, triggerExit]);

  const handleLetterAnimationComplete = useCallback(() => {
    setTimeout(() => {
      triggerExit();
    }, 420);
  }, [triggerExit]);

  const startOffsetX = (ICON_TEXT_GAP + textWidth) / 2;

  const shrinkScale = shrinkProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, SHRUNK_SCALE],
  });

  const combinedIconScale = Animated.multiply(introScale, shrinkScale);

  const iconTranslateX = shrinkProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [startOffsetX, 0],
  });

  const bgColor = isDark ? '#000000' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const iconSurfaceBg = isDark ? '#0A0A0D' : '#FFFFFF';
  const shadowColor = isDark ? '#FFFFFF' : '#000000';
  const iconSource = isDark
    ? require('../../../assets/icon-dark.png')
    : require('../../../assets/icon-light.png');

  return (
    <Animated.View
      pointerEvents={isFadingOut ? 'none' : 'auto'}
      style={[
        styles.overlay,
        {
          backgroundColor: bgColor,
          opacity: overlayOpacity,
        },
      ]}
    >
      {/* Hidden measurement clone so center-to-left shift aligns accurately */}
      <Text
        pointerEvents="none"
        onLayout={(e) => {
          const w = Math.ceil(e.nativeEvent.layout.width);
          if (!lockupShiftStartedRef.current && w > 40) {
            setTextWidth(w);
          }
        }}
        style={[styles.brandText, styles.measureClone]}
      >
        SplitTrack
      </Text>

      <Animated.View
        style={[
          styles.lockupRow,
          {
            transform: [{ scale: exitScale }],
          },
        ]}
      >
        {/* Fixed slot matching the final shrunk icon dimensions */}
        <View style={styles.iconSlot}>
          <Animated.View
            style={[
              styles.heroIconWrap,
              {
                backgroundColor: iconSurfaceBg,
                shadowColor,
                opacity: introOpacity,
                transform: [
                  { translateX: iconTranslateX },
                  { scale: combinedIconScale },
                ],
              },
            ]}
          >
            <Image
              source={iconSource}
              resizeMode="cover"
              style={styles.heroIconImage}
            />
          </Animated.View>
        </View>

        {/* Wordmark revealed smoothly from right to left beside the shrunk icon */}
        <View style={[styles.wordmarkSlot, { minWidth: textWidth }]}>
          {showWordmark ? (
            <SplitText
              text="SplitTrack"
              tag="h1"
              splitType="chars"
              trigger="load"
              staggerFrom="start"
              delay={42}
              duration={0.62}
              mask={true}
              textAlign="left"
              from={{ opacity: 0, x: 34 }}
              to={{ opacity: 1, x: 0 }}
              color={textColor}
              textStyle={[styles.brandText, { color: textColor }]}
              onLetterAnimationComplete={handleLetterAnimationComplete}
            />
          ) : null}
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    width: SHRUNK_ICON_SIZE,
    height: SHRUNK_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  heroIconWrap: {
    width: HERO_ICON_SIZE,
    height: HERO_ICON_SIZE,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  heroIconImage: {
    width: '100%',
    height: '100%',
  },
  wordmarkSlot: {
    marginLeft: ICON_TEXT_GAP,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 4,
  },
  brandText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.9,
    lineHeight: 38,
  },
  measureClone: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
  },
});

export default PreloaderSplash;
