import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldOff } from 'lucide-react-native';
import { router } from 'expo-router';
import Header from '../components/shared/Header';
import EmptyState from '../components/ui/EmptyState';
import { useTheme } from '../hooks/useTheme';
import { Colors } from '../constants/colors';

export default function AccessDeniedScreen() {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Access Denied" showBack />
      <EmptyState
        icon={<ShieldOff size={40} color={Colors.error[500]} />}
        title="Access Denied"
        subtitle="You don't have permission to access this page. Contact your administrator."
        actionTitle="Go Back"
        onAction={() => router.back()}
      />
    </SafeAreaView>
  );
}
