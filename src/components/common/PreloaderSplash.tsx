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

interface FlightSpec {
  left: number;
  top: number;
  width: number;
  height: number;
  startCornerRadius: number;
  endCornerRadius: number;
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
  const [flightSpec, setFlightSpec] = useState<FlightSpec | null>(null);

  const [introOpacity] = useState(() => new Animated.Value(0));
  const [iconScale] = useState(() => new Animated.Value(0.8));
  const [iconTranslateX] = useState(() => new Animated.Value((ICON_TEXT_GAP + 156) / 2));
  const [cornerProgress] = useState(() => new Animated.Value(0));
  const [flightTranslateX] = useState(() => new Animated.Value(0));
  const [flightTranslateY] = useState(() => new Animated.Value(0));
  const [flightScale] = useState(() => new Animated.Value(1));
  const [flightCornerProgress] = useState(() => new Animated.Value(0));
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
  const flightStartedRef = useRef(false);
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

  const prepareTargetAnchoredFlight = useCallback(
    (
      liveOverlay: HeaderLogoRect,
      slotRect: HeaderLogoRect,
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

      const slotCenterX = slotRect.x + slotRect.width / 2;
      const slotCenterY = slotRect.y + slotRect.height / 2;
      const targetCenterX = target.x + target.width / 2;
      const targetCenterY = target.y + target.height / 2;

      // Pin flyer at exact target (left, top, width, height) so t=1 settles at translate(0, 0) & scale(1)
      flightTranslateX.setValue(slotCenterX - targetCenterX);
      flightTranslateY.setValue(slotCenterY - targetCenterY);
      flightScale.setValue(SHRUNK_ICON_SIZE / target.width);
      flightCornerProgress.setValue(0);

      setFlightSpec({
        left: target.x - liveOverlay.x,
        top: target.y - liveOverlay.y,
        width: target.width,
        height: target.height,
        startCornerRadius: (28 * target.width) / HERO_ICON_SIZE,
        endCornerRadius: target.width / 2,
      });
    },
    [flightCornerProgress, flightScale, flightTranslateX, flightTranslateY]
  );

  useEffect(() => {
    if (!flightSpec || flightStartedRef.current) return;
    flightStartedRef.current = true;

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
      Animated.timing(flightTranslateX, {
        toValue: 0,
        duration: 540,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(flightTranslateY, {
        toValue: 0,
        duration: 540,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(flightScale, {
        toValue: 1,
        duration: 540,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(flightCornerProgress, {
        toValue: 1,
        duration: 440,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    anim.start(({ finished }) => {
      if (!finished) return;
      revealRef.current?.();
      // Let target avatar commit at exact 1:1 scale & coordinates underneath, then unmount overlay atomically
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          finishRef.current();
        });
      });
    });

    return () => {
      anim.stop();
    };
  }, [
    backdropOpacity,
    flightCornerProgress,
    flightScale,
    flightSpec,
    flightTranslateX,
    flightTranslateY,
    wordmarkOpacity,
    wordmarkTranslateX,
  ]);

  const triggerExit = useCallback(() => {
    if (exitedRef.current) return;
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
        if (!settled) {
          settled = true;
          cb(rect);
        }
      });
      requestAnimationFrame(() => {
        if (!settled) {
          settled = true;
          cb(fallback);
        }
      });
    };

    const cachedOverlay = overlayRectRef.current;
    const targetNode = targetLogoNodeRef?.current ?? null;
    const slotNode = iconSlotRef.current;

    measureSafe(overlayRef.current, cachedOverlay, (measuredOverlay) => {
      const liveOverlay = measuredOverlay || cachedOverlay;
      overlayRectRef.current = liveOverlay;

      const fallbackSlot: HeaderLogoRect = {
        x:
          liveOverlay.x +
          liveOverlay.width / 2 -
          (ICON_TEXT_GAP + textWidthRef.current) / 2 -
          SHRUNK_ICON_SIZE / 2,
        y: liveOverlay.y + liveOverlay.height / 2 - SHRUNK_ICON_SIZE / 2,
        width: SHRUNK_ICON_SIZE,
        height: SHRUNK_ICON_SIZE,
      };

      measureSafe(slotNode, fallbackSlot, (measuredSlot) => {
        const slotRect = measuredSlot || fallbackSlot;
        measureSafe(targetNode, targetLogoRectRef.current ?? null, (liveTargetRect) => {
          prepareTargetAnchoredFlight(liveOverlay, slotRect, liveTargetRect);
        });
      });
    });
  }, [iconScale, iconTranslateX, prepareTargetAnchoredFlight, targetLogoNodeRef]);

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

  const flightCornerRadius = flightSpec
    ? flightCornerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [flightSpec.startCornerRadius, flightSpec.endCornerRadius],
      })
    : 0;

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
        {/* Fixed slot matching shrunk icon center before handing off to target-anchored flyer */}
        <View ref={iconSlotRef} collapsable={false} style={styles.iconSlot}>
          {!flightSpec ? (
            <Animated.View
              style={[
                styles.heroTransformWrap,
                {
                  opacity: introOpacity,
                  transform: [
                    { translateX: iconTranslateX },
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
          ) : null}
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

      {/* Target-anchored 1:1 flyer settles at exact target frame (translate 0, scale 1) */}
      {flightSpec ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flightAnchor,
            {
              left: flightSpec.left,
              top: flightSpec.top,
              width: flightSpec.width,
              height: flightSpec.height,
              transform: [
                { translateX: flightTranslateX },
                { translateY: flightTranslateY },
                { scale: flightScale },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.flightMask,
              {
                width: flightSpec.width,
                height: flightSpec.height,
                backgroundColor: iconSurfaceBg,
                borderRadius: flightCornerRadius,
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
      ) : null}
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
  heroTransformWrap: {
    position: 'absolute',
    left: (SHRUNK_ICON_SIZE - HERO_ICON_SIZE) / 2,
    top: (SHRUNK_ICON_SIZE - HERO_ICON_SIZE) / 2,
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
  flightAnchor: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightMask: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
