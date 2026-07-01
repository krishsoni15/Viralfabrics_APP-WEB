# 📱 Viral Fabrics Mobile App Deployment & Testing Guide

This guide details how to build, test, and release the **Viral Fabrics Mobile App** (built with Expo and React Native) on both **iOS** and **Android**. It covers everything from local development to App Store (TestFlight) and Play Store submissions.

---

## 🚀 1. Local Development Setup

To run the app locally on an emulator/simulator or physical device via **Expo Go**:

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Expo Go App** installed on your physical device (available on Google Play Store and iOS App Store)

### Step-by-Step Run
1. Navigate to the mobile app directory:
   ```bash
   cd mobile-app
   ```
2. Install JS dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the Expo development server:
   ```bash
   npm start
   ```
4. **Run on Simulators:**
   - Press **`i`** to open in the iOS Simulator (requires Xcode on macOS).
   - Press **`a`** to open in the Android Emulator (requires Android Studio).
5. **Run on Physical Devices:**
   - **Android:** Scan the QR code shown in your terminal using the **Expo Go** app.
   - **iOS:** Scan the QR code using the stock **iOS Camera app**, which will prompt you to open it in Expo Go.

> [!NOTE]
> Make sure your development machine and your mobile device are connected to the **same Wi-Fi network**. If you face connection issues, try starting the server with the tunnel option: `npx expo start --tunnel`.

---

## 🤖 2. Android MVP Testing Path

For Android testing, you have three main ways to distribute and test your app:

### Method A: Build APK Locally (Easiest & Fastest)
You can compile a standalone release `.apk` directly on your local machine using the pre-configured script.
1. Run the local build script:
   ```bash
   ./run.sh
   ```
   *Note: This script automatically checks your Java installation, patches Gradle if necessary, runs typescript checks, performs expo prebuild, and triggers `./gradlew assembleRelease`.*
2. Once complete, your APK will be generated at:
   `android/app/build/outputs/apk/release/app-release.apk`
3. You can transfer this file to any Android device (via USB, Google Drive, or Slack) and install it immediately.

### Method B: Build APK in the Cloud (EAS Build)
If you don't have Android SDK or Java installed locally, you can use Expo's cloud build servers (EAS).
1. Install EAS CLI globally if you haven't:
   ```bash
   npm install -g eas-cli
   ```
2. Log in to your Expo account:
   ```bash
   eas login
   ```
3. Trigger a cloud APK build:
   ```bash
   eas build -p android --profile preview
   ```
4. EAS will compile the app on its servers and return a **QR code** in the terminal. Scan it with any Android phone to download and install the APK directly.

### Method C: Google Play Store (Internal Testing)
To simulate the production experience or get the app approved for testing by Google:
1. Run a production build (which outputs an `.aab` file):
   ```bash
   eas build -p android --profile production
   ```
2. Log in to your **Google Play Console**.
3. Create an application and navigate to **Testing** ➔ **Internal testing**.
4. Upload the generated `.aab` bundle.
5. Create a list of tester email addresses. They will receive an invitation link to download the app safely from the Google Play Store.

---

## 🍎 3. iOS MVP Testing Path

Due to iOS code-signing security rules, testing on physical iPhones requires a paid **Apple Developer Account** ($99/year). Here are the two standard paths to test the app on iOS.

### Method A: TestFlight (Recommended & Most Reliable)
This is the official Apple beta distribution platform and is closest to production.

1. **Build a Production iOS Build:**
   Generate the App Store-ready `.ipa` file using EAS Build:
   ```bash
   eas build -p ios --profile production
   ```
   *Note: EAS will prompt you to log in to your Apple Developer Account to automatically manage your signing credentials, profiles, and certificates.*

2. **Submit to App Store Connect:**
   Once the build completes, submit it directly to TestFlight:
   ```bash
   eas submit -p ios
   ```

3. **Configure TestFlight:**
   - Log in to [App Store Connect](https://appstoreconnect.apple.com/).
   - Go to **Apps** ➔ **Viral Fabrics** ➔ **TestFlight**.
   - Under **Internal Testing**, add users by their Apple IDs (e.g., your team, clients).
   - Testers will receive an email invitation. They will install the free **TestFlight app** from the App Store, click the invitation link, and download the app.

### Method B: Ad-Hoc/Internal Distribution (Direct QR Install)
If you want to bypass the TestFlight review queue and install the app directly on registered devices via a web link:

1. **Register Tester Devices:**
   You must collect the **UDID** (Unique Device Identifier) of all testing iPhones.
2. **Build a Preview Build:**
   Run:
   ```bash
   eas build -p ios --profile preview
   ```
3. **Automatic Provisioning:**
   EAS will guide you through connecting your Apple account, register the tester UDIDs to your Apple Developer portal, regenerate the provisioning profile, and build the `.ipa` file.
4. **Install:**
   When complete, EAS will output a QR code. Testers scan it with their iPhone camera to download and install the application directly.

---

## 🛠️ 4. Mobile MVP Roadmap & Architecture

The app is preconfigured as a 3-page MVP implementing core workflows:

```mermaid
graph TD
  A[App Launch] --> B{Authenticated?}
  B -- No --> C[(auth)/login]
  B -- Yes --> D[(tabs)/dashboard]
  D --> E[(tabs)/profile]
  E --> F[Toggle Dark/Light Mode]
  E --> G[Sign Out]
```

### Core Screens & Features Included:
1. **Login (`app/(auth)/login.tsx`)**:
   - Secure input fields, authentication state stored locally via `AsyncStorage`.
   - Error handling, animated login buttons, and validation.
2. **Dashboard (`app/(tabs)/dashboard.tsx`)**:
   - CRM analytics, order overview, and metrics cards.
   - Smooth lists with pull-to-refresh.
3. **Profile (`app/(tabs)/profile.tsx`)**:
   - Displays user details, roles, and device settings.
   - **Light / Dark Mode Switch**: Instant global toggle using `useTheme` and zustand state, persisted in phone storage so it persists across sessions.
   - Admin settings access (for users with `superadmin` role).

---

## ⚡ Quick CLI Cheatsheet

| Command | Action |
|---|---|
| `npm start` | Launch Expo development server |
| `./run.sh` | Build local release Android APK |
| `eas build -p android --profile preview` | Build Android APK on EAS Cloud (Outputs download link) |
| `eas build -p ios --profile preview` | Build iOS Ad-hoc IPA (Requires registered device UDIDs) |
| `eas build -p ios --profile production` | Build iOS App Store/TestFlight IPA |
| `eas submit -p ios` | Submit built iOS app to App Store Connect / TestFlight |
