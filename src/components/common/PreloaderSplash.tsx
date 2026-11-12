import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { SplitText } from '../effects/SplitText';
import { measureNodeInWindow, type ViewRefNode } from '../../utils/measureWindow';
import type { HeaderLogoRect } from '../home/HeaderBar';

interface PreloaderSplashProps {
  targetLogoRect?: HeaderLogoRect | null;
  targetLogoNodeRef?: React.RefObject<ViewRefNode | null>;
  onRevealHeaderLogo?: () => void;
  onFinish: () => void;
}

const HERO_ICON_SIZE = 112;
const SHRUNK_ICON_SIZE = 52;
const HEADER_ICON_SIZE = 42;
const SHRUNK_SCALE = SHRUNK_ICON_SIZE / HERO_ICON_SIZE;
const ICON_TEXT_GAP = 14;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export const PreloaderSplash: React.FC<PreloaderSplashProps> = ({
  targetLogoRect,
  targetLogoNodeRef,
  onRevealHeaderLogo,
  onFinish,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { themeMode } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const [textWidth, setTextWidth] = useState(156);
  const [showWordmark, setShowWordmark] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const [introOpacity] = useState(() => new Animated.Value(0));
  const [iconScale] = useState(() => new Animated.Value(0.8));
  const [iconTranslateX] = useState(() => new Animated.Value((ICON_TEXT_GAP + 156) / 2));
  const [iconTranslateY] = useState(() => new Animated.Value(0));
  const [cornerProgress] = useState(() => new Animated.Value(0));
  const [wordmarkOpacity] = useState(() => new Animated.Value(1));
  const [wordmarkTranslateX] = useState(() => new Animated.Value(0));
  const [backdropOpacity] = useState(() => new Animated.Value(1));

  const overlayRef = useRef<ViewRefNode>(null);
  const iconSlotRef = useRef<ViewRefNode>(null);
  const overlayRectRef = useRef({
    x: 0,
    y: 0,
    width: windowWidth,
    height: windowHeight,
  });
  const textWidthRef = useRef(textWidth);
  const targetLogoRectRef = useRef(targetLogoRect);
  const lockupShiftStartedRef = useRef(false);
  const exitedRef = useRef(false);
  const revealRef = useRef(onRevealHeaderLogo);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    revealRef.current = onRevealHeaderLogo;
  }, [onRevealHeaderLogo]);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    textWidthRef.current = textWidth;
    if (!lockupShiftStartedRef.current) {
      iconTranslateX.setValue((ICON_TEXT_GAP + textWidth) / 2);
    }
  }, [textWidth, iconTranslateX]);

  useEffect(() => {
    targetLogoRectRef.current = targetLogoRect;
  }, [targetLogoRect]);

  const measureOverlay = useCallback(() => {
    requestAnimationFrame(() => {
      measureNodeInWindow(overlayRef.current, (rect) => {
        overlayRectRef.current = rect;
      });
    });
  }, []);

  const startFlightAnimation = useCallback(
    (slotRect: HeaderLogoRect, measuredTarget: HeaderLogoRect | null) => {
      const overlay = overlayRectRef.current;
      const slotCenterX = slotRect.x + slotRect.width / 2;
      const slotCenterY = slotRect.y + slotRect.height / 2;

      const target = measuredTarget || targetLogoRectRef.current;
      const hasMeasuredTarget = Boolean(target && target.width > 0 && target.height > 0);
      const targetCenterX = hasMeasuredTarget
        ? target!.x + target!.width / 2
        : overlay.x + Math.max(0, (overlay.width - 480) / 2) + 16 + HEADER_ICON_SIZE / 2;
      const targetCenterY = hasMeasuredTarget
        ? target!.y + target!.height / 2
        : overlay.y + 54 + HEADER_ICON_SIZE / 2;
      const endScale =
        (hasMeasuredTarget ? target!.width : HEADER_ICON_SIZE) / HERO_ICON_SIZE;

      const flyDeltaX = targetCenterX - slotCenterX;
      const flyDeltaY = targetCenterY - slotCenterY;

      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 0,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(wordmarkTranslateX, {
          toValue: -10,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 460,
          delay: 40,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(iconTranslateX, {
          toValue: flyDeltaX,
          duration: 540,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(iconTranslateY, {
          toValue: flyDeltaY,
          duration: 540,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(iconScale, {
          toValue: endScale,
          duration: 540,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(cornerProgress, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start(() => {
        revealRef.current?.();
        requestAnimationFrame(() => {
          Animated.timing(introOpacity, {
            toValue: 0,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start(() => {
            finishRef.current();
          });
        });
      });
    },
    [
      backdropOpacity,
      cornerProgress,
      iconScale,
      iconTranslateX,
      iconTranslateY,
      introOpacity,
      wordmarkOpacity,
      wordmarkTranslateX,
    ]
  );

  const triggerExit = useCallback(() => {
    if (exitedRef.current) return;
    exitedRef.current = true;
    setIsFadingOut(true);

    const overlay = overlayRectRef.current;
    const fallbackSlot: HeaderLogoRect = {
      x: overlay.x + overlay.width / 2 - (ICON_TEXT_GAP + textWidthRef.current) / 2 - SHRUNK_ICON_SIZE / 2,
      y: overlay.y + overlay.height / 2 - SHRUNK_ICON_SIZE / 2,
      width: SHRUNK_ICON_SIZE,
      height: SHRUNK_ICON_SIZE,
    };

    const targetNode = targetLogoNodeRef?.current ?? null;
    const slotNode = iconSlotRef.current;

    if (!slotNode) {
      startFlightAnimation(fallbackSlot, targetLogoRectRef.current ?? null);
      return;
    }

    measureNodeInWindow(slotNode, (slotRect) => {
      if (!targetNode) {
        startFlightAnimation(slotRect, targetLogoRectRef.current ?? null);
        return;
      }
      measureNodeInWindow(targetNode, (liveTargetRect) => {
        startFlightAnimation(slotRect, liveTargetRect);
      });
    });
  }, [startFlightAnimation, targetLogoNodeRef]);

  useEffect(() => {
    // Stage 1: Pop hero app icon into screen center
    const introAnim = Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 7,
        tension: 95,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    introAnim.start();

    // Stage 2: Shrink icon smoothly & glide left, revealing "SplitTrack" out from the logo
    const shrinkTimer = setTimeout(() => {
      lockupShiftStartedRef.current = true;
      Animated.parallel([
        Animated.timing(iconScale, {
          toValue: SHRUNK_SCALE,
          duration: 500,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(iconTranslateX, {
          toValue: 0,
          duration: 500,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }, 430);

    const textTimer = setTimeout(() => {
      setShowWordmark(true);
    }, 610);

    // Safety fail-safe in case animation callback doesn't fire
    const fallbackTimer = setTimeout(() => {
      triggerExit();
    }, 2500);

    return () => {
      introAnim.stop();
      clearTimeout(shrinkTimer);
      clearTimeout(textTimer);
      clearTimeout(fallbackTimer);
    };
  }, [iconScale, iconTranslateX, introOpacity, triggerExit]);

  const handleLetterAnimationComplete = useCallback(() => {
    setTimeout(() => {
      triggerExit();
    }, 320);
  }, [triggerExit]);

  const animatedCornerRadius = cornerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [28, HERO_ICON_SIZE / 2],
  });

  const bgColor = isDark ? '#000000' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const iconSurfaceBg = isDark ? '#000000' : '#FFFFFF';
  const iconSource = isDark
    ? require('../../../assets/icon-dark.png')
    : require('../../../assets/icon-light.png');

  return (
    <View
      ref={overlayRef}
      collapsable={false}
      onLayout={measureOverlay}
      pointerEvents={isFadingOut ? 'none' : 'auto'}
      style={styles.overlay}
    >
      {/* Fading backdrop reveals the home screen beneath as the icon flies to the header */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.backdrop,
          {
            backgroundColor: bgColor,
            opacity: backdropOpacity,
          },
        ]}
      />

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

      <View style={styles.lockupRow}>
        {/* Fixed slot matching shrunk icon center before flying to header */}
        <View ref={iconSlotRef} collapsable={false} style={styles.iconSlot}>
          <Animated.View
            style={[
              styles.heroTransformWrap,
              {
                opacity: introOpacity,
                transform: [
                  { translateX: iconTranslateX },
                  { translateY: iconTranslateY },
                  { scale: iconScale },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.heroIconMask,
                {
                  backgroundColor: iconSurfaceBg,
                  borderRadius: animatedCornerRadius,
                },
              ]}
            >
              <Image
                source={iconSource}
                resizeMode="cover"
                style={styles.heroIconImage}
              />
            </Animated.View>
          </Animated.View>
        </View>

        {/* Wordmark emerges from the logo edge and slides smoothly to the right */}
        <Animated.View
          style={[
            styles.wordmarkSlot,
            {
              minWidth: textWidth,
              opacity: wordmarkOpacity,
              transform: [{ translateX: wordmarkTranslateX }],
            },
          ]}
        >
          {showWordmark ? (
            <SplitText
              text="SplitTrack"
              tag="h1"
              splitType="chars"
              trigger="load"
              staggerFrom="start"
              delay={40}
              duration={0.58}
              mask={true}
              textAlign="left"
              from={{ opacity: 0, x: -26 }}
              to={{ opacity: 1, x: 0 }}
              color={textColor}
              textStyle={[styles.brandText, { color: textColor }]}
              onLetterAnimationComplete={handleLetterAnimationComplete}
            />
          ) : null}
        </Animated.View>
      </View>
    </View>
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    zIndex: 4,
  },
  heroTransformWrap: {
    width: HERO_ICON_SIZE,
    height: HERO_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconMask: {
    width: HERO_ICON_SIZE,
    height: HERO_ICON_SIZE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
    zIndex: 2,
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
