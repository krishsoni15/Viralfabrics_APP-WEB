import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, RefreshControl, Platform, TextInput,
  TouchableOpacity, StyleSheet, Modal, Alert, KeyboardAvoidingView, ScrollView, Switch,
  PanResponder, Animated as RNAnimated, Dimensions, Image, ActivityIndicator, Pressable,
  useWindowDimensions, StatusBar
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useSegments } from 'expo-router';
import {
  Users, Shield, Search, Clock, Briefcase, Plus,
  Edit3, Trash2, X, Eye, EyeOff, ChevronLeft, UserPlus, CheckCircle,
  ChevronDown, SlidersHorizontal, ArrowUpDown, ChevronRight, Filter, Phone, MapPin, Camera, User as UserIcon, Image as ImageIcon
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import api from '../../services/api';
import Header from '../../components/shared/Header';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { UserSkeletonList, UserSkeletonCard } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { User } from '../../types';
import { formatDateTime, getInitials, getProfilePhotoUrl, uploadSingleImage } from '../../utils/helpers';
import { useAppStore } from '../../store/useAppStore';
import { storage } from '../../utils/storage';

let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker failed to load:', e);
}
import CustomCameraModal from '../../components/shared/CustomCameraModal';

const ROLES = ['user', 'admin', 'superadmin', 'weaver', 'party'];

