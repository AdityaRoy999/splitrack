import ExpoModulesCore
import UIKit

public final class GradualBlurModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SplittrackGradualBlur")

    View(GradualBlurView.self) {
      Prop("position") { (view, position: String) in view.position = position }
      Prop("falloff") { (view, falloff: [Double]) in view.falloff = falloff }
      Prop("locations") { (view, locations: [Double]) in view.locations = locations }
      Prop("intensity") { (view, intensity: Double) in view.intensity = intensity }
      Prop("dark") { (view, dark: Bool) in view.dark = dark }
      Prop("washColor") { (view, color: UIColor) in view.washColor = color }
      OnViewDidUpdateProps { (view: GradualBlurView) in view.updateAppearance() }
    }
  }
}
