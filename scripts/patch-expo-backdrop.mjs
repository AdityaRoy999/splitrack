import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageRoot = join(projectRoot, 'node_modules', 'expo-backdrop');
const { version } = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
if (version !== '0.1.3') {
  throw new Error(`expo-backdrop patch requires version 0.1.3; found ${version}. Review the native source before upgrading.`);
}

const nativeDirectory = join(packageRoot, 'android', 'src', 'main', 'java', 'expo', 'modules', 'blurview', 'views');
function loadSource(name) {
  const path = join(nativeDirectory, name);
  const original = readFileSync(path, 'utf8');
  return {
    path, source: original.replace(/\r\n/g, '\n'),
    lineEnding: original.includes('\r\n') ? '\r\n' : '\n', changed: false,
  };
}
const viewFile = loadSource('ProgressiveBlurView.kt');
const layerFile = loadSource('ProgressiveBlurLayer.kt');
let target = viewFile;

function patchOnce(label, before, after) {
  const oldCount = target.source.split(before).length - 1;
  const newCount = target.source.split(after).length - 1;
  const embeddedOriginalCount = after.split(before).length - 1;
  if (oldCount === embeddedOriginalCount && newCount === 1) return;
  if (oldCount !== 1 || newCount !== 0) {
    throw new Error(`expo-backdrop ${label} patch did not match the expected 0.1.3 source. Refusing a partial patch.`);
  }
  target.source = target.source.replace(before, after);
  target.changed = true;
}

// Upstream treats an explicit transparent color as "no custom color" and
// substitutes a material wash. Preserve transparent so it actually disables it.
patchOnce(
  'transparent tint',
  '    blurLayer.washColor = if (Color.alpha(wash) > 0) wash else tint.toOverlayColor(intensity)',
  '    // Splittrack: honor an explicitly transparent tintColor.\n    blurLayer.washColor = wash',
);

// Splittrack controls edge visibility from its active scene and scroll offset.
// Native automatic discovery can retain an inactive, still-mounted tab, causing
// its old scroll position to override the visible scene's blur.
patchOnce(
  'scroll ownership',
  `  private fun findScrollViewBehind(): ViewGroup? {
    val frame = rectInWindow(this)
    var child: View = this
    var container = child.parent as? ViewGroup

    while (container != null) {
      val index = container.indexOfChild(child)
      for (i in index - 1 downTo 0) {
        scrollView(container.getChildAt(i), frame)?.let { return it }
      }
      child = container
      container = container.parent as? ViewGroup
    }
    return null
  }`,
  `  private fun findScrollViewBehind(): ViewGroup? {
    // Splittrack: the app owns scroll-edge reveal; do not observe retained tabs.
    return null
  }`,
);

// The app owns scroll visibility and the patched lookup above always returns
// null. Retained edges no longer need upstream's per-view 500 ms discovery poll.
patchOnce(
  'unused scroll polling',
  '    mainHandler.postDelayed(scrollViewCheck, SCROLL_VIEW_CHECK_INTERVAL_MS)\n  }\n\n  override fun onDetachedFromWindow()',
  '    // Splittrack: no discovery timer when scroll ownership belongs to JS.\n  }\n\n  override fun onDetachedFromWindow()',
);

// QmBlurView defaults to capturing the entire activity decor. The native view
// is a direct child of GradualBlur's non-collapsible edge wrapper, whose parent
// is the media/scroll viewport. Scope its normal software capture there so later
// caption siblings outside that viewport are not sampled as part of the image.
// QmBlurView's error-recovery PixelCopy path remains a window capture.
patchOnce(
  'capture attachment',
  `    addView(blurLayer, 0)
    fallbackGradient.visibility = INVISIBLE`,
  `    addView(blurLayer, 0)
    // Splittrack: QmBlurView sets its decor source during child attachment.
    blurLayer.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
      override fun onViewAttachedToWindow(view: View) { scopeBackdropCapture() }
      override fun onViewDetachedFromWindow(view: View) { }
    })
    fallbackGradient.visibility = INVISIBLE`,
);

