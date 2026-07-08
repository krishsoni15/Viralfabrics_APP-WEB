import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Platform, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, ScrollView, KeyboardAvoidingView, Pressable, PanResponder, Animated as RNAnimated, Dimensions, Keyboard, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useSegments, Redirect } from 'expo-router';
import { Search, X, Plus, Image as ImageIcon, Trash2, Edit, Camera, SlidersHorizontal, RotateCcw, ChevronDown, Package, WifiOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { console.warn('expo-image-picker failed:', e); }

import api from '../../services/api';
import Header from '../../components/shared/Header';
import { FinishLotSkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ImagePreviewModal from '../../components/shared/ImagePreviewModal';
import CustomCameraModal from '../../components/shared/CustomCameraModal';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { Colors } from '../../constants/colors';
import { FinishLotStock } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatDate, resolveImageUrl, uploadSingleImage } from '../../utils/helpers';

const PAGE_SIZE = 5;
const FinishProgressBar = () => {
  const { isDarkMode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const translateX = useSharedValue(-150);
  React.useEffect(() => {
    translateX.value = -150;
    translateX.value = withRepeat(withTiming(screenWidth, { duration: 1000, easing: Easing.linear }), -1, false);
  }, [screenWidth]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  return (
    <View style={{ width: '100%', height: 3, backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0', overflow: 'hidden' }}>
      <Animated.View style={[{ width: 150, height: '100%', backgroundColor: Colors.primary[500] }, animatedStyle]} />
    </View>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────
const searchTypeLabels: Record<string, string> = { all: 'All', open: 'Open', sold: 'Sold' };
const searchTypeFullLabels: Record<string, string> = { all: 'All Lots', open: 'Open (In Stock)', sold: 'Sold Out' };
const searchTypePlaceholders: Record<string, string> = { all: 'Search finish lots...', open: 'Search open lots...', sold: 'Search sold lots...' };

// ─── Finish Lot Card ──────────────────────────────────────────────────────
const FinishLotCard = React.memo(function FinishLotCard({
  item, index, onEdit, onDelete, isSuperAdmin, isMaster, onPreviewImages, numColumns = 1
}: { item: FinishLotStock; index: number; onEdit: (f: FinishLotStock) => void; onDelete: (f: FinishLotStock) => void; isSuperAdmin: boolean; isMaster: boolean; onPreviewImages: (imgs: string[]) => void; numColumns?: number }) {
  const { theme, isDarkMode } = useTheme();

  return (
    <Animated.View style={{ flex: 1 }}>
      <View style={{
        marginHorizontal: numColumns && numColumns > 1 ? 8 : 12,
        marginBottom: 14,
        borderRadius: 18,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: isDarkMode ? 'rgba(255,255,255,0.07)' : '#e8edf2',
        shadowColor: isDarkMode ? '#000' : '#94a3b8',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDarkMode ? 0.25 : 0.12,
        shadowRadius: 10,
        elevation: 4,
        padding: 14,
        flex: 1,
      }}>
        {/* Clickable Image Preview styled like fabrics/sampling page */}
        {item.images && item.images.length > 0 && (
          <TouchableOpacity
            onPress={() => onPreviewImages(item.images || [])}
            activeOpacity={0.9}
            style={{
              marginBottom: 12,
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: isDarkMode ? 'rgba(15,23,42,0.7)' : '#f1f5f9',
              borderWidth: 1,
              borderColor: theme.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image 
              source={{ uri: resolveImageUrl(item.images[0]) }} 
              style={{ width: '100%', height: 220 }} 
              resizeMode="contain" 
              resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
              fadeDuration={100}
            />
            {item.images.length > 1 && (
              <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}>
                <ImageIcon size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 5 }}>{item.images.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Quality Name */}
        <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 12, letterSpacing: -0.2 }} numberOfLines={2}>
          {item.qualityName}
        </Text>

        {/* Metadata Grid (replaces button-like look with clean structure) */}
        <View style={{
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
          borderRadius: 12,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.1)' : '#f8fafc',
          paddingVertical: 10,
          paddingHorizontal: 12,
          gap: 10,
        }}>
          {/* Pieces & Meters Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Pieces</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>
                {item.piece != null && item.piece > 0 ? `${item.piece} Pcs` : '-'}
              </Text>
            </View>
            <View style={{ width: 1, height: 28, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }} />
            <View style={{ flex: 1, paddingLeft: 16 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Meters</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>
                {item.meter != null && item.meter > 0 ? `${item.meter} Mtr` : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Date + Actions */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
        }}>
          <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '500' }}>
            {formatDate(item.createdAt)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {isSuperAdmin && (
              <TouchableOpacity
                onPress={() => onEdit(item)}
                activeOpacity={0.75}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDarkMode ? 'rgba(59,130,246,0.12)' : '#eff6ff',
                  borderWidth: 1, borderColor: isDarkMode ? 'rgba(59,130,246,0.3)' : '#bfdbfe',
                }}
              >
                <Edit size={15} color={isDarkMode ? '#60a5fa' : Colors.primary[600]} />
              </TouchableOpacity>
            )}
            {isMaster && (
              <TouchableOpacity
                onPress={() => onDelete(item)}
                activeOpacity={0.75}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : '#fef2f2',
                  borderWidth: 1, borderColor: isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca',
                }}
              >
                <Trash2 size={15} color={isDarkMode ? '#f87171' : Colors.error[600]} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ═══ MAIN SCREEN ═════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
export default function FinishLotStockScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const segments = useSegments();
  const isInTabs = (segments as string[]).includes('(tabs)');

  const { theme, isDarkMode } = useTheme();
  const { isSuperAdmin, isMaster } = useAuth();
  const { isLargeScreen, modalMaxWidth, numColumns, containerMaxWidth } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const addToast = useAppStore(s => s.addToast);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const isOffline = useAppStore(s => s.isOffline);

  // ─ State ──
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<FinishLotStock | null>(null);
  const [formData, setFormData] = useState({ qualityName: '', piece: '', meter: '' });
  const [formImages, setFormImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<FinishLotStock | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─ Refs ──
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterPanY = useRef(new RNAnimated.Value(600)).current;
  const formPanY = useRef(new RNAnimated.Value(800)).current;
  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 68, y: screenHeight - 170 })).current;
  const fabX = useRef(screenWidth - 68);
  const fabY = useRef(screenHeight - 170);
  const filterScrollOffset = useRef(0);
  const formScrollOffset = useRef(0);
  const formSheetY = useRef(0);
  const filterSheetY = useRef(0);

  const dimensionsRef = useRef({ screenWidth, screenHeight });
  dimensionsRef.current = { screenWidth, screenHeight };

  React.useEffect(() => {
    const isSnappedLeft = fabX.current < screenWidth / 2;
    const targetX = isSnappedLeft ? 16 : screenWidth - 68;
    const targetY = Math.min(Math.max(fabY.current, 120), screenHeight - 170);
    
    fabX.current = targetX;
    fabY.current = targetY;
    
    RNAnimated.spring(pan, {
      toValue: { x: targetX, y: targetY },
      useNativeDriver: false,
      friction: 6,
    }).start();
  }, [screenWidth, screenHeight]);

  // ─ Modal Animators ──
  const closeFilterModal = useCallback(() => {
    RNAnimated.timing(filterPanY, { toValue: 600, duration: 160, useNativeDriver: false }).start(() => setShowFilterModal(false));
  }, [filterPanY]);

  const closeForm = useCallback(() => {
    RNAnimated.timing(formPanY, { toValue: 800, duration: 180, useNativeDriver: false }).start(() => setShowForm(false));
  }, [formPanY]);

  // ─ PanResponders ──
  const filterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e, gs) => {
        const touchY = e.nativeEvent.pageY - filterSheetY.current;
        return touchY > 0 && touchY <= 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return filterScrollOffset.current <= 0 && gs.dy > 0 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return filterScrollOffset.current <= 0 && gs.dy > 0 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
      onPanResponderGrant: () => {
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          filterPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.5) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeFilterModal();
        } else {
          RNAnimated.spring(filterPanY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 65,
            friction: 11
          }).start();
        }
      },
    })
  ).current;

  const formPanResponder = useRef(
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
          formPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.5) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeForm();
        } else {
          RNAnimated.spring(formPanY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 65,
            friction: 11
          }).start();
        }
      },
    })
  ).current;
  const fabPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
    onPanResponderGrant: () => { pan.setOffset({ x: fabX.current, y: fabY.current }); pan.setValue({ x: 0, y: 0 }); },
    onPanResponderMove: RNAnimated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (e, gestureState) => {
      pan.flattenOffset();
      const currentScreenWidth = dimensionsRef.current.screenWidth;
      const currentScreenHeight = dimensionsRef.current.screenHeight;

      const currentX = fabX.current + gestureState.dx;
      const currentY = fabY.current + gestureState.dy;
      const snapX = currentX < currentScreenWidth / 2 ? 16 : currentScreenWidth - 68;
      const snapY = Math.min(Math.max(currentY, 120), currentScreenHeight - 170);
      fabX.current = snapX;
      fabY.current = snapY;
      RNAnimated.spring(pan, { toValue: { x: snapX, y: snapY }, useNativeDriver: false, friction: 6 }).start();
    },
  })).current;

  // ─ Modal open effects ──
  React.useEffect(() => { if (showFilterModal) { filterPanY.setValue(600); RNAnimated.spring(filterPanY, { toValue: 0, useNativeDriver: false, damping: 15, stiffness: 120 }).start(); } }, [showFilterModal]);

  React.useEffect(() => { if (showForm) { formPanY.setValue(800); RNAnimated.spring(formPanY, { toValue: 0, useNativeDriver: false, damping: 15, stiffness: 120 }).start(); } }, [showForm]);

  // ─ Callbacks ──
  const clearAllFilters = useCallback(() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSearch(''); setDebouncedSearch(''); setSearchType('all'); setSortOrder('desc'); }, []);
  const handleSearch = useCallback((text: string) => { setSearch(text); if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(text), 500); }, []);

  const activeFilterCount = useMemo(() => { let c = 0; if (sortOrder !== 'desc') c++; if (searchType !== 'all') c++; return c; }, [sortOrder, searchType]);
  const totalActiveFiltersCount = useMemo(() => activeFilterCount + (debouncedSearch.trim() !== '' ? 1 : 0), [activeFilterCount, debouncedSearch]);

  // ─ Data Fetching ──
  const unfilteredQuery = useQuery({
    queryKey: ['finish-lot-stocks-unfiltered-count'], enabled: isAuthenticated, staleTime: 30000,
    queryFn: async () => { const { data } = await api.get('/api/finish-lot-stocks', { params: { page: 1, limit: 1 } }); return data?.pagination?.totalCount || 0; },
  });

  const query = useInfiniteQuery({
    queryKey: ['finish-lot-stocks', debouncedSearch, sortOrder, searchType],
    enabled: isAuthenticated, initialPageParam: 1,
    staleTime: 30000,
    queryFn: async ({ pageParam = 1 }) => {
      const params: any = { page: pageParam, limit: PAGE_SIZE, sortBy: 'createdAt', sortOrder };
      if (debouncedSearch) { params.search = debouncedSearch; }
      if (searchType !== 'all') { params.status = searchType; }
      const { data } = await api.get('/api/finish-lot-stocks', { params });
      return { items: data?.data || [], hasNext: pageParam < (data?.pagination?.totalPages || 1), nextPage: pageParam + 1, totalCount: data?.pagination?.totalCount || 0 };
    },
    getNextPageParam: (lastPage) => lastPage.hasNext ? lastPage.nextPage : undefined,
  });

  const items = query.data?.pages.flatMap(p => p.items) || [];
  const totalMatchingCount = query.data?.pages[0]?.totalCount || 0;
  const grandTotal = unfilteredQuery.data ?? totalMatchingCount;
  const isFiltered = debouncedSearch.trim() !== '' || searchType !== 'all';

  // ─ Image Add (No Compression) ──
  const compressAndAdd = useCallback((uris: string[]) => {
    setFormImages(p => [...p, ...uris]);
  }, []);

  const pickImage = useCallback(async () => {
    if (!ImagePicker) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: true });
    if (!r.canceled && r.assets) await compressAndAdd(r.assets.map((a: any) => a.uri));
  }, [compressAndAdd]);

  const handleCameraCapture = useCallback(async (uris: string[]) => { await compressAndAdd(uris); }, [compressAndAdd]);

  const handleOpenPreview = useCallback((imgs: string[]) => { setPreviewImages(imgs); setPreviewVisible(true); }, []);

  // ─ Form ──
  const openCreateForm = useCallback(() => {
    setEditingItem(null); setFormData({ qualityName: '', piece: '', meter: '' }); setFormImages([]); setShowForm(true);
  }, []);

  const openEditForm = useCallback((item: FinishLotStock) => {
    setEditingItem(item); setFormData({ qualityName: item.qualityName || '', piece: item.piece?.toString() || '', meter: item.meter?.toString() || '' }); setFormImages(item.images || []); setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.qualityName.trim()) { addToast({ type: 'error', title: 'Validation', message: 'Quality name is required' }); return; }
    setSubmitting(true);
    try {
      const urls: string[] = [];
      for (const uri of formImages) {
        try {
          if (uri.startsWith('http://') || uri.startsWith('https://')) { urls.push(uri); continue; }
          urls.push(await uploadSingleImage(uri, 'finish-lot-stocks'));
        } catch (e) { console.error('Upload error:', e); }
      }
      const payload = { qualityName: formData.qualityName.trim(), piece: formData.piece ? Number(formData.piece) : 0, meter: formData.meter ? Number(formData.meter) : 0, images: urls };
      if (editingItem) {
        await api.put(`/api/finish-lot-stocks/${editingItem._id}`, payload);
        addToast({ type: 'success', title: 'Updated', message: 'Finish lot stock updated' });
      } else {
        await api.post('/api/finish-lot-stocks', payload);
        addToast({ type: 'success', title: 'Created', message: 'Finish lot stock created' });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['finish-lot-stocks'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to save' });
    } finally { setSubmitting(false); }
  }, [formData, formImages, editingItem, addToast, closeForm, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/finish-lot-stocks/${deleteTarget._id}`);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({ type: 'success', title: 'Deleted', message: 'Finish lot stock deleted' });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['finish-lot-stocks'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to delete' });
    } finally { setDeleting(false); }
  }, [deleteTarget, addToast, queryClient]);

  // ─ Reusable Form Input ──
  const renderInput = (label: string, value: string, onChange: (t: string) => void, placeholder: string, keyboard?: string) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.inputPlaceholder} keyboardType={(keyboard as any) || 'default'}
        style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text }} />
    </View>
  );

  // ═══════════════════════════ RENDER ═══════════════════════════════════════
  if (!isInTabs) {
    return <Redirect href="/(tabs)/finish-lot-stock" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {!isInTabs && <Header title="Finish Lot Stock" showBack />}
      {(query.isLoading || query.isFetchingNextPage) && <FinishProgressBar />}

      {/* Unified Search & Filters Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingHorizontal: 16 }}>
        {/* Custom Search Bar with Search Type Dropdown */}
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
          borderRadius: 12,
          paddingLeft: 12,
          paddingRight: 8,
          height: 44,
          marginRight: 8,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}>
          <Search size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              color: theme.text,
              paddingVertical: 8,
            }}
            placeholder="Search finish lots..."
            placeholderTextColor={theme.inputPlaceholder}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setDebouncedSearch(''); }} activeOpacity={0.6} style={{ padding: 4 }}>
              <X size={16} color={theme.textSecondary} />
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
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            borderWidth: 1,
            borderColor: activeFilterCount > 0
              ? (isDarkMode ? Colors.primary[500] : Colors.primary[600])
              : theme.borderLight,
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

      {/* ═══ CONTENT ═══ */}
      {query.isLoading ? <FinishLotSkeletonList count={5} /> : items.length === 0 ? (
        <EmptyState icon={<Package size={48} color={Colors.primary[500]} />} title="No Finish Lots" subtitle={debouncedSearch ? 'No items match your search.' : 'No finish lot stocks yet.'} />
      ) : (
        <FlatList
          data={items}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item, i) => item._id + '-' + i}
          ListHeaderComponent={() => {
            if (grandTotal === 0 && !isFiltered && !isOffline) return null;
            return (
              <View>
                {isOffline && (
                  <View style={{
                    marginHorizontal: 16,
                    marginTop: 10,
                    marginBottom: 4,
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
                {(grandTotal > 0 || isFiltered) && (
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.borderLight,
                    backgroundColor: theme.background
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>
                      {isFiltered ? (
                        <Text>
                          Showing <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{totalMatchingCount}</Text> of <Text style={{ fontWeight: '800', color: theme.text }}>{grandTotal}</Text>
                        </Text>
                      ) : (
                        <Text>
                          Total Lots: <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{grandTotal}</Text>
                        </Text>
                      )}
                    </Text>
                    {totalActiveFiltersCount > 0 && (
                      <TouchableOpacity onPress={clearAllFilters} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2' }}>
                        <RotateCcw size={12} color={Colors.error[500]} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.error[500] }}>Clear ({totalActiveFiltersCount})</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          renderItem={({ item, index }) => <FinishLotCard item={item} index={index} onEdit={openEditForm} onDelete={setDeleteTarget} isSuperAdmin={isSuperAdmin} isMaster={isMaster} onPreviewImages={handleOpenPreview} numColumns={numColumns} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 120, paddingHorizontal: numColumns > 1 ? 8 : 0 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          initialNumToRender={8}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color={Colors.primary[500]} />
                <Text style={{ fontSize: 12, color: theme.textTertiary, fontWeight: '500' }}>Loading more...</Text>
              </View>
            ) : (!query.hasNextPage && items.length > 0) ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
                  No more finished lots to load
                </Text>
              </View>
            ) : null
          }
          refreshControl={Platform.OS !== 'web' ? <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); query.refetch(); }} tintColor={Colors.primary[500]} colors={[Colors.primary[500]]} /> : undefined}
        />
      )}

      {/* ═══ DRAGGABLE FAB ═══ */}
      {isSuperAdmin && (
        <RNAnimated.View {...fabPanResponder.panHandlers} style={[{ position: 'absolute', zIndex: 100 }, { transform: pan.getTranslateTransform() }]}>
          <TouchableOpacity onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openCreateForm(); }} activeOpacity={0.85}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary[600], alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, zIndex: 9999 }}>
            <View style={{ position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Package size={24} color="#ffffff" />
              <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary[600], borderRadius: 7, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
                <Plus size={9} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

      {/* ═══ FILTER BOTTOM SHEET ═══ */}
      <Modal visible={showFilterModal} animationType="none" transparent statusBarTranslucent onRequestClose={closeFilterModal}>

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
              backgroundColor: isDarkMode ? '#1e293b' : '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: isLargeScreen ? 24 : 0,
              borderBottomRightRadius: isLargeScreen ? 24 : 0,
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: isLargeScreen ? 24 : (insets.bottom > 0 ? insets.bottom + 16 : 32),
              width: '100%',
              maxWidth: isLargeScreen ? modalMaxWidth : '100%',
              transform: [{ translateY: filterPanY }],
            }}
          >
            {/* Swipe Drag Handle Bar */}
            <View style={{ width: '100%', alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#d1d5db' }} />
            </View>

            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>Filters</Text>
              <TouchableOpacity
                onPress={closeFilterModal}
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

            {/* Sort Order */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort Order</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(['desc', 'asc'] as const).map(o => (
                <TouchableOpacity key={o} onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSortOrder(o); }}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: sortOrder === o ? Colors.primary[600] : isDarkMode ? Colors.neutral[800] : Colors.neutral[100], borderWidth: 1, borderColor: sortOrder === o ? Colors.primary[600] : isDarkMode ? Colors.neutral[700] : Colors.neutral[200] }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: sortOrder === o ? '#fff' : theme.text }}>{o === 'desc' ? '↓ Newest' : '↑ Oldest'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Status Filter */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {Object.keys(searchTypeFullLabels).map((key) => (
                <TouchableOpacity 
                  key={key} 
                  onPress={() => {
                    setSearchType(key);
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }} 
                  style={{ 
                    paddingHorizontal: 16, 
                    paddingVertical: 10, 
                    borderRadius: 10, 
                    backgroundColor: searchType === key ? Colors.primary[600] : isDarkMode ? Colors.neutral[800] : Colors.neutral[100], 
                    borderWidth: 1, 
                    borderColor: searchType === key ? Colors.primary[600] : isDarkMode ? Colors.neutral[700] : Colors.neutral[200] 
                  }}
                >
                  <Text style={{ color: searchType === key ? '#fff' : theme.textSecondary, fontWeight: '700', fontSize: 13 }}>{searchTypeFullLabels[key]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </RNAnimated.View>
        </View>
      </Modal>



      {/* ═══ CREATE/EDIT FORM MODAL ═══ */}
      <Modal visible={showForm} animationType="none" transparent statusBarTranslucent onRequestClose={closeForm}>

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
            <Pressable onPress={closeForm} style={{ flex: 1 }} />
          </RNAnimated.View>

          <RNAnimated.View
            onLayout={(e) => {
              formSheetY.current = e.nativeEvent.layout.y;
            }}
            {...formPanResponder.panHandlers}
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: isLargeScreen ? 24 : 0,
              borderBottomRightRadius: isLargeScreen ? 24 : 0,
              paddingTop: 12,
              paddingHorizontal: 24,
              paddingBottom: isLargeScreen ? 24 : 0,
              maxHeight: '85%',
              width: '100%',
              maxWidth: isLargeScreen ? modalMaxWidth : '100%',
              transform: [{ translateY: formPanY }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} style={{ flex: 1 }}>
              {/* Drag Handle */}
              <View style={{ width: '100%', alignItems: 'center', paddingVertical: 12, marginBottom: 4, backgroundColor: 'transparent' }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#d1d5db' }} />
              </View>

              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Package size={20} color={isDarkMode ? '#4ade80' : '#16a34a'} />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>{editingItem ? 'Edit Finish Lot' : 'Add Finish Lot'}</Text>
                </View>
                <TouchableOpacity onPress={closeForm} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100], justifyContent: 'center', alignItems: 'center' }}>
                  <X size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScroll={(e) => { formScrollOffset.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                {renderInput('Quality Name *', formData.qualityName, t => setFormData(p => ({ ...p, qualityName: t })), 'Enter quality name')}

                {/* Piece + Meter in row */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>{renderInput('Piece', formData.piece, t => setFormData(p => ({ ...p, piece: t })), '0', 'numeric')}</View>
                  <View style={{ flex: 1 }}>{renderInput('Meter', formData.meter, t => setFormData(p => ({ ...p, meter: t })), '0', 'numeric')}</View>
                </View>

                {/* Images */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 }}>Images</Text>
                  
                  {/* Upload buttons row — same as fabrics/orders/sampling pages */}
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
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                      {formImages.map((img, i) => (
                        <View key={i} style={{ position: 'relative' }}>
                          <TouchableOpacity activeOpacity={0.9} onPress={() => handleOpenPreview([img])}>
                            <Image 
                              source={{ uri: resolveImageUrl(img) }} 
                              style={{ width: 80, height: 80, borderRadius: 10 }} 
                              resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                              fadeDuration={100}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormImages(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: -4, right: -4, backgroundColor: Colors.error[500], width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            <X size={12} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* Actions */}
                <View style={{ marginTop: 8 }}>
                  <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={{ width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: submitting ? Colors.primary[400] : Colors.primary[600] }}>
                    {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{editingItem ? 'Update' : 'Create'}</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* ═══ DELETE CONFIRMATION ═══ */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 24 }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#fef2f2', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Trash2 size={28} color={Colors.error[500]} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, textAlign: 'center', marginBottom: 8 }}>Delete Finish Lot</Text>
            <Text style={{ fontSize: 15, color: theme.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
              Are you sure you want to delete "{deleteTarget?.qualityName}"? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setDeleteTarget(null)} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#e2e8f0' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} disabled={deleting} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.error[600], flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : null}
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{deleting ? 'Deleting...' : 'Delete'}</Text>
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