const UserAvatar = ({ 
  photoUrl, 
  name, 
  avatarBg, 
  avatarColor, 
  size = 42, 
  borderRadius = 12,
  fontSize = 15,
  style = {}
}: { 
  photoUrl: string | null | undefined; 
  name: string; 
  avatarBg: string; 
  avatarColor: string; 
  size?: number; 
  borderRadius?: number;
  fontSize?: number;
  style?: any;
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [photoUrl]);

  return (
    <View style={[{ 
      width: size, 
      height: size, 
      borderRadius: borderRadius, 
      backgroundColor: avatarBg, 
      borderWidth: 1, 
      borderColor: avatarColor, 
      alignItems: 'center', 
      justifyContent: 'center', 
      overflow: 'hidden', 
      position: 'relative' 
    }, style]}>
      {getInitials(name) !== '?' ? (
        <Text style={{ fontSize: fontSize, fontWeight: '800', color: avatarColor, position: 'absolute' }}>
          {getInitials(name)}
        </Text>
      ) : (
        <UserIcon size={size * 0.45} color={avatarColor} style={{ position: 'absolute' }} />
      )}
      {!!photoUrl && !hasError && (
        <Image 
          source={{ uri: photoUrl, cache: 'reload' }} 
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
          onError={() => setHasError(true)}
        />
      )}
    </View>
  );
};

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const isInTabs = (segments as string[]).includes('(tabs)');
  const { theme, isDarkMode } = useTheme();
  const { isLargeScreen, modalMaxWidth, containerMaxWidth, numColumns } = useResponsiveLayout();
  const { isSuperAdmin, user: currentUser } = useAuth();
  const isMaster = currentUser?.role === 'master';
  const queryClient = useQueryClient();

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Animated values for draggable FAB (initially positioned closer to the bottom edge)
  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 76, y: screenHeight - 220 })).current;
  const fabX = useRef(screenWidth - 76);
  const fabY = useRef(screenHeight - 220);

  const dimensionsRef = useRef({ screenWidth, screenHeight });
  dimensionsRef.current = { screenWidth, screenHeight };

  useEffect(() => {
    const isSnappedLeft = fabX.current < screenWidth / 2;
    const targetX = isSnappedLeft ? 20 : screenWidth - 76;
    const targetY = Math.min(Math.max(fabY.current, 100), screenHeight - 220);
    
    fabX.current = targetX;
    fabY.current = targetY;
    
    RNAnimated.spring(pan, {
      toValue: { x: targetX, y: targetY },
      useNativeDriver: false,
      friction: 6,
    }).start();
  }, [screenWidth, screenHeight, insets.bottom]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: fabX.current,
          y: fabY.current
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: RNAnimated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (e, gestureState) => {
        pan.flattenOffset();

        const currentScreenWidth = dimensionsRef.current.screenWidth;
        const currentScreenHeight = dimensionsRef.current.screenHeight;
        
        const currentX = fabX.current + gestureState.dx;
        const currentY = fabY.current + gestureState.dy;
        
        const snapLeftX = 20;
        const snapRightX = currentScreenWidth - 76;
        const targetX = currentX < currentScreenWidth / 2 ? snapLeftX : snapRightX;
        
        const minY = 100;
        const maxY = currentScreenHeight - 220;
        const targetY = Math.min(Math.max(currentY, minY), maxY);
        
        fabX.current = targetX;
        fabY.current = targetY;
        
        RNAnimated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 6,
        }).start();
      }
    })
  ).current;

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '', username: '', password: '', phoneNumber: '', address: '', role: 'user', partyId: '', profilePhoto: ''
  });
  const [cameraVisible, setCameraVisible] = useState(false);
  const [uploadingFormPhoto, setUploadingFormPhoto] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isPhotoSheetVisible, setIsPhotoSheetVisible] = useState(false);
  const [previewUser, setPreviewUser] = useState<any>(null);
  const [isUserListPreviewVisible, setIsUserListPreviewVisible] = useState(false);
  // Filters & Pagination States
  const [roleFilter, setRoleFilter] = useState('all');
  const [dateSort, setDateSort] = useState<'latest' | 'oldest'>('latest');
  const [visibleCount, setVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  // Dropdown Picker Visibility States
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showFormRolePicker, setShowFormRolePicker] = useState(false);
  const [showFormPartyPicker, setShowFormPartyPicker] = useState(false);

  const activeFiltersCount = useMemo(() => {
    return (roleFilter !== 'all' ? 1 : 0) + (dateSort !== 'latest' ? 1 : 0);
  }, [roleFilter, dateSort]);

  // States for Party Selection & creation
  const [partySearch, setPartySearch] = useState('');
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [newPartyForm, setNewPartyForm] = useState({
    name: '', contactName: '', contactPhone: '', address: ''
  });
  const [partyFormErrors, setPartyFormErrors] = useState<Record<string, string>>({});

  const pickerTranslateY = useRef(new RNAnimated.Value(0)).current;

  const formScrollViewRef = useRef<ScrollView>(null);
  const addPartyScrollViewRef = useRef<ScrollView>(null);

  const scrollToFormEnd = () => {
    setTimeout(() => {
      formScrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const scrollToAddPartyEnd = () => {
    setTimeout(() => {
      addPartyScrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const pickerScrollOffset = useRef(0);
  const pickerCapturedDy = useRef(0);

  const pickerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return pickerScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return pickerScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onPanResponderGrant: (_, gs) => {
        pickerCapturedDy.current = gs.dy;
      },
      onPanResponderMove: (_, gestureState) => {
        const dragY = gestureState.dy - pickerCapturedDy.current;
        const translateY = dragY < 0 ? dragY * 0.22 : dragY;
        pickerTranslateY.setValue(translateY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const dragY = gestureState.dy - pickerCapturedDy.current;
        if (dragY > 120 || gestureState.vy > 0.55) {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          RNAnimated.timing(pickerTranslateY, {
            toValue: 500,
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            setShowFormRolePicker(false);
            setShowFormPartyPicker(false);
            setShowFiltersModal(false);
            pickerTranslateY.setValue(0);
          });
        } else {
          RNAnimated.spring(pickerTranslateY, {
            toValue: 0,
            useNativeDriver: false,
            stiffness: 300,
            damping: 30,
            mass: 1,
          }).start();
        }
      }
    })
  ).current;

  useEffect(() => {
    if (showFormRolePicker || showFormPartyPicker || showFiltersModal) {
      pickerTranslateY.setValue(0);
      pickerScrollOffset.current = 0;
    }
  }, [showFormRolePicker, showFormPartyPicker, showFiltersModal]);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/users-instant?limit=1000&t=' + Date.now());
        if (Array.isArray(data)) return data;
        if (data?.users && Array.isArray(data.users)) return data.users;
        if (data?.data) {
          if (Array.isArray(data.data)) return data.data;
          if (data.data?.users && Array.isArray(data.data.users)) return data.data.users;
        }
        return [];
      } catch (error) {
        console.warn('Users API error, loading mock users.', error);
        return [
          { _id: 'u-1', name: 'Master User', username: 'master', role: 'superadmin', isActive: true, lastLogin: new Date().toISOString(), createdAt: new Date().toISOString() },
          { _id: 'u-2', name: 'Krish Soni', username: 'krish', role: 'admin', isActive: true, lastLogin: new Date(Date.now() - 3600000 * 2).toISOString(), createdAt: new Date().toISOString() },
        ];
      }
    },
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });

  const partiesQuery = useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/parties');
        if (Array.isArray(data)) return data;
        if (data?.data && Array.isArray(data.data)) return data.data;
        if (data?.parties && Array.isArray(data.parties)) return data.parties;
        return [];
      } catch (error) {
        console.warn('Parties API error', error);
        return [];
      }
    },
    staleTime: 30000,
  });

  const parties = partiesQuery.data || [];

  const availableRoles = useMemo(() => {
    const baseRoles = ['user', 'party', 'superadmin'];
    
    // Master can assign any role
    let roles = isMaster 
      ? ['user', 'party', 'superadmin', 'master', 'admin', 'weaver'] 
      : baseRoles;
      
    // If editing a user and their current role is not in the list, keep it
    if (selectedUser && !roles.includes(selectedUser.role)) {
      roles = [...roles, selectedUser.role];
    }
    if (formData.role && !roles.includes(formData.role)) {
      roles = [...roles, formData.role];
    }
    
    return Array.from(new Set(roles));
  }, [isMaster, selectedUser, formData.role]);

  // Create User mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = { ...data };
      if (payload.role !== 'party') {
        delete payload.partyId;
      }
      const res = await api.post('/api/users', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateModal(false);
      resetForm();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useAppStore.getState().addToast({
        type: 'success',
        title: 'User Created',
        message: 'The new user account has been created successfully.',
      });
    },
  });

  // Update User mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const updateData = { ...data };
      if (!updateData.password?.trim()) delete updateData.password;
      if (updateData.role !== 'party') {
        updateData.partyId = null;
      }
      const res = await api.put(`/api/users/${id}`, updateData);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      const currentUser = useAppStore.getState().user;
      if (currentUser && selectedUser && selectedUser._id === currentUser._id) {
        const updatedUser = data?.user || data;
        if (updatedUser) {
          useAppStore.getState().setUser(updatedUser);
          storage.setUser(updatedUser);
        }
      }

      setShowEditModal(false);
      setSelectedUser(null);
      resetForm();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useAppStore.getState().addToast({
        type: 'success',
        title: 'User Updated',
        message: 'The user account details have been updated successfully.',
      });
    },
  });

  // Delete User mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowDeleteModal(false);
      setSelectedUser(null);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useAppStore.getState().addToast({
        type: 'success',
        title: 'User Deleted',
        message: 'The user account has been deleted successfully.',
      });
    },
  });

  const users = usersQuery.data || [];

  const filteredUsers = useMemo(() => {
    let result = [...users];

    // 1. Text Search Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((u: any) =>
        u.name?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query) ||
        u.role?.toLowerCase().includes(query) ||
        (u.phoneNumber && u.phoneNumber.includes(query)) ||
        (u.address && u.address.toLowerCase().includes(query))
      );
    }

    // 2. Role Filter
    if (roleFilter !== 'all') {
      result = result.filter((u: any) => u.role === roleFilter);
    }

    // 3. Date Sort
    result.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || a.lastLogin || 0).getTime();
      const dateB = new Date(b.createdAt || b.lastLogin || 0).getTime();
      return dateSort === 'latest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [users, searchQuery, roleFilter, dateSort]);
  // Reset visibleCount on filter change
  useEffect(() => {
    setVisibleCount(10);
  }, [searchQuery, roleFilter, dateSort]);

  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(0, visibleCount);
  }, [filteredUsers, visibleCount]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;
    if (filteredUsers.length > visibleCount) {
      setIsLoadingMore(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => {
        setVisibleCount(prev => Math.min(prev + 10, filteredUsers.length));
        setIsLoadingMore(false);
      }, 800);
    }
  }, [filteredUsers.length, visibleCount, isLoadingMore]);

  // Render Pagination Controls (Top or Bottom)
  const renderPaginationControls = (position: 'top' | 'bottom') => {
    if (filteredUsers.length === 0) return null;
    if (position === 'bottom') {
      if (isLoadingMore) {
        return (
          <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={Colors.primary[500]} />
          </View>
        );
      }
      if (visibleCount >= filteredUsers.length && filteredUsers.length > 0) {
        return (
          <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
              No more users to load
            </Text>
          </View>
        );
      }
      return null;
    }
    return (
      <View style={{
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%'
      }}>
        {/* Pagination Info & Dropdown Row */}
        <Text style={[styles.paginationInfoText, { color: theme.textSecondary, fontWeight: '700' }]}>
          Total Users: <Text style={{ fontWeight: '800', color: Colors.primary[600] }}>{filteredUsers.length}</Text>
        </Text>
      </View>
    );
  };
  const renderSelectionModal = (
    visible: boolean,
    onClose: () => void,
    options: { label: string; value: string }[],
    selectedValue: string,
    onSelect: (value: any) => void,
    title: string
  ) => {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.05)',
            justifyContent: isLargeScreen ? 'center' : 'flex-end',
            alignItems: isLargeScreen ? 'center' : 'stretch',
          }}
        >
          <RNAnimated.View
            {...pickerPanResponder.panHandlers}
            style={{
              width: '100%',
              maxWidth: modalMaxWidth,
              maxHeight: '50%',
              transform: isLargeScreen ? undefined : [{ translateY: pickerTranslateY }],
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{
                backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: isLargeScreen ? 24 : 0,
                borderBottomRightRadius: isLargeScreen ? 24 : 0,
                paddingTop: 16,
                paddingBottom: isLargeScreen ? 24 : (Platform.OS === 'ios' ? 34 : 24) + insets.bottom,
                borderTopWidth: 1,
                borderTopColor: borderColor,
                width: '100%',
              }}
            >
              {/* Header Drag Zone */}
              <View style={{ width: '100%' }}>
                {/* Header indicator bar */}
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 16 }} />
                
                <View style={{ paddingHorizontal: 20, marginBottom: 16, paddingRight: 60, width: '100%' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{title}</Text>
                </View>
              </View>

              {/* Close Button absolute */}
              <TouchableOpacity
                onPress={onClose}
                style={{
                  position: 'absolute',
                  top: 32,
                  right: 20,
                  padding: 4,
                  zIndex: 10,
                }}
              >
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              <ScrollView
                style={{ paddingHorizontal: 16 }}
                scrollEventThrottle={16}
                onScroll={(e) => { pickerScrollOffset.current = e.nativeEvent.contentOffset.y; }}
              >
                {options.map((opt) => {
                  const isSelected = selectedValue === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onSelect(opt.value);
                        onClose();
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)') : 'transparent',
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text,
                        }}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && <Shield size={16} color={isDarkMode ? '#60a5fa' : '#2563eb'} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </TouchableOpacity>
          </RNAnimated.View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderFiltersModal = () => {
    return (
      <Modal
        visible={showFiltersModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowFiltersModal(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.05)',
            justifyContent: isLargeScreen ? 'center' : 'flex-end',
            alignItems: isLargeScreen ? 'center' : 'stretch',
          }}
        >
          <RNAnimated.View
            {...pickerPanResponder.panHandlers}
            style={{
              width: '100%',
              maxWidth: modalMaxWidth,
              maxHeight: '75%',
              transform: isLargeScreen ? undefined : [{ translateY: pickerTranslateY }],
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{
                backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: isLargeScreen ? 24 : 0,
                borderBottomRightRadius: isLargeScreen ? 24 : 0,
                paddingTop: 16,
                paddingBottom: isLargeScreen ? 24 : (Platform.OS === 'ios' ? 34 : 24) + insets.bottom,
                borderTopWidth: 1,
                borderTopColor: borderColor,
                width: '100%',
              }}
            >
              {/* Header Drag Zone */}
              <View style={{ width: '100%' }}>
                {/* Header indicator bar */}
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 16 }} />
                
                <View style={{ paddingHorizontal: 20, marginBottom: 16, paddingRight: 60, width: '100%' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Filters</Text>
                </View>
              </View>

              {/* Close Button absolute */}
              <TouchableOpacity
                onPress={() => setShowFiltersModal(false)}
                style={{
                  position: 'absolute',
                  top: 32,
                  right: 20,
                  padding: 4,
                  zIndex: 10,
                }}
              >
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              <ScrollView
                style={{ paddingHorizontal: 20 }}
                scrollEventThrottle={16}
                onScroll={(e) => { pickerScrollOffset.current = e.nativeEvent.contentOffset.y; }}
              >
                {/* Role Filter Section */}
                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textTertiary, marginBottom: 12, letterSpacing: 0.5 }}>FILTER BY ROLE</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {['all', ...(isMaster ? ['master'] : []), 'superadmin', 'user', 'party'].map((r) => {
                    const isSelected = roleFilter === r;
                    const label = r === 'all' ? 'All Roles' : r === 'superadmin' ? 'Super Admin' : r.charAt(0).toUpperCase() + r.slice(1);
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setRoleFilter(r);
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: isSelected 
                            ? (isDarkMode ? '#60a5fa' : '#2563eb') 
                            : (isDarkMode ? '#334155' : '#e2e8f0'),
                          backgroundColor: isSelected 
                            ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)') 
                            : 'transparent'
                        }}
                      >
                        <Text style={{
                          fontSize: 13,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected 
                            ? (isDarkMode ? '#60a5fa' : '#2563eb') 
                            : theme.textSecondary
                        }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Sort Section */}
                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textTertiary, marginBottom: 12, letterSpacing: 0.5 }}>SORT ORDER</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                  {[
                    { label: 'Latest First', value: 'latest' },
                    { label: 'Oldest First', value: 'oldest' }
                  ].map((s) => {
                    const isSelected = dateSort === s.value;
                    return (
                      <TouchableOpacity
                        key={s.value}
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setDateSort(s.value as any);
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: isSelected 
                            ? (isDarkMode ? '#60a5fa' : '#2563eb') 
                            : (isDarkMode ? '#334155' : '#e2e8f0'),
                          backgroundColor: isSelected 
                            ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)') 
                            : 'transparent'
                        }}
                      >
                        <Text style={{
                          fontSize: 13,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected 
                            ? (isDarkMode ? '#60a5fa' : '#2563eb') 
                            : theme.textSecondary
                        }}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Action Buttons */}
                {activeFiltersCount > 0 && (
                  <View style={{ marginTop: 10, width: '100%' }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setRoleFilter('all');
                        setDateSort('latest');
                      }}
                      style={{
                        width: '100%',
                        height: 48,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: '#ef4444',
                        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#ef4444' }}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </TouchableOpacity>
          </RNAnimated.View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderFormPartySelectionModal = () => {
    const filteredParties = parties.filter((p: any) =>
      p.name?.toLowerCase().includes(partySearch.toLowerCase())
    );

    return (
      <Modal
        visible={showFormPartyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFormPartyPicker(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowFormPartyPicker(false)}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.05)',
              justifyContent: isLargeScreen ? 'center' : 'flex-end',
              alignItems: isLargeScreen ? 'center' : 'stretch',
            }}
          >
            <RNAnimated.View
              {...pickerPanResponder.panHandlers}
              style={{
                width: '100%',
                maxWidth: modalMaxWidth,
                maxHeight: '85%',
                minHeight: '50%',
                transform: isLargeScreen ? undefined : [{ translateY: pickerTranslateY }],
              }}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{
                  backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  borderBottomLeftRadius: isLargeScreen ? 24 : 0,
                  borderBottomRightRadius: isLargeScreen ? 24 : 0,
                  paddingTop: 16,
                  paddingBottom: isLargeScreen ? 24 : (Platform.OS === 'ios' ? 34 : 24) + insets.bottom,
                  borderTopWidth: 1,
                  borderTopColor: borderColor,
                  width: '100%',
                }}
              >
                {/* Header Drag Zone */}
                <View style={{ width: '100%' }}>
                  {/* Header indicator bar */}
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 16 }} />
                  
                  <View style={{ paddingHorizontal: 20, marginBottom: 16, paddingRight: 60, width: '100%' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Select Party</Text>
                  </View>
                </View>

                {/* Close Button absolute */}
                <TouchableOpacity
                  onPress={() => setShowFormPartyPicker(false)}
                  style={{
                    position: 'absolute',
                    top: 32,
                    right: 20,
                    padding: 4,
                    zIndex: 10,
                  }}
                >
                  <X size={20} color={theme.textSecondary} />
                </TouchableOpacity>

                {/* Search Input inside Dropdown Sheet */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: searchBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  marginHorizontal: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: borderColor,
                  height: 44
                }}>
                  <Search size={16} color={theme.textTertiary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 14, color: theme.text, height: '100%' }}
                    placeholder="Search parties..."
                    placeholderTextColor={theme.textTertiary}
                    value={partySearch}
                    onChangeText={setPartySearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {partySearch.length > 0 && (
                    <TouchableOpacity onPress={() => setPartySearch('')}>
                      <X size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Parties List */}
                <ScrollView 
                  keyboardShouldPersistTaps="handled" 
                  style={{ paddingHorizontal: 16, maxHeight: 350 }}
                  scrollEventThrottle={16}
                  onScroll={(e) => { pickerScrollOffset.current = e.nativeEvent.contentOffset.y; }}
                >
                  {parties.length === 0 ? (
                    <Text style={{ color: theme.textTertiary, padding: 12, textAlign: 'center' }}>Loading parties...</Text>
                  ) : filteredParties.length === 0 ? (
                    <Text style={{ color: theme.textTertiary, padding: 12, textAlign: 'center' }}>No parties found</Text>
                  ) : (
                    filteredParties.map((p: any) => {
                      const isSelected = formData.partyId === p._id;
                      return (
                        <TouchableOpacity
                          key={p._id}
                          onPress={() => {
                            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setFormData(prev => ({
                              ...prev,
                              partyId: p._id,
                              name: p.name,
                              username: p.name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
                              phoneNumber: p.contactPhone || prev.phoneNumber || '',
                              address: p.address || prev.address || ''
                            }));
                            setShowFormPartyPicker(false);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            backgroundColor: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)') : 'transparent',
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: isSelected ? '700' : '500',
                              color: isSelected ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text,
                            }}
                          >
                            {p.name}
                          </Text>
                          {isSelected && <CheckCircle size={16} color={isDarkMode ? '#60a5fa' : '#2563eb'} />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </TouchableOpacity>
            </RNAnimated.View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  const resetForm = () => {
    setFormData({ name: '', username: '', password: '', phoneNumber: '', address: '', role: 'user', partyId: '', profilePhoto: '' });
    setFormErrors({});
    setShowPassword(false);
    setPartySearch('');
  };

  const createPartyMutation = useMutation({
    mutationFn: async (partyData: typeof newPartyForm) => {
      const res = await api.post('/api/parties', partyData);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      const createdParty = data.data || data;
      if (createdParty && createdParty._id) {
        setFormData(prev => ({
          ...prev,
          partyId: createdParty._id,
          name: createdParty.name,
          username: createdParty.name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        }));
      }
      setShowAddPartyModal(false);
      setNewPartyForm({ name: '', contactName: '', contactPhone: '', address: '' });
      setPartyFormErrors({});
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useAppStore.getState().addToast({
        type: 'success',
        title: 'Party Created',
        message: 'The party was created and linked successfully.',
      });
    },
  });

  const handleCreateParty = () => {
    if (!newPartyForm.name.trim()) {
      setPartyFormErrors({ name: 'Party name is required' });
      return;
    }
    setPartyFormErrors({});
    createPartyMutation.mutate(newPartyForm);
  };

  const validateForm = (isEdit = false) => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.username.trim()) errors.username = 'Username is required';
    if (!isEdit && !formData.password.trim()) errors.password = 'Password is required';
    if (formData.role === 'party' && !formData.partyId) {
      errors.partyId = 'Party selection is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = () => {
    if (!validateForm()) return;
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!validateForm(true) || !selectedUser) return;
    updateMutation.mutate({ id: selectedUser._id, data: formData });
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    deleteMutation.mutate(selectedUser._id);
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setFormData({
      name: user.name || '',
      username: user.username || '',
      password: '',
      phoneNumber: user.phoneNumber || '',
      address: user.address || '',
      role: user.role || 'user',
      partyId: typeof user.partyId === 'object' ? user.partyId?._id : user.partyId || '',
      profilePhoto: user.profilePhoto || '',
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleRemoveFormProfilePhoto = () => {
    setFormData(prev => ({ ...prev, profilePhoto: '' }));
    setIsPhotoSheetVisible(false);
  };

  const handleChooseFormPhotoSource = () => {
    setIsPhotoSheetVisible(true);
  };

  const pickFormProfileImage = async () => {
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
        uploadFormProfilePhoto(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to pick image: ' + err.message);
    }
  };

  const uploadFormProfilePhoto = async (localUri: string) => {
    setUploadingFormPhoto(true);
    try {
      const uploadedUrl = await uploadSingleImage(localUri, 'profiles');
      if (!uploadedUrl) {
        throw new Error('Upload succeeded but no URL returned');
      }

      setFormData(prev => ({ ...prev, profilePhoto: uploadedUrl }));
      
      useAppStore.getState().addToast({
        type: 'success',
        title: 'Photo Uploaded',
        message: 'Click Save to persist changes to the database.',
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload photo';
      Alert.alert('Error', msg);
    } finally {
      setUploadingFormPhoto(false);
    }
  };

  const handleFormCameraCapture = (uris: string[]) => {
    if (uris.length > 0) {
      uploadFormProfilePhoto(uris[0]);
    }
  };

  const openDeleteModal = (user: any) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleRefresh = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    usersQuery.refetch();
  };

  const cardBg = isDarkMode ? '#1e293b' : Colors.white;
  const borderColor = isDarkMode ? '#334155' : theme.border;
  const searchBg = isDarkMode ? '#0f172a' : '#f1f5f9';
  const modalBg = isDarkMode ? '#0f172a' : '#ffffff';
  const inputBg = isDarkMode ? '#1e293b' : '#f8fafc';
  const inputBorder = isDarkMode ? '#334155' : '#e2e8f0';

  // ─── Form Modal (shared between Create & Edit) ───
  const renderFormModal = (visible: boolean, onClose: () => void, onSubmit: () => void, title: string, isEdit: boolean) => (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      presentationStyle={isLargeScreen ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: modalBg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
          style={{ flex: 1 }}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <X size={22} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Users size={18} color={isDarkMode ? '#34d399' : '#059669'} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
            </View>
            <TouchableOpacity
              onPress={onSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              style={[styles.modalSaveBtn, { backgroundColor: isDarkMode ? '#60a5fa' : '#2563eb', opacity: (createMutation.isPending || updateMutation.isPending) ? 0.5 : 1 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={formScrollViewRef}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
          >
            {/* Profile Photo Selector */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{ position: 'relative', width: 90, height: 90 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (formData.profilePhoto) {
                      setIsPreviewVisible(true);
                    } else {
                      handleChooseFormPhotoSource();
                    }
                  }}
                  disabled={uploadingFormPhoto}
                  activeOpacity={0.85}
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                  }}
                >
                  {uploadingFormPhoto ? (
                    <View style={{
                      width: 82,
                      height: 82,
                      borderRadius: 41,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                    }}>
                      <ActivityIndicator size="small" color={isDarkMode ? '#60a5fa' : '#2563eb'} />
                    </View>
                  ) : (
                    <UserAvatar 
                      photoUrl={getProfilePhotoUrl(formData.profilePhoto)} 
                      name={formData.name || ''} 
                      avatarBg={isDarkMode ? '#0f172a' : '#f8fafc'} 
                      avatarColor={theme.textSecondary} 
                      size={82}
                      borderRadius={41}
                      fontSize={26}
                    />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={handleChooseFormPhotoSource}
                  disabled={uploadingFormPhoto}
                  activeOpacity={0.85}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: isDarkMode ? '#60a5fa' : '#2563eb',
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: isDarkMode ? '#0f172a' : '#ffffff',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 3,
                    elevation: 4,
                    zIndex: 10,
                  }}
                >
                  <Camera size={12} color="#ffffff" />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginTop: 8 }}>
                Profile Photo
              </Text>
            </View>
            {/* Role Dropdown Selector (first field in the form) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Role *</Text>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  pickerScrollOffset.current = 0;
                  pickerTranslateY.setValue(0);
                  setShowFormRolePicker(true);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: inputBg,
                  borderColor: inputBorder,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  height: 48,
                }}
              >
                <Text style={{ fontSize: 15, color: theme.text, flex: 1, textTransform: 'capitalize' }}>
                  {formData.role === 'superadmin' ? 'Super Admin' : formData.role}
                </Text>
                <ChevronDown size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Party Select Dropdown (visible only if role is 'party', rendered immediately after Role) */}
            {formData.role === 'party' && (
              <View style={styles.fieldGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 0 }]}>Link to Party *</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setPartyFormErrors({});
                      setNewPartyForm({ name: '', contactName: '', contactPhone: '', address: '' });
                      setShowAddPartyModal(true);
                    }}
                    style={{ paddingVertical: 4, paddingHorizontal: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#60a5fa' : '#2563eb' }}>+ Add New Party</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    pickerScrollOffset.current = 0;
                    pickerTranslateY.setValue(0);
                    setPartySearch('');
                    setShowFormPartyPicker(true);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: inputBg,
                    borderColor: formErrors.partyId ? '#ef4444' : inputBorder,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    height: 48,
                  }}
                >
                  <Text style={{ fontSize: 15, color: formData.partyId ? theme.text : theme.textTertiary, flex: 1 }}>
                    {formData.partyId 
                      ? (parties.find((p: any) => p._id === formData.partyId)?.name || 'Linked Party') 
                      : 'Select Party...'}
                  </Text>
                  <ChevronDown size={18} color={theme.textTertiary} />
                </TouchableOpacity>
                {!!formErrors.partyId && <Text style={styles.fieldError}>{formErrors.partyId}</Text>}
              </View>
            )}

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Full Name *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: inputBg, borderColor: formErrors.name ? '#ef4444' : inputBorder, color: theme.text }]}
                placeholder="Enter full name"
                placeholderTextColor={theme.textTertiary}
                value={formData.name}
                onChangeText={(t) => setFormData(p => ({ ...p, name: t }))}
              />
              {!!formErrors.name && <Text style={styles.fieldError}>{formErrors.name}</Text>}
            </View>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Username *</Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: isEdit && selectedUser?.role === 'master' ? (isDarkMode ? '#0f172a' : '#f8fafc') : inputBg,
                    borderColor: formErrors.username ? '#ef4444' : inputBorder,
                    color: isEdit && selectedUser?.role === 'master' ? theme.textTertiary : theme.text,
                    opacity: isEdit && selectedUser?.role === 'master' ? 0.6 : 1
                  }
                ]}
                placeholder="Enter username"
                placeholderTextColor={theme.textTertiary}
                value={formData.username}
                onChangeText={(t) => setFormData(p => ({ ...p, username: t }))}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!(isEdit && selectedUser?.role === 'master')}
              />
              {!!formErrors.username && <Text style={styles.fieldError}>{formErrors.username}</Text>}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Password {isEdit ? '(leave blank to keep current)' : '*'}
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[
                    styles.fieldInput,
                    {
                      backgroundColor: isEdit && selectedUser?.role === 'master' ? (isDarkMode ? '#0f172a' : '#f8fafc') : inputBg,
                      borderColor: formErrors.password ? '#ef4444' : inputBorder,
                      color: isEdit && selectedUser?.role === 'master' ? theme.textTertiary : theme.text,
                      paddingRight: 48,
                      opacity: isEdit && selectedUser?.role === 'master' ? 0.6 : 1
                    }
                  ]}
                  placeholder={isEdit && selectedUser?.role === 'master' ? 'Not editable for Master role' : (isEdit ? 'Leave blank to keep current' : 'Enter password')}
                  placeholderTextColor={theme.textTertiary}
                  value={formData.password}
                  onChangeText={(t) => setFormData(p => ({ ...p, password: t }))}
                  secureTextEntry={!showPassword}
                  editable={!(isEdit && selectedUser?.role === 'master')}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: 12 }}
                >
                  {showPassword
                    ? <EyeOff size={20} color={theme.textTertiary} />
                    : <Eye size={20} color={theme.textTertiary} />
                  }
                </TouchableOpacity>
              </View>
              {!!formErrors.password && <Text style={styles.fieldError}>{formErrors.password}</Text>}
            </View>

            {/* Phone */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Phone Number</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.text }]}
                placeholder="Enter phone number"
                placeholderTextColor={theme.textTertiary}
                value={formData.phoneNumber}
                onChangeText={(t) => setFormData(p => ({ ...p, phoneNumber: t }))}
                keyboardType="phone-pad"
                onFocus={scrollToFormEnd}
              />
            </View>

            {/* Address */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Address</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.text, height: 80, textAlignVertical: 'top' }]}
                placeholder="Enter address"
                placeholderTextColor={theme.textTertiary}
                value={formData.address}
                onChangeText={(t) => setFormData(p => ({ ...p, address: t }))}
                multiline
                onFocus={scrollToFormEnd}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  // ─── Add Party Modal ───
  const renderAddPartyModal = () => (
    <Modal
      visible={showAddPartyModal}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      presentationStyle={isLargeScreen ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={() => setShowAddPartyModal(false)}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: modalBg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
          style={{ flex: 1 }}
        >
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={() => setShowAddPartyModal(false)} style={styles.modalCloseBtn}>
              <X size={22} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add New Party</Text>
            <TouchableOpacity
              onPress={handleCreateParty}
              disabled={createPartyMutation.isPending}
              style={[styles.modalSaveBtn, { backgroundColor: isDarkMode ? '#60a5fa' : '#2563eb', opacity: createPartyMutation.isPending ? 0.5 : 1 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {createPartyMutation.isPending ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={addPartyScrollViewRef}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
          >
            {/* Party Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Party Name *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: inputBg, borderColor: partyFormErrors.name ? '#ef4444' : inputBorder, color: theme.text }]}
                placeholder="Enter party name"
                placeholderTextColor={theme.textTertiary}
                value={newPartyForm.name}
                onChangeText={(t) => setNewPartyForm(p => ({ ...p, name: t }))}
              />
              {!!partyFormErrors.name && <Text style={styles.fieldError}>{partyFormErrors.name}</Text>}
            </View>

            {/* Contact Person Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Contact Person Name</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.text }]}
                placeholder="Enter contact person name"
                placeholderTextColor={theme.textTertiary}
                value={newPartyForm.contactName}
                onChangeText={(t) => setNewPartyForm(p => ({ ...p, contactName: t }))}
              />
            </View>

            {/* Contact Person Phone */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Contact Phone</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.text }]}
                placeholder="Enter contact phone number"
                placeholderTextColor={theme.textTertiary}
                value={newPartyForm.contactPhone}
                onChangeText={(t) => setNewPartyForm(p => ({ ...p, contactPhone: t }))}
                keyboardType="phone-pad"
              />
            </View>

            {/* Address */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Address</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.text, height: 80, textAlignVertical: 'top' }]}
                placeholder="Enter party address"
                placeholderTextColor={theme.textTertiary}
                value={newPartyForm.address}
                onChangeText={(t) => setNewPartyForm(p => ({ ...p, address: t }))}
                multiline
                onFocus={scrollToAddPartyEnd}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  // ─── Delete Confirmation Modal ───
  const renderDeleteModal = () => (
    <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
      <View style={styles.deleteOverlay}>
        <View style={[styles.deleteCard, { backgroundColor: modalBg, borderColor }]}>
          <View style={styles.deleteIconWrap}>
            <Trash2 size={28} color="#ef4444" />
          </View>
          <Text style={[styles.deleteTitle, { color: theme.text }]}>Delete User</Text>
          <Text style={[styles.deleteMsg, { color: theme.textSecondary }]}>
            Are you sure you want to delete <Text style={{ fontWeight: '700', color: theme.text }}>{selectedUser?.name}</Text>?
            {'\n'}This action cannot be undone.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <TouchableOpacity
              onPress={() => setShowDeleteModal(false)}
              style={[styles.deleteBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: inputBorder, borderWidth: 1, flex: 1 }]}
            >
              <Text style={{ fontWeight: '700', color: theme.text, fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              style={[styles.deleteBtn, { backgroundColor: '#ef4444', flex: 1, opacity: deleteMutation.isPending ? 0.5 : 1 }]}
            >
              <Text style={{ fontWeight: '700', color: '#fff', fontSize: 14 }}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : ((showCreateModal || showEditModal || showAddPartyModal || showFiltersModal || cameraVisible || isPreviewVisible || isUserListPreviewVisible) ? 'light-content' : 'dark-content')}
      />
      <View style={{ flex: 1, width: '100%', maxWidth: containerMaxWidth, alignSelf: 'center' }}>
      {!isInTabs && (
        <Header title="Users Management" showBack />
      )}{/* Search & Filters */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 8, marginBottom: 8, alignItems: 'center' }}>
        <View style={[styles.searchContainer, { backgroundColor: cardBg, borderColor, flex: 1, flexDirection: 'row', alignItems: 'center', height: 44 }]}>
          <Search size={18} color={theme.textTertiary} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search users..."
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, color: theme.text, fontSize: 14, height: 44 }}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <X size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Unified Filter Modal Button */}
        <TouchableOpacity
          onPress={() => {
            pickerScrollOffset.current = 0;
            pickerTranslateY.setValue(0);
            setShowFiltersModal(true);
          }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderWidth: 1,
            borderColor,
            backgroundColor: cardBg,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <SlidersHorizontal size={18} color={activeFiltersCount > 0 ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textSecondary} />
          {activeFiltersCount > 0 && (
            <View style={{
              position: 'absolute',
              top: -6,
              right: -6,
              backgroundColor: '#ef4444',
              borderRadius: 9,
              minWidth: 18,
              height: 18,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
              borderWidth: 1.5,
              borderColor: cardBg
            }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Users List */}
      {usersQuery.isLoading ? (
        <UserSkeletonList count={5} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<Users size={44} color={isDarkMode ? '#60a5fa' : '#2563eb'} />}
          title="No Users Found"
          subtitle={searchQuery ? `No match for "${searchQuery}"` : 'No registered accounts'}
        />
      ) : (
        <FlashList
          data={paginatedUsers}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item: any) => item._id}
          drawDistance={800}
          ListHeaderComponent={() => renderPaginationControls('top')}
          ListFooterComponent={() => renderPaginationControls('bottom')}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          renderItem={({ item, index }: { item: any; index: number }) => {
            const role = item.role || 'user';
            let avatarBg = 'rgba(100, 116, 139, 0.15)';
            let avatarColor = '#64748b';
            if (role === 'master' || role === 'superadmin') {
              avatarBg = isDarkMode ? 'rgba(124, 58, 237, 0.15)' : '#faf5ff';
              avatarColor = '#a78bfa';
            } else if (role === 'admin') {
              avatarBg = isDarkMode ? 'rgba(79, 70, 229, 0.15)' : '#e0e7ff';
              avatarColor = '#818cf8';
            } else if (role === 'weaver') {
              avatarBg = isDarkMode ? 'rgba(249, 115, 22, 0.15)' : '#fff7ed';
              avatarColor = '#fb923c';
            } else if (role === 'party') {
              avatarBg = isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff';
              avatarColor = '#60a5fa';
            } else {
              avatarBg = isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5';
              avatarColor = '#34d399';
            }

            const photoUrl = getProfilePhotoUrl(item.profilePhoto);

            return (
              <View style={{ flex: 1 }}>
                <View style={[styles.userCard, { backgroundColor: cardBg, borderColor, marginHorizontal: numColumns > 1 ? 8 : 16, flex: 1 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => {
                        setPreviewUser(item);
                        setIsUserListPreviewVisible(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <UserAvatar 
                        photoUrl={photoUrl} 
                        name={item.name} 
                        avatarBg={avatarBg} 
                        avatarColor={avatarColor}
                        style={{ marginRight: 12 }}
                      />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{item.name}</Text>
                        {(role === 'master' || role === 'superadmin') && <Shield size={14} color="#7c3aed" />}
                      </View>
                      <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>@{item.username}</Text>
                      {role === 'party' && !!item.partyId && (
                        <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4, fontWeight: '600' }}>
                          Linked to: {typeof item.partyId === 'object' ? item.partyId?.name : item.partyId}
                        </Text>
                      )}

                      {/* Additional contact & address details for premium look */}
                      {!!(item.phoneNumber || item.address) && (
                        <View style={{ marginTop: 8, gap: 4, borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9', paddingTop: 6 }}>
                          {!!item.phoneNumber && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Phone size={12} color={theme.textTertiary} />
                              <Text style={{ fontSize: 12, color: theme.textSecondary }}>{item.phoneNumber}</Text>
                            </View>
                          )}
                          {!!item.address && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <MapPin size={12} color={theme.textTertiary} />
                              <Text style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>{item.address}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    <Badge
                      text={role}
                      color={
                        role === 'master' || role === 'superadmin'
                          ? { bg: isDarkMode ? 'rgba(124, 58, 237, 0.12)' : '#faf5ff', text: '#a78bfa', border: isDarkMode ? 'rgba(124, 58, 237, 0.3)' : '#ddd6fe' }
                          : role === 'admin'
                            ? { bg: isDarkMode ? 'rgba(79, 70, 229, 0.12)' : '#e0e7ff', text: '#818cf8', border: isDarkMode ? 'rgba(79, 70, 229, 0.3)' : '#c7d2fe' }
                            : role === 'weaver'
                              ? { bg: isDarkMode ? 'rgba(249, 115, 22, 0.12)' : '#fff7ed', text: '#fb923c', border: isDarkMode ? 'rgba(249, 115, 22, 0.3)' : '#fed7aa' }
                              : role === 'party'
                                ? { bg: isDarkMode ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff', text: '#60a5fa', border: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe' }
                                : { bg: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5', text: '#34d399', border: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0' }
                      }
                    />
                  </View>

                  {/* Info & Actions Footer */}
                  <View style={[styles.userFooter, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Clock size={12} color={theme.textTertiary} />
                      <Text style={{ fontSize: 11, color: theme.textTertiary, marginLeft: 6, fontWeight: '500' }}>
                        {item.lastLogin ? formatDateTime(item.lastLogin) : (item.createdAt ? `Created ${formatDateTime(item.createdAt)}` : 'N/A')}
                      </Text>
                    </View>

                    {/* Edit & Delete buttons (only for superadmin/master) */}
                    {isSuperAdmin && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(role !== 'master' || isMaster) && (
                          <TouchableOpacity
                            onPress={() => openEditModal(item)}
                            style={[styles.actionBtn, { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.12)' : '#e0e7ff' }]}
                          >
                            <Edit3 size={14} color="#6366f1" />
                          </TouchableOpacity>
                        )}
                        {(isMaster && role !== 'master') && (
                          <TouchableOpacity
                            onPress={() => openDeleteModal(item)}
                            style={[styles.actionBtn, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2' }]}
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                </View>
              </View>
            </View>
          );
          }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 110 + insets.bottom, paddingHorizontal: numColumns > 1 ? 8 : 0 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl refreshing={usersQuery.isRefetching} onRefresh={handleRefresh} tintColor={Colors.primary[500]} />
            ) : undefined
          }
        />
      )}

      {/* FAB - Create User (superadmin only) */}
      {isSuperAdmin && (
        <RNAnimated.View
          {...panResponder.panHandlers}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              resetForm();
              setShowCreateModal(true);
            }}
            activeOpacity={0.8}
            style={[
              styles.fab,
              {
                backgroundColor: Colors.primary[600],
                shadowColor: Colors.primary[600],
              }
            ]}
          >
            <View style={{ position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} color="#ffffff" />
              <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary[600], borderRadius: 7, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
                <Plus size={9} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}
      </View>

      {/* Modals */}
      {renderFormModal(showCreateModal, () => { setShowCreateModal(false); resetForm(); }, handleCreate, 'Create User', false)}
      {renderFormModal(showEditModal, () => { setShowEditModal(false); setSelectedUser(null); resetForm(); }, handleUpdate, 'Edit User', true)}
      {renderDeleteModal()}
      {renderAddPartyModal()}

      {/* Unified Filters Modal (Bottom Sheet) */}
      {renderFiltersModal()}



      {renderSelectionModal(
        showFormRolePicker,
        () => setShowFormRolePicker(false),
        availableRoles.map(role => ({
          label: role === 'superadmin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1),
          value: role
        })),
        formData.role,
        (val) => setFormData(p => ({ ...p, role: val })),
        'Select User Role'
      )}

      {renderFormPartySelectionModal()}

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
              {getProfilePhotoUrl(formData.profilePhoto) ? (
                <Image
                  source={{ uri: getProfilePhotoUrl(formData.profilePhoto)!, cache: 'reload' }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  key={formData.profilePhoto}
                />
              ) : (
                <Text style={{ fontSize: 96, fontWeight: '800', color: '#fff' }}>
                  {getInitials(formData.name || 'User')}
                </Text>
              )}
            </TouchableOpacity>
            
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{formData.name || 'User'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>@{formData.username || 'username'}</Text>
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
            backgroundColor: 'rgba(0,0,0,0.05)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setIsPhotoSheetVisible(false)}
        >
          <View 
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              paddingBottom: (Platform.OS === 'ios' ? 34 : 24) + insets.bottom,
              width: '100%',
              borderWidth: 1,
              borderColor: borderColor,
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
                  borderColor: borderColor,
                }}
              >
                <Camera size={18} color={Colors.primary[600]} style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Take Photo (Camera)</Text>
              </TouchableOpacity>

              {/* Choose Gallery */}
              <TouchableOpacity
                onPress={() => {
                  setIsPhotoSheetVisible(false);
                  pickFormProfileImage();
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
                  borderColor: borderColor,
                }}
              >
                <ImageIcon size={18} color={Colors.primary[600]} style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>Choose from Gallery</Text>
              </TouchableOpacity>

              {/* Remove Photo */}
              {Boolean(formData.profilePhoto) && (
                <TouchableOpacity
                  onPress={handleRemoveFormProfilePhoto}
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
      <CustomCameraModal 
        visible={cameraVisible} 
        onClose={() => setCameraVisible(false)} 
        onPhotosCaptured={handleFormCameraCapture} 
        singlePhoto={true}
      />

      {/* Custom User List Photo Preview Modal */}
      <Modal
        visible={isUserListPreviewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsUserListPreviewVisible(false)}
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
              onPress={() => setIsUserListPreviewVisible(false)}
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
            
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>User Photo</Text>
            
            <View style={{ width: 40 }} />
          </View>

          {/* Main Photo Card */}
          <View style={{ alignItems: 'center', width: '100%', paddingHorizontal: 24 }}>
            <View style={{
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
            }}>
              {getProfilePhotoUrl(previewUser?.profilePhoto) ? (
                <Image
                  source={{ uri: getProfilePhotoUrl(previewUser?.profilePhoto)!, cache: 'reload' }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  key={previewUser?.profilePhoto}
                />
              ) : (
                <Text style={{ fontSize: 96, fontWeight: '800', color: '#fff' }}>
                  {getInitials(previewUser?.name || previewUser?.username || 'User')}
                </Text>
              )}
            </View>
            
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{previewUser?.name || 'User'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>@{previewUser?.username || 'username'}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 },
  dropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  paginationContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 16,
  },
  paginationInfoText: {
    fontSize: 13,
    fontWeight: '500',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pageIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageIndicatorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  avatar: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  userCard: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 18, padding: 16 },
  userFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  // Modal styles
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSaveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  fieldInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, height: 48, fontSize: 15 },
  fieldError: { fontSize: 12, color: '#ef4444', fontWeight: '600', marginTop: 4 },
  // Delete modal styles
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  deleteCard: { borderRadius: 24, padding: 28, borderWidth: 1, width: '100%', maxWidth: 360, alignItems: 'center' },
  deleteIconWrap: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  deleteTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  deleteMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  deleteBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
