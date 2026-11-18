package expo.modules.gradualblur

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.uimanager.BackgroundStyleApplicator
import eightbitlab.com.blurview.BlurTarget
import eightbitlab.com.blurview.BlurView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.roundToInt

/** Every layer samples the original-content target. Masks stay in the native
 * render pass, without stacking the tinted materials of Expo BlurView. */
class GradualBlurView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  var position = "bottom"
  var stack: List<Map<String, Double>> = emptyList()
  var maskOpacity = 1f
  var reveal = 1f
  var dark = true
  private var targetTag: Int? = null
  private var configuredTarget: BlurTarget? = null
  private var configuredBackground: Int? = null
  private val frameClearDrawable = ColorDrawable(Color.TRANSPARENT)
  private val surfaces = mutableListOf<MaskedBlurLayer>()

  init {
    isClickable = false
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    setBackgroundColor(Color.TRANSPARENT)
  }

  fun setTarget(tag: Int?) {
    if (targetTag == tag) return
    targetTag = tag
    configuredTarget = null
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    updateAppearance()
  }

  override fun onDetachedFromWindow() {
    surfaces.forEach { it.setActive(false) }
    super.onDetachedFromWindow()
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val w = MeasureSpec.getSize(widthMeasureSpec)
    val h = MeasureSpec.getSize(heightMeasureSpec)
    setMeasuredDimension(w, h)
    surfaces.forEach { it.measure(MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY)) }
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    surfaces.forEach { it.layout(0, 0, right - left, bottom - top) }
    updateAppearance()
  }

  fun updateAppearance() {
    // Older Androids remain transparent instead of using a slow screenshot
    // renderer or the painted-material fallback.
    if (Build.VERSION.SDK_INT < 31) return
    val levels = stack.take(16)
    if (surfaces.size != levels.size) {
      surfaces.forEach { it.setActive(false) }
      removeAllViews()
      surfaces.clear()
      levels.forEach {
        MaskedBlurLayer(context).also { surface ->
          surfaces.add(surface)
          addView(surface, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
          if (width > 0 && height > 0) {
            surface.measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
            surface.layout(0, 0, width, height)
          }
        }
      }
      configuredTarget = null
    }
    val target = targetTag?.let { tag ->
      // React may remove a target while its sibling blur finishes an exit.
      runCatching { appContext.findView<View>(tag) }.getOrNull()
    }?.let(::findTarget)
    if (target == null || !isAttachedToWindow || !isHardwareAccelerated) {
      surfaces.forEach { it.setActive(false) }
      return
    }
    if (configuredTarget !== target) {
      surfaces.forEach {
        it.blur.setupWith(target, 1f, false)
          .setFrameClearDrawable(frameClearDrawable)
          .setOverlayColor(Color.TRANSPARENT)
        it.resetConfiguration()
      }
      configuredTarget = target
      configuredBackground = null
    }
    // A theme change does not replace the target. Refresh the clear colour so
    // the old theme never becomes a dark/bright strip under transparent pixels.
    val clearColor = findBackgroundColor(target)
    frameClearDrawable.setBounds(0, 0, target.width, target.height)
    if (configuredBackground != clearColor) {
      // The facade installed this shared drawable during setup. Mutating its
      // colour updates every surface without rebuilding their controllers.
      frameClearDrawable.color = clearColor
      configuredBackground = clearColor
    }
    val amount = reveal.coerceIn(0f, 1f)
    surfaces.zip(levels).forEach { (surface, level) ->
      // Each layer samples the unblurred target, so use its cumulative radius.
      val radius = ((level["level"] ?: 0.0).toFloat() * resources.displayMetrics.density * amount).coerceIn(0f, 80f)
      val enabled = radius > 0.01f && maskOpacity > 0f
      surface.updateMask(position, (level["from"] ?: 0.0).toFloat(), (level["to"] ?: 1.0).toFloat(), maskOpacity)
      if (enabled) surface.setRadius(radius)
      surface.setActive(enabled)
    }
  }

  private fun findTarget(view: View): BlurTarget? {
    if (view is BlurTarget) return view
    val firstChild = (view as? ViewGroup)?.getChildAt(0)
    // Expo's public host proxies its children into the library's BlurTarget.
    // Following that child's actual parent avoids depending on Expo internals.
    return firstChild?.parent as? BlurTarget
  }

  private fun findBackgroundColor(target: View): Int {
    var current: View? = target
    while (current != null) {
      val color = BackgroundStyleApplicator.getBackgroundColor(current)
        ?: (current.background as? ColorDrawable)?.color
      if (color != null && Color.alpha(color) == 255) return color
      current = current.parent as? View
    }
    return if (dark) Color.BLACK else Color.WHITE
  }
}

private class MaskedBlurLayer(context: Context) : FrameLayout(context) {
  val blur = BlurView(context)
  private val maskPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
  }
  private var maskPosition = ""
  private var maskFrom = -1f
  private var maskTo = -1f
  private var maskAlpha = -1f
  private var maskWidth = -1
  private var maskHeight = -1
  private var active: Boolean? = null
  private var blurRadius = -1f

  init {
    isClickable = false
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    addView(blur, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun resetConfiguration() {
    active = null
    blurRadius = -1f
  }

  fun setRadius(radius: Float) {
    if (blurRadius == radius) return
    blurRadius = radius
    blur.setBlurRadius(radius)
  }

  fun setActive(enabled: Boolean) {
    if (active == enabled) return
    active = enabled
    // Call the view setters separately: facade chaining skips BlurView's own
    // auto-update flag, which it reads again when attached to a window.
    blur.setBlurAutoUpdate(enabled)
    blur.setBlurEnabled(enabled)
  }

  fun updateMask(position: String, from: Float, to: Float, opacity: Float) {
    if (width <= 0 || height <= 0) return
    if (maskPosition == position && maskFrom == from && maskTo == to && maskAlpha == opacity && maskWidth == width && maskHeight == height) return
    maskPosition = position; maskFrom = from; maskTo = to; maskAlpha = opacity; maskWidth = width; maskHeight = height
    val x0: Float; val y0: Float; val x1: Float; val y1: Float
    when (position) {
      "top" -> { x0 = 0f; y0 = height.toFloat(); x1 = 0f; y1 = 0f }
      "left" -> { x0 = width.toFloat(); y0 = 0f; x1 = 0f; y1 = 0f }
      "right" -> { x0 = 0f; y0 = 0f; x1 = width.toFloat(); y1 = 0f }
      else -> { x0 = 0f; y0 = 0f; x1 = 0f; y1 = height.toFloat() }
    }
    val alpha = (opacity.coerceIn(0f, 1f) * 255f).roundToInt()
    maskPaint.shader = LinearGradient(x0, y0, x1, y1,
      intArrayOf(Color.TRANSPARENT, Color.argb(alpha, 0, 0, 0)),
      floatArrayOf(from.coerceIn(0f, 1f), to.coerceIn(0f, 1f)), Shader.TileMode.CLAMP)
    invalidate()
  }

  override fun dispatchDraw(canvas: Canvas) {
    val save = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
    super.dispatchDraw(canvas)
    if (maskPaint.shader != null) canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), maskPaint)
    canvas.restoreToCount(save)
  }
}
