Native progressive backdrop blur

The app uses Expo 58, React Native 0.88.1, Hermes, and Fabric. Native code is
generated through Expo Prebuild; platform-specific JavaScript adapters select
the renderers used by each platform.

Android uses a frosted edge approximation in NativeProgressiveBlur.android.tsx:
one static, theme-colored linear gradient, with opacity animated only when the
edge is shown or hidden. It does not capture the backdrop, allocate CPU blur
buffers, or construct RenderEffects. Transparent tints use the current theme's
background color. Top, bottom, left and right edges share the same adapter.
The progressive native library remains installed for compatibility with the
existing project setup, but the Android renderer no longer imports it.

iOS uses @sbaiahmed1/react-native-blur 6.0.3. Its variable-radius backdrop filter
avoids the custom UIKit blur stack. The library uses private CAFilter API; a
future iOS change can fall back to uniform blur, and App Store review can flag
that API. Android's implementation of this library is uniform masked blur, so it
is not linked into the APK. expo-backdrop's iOS implementation is also uniform
masked blur with ancestor mask/alpha issues, so it is not linked into the IPA.

iOS continues to sample the native backdrop. Android approximates the frosted
appearance with tint and fade; it does not blur the actual pixels underneath.
The iOS adapter and its native imports are unchanged.

SpotlightCard renders its image, bottom blur, then controls. The shared edge
wrapper leaves touch events to content. The browser retains React Bits through
GradualBlur.web.tsx. scripts/patch-ios-progressive-blur.mjs adds horizontal native
masks in the pinned iOS library without rotating its UIKit backdrop. The patch
also caches the mask/filter and updates only the radius during reveal animations,
so the material does not reset on every frame. iOS scroll viewports remain
transparent to sample their actual sheet surface; Android viewports use the
containing surface. Main screens and Settings share top and bottom edge effects.
SheetModal provides ModalVisualContext so progressive
blur is omitted and GlassSurface/GlassCard use solid matte surfaces throughout
modal content. Android QR/calendar backdrops use dimming without blur. Sheets retain
their content and backdrop through the exit animation.
Physical-device checks should cover those edges, light/dark themes, scrolling,
foreground return, and image highlight transitions.

Android performance note

Aurora.android.tsx renders two static gradients with the existing card palette.
It does not import expo-gl, compile shaders, allocate shader textures, measure
card visibility, or subscribe to a frame loop. AuroraMesh.android.tsx and
AuroraBackground.android.tsx likewise use static gradients. Android QR backdrops
and the root backdrop target also use plain Views. Native gradient dithering is
disabled for these decorative Android effects. iOS continues to resolve the
original Aurora and mesh renderers. These are code-level workload reductions;
scrolling and frame times still need verification on physical devices.

Android's ordinary GlassSurface previously mounted Expo BlurView without a
blurTarget or blurMethod, which SDK 58 renders as a translucent tint rather than
blur. It now source-over composes those same tints in one plain View, retaining
the material appearance and sheen while removing unused native blur controllers
and extra layers from every button/card. Android edge effects now follow the
same approach instead of capturing live content.
