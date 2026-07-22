#!/usr/bin/env bash
set -e

echo "CommitX APK Builder"
echo "===================="
echo ""
echo "Prerequisites:"
echo "  - Node.js 18+"
echo "  - Java JDK 17+"
echo "  - Android SDK (Android Studio or command-line tools)"
echo ""

# Install Bubblewrap CLI if not present
if ! command -v bubblewrap &> /dev/null; then
  echo "Installing Bubblewrap CLI..."
  npm install -g @bubblewrap/cli
fi

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
