#!/usr/bin/env bash
set -e

echo "CommitX APK Builder"
echo "===================="
echo ""

# Install Bubblewrap CLI if not present
if ! command -v bubblewrap &> /dev/null; then
  echo "Installing Bubblewrap CLI..."
  npm install -g @bubblewrap/cli
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

# Configure Bubblewrap non-interactively
mkdir -p ~/.bubblewrap
cat > ~/.bubblewrap/config.json <<EOF
{
  "jdkPath": "${JAVA_HOME}",
  "androidSdkPath": "${ANDROID_HOME}"
}
EOF

# Initialize TWA project from manifest if not already done
if [ ! -d "./twa-app" ]; then
  echo "Generating Trusted Web Activity project..."
  bubblewrap init --manifest twa-manifest.json --directory twa-app
fi

cd twa-app

echo "Building APK..."
bubblewrap build

echo ""
echo "APK generated at:"
find . -name "*.apk" -type f
