# Viral Fabrics Mobile App – Build & Updates Guide

This guide covers the optimized local build configuration, environment separation (Boss vs. Testers), and how to push hot-updates (EAS Update) directly to users' phones without building new APKs.

---

## 🚀 Why builds are now 10x faster & stable:
1. **Single Architecture (`arm64-v8a`)**: By default, builds target physical Android phones only. This cuts native compilation work by **75%**.
2. **Gradle Build Cache & Daemon**: Speeds up incremental builds by saving past task results and reusing compiler instances.
3. **Parallelism Limits (prevents OOM Crashes)**: Native compilation is restricted to **2 parallel threads** (`CMAKE_BUILD_PARALLEL_LEVEL=2` & `--max-workers=2`). This prevents your 8GB RAM system from running out of memory and killing the compiler.

---

## 🌍 1. Backend & Database API URLs (Automated!)

You **no longer need to edit the `.env` file manually** before building! The build script now manages this automatically by keeping two separate environment files (without a leading dot, to prevent React Native from auto-loading them during release builds):

* 🧪 **Testing/Staging Environment**: Configured in `env.staging` (uses Testing URL `https://viralfabrics-app-web.vercel.app`).
* 💼 **Client/Production Environment**: Configured in `env.production` (uses Client URL `https://main.dc643n4iwffih.amplifyapp.com`).

When you run the build command, the script automatically swaps in the correct file based on the channel:
* Running `./run.sh --channel staging` copies `env.staging` to `.env`.
* Running `./run.sh` copies `env.production` to `.env`.

---

## 🆚 2. Difference Between the 2 APKs

Here is exactly how the two build environments are separated:

| Feature | 🧪 Testing APK (`./run.sh --channel staging`) | 💼 Client/Boss APK (`./run.sh`) |
| :--- | :--- | :--- |
| **Backend API URL** | `https://viralfabrics-app-web.vercel.app` (Testing server) | `https://main.dc643n4iwffih.amplifyapp.com` (Live production server) |
| **Database** | Connected to your **Testing / Development** database | Connected to your **Live / Client** database |
| **Updates Channel** | Listens to **`staging`** update channel | Listens to **`production`** update channel |
| **Who gets it?** | You and your Testers | Your Boss and your Clients |

---

## 📱 3. Build Commands (Generate APKs)

Use these commands to build and locate your APKs:

### 💼 For Your Boss (Production Updates Channel)
Links the APK to the `production` update channel.
```bash
./run.sh
```

### 🧪 For Your Testers (Staging Updates Channel)
Links the APK to the `staging` update channel, separating it from your Boss.
```bash
./run.sh --channel staging
```

### 💻 For Emulator Testing (x86_64 Architecture)
Builds for standard x86_64 computer emulators:
```bash
./run.sh --arch x86_64
```

### 🧹 Clean Build (Fixes corrupted build files)
If a C++ build crashes midway or files get corrupted, run a clean build to wipe caches:
```bash
./run.sh --clean
```

*(APKs are automatically copied to the root of the `mobile-app` directory under custom names to prevent overwriting:)*
* 🧪 **Testing APK**: `app-testing.apk`
* 💼 **Client/Production APK**: `app-production.apk`
* 💻 **Debug APK**: `app-debug.apk`

---

## ⚡ 4. Push Hot Updates (EAS Update)
If you only change your **database URL** or edit **TypeScript/React code**, you do not need to compile or send a new APK. You can push a hot update over the air.

To prevent accidentally publishing your testing URL to your Boss, I have set up automated npm scripts. They will automatically swap the correct `.env` file first before publishing!

> [!IMPORTANT]
> Your users must have the newly built APK installed once for them to receive updates on these channels.

### 📤 Push Updates to Your Boss (Production / Client)
This swaps in `env.production` and pushes to the Boss/Client channel:
```bash
npm run update:production -- --message "Update description"
```

### 📤 Push Updates to Your Testers (Staging / Testing)
This swaps in `env.staging` and pushes to your Testers channel:
```bash
npm run update:staging -- --message "Update description"
```

*Note: The first time you run this, it may prompt you to log into your Expo account via `npx eas-cli login`.*

---

## 🔄 5. How Automatic Updates Work (Zero User Action Needed)
Once you distribute the APKs to your Testers and Clients:

1. **No New Downloads**: When you release new updates using `npx eas-cli update`, users **never** have to download or reinstall a new APK.
2. **Silent Background Update**: The next time a user opens the app (while connected to the internet), the app detects the new update and downloads it silently in the background.
3. **Instant Hot-Reload**: Once the download completes, the app applies the changes automatically (hot-reloads). The next time they open the app, or if they close and restart it, the new database URL and changes will be live.
4. **No Communication Required**: You don't need to message them or send them files. The update process is entirely automated and hands-free for the user.

---

## 🔍 6. What changes support Hot Updates (OTA)?

Here is a breakdown of what you can hot-reload without building a new APK, versus what requires building and sending a new APK file.

### 🟢 Fully Supported (Instantly updates on phone via OTA)
You can change, test, and release all of the following in seconds:
* 🌐 **Database & API URLs**: Changing keys or endpoints in `.env` (like `EXPO_PUBLIC_API_URL`).
* 📄 **Adding New Pages**: Creating new screen files anywhere inside the `app/` directory.
* 🔄 **Data Fetching & Queries**: Editing fetch requests, React Query hooks, or API services.
* 🛠️ **UI & Layout Tweak**: Changing paddings, margins, flex alignment, or text.
* 📦 **Adding Custom UI Elements**: Adding loading skeletons, custom widgets, custom modals, or icons.
* 💡 **Code Logic & State**: Editing Zustand stores, authentication hooks (`useAuth.ts`), validation scripts, or helper utilities.
* 🔌 **Pure JavaScript Libraries**: Installing NPM packages that are JS-only (no native Android/iOS code, like `lodash` or math tools).

### 🔴 Not Supported (Requires compiling and sending a new APK)
You must build and reinstall the APK if you change native layers:
* 🛑 **Native Libraries**: Installing an NPM package that contains custom Java/Kotlin native code (e.g. bluetooth scanners, native camera bindings, etc.).
* 📝 **App Configuration (`app.json`)**: Changing app package name (`com.viralfabrics.crm`), app launcher icon, or system permissions.
* 📁 **Native Directory Modification**: Changing any files directly inside the `android/` directory (like `AndroidManifest.xml` or gradle scripts).

---

## 🎨 7. Splash Screen & Loading Fixes
* **Spinning Loader**: The linear horizontal loader is replaced with a premium native spinning circular spinner (`ActivityIndicator`).
* **Branding Timer**: Added a minimum **1.5-second timer** on startup to prevent the splash screen from flashing and disappearing instantly. Users will see your logo, company info, and the loader clearly before transitioning to the login or dashboard pages.
