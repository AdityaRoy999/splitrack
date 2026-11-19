import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const library = join(root, 'node_modules', '@sbaiahmed1', 'react-native-blur');
const { version } = JSON.parse(readFileSync(join(library, 'package.json'), 'utf8'));
if (version !== '6.0.3') throw new Error(`Review the iOS progressive blur patch before upgrading ${version}.`);
const files = new Map();
function patch(file, before, after) {
  const entry = files.get(file) ?? { path: join(library, file), source: readFileSync(join(library, file), 'utf8').replace(/\r\n/g, '\n'), changed: false };
  files.set(file, entry);
  if (entry.source.includes(after)) return;
  if (entry.source.split(before).length !== 2) throw new Error(`Native blur patch does not match 6.0.3: ${file}. No files were written.`);
  entry.source = entry.source.replace(before, after); entry.changed = true;
}

for (const file of ['src/ReactNativeProgressiveBlurViewNativeComponent.ts', 'lib/typescript/src/ReactNativeProgressiveBlurViewNativeComponent.d.ts']) {
  patch(file, "| 'blurredCenterClearTopAndBottom'", "| 'blurredCenterClearTopAndBottom'\n  | 'blurredLeftClearRight'\n  | 'blurredRightClearLeft'");
}
const swift = 'ios/Views/VariableBlurView.swift';
patch(swift, '  case blurredCenterClearTopAndBottom', '  case blurredCenterClearTopAndBottom\n  case blurredLeftClearRight\n  case blurredRightClearLeft');
patch(swift, '    case "blurredcentercleartopandbottom", "center":', '    case "blurredleftclearright", "left":\n      self = .blurredLeftClearRight\n    case "blurredrightclearleft", "right":\n      self = .blurredRightClearLeft\n    case "blurredcentercleartopandbottom", "center":');
patch(swift, '  private var startOffset: CGFloat = 0\n', '  private var startOffset: CGFloat = 0\n  private var currentBlurStyle: UIBlurEffect.Style = .regular\n  private var variableBlurFilter: NSObject?\n  private var cachedMask: CGImage?\n');
patch(swift, '    self.startOffset = startOffset\n\n    super.init', '    self.startOffset = startOffset\n    self.currentBlurStyle = blurStyle\n\n    super.init');
patch(swift, `    self.maxBlurRadius = maxBlurRadius
    self.direction = direction
    self.startOffset = startOffset
    self.effect = UIBlurEffect(style: blurStyle)

    setupVariableBlur()`, `    let maskChanged = self.direction != direction || self.startOffset != startOffset
    let styleChanged = currentBlurStyle != blurStyle
    self.maxBlurRadius = maxBlurRadius
    self.direction = direction
    self.startOffset = startOffset
    if maskChanged { cachedMask = nil }
    if styleChanged {
      currentBlurStyle = blurStyle
      self.effect = UIBlurEffect(style: blurStyle)
    }
    // Changing only radius must not rebuild UIKit's material on every frame.
    if maskChanged || styleChanged || variableBlurFilter == nil {
      setupVariableBlur()
    } else {
      variableBlurFilter?.setValue(maxBlurRadius, forKey: "inputRadius")
    }`);
patch(swift, `    let gradientImage = makeGradientImage(
      startOffset: startOffset,
      direction: direction
    )`, `    let gradientImage = cachedMask ?? makeGradientImage(
      startOffset: startOffset,
      direction: direction
    )
    cachedMask = gradientImage
    variableBlurFilter = variableBlur`);
patch(swift, '    case .blurredTopClearBottom, .blurredBottomClearTop:', '    case .blurredTopClearBottom, .blurredBottomClearTop, .blurredLeftClearRight, .blurredRightClearLeft:');
patch(swift, '    if case .blurredBottomClearTop = direction {', '    if direction == .blurredBottomClearTop || direction == .blurredLeftClearRight {');
patch(swift, `    context.drawLinearGradient(
      gradient,
      start: CGPoint(x: 0, y: 0),
      end: CGPoint(x: 0, y: height),
      options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
    )

    return context.makeImage() ?? makeFallbackMask(width: width, height: height)
  }

  private func makeCenterGradientImage`, `    // A horizontal mask leaves the effect's backdrop in window coordinates.
    let horizontal = direction == .blurredLeftClearRight || direction == .blurredRightClearLeft
    context.drawLinearGradient(
      gradient,
      start: CGPoint(x: 0, y: 0),
      end: CGPoint(x: horizontal ? width : 0, y: horizontal ? 0 : height),
      options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
    )

    return context.makeImage() ?? makeFallbackMask(width: width, height: height)
  }

  private func makeCenterGradientImage`);

for (const file of files.values()) if (file.changed) writeFileSync(file.path, file.source);
console.log('iOS progressive blur 6.0.3: horizontal masks and stable radius animation applied.');
