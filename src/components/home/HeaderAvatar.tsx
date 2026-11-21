import React, { useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { isPhotoUri, UserAvatar } from '../common/UserAvatar';

// Crossfade decoded photos without a persistent image blur on web or native.
export function HeaderAvatar({ uri, hidden, dark, name }: { uri: string | null; hidden: boolean; dark: boolean; name: string }) {
  const photo = isPhotoUri(uri);
  const [readyUri, setReadyUri] = useState<string | null>(null);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const ready = photo && readyUri === uri && failedUri !== uri;
  const progress = useSharedValue(hidden ? 0 : 1);
  const photoProgress = useSharedValue(0);
  useLayoutEffect(() => {
    const config = { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
    progress.set(withTiming(hidden ? 0 : 1, config));
    photoProgress.set(withTiming(!hidden && ready ? 1 : 0, config));
  }, [hidden, ready, progress, photoProgress]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const photoMotion = useAnimatedStyle(() => ({ opacity: photoProgress.get() }));
  const fallbackMotion = useAnimatedStyle(() => ({ opacity: 1 - photoProgress.get() }));
  return <View style={styles.slot}>
    <Animated.View style={[StyleSheet.absoluteFill, motion]}>
      <Animated.View style={[StyleSheet.absoluteFill, fallbackMotion]}><UserAvatar avatarUri={photo ? null : uri} name={name} size={42} borderRadius={14} isDark={dark} /></Animated.View>
      {photo && failedUri !== uri ? <Animated.Image source={{ uri: uri! }} resizeMode="cover"
        onLoadEnd={() => setReadyUri(uri)} onError={() => setFailedUri(uri)}
        style={[StyleSheet.absoluteFill, photoMotion]} /> : null}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({ slot: { width: 42, height: 42, borderRadius: 14, overflow: 'hidden' } });
