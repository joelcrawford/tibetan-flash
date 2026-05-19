#!/bin/bash
set -e

# Load credentials from apps/ios/.env
if [ -f "apps/ios/.env" ]; then
  export $(grep -v '^#' apps/ios/.env | xargs)
fi

# Check required vars
required_vars=(
  "APPLE_CONNECT_KEY_ID"
  "APPLE_CONNECT_ISSUER_ID"
  "APPLE_CONNECT_DIST_PASSWORD"
)
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "✗ Missing $var in apps/ios/.env"
    exit 1
  fi
done

if ! command -v eas &> /dev/null; then
  echo "✗ eas-cli not found. Run: npm install -g eas-cli"
  exit 1
fi

# Config
AUTH_DIR="apps/ios/_auth"
DIST_CERT_P12="$AUTH_DIR/tibetan-flash-dist-cert.p12"
PROFILE_PATH="$AUTH_DIR/tibetanflashcardsappstore.mobileprovision"
API_KEY_PATH="$AUTH_DIR/AuthKey_${APPLE_CONNECT_KEY_ID}.p8"
SIGNING_IDENTITY="Apple Distribution: Joel Crawford (5469PA59T3)"
BUNDLE_ID="com.havehopeyo.tibetanflashcards"

KEYCHAIN_PATH="$HOME/Library/Keychains/tibetanflash-build.keychain-db"
KEYCHAIN_PASSWORD="tibetanflash-tmp"
ARCHIVE_PATH="/tmp/TibetanFlash.xcarchive"
EXPORT_PATH="/tmp/TibetanFlash-export"
EXPORT_OPTIONS="/tmp/TibetanFlash-export-options.plist"
DECODED_PROFILE="/tmp/tibetanflash-profile.plist"
UUID_FILE="/tmp/tibetanflash-profile-uuid.txt"
LOG="/tmp/tibetanflash-ship.log"

ORIGINAL_KEYCHAINS=$(security list-keychains -d user | xargs)
STEP=0
TOTAL=7

> "$LOG"

cleanup() {
  security list-keychains -d user -s $ORIGINAL_KEYCHAINS 2>/dev/null || true
  security delete-keychain "$KEYCHAIN_PATH" 2>/dev/null || true
  rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH" "$EXPORT_OPTIONS" "$DECODED_PROFILE" "$UUID_FILE"
}
trap cleanup EXIT

run_step() {
  local desc="$1"
  local fn="$2"
  STEP=$((STEP + 1))
  printf "[%d/%d] %s" "$STEP" "$TOTAL" "$desc"

  $fn >> "$LOG" 2>&1 &
  local pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    printf "."
    sleep 3
  done

  if wait "$pid"; then
    printf " ✓\n"
  else
    printf " ✗\n\n"
    echo "--- Error (last 40 lines of log) ---"
    tail -40 "$LOG"
    echo ""
    echo "Full log: $LOG"
    exit 1
  fi
}

# ── Steps ─────────────────────────────────────────────────────────────────────

step_keychain() {
  set -e
  security delete-keychain "$KEYCHAIN_PATH" 2>/dev/null || true
  security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
  security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
  security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
  security list-keychains -d user -s "$KEYCHAIN_PATH" $ORIGINAL_KEYCHAINS
  security import "$DIST_CERT_P12" \
    -k "$KEYCHAIN_PATH" \
    -P "$APPLE_CONNECT_DIST_PASSWORD" \
    -T /usr/bin/codesign \
    -T /usr/bin/security
  security set-key-partition-list \
    -S "apple-tool:,apple:,codesign:" \
    -s -k "$KEYCHAIN_PASSWORD" \
    "$KEYCHAIN_PATH"
}

step_profile() {
  set -e
  security cms -D -i "$PROFILE_PATH" -o "$DECODED_PROFILE"
  /usr/libexec/PlistBuddy -c 'Print :UUID' "$DECODED_PROFILE" > "$UUID_FILE"
  rm -f "$DECODED_PROFILE"
  mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
  cp "$PROFILE_PATH" ~/Library/MobileDevice/Provisioning\ Profiles/"$(cat "$UUID_FILE").mobileprovision"
}

step_bump_version() {
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('apps/ios/app.json', 'utf8'));
    const current = parseInt(config.expo.ios.buildNumber || '0', 10);
    config.expo.ios.buildNumber = String(current + 1);
    fs.writeFileSync('apps/ios/app.json', JSON.stringify(config, null, 2) + '\n');
    console.log('Build number:', config.expo.ios.buildNumber);
  "
}

step_prebuild() {
  set -e
  cd apps/ios
  rm -rf ios
  CI=1 npx expo prebuild --clean --platform ios
  cd ../..
}

step_archive() {
  set -e
  PROFILE_UUID=$(cat "$UUID_FILE")
  xcodebuild archive \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    -destination "generic/platform=iOS" \
    CODE_SIGN_STYLE=Manual \
    "CODE_SIGN_IDENTITY=$SIGNING_IDENTITY" \
    "PROVISIONING_PROFILE=$PROFILE_UUID" \
    "OTHER_CODE_SIGN_FLAGS=--keychain $KEYCHAIN_PATH"
}

step_export() {
  set -e
  PROFILE_UUID=$(cat "$UUID_FILE")
  cat > "$EXPORT_OPTIONS" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>signingCertificate</key>
  <string>$SIGNING_IDENTITY</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>$BUNDLE_ID</key>
    <string>$PROFILE_UUID</string>
  </dict>
  <key>stripSwiftSymbols</key>
  <true/>
</dict>
</plist>
PLIST
  rm -rf "$EXPORT_PATH"
  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS"
}

step_submit() {
  set -e
  # Copy API key to the location altool expects
  mkdir -p ~/.appstoreconnect/private_keys
  cp "$(pwd)/$API_KEY_PATH" ~/.appstoreconnect/private_keys/AuthKey_${APPLE_CONNECT_KEY_ID}.p8
  xcrun altool --upload-app \
    --type ios \
    --file "$IPA_FILE" \
    --apiKey "$APPLE_CONNECT_KEY_ID" \
    --apiIssuer "$APPLE_CONNECT_ISSUER_ID"
}

# ── Run ───────────────────────────────────────────────────────────────────────

echo ""
run_step "Setting up signing keychain   " step_keychain
run_step "Installing provisioning profile" step_profile
PROFILE_UUID=$(cat "$UUID_FILE")

run_step "Bumping build number          " step_bump_version
run_step "Expo prebuild + pod install   " step_prebuild

WORKSPACE=$(find apps/ios/ios -maxdepth 1 -name "*.xcworkspace" | head -1)
SCHEME=$(basename "$WORKSPACE" .xcworkspace)

run_step "Xcode archive                 " step_archive
run_step "Exporting IPA                 " step_export

IPA_FILE=$(find "$EXPORT_PATH" -name "*.ipa" | head -1)

run_step "Uploading to App Store Connect" step_submit

echo ""
echo "✓ Done! Check App Store Connect → TestFlight for the new build."
echo ""
