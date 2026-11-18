#!/usr/bin/env python3
"""Prepares the generated Android project for a Play release (D-172).

Sets versionCode / versionName and makes the release build sign itself with the upload key whose
location and passwords come from the environment (never from the repository). Fails loudly if the
generated build.gradle has a shape this does not know, instead of building something unsigned.
"""
import os
import re
import sys

path = sys.argv[1]
text = open(path, encoding='utf-8').read()

code = os.environ['VERSION_CODE']
name = os.environ['VERSION_NAME']

text, n1 = re.subn(r'versionCode\s*=?\s*\d+', f'versionCode {code}', text, count=1)
text, n2 = re.subn(r'versionName\s*=?\s*"[^"]*"', f'versionName "{name}"', text, count=1)

signing = """    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH"))
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEYSTORE_PASSWORD")
        }
    }
"""
text, n3 = re.subn(r'(\n\s*)buildTypes\s*\{', lambda m: "\n" + signing + m.group(1) + "buildTypes {", text, count=1)
text, n4 = re.subn(r'(buildTypes\s*\{\s*release\s*\{)', r'\1\n            signingConfig signingConfigs.release', text, count=1)

if not (n1 and n2 and n3 and n4):
    print(f'unexpected build.gradle shape: versionCode={n1} versionName={n2} signing={n3} release={n4}')
    print(text)
    sys.exit(1)
open(path, 'w', encoding='utf-8').write(text)
print(f'versionCode {code}, versionName {name}, release signing enabled')
