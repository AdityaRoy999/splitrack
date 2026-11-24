"""Verify the packaged IPA directly, without a shell listing pipeline."""
import argparse
import plistlib
import re
import sys
import zipfile


def verify_ipa(path, bundle_id, version, build_number):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        plists = [name for name in names if re.fullmatch(r"Payload/[^/]+\.app/Info\.plist", name)]
        if len(plists) != 1:
            raise ValueError("Invalid IPA layout: expected exactly one Payload/*.app/Info.plist")
        metadata = plistlib.loads(archive.read(plists[0]))
        if not isinstance(metadata, dict):
            raise ValueError("Invalid IPA metadata: Info.plist must contain a dictionary")
        for key, expected in {
            "CFBundleIdentifier": bundle_id,
            "CFBundleShortVersionString": version,
            "CFBundleVersion": build_number,
        }.items():
            actual = metadata.get(key)
            if actual != expected:
                raise ValueError(f"IPA metadata mismatch: {key} expected {expected}, got {actual}")
        executable = metadata.get("CFBundleExecutable")
        if not isinstance(executable, str) or not executable or "/" in executable or executable in (".", ".."):
            raise ValueError("Invalid IPA metadata: missing or invalid CFBundleExecutable")
        executable_path = plists[0].removesuffix("Info.plist") + executable
        if executable_path not in names or archive.getinfo(executable_path).file_size == 0:
            raise ValueError(f"Invalid IPA layout: missing app executable {executable_path}")
        corrupt = archive.testzip()
        if corrupt:
            raise ValueError(f"Invalid IPA archive: corrupt entry {corrupt}")
    return f"Verified packaged IPA -> bundleId={bundle_id} version={version} build={build_number}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ipa")
    parser.add_argument("--bundle-id", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--build-number", required=True)
    args = parser.parse_args()
    try:
        print(verify_ipa(args.ipa, args.bundle_id, args.version, args.build_number))
    except (OSError, ValueError, plistlib.InvalidFileException, zipfile.BadZipFile, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
