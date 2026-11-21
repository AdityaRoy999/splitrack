Native progressive backdrop blur

The app uses Expo 58, React Native 0.88.1, Hermes, and Fabric. Native code is
generated through Expo Prebuild; platform-specific autolinking keeps only the
blur implementation used by each binary.

Android uses expo-backdrop 0.1.3. Its ProgressiveBlurView renders eight native
radius levels from a shared live capture, using RenderNode/RenderEffect on API
31+. It does not stack React Native uniform BlurViews. Older Android uses the
library's native CPU fallback. scripts/patch-expo-backdrop.mjs is a versioned,
idempotent postinstall fix: explicit transparent tint is honored, and app-owned
scene/scroll reveal replaces automatic discovery of retained inactive tabs.
The native capture is also skipped when clipped offscreen or hidden by an
ancestor's opacity. Android reveal animates only the finished backdrop's alpha;
the native radius stays fixed so eight RenderEffects are not rebuilt each frame.
Completely hidden edges use display:none and resume live capture on reveal.

iOS uses @sbaiahmed1/react-native-blur 6.0.3. Its variable-radius backdrop filter
avoids the custom UIKit blur stack. The library uses private CAFilter API; a
future iOS change can fall back to uniform blur, and App Store review can flag
that API. Android's implementation of this library is uniform masked blur, so it
is not linked into the APK. expo-backdrop's iOS implementation is also uniform
masked blur with ancestor mask/alpha issues, so it is not linked into the IPA.

Both paths sample the native backdrop rather than rerendering images in JS.
Android captures TextureView through getBitmap and SurfaceView through PixelCopy;
SurfaceView video can trail by one or two frames. This app has no video player
to exercise that path. No frame-rate or exact video synchronization guarantee is
made. Limit depth and the number of simultaneously visible effects.

SpotlightCard renders its image, bottom blur, then controls. The shared edge
wrapper leaves touch events to content. The browser retains React Bits through
GradualBlur.web.tsx. scripts/patch-ios-progressive-blur.mjs adds horizontal native
masks in the pinned iOS library without rotating its UIKit backdrop. The patch
also caches the mask/filter and updates only the radius during reveal animations,
so the material does not reset on every frame. iOS scroll viewports remain
transparent to sample their actual sheet surface; Android capture viewports use
the containing surface with alpha tints composited over it. Main screens keep
their progressive blur. SheetModal provides ModalVisualContext so progressive
blur is omitted and GlassSurface/GlassCard use solid matte surfaces throughout
modal content. QR/calendar backdrops use dimming without blur. Sheets retain
their content and backdrop through the exit animation.
Physical-device checks should cover those edges, light/dark themes, scrolling,
foreground return, and image highlight transitions.

Android performance note

The QmBlurView dependency draws its capture viewport into a software bitmap on
the Android UI thread before processing the eight progressive levels, even on
API 31+ where those levels use RenderEffect. Retained hidden screens therefore
must not keep capturing. Animated GL backgrounds also continuously invalidate
that viewport; their Android noise target now defaults to one pixel per point
instead of 1.5 (56% fewer shader fragments on high-density devices). These are
code-level workload reductions, not measured device frame-rate guarantees.
Android also measures card visibility at most four times a second on the UI
thread and suspends offscreen shader ticks. A 64-point overscan wakes the effect
before re-entry. Never-visible cards defer GL context/shader allocation; already
initialized contexts retain their last frame and phase while offscreen.

Android's ordinary GlassSurface previously mounted Expo BlurView without a
blurTarget or blurMethod, which SDK 58 renders as a translucent tint rather than
blur. It now source-over composes those same tints in one plain View, retaining
the material appearance and sheen while removing unused native blur controllers
and extra layers from every button/card. Live progressive edge blur is separate
and unchanged by this material optimization.
