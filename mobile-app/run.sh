#!/usr/bin/env bash
set -e

# Force stable Node.js v20 and limit memory allocation to prevent system OOM crashes
export PATH="/home/krish/.nvm/versions/node/v20.20.2/bin:$PATH"
export NODE_OPTIONS="--max-old-space-size=2048"

# ──────────────────────────────────────────────
# ViralFabrics React Native – Local APK Builder
# ├─ Checks prerequisites
# ├─ Installs dependencies
# ├─ Runs TypeScript check
# ├─ Generates native Android project
# └─ Builds release APK via Gradle
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

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
BUILD_TYPE="assembleRelease"
APK_NAME="release"
FORCE_CLEAN=false
SKIP_TSC=false
ARCH="arm64-v8a"
CHANNEL="production"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    -d|--debug)
      BUILD_TYPE="assembleDebug"
      APK_NAME="debug"
      ;;
    -c|--clean)
      FORCE_CLEAN=true
      ;;
    --no-tsc)
      SKIP_TSC=true
      ;;
    --arch)
      ARCH="$2"
      shift
      ;;
    --all-arch)
      ARCH="armeabi-v7a,arm64-v8a,x86,x86_64"
      ;;
    --channel)
      CHANNEL="$2"
      shift
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

# ── 1. Prerequisites ────────────────────────
step "Checking prerequisites"

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "'$1' is required but not installed."
    case "$1" in
      node)    echo "  Install: https://nodejs.org (v18+)" ;;
      npm)     echo "  Comes with Node.js" ;;
      java)    echo "  Install: https://adoptium.net (JDK 17+)" ;;
    esac
    return 1
  fi
  info "$1 found: $(command -v "$1")"
}

check_cmd node
check_cmd npm

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  err "Node.js v18+ required, found v$(node -v)"
  exit 1
fi
info "Node.js version: $(node -v)"

if command -v java &>/dev/null; then
  JAVA_VER=$(java -version 2>&1 | head -1 | sed 's/.*version "//; s/".*//')
  info "Java version: $JAVA_VER"
else
  warn "Java not found – install JDK 17+"
fi

# ── 2. ANDROID_HOME ─────────────────────────
step "Checking Android SDK"

if [ -n "$ANDROID_HOME" ]; then
  info "ANDROID_HOME: $ANDROID_HOME"
elif [ -d "$HOME/Android/Sdk" ]; then
  export ANDROID_HOME="$HOME/Android/Sdk"
  info "ANDROID_HOME: $ANDROID_HOME (auto-detected)"
