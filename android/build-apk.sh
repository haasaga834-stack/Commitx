#!/usr/bin/env bash
set -euo pipefail

echo "CommitX APK Builder (non-interactive)"
echo "====================================="

cd "$(dirname "$0")"

if ! command -v gradle &> /dev/null; then
  echo "Error: Gradle is not installed. Please install Gradle 8.10+ and re-run this script."
  exit 1
fi

if [ -z "${JAVA_HOME:-}" ]; then
  echo "Error: JAVA_HOME is not set. Please install JDK 17+ and set JAVA_HOME."
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "Error: ANDROID_HOME is not set. Please install Android SDK and set ANDROID_HOME."
  exit 1
fi

export COMMITX_KEYSTORE_PATH="${COMMITX_KEYSTORE_PATH:-$(pwd)/app/commitx.keystore}"
export COMMITX_KEYSTORE_PASSWORD="${COMMITX_KEYSTORE_PASSWORD:-commitx}"
export COMMITX_KEY_ALIAS="${COMMITX_KEY_ALIAS:-commitx}"
export COMMITX_KEY_PASSWORD="${COMMITX_KEY_PASSWORD:-commitx}"

mkdir -p "$(dirname "$COMMITX_KEYSTORE_PATH")"

if [ ! -f "$COMMITX_KEYSTORE_PATH" ]; then
  echo "Generating signing keystore..."
  keytool -genkeypair -noprompt \
    -keystore "$COMMITX_KEYSTORE_PATH" \
    -alias "$COMMITX_KEY_ALIAS" \
    -storepass "$COMMITX_KEYSTORE_PASSWORD" \
    -keypass "$COMMITX_KEY_PASSWORD" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=CommitX, OU=Mobile, O=CommitX, L=NA, S=NA, C=IN"
fi

echo "Building signed release APK..."
gradle :app:assembleRelease --no-daemon < /dev/null

echo ""
echo "APK generated at:"
find app/build/outputs/apk -name "*.apk" -type f
