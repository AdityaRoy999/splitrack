# Local Expo module, discovered by Expo Autolinking.
Pod::Spec.new do |s|
  s.name = 'SplittrackGradualBlur'
  s.version = '1.0.0'
  s.summary = 'Native scroll edge blur for Splittrack'
  s.description = 'Applies a continuous alpha mask directly to a UIKit blur view.'
  s.license = { :type => 'MIT' }
  s.author = 'Splittrack'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '16.4' }
  # This local module is linked by its filesystem path, never fetched from source.
  s.source = { :git => 'https://github.com/expo/expo.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
end
