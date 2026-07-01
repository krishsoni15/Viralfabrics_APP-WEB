import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Platform, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Image, Alert, PanResponder, Animated as RNAnimated, Dimensions, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TestTubes, Search, X, Plus, Image as ImageIcon, Edit, Trash2, Camera, SlidersHorizontal, RotateCcw, WifiOff, MapPin } from 'lucide-react-native';
import { useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker failed to load:', e);
}

import api from '../../../services/api';
import Header from '../../../components/shared/Header';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { SamplingSkeletonList } from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import ImagePreviewModal from '../../../components/shared/ImagePreviewModal';
import CustomCameraModal from '../../../components/shared/CustomCameraModal';
import { useTheme } from '../../../hooks/useTheme';
import { useAuth } from '../../../hooks/useAuth';
import { Colors } from '../../../constants/colors';
import { SamplingItem } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { formatDate, resolveImageUrl, uploadSingleImage } from '../../../utils/helpers';

const PAGE_SIZE = 20;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

const SamplingCard = React.memo(function SamplingCard({
  item, index, onEdit, onDelete, isSuperAdmin, isMaster, onPreviewImages
}: { item: SamplingItem; index: number; onEdit: (s: SamplingItem) => void; onDelete: (s: SamplingItem) => void; isSuperAdmin: boolean; isMaster: boolean; onPreviewImages: (imgs: string[]) => void }) {
  const { theme, isDarkMode } = useTheme();

  // Premium colors for badges in dark/light mode
  const pieceColor = {
    bg: isDarkMode ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff',
    text: isDarkMode ? '#60a5fa' : '#1d4ed8',
    border: isDarkMode ? 'rgba(59, 130, 246, 0.25)' : '#bfdbfe'
  };

  const meterColor = {
    bg: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
    text: isDarkMode ? '#34d399' : '#047857',
    border: isDarkMode ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0'
  };

  return (
    <Animated.View>
      <Card style={{ marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.borderLight, backgroundColor: theme.card, borderRadius: 16, padding: 18 }}>
        {/* Image clickable preview */}
        {item.images && item.images.length > 0 && (
          <TouchableOpacity onPress={() => onPreviewImages(item.images || [])} activeOpacity={0.9} style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden' }}>
            <Image 
              source={{ uri: resolveImageUrl(item.images[0]) }} 
              style={{ width: '100%', height: 160, borderRadius: 12 }} 
              resizeMode="cover" 
              resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
              fadeDuration={100}
            />
            {item.images.length > 1 && (
              <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                <ImageIcon size={11} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{item.images.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 6 }} numberOfLines={2}>{item.qualityName}</Text>

        {item.whereToPut ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <MapPin size={14} color={isDarkMode ? '#a78bfa' : '#7c3aed'} />
            <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '500' }}>
              Location: <Text style={{ color: theme.text, fontWeight: '700' }}>{item.whereToPut}</Text>
            </Text>
          </View>
        ) : null}

        {item.notes ? (
          <View style={{ 
            marginTop: 4, 
            marginBottom: 8,
            padding: 10, 
            borderRadius: 10, 
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', 
            borderLeftWidth: 3, 
            borderLeftColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1' 
          }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary, fontStyle: 'italic', lineHeight: 17 }} numberOfLines={3}>{item.notes}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 4 }}>
          {item.piece != null && item.piece > 0 ? <Badge text={`${item.piece} pcs`} color={pieceColor} /> : null}
          {item.meter != null && item.meter > 0 ? <Badge text={`${item.meter} mtr`} color={meterColor} /> : null}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
          <Text style={{ fontSize: 11.5, color: theme.textTertiary, fontWeight: '500' }}>{formatDate(item.createdAt)}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {isSuperAdmin && (
              <TouchableOpacity
                onPress={() => onEdit(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(59,130,246,0.3)' : '#bfdbfe',
                  backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff',
                }}
              >
                <Edit size={13} color={isDarkMode ? '#60a5fa' : Colors.primary[600]} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? '#60a5fa' : Colors.primary[600] }}>Edit</Text>
              </TouchableOpacity>
            )}
            {isMaster && (
              <TouchableOpacity
                onPress={() => onDelete(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(239,68,68,0.3)' : '#fca5a5',
                  backgroundColor: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                }}
              >
                <Trash2 size={13} color={isDarkMode ? '#ef4444' : Colors.error[600]} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? '#ef4444' : Colors.error[600] }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
});

