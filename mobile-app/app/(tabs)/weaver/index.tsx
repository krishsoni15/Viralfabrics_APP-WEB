import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, RefreshControl, Platform, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, PanResponder, Animated as RNAnimated, Dimensions, Pressable, Keyboard, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Users, Search, X, ArrowUpDown, Plus, Phone, MapPin, ChevronRight, SlidersHorizontal, RotateCcw, Pencil, Trash2, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router, Tabs } from 'expo-router';

import api from '../../../services/api';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { WeaverSkeletonList } from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import { useTheme } from '../../../hooks/useTheme';
import { useAuth } from '../../../hooks/useAuth';
import { Colors } from '../../../constants/colors';
import { Weaver } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { formatDate } from '../../../utils/helpers';

const PAGE_SIZE = 10;

function FilterPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { isDarkMode } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: selected
          ? Colors.primary[600]
          : isDarkMode
            ? Colors.neutral[800]
            : Colors.neutral[100],
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: selected
          ? Colors.primary[600]
          : isDarkMode
            ? Colors.neutral[700]
            : Colors.neutral[200],
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: selected
            ? Colors.white
            : isDarkMode
              ? Colors.neutral[300]
              : Colors.neutral[600],
          textTransform: 'capitalize',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const WeaverCard = React.memo(function WeaverCard({ item, index, onEdit, onDelete, isSuperAdmin, isMaster }: { item: Weaver; index: number; onEdit: (w: Weaver) => void; onDelete: (w: Weaver) => void; isSuperAdmin: boolean; isMaster: boolean }) {
  const { theme, isDarkMode } = useTheme();

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/weaver/${item._id}` as any);
  }, [item._id]);

  return (
    <Animated.View>
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 18,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.07)' : '#e8edf2',
          borderLeftWidth: 4,
          borderLeftColor: Colors.primary[600],
          shadowColor: isDarkMode ? '#000' : '#94a3b8',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDarkMode ? 0.25 : 0.12,
          shadowRadius: 10,
          elevation: 4,
          padding: 14,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            {/* Name with initial badge */}
            <TouchableOpacity
              onPress={handlePress}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 12,
                backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : Colors.primary[50],
                alignItems: 'center', justifyContent: 'center', marginRight: 10,
              }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.primary[600] }}>
                  {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
              <Text style={{ fontSize: 16.5, fontWeight: '800', color: theme.text, flex: 1 }} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>

            {/* Phone */}
            {item.phone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginLeft: 2 }}>
                <Phone size={13} color={theme.textTertiary} />
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 8 }}>{item.phone}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginLeft: 2 }}>
                <Phone size={13} color={theme.textTertiary} />
                <Text style={{ fontSize: 13, color: theme.textTertiary, marginLeft: 8, fontStyle: 'italic' }}>No phone</Text>
              </View>
            )}

            {/* Address */}
            {item.address ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginLeft: 2 }}>
                <MapPin size={13} color={theme.textTertiary} style={{ marginTop: 2 }} />
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 8, flex: 1 }} numberOfLines={2}>{item.address}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}>
                <MapPin size={13} color={theme.textTertiary} />
                <Text style={{ fontSize: 13, color: theme.textTertiary, marginLeft: 8, fontStyle: 'italic' }}>No address</Text>
              </View>
            )}
          </View>
          {item.createdAt ? (
            <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '600', marginTop: 12 }}>
              {formatDate(item.createdAt)}
            </Text>
          ) : null}
        </View>

        {/* Action Row 1: View Samples & Add Sample */}
        <View style={{
          flexDirection: 'row',
          gap: 8,
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
        }}>
          <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.75}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              paddingVertical: 9,
              borderRadius: 10,
              backgroundColor: isDarkMode ? 'rgba(59,130,246,0.12)' : '#eff6ff',
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(59,130,246,0.25)' : '#bfdbfe',
            }}
          >
            <ChevronRight size={14} color={isDarkMode ? '#60a5fa' : Colors.primary[600]} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#60a5fa' : Colors.primary[600] }}>View Samples</Text>
          </TouchableOpacity>

          {isSuperAdmin && (
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/(tabs)/weaver/${item._id}?addSample=true` as any);
              }}
              activeOpacity={0.75}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                paddingVertical: 9,
                borderRadius: 10,
                backgroundColor: isDarkMode ? 'rgba(16,185,129,0.12)' : '#ecfdf5',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(16,185,129,0.25)' : '#a7f3d0',
              }}
            >
              <Plus size={14} color={isDarkMode ? '#34d399' : '#059669'} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#34d399' : '#059669' }}>Add Sample</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Row 2: Edit & Delete */}
        {isSuperAdmin && (
          <View style={{
            flexDirection: 'row',
            gap: 8,
            marginTop: 8,
          }}>
            <TouchableOpacity
              onPress={() => onEdit(item)}
              activeOpacity={0.75}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                paddingVertical: 9,
                borderRadius: 10,
                backgroundColor: isDarkMode ? 'rgba(124,58,237,0.12)' : '#f5f3ff',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(124,58,237,0.25)' : '#ddd6fe',
              }}
            >
              <Pencil size={14} color={isDarkMode ? '#c084fc' : '#7c3aed'} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#c084fc' : '#7c3aed' }}>Edit</Text>
            </TouchableOpacity>

            {isMaster && (
              <TouchableOpacity
                onPress={() => onDelete(item)}
                activeOpacity={0.75}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  paddingVertical: 9,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(239,68,68,0.25)' : '#fca5a5',
                  backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : '#fef2f2',
                }}
              >
                <Trash2 size={14} color={isDarkMode ? '#f87171' : Colors.error[600]} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#f87171' : Colors.error[600] }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
});

