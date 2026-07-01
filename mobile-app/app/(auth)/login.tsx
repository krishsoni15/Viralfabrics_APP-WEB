import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Eye, EyeOff, ChevronRight, User, Lock, Check } from 'lucide-react-native';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';
import * as Haptics from 'expo-haptics';
import { storage } from '../../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../../store/useAppStore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function LoginScreen() {
  const { theme, isDarkMode } = useTheme();
  const { login } = useAuth();
  const addToast = useAppStore((state) => state.addToast);
  const passwordInputRef = useRef<any>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved credentials and check for global logout reason on mount
  useEffect(() => {
    (async () => {
      try {
        const isRemembered = await storage.getRememberMe();
        if (isRemembered) {
          setRememberMe(true);
          const savedUsername = await storage.getSavedUsername();
          if (savedUsername) {
            setUsername(savedUsername);
          }
        }

        // Check if there was a global logout reason
        const reason = await AsyncStorage.getItem('vf_logout_reason');
        if (reason) {
          setError(reason);
          // Clear it so it doesn't show again on reload
          await AsyncStorage.removeItem('vf_logout_reason');
        }
      } catch (err) {
        console.warn('Failed to load remembered credentials / logout reason:', err);
      }
    })();
  }, []);

  // Monitor keyboard visibility to adapt the UI layout
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Shared value for login form loading slider
  const loginProgress = useSharedValue(-0.4);

  // Sync loginProgress animation to loading state changes
  useEffect(() => {
    if (loading) {
      loginProgress.value = -0.4;
      loginProgress.value = withRepeat(
        withTiming(1.2, {
          duration: 1200,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
        }),
        -1,
        false
      );
    } else {
      loginProgress.value = -0.4;
    }
  }, [loading]);

  const animatedLoginProgressStyle = useAnimatedStyle(() => {
    return {
      left: `${loginProgress.value * 100}%`,
    };
  });

  // Shared value for remember me switch toggle animation
  const switchTranslate = useSharedValue(0);

  // Sync switch translation to rememberMe state
  useEffect(() => {
    switchTranslate.value = withTiming(rememberMe ? 18 : 0, {
      duration: 200,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
    });
  }, [rememberMe]);

  const animatedSwitchThumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: switchTranslate.value }],
    };
  });

  const handleToggleRememberMe = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !rememberMe;
    setRememberMe(newValue);
    if (newValue) {
      addToast({
        type: 'info',
        title: 'Session Extended!',
        message: 'Your session will now last 30 days instead of 7 days',
      });
    }
  };

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please enter both username and password');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError('');
    setLoading(true);
    try {
      await login({ username: username.trim(), password, rememberMe });
      
      // Save or clear credentials
      if (rememberMe) {
        await storage.setRememberMe(true);
        await storage.setSavedUsername(username.trim());
      } else {
        await storage.setRememberMe(false);
        await storage.removeSavedUsername();
      }

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }, [username, password, rememberMe, login]);

  // Primary brand blue color matching the CRM system
  const primaryBlue = isDarkMode ? '#3b82f6' : '#2563eb';
  const neutralBg = isDarkMode ? '#030814' : '#e6f0fa';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: neutralBg }} edges={['bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>

            {/* Ambient Background Solid Blue (No Gradient/Glow/Blur) */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDarkMode ? '#1e3a8a' : '#2563eb' }
              ]}
            />

            <ScrollView
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >

              {/* Branding Header Section - adapts when keyboard opens */}
              <View style={[styles.headerContainer, keyboardVisible && styles.headerContainerKeyboard]}>
                {!keyboardVisible && (
                  <Animated.View
                    entering={FadeInUp.duration(400)}
                    style={styles.logoContainer}
                  >
                    <Image
                      source={require('../../assets/android-icon-foreground.png')}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </Animated.View>
                )}

                <Animated.Text
                  entering={FadeInUp.duration(400).delay(50)}
                  style={[
                    styles.appName,
                    { color: '#ffffff' },
                    keyboardVisible && styles.appNameKeyboard
                  ]}
                >
                  Viral Fabrics
                </Animated.Text>

                {!keyboardVisible && (
                  <Animated.Text
                    entering={FadeInUp.duration(400).delay(100)}
                    style={[styles.appTagline, { color: '#93c5fd' }]}
                  >
                    MPO & SUPPLIER OF: ALL TYPE OF EXPORT
                  </Animated.Text>
                )}
              </View>

              {/* Translucent Aurora Glass Form Sheet */}
              <Animated.View
                entering={FadeInDown.duration(500).delay(150)}
                style={[
                  styles.formContainer,
                  {
                    backgroundColor: isDarkMode ? '#0b0f19' : '#ffffff',
                    borderColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                    shadowColor: isDarkMode ? '#000000' : '#2563eb',
                    shadowOpacity: isDarkMode ? 0.4 : 0.05,
                    minHeight: keyboardVisible ? undefined : screenHeight - 270,
                    paddingTop: keyboardVisible ? 24 : 36,
                    paddingBottom: keyboardVisible ? 16 : 24,
                  }
                ]}
              >
                {/* Visual Accent: Top Sheet Handle Indicator */}
                <View
                  style={{
                    width: 36,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                    alignSelf: 'center',
                    marginBottom: 24,
                  }}
                />

                {/* Sleek relative progress bar shown only during login loading */}
                <View
                  style={{
                    height: 2,
                    width: '100%',
                    backgroundColor: loading ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)') : 'transparent',
                    borderRadius: 1,
                    marginTop: -12,
                    marginBottom: 20,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {loading && (
                    <Animated.View
                      style={[
                        {
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          width: '35%',
                          backgroundColor: primaryBlue,
                          borderRadius: 1,
                        },
                        animatedLoginProgressStyle
                      ]}
                    />
                  )}
                </View>

                <View style={{ marginBottom: 24 }}>
                  <Text style={[styles.welcomeText, { color: isDarkMode ? Colors.white : Colors.neutral[900] }]}>
                    Welcome Back
                  </Text>
                </View>

                {/* Pill-shaped Inputs with Blue Icons */}
                <Input
                  label="Username"
                  placeholder="Enter your username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  icon={<User size={18} color={primaryBlue} />}
                  inputContainerStyle={{
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                  }}
                />

                <View style={{ marginTop: 4, marginBottom: 24 }}>
                  <Input
                    ref={passwordInputRef}
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    icon={<Lock size={18} color={primaryBlue} />}
                    inputContainerStyle={{
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                    }}
                    rightIcon={
                      showPassword ? (
                        <EyeOff size={18} color={isDarkMode ? Colors.neutral[400] : Colors.neutral[500]} />
                      ) : (
                        <Eye size={18} color={isDarkMode ? Colors.neutral[400] : Colors.neutral[500]} />
                      )
                    }
                    onRightIconPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowPassword(!showPassword);
                    }}
                  />
                </View>

                {/* Remember Me Toggle Row */}
                <TouchableOpacity
                  onPress={handleToggleRememberMe}
                  activeOpacity={0.8}
                  style={styles.rememberMeRow}
                >
                  <Text
                    style={[
                      styles.rememberMeText,
                      { color: isDarkMode ? '#cbd5e1' : '#475569' },
                    ]}
                  >
                    Remember me
                  </Text>
                  <View
                    style={[
                      styles.switchContainer,
                      {
                        backgroundColor: rememberMe
                          ? primaryBlue
                          : isDarkMode
                          ? 'rgba(255, 255, 255, 0.08)'
                          : '#e2e8f0',
                        borderColor: rememberMe
                          ? primaryBlue
                          : isDarkMode
                          ? 'rgba(255, 255, 255, 0.15)'
                          : '#cbd5e1',
                      },
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.switchThumb,
                        {
                          backgroundColor: '#ffffff',
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.2,
                          shadowRadius: 1.5,
                          elevation: 2,
                        },
                        animatedSwitchThumbStyle,
                      ]}
                    />
                  </View>
                </TouchableOpacity>

                {/* Error Banner */}
                {error !== '' && (
                  <Animated.View entering={FadeInDown.duration(250)} style={{ marginBottom: 16 }}>
                    <View
                      style={[
                        styles.errorBanner,
                        {
                          backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                          borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                        }
                      ]}
                    >
                      <Text style={{ fontSize: 13, color: Colors.error[500], textAlign: 'center', fontWeight: '600' }}>
                        {error}
                      </Text>
                    </View>
                  </Animated.View>
                )}

                {/* Rounded Button with Indigo/Blue Color and Shadow */}
                <View style={{ marginTop: 4 }}>
                  <Button
                    title="Sign In"
                    onPress={handleLogin}
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={loading}
                    disabled={!username.trim() || !password.trim()}
                    style={{
                      borderRadius: 26,
                      height: 54,
                      backgroundColor: !username.trim() || !password.trim()
                        ? (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9')
                        : primaryBlue,
                      shadowColor: isDarkMode || !username.trim() || !password.trim() ? 'transparent' : primaryBlue,
                      shadowOffset: { width: 0, height: isDarkMode || !username.trim() || !password.trim() ? 0 : 6 },
                      shadowOpacity: isDarkMode || !username.trim() || !password.trim() ? 0 : 0.2,
                      shadowRadius: isDarkMode || !username.trim() || !password.trim() ? 0 : 12,
                      elevation: isDarkMode || !username.trim() || !password.trim() ? 0 : 4,
                    }}
                    textStyle={{
                      fontSize: 16,
                      fontWeight: '700',
                      letterSpacing: 0.5,
                      color: !username.trim() || !password.trim()
                        ? (isDarkMode ? '#475569' : '#94a3b8')
                        : '#ffffff',
                    }}
                    icon={!loading ? <ChevronRight size={18} color={!username.trim() || !password.trim() ? (isDarkMode ? '#475569' : '#94a3b8') : '#ffffff'} /> : undefined}
                    iconPosition="right"
                  />
                </View>

              </Animated.View>

            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  glowCircle: {
    position: 'absolute',
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 18 : 22,
    paddingBottom: 16,
  },
  headerContainerKeyboard: {
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 8,
  },
  logoContainer: {
    width: 175,
    height: 175,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -18,
  },
  logoImage: {
    width: 175,
    height: 175,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  appNameKeyboard: {
    fontSize: 22,
    marginBottom: 0,
  },
  appTagline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1.5,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 24,
    flex: 1,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 16,
    elevation: 8,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    marginTop: -8,
    paddingHorizontal: 4,
  },
  switchContainer: {
    width: 46,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    padding: 2,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  rememberMeText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
