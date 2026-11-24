"""Exercise the IPA verifier using real ZIP archives and binary Apple plists."""
import importlib.util
import plistlib
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

script = Path(__file__).with_name("verify-ios-release.py")
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("verify_ios_release", script)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)
EXPECTED = {"CFBundleIdentifier": "com.AdiSai.fintrack", "CFBundleShortVersionString": "1.0.5801", "CFBundleVersion": "5801", "CFBundleExecutable": "Splittrack"}
PLIST = "Payload/Splittrack.app/Info.plist"
EXECUTABLE = "Payload/Splittrack.app/Splittrack"


class IpaVerification(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.ipa = Path(self.directory.name) / "Splittrack.ipa"

    def create(self, metadata=None, plist=PLIST, executable=EXECUTABLE, extra=0):
        with zipfile.ZipFile(self.ipa, "w", zipfile.ZIP_DEFLATED) as archive:
            if plist:
                archive.writestr(plist, plistlib.dumps(metadata or EXPECTED, fmt=plistlib.FMT_BINARY))
            if executable:
                archive.writestr(executable, b"synthetic executable")
            for index in range(extra):
                archive.writestr(f"Payload/Splittrack.app/assets/asset-{index:05}.bin", b"asset")

    def verify(self):
        return verifier.verify_ipa(self.ipa, "com.AdiSai.fintrack", "1.0.5801", "5801")

    def test_large_valid_archive_with_early_plist_passes(self):
        self.create(extra=12000)
        result = subprocess.run([sys.executable, str(script), str(self.ipa), "--bundle-id", "com.AdiSai.fintrack", "--version", "1.0.5801", "--build-number", "5801"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Verified packaged IPA", result.stdout)

    def test_missing_or_nested_plist_fails(self):
        for plist in (None, "Payload/Splittrack.app/Frameworks/Other.app/Info.plist"):
            with self.subTest(plist=plist):
                self.create(plist=plist)
                with self.assertRaisesRegex(ValueError, "Invalid IPA layout"):
                    self.verify()

    def test_multiple_main_apps_fail(self):
        self.create()
        with zipfile.ZipFile(self.ipa, "a") as archive:
            archive.writestr("Payload/Other.app/Info.plist", plistlib.dumps(EXPECTED))
        with self.assertRaisesRegex(ValueError, "exactly one"):
            self.verify()

    def test_packaged_metadata_must_match_approved_build(self):
        for key in ("CFBundleIdentifier", "CFBundleShortVersionString", "CFBundleVersion"):
            with self.subTest(key=key):
                self.create(metadata={**EXPECTED, key: "wrong"})
                with self.assertRaisesRegex(ValueError, key):
                    self.verify()

    def test_missing_executable_fails(self):
        self.create(executable=None)
        with self.assertRaisesRegex(ValueError, "missing app executable"):
            self.verify()

    def test_malformed_archive_or_plist_fails(self):
        self.ipa.write_bytes(b"not a ZIP")
        with self.assertRaises(zipfile.BadZipFile):
            self.verify()
        with zipfile.ZipFile(self.ipa, "w") as archive:
            archive.writestr(PLIST, b"not a plist")
        with self.assertRaises(plistlib.InvalidFileException):
            self.verify()


if __name__ == "__main__":
    unittest.main()
