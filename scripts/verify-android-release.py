"""Inspect release DEX without launching the app or touching device data."""
import hashlib
import json
import struct
import sys
import zipfile
from pathlib import Path


class Dex:
    def __init__(self, data):
        self.data = data
        if not data.startswith(b'dex\n'):
            raise ValueError('Not a DEX file')
        count, offset = struct.unpack_from('<II', data, 0x38)
        self.strings = []
        for index in range(count):
            start = self.u32(offset + index * 4)
            _, start = self.uleb(start)
            end = data.index(0, start)
            self.strings.append(data[start:end].decode('utf8', errors='replace'))
        count, offset = struct.unpack_from('<II', data, 0x40)
        self.types = [self.strings[self.u32(offset + i * 4)] for i in range(count)]
        count, offset = struct.unpack_from('<II', data, 0x48)
        self.protos = []
        for index in range(count):
            _, returns, params = struct.unpack_from('<III', data, offset + index * 12)
            parameters = [] if not params else [self.types[self.u16(params + 4 + i * 2)] for i in range(self.u32(params))]
            self.protos.append((parameters, self.types[returns]))
        count, offset = struct.unpack_from('<II', data, 0x58)
        self.method_ids = [struct.unpack_from('<HHI', data, offset + i * 8) for i in range(count)]
        count, offset = struct.unpack_from('<II', data, 0x60)
        self.classes = {}
        for index in range(count):
            cls, access, superclass, interfaces, source, annotations, class_data, values = struct.unpack_from('<8I', data, offset + index * 32)
            methods = []
            if class_data:
                cursor = class_data
                sizes = []
                for _ in range(4):
                    size, cursor = self.uleb(cursor)
                    sizes.append(size)
                for _ in range(sizes[0] + sizes[1]):
                    _, cursor = self.uleb(cursor)
                    _, cursor = self.uleb(cursor)
                for group in sizes[2:]:
                    method_index = 0
                    for _ in range(group):
                        diff, cursor = self.uleb(cursor)
                        method_index += diff
                        flags, cursor = self.uleb(cursor)
                        code, cursor = self.uleb(cursor)
                        owner, proto, name = self.method_ids[method_index]
                        parameters, returns = self.protos[proto]
                        methods.append({'name': self.strings[name], 'public': bool(flags & 1), 'static': bool(flags & 8), 'native': bool(flags & 0x100), 'parameters': parameters, 'returns': returns, 'code': bool(code)})
            self.classes[self.types[cls]] = {'superclass': None if superclass == 0xffffffff else self.types[superclass], 'methods': methods}

    def u16(self, offset):
        return struct.unpack_from('<H', self.data, offset)[0]

    def u32(self, offset):
        return struct.unpack_from('<I', self.data, offset)[0]

    def uleb(self, offset):
        result = 0
        shift = 0
        while True:
            value = self.data[offset]
            offset += 1
            result |= (value & 127) << shift
            if not value & 128:
                return result, offset
            shift += 7


package = Path(sys.argv[1])
classes = {}
all_strings = set()
with zipfile.ZipFile(package) as archive:
    for name in archive.namelist():
        if name.startswith('classes') and name.endswith('.dex') and '/' not in name:
            dex = Dex(archive.read(name))
            for class_name, value in dex.classes.items():
                classes[class_name] = dict(value, dex=name)
            all_strings.update(dex.strings)
    bundle_present = 'assets/index.android.bundle' in archive.namelist()

gl = classes.get('Lexpo/modules/gl/GLView;')
if not gl:
    raise RuntimeError('GLView release class missing or renamed')
context = classes.get('Lexpo/modules/gl/GLContext;')
if not context or not any(method['name'] == 'flush' and method['public'] and not method['static'] and method['parameters'] == [] and method['returns'] == 'V' and method['code'] for method in context['methods']):
    raise RuntimeError('GLContext public instance flush()V JNI callback was stripped or renamed')
