import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Switch, Alert, Platform, Dimensions, useColorScheme, TextInput, Modal, KeyboardAvoidingView, Pressable, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut, FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { User, Shield, Phone, MapPin, Moon, Sun, Smartphone, LogOut, Users, FileText, ChevronRight, Lock, Clock, Activity, Trash2, Edit2, X, Camera, Image as ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { storage } from '../../utils/storage';
import { Colors } from '../../constants/colors';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { getInitials, isSuperAdmin, formatDateTime, getProfilePhotoUrl, uploadSingleImage } from '../../utils/helpers';
import api from '../../services/api';

let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker failed to load:', e);
}
import CustomCameraModal from '../../components/shared/CustomCameraModal';



function MenuItem({ icon, label, onPress, danger, isLast }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean; isLast?: boolean }) {
  const { theme, isDarkMode } = useTheme();
  return (
    <Pressable 
      onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} 
      style={({ pressed }) => ({ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 16, 
        borderBottomWidth: isLast ? 0 : 1, 
        borderBottomColor: theme.borderLight,
        opacity: pressed ? 0.6 : 1
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: danger ? Colors.error[50] : (isDarkMode ? theme.borderLight : Colors.neutral[50]), alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>{icon}</View>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: danger ? Colors.error[600] : theme.text }}>{label}</Text>
      <ChevronRight size={18} color={theme.textTertiary} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout, logoutAll, isSuperAdmin: isAdmin } = useAuth();
  const { setDarkMode, syncSystemTheme, setSyncSystemTheme, setThemePreference, setUser, addToast, isOffline } = useAppStore();
  const isMaster = user?.role === 'master';
  const systemColorScheme = useColorScheme();
  const { isLargeScreen, modalMaxWidth, containerMaxWidth } = useResponsiveLayout();

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isPhotoSheetVisible, setIsPhotoSheetVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isThemeChanging, setIsThemeChanging] = useState(false);
  const [logoutAllModalVisible, setLogoutAllModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState<number | null>(null);
  const countdownProgress = useSharedValue(1);

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${countdownProgress.value * 100}%`,
    };
  });

  const logoutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (logoutIntervalRef.current) {
        clearInterval(logoutIntervalRef.current);
      }
    };
  }, []);

  const handleRemoveProfilePhoto = async () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUploadingPhoto(true);
            try {
              const profileResponse = await api.put('/api/profile', {
                profilePhoto: ''
              });
              const updatedUser = profileResponse.data.user || profileResponse.data;
              if (updatedUser) {
                setProfilePhotoError(false);
                setUser(updatedUser);
                await storage.setUser(updatedUser);
                addToast({ type: 'success', title: 'Profile Updated', message: 'Your profile photo has been removed.' });
              }
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || 'Failed to remove photo';
              Alert.alert('Error', msg);
            } finally {
              setUploadingPhoto(false);
              setIsPhotoSheetVisible(false);
            }
          }
        }
      ]
    );
  };

  const handleChoosePhotoSource = () => {
    setIsPhotoSheetVisible(true);
  };

  const pickProfileImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Image picker is not available on this platform/device');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to pick image: ' + err.message);
    }
  };

  const uploadProfilePhoto = async (localUri: string) => {
    setUploadingPhoto(true);
    try {
      const uploadedUrl = await uploadSingleImage(localUri, 'profiles');
      if (!uploadedUrl) {
        throw new Error('Upload succeeded but no URL returned');
      }

      const profileResponse = await api.put('/api/profile', {
        profilePhoto: uploadedUrl
      });

      const updatedUser = profileResponse.data.user || profileResponse.data;
      if (updatedUser) {
        setProfilePhotoError(false);
        setUser(updatedUser);
        await storage.setUser(updatedUser);
        addToast({ type: 'success', title: 'Profile Updated', message: 'Your profile photo has been updated.' });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload photo';
      Alert.alert('Error', msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCameraCapture = (uris: string[]) => {
    if (uris.length > 0) {
      uploadProfilePhoto(uris[0]);
    }
  };

  // Fetch latest profile details on mount
  useEffect(() => {
    const fetchLatestProfile = async () => {
      try {
        const response = await api.get('/api/profile');
        const userData = response.data.user || response.data;
        if (userData) {
          setUser(userData);
          await storage.setUser(userData);
        }
      } catch (error) {
        console.warn('Failed to fetch latest profile:', error);
      }
    };
    fetchLatestProfile();
  }, []);

  // Sync edit form fields with the latest user object and reset image errors
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phoneNumber || '');
      setEditAddress(user.address || '');
      setProfilePhotoError(false);
    }
  }, [user]);

  const openEditModal = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phoneNumber || '');
    setEditAddress(user?.address || '');
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.put('/api/profile', {
        name: editName,
        phoneNumber: editPhone,
        address: editAddress
      });
      
      const updatedUser = response.data.user || response.data;
      setUser(updatedUser);
      await storage.setUser(updatedUser);
      setIsEditModalVisible(false);
      addToast({ type: 'success', title: 'Profile Updated', message: 'Your details have been saved.' });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleThemePreferenceChange = useCallback(async (sync: boolean, dark: boolean) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsThemeChanging(true);
    setTimeout(async () => {
      const resolvedDark = sync ? (systemColorScheme === 'dark') : dark;
      setThemePreference(sync, resolvedDark);
      await storage.setSyncSystemTheme(sync);
      if (!sync) {
        await storage.setDarkMode(dark);
      }
      setIsThemeChanging(false);
    }, 400);
  }, [systemColorScheme, setThemePreference]);

  const handleLogout = useCallback(() => {
    setLogoutModalVisible(true);
  }, []);

  const handleLogoutAll = useCallback(() => {
    setLogoutAllModalVisible(true);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, width: '100%', maxWidth: containerMaxWidth, alignSelf: 'center' }}>
        {/* Banner header */}
        <View style={{ 
          height: 120, 
          backgroundColor: isDarkMode ? '#1e1b4b' : Colors.primary[600], 
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          paddingHorizontal: 24,
          justifyContent: 'center',
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}>
          {/* Circular light glow overlay */}
          <View style={{
            position: 'absolute',
            right: -40,
            top: -40,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: isDarkMode ? '#312e81' : Colors.primary[400],
            opacity: 0.5,
          }} />
          <View style={{
            position: 'absolute',
            left: -20,
            bottom: -55,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: isDarkMode ? '#4338ca' : Colors.primary[500],
            opacity: 0.3,
          }} />
        </View>

        {/* User Card */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={{ paddingHorizontal: 16, marginTop: -40 }}>
          <Card 
            padding={20} 
            style={{ 
              borderRadius: 24, 
              borderWidth: 1, 
              borderColor: theme.border,
              backgroundColor: isDarkMode ? theme.card : Colors.white,
              shadowColor: Colors.primary[600],
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDarkMode ? 0 : 0.05,
              shadowRadius: 16,
              elevation: 4,
              position: 'relative'
            }}
          >
            {!!user?.role && (
              <Pressable 
                onPress={openEditModal}
                style={({ pressed }) => ({
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  zIndex: 10,
                  opacity: pressed ? 0.6 : 1
                })}
              >
                {isMaster ? (
                  <Edit2 size={13} color={Colors.primary[600]} />
                ) : (
                  <User size={13} color={Colors.primary[600]} />
                )}
              </Pressable>
            )}

            <View style={{ alignItems: 'center' }}>
              {/* Double-ringed glowing avatar */}
              <View style={{ position: 'relative', marginTop: -46, marginBottom: 12 }}>
                <TouchableOpacity 
                  onPress={() => {
                    if (user?.profilePhoto) {
                      setIsPreviewVisible(true);
                    } else {
                      setIsPhotoSheetVisible(true);
                    }
                  }}
                  disabled={uploadingPhoto}
                  activeOpacity={0.85}
                  style={{ 
                    width: 92, 
                    height: 92, 
                    borderRadius: 46, 
                    backgroundColor: isDarkMode ? '#2d1b54' : '#faf5ff',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderWidth: 4,
                    borderColor: isDarkMode ? theme.card : Colors.white,
                    shadowColor: Colors.primary[500], 
                    shadowOffset: { width: 0, height: 6 }, 
                    shadowOpacity: 0.25, 
                    shadowRadius: 10, 
                    elevation: 6,
                  }}
                >
                  <View style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    backgroundColor: Colors.primary[600],
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {/* Fallback initials in the background */}
                    <Text style={{ fontSize: 30, fontWeight: '800', color: Colors.white, position: 'absolute' }}>
                      {getInitials(user?.name || user?.username || 'User')}
                    </Text>
                    
                    {uploadingPhoto ? (
                      <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        <ActivityIndicator size="small" color="#ffffff" />
                      </View>
                    ) : (getProfilePhotoUrl(user?.profilePhoto) && !profilePhotoError) ? (
                      <Image 
                        source={{ uri: getProfilePhotoUrl(user?.profilePhoto), cache: 'reload' }} 
                        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
                        resizeMode="cover"
                        key={user?.profilePhoto}
                        onError={() => setProfilePhotoError(true)}
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => setIsPhotoSheetVisible(true)}
                  disabled={uploadingPhoto}
                  activeOpacity={0.85}
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    backgroundColor: isDarkMode ? '#60a5fa' : '#2563eb',
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: isDarkMode ? theme.card : Colors.white,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 3,
                    elevation: 4,
                    zIndex: 10,
                  }}
                >
                  <Camera size={12} color="#ffffff" />
                </TouchableOpacity>
              </View>
              
              <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text, letterSpacing: -0.5 }}>{user?.name || 'User'}</Text>
              <Text style={{ fontSize: 14, color: theme.textSecondary, fontWeight: '600', marginTop: 2 }}>@{user?.username}</Text>
              
              {/* Premium Status Badge */}
              <View style={{ marginTop: 10 }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? 'rgba(124, 58, 237, 0.15)' : '#faf5ff',
                  borderColor: isDarkMode ? 'rgba(124, 58, 237, 0.3)' : '#ddd6fe',
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}>
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: isOffline ? '#eab308' : '#10b981', 
                    marginRight: 6,
                  }} />
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: isDarkMode ? '#a78bfa' : '#7c3aed',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>{user?.role || 'User'}</Text>
                </View>
              </View>

              <View style={{ width: '100%', height: 1, backgroundColor: theme.borderLight, marginVertical: 14 }} />

              {/* Dashboard details grid */}
              <View style={{ width: '100%', gap: 8 }}>
                {Boolean(user?.phoneNumber) && (
                  <View style={{
                    width: '100%',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                    <Phone size={15} color={Colors.primary[600]} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: theme.textTertiary, fontWeight: '600', textTransform: 'uppercase' }}>Phone</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginTop: 1 }} numberOfLines={1}>{user?.phoneNumber}</Text>
                    </View>
                  </View>
                )}

                {Boolean(user?.address) && (
                  <View style={{
                    width: '100%',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                    <MapPin size={15} color={Colors.primary[600]} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: theme.textTertiary, fontWeight: '600', textTransform: 'uppercase' }}>Address</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginTop: 1 }} numberOfLines={1}>{user?.address}</Text>
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {Boolean(user?.lastLogin) && (
                    <View style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 16,
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Clock size={15} color={Colors.primary[600]} style={{ marginBottom: 4 }} />
                      <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '600', textTransform: 'uppercase' }}>Last Active</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text, marginTop: 2, textAlign: 'center', width: '100%' }} numberOfLines={1}>{formatDateTime(user?.lastLogin).split(',')[0]}</Text>
                    </View>
                  )}

                  {Boolean(user?.loginCount) && (
                    <View style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 16,
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Activity size={15} color={Colors.primary[600]} style={{ marginBottom: 4 }} />
                      <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '600', textTransform: 'uppercase' }}>Sessions</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginTop: 2, textAlign: 'center', width: '100%' }} numberOfLines={1}>{user?.loginCount} logins</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Settings */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: theme.textTertiary, marginBottom: 12, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Preferences</Text>
          <Card 
            style={{ 
              borderRadius: 24, 
              borderWidth: isDarkMode ? 0 : 1, 
              borderColor: theme.border,
              backgroundColor: isDarkMode ? theme.card : Colors.white,
              shadowColor: Colors.primary[600],
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDarkMode ? 0 : 0.03,
              shadowRadius: 12,
              elevation: isDarkMode ? 0 : 2,
            }} 
            padding={16}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>Interface Theme</Text>
              <View style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: isDarkMode ? 'rgba(96,165,250,0.1)' : 'rgba(37,99,235,0.06)',
              }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.primary[600], textTransform: 'uppercase' }}>
                  {syncSystemTheme ? 'System' : (isDarkMode ? 'Dark' : 'Light')}
                </Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderRadius: 16, padding: 4, gap: 4 }}>
              {/* Light Option */}
              <Pressable
                onPress={() => {
                  handleThemePreferenceChange(false, false);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: (!syncSystemTheme && !isDarkMode) ? (isDarkMode ? '#334155' : '#ffffff') : 'transparent',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: (!syncSystemTheme && !isDarkMode) ? 0.05 : 0,
                  shadowRadius: 4,
                  elevation: (!syncSystemTheme && !isDarkMode) ? (isDarkMode ? 0 : 1) : 0,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Sun size={18} color={(!syncSystemTheme && !isDarkMode) ? (isDarkMode ? '#a78bfa' : '#4f46e5') : theme.textSecondary} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: (!syncSystemTheme && !isDarkMode) ? theme.text : theme.textSecondary,
                  marginLeft: 8
                }}>Light</Text>
              </Pressable>

              {/* Dark Option */}
              <Pressable
                onPress={() => {
                  handleThemePreferenceChange(false, true);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: (!syncSystemTheme && isDarkMode) ? (isDarkMode ? '#334155' : '#ffffff') : 'transparent',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: (!syncSystemTheme && isDarkMode) ? 0.05 : 0,
                  shadowRadius: 4,
                  elevation: (!syncSystemTheme && isDarkMode) ? (isDarkMode ? 0 : 1) : 0,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Moon size={18} color={(!syncSystemTheme && isDarkMode) ? (isDarkMode ? '#a78bfa' : '#4f46e5') : theme.textSecondary} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: (!syncSystemTheme && isDarkMode) ? theme.text : theme.textSecondary,
                  marginLeft: 8
                }}>Dark</Text>
              </Pressable>

              {/* System Option */}
              <Pressable
                onPress={() => {
                  handleThemePreferenceChange(true, systemColorScheme === 'dark');
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: syncSystemTheme ? (isDarkMode ? '#334155' : '#ffffff') : 'transparent',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: syncSystemTheme ? 0.05 : 0,
                  shadowRadius: 4,
                  elevation: syncSystemTheme ? (isDarkMode ? 0 : 1) : 0,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Smartphone size={18} color={syncSystemTheme ? (isDarkMode ? '#a78bfa' : '#4f46e5') : theme.textSecondary} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: syncSystemTheme ? theme.text : theme.textSecondary,
                  marginLeft: 8
                }}>System</Text>
              </Pressable>
            </View>
          </Card>
        </Animated.View>


        {/* Logout */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)} style={{ paddingHorizontal: 16, marginTop: 28 }}>
          <Pressable 
            onPress={handleLogout} 
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
              borderColor: isDarkMode ? 'transparent' : '#fecaca',
              borderWidth: isDarkMode ? 0 : 1,
              height: 56,
              borderRadius: 20,
              gap: 10,
              width: '100%',
              shadowColor: Colors.error[500],
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDarkMode ? 0 : 0.04,
              shadowRadius: 8,
              elevation: isDarkMode ? 0 : 2,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <LogOut size={20} color={isDarkMode ? '#ef4444' : '#dc2626'} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: isDarkMode ? '#f87171' : '#b91c1c' }}>Sign Out</Text>
          </Pressable>

          <Pressable 
            onPress={handleLogoutAll} 
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              borderColor: theme.border,
              borderWidth: 1.5,
              height: 56,
              borderRadius: 20,
              gap: 10,
              marginTop: 12,
              width: '100%',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Lock size={18} color={theme.textSecondary} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textSecondary }}>Sign Out All Devices</Text>
          </Pressable>
          
          <Text style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: theme.textTertiary, fontWeight: '600', letterSpacing: 0.5 }}>VIRAL FABRICS CRM v1.0.0</Text>
        </Animated.View>
        </View>
      </ScrollView>
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.15)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', maxWidth: modalMaxWidth }}
          >
            <Card 
              style={{
                borderRadius: 28,
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderWidth: 1,
                borderColor: theme.border,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 20,
                elevation: 10,
                padding: 24,
                position: 'relative',
              }}
            >
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsEditModalVisible(false);
                }}
                style={({ pressed }) => ({
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  zIndex: 20,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <X size={16} color={theme.textSecondary} />
              </Pressable>

              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 4 }}>{isMaster ? 'Edit Profile' : 'Profile Details'}</Text>
              <Text style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 20 }}>{isMaster ? 'Update your contact information' : 'Your account details (Read Only)'}</Text>

              <View style={{ gap: 16 }}>
                {/* Username */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, marginLeft: 4 }}>Username (Not Editable)</Text>
                  <TextInput
                    style={{
                      height: 48,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      fontSize: 15,
                      color: theme.textTertiary,
                      backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                      opacity: 0.65,
                    }}
                    value={user?.username || ''}
                    editable={false}
                    selectTextOnFocus={false}
                  />
                </View>

                {/* Password */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, marginLeft: 4 }}>Password (Not Editable)</Text>
                  <TextInput
                    style={{
                      height: 48,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      fontSize: 15,
                      color: theme.textTertiary,
                      backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                      opacity: 0.65,
                    }}
                    value="••••••••"
                    secureTextEntry={true}
                    editable={false}
                    selectTextOnFocus={false}
                  />
                </View>

                {/* Name */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, marginLeft: 4 }}>Full Name</Text>
                  <TextInput
                    style={{
                      height: 48,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      fontSize: 15,
                      color: isMaster ? theme.text : theme.textTertiary,
                      backgroundColor: isMaster ? (isDarkMode ? '#0f172a' : '#f8fafc') : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                      opacity: isMaster ? 1 : 0.65,
                    }}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Enter full name"
                    placeholderTextColor={theme.textTertiary}
                    editable={isMaster}
                  />
                </View>

                {/* Phone */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, marginLeft: 4 }}>Phone Number</Text>
                  <TextInput
                    style={{
                      height: 48,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      fontSize: 15,
                      color: isMaster ? theme.text : theme.textTertiary,
                      backgroundColor: isMaster ? (isDarkMode ? '#0f172a' : '#f8fafc') : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                      opacity: isMaster ? 1 : 0.65,
                    }}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="Enter phone number"
                    placeholderTextColor={theme.textTertiary}
                    keyboardType="phone-pad"
                    editable={isMaster}
                  />
                </View>



                {/* Address */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, marginLeft: 4 }}>Address</Text>
                  <TextInput
                    style={{
                      height: 80,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingTop: 12,
                      fontSize: 15,
                      color: isMaster ? theme.text : theme.textTertiary,
                      backgroundColor: isMaster ? (isDarkMode ? '#0f172a' : '#f8fafc') : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                      opacity: isMaster ? 1 : 0.65,
                    }}
                    value={editAddress}
                    onChangeText={setEditAddress}
                    placeholder="Enter address"
                    placeholderTextColor={theme.textTertiary}
                    multiline
                    numberOfLines={3}
                    editable={isMaster}
                  />
                </View>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                {isMaster ? (
                  <>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setIsEditModalVisible(false);
                      }}
                      style={({ pressed }) => ({
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: theme.border,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleSaveProfile();
                      }}
                      disabled={isSubmitting}
                      style={({ pressed }) => ({
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: Colors.primary[600],
                        opacity: pressed || isSubmitting ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsEditModalVisible(false);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: 48,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: Colors.primary[600],
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Close</Text>
                  </Pressable>
                )}
              </View>
            </Card>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* Custom Profile photo preview modal */}
      <Modal
        visible={isPreviewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPreviewVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {/* Header */}
          <View style={{
            position: 'absolute',
            top: insets.top > 0 ? insets.top + 8 : 20,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            zIndex: 10,
          }}>
            <TouchableOpacity
              onPress={() => setIsPreviewVisible(false)}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.15)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <X size={20} color="#fff" />
            </TouchableOpacity>
            
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Profile Photo</Text>
            {/* Camera button disabled/hidden as the image itself is clickable */}
            <View style={{ width: 40, height: 40 }} />
          </View>

          {/* Main Photo Card */}
          <View style={{ alignItems: 'center', width: '100%', paddingHorizontal: 24 }}>
            <TouchableOpacity
              onPress={() => {
                setIsPreviewVisible(false);
                setIsPhotoSheetVisible(true);
              }}
              activeOpacity={0.9}
              style={{
                width: 280,
                height: 280,
                borderRadius: 140,
                backgroundColor: isDarkMode ? '#1e1b4b' : Colors.primary[600],
                borderWidth: 4,
                borderColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                shadowColor: '#fff',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
                elevation: 8,
                marginBottom: 24,
              }}
            >
              {getProfilePhotoUrl(user?.profilePhoto) && !profilePhotoError ? (
                <Image 
                  source={{ uri: getProfilePhotoUrl(user?.profilePhoto), cache: 'reload' }} 
                  style={{ width: '100%', height: '100%' }} 
                  resizeMode="cover"
                  key={user?.profilePhoto}
                  onError={() => setProfilePhotoError(true)}
                />
              ) : (
                <Text style={{ fontSize: 96, fontWeight: '800', color: '#fff' }}>
                  {getInitials(user?.name || user?.username || 'User')}
                </Text>
              )}
            </TouchableOpacity>
            
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{user?.name || 'User'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>@{user?.username}</Text>
          </View>
        </View>
      </Modal>

      {/* Custom Edit Options Action Sheet (Modal) */}
      <Modal
        visible={isPhotoSheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPhotoSheetVisible(false)}
      >
        <Pressable 
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.15)',
            justifyContent: isLargeScreen ? 'center' : 'flex-end',
            alignItems: isLargeScreen ? 'center' : 'stretch',
          }}
          onPress={() => setIsPhotoSheetVisible(false)}
        >
          <View 
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: isLargeScreen ? 24 : 0,
              borderBottomRightRadius: isLargeScreen ? 24 : 0,
              padding: 20,
              paddingBottom: isLargeScreen ? 24 : (Platform.OS === 'ios' ? 34 : 24) + insets.bottom,
              width: '100%',
              maxWidth: modalMaxWidth,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 16,
            }} />
            
            <Text style={{
              fontSize: 16,
              fontWeight: '800',
              color: theme.text,
              textAlign: 'center',
              marginBottom: 20,
            }}>Edit Profile Photo</Text>

            <View style={{ gap: 12 }}>
              {/* Take Photo */}
              <TouchableOpacity
                onPress={() => {
                  setIsPhotoSheetVisible(false);
                  setCameraVisible(true);
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <Camera size={18} color={Colors.primary[600]} style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Take Photo (Camera)</Text>
              </TouchableOpacity>

              {/* Choose Gallery */}
              <TouchableOpacity
                onPress={() => {
                  setIsPhotoSheetVisible(false);
                  pickProfileImage();
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <ImageIcon size={18} color={Colors.primary[600]} style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Choose from Gallery</Text>
              </TouchableOpacity>

              {/* Remove Photo */}
              {Boolean(user?.profilePhoto) && (
                <TouchableOpacity
                  onPress={handleRemoveProfilePhoto}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.05)' : '#fee2e2',
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fecaca',
                  }}
                >
                  <Trash2 size={18} color={isDarkMode ? '#ef4444' : '#dc2626'} style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#f87171' : '#b91c1c' }}>Remove Current Photo</Text>
                </TouchableOpacity>
              )}

              {/* Cancel */}
              <TouchableOpacity
                onPress={() => setIsPhotoSheetVisible(false)}
                activeOpacity={0.7}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                  marginTop: 8,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Camera Modal */}
      <CustomCameraModal visible={cameraVisible} onClose={() => setCameraVisible(false)} onPhotosCaptured={handleCameraCapture} singlePhoto={true} />

      {/* Custom Logout Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isLoggingOut) setLogoutModalVisible(false);
        }}
      >
        <Pressable 
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}
          onPress={() => {
            if (!isLoggingOut) setLogoutModalVisible(false);
          }}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 340,
              borderRadius: 24,
              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
              borderWidth: 1,
              borderColor: theme.border,
              padding: 24,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 15,
              elevation: 10,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header Icon */}
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 16,
            }}>
              <LogOut size={24} color={isDarkMode ? '#ef4444' : '#dc2626'} />
            </View>

            <Text style={{
              fontSize: 20,
              fontWeight: '800',
              color: theme.text,
              textAlign: 'center',
              marginBottom: 8,
            }}>
              Sign Out
            </Text>

            <Text style={{
              fontSize: 14,
              color: theme.textSecondary,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}>
              Are you sure you want to sign out of your account?
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLogoutModalVisible(false);
                }}
                disabled={isLoggingOut}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  opacity: isLoggingOut ? 0.6 : 1,
                }}
              >
                <Text style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: theme.textSecondary,
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setIsLoggingOut(true);
                  try {
                    await logout();
                  } catch (err) {
                    console.error('Logout error:', err);
                  } finally {
                    setIsLoggingOut(false);
                    setLogoutModalVisible(false);
                  }
                }}
                disabled={isLoggingOut}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: '#ef4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isLoggingOut ? 0.8 : 1,
                }}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#ffffff',
                  }}>
                    Sign Out
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Custom Logout All Devices Confirmation Modal */}
      <Modal
        visible={logoutAllModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isLoggingOutAll) setLogoutAllModalVisible(false);
        }}
      >
        <Pressable 
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}
          onPress={() => {
            if (!isLoggingOutAll) setLogoutAllModalVisible(false);
          }}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 340,
              borderRadius: 24,
              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
              borderWidth: 1,
              borderColor: theme.border,
              padding: 24,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 15,
              elevation: 10,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {isLoggingOutAll ? (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <ActivityIndicator size="large" color="#ef4444" style={{ marginBottom: 20 }} />
                <Text style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: theme.text,
                  textAlign: 'center',
                  marginBottom: 8,
                }}>
                  Signing Out All Devices
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: theme.textSecondary,
                  textAlign: 'center',
                  lineHeight: 20,
                  marginBottom: 24,
                }}>
                  Disconnecting all active sessions in {logoutCountdown ?? 3}s...
                </Text>
                
                {/* Progress bar container */}
                <View style={{
                  width: '100%',
                  height: 6,
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                  borderRadius: 3,
                  overflow: 'hidden'
                }}>
                  <Animated.View style={[
                    {
                      height: '100%',
                      backgroundColor: '#ef4444',
                      borderRadius: 3
                    },
                    animatedProgressStyle
                  ]} />
                </View>
              </View>
            ) : (
              <>
                {/* Header Icon */}
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'center',
                  marginBottom: 16,
                }}>
                  <Lock size={24} color={isDarkMode ? '#ef4444' : '#dc2626'} />
                </View>

                <Text style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: theme.text,
                  textAlign: 'center',
                  marginBottom: 8,
                }}>
                  Sign Out All Devices
                </Text>

                <Text style={{
                  fontSize: 14,
                  color: theme.textSecondary,
                  textAlign: 'center',
                  lineHeight: 20,
                  marginBottom: 24,
                }}>
                  This will sign out all users from all sessions and devices. Are you sure you want to continue?
                </Text>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setLogoutAllModalVisible(false);
                    }}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                    }}
                  >
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: theme.textSecondary,
                    }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setIsLoggingOutAll(true);
                      setLogoutCountdown(3);
                      countdownProgress.value = 1;
                      countdownProgress.value = withTiming(0, { duration: 3000 });
                      
                      let timeLeft = 3;
                      if (logoutIntervalRef.current) clearInterval(logoutIntervalRef.current);
                      logoutIntervalRef.current = setInterval(async () => {
                        timeLeft -= 1;
                        setLogoutCountdown(timeLeft);
                        if (timeLeft <= 0) {
                          if (logoutIntervalRef.current) {
                            clearInterval(logoutIntervalRef.current);
                            logoutIntervalRef.current = null;
                          }
                          try {
                            await logoutAll();
                          } catch (err) {
                            console.error('Logout all error:', err);
                          } finally {
                            setIsLoggingOutAll(false);
                            setLogoutAllModalVisible(false);
                            setLogoutCountdown(null);
                          }
                        }
                      }, 1000);
                    }}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: '#ef4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: '#ffffff',
                    }}>
                      Sign Out All
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Theme switching loading indicator */}
      {isThemeChanging && (
        <Modal transparent animationType="fade" visible={isThemeChanging}>
          <View style={{
            flex: 1,
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <View style={{
              padding: 24,
              borderRadius: 16,
              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 5,
            }}>
              <ActivityIndicator size="small" color={Colors.primary[600]} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>
                Updating Theme...
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
