# React Bits Gradual Blur

`GradualBlur.tsx` is the unmodified TS/Tailwind component from [React Bits](https://www.reactbits.dev/animations/gradual-blur), pinned to upstream commit `d01aa914dcbe76da8b2923ebf872b5c8b1066e4c`.

Source: https://github.com/DavidHDev/react-bits/blob/d01aa914dcbe76da8b2923ebf872b5c8b1066e4c/src/ts-tailwind/Animations/GradualBlur/GradualBlur.tsx

The license is included in `LICENSE.md`. This component is used inside the Splittrack application.

Metro loads it through `src/components/effects/GradualBlur.web.tsx` only on web. CSS backdrop filters and DOM elements cannot execute in an iOS/Android native view. The native implementation uses the source's curves, layer masks and incremental Gaussian radii with platform blur surfaces. UIKit exposes blur intensity rather than a CSS pixel radius, so the native intensity is calibrated separately.
