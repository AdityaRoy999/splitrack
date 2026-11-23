Pod::Spec.new do |s|
  s.name = 'SplittrackControls'
  s.version = '1.0.0'
  s.summary = 'Native iOS sliding selection for Splittrack'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Splittrack'
  s.homepage = 'https://github.com/AdityaRoy999/splitrack'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => s.homepage }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
