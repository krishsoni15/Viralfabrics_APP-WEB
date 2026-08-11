#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# ViralFabrics React Native – iOS Cloud Builder & BrowserStack Uploader
# ──────────────────────────────────────────────────────────────

set -e

# Force stable Node.js v20 if available
export PATH="/home/krish/.nvm/versions/node/v20.20.2/bin:$PATH"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
step()  { echo -e "\n${BOLD}━━━ $1 ━━━${NC}"; }

# Parse arguments
CHANNEL="production"
PROFILE="preview" # default to preview for ad-hoc IPA
UPLOAD_TO_BS=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --channel)
      CHANNEL="$2"
      shift
      ;;
    --profile)
      PROFILE="$2"
      shift
      ;;
    --simulator)
      PROFILE="simulator"
      ;;
    --upload)
      UPLOAD_TO_BS=true
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --channel staging|production   Swap environment config (default: production)"
      echo "  --profile preview|production   EAS build profile (default: preview)"
      echo "  --simulator                    Build for iOS Simulator (Free, no Apple account needed)"
      echo "  --upload                       Automatically upload the built .ipa to BrowserStack App Live"
      echo "  -h, --help                     Show this help menu"
      echo ""
      exit 0
      ;;
  esac
  shift
done

# ── 0. Swapping .env file based on channel ──
if [ "$CHANNEL" = "staging" ]; then
  if [ -f "env.staging" ]; then
    info "Swapping environment: copying env.staging to .env (Staging / Testing)"
    cp env.staging .env
  else
    warn "env.staging not found! Using default .env"
  fi
else
  if [ -f "env.production" ]; then
    info "Swapping environment: copying env.production to .env (Production / Client)"
    cp env.production .env
  else
    warn "env.production not found! Using default .env"
  fi
fi

# ── 1. Check prerequisites ──
step "Checking prerequisites"
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "'$1' is required but not installed."
    return 1
  fi
  info "$1 found"
}
check_cmd node
check_cmd npm

if ! command -v eas &>/dev/null && ! npx eas-cli --version &>/dev/null; then
  err "EAS CLI (eas) is required. Install it using: npm install -g eas-cli"
  exit 1
fi
info "EAS CLI found"

# ── 2. Run EAS Build in Cloud ──
step "Triggering EAS iOS Build in the Cloud"
info "Profile: $PROFILE"
info "Channel: $CHANNEL"

# Run EAS build. It will wait for completion by default.
npx eas-cli build -p ios --profile "$PROFILE"

# ── 3. Download the built IPA / Simulator Package ──
step "Downloading the built iOS app"

# Retrieve latest build details using EAS CLI
info "Fetching latest build info from EAS..."
BUILD_INFO=$(npx eas-cli build:list --platform ios --limit 1 --json --non-interactive || echo "")

BUILD_ID=""
BUILD_URL=""

if [ -n "$BUILD_INFO" ]; then
  BUILD_ID=$(node -e "
  try {
    const data = JSON.parse(process.argv[1]);
    console.log(data[0].id || '');
  } catch (e) {
    console.log('');
  }
  " "$BUILD_INFO")

  BUILD_URL=$(node -e "
  try {
    const data = JSON.parse(process.argv[1]);
    console.log(data[0].artifacts.applicationArchiveUrl || data[0].artifacts.buildUrl || '');
  } catch (e) {
    console.log('');
  }
  " "$BUILD_INFO")
fi

# Determine filename type based on download URL
if [[ "$BUILD_URL" == *.tar.gz || "$PROFILE" == "simulator" ]]; then
  EXT="tar.gz"
else
  EXT="ipa"
fi

DOWNLOADED_FILE="build-temp.$EXT"

# Record the current files in the directory to double-verify
PRE_DOWNLOAD_FILES=$(ls -1 *.$EXT 2>/dev/null || true)

info "Downloading build artifact (ID: $BUILD_ID)..."

# Try downloading using EAS CLI build-id first
DOWNLOAD_SUCCESS=false
if [ -n "$BUILD_ID" ]; then
  if npx eas-cli build:download --build-id="$BUILD_ID" --non-interactive; then
    DOWNLOAD_SUCCESS=true
  fi
fi

# Fallback: if EAS download failed, download directly using curl
if [ "$DOWNLOAD_SUCCESS" = false ] && [ -n "$BUILD_URL" ]; then
  warn "EAS CLI download failed. Falling back to direct curl download..."
  if curl -L -o "$DOWNLOADED_FILE" "$BUILD_URL"; then
    DOWNLOAD_SUCCESS=true
  fi
fi

# Locate the downloaded file
NEW_FILE=""
if [ "$DOWNLOAD_SUCCESS" = true ]; then
  if [ -f "$DOWNLOADED_FILE" ]; then
    NEW_FILE="$DOWNLOADED_FILE"
  else
    # Find any newly created .ipa or .tar.gz file in current folder
    POST_DOWNLOAD_FILES=$(ls -1 *.$EXT 2>/dev/null || true)
    for f in $POST_DOWNLOAD_FILES; do
      if ! echo "$PRE_DOWNLOAD_FILES" | grep -q "^$f$"; then
        NEW_FILE="$f"
        break
      fi
    done
    if [ -z "$NEW_FILE" ]; then
      NEW_FILE=$(ls -t *.$EXT 2>/dev/null | head -1 || true)
    fi
  fi
fi

if [ -z "$NEW_FILE" ] || [ ! -f "$NEW_FILE" ]; then
  err "Failed to download or locate the iOS build artifact."
  exit 1
fi

# Determine custom final name
if [[ "$NEW_FILE" == *.tar.gz ]]; then
  if [ "$CHANNEL" = "staging" ]; then
    CUSTOM_NAME="app-testing-simulator.tar.gz"
  else
    CUSTOM_NAME="app-production-simulator.tar.gz"
  fi
else
  if [ "$CHANNEL" = "staging" ]; then
    CUSTOM_NAME="app-testing.ipa"
  else
    CUSTOM_NAME="app-production.ipa"
  fi
fi

mv "$NEW_FILE" "$CUSTOM_NAME"
# Clean up temp files if they exist
rm -f build-temp.ipa build-temp.tar.gz 2>/dev/null || true

info "Downloaded and renamed build to: $CUSTOM_NAME"

# ── 4. Upload to BrowserStack if requested ──
if [ "$PROFILE" = "simulator" ]; then
  echo ""
  warn "This is a Simulator build ($CUSTOM_NAME)."
  warn "BrowserStack strictly requires physical device builds (.ipa) and does not support simulator builds."
  echo ""
  info "To test this build for FREE:"
  echo "  1. Go to https://appetize.io (Free browser-based iOS simulator)"
  echo "  2. Upload your file: $CUSTOM_NAME"
  echo "  3. Play and test the app directly in your browser!"
  echo ""
else
  if [ "$UPLOAD_TO_BS" = true ]; then
    step "Uploading to BrowserStack App Live"
    ./upload-browserstack.sh "$CUSTOM_NAME" --live
  else
    echo ""
    info "iOS IPA build completed: $CUSTOM_NAME"
    echo "To upload this build to BrowserStack, run:"
    echo "  ./upload-browserstack.sh $CUSTOM_NAME"
    echo ""
  fi
fi
