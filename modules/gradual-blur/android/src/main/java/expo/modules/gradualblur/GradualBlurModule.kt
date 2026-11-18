package expo.modules.gradualblur

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GradualBlurModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SplittrackGradualBlur")
    View(GradualBlurView::class) {
      Prop("position") { view: GradualBlurView, position: String -> view.position = position }
      Prop("stack") { view: GradualBlurView, stack: List<Map<String, Double>> -> view.stack = stack }
      Prop("opacity") { view: GradualBlurView, opacity: Float -> view.maskOpacity = opacity }
      Prop("reveal") { view: GradualBlurView, reveal: Float -> view.reveal = reveal }
      Prop("dark") { view: GradualBlurView, dark: Boolean -> view.dark = dark }
      Prop("blurTargetId") { view: GradualBlurView, tag: Int? -> view.setTarget(tag) }
      OnViewDidUpdateProps { view: GradualBlurView -> view.updateAppearance() }
    }
  }
}
