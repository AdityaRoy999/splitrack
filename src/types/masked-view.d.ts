// MaskedView 0.3.2's legacy NativeMethods class mixin is incompatible with
// React 19 / RN 0.88 types. Describe the actual component props it exports.
declare module '@react-native-masked-view/masked-view' {
  import type { ComponentType, ReactElement } from 'react';
  import type { ViewProps } from 'react-native';

  export interface MaskedViewProps extends ViewProps {
    maskElement: ReactElement;
    androidRenderingMode?: 'software' | 'hardware';
  }

  const MaskedView: ComponentType<MaskedViewProps>;
  export default MaskedView;
}
