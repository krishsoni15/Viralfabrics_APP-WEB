# Master Role Administration Guide

This guide explains how to generate, manage, and protect the system's top-level **Master** role account.

---

## 🔑 Master Role Privileges & Protections
- **Full System Access**: The `master` role holds privileges above `superadmin` and can view and execute all administrative actions (Users, Logs, Fabrics, etc.).
- **Deletion Access**: The delete buttons are exclusively visible and accessible to the `master` role.
- **Account Protection**:
  - `master` accounts are **hidden** from user administration screens (`/users` list) for all non-master users.
  - `master` accounts **cannot** be viewed, edited, or deleted by anyone other than the `master` user itself.
  - No one (including `superadmin`) can assign the `master` role to any user.

---

To generate or reset the `master` user account to the default credentials, run the following command in the application's root directory:

```bash
node scripts/createMaster.js
```

### What this script does:
1. Automatically reads the MongoDB connection string (`MONGODB_URI`) from your `.env` file.
2. Connects to the database and deletes any existing user with role `master` or username `master`.
3. Creates a new master user with the preset credentials:
   - **Username**: `master`
   - **Password**: `Master@2026#`
4. Hashes the password securely and inserts the new `master` user record.
5. Prints the username (`master`) and the password to the terminal.
