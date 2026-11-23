import ExpoModulesCore
import UIKit

public final class SplittrackControlsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SplittrackControls")
    View(SplittrackSelectionView.self) {
      Events("onSelectionChange")
      Prop("labels") { (view: SplittrackSelectionView, labels: [String]) in view.setLabels(labels) }
      Prop("selection") { (view: SplittrackSelectionView, selection: Int) in view.setSelection(selection) }
      Prop("disabled") { (view: SplittrackSelectionView, disabled: Bool) in view.control.isEnabled = !disabled }
      Prop("disabledIndices") { (view: SplittrackSelectionView, indices: [Int]) in view.setDisabledIndices(indices) }
      Prop("colorScheme") { (view: SplittrackSelectionView, scheme: String) in view.overrideUserInterfaceStyle = scheme == "dark" ? .dark : .light }
    }
  }
}

// UIKit owns the Liquid Glass thumb and its touch tracking. React Native
// draws the original Solar icons above this control without intercepting taps.
public final class SplittrackSelectionView: ExpoView {
  let control = UISegmentedControl(items: [])
  let onSelectionChange = EventDispatcher()
  private var labels: [String] = []
  private var disabledIndices: [Int] = []
  private var selectedIndex = -1

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    control.setTitleTextAttributes([.foregroundColor: UIColor.clear], for: .normal)
    control.setTitleTextAttributes([.foregroundColor: UIColor.clear], for: .selected)
    control.setTitleTextAttributes([.foregroundColor: UIColor.clear], for: .disabled)
    control.addTarget(self, action: #selector(changed), for: .valueChanged)
    addSubview(control)
  }

  func setLabels(_ next: [String]) {
    guard labels != next else { return }
    labels = next
    control.removeAllSegments()
    for (index, label) in labels.enumerated() { control.insertSegment(withTitle: label, at: index, animated: false) }
    setSelection(selectedIndex)
    setDisabledIndices(disabledIndices)
  }

  func setSelection(_ index: Int) {
    selectedIndex = index
    control.selectedSegmentIndex = index >= 0 && index < control.numberOfSegments ? index : UISegmentedControl.noSegment
  }

  func setDisabledIndices(_ indices: [Int]) {
    disabledIndices = indices
    for index in 0..<control.numberOfSegments { control.setEnabled(!indices.contains(index), forSegmentAt: index) }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    control.frame = bounds
    if control.numberOfSegments > 0 {
      for index in 0..<control.numberOfSegments { control.setWidth(bounds.width / CGFloat(control.numberOfSegments), forSegmentAt: index) }
    }
  }

  @objc private func changed() {
    selectedIndex = control.selectedSegmentIndex
    onSelectionChange(["index": selectedIndex])
  }
}
