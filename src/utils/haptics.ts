import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

export const ImpactStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationType = ExpoHaptics.NotificationFeedbackType;

export const triggerImpact = (
  style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Light
) => {
  if (Platform.OS === 'web') return;
  ExpoHaptics.impactAsync(style).catch(() => {});
};

export const triggerSelection = () => {
  if (Platform.OS === 'web') return;
  ExpoHaptics.selectionAsync().catch(() => {});
};

export const triggerNotification = (
  type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success
) => {
  if (Platform.OS === 'web') return;
  ExpoHaptics.notificationAsync(type).catch(() => {});
};
