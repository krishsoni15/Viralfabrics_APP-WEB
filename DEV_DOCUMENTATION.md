# Developer Documentation: Order Modules & UI State

## 1. Login Process Overview

### Web Login
The web application uses credentials (email & password) or session cookies to authenticate users. Once authenticated, the user session is managed securely through Next.js server-side cookies or Redis cache, providing immediate access to the dashboard. 

### Mobile Login
The mobile app interacts with the same backend but manages sessions via `AsyncStorage` (or secure store) using a JWT or session token. 
- **Login Flow**: Upon logging in via `/login`, the mobile app receives an authentication token and user profile data.
- **Persistence**: This token is stored locally. On app launch, it checks for this token to bypass the login screen and land directly on the Orders Dashboard.

## 2. Recent Fixes: The 5 Order Modules (Grey, Lab, Mill Input, Mill Output, Dispatch)

### The Problem
Previously on the mobile app, when saving data for any of the 5 detailed order modules (Grey Information, Lab Data, Mill Inputs, Mill Outputs, or Dispatches), the data would successfully save to the backend, but the "Add" button would not instantly turn into the "Edit" button (the green dot indicator). It required a manual page refresh to update the UI. Additionally, the user wanted to see a circular loading spinner instead of a skeleton layout when the modules were loading.

### What Was Done
1. **Fixed UI State Sync (`React.memo` Issue)**: 
   - The UI buttons (pills) for these 5 modules are rendered inside the `OrderCard` component (`mobile-app/app/(tabs)/orders.tsx`). 
   - The `OrderCard` component was heavily memoized using `React.memo` to prevent performance issues in the `FlashList`. 
   - **The Bug**: The `React.memo` custom comparator was *not checking* whether `greyInformation`, `labData`, `millInputs`, `millOutputs`, or `dispatches` changed. It only checked top-level details and `updatedAt`.
   - **The Fix**: We updated the `React.memo` comparator to specifically check for changes in these 5 arrays and the `loadingPill` state. Now, when a mutation completes and we optimistically update the cache via `setQueriesData`, the `OrderCard` immediately detects the change and re-renders, turning the "Add" button into the green "Edit" button instantly!

2. **Circular Loading Spinner**:
   - Replaced the large, full-screen Skeleton loaders inside `GreyInformationModal.tsx`, `MillInputModal.tsx`, and `MillOutputModal.tsx` with a clean `<ActivityIndicator size="large" />` (circular loading spinner).
   - This aligns with the requested UI preference for module data fetching.

## 3. How Modules and Mutations Work Internally

1. **Fetching**: 
   - The mobile app fetches the primary `orders` array using `useQuery(['orders', ...])`. 
   - Wait, `GreyInformation`, `MillInput`, etc. are fetched on the backend and appended to the `orders` payload *before* being sent to mobile.

2. **Editing / Saving**:
   - When a user clicks "Save" inside a modal (e.g., Grey Info), a `useMutation` (e.g., `saveGreyMutation`) is triggered.
   - The app makes a `POST`/`PUT` request to the backend.

3. **Optimistic UI Updates (The "Instant" Effect)**:
   - On a successful mutation (`onSuccess`), the mobile app grabs the new data and manually updates the local React Query cache for the `orders` list using `queryClient.setQueriesData`.
   - By modifying the `greyInformation` (or other module arrays) inside the specific order object in the cache, the memoized `orders` list generates a new reference.
   - With the newly fixed `React.memo` comparator, `OrderCard` sees the newly modified array, re-renders, and flips the UI from "Add" to "Edit" immediately. 
   - Finally, `queryClient.invalidateQueries` is called to silently refetch the true data from the backend in the background to ensure consistency.

4. **Deleting Data**:
   - Deleting operates identically. Upon pressing "Delete All", the mutation calls the `DELETE` API, then `onSuccess` optimistically clears the array (e.g., `greyInformation: []`) in the React Query cache. The `OrderCard` instantly detects the empty array and reverts the UI back to the generic "Add" state.