export default function SamplingScreen() {
  const { theme, isDarkMode } = useTheme();
  const { isSuperAdmin, isMaster } = useAuth();
  const segments = useSegments();
  const isInTabs = (segments as string[]).includes('(tabs)');
  const queryClient = useQueryClient();
  const addToast = useAppStore(s => s.addToast);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const isOffline = useAppStore(s => s.isOffline);
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sortBy, setSortBy] = useState('createdAt');
  const [minMeter, setMinMeter] = useState('');
  const [maxMeter, setMaxMeter] = useState('');
  const [minPiece, setMinPiece] = useState('');
  const [maxPiece, setMaxPiece] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals visibility
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<SamplingItem | null>(null);
  const [formData, setFormData] = useState({ qualityName: '', whereToPut: '', notes: '', piece: '', meter: '' });
  const [formImages, setFormImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [cameraVisible, setCameraVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<SamplingItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Animated values for sheet transitions
  const filterPanY = useRef(new RNAnimated.Value(600)).current;
  const formPanY = useRef(new RNAnimated.Value(600)).current;

  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 68, y: screenHeight - 200 })).current;

  const fabPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
    onPanResponderGrant: () => { pan.setOffset({ x: (pan.x as any)._value || 0, y: (pan.y as any)._value || 0 }); pan.setValue({ x: 0, y: 0 }); },
    onPanResponderMove: RNAnimated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: () => {
      pan.flattenOffset();
      const snapX = (pan.x as any)._value < screenWidth / 2 ? 16 : screenWidth - 68;
      const snapY = Math.min(Math.max((pan.y as any)._value, 120), screenHeight - 200);
      RNAnimated.spring(pan, { toValue: { x: snapX, y: snapY }, useNativeDriver: false, friction: 6 }).start();
    },
  })).current;

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
          RNAnimated.spring(filterPanY, {
            toValue: 0,
            useNativeDriver: Platform.OS !== 'web',
            friction: 7,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showFilterModal) {
      filterPanY.setValue(600);
      RNAnimated.spring(filterPanY, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        damping: 15,
        stiffness: 120,
      }).start();
    }
  }, [showFilterModal]);

  // Form modal handlers
  const closeFormModal = useCallback(() => {
    RNAnimated.timing(formPanY, {
      toValue: 600,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setShowForm(false);
    });
  }, [formPanY]);

  const formPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          formPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeFormModal();
        } else {
          RNAnimated.spring(formPanY, {
            toValue: 0,
            useNativeDriver: Platform.OS !== 'web',
            friction: 5,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showForm) {
      formPanY.setValue(600);
      RNAnimated.spring(formPanY, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        damping: 15,
        stiffness: 120,
      }).start();
    }
  }, [showForm]);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(text), 500);
  }, []);

  const clearAllFilters = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSearch('');
    setDebouncedSearch('');
    setSortOrder('desc');
    setSortBy('createdAt');
    setMinMeter('');
    setMaxMeter('');
    setMinPiece('');
    setMaxPiece('');
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sortOrder !== 'desc') count++;
    if (sortBy !== 'createdAt') count++;
    if (minMeter !== '') count++;
    if (maxMeter !== '') count++;
    if (minPiece !== '') count++;
    if (maxPiece !== '') count++;
    return count;
  }, [sortOrder, sortBy, minMeter, maxMeter, minPiece, maxPiece]);

  const totalActiveFiltersCount = useMemo(() => {
    let count = activeFilterCount;
    if (debouncedSearch.trim() !== '') count++;
    return count;
  }, [activeFilterCount, debouncedSearch]);

  const query = useInfiniteQuery({
    queryKey: ['sampling', debouncedSearch, sortOrder, sortBy, minMeter, maxMeter, minPiece, maxPiece],
    enabled: isAuthenticated,
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const params: any = { page: pageParam, limit: PAGE_SIZE, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (minMeter) params.minMeter = minMeter;
      if (maxMeter) params.maxMeter = maxMeter;
      if (minPiece) params.minPiece = minPiece;
      if (maxPiece) params.maxPiece = maxPiece;
      const { data } = await api.get('/api/sampling', { params });
      const items = data?.data || [];
      const pagination = data?.pagination || {};
      const summary = data?.summary || { totalPieces: 0, totalMeters: 0, uniqueQualities: 0 };
      return { 
        items, 
        hasNext: pageParam < (pagination.totalPages || pagination.pages || 1), 
        nextPage: pageParam + 1, 
        totalCount: pagination.totalCount || items.length,
        summary 
      };
    },
    getNextPageParam: (lastPage) => lastPage.hasNext ? lastPage.nextPage : undefined,
  });

  const samples = query.data?.pages.flatMap(p => p.items) || [];
  const summary = query.data?.pages[0]?.summary || { totalPieces: 0, totalMeters: 0, uniqueQualities: 0 };
  const totalMatchingCount = query.data?.pages[0]?.totalCount || 0;

  const openCreateForm = () => {
    setEditingItem(null);
    setFormData({ qualityName: '', whereToPut: '', notes: '', piece: '', meter: '' });
    setFormImages([]);
    setShowForm(true);
  };

  const openEditForm = (item: SamplingItem) => {
    setEditingItem(item);
    setFormData({ qualityName: item.qualityName || '', whereToPut: item.whereToPut || '', notes: item.notes || '', piece: item.piece?.toString() || '', meter: item.meter?.toString() || '' });
    setFormImages(item.images || []);
    setShowForm(true);
  };

  const pickImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Image picker is not available on this platform/device');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setFormImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handleCameraCapture = (uris: string[]) => {
    setFormImages(prev => [...prev, ...uris]);
  };

  const uploadImages = async (localUris: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of localUris) {
      try {
        const uploadedUrl = await uploadSingleImage(uri, 'sampling');
        urls.push(uploadedUrl);
      } catch (err) {
        console.error('Error uploading image:', err);
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!formData.qualityName.trim()) {
      addToast({ type: 'error', title: 'Validation', message: 'Quality name is required' }); return;
    }
    setSubmitting(true);
    try {
      const imageUrls = await uploadImages(formImages);
      const payload = {
        qualityName: formData.qualityName.trim(), whereToPut: formData.whereToPut.trim(),
        notes: formData.notes.trim(), piece: formData.piece ? Number(formData.piece) : 0,
        meter: formData.meter ? Number(formData.meter) : 0, images: imageUrls,
      };
      if (editingItem) {
        await api.put(`/api/sampling/${editingItem._id}`, payload);
        addToast({ type: 'success', title: 'Updated', message: 'Sampling updated' });
      } else {
        await api.post('/api/sampling', payload);
        addToast({ type: 'success', title: 'Created', message: 'Sampling created' });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeFormModal();
      queryClient.invalidateQueries({ queryKey: ['sampling'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to save' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/sampling/${deleteTarget._id}`);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({ type: 'success', title: 'Deleted', message: 'Sampling deleted' });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['sampling'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to delete' });
    } finally { setDeleting(false); }
  };

  const handleOpenPreview = (imgs: string[]) => {
    setPreviewImages(imgs);
    setPreviewVisible(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {!isInTabs && <Header title="Sampling" showBack />}



      {/* Search + Filter Row */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}>
          <Search size={18} color={theme.textTertiary} />
          <TextInput placeholder="Search sampling..." placeholderTextColor={theme.inputPlaceholder} value={search} onChangeText={handleSearch} style={{ flex: 1, marginLeft: 10, fontSize: 15, color: theme.text, paddingVertical: 0 }} />
          {search.length > 0 && <TouchableOpacity onPress={() => { setSearch(''); setDebouncedSearch(''); }}><X size={18} color={theme.textTertiary} /></TouchableOpacity>}
        </View>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowFilterModal(true);
          }}
          activeOpacity={0.7}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
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

      {isOffline && (
        <View style={{
          marginHorizontal: 16,
          marginBottom: 10,
          backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
          borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.3)' : '#fef3c7',
          borderWidth: 1,
          borderRadius: 12,
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8
        }}>
          <WifiOff size={14} color={isDarkMode ? '#fbbf24' : '#b45309'} />
          <Text style={{ fontSize: 12.5, color: isDarkMode ? '#fbbf24' : '#b45309', fontWeight: '600', flex: 1 }}>
            Offline Mode • Showing previously loaded cached data
          </Text>
        </View>
      )}


      {/* Count and Filter Summary Row */}
      {(() => {
        if (totalMatchingCount === 0 && totalActiveFiltersCount === 0) return null;
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
              {totalActiveFiltersCount > 0 || debouncedSearch.trim() !== '' ? (
                <Text>
                  Showing <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{samples.length}</Text> of <Text style={{ fontWeight: '800', color: theme.text }}>{totalMatchingCount}</Text>
                </Text>
              ) : (
                <Text>
                  Total Samples: <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{totalMatchingCount}</Text>
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
      {query.isLoading ? <SamplingSkeletonList count={3} /> : samples.length === 0 ? (
        <EmptyState icon={<TestTubes size={48} color={Colors.primary[500]} />} title="No Sampling" subtitle={debouncedSearch ? 'No samples match your search.' : 'No sampling items added yet.'} />
      ) : (
        <FlatList
          data={samples}
          keyExtractor={(item, i) => item._id + '-' + i}
          renderItem={({ item, index }) => <SamplingCard item={item} index={index} onEdit={openEditForm} onDelete={setDeleteTarget} isSuperAdmin={isSuperAdmin} isMaster={isMaster} onPreviewImages={handleOpenPreview} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListFooterComponent={query.isFetchingNextPage ? <View style={{ paddingVertical: 20, alignItems: 'center' }}><ActivityIndicator size="small" color={Colors.primary[500]} /><Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 6 }}>Loading more...</Text></View> : null}
          refreshControl={Platform.OS !== 'web' ? <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); query.refetch(); }} tintColor={Colors.primary[500]} colors={[Colors.primary[500]]} /> : undefined}
        />
      )}

      {/* FAB */}
      {isSuperAdmin && (
        <RNAnimated.View {...fabPanResponder.panHandlers} style={[{ position: 'absolute', zIndex: 9999 }, { transform: pan.getTranslateTransform() }]}>
          <TouchableOpacity onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openCreateForm(); }} activeOpacity={0.85} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary[600], alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}>
            <View style={{ position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <TestTubes size={24} color="#ffffff" />
              <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary[600], borderRadius: 7, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
                <Plus size={9} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
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
              maxHeight: '80%',
              transform: [{ translateY: filterPanY }],
            }}
          >
            {/* Header Drag Zone */}
            <View {...filterPanResponder.panHandlers} style={{ width: '100%' }}>
              {/* Swipe Drag Handle Bar */}
              <View
                style={{
                  width: '100%',
                  alignItems: 'center',
                  paddingVertical: 8,
                  marginBottom: 8,
                }}
              >
                <View style={{
                  width: 40,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: isDarkMode ? '#475569' : '#cbd5e1',
                }} />
              </View>

              <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Filters</Text>
              </View>
            </View>

            {/* Absolute Close/Reset Buttons Container */}
            <View style={{
              position: 'absolute',
              top: 24,
              right: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              zIndex: 10,
            }}>
              {activeFilterCount > 0 && (
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
                style={{
                  padding: 4,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
                }}
              >
                <X size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 24 }}>
              {/* Sort Order Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort Direction</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
                <FilterPill
                  label="Newest / Latest"
                  selected={sortOrder === 'desc'}
                  onPress={() => {
                    setSortOrder('desc');
                  }}
                />
                <FilterPill
                  label="Oldest"
                  selected={sortOrder === 'asc'}
                  onPress={() => {
                    setSortOrder('asc');
                  }}
                />
              </View>
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal visible={showForm} animationType="none" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={closeFormModal}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          {/* Clickable Backdrop */}
          <Pressable onPress={closeFormModal} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

          <RNAnimated.View
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingHorizontal: 24,
              paddingBottom: 24 + insets.bottom,
              height: '85%',
              transform: [{ translateY: formPanY }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 130}
              style={{ flex: 1 }}
            >
              {/* Swipe Drag Handle Bar */}
              <View 
                {...formPanResponder.panHandlers} 
                style={{ width: '100%', alignItems: 'center', paddingVertical: 12, marginBottom: 4, backgroundColor: 'transparent' }}
              >
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#d1d5db' }} />
              </View>

              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TestTubes size={20} color={isDarkMode ? '#c084fc' : '#9333ea'} />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>
                    {editingItem ? 'Edit Sampling' : 'Add Sampling'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeFormModal}
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
                contentContainerStyle={{ paddingBottom: 180 + insets.bottom }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Quality Name *</Text>
                <TextInput value={formData.qualityName} onChangeText={t => setFormData(p => ({ ...p, qualityName: t }))} placeholder="Enter quality name..." placeholderTextColor={theme.inputPlaceholder} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14 }} />

                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Where To Put</Text>
                <TextInput value={formData.whereToPut} onChangeText={t => setFormData(p => ({ ...p, whereToPut: t }))} placeholder="Location" placeholderTextColor={theme.inputPlaceholder} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14 }} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Piece (Qty)</Text>
                    <TextInput value={formData.piece} onChangeText={t => setFormData(p => ({ ...p, piece: t }))} placeholder="0" keyboardType="numeric" placeholderTextColor={theme.inputPlaceholder} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Meter (Length)</Text>
                    <TextInput value={formData.meter} onChangeText={t => setFormData(p => ({ ...p, meter: t }))} placeholder="0.00" keyboardType="numeric" placeholderTextColor={theme.inputPlaceholder} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14 }} />
                  </View>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Notes</Text>
                <TextInput value={formData.notes} onChangeText={t => setFormData(p => ({ ...p, notes: t }))} placeholder="Notes" placeholderTextColor={theme.inputPlaceholder} multiline numberOfLines={3} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14, minHeight: 70, textAlignVertical: 'top' }} />

                {/* Images */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Images</Text>
                    <View style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : Colors.neutral[100], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>{formImages.length} image(s)</Text>
                    </View>
                  </View>

                  {/* Buttons Row */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={pickImage}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: isDarkMode ? Colors.neutral[700] : Colors.neutral[300],
                        backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <ImageIcon size={16} color={theme.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Upload Image</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setCameraVisible(true)}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: isDarkMode ? Colors.neutral[700] : Colors.neutral[300],
                        backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Camera size={16} color={theme.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Camera</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Thumbnail list */}
                  {formImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {formImages.map((img, i) => (
                        <View key={i} style={{ position: 'relative' }}>
                          <TouchableOpacity 
                            activeOpacity={0.8}
                            onPress={() => handleOpenPreview([img])}
                          >
                            <Image 
                              source={{ uri: resolveImageUrl(img) }} 
                              style={{ width: 80, height: 80, borderRadius: 10 }} 
                              resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                              fadeDuration={100}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormImages(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: -4, right: -4, backgroundColor: Colors.error[500], width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                            <X size={12} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <View style={{ marginTop: 8, marginBottom: 20 }}>
                  <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={{ width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: submitting ? Colors.primary[400] : Colors.primary[600] }}>
                    {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{editingItem ? 'Update' : 'Create'}</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Delete Modal */}
      <Modal visible={!!deleteTarget} animationType="fade" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 12 }}>Delete Sampling</Text>
            <Text style={{ fontSize: 15, color: theme.textSecondary, marginBottom: 24 }}>Delete "{deleteTarget?.qualityName}"? This cannot be undone.</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setDeleteTarget(null)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} disabled={deleting} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.error[600] }}>
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <CustomCameraModal visible={cameraVisible} onClose={() => setCameraVisible(false)} onPhotosCaptured={handleCameraCapture} />

      {/* Image Preview Modal */}
      <ImagePreviewModal visible={previewVisible} images={previewImages} onClose={() => setPreviewVisible(false)} />
    </SafeAreaView>
  );
}
