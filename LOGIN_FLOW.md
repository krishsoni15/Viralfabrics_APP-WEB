# Authentication and Login Flow

This document details the authentication and login flow across both the Website and Mobile Application for Viral Fabrics.

## 1. Overview
The authentication system is built around a secure JWT (JSON Web Token) flow. It ensures that only authenticated users can access protected routes and endpoints. The same backend API provides authentication for both the React Native (Expo) mobile app and the React (Next.js/Vite) web app.

## 2. Why Login Works Now
Initially, there may have been syncing issues or session expiration discrepancies between platforms. Currently, login works perfectly because:

1. **Centralized `useAuth` Hook**: The authentication state is managed globally through a custom hook (`useAuth`).
2. **Persistent Storage**:
   - **Web**: Uses `localStorage` to save the authentication token and user profile securely across sessions.
   - **Mobile**: Uses `AsyncStorage` (via the `storage.ts` utility) to securely persist the JWT token.
3. **Remember Me Functionality**: 
   - We implemented a robust "Remember Me" toggle that saves the user's username locally for auto-fill on their next visit.
   - The token expiration strategy is gracefully extended if "Remember Me" is enabled, providing seamless sessions for up to 30 days without requiring repeated log-ins.
4. **Axios Interceptors**: The Axios API client intercepts every outgoing request and automatically attaches the JWT token to the `Authorization: Bearer <token>` header, ensuring all CRUD operations on orders and modules are authorized.

## 3. What Was Done to Fix Recent Issues

- **Instant Re-renders**: The primary issue with the mobile app was the lack of immediate UI feedback upon state changes (login, delete all, saving data). We fixed this by:
  - Replacing skeleton loaders with non-blocking `<ActivityIndicator>` spinners so data isn't hidden while refetching.
  - Modifying the React Query cache optimistic updates (`queryClient.setQueriesData`) to instantly update the UI without needing a hard page refresh.
  - Ensuring the 5 data modals (`Grey`, `Mill Input`, `Mill Output`, `Dispatch`, `Lab Data`) do **not** forcefully close when clicking "Delete All", allowing the user to immediately see the empty "Add New" state inside the modal.
- **Cross-Platform Consistency**: Ensured the mobile app's authentication flow (`app/(auth)/login.tsx`) accurately mirrors the web app's robustness, matching token storage and error handling.

## 4. Mobile App Specifics (`login.tsx`)
The mobile login screen features:
- **Keyboard Handling**: `<KeyboardAvoidingView>` ensuring the layout scales properly when typing.
- **Secure Storage Integration**: Directly checks `storage.getRememberMe()` on mount to pre-fill saved usernames.
- **Visual Feedback**: Uses `expo-haptics` for tactile feedback and `react-native-reanimated` for smooth loading transitions and error banners.

## 5. Summary
The login flow is structurally sound. The frontend captures the credentials, the backend validates and issues a JWT token, and the frontend securely persists this token. From there, every subsequent API call automatically verifies the user's identity, ensuring a seamless, secure, and fully reactive user experience across both Web and Mobile.
