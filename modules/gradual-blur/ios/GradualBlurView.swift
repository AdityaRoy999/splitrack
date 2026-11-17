import ExpoModulesCore
import UIKit

final class GradualBlurView: ExpoView {
  var position = "bottom"
  var falloff: [Double] = [1, 0]
  var locations: [Double] = [0, 1]
  var intensity: Double = 45
  var dark = true
  var washColor = UIColor.clear

  private let blurView = EdgeBlurEffectView()
  private let fadeMask = BlurMaskView()
  private let washLayer = CAGradientLayer()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    clipsToBounds = true
    addSubview(blurView)
    layer.addSublayer(washLayer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    blurView.frame = bounds
    updateFade()
  }

  func updateAppearance() {
    blurView.configure(dark: dark, intensity: intensity / 100)
    updateFade()
  }

  private func updateFade() {
    let alphas = falloff.count >= 2 ? falloff.map { max(0, min(1, $0)) } : [1, 0]
    let stops: [NSNumber]? = locations.count == alphas.count ? locations.map { NSNumber(value: $0) } : nil
    let start: CGPoint
    let end: CGPoint
    switch position {
    case "top":
      start = CGPoint(x: 0.5, y: 0); end = CGPoint(x: 0.5, y: 1)
    case "left":
      start = CGPoint(x: 0, y: 0.5); end = CGPoint(x: 1, y: 0.5)
    case "right":
      start = CGPoint(x: 1, y: 0.5); end = CGPoint(x: 0, y: 0.5)
    default:
      start = CGPoint(x: 0.5, y: 1); end = CGPoint(x: 0.5, y: 0)
    }

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    fadeMask.frame = blurView.bounds
    fadeMask.gradient.colors = alphas.map { UIColor.black.withAlphaComponent(CGFloat($0)).cgColor }
    fadeMask.gradient.locations = stops
    fadeMask.gradient.startPoint = start
    fadeMask.gradient.endPoint = end
    washLayer.frame = bounds
    washLayer.colors = alphas.map { washColor.withAlphaComponent(washColor.cgColor.alpha * CGFloat($0)).cgColor }
    washLayer.locations = stops
    washLayer.startPoint = start
    washLayer.endPoint = end
    CATransaction.commit()

    // UIKit requires the mask on the effect view itself. It copies this mask,
    // so reassign it after geometry/stop changes rather than masking an ancestor.
    blurView.mask = nil
    blurView.mask = fadeMask
  }
}

private final class BlurMaskView: UIView {
  override class var layerClass: AnyClass { CAGradientLayer.self }
  var gradient: CAGradientLayer { layer as! CAGradientLayer }
}

private final class EdgeBlurEffectView: UIVisualEffectView {
  private var blurEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
  private var blurIntensity: Double = 0.45
  private var isDark = true
  private var animator: UIViewPropertyAnimator?

  init() {
    super.init(effect: nil)
    isUserInteractionEnabled = false
  }

  required init?(coder: NSCoder) { nil }

  deinit { animator?.stopAnimation(true) }

  func configure(dark: Bool, intensity: Double) {
    let value = max(0.01, min(1, intensity))
    guard dark != isDark || value != blurIntensity else { return }
    isDark = dark
    blurIntensity = value
    blurEffect = UIBlurEffect(style: dark ? .systemUltraThinMaterialDark : .systemUltraThinMaterialLight)
    setNeedsDisplay()
  }

  override func draw(_ rect: CGRect) {
    super.draw(rect)
    animator?.stopAnimation(true)
    effect = nil
    animator = UIViewPropertyAnimator(duration: 1, curve: .linear) { [unowned self] in
      self.effect = self.blurEffect
    }
    animator?.fractionComplete = CGFloat(blurIntensity)
  }
}
