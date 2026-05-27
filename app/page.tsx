'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check for active session
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        // Quick client-side validation
        const parsedUser = JSON.parse(userData);
        const tokenExpiry = parsedUser.exp || 0;
        const now = Math.floor(Date.now() / 1000);

        // If we have expiration time, check it
        if (tokenExpiry > 0) {
          // If token is not expired, redirect to dashboard immediately
          if (tokenExpiry > now) {
            router.push('/dashboard');
            setIsChecking(false);
            return;
          } else {
            // Token expired, clear it
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } else {
          // No expiration time stored (old session), assume valid and redirect
          // Will be validated by dashboard layout
          router.push('/dashboard');
          setIsChecking(false);
          return;
        }
      } catch {
        // Invalid user data, clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    // No valid session, redirect to login
    setIsChecking(false);
    router.push('/login');
  }, [router]);

  // Show nothing while checking (prevents flash)
  if (isChecking) {
    return null;
  }

  return null;
}
