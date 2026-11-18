import UIKit

// Status-bar edges use one material instead of compositing the menu's separate
// radius slices. UIKit materials also contain tint; stacking them can make a
// narrow screen edge read as an opaque strip rather than a continuous finish.
final class PageBlurEffectView: UIVisualEffectView {
  private let fadeMask = PageBlurMaskView()
  private var maskConfiguration: PageMaskConfiguration?
  private var animator: UIViewPropertyAnimator?
  private var materialIsDark: Bool?
  private var desiredFraction: CGFloat = 0

  init() {
    super.init(effect: nil)
    isUserInteractionEnabled = false
    backgroundColor = .clear
    NotificationCenter.default.addObserver(
      self, selector: #selector(transparencyPreferenceChanged),
      name: UIAccessibility.reduceTransparencyStatusDidChangeNotification, object: nil
    )
  }

  required init?(coder: NSCoder) { return nil }

  deinit {
    animator?.stopAnimation(true)
    NotificationCenter.default.removeObserver(self)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      resetAnimator()
    } else {
      applyIntensity()
    }
  }

  func configure(
    position: String, stack: [[String: Double]], falloff: [Double], locations: [Double],
    opacity: Double, reveal: Double, dark: Bool
  ) {
    if materialIsDark != dark {
      materialIsDark = dark
      resetAnimator()
    }
    // The shared stack records the cumulative radius at every level. Only its
    // final radius is needed by this single surface; menus retain their stack.
    let radius = stack.prefix(16).map { level -> Double in
      let value = level["level"] ?? level["radius"] ?? 0
      return value.isFinite ? max(0, value) : 0
    }.max() ?? 0
    let visible = pageUnit(reveal)
    desiredFraction = CGFloat(pageUnit(radius / 30) * visible)
    isHidden = desiredFraction <= 0.0001 || bounds.isEmpty || UIAccessibility.isReduceTransparencyEnabled
    updateMask(position: position, falloff: falloff, locations: locations, opacity: opacity, reveal: visible)
    applyIntensity()
  }

  private func resetAnimator() {
    animator?.stopAnimation(true)
    animator = nil
    effect = nil
  }

  private func applyIntensity() {
    guard window != nil else { return }
    guard !UIAccessibility.isReduceTransparencyEnabled else {
      isHidden = true
      return
    }
    if animator == nil {
      let dark = materialIsDark ?? true
      overrideUserInterfaceStyle = dark ? .dark : .light
      let material = UIBlurEffect(style: dark ? .systemUltraThinMaterialDark : .systemUltraThinMaterialLight)
      let nextAnimator = UIViewPropertyAnimator(duration: 1, curve: .linear) { [weak self] in
        self?.effect = material
      }
      nextAnimator.pausesOnCompletion = true
      nextAnimator.scrubsLinearly = true
      animator = nextAnimator
    }
    animator?.fractionComplete = desiredFraction
  }

  @objc private func transparencyPreferenceChanged() {
    isHidden = desiredFraction <= 0.0001 || bounds.isEmpty || UIAccessibility.isReduceTransparencyEnabled
    applyIntensity()
  }

  private func updateMask(position: String, falloff: [Double], locations: [Double], opacity: Double, reveal: Double) {
    let validStops = falloff.count >= 2 && falloff.count == locations.count
      && falloff.allSatisfy { $0.isFinite } && locations.allSatisfy { $0.isFinite }
      && zip(locations, locations.dropFirst()).allSatisfy { $0.0 < $0.1 }
      && locations.first == 0 && locations.last == 1
    var alphas = validStops ? falloff.map(pageUnit) : [0, pageUnit(opacity)]
    var stops = validStops ? locations : [0, 1]
    // Use screen coordinates explicitly. The status-bar end is y=0 and the
    // content end is y=1: strongest at the screen edge, clear toward content.
    if position == "top" || position == "left" {
      alphas.reverse()
      stops = stops.reversed().map { 1 - $0 }
    }
    alphas = alphas.map { $0 * reveal }
    let configuration = PageMaskConfiguration(bounds: bounds, position: position, alphas: alphas, locations: stops)
    guard configuration != maskConfiguration else { return }
    maskConfiguration = configuration
    fadeMask.frame = bounds
    fadeMask.gradient.colors = alphas.map { UIColor.black.withAlphaComponent(CGFloat($0)).cgColor }
    fadeMask.gradient.locations = stops.map { NSNumber(value: $0) }
    let horizontal = position == "left" || position == "right"
    fadeMask.gradient.startPoint = horizontal ? CGPoint(x: 0, y: 0.5) : CGPoint(x: 0.5, y: 0)
    fadeMask.gradient.endPoint = horizontal ? CGPoint(x: 1, y: 0.5) : CGPoint(x: 0.5, y: 1)
    // UIVisualEffectView copies a direct mask. Reset its copy after changing
    // stops/geometry. Neither the effect nor its ancestors receive alpha < 1.
    mask = nil
    mask = fadeMask
  }
}

private func pageUnit(_ value: Double) -> Double {
  value.isFinite ? max(0, min(1, value)) : 0
}

private struct PageMaskConfiguration: Equatable {
  let bounds: CGRect
  let position: String
  let alphas: [Double]
  let locations: [Double]
}

private final class PageBlurMaskView: UIView {
  override class var layerClass: AnyClass { CAGradientLayer.self }
  var gradient: CAGradientLayer { layer as! CAGradientLayer }
}
