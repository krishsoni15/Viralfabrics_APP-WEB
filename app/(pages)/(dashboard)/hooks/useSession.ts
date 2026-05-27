'use client';

import { useState, useEffect } from 'react';

export interface SessionUser {
  _id: string;
  name: string;
  username: string;
  role: string;
  phoneNumber?: string;
  address?: string;
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (error) {
        }
    }
    setIsLoading(false);
  }, []);

  const isSuperAdmin = user?.role === 'superadmin';
  const isUser = user?.role === 'user';

  return {
    user,
    isLoading,
    isSuperAdmin,
    isUser,
    isAuthenticated: !!user,
  };
}
