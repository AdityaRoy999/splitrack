import ExpoModulesCore
import UIKit

final class GradualBlurView: ExpoView {
  var position = "bottom"
  var stack: [[String: Double]] = []
  var falloff: [Double] = [0, 1]
  var locations: [Double] = [0, 1]
  var maskOpacity: Double = 1
  var reveal: Double = 1
  var dark = true
  var washColor = UIColor.clear

  private var surfaces: [EdgeBlurEffectView] = []
  private let washLayer = CAGradientLayer()
  private var washConfiguration: WashConfiguration?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    backgroundColor = .clear
    clipsToBounds = true
    layer.addSublayer(washLayer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    updateAppearance()
  }

  func updateAppearance() {
    let levels = Array(stack.prefix(16))
    if surfaces.count != levels.count {
      surfaces.forEach { $0.removeFromSuperview() }
      surfaces = levels.map { _ in EdgeBlurEffectView() }
      surfaces.forEach { addSubview($0) }
      washLayer.removeFromSuperlayer()
      layer.addSublayer(washLayer)
    }

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for (surface, level) in zip(surfaces, levels) {
      surface.frame = bounds
      surface.configure(
        radius: max(0, level["radius"] ?? 0) * max(0, min(1, reveal)),
        dark: dark
      )
      surface.updateMask(
        position: position, from: level["from"] ?? 0,
        to: level["to"] ?? 1, opacity: maskOpacity
      )
    }
    updateWash()
    CATransaction.commit()
  }

  private func updateWash() {
    washLayer.isHidden = washColor.cgColor.alpha == 0 || reveal <= 0
    washLayer.opacity = Float(max(0, min(1, reveal)))
    let configuration = WashConfiguration(bounds: bounds, position: position, falloff: falloff, locations: locations, color: washColor)
    guard configuration != washConfiguration else { return }
    washConfiguration = configuration
    let alphas = falloff.count >= 2 ? falloff.map { max(0, min(1, $0)) } : [0, 1]
    let axis = gradientAxis(position)
    washLayer.frame = bounds
    washLayer.colors = alphas.map { washColor.withAlphaComponent(washColor.cgColor.alpha * CGFloat($0)).cgColor }
    washLayer.locations = locations.count == alphas.count ? locations.map { NSNumber(value: $0) } : nil
    washLayer.startPoint = axis.start
    washLayer.endPoint = axis.end
  }
}

private struct WashConfiguration: Equatable {
  let bounds: CGRect
  let position: String
  let falloff: [Double]
  let locations: [Double]
  let color: UIColor
}

private struct MaskConfiguration: Equatable {
  let bounds: CGRect
  let position: String
  let from: Double
  let to: Double
  let opacity: Double
}

private func gradientAxis(_ position: String) -> (start: CGPoint, end: CGPoint) {
  switch position {
  case "top": return (CGPoint(x: 0.5, y: 1), CGPoint(x: 0.5, y: 0))
  case "left": return (CGPoint(x: 1, y: 0.5), CGPoint(x: 0, y: 0.5))
  case "right": return (CGPoint(x: 0, y: 0.5), CGPoint(x: 1, y: 0.5))
  default: return (CGPoint(x: 0.5, y: 0), CGPoint(x: 0.5, y: 1))
  }
}

private final class BlurMaskView: UIView {
  override class var layerClass: AnyClass { CAGradientLayer.self }
  var gradient: CAGradientLayer { layer as! CAGradientLayer }
}

private final class EdgeBlurEffectView: UIVisualEffectView {
  private let fadeMask = BlurMaskView()
  private var maskConfiguration: MaskConfiguration?
  private var desiredFraction: CGFloat = 0
  private var desiredDark = true
  private var appliedDark: Bool?
  private var animator: UIViewPropertyAnimator?

  init() {
    super.init(effect: nil)
    isUserInteractionEnabled = false
    backgroundColor = .clear
  }

  required init?(coder: NSCoder) { return nil }

  deinit { animator?.stopAnimation(true) }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      animator?.stopAnimation(true)
      animator = nil
      effect = nil
      appliedDark = nil
    } else {
      applyIntensity()
    }
  }

  func configure(radius: Double, dark: Bool) {
    // UIKit exposes effect intensity rather than CSS pixel radii. The stack's
    // incremental radii still control the progression; keep the material light.
    let fraction = CGFloat(max(0, min(1, radius / 30)))
    isHidden = fraction <= 0.0001
    guard fraction != desiredFraction || dark != desiredDark || animator == nil else { return }
    desiredFraction = fraction
    desiredDark = dark
    applyIntensity()
  }

  private func applyIntensity() {
    guard window != nil else { return }
    if animator == nil || appliedDark != desiredDark {
      animator?.stopAnimation(true)
      effect = nil
      overrideUserInterfaceStyle = desiredDark ? .dark : .light
      let blurEffect = UIBlurEffect(style: .regular)
      let nextAnimator = UIViewPropertyAnimator(duration: 1, curve: .linear) { [weak self] in
        self?.effect = blurEffect
      }
      nextAnimator.pausesOnCompletion = true
      animator = nextAnimator
      appliedDark = desiredDark
    }
    // Reuse the animator. Recreating it in draw/layout resets the backdrop and
    // causes flicker; UI-thread reveal updates only change this fraction.
    animator?.fractionComplete = desiredFraction
  }

  func updateMask(position: String, from: Double, to: Double, opacity: Double) {
    let configuration = MaskConfiguration(bounds: bounds, position: position, from: from, to: to, opacity: opacity)
    guard configuration != maskConfiguration else { return }
    maskConfiguration = configuration
    let axis = gradientAxis(position)
    fadeMask.frame = bounds
    fadeMask.gradient.colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(CGFloat(max(0, min(1, opacity)))).cgColor]
    fadeMask.gradient.locations = [NSNumber(value: max(0, min(1, from))), NSNumber(value: max(0, min(1, to)))]
    fadeMask.gradient.startPoint = axis.start
    fadeMask.gradient.endPoint = axis.end
    // UIKit copies masks. Apply them to each effect view, never to an ancestor,
    // and only reset the copy when geometry or stops actually change.
    mask = nil
    mask = fadeMask
  }
}
