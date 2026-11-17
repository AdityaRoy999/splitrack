import ExpoModulesCore
import UIKit

public final class GradualBlurModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SplittrackGradualBlur")

    View(GradualBlurView.self) {
      Prop("position") { (view, position: String) in view.position = position }
      Prop("stack") { (view, stack: [[String: Double]]) in view.stack = stack }
      Prop("falloff") { (view, falloff: [Double]) in view.falloff = falloff }
      Prop("locations") { (view, locations: [Double]) in view.locations = locations }
      Prop("opacity") { (view, opacity: Double) in view.maskOpacity = opacity }
      Prop("reveal") { (view, reveal: Double) in view.reveal = reveal }
      Prop("dark") { (view, dark: Bool) in view.dark = dark }
      Prop("washColor") { (view, color: UIColor) in view.washColor = color }
      OnViewDidUpdateProps { (view: GradualBlurView) in view.updateAppearance() }
    }
  }
}