export default function WeaverListScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { theme, isDarkMode } = useTheme();
  const { isSuperAdmin, isMaster } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useAppStore(s => s.addToast);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const insets = useSafeAreaInsets();
  const { isLargeScreen, numColumns, containerMaxWidth, modalMaxWidth } = useResponsiveLayout();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const filterPanY = useRef(new RNAnimated.Value(600)).current;
  const filterTouchStartPageY = useRef(0);
  const filterSheetY = useRef(0);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editingWeaver, setEditingWeaver] = useState<Weaver | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const modalTranslateY = useRef(new RNAnimated.Value(0)).current;
  const filterScrollOffset = useRef(0);
  const filterCapturedDy = useRef(0);
  const formScrollOffset = useRef(0);
  const formCapturedDy = useRef(0);
  const formTouchStartPageY = useRef(0);
  const formSheetY = useRef(0);

  const modalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e, gs) => {
        const touchY = e.nativeEvent.pageY - formSheetY.current;
        return touchY > 0 && touchY <= 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return formScrollOffset.current <= 0 && gs.dy > 0 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return formScrollOffset.current <= 0 && gs.dy > 0 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
      onPanResponderGrant: () => {
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          modalTranslateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.5) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeFormModal();
        } else {
          RNAnimated.spring(modalTranslateY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  const closeFormModal = useCallback(() => {
    setShowForm(false);
  }, []);

  React.useEffect(() => {
    if (showForm) {
      modalTranslateY.setValue(0);
    } else {
      const timer = setTimeout(() => {
        modalTranslateY.setValue(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showForm]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Weaver | null>(null);
  const [deleting, setDeleting] = useState(false);

  // FAB drag
  const FAB_BOTTOM_OFFSET = Platform.OS === 'ios' ? 220 : 170;
  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 76, y: screenHeight - FAB_BOTTOM_OFFSET })).current;
  const fabX = useRef(screenWidth - 76);
  const fabY = useRef(screenHeight - FAB_BOTTOM_OFFSET);

  const dimensionsRef = useRef({ screenWidth, screenHeight });
  dimensionsRef.current = { screenWidth, screenHeight };

  React.useEffect(() => {
    const isSnappedLeft = fabX.current < screenWidth / 2;
    const targetX = isSnappedLeft ? 16 : screenWidth - 76;
    const targetY = Math.min(Math.max(fabY.current, 120), screenHeight - FAB_BOTTOM_OFFSET);
    
    fabX.current = targetX;
    fabY.current = targetY;
    
    RNAnimated.spring(pan, {
      toValue: { x: targetX, y: targetY },
      useNativeDriver: false,
      tension: 40,
      friction: 12,
    }).start();
  }, [screenWidth, screenHeight]);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(text), 500);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sortOrder !== 'newest') count++;
    return count;
  }, [sortOrder]);

  const totalActiveFiltersCount = useMemo(() => {
    let count = activeFilterCount;
    if (debouncedSearch.trim() !== '') count++;
    return count;
  }, [activeFilterCount, debouncedSearch]);

  const unfilteredQuery = useQuery({
    queryKey: ['weavers-unfiltered-count'],
    queryFn: async () => {
      const { data } = await api.get('/api/weaver/weavers', { params: { page: 1, limit: 1 } });
      return data?.pagination?.total || 0;
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const weaversQuery = useInfiniteQuery({
    queryKey: ['weavers', debouncedSearch, sortOrder],
    enabled: isAuthenticated,
    initialPageParam: 1,
    staleTime: 30000,
    queryFn: async ({ pageParam = 1 }) => {
      const params: any = { page: pageParam, limit: PAGE_SIZE, sort: sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      const { data } = await api.get('/api/weaver/weavers', { params });
      const items = data?.data || [];
      const pagination = data?.pagination || {};
      const hasNext = pageParam < (pagination.pages || 1);
      return { items, hasNext, nextPage: pageParam + 1, totalCount: pagination.total || items.length };
    },
    getNextPageParam: (lastPage) => lastPage.hasNext ? lastPage.nextPage : undefined,
  });

  const weavers = weaversQuery.data?.pages.flatMap(p => p.items) || [];
  const totalMatchingCount = weaversQuery.data?.pages[0]?.totalCount || 0;
  const grandTotal = unfilteredQuery.data ?? totalMatchingCount;
  const isFiltered = debouncedSearch.trim() !== '';

  // Filter modal handlers
  const closeFilterModal = useCallback(() => {
    RNAnimated.timing(filterPanY, {
      toValue: 600,
      duration: 160,
      useNativeDriver: false,
    }).start(() => {
      setShowFilterModal(false);
    });
  }, [filterPanY]);

  const filterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        filterTouchStartPageY.current = pageY;
        return pageY < filterSheetY.current + 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return filterScrollOffset.current <= 5 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return filterScrollOffset.current <= 5 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onPanResponderGrant: () => {
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          filterPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (evt, gs) => {
        const isBackdropTouch = filterTouchStartPageY.current < filterSheetY.current;
        if (isBackdropTouch && Math.abs(gs.dy) < 10 && Math.abs(gs.dx) < 10) {
          closeFilterModal();
          return;
        }

        if (gs.dy > 50 || gs.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeFilterModal();
        } else {
          RNAnimated.spring(filterPanY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 40,
            friction: 9,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showFilterModal) {
      filterPanY.setValue(600);
      RNAnimated.timing(filterPanY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    }
  }, [showFilterModal]);

  const clearAllFilters = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSearch('');
    setDebouncedSearch('');
    setSortOrder('newest');
  }, []);

  // FAB drag pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: fabX.current,
          y: fabY.current,
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

        const snapLeftX = 16;
        const snapRightX = currentScreenWidth - 76;
        const targetX = currentX < currentScreenWidth / 2 ? snapLeftX : snapRightX;

        const minY = 120;
        const maxY = currentScreenHeight - FAB_BOTTOM_OFFSET;
        const targetY = Math.min(Math.max(currentY, minY), maxY);

        fabX.current = targetX;
        fabY.current = targetY;

        RNAnimated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          tension: 40,
          friction: 12,
        }).start();
      },
    })
  ).current;

  const openCreateForm = () => {
    setEditingWeaver(null);
    setFormName(''); setFormPhone(''); setFormAddress('');
    setShowForm(true);
  };

  const openEditForm = (w: Weaver) => {
    setEditingWeaver(w);
    setFormName(w.name); setFormPhone(w.phone || ''); setFormAddress(w.address || '');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      addToast({ type: 'error', title: 'Validation', message: 'Name is required' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = { name: formName.trim(), phone: formPhone.trim(), address: formAddress.trim() };
      if (editingWeaver) {
        await api.put(`/api/weaver/weavers/${editingWeaver._id}`, payload);
        addToast({ type: 'success', title: 'Updated', message: 'Weaver updated successfully' });
      } else {
        await api.post('/api/weaver/weavers', payload);
        addToast({ type: 'success', title: 'Created', message: 'Weaver created successfully' });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeFormModal();
      queryClient.invalidateQueries({ queryKey: ['weavers'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to save weaver' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/weaver/weavers/${deleteTarget._id}`);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({ type: 'success', title: 'Deleted', message: 'Weaver deleted successfully' });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['weavers'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to delete weaver' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <Tabs.Screen options={{ tabBarStyle: showForm ? { display: 'none' } : undefined }} />

      {/* Search + Filter Row */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{
          flex: 1, flexDirection: 'row', alignItems: 'center',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
          borderRadius: 14, paddingHorizontal: 14, height: 46,
          borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
        }}>
          <Search size={18} color={theme.textTertiary} />
          <TextInput
            placeholder="Search weavers..."
            placeholderTextColor={theme.inputPlaceholder}
            value={search}
            onChangeText={handleSearch}
            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: theme.text, paddingVertical: 0 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setDebouncedSearch(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button */}
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowFilterModal(true);
          }}
          activeOpacity={0.7}
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            borderWidth: 1,
            borderColor: activeFilterCount > 0
              ? (isDarkMode ? Colors.primary[400] : Colors.primary[600])
              : (isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
          }}
        >
          <SlidersHorizontal
            size={18}
            color={activeFilterCount > 0 ? (isDarkMode ? Colors.primary[400] : Colors.primary[600]) : theme.textSecondary}
          />
          {activeFilterCount > 0 && (
            <View style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: Colors.primary[600],
              borderRadius: 8,
              minWidth: 16,
              height: 16,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}>
              <Text style={{ color: Colors.white, fontSize: 9, fontWeight: '800' }}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {weaversQuery.isLoading ? (
        <View style={{ flex: 1, paddingTop: 20 }}>
          <WeaverSkeletonList count={5} />
        </View>
      ) : weavers.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color={isDarkMode ? Colors.primary[400] : Colors.primary[500]} />}
          title={debouncedSearch ? "No Weavers Found" : "No Weavers Yet"}
          subtitle={debouncedSearch ? 'No weavers match your search. Try a different term.' : 'Tap the + button to add your first weaver.'}
        />
      ) : (
        <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: containerMaxWidth }}>
          <FlashList
            key={numColumns}
            numColumns={numColumns}
            data={weavers}
            keyExtractor={(item, index) => item._id + '-' + index}
            drawDistance={800}
            ListHeaderComponent={() => {
              if (grandTotal === 0 && !isFiltered) return null;
              return (
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  backgroundColor: theme.background
                }}>
                  <Text style={{ fontSize: 13, color: theme.textTertiary, fontWeight: '500' }}>
                    {isFiltered ? (
                      <Text>
                        <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{totalMatchingCount}</Text>
                        {' of '}
                        <Text style={{ fontWeight: '800', color: theme.text }}>{grandTotal}</Text>
                      </Text>
                    ) : (
                      <Text>
                        Total: <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{grandTotal}</Text>
                      </Text>
                    )}
                  </Text>

                  {totalActiveFiltersCount > 0 && (
                    <TouchableOpacity
                      onPress={clearAllFilters}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
                        borderColor: isDarkMode ? '#991b1b' : '#fca5a5',
                        borderWidth: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 20,
                        gap: 4
                      }}
                    >
                      <RotateCcw size={12} color={isDarkMode ? '#fca5a5' : '#c53030'} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#fca5a5' : '#c53030' }}>
                        Clear ({totalActiveFiltersCount})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            renderItem={({ item, index }) => (
              <View style={{ flex: 1, maxWidth: isLargeScreen ? `${100 / numColumns}%` : '100%' }}>
                <WeaverCard item={item} index={index} onEdit={openEditForm} onDelete={setDeleteTarget} isSuperAdmin={isSuperAdmin} isMaster={isMaster} />
              </View>
            )}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
          onEndReached={() => { if (weaversQuery.hasNextPage && !weaversQuery.isFetchingNextPage) weaversQuery.fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          removeClippedSubviews={false}
          ListFooterComponent={weaversQuery.isFetchingNextPage ? (
            <View style={{ paddingVertical: 24, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={Colors.primary[500]} />
              <Text style={{ fontSize: 13, color: theme.textTertiary, fontWeight: '500' }}>Loading more...</Text>
            </View>
          ) : (!weaversQuery.hasNextPage && weavers.length > 0) ? (
            <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
                No more weavers to load
              </Text>
            </View>
          ) : null}
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl
                refreshing={weaversQuery.isRefetching && !weaversQuery.isFetchingNextPage}
                onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); weaversQuery.refetch(); }}
                tintColor={Colors.primary[500]}
                colors={[Colors.primary[500]]}
              />
            ) : undefined
          }
        />
        </View>
      )}

      {/* Draggable FAB */}
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
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            openCreateForm();
          }}
          activeOpacity={0.8}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: Colors.primary[600],
            shadowColor: Colors.primary[600],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            zIndex: 9999,
          }}
        >
          <View style={{ position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} color="#ffffff" />
            <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary[600], borderRadius: 7, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
              <Plus size={9} color="#ffffff" />
            </View>
          </View>
        </TouchableOpacity>
      </RNAnimated.View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType={isLargeScreen ? 'fade' : 'none'}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeFilterModal}
      >

        <View style={{
          flex: 1,
          justifyContent: isLargeScreen ? 'center' : 'flex-end',
          alignItems: isLargeScreen ? 'center' : 'stretch',
        }}>
          {/* Clickable Backdrop */}
          <RNAnimated.View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'transparent',
            }}
          >
            <Pressable onPress={closeFilterModal} style={{ flex: 1 }} />
          </RNAnimated.View>

          <RNAnimated.View
            onLayout={(e) => {
              filterSheetY.current = e.nativeEvent.layout.y;
            }}
            {...filterPanResponder.panHandlers}
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: isLargeScreen ? 24 : 0,
              borderBottomRightRadius: isLargeScreen ? 24 : 0,
              paddingTop: 12,
              paddingBottom: isLargeScreen ? 24 : 0,
              borderTopWidth: 1,
              borderTopColor: isDarkMode ? '#334155' : '#e2e8f0',
              maxHeight: '60%',
              width: '100%',
              maxWidth: isLargeScreen ? 800 : '100%',
              transform: isLargeScreen ? undefined : [{ translateY: filterPanY }],
            }}
          >
            {/* Header Drag Zone */}
            <View style={{ width: '100%' }}>
              <View style={{ width: '100%', alignItems: 'center', paddingVertical: 8, marginBottom: 4 }}>
                <View style={{ width: 40, height: 5, borderRadius: 2.5, backgroundColor: isDarkMode ? '#475569' : '#cbd5e1' }} />
              </View>
              <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Filters</Text>
              </View>
            </View>

            {/* Close/Reset Buttons */}
            <View style={{
              position: 'absolute',
              top: 24,
              right: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              zIndex: 10,
            }}>
              {totalActiveFiltersCount > 0 && (
                <TouchableOpacity
                  onPress={clearAllFilters}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <RotateCcw size={14} color={Colors.error[500]} />
                  <Text style={{ color: Colors.error[500], fontSize: 13, fontWeight: '600' }}>Reset</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={closeFilterModal}
                style={{ padding: 4, borderRadius: 12, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100] }}
              >
                <X size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ paddingHorizontal: 24 }}
              contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
              onScroll={(e) => { filterScrollOffset.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {/* Sort Order */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort By</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 }}>
                <FilterPill
                  label="Newest first"
                  selected={sortOrder === 'newest'}
                  onPress={() => setSortOrder('newest')}
                />
                <FilterPill
                  label="Oldest first"
                  selected={sortOrder === 'oldest'}
                  onPress={() => setSortOrder('oldest')}
                />
              </View>
            </ScrollView>
           </RNAnimated.View>
        </View>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal visible={showForm} transparent={true} animationType={isLargeScreen ? 'fade' : 'slide'} statusBarTranslucent={true} navigationBarTranslucent={true} onRequestClose={closeFormModal}>

        <View style={{
          flex: 1,
          justifyContent: isLargeScreen ? 'center' : 'flex-end',
          alignItems: isLargeScreen ? 'center' : 'stretch',
        }}>
          {/* Clickable Backdrop */}
          <RNAnimated.View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'transparent',
            }}
          >
            <Pressable onPress={closeFormModal} style={{ flex: 1 }} />
          </RNAnimated.View>
          
          <RNAnimated.View
            onLayout={(e) => {
              formSheetY.current = e.nativeEvent.layout.y;
            }}
            {...modalPanResponder.panHandlers}
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: isLargeScreen ? 24 : 0,
              borderBottomRightRadius: isLargeScreen ? 24 : 0,
              paddingTop: 12,
              paddingHorizontal: 24,
              paddingBottom: isLargeScreen ? 24 : 0,
              height: isLargeScreen ? '85%' : '92%',
              width: '100%',
              maxWidth: isLargeScreen ? 800 : '100%',
              transform: isLargeScreen ? undefined : [{ translateY: modalTranslateY }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              {/* Swipe Drag Handle Bar */}
              <View 
                style={{ width: '100%', alignItems: 'center', paddingVertical: 12, marginBottom: 4, backgroundColor: 'transparent' }}
              >
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#d1d5db' }} />
              </View>

              {/* Modal Header with Title & Close Button */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Users size={20} color={isDarkMode ? '#818cf8' : '#4f46e5'} />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>
                    {editingWeaver ? 'Edit Weaver' : 'Add Weaver'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeFormModal}
                  activeOpacity={0.7}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <X size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 80 : 100 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                onScroll={(e) => { formScrollOffset.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Name *</Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder="Weaver name"
                placeholderTextColor={theme.inputPlaceholder}
                style={{
                  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: theme.text,
                  marginBottom: 16,
                }}
              />

              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Phone</Text>
              <TextInput
                value={formPhone}
                onChangeText={setFormPhone}
                placeholder="Phone number"
                placeholderTextColor={theme.inputPlaceholder}
                keyboardType="phone-pad"
                style={{
                  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: theme.text,
                  marginBottom: 16,
                }}
              />

              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Address</Text>
              <TextInput
                value={formAddress}
                onChangeText={setFormAddress}
                placeholder="Address"
                placeholderTextColor={theme.inputPlaceholder}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: theme.text,
                  marginBottom: 24,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />

              <View style={{ marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.8}
                  style={{
                    width: '100%',
                    paddingVertical: 15,
                    borderRadius: 14,
                    alignItems: 'center',
                    backgroundColor: submitting ? Colors.primary[400] : Colors.primary[600],
                    shadowColor: Colors.primary[600],
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                      {editingWeaver ? 'Update' : 'Create'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
         </RNAnimated.View>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <Modal visible={!!deleteTarget} animationType="fade" transparent onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, width: '100%', maxWidth: containerMaxWidth, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 24 }}>
          <View style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#fff',
            borderRadius: 24,
            padding: 24,
            width: '100%',
            maxWidth: 340,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 24,
            elevation: 10,
          }}>
            {/* Delete icon */}
            <View style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : Colors.error[50],
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <Trash2 size={24} color={Colors.error[600]} />
            </View>

            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 8 }}>Delete Weaver</Text>
            <Text style={{ fontSize: 15, color: theme.textTertiary, marginBottom: 24, lineHeight: 21 }}>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDeleteTarget(null)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: Colors.error[600],
                  shadowColor: Colors.error[600],
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
