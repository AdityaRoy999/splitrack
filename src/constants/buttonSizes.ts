import type { ViewStyle } from 'react-native';

/** Compact visuals with room around them for a 44px touch target. */
export const COMPACT_BUTTON_HEIGHT = 36;
export const COMPACT_BUTTON_HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };
export const COMPACT_ICON_BUTTON_STYLE: ViewStyle = {
  width: COMPACT_BUTTON_HEIGHT,
  height: COMPACT_BUTTON_HEIGHT,
  alignItems: 'center',
  justifyContent: 'center',
};
