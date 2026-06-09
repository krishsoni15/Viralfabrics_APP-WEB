# 🧵 Viral Fabrics Platform

Welcome to the **Viral Fabrics** monorepo workspace. This project contains both the web-based Performance CRM dashboard and the native mobile companion application.

## 📂 Repository Structure

- **`/` (Root)**: The Next.js 15 + React 19 web-based CRM admin application.
- **`mobile-app/`**: The Expo + React Native mobile app companion.

---

## 💻 Web CRM Application

A Next.js dashboard configured with:
- **Framework**: Next.js 15.5+ & React 19
- **Database**: MongoDB (via Mongoose)
- **Caching & Rate Limiting**: Upstash Redis
- **Real-time**: Socket.IO

### Web Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

---

## 📱 Mobile CRM Companion

A native companion app built with **Expo SDK** and **React Native**, sharing state logic with the web backend.

Features:
- Authentication & Session persistence
- CRM Analytics Dashboard
- Profile management with persistent **Light/Dark Mode**
- Admin interface (User Management, Activity Logs)

### Mobile Getting Started
To view setup, local running commands, APK building scripts, and Apple TestFlight deployment procedures:
👉 **Go to the [Mobile README Guide](./mobile-app/README.md)**

```bash
cd mobile-app
# Read README.md for complete platform-specific instructions!
```
