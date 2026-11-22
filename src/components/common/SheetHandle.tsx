import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useNativeSheetPresentation } from './NativeSheetPresentation';

// SwiftUI draws and handles its own grabber above the sheet's content.
export function SheetHandle({ style, handleStyle }: { style?: StyleProp<ViewStyle>; handleStyle?: StyleProp<ViewStyle> }) {
  const native = useNativeSheetPresentation();
  return native ? null : <View style={style}><View style={handleStyle} /></View>;
}
