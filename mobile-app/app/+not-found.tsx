import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { HelpCircle } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { Colors } from '../constants/colors';
import Button from '../components/ui/Button';

export default function NotFoundScreen() {
  const { theme, isDarkMode } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found', headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Subtle Ambient Background Glows */}
        <View style={{ 
          position: 'absolute', 
          top: '20%', 
          left: '10%', 
          width: 200, 
          height: 200, 
          borderRadius: 100, 
          backgroundColor: isDarkMode ? 'rgba(167, 139, 250, 0.03)' : 'rgba(79, 70, 229, 0.01)' 
        }} />
        <View style={{ 
          position: 'absolute', 
          bottom: '25%', 
          right: '10%', 
          width: 220, 
          height: 220, 
          borderRadius: 110, 
          backgroundColor: isDarkMode ? 'rgba(79, 70, 229, 0.02)' : 'rgba(167, 139, 250, 0.01)' 
        }} />

        <View style={styles.card}>
          <View style={[
            styles.iconContainer, 
            { 
              backgroundColor: isDarkMode ? 'rgba(167, 139, 250, 0.08)' : Colors.primary[50],
              borderColor: isDarkMode ? 'rgba(167, 139, 250, 0.2)' : 'rgba(79, 70, 229, 0.1)',
              borderWidth: 1,
            }
          ]}>
            <HelpCircle size={40} color={isDarkMode ? '#a78bfa' : '#4f46e5'} />
          </View>
          
          <Text style={[styles.title, { color: theme.text }]}>Page Not Found</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            The screen you are looking for doesn't exist, has been moved, or is under construction.
          </Text>

          <View style={styles.buttonContainer}>
            <Button
              title="Go to Dashboard"
              onPress={() => router.replace('/(tabs)/dashboard')}
              variant="primary"
              size="lg"
            />
            <View style={{ height: 12 }} />
            <Button
              title="Go Back"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/dashboard');
                }
              }}
              variant="secondary"
              size="lg"
            />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  buttonContainer: {
    width: '100%',
  },
});
