#!/usr/bin/env bash
set -e

echo "CommitX APK Builder"
echo "===================="
echo ""

cd "$(dirname "$0")"

if ! command -v gradle &> /dev/null; then
  echo "Error: Gradle is not installed. Please install Gradle 8.10+ and re-run this script."
  exit 1
fi

# Validate environment
if [ -z "$JAVA_HOME" ]; then
  echo "Error: JAVA_HOME is not set. Please install JDK 17+ and set JAVA_HOME."
  exit 1
fi

if [ -z "$ANDROID_HOME" ]; then
  echo "Error: ANDROID_HOME is not set. Please install Android SDK and set ANDROID_HOME."
  exit 1
fi

echo "Building APK..."
gradle :app:assembleDebug

echo ""
echo "APK generated at:"
find app/build/outputs/apk -name "*.apk" -type f