patchOnce(
  'capture viewport',
  `    fallbackGradient.layoutExactly(0, 0, r - l, b - t)
    updateGradients()`,
  `    fallbackGradient.layoutExactly(0, 0, r - l, b - t)
    scopeBackdropCapture()
    updateGradients()`,
);

patchOnce(
  'capture observer',
  '  private fun applyIntensity() {',
  `  // Splittrack: all observer moves happen on the UI thread. QmBlurView's
  // existing detachment lifecycle removes the listener from this scoped source.
  private fun scopeBackdropCapture() {
    if (!blurLayer.isAttachedToWindow) return
    val viewport = (parent as? View)?.parent as? View ?: return
    val nextObserver = viewport.viewTreeObserver
    if (!nextObserver.isAlive || blurLayer.mDecorView === viewport) return
    val previousObserver = blurLayer.mDecorView?.viewTreeObserver
    if (previousObserver?.isAlive == true) {
      previousObserver.removeOnPreDrawListener(blurLayer.preDrawListener)
    }
    blurLayer.mDecorView = viewport
    blurLayer.mDifferentRoot = viewport.rootView !== blurLayer.rootView
    nextObserver.addOnPreDrawListener(blurLayer.preDrawListener)
    blurLayer.postInvalidateOnAnimation()
  }

  private fun applyIntensity() {`,
);

// Qm's asynchronous window PixelCopy callback can arrive after detach/resize
// released its bitmap fields. Accept Java's nullable platform arguments and
// reject stale captures before accessing input.width or invoking native blur.
target = layerFile;
// Qm 1.3.0's pre-draw listener only tests isShown(), which stays true for cards
// scrolled outside the clipped viewport and retained translated scenes. Skip
// their software capture and eight blur passes before prepare allocates/draws.
// Keep the last bitmap so the normal capture refreshes it upon re-entry.
if (!target.source.includes('  private val captureVisibleRect = Rect()')) patchOnce(
  'offscreen capture culling',
  '  override fun blur(input: Bitmap',
  `  private val captureVisibleRect = Rect()

  override fun prepare(): Boolean {
    if (!getGlobalVisibleRect(captureVisibleRect) || captureVisibleRect.isEmpty) return false
    return super.prepare()
  }

  override fun blur(input: Bitmap`,
);

// getGlobalVisibleRect ignores opacity: a retained tab or a fully faded edge can
// remain globally laid out while invisible. Do not rasterize its whole viewport
// or generate the eight blur levels until all its ancestors are visible again.
patchOnce(
  'transparent ancestor capture culling',
  `    if (!getGlobalVisibleRect(captureVisibleRect) || captureVisibleRect.isEmpty) return false
    return super.prepare()`,
  `    if (!getGlobalVisibleRect(captureVisibleRect) || captureVisibleRect.isEmpty) return false
    var ancestor: View? = this
    while (ancestor != null) {
      if (ancestor.visibility != View.VISIBLE || ancestor.alpha <= 0.001f) return false
      ancestor = ancestor.parent as? View
    }
    return super.prepare()`,
);

patchOnce(
  'capture visibility import',
  'import android.os.Build',
  'import android.os.Build\nimport android.view.View',
);

patchOnce(
  'late capture lifecycle',
  `  override fun blur(input: Bitmap, output: Bitmap) {
    if (width == 0 || height == 0) return`,
  `  override fun blur(input: Bitmap?, output: Bitmap?) {
    // Splittrack: discard late PixelCopy after teardown or bitmap recycling.
    if (!isAttachedToWindow || input == null || output == null || input.isRecycled || output.isRecycled) return
    if (width == 0 || height == 0) return`,
);

// Validate every replacement before writing so an upstream source mismatch
// never leaves only part of the fixes applied during npm ci / cloud builds.
const changedFiles = [viewFile, layerFile].filter(file => file.changed);
for (const file of changedFiles) {
  writeFileSync(file.path, file.source.replace(/\n/g, file.lineEnding));
}
console.log(`expo-backdrop 0.1.3 Android fixes ${changedFiles.length ? 'applied' : 'already applied'}.`);
