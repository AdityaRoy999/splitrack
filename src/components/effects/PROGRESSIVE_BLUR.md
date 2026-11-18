Android edge blur uses the masked `BlurView` approach from
[rit3zh/expo-progressive-blur](https://github.com/rit3zh/expo-progressive-blur/blob/f1f32e86b8fc33ca05b29af3b4ad5a7391f4e9d0/app/index.tsx).

The upstream repository is an Expo SDK 54 demo application. `NativeFadeBlur.android.tsx`
adapts its gradient mask and Reanimated reveal to SDK 58's `BlurTargetView` and
`blurMethod` API. One blur surface replaces the previous six native surfaces per
edge. The existing eased mask runs in all four directions with transparent inner
endpoints; it is static so Android can keep hardware rendering during scrolling.
The demo's black background gradient and forced dark theme are omitted. Expo's
material intensity is kept low, with its reduction factor preserving the desired
blur radius. Android versions before API 31 remain transparent.

iOS continues using the local native gradual-radius implementation. The browser
continues using React Bits.
