import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Platform, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, PanResponder, Animated as RNAnimated, Dimensions, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Users, Search, X, ArrowUpDown, Plus, Phone, MapPin, ChevronRight, SlidersHorizontal, RotateCcw, Pencil, Trash2, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
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
          borderColor: theme.borderLight,
          shadowColor: isDarkMode ? '#000' : Colors.neutral[400],
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDarkMode ? 0.3 : 0.1,
          shadowRadius: 8,
          elevation: 3,
          overflow: 'hidden',
        }}
      >
        {/* Accent top border */}
        <View style={{ height: 3, backgroundColor: Colors.primary[500], width: '100%' }} />

        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              {/* Name with initial badge */}
              <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
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
                <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, flex: 1 }} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>

              {/* Phone */}
              {item.phone ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, marginLeft: 2 }}>
                  <Phone size={13} color={theme.textTertiary} />
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 7 }}>{item.phone}</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, marginLeft: 2 }}>
                  <Phone size={13} color={theme.textTertiary} />
                  <Text style={{ fontSize: 13, color: theme.textTertiary, marginLeft: 7, fontStyle: 'italic' }}>No phone</Text>
                </View>
              )}

              {/* Address */}
              {item.address ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginLeft: 2 }}>
                  <MapPin size={13} color={theme.textTertiary} style={{ marginTop: 1 }} />
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 7, flex: 1 }} numberOfLines={2}>{item.address}</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 2 }}>
                  <MapPin size={13} color={theme.textTertiary} />
                  <Text style={{ fontSize: 13, color: theme.textTertiary, marginLeft: 7, fontStyle: 'italic' }}>No address</Text>
                </View>
              )}
            </View>

            <ChevronRight size={18} color={theme.textTertiary} style={{ marginTop: 8 }} />
          </View>

          {/* Action buttons */}
          {isSuperAdmin ? (
            <View style={{ gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: theme.borderLight, paddingTop: 12 }}>
              {/* Row 1: Edit & Add Sample */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => onEdit(item)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: isDarkMode ? 'rgba(124, 58, 237, 0.15)' : '#f5f3ff',
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(124, 58, 237, 0.3)' : '#ddd6fe',
                    gap: 6,
                  }}
                >
                  <Pencil size={14} color={isDarkMode ? '#c084fc' : '#7c3aed'} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#c084fc' : '#7c3aed' }}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/(tabs)/weaver/${item._id}?addSample=true` as any);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
                    gap: 6,
                  }}
                >
                  <Plus size={14} color={isDarkMode ? '#34d399' : '#059669'} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#34d399' : '#059669' }}>Add Sample</Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: View & Delete All */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={handlePress}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe',
                    gap: 6,
                  }}
                >
                  <ChevronRight size={14} color={isDarkMode ? '#60a5fa' : '#2563eb'} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#60a5fa' : '#2563eb' }}>View</Text>
                </TouchableOpacity>

                {isMaster && (
                  <TouchableOpacity
                    onPress={() => onDelete(item)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 9,
                      borderRadius: 10,
                      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fde8e8',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#f8b4b4',
                      gap: 6,
                    }}
                  >
                    <Trash2 size={14} color={Colors.error[600]} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.error[600] }}>Delete All</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handlePress}
              activeOpacity={0.7}
              style={{
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe',
                gap: 6,
              }}
            >
              <ChevronRight size={16} color={isDarkMode ? '#60a5fa' : '#2563eb'} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#60a5fa' : '#2563eb' }}>View Samples</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

export default function WeaverListScreen() {
  const { theme, isDarkMode } = useTheme();
  const { isSuperAdmin, isMaster } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useAppStore(s => s.addToast);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const filterPanY = useRef(new RNAnimated.Value(600)).current;

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editingWeaver, setEditingWeaver] = useState<Weaver | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const modalTranslateY = useRef(new RNAnimated.Value(600)).current;

  const modalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          modalTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          RNAnimated.timing(modalTranslateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: Platform.OS !== 'web',
          }).start(() => {
            setShowForm(false);
          });
        } else {
          RNAnimated.timing(modalTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
      }
    })
  ).current;

  const closeFormModal = useCallback(() => {
    RNAnimated.timing(modalTranslateY, {
      toValue: 600,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setShowForm(false);
    });
  }, [modalTranslateY]);

  React.useEffect(() => {
    if (showForm) {
      modalTranslateY.setValue(600);
      RNAnimated.timing(modalTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [showForm]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Weaver | null>(null);
  const [deleting, setDeleting] = useState(false);

  // FAB drag
  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 76, y: screenHeight - 160 })).current;

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
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setShowFilterModal(false);
    });
  }, [filterPanY]);

  const filterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          filterPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 40 || gestureState.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeFilterModal();
        } else {
          RNAnimated.timing(filterPanY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
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
        useNativeDriver: Platform.OS !== 'web',
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
          x: (pan.x as any)._value || 0,
          y: (pan.y as any)._value || 0,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: RNAnimated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (e, gestureState) => {
        pan.flattenOffset();

        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        const snapLeftX = 16;
        const snapRightX = screenWidth - 76;
        const targetX = currentX < screenWidth / 2 ? snapLeftX : snapRightX;

        const minY = 120;
        const maxY = screenHeight - 200;
        const targetY = Math.min(Math.max(currentY, minY), maxY);

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

      {/* Count and Filter Summary Row */}
      {(() => {
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
      })()}

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
        <FlatList
          data={weavers}
          keyExtractor={(item, index) => item._id + '-' + index}
          renderItem={({ item, index }) => <WeaverCard item={item} index={index} onEdit={openEditForm} onDelete={setDeleteTarget} isSuperAdmin={isSuperAdmin} isMaster={isMaster} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (weaversQuery.hasNextPage && !weaversQuery.isFetchingNextPage) weaversQuery.fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListFooterComponent={weaversQuery.isFetchingNextPage ? (
            <View style={{ paddingVertical: 24, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={Colors.primary[500]} />
              <Text style={{ fontSize: 13, color: theme.textTertiary, fontWeight: '500' }}>Loading more...</Text>
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
      )}

      {/* Draggable FAB */}
      <RNAnimated.View
        {...panResponder.panHandlers}
        style={{
          left: pan.x,
          top: pan.y,
          position: 'absolute',
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
        animationType="none"
        onRequestClose={closeFilterModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeFilterModal}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
          />

          <RNAnimated.View
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingBottom: 24 + insets.bottom,
              borderTopWidth: 1,
              borderTopColor: isDarkMode ? '#334155' : '#e2e8f0',
              maxHeight: '60%',
              transform: [{ translateY: filterPanY }],
            }}
          >
            {/* Header Drag Zone */}
            <View {...filterPanResponder.panHandlers} style={{ width: '100%' }}>
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

            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 24 }}>
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
      <Modal visible={showForm} transparent={true} animationType="none" statusBarTranslucent={true} onRequestClose={closeFormModal}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          {/* Clickable Backdrop */}
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={closeFormModal} />
          
          <RNAnimated.View style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingHorizontal: 24,
            paddingBottom: 24 + insets.bottom,
            height: 520,
            maxHeight: screenHeight * 0.8,
            width: '100%',
            transform: [{ translateY: modalTranslateY }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 20,
          }}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              {/* Swipe Drag Handle Bar */}
              <View 
                {...modalPanResponder.panHandlers} 
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
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
                keyboardShouldPersistTaps="handled"
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 }}>
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