elif [ -d "$HOME/Library/Android/sdk" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  info "ANDROID_HOME: $ANDROID_HOME (macOS)"
else
  warn "ANDROID_HOME not set. Set it or the build may fail:"
  echo "  export ANDROID_HOME=\$HOME/Android/Sdk"
fi

# ── 3. Install JS dependencies ─────────────
if [ ! -d "node_modules" ] || [ "$FORCE_CLEAN" = true ]; then
  step "Installing npm dependencies"
  npm install --legacy-peer-deps
else
  step "Checking dependencies"
  info "node_modules exists. Skipping npm install (use --clean to force)"
fi

# ── 3.5. Patch foojay for Gradle 9+ ────────
step "Patching Gradle toolchain plugin"
node patch-gradle.js

# ── 4. TypeScript check ────────────────────
if [ "$SKIP_TSC" = true ]; then
  step "TypeScript check"
  warn "Skipped (--no-tsc)"
else
  step "Running TypeScript check"
  npx tsc --noEmit
  info "TypeScript check passed"
fi

# ── 5. Expo prebuild ───────────────────────
step "Configuring native Android project"

# Update updates.requestHeaders.expo-channel-name in app.json and AndroidManifest.xml dynamically
node -e "
const fs = require('fs');
const appJsonFile = 'app.json';
const channel = '$CHANNEL';
if (fs.existsSync(appJsonFile)) {
  const data = JSON.parse(fs.readFileSync(appJsonFile, 'utf8'));
  if (data.expo && data.expo.updates) {
    data.expo.updates.requestHeaders = data.expo.updates.requestHeaders || {};
    data.expo.updates.requestHeaders['expo-channel-name'] = channel;
    fs.writeFileSync(appJsonFile, JSON.stringify(data, null, 2));
    console.log('[✓] Updated app.json channel to: ' + channel);
  }
}
const manifestFile = 'android/app/src/main/AndroidManifest.xml';
if (fs.existsSync(manifestFile)) {
  let content = fs.readFileSync(manifestFile, 'utf8');
  const regex = /(<meta-data\s+android:name=\\\"expo\.modules\.updates\.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY\\\"\s+android:value=\\\")[^\\\"]*(\\\"\s*\/>)/;
  const expectedValue = '{&quot;expo-channel-name&quot;:&quot;' + channel + '&quot;}';
  if (content.match(regex)) {
    content = content.replace(regex, '\$1' + expectedValue + '\$2');
    fs.writeFileSync(manifestFile, content);
    console.log('[✓] Patched AndroidManifest.xml channel to: ' + channel);
  }
}
"

if [ "$FORCE_CLEAN" = true ] && [ -d "android" ]; then
  warn "Force clean: removing android/"
  rm -rf android
fi

if [ ! -d "android" ]; then
  info "Generating native android/ directory..."
  npx expo prebuild --platform android
  # Re-apply patch after prebuild regenerates node_modules references
  node patch-gradle.js
  
  # Inject Jetifier, caching, and local properties
  echo "" >> android/gradle.properties
  echo "android.enableJetifier=true" >> android/gradle.properties
  echo "org.gradle.caching=true" >> android/gradle.properties
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
  
  # Inject expo-camera maven repo
  node -e "const fs=require('fs'); const file='android/build.gradle'; if(fs.existsSync(file)) { let content=fs.readFileSync(file,'utf8'); if(!content.includes('expo-camera/android/maven')) { content=content.replace(/allprojects\\s*\\{\\s*repositories\\s*\\{/, 'allprojects {\\n  repositories {\\n    maven { url \"\\$rootDir/../node_modules/expo-camera/android/maven\" }'); fs.writeFileSync(file,content); console.log('[✓] Patched build.gradle for expo-camera.'); } }"

  info "Native project generated"
else
  info "android/ exists. Skipping prebuild (use --clean to regenerate)"
  # Ensure local.properties, Jetifier, and caching are set even if android/ exists
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
  if ! grep -q "android.enableJetifier" android/gradle.properties 2>/dev/null; then
    echo "" >> android/gradle.properties
    echo "android.enableJetifier=true" >> android/gradle.properties
  fi
  if ! grep -q "org.gradle.caching" android/gradle.properties 2>/dev/null; then
    echo "" >> android/gradle.properties
    echo "org.gradle.caching=true" >> android/gradle.properties
  fi
  # Ensure expo-camera maven repo is injected
  node -e "const fs=require('fs'); const file='android/build.gradle'; if(fs.existsSync(file)) { let content=fs.readFileSync(file,'utf8'); if(!content.includes('expo-camera/android/maven')) { content=content.replace(/allprojects\\s*\\{\\s*repositories\\s*\\{/, 'allprojects {\\n  repositories {\\n    maven { url \"\\$rootDir/../node_modules/expo-camera/android/maven\" }'); fs.writeFileSync(file,content); console.log('[✓] Patched build.gradle for expo-camera.'); } }"
fi

# ── 5.5. Clean Gradle state on --clean ─────
if [ "$FORCE_CLEAN" = true ]; then
  step "Cleaning Gradle state"

  # Stop any running Gradle daemons
  if [ -f "android/gradlew" ]; then
    cd android && ./gradlew --stop 2>/dev/null || true && cd "$SCRIPT_DIR"
    info "Stopped Gradle daemons"
  fi

  # Kill any lingering Gradle/Java daemon processes
  pkill -f "GradleDaemon" 2>/dev/null || true

  # Clear the project-local Gradle cache
  rm -rf android/.gradle
  info "Cleared android/.gradle"

  # Clear the Gradle version-specific cache (avoids corrupted transforms)
  GRADLE_VER="9.3.1"
  if [ -d "$HOME/.gradle/caches/$GRADLE_VER" ]; then
    rm -rf "$HOME/.gradle/caches/$GRADLE_VER"
    info "Cleared ~/.gradle/caches/$GRADLE_VER"
  fi
fi

# ── 6. Build APK ──────────────────────────
step "Building APK via Gradle"

cd android

if [ "$APK_NAME" = "debug" ]; then
  info "Building DEBUG APK (Arch: $ARCH)"
else
  info "Building RELEASE APK (Arch: $ARCH)"
fi

export GRADLE_OPTS="-Xmx4096m -Dorg.gradle.jvmargs=-Xmx4096m -Djava.net.preferIPv4Stack=true"
export CMAKE_BUILD_PARALLEL_LEVEL=2
./gradlew "$BUILD_TYPE" -PreactNativeArchitectures="$ARCH" --daemon --max-workers=2

cd "$SCRIPT_DIR"

# ── 7. Locate APK ──────────────────────────
step "Locating built APK"

APK_PATH=$(find android/app/build/outputs/apk -name "*.apk" | head -1)

if [ -f "$APK_PATH" ]; then
  # Determine custom name to prevent overwriting staging vs production builds
  if [ "$APK_NAME" = "debug" ]; then
    CUSTOM_NAME="app-debug.apk"
  elif [ "$CHANNEL" = "staging" ]; then
    CUSTOM_NAME="app-testing.apk"
  else
    CUSTOM_NAME="app-production.apk"
  fi
  
  # Copy to root directory under the custom name
  cp "$APK_PATH" "$CUSTOM_NAME"
  APK_PATH="$CUSTOM_NAME"

  SIZE=$(du -h "$APK_PATH" | cut -f1)
  info "APK built successfully!"
  echo ""
  echo "  Location: $APK_PATH (copied to project root)"
  echo "  Size:     $SIZE"
  echo ""
  echo "  Install on device:"
  echo "    adb install $APK_PATH"
  echo ""
else
  err "APK not found. Check android/app/build/outputs/apk/"
  ls -la android/app/build/outputs/apk/ 2>/dev/null || true
  exit 1
fi

# ── 8. Summary ─────────────────────────────
step "Build summary"
echo "  Project:   ViralFabrics"
echo "  Platform:  Android"
echo "  Type:      ${APK_NAME^^}"
echo "  APK:       $APK_PATH"
echo "  Size:      $SIZE"
echo ""
echo "  ${BOLD}Done.${NC}"