exgl = classes.get('Lexpo/modules/gl/cpp/EXGL;')
expected_bindings = {
    'EXGLContextCreate': ([], 'I'),
    'EXGLInstallWebGLBindings': (['J'], 'V'),
    'EXGLContextPrepare': (['J', 'I', 'Ljava/lang/Object;'], 'V'),
    'EXGLContextPrepareWorklet': (['I'], 'V'),
    'EXGLContextDestroy': (['I'], 'V'),
    'EXGLContextFlush': (['I'], 'V'),
    'EXGLContextCreateObject': (['I'], 'I'),
    'EXGLContextDestroyObject': (['I', 'I'], 'V'),
    'EXGLContextMapObject': (['I', 'I', 'I'], 'V'),
    'EXGLContextGetObject': (['I', 'I'], 'I'),
    'EXGLContextNeedsRedraw': (['I'], 'Z'),
    'EXGLContextDrawEnded': (['I'], 'V'),
}
if not exgl:
    raise RuntimeError('EXGL JNI binding class was renamed or stripped')
for name, (parameters, returns) in expected_bindings.items():
    if not any(method['name'] == name and method['public'] and method['static'] and method['native'] and method['parameters'] == parameters and method['returns'] == returns for method in exgl['methods']):
        raise RuntimeError(f'EXGL native binding {name} was renamed or stripped')
blur = classes.get('Lexpo/modules/blur/ExpoBlurView;')
target = classes.get('Lexpo/modules/blur/ExpoBlurTargetView;')
if not blur or not target:
    raise RuntimeError('Expo blur/target native views missing')
constructor = lambda cls: [method for method in cls['methods'] if method['name'] == '<init>' and method['public'] and len(method['parameters']) == 2 and method['parameters'][0] == 'Landroid/content/Context;']
blur_constructors = constructor(blur)
if len(blur_constructors) != 1:
    raise RuntimeError('Expected one ExpoBlurView Context/AppContext constructor')
expected_parameters = blur_constructors[0]['parameters']
gl_constructors = [method for method in constructor(gl) if method['parameters'] == expected_parameters and method['code']]
if len(gl_constructors) != 1:
    raise RuntimeError('GLView reflective public Context/AppContext constructor was stripped')
callbacks = {'onSurfaceTextureAvailable', 'onSurfaceTextureSizeChanged', 'onSurfaceTextureDestroyed', 'onSurfaceTextureUpdated'}
if not callbacks.issubset({method['name'] for method in gl['methods'] if method['public'] and method['code']}):
    raise RuntimeError('GLView surface callbacks missing')
if not constructor(target):
    raise RuntimeError('ExpoBlurTargetView constructor missing')
if 'RNCMaskedView' not in all_strings:
    raise RuntimeError('New Android masked-view component missing')
if 'Lexpo/modules/gradualblur/GradualBlurView;' in classes:
    raise RuntimeError('Replaced Android gradual blur implementation still packaged')
if 'RNGoogleSignin' not in all_strings:
    raise RuntimeError('Google native module missing')
if not bundle_present:
    raise RuntimeError('Hermes JS bundle missing')
with package.open('rb') as stream:
    sha256 = hashlib.file_digest(stream, 'sha256').hexdigest()
print(json.dumps({'glClassPreserved': True, 'glReflectiveConstructorPreserved': True, 'glContextFlushJniCallbackPreserved': True, 'exglNativeBindingsPreserved': True, 'constructorParameters': expected_parameters, 'glSurfaceCallbacksPreserved': True, 'expoBlurViewPreserved': True, 'expoBlurTargetViewPreserved': True, 'androidGradientMaskPackaged': True, 'oldAndroidGradualBlurRemoved': True, 'nativeGoogleModule': True, 'jsBundlePresent': True, 'bytes': package.stat().st_size, 'sha256': sha256}, indent=2))
