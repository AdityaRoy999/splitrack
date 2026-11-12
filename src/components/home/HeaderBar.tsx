import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Sun2Icon } from '@solar-icons/react-native/bold/sun-2';
import { MoonIcon } from '@solar-icons/react-native/bold/moon';
import { SettingsMinimalisticIcon } from '@solar-icons/react-native/bold/settings-minimalistic';
import { ImpactStyle, triggerImpact } from '../../utils/haptics';
import { useLiquidGlass } from '../../theme/LiquidGlassContext';
import { AnimatedPressable } from '../common/MotionPrimitives';
import { GlassSurface } from '../glass/GlassSurface';
import { NativeGlassContainer } from '../common/AppleNativeControls';

interface HeaderBarProps {
  onOpenSettings: () => void;
  onOpenNotifications?: () => void;
  userName?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenSettings,
  onOpenNotifications,
  userName = 'Jfiqw Alex',
}) => {
  const { themeMode, toggleTheme } = useLiquidGlass();
  const isDark = themeMode === 'dark';

  const handleSettings = () => {
    triggerImpact(ImpactStyle.Light);
    onOpenSettings();
  };

  const handleToggleTheme = () => {
    triggerImpact(ImpactStyle.Light);
    toggleTheme();
  };

  const textColor = isDark ? '#FFFFFF' : '#000000';
  const iconBtnBg = isDark ? '#18181D' : '#FFFFFF';

  return (
    <View style={styles.container}>
      {/* User Avatar + Greeting */}
      <View style={styles.userSection}>
        <AnimatedPressable scaleTo={0.94} onPress={handleSettings} style={styles.avatarWrapper}>
          <Image
            source={
              isDark
                ? require('../../../assets/icon-dark.png')
                : require('../../../assets/icon-light.png')
            }
            resizeMode="cover"
            style={[
              styles.avatar,
              { backgroundColor: isDark ? '#000000' : '#FFFFFF' },
            ]}
          />
        </AnimatedPressable>
        <View style={styles.greetingCol}>
          <Text style={[styles.userName, { color: textColor }]}>{userName}</Text>
          <Text style={[styles.statusText, { color: isDark ? '#71717A' : '#8E8E93' }]}>
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </Text>
        </View>
      </View>

      {/* Action Icons: Quick Theme Toggle & Settings */}
      <NativeGlassContainer spacing={8} style={styles.actionsRow}>
        <AnimatedPressable
          onPress={handleToggleTheme}
          scaleTo={0.9}
          accessibilityLabel="Toggle theme mode"
        >
          <GlassSurface
            borderRadius={19}
            glassStyle="regular"
            interactive
            intensity={45}
            matteColor={iconBtnBg}
            style={styles.iconButton}
          >
            {isDark ? (
              <Sun2Icon size={18} color="#FFFFFF" />
            ) : (
              <MoonIcon size={18} color="#000000" />
            )}
          </GlassSurface>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={handleSettings}
          scaleTo={0.9}
          accessibilityLabel="Open settings"
        >
          <GlassSurface
            borderRadius={19}
            glassStyle="regular"
            interactive
            intensity={45}
            matteColor={iconBtnBg}
            style={styles.iconButton}
          >
            <SettingsMinimalisticIcon size={18} color={textColor} />
          </GlassSurface>
        </AnimatedPressable>
      </NativeGlassContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    marginRight: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 0, // completely borderless
  },
  greetingCol: {
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0, // completely borderless
  },
});
