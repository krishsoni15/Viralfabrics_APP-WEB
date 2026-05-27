'use client';

import { useEffect, useState } from 'react';

interface User {
  name: string;
  role: string;
}

export default function AccessDeniedClient() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Get user info from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (error) {
        }
    }
  }, []);

  // Only render user info if available
  if (!user) return null;

  return (
    <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-600/50 dark:border-slate-500 mb-6">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        <span className="font-medium">Current User:</span> {user.name}
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        <span className="font-medium">Role:</span> {user.role === 'superadmin' ? 'Super Admin' : 'User'}
      </p>
    </div>
  );
}
