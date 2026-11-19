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
import { SplitText } from '../effects/SplitText';
import { measureNodeInWindow, type ViewRefNode } from '../../utils/measureWindow';
import type { HeaderLogoRect } from '../home/HeaderBar';

interface PreloaderSplashProps {
  ready?: boolean;
  targetLogoRect?: HeaderLogoRect | null;
  targetLogoNodeRef?: React.RefObject<ViewRefNode | null>;
  onRevealHeaderLogo?: () => void;
  onFinish: () => void;
}

interface FlightDestination {
  translateX: number;
  translateY: number;
  scale: number;
}

const HERO_ICON_SIZE = 112;
const SHRUNK_ICON_SIZE = 52;
const HEADER_ICON_SIZE = 42;
const SHRUNK_SCALE = SHRUNK_ICON_SIZE / HERO_ICON_SIZE;
const ICON_TEXT_GAP = 14;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Auth/provider remounts are not a fresh application launch. Keep this in the
// JavaScript session rather than storage so a real cold launch still animates.
let startupPreloaderCompleted = false;
let startupPreloaderStarted = false;
export const hasCompletedStartupPreloader = () => startupPreloaderCompleted || startupPreloaderStarted;

export const PreloaderSplash: React.FC<PreloaderSplashProps> = ({
  ready = true,
  targetLogoRect,
  targetLogoNodeRef,
  onRevealHeaderLogo,
  onFinish,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDark = true;

  const [textWidth, setTextWidth] = useState(156);
  const [showWordmark, setShowWordmark] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [flightDestination, setFlightDestination] = useState<FlightDestination | null>(null);
  const [skipAnimation] = useState(hasCompletedStartupPreloader);

  const [introOpacity] = useState(() => new Animated.Value(0));
  const [iconScale] = useState(() => new Animated.Value(0.8));
  const [iconTranslateX] = useState(() => new Animated.Value(0));
  const [iconTranslateY] = useState(() => new Animated.Value(0));
  const [cornerProgress] = useState(() => new Animated.Value(0));
  const [wordmarkOpacity] = useState(() => new Animated.Value(1));
  const [wordmarkTranslateX] = useState(() => new Animated.Value(0));
  const [backdropOpacity] = useState(() => new Animated.Value(1));

  const overlayRef = useRef<ViewRefNode>(null);
  const overlayRectRef = useRef({
    x: 0,
    y: 0,
    width: windowWidth,
    height: windowHeight,
  });
  const textWidthRef = useRef(textWidth);
  const targetLogoRectRef = useRef(targetLogoRect);
  const targetLogoNodeRefRef = useRef(targetLogoNodeRef);
  const lockupShiftStartedRef = useRef(false);
  const exitedRef = useRef(false);
  const readyRef = useRef(ready);
  const exitRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const finishedRef = useRef(false);
  const handoffRef = useRef(false);
  const framesRef = useRef(new Set<number>());
  const letterExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealRef = useRef(onRevealHeaderLogo);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    const frames = framesRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      frames.forEach(cancelAnimationFrame);
      frames.clear();
      if (letterExitTimerRef.current !== null) clearTimeout(letterExitTimerRef.current);
    };
  }, []);

  const scheduleFrame = useCallback((callback: () => void) => {
    const frame = requestAnimationFrame(() => {
      framesRef.current.delete(frame);
      if (mountedRef.current) callback();
    });
    framesRef.current.add(frame);
    return frame;
  }, []);

  const finishStartup = useCallback(() => {
    if (!mountedRef.current || finishedRef.current || handoffRef.current) return;
    handoffRef.current = true;
    startupPreloaderCompleted = true;
    revealRef.current?.();
    // Keep the landed logo while the header photo fades in beneath it.
    Animated.timing(introOpacity, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER, isInteraction: false }).start(({ finished }) => {
      if (finished && mountedRef.current && !finishedRef.current) { finishedRef.current = true; finishRef.current(); }
    });
  }, [introOpacity]);

  useEffect(() => {
    if (skipAnimation) finishStartup();
  }, [finishStartup, skipAnimation]);

  useEffect(() => {
    revealRef.current = onRevealHeaderLogo;
  }, [onRevealHeaderLogo]);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    textWidthRef.current = textWidth;
  }, [textWidth]);

  useEffect(() => {
    targetLogoRectRef.current = targetLogoRect;
    targetLogoNodeRefRef.current = targetLogoNodeRef;
  }, [targetLogoRect, targetLogoNodeRef]);

  const measureOverlay = useCallback(() => {
    scheduleFrame(() => {
      measureNodeInWindow(overlayRef.current, (rect) => {
        if (mountedRef.current) overlayRectRef.current = rect;
      });
    });
  }, [scheduleFrame]);

  const prepareTargetAnchoredFlight = useCallback(
    (
      liveOverlay: HeaderLogoRect,
      measuredTarget: HeaderLogoRect | null
    ) => {
      const target =
        measuredTarget && measuredTarget.width > 0 && measuredTarget.height > 0
          ? measuredTarget
          : targetLogoRectRef.current && targetLogoRectRef.current.width > 0
            ? targetLogoRectRef.current
            : {
                x:
                  liveOverlay.x +
                  Math.max(0, (liveOverlay.width - 480) / 2) +
                  16,
                y: liveOverlay.y + 54,
                width: HEADER_ICON_SIZE,
                height: HEADER_ICON_SIZE,
              };

      const targetCenterX = target.x + target.width / 2;
      const targetCenterY = target.y + target.height / 2;
      if (!mountedRef.current) return;
      setFlightDestination({
        translateX: targetCenterX - liveOverlay.x - liveOverlay.width / 2,
        translateY: targetCenterY - liveOverlay.y - liveOverlay.height / 2,
        scale: target.width / HERO_ICON_SIZE,
      });
    },
    []
  );

  useEffect(() => {
    if (!flightDestination || startupPreloaderCompleted) return;
    let active = true;

    const anim = Animated.parallel([
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
        toValue: flightDestination.translateX,
        duration: 540,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(iconTranslateY, {
        toValue: flightDestination.translateY,
        duration: 540,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(iconScale, {
        toValue: flightDestination.scale,
        duration: 540,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(cornerProgress, {
        toValue: 1,
        duration: 440,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    anim.start(({ finished }) => {
      if (active && finished) finishStartup();
    });
    const finishTimer = setTimeout(() => {
      if (active) finishStartup();
    }, 1400);

    return () => {
      active = false;
      anim.stop();
      clearTimeout(finishTimer);
    };
  }, [
    backdropOpacity,
    cornerProgress,
    iconScale,
    flightDestination,
    iconTranslateX,
    iconTranslateY,
    finishStartup,
    wordmarkOpacity,
    wordmarkTranslateX,
  ]);

  const triggerExit = useCallback(() => {
    if (!mountedRef.current || exitedRef.current || startupPreloaderCompleted) return;
    if (!readyRef.current) {
      exitRequestedRef.current = true;
      return;
    }
    exitedRef.current = true;
    setIsFadingOut(true);

    iconScale.stopAnimation();
    iconTranslateX.stopAnimation();

    const measureSafe = (
      node: ViewRefNode | null,
      fallback: HeaderLogoRect | null,
      cb: (rect: HeaderLogoRect | null) => void
    ) => {
      if (!node) {
        cb(fallback);
        return;
      }
      let settled = false;
      measureNodeInWindow(node, (rect) => {
        if (!settled && mountedRef.current) {
          settled = true;
          cb(rect);
        }
      });
      scheduleFrame(() => {
        if (!settled) {
          settled = true;
          cb(fallback);
        }
      });
    };

    const cachedOverlay = overlayRectRef.current;
    // Account hydration may switch the destination from onboarding to home.
    // Read the latest node without restarting the intro effect and its timers.
    const targetNode = targetLogoNodeRefRef.current?.current ?? null;

    measureSafe(overlayRef.current, cachedOverlay, (measuredOverlay) => {
      const liveOverlay = measuredOverlay || cachedOverlay;
      overlayRectRef.current = liveOverlay;

      measureSafe(targetNode, targetLogoRectRef.current ?? null, (liveTargetRect) => {
        prepareTargetAnchoredFlight(liveOverlay, liveTargetRect);
      });
    });
  }, [iconScale, iconTranslateX, prepareTargetAnchoredFlight, scheduleFrame]);

  useEffect(() => {
    readyRef.current = ready;
    if (!ready || !exitRequestedRef.current) return;
    // Keep the finished lockup visible while the account hydrates, then fly to
    // its mounted destination rather than revealing a second loading screen.
    const frame = scheduleFrame(triggerExit);
    return () => cancelAnimationFrame(frame);
  }, [ready, triggerExit, scheduleFrame]);

  useEffect(() => {
    if (startupPreloaderCompleted) return;
    startupPreloaderStarted = true;
    let shrinkAnim: Animated.CompositeAnimation | null = null;
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
      shrinkAnim = Animated.parallel([
        Animated.timing(iconScale, {
          toValue: SHRUNK_SCALE,
          duration: 500,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(iconTranslateX, {
          toValue: -(ICON_TEXT_GAP + textWidthRef.current) / 2,
          duration: 500,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]);
      shrinkAnim.start();
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
      shrinkAnim?.stop();
      clearTimeout(shrinkTimer);
      clearTimeout(textTimer);
      clearTimeout(fallbackTimer);
    };
  }, [iconScale, iconTranslateX, introOpacity, triggerExit]);

  const handleLetterAnimationComplete = useCallback(() => {
    if (!mountedRef.current || letterExitTimerRef.current !== null || exitedRef.current) return;
    letterExitTimerRef.current = setTimeout(() => {
      letterExitTimerRef.current = null;
      triggerExit();
    }, 320);
  }, [triggerExit]);

  const animatedCornerRadius = cornerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 14 * HERO_ICON_SIZE / HEADER_ICON_SIZE],
  });

  const bgColor = isDark ? '#000000' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#09090B';
  const iconSurfaceBg = isDark ? '#000000' : '#FFFFFF';
  const iconSource = isDark
    ? require('../../../assets/icon-dark.png')
    : require('../../../assets/icon-light.png');

  if (skipAnimation) return null;

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
        <View pointerEvents="none" style={styles.iconSlot} />

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

      {/* Keep the same decoded image mounted through intro, shrink and flight. */}
      <View pointerEvents="none" style={styles.iconAnchor}>
        <Animated.View
          pointerEvents="none"
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
    position: 'relative',
    width: SHRUNK_ICON_SIZE,
    height: SHRUNK_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 4,
  },
  iconAnchor: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
