import { Redirect } from 'expo-router';
import { useAppStore } from '../store/useAppStore';

export default function Index() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isLoading = useAppStore((s) => s.isLoading);
  const user = useAppStore((s) => s.user);

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    if (user?.role === 'party') {
      return <Redirect href="/(tabs)/orders" />;
    }
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}
