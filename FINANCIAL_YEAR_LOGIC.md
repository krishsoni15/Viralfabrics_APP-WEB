# Financial Year Logic & Order ID Transition (FY 2026-27 onwards)

This document outlines the logic and UI implementations for the automated transition of Financial Year (FY) Order IDs in the ViralFabrics application.

## 1. Core ID Logic (Backend)

The application uses the Indian Financial Year (April 1st to March 31st) for sequential order numbering.

### Database Strategy
- **Unique Identifier**: The full `orderId` stored in MongoDB includes the FY prefix (e.g., `FY2526-001`, `FY2627-001`). This ensures database uniquely identifies orders across multiple years.
- **Auto-Increment**: The `Counter` collection manages independent sequences for each financial year. The current key format is `orderId_FY{YY}{YY}` (e.g., `orderId_FY2526`).
- **FY Detection**: The `getCurrentFinancialYear()` utility in `models/Counter.ts` calculates the current FY code (e.g., `2627`) based on the current system date. April 01 is the mandatory reset date.

## 2. UI/UX Standard (Display)

To provide a clean, user-friendly experience, the FY prefix is aggressively stripped from the user interface.

### ID Display Strategy
- **Centralized Utility**: `getDisplayOrderId(orderId)` in `utils/orders.ts` uses regex to remove the `FY****-` prefix, showing only the sequential number (`001`, `002`, etc.) in all tables, modals, and badges.
- **Badges**: Consistent subtle styling is applied across all forms and modals (`bg-blue-500/20 text-blue-300` in dark mode).

### Date Formatting
- **Standard Format**: All date displays across the application (Dashboard, Orders, Modals) have been standardized to `dd/mm/yyyy`.

## 3. New FY Transition Experience

### "New Financial Year" Banner
- **Visibility**: Appears at the top of the Orders page for the first 14 days of April.
- **Dismissal**: Users can dismiss the banner permanently using a cross button. This status is stored in `localStorage` under `fyAlertDismissed_2026_27`.

### The "First Order" Milestone Popup
- **Target Event**: Creation of the first order of the new financial year (Display ID: `001`).
- **Implementation**: The `OrderSuccessAnimation` component checks for Order ID `001` and replaces the standard success message with:
  > **"Happy New Financial Year! 🎉 The first order of the new year has been logged."**
- **One-time Show**: This celebratory message only appears for the very first order to mark the fresh start of the numbering sequence.

## 4. Maintenance & Support
- **Legacy Filter**: Use the "FY Filter" dropdown on the orders page to access data from the previous year.
- **Yearly Updates**: Each year, the `localStorage` dismissal key and `isNewFYPeriod` check in `OrdersClient.tsx` should be audited to ensure the alert triggers for the new calendar year.
- **App Start**: The application legacy filter starts from FY 25-26. Older non-FY records (junk/legacy) are excluded from primary order lists to maintain data integrity.
