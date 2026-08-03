import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, RefreshControl, Platform, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Alert, PanResponder, Animated as RNAnimated, Dimensions, Pressable, Keyboard, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TestTubes, Search, X, Plus, Image as ImageIcon, Edit, Trash2, Camera, SlidersHorizontal, RotateCcw, WifiOff, MapPin, Tag } from 'lucide-react-native';
import { useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import PdfViewerModal from '../../../components/shared/PdfViewerModal';
import { generateStickerPdf } from '../../../utils/stickerPdf';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker failed to load:', e);
}

import api from '../../../services/api';
import Header from '../../../components/shared/Header';
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
  item, index, onEdit, onDelete, isSuperAdmin, isMaster, onPreviewImages, onOpenSticker, numColumns
}: { item: SamplingItem; index: number; onEdit: (s: SamplingItem) => void; onDelete: (s: SamplingItem) => void; isSuperAdmin: boolean; isMaster: boolean; onPreviewImages: (imgs: string[]) => void; onOpenSticker: (s: SamplingItem) => void; numColumns?: number; }) {
  const { theme, isDarkMode } = useTheme();
  const hasPiece = item.piece != null && item.piece > 0;
  const hasMeter = item.meter != null && item.meter > 0;

  return (
    <Animated.View style={{ flex: 1 }}>
      <View style={{
        marginHorizontal: numColumns && numColumns > 1 ? 8 : 16,
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
        {/* Clickable Image Preview styled like fabrics page */}
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
              contentFit="contain"
              transition={100}
            />
            {item.images.length > 1 && (
              <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}>
                <ImageIcon size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 5 }}>{item.images.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Title */}
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

          {/* Location row */}
          {item.whereToPut ? (
            <View style={{ borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0', paddingTop: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Location</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={13} color={isDarkMode ? '#a78bfa' : '#7c3aed'} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                  {item.whereToPut}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Weaver & Mill info */}
          {(item.weaverName || item.weaverQuality || item.millName) ? (
            <View style={{ borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0', paddingTop: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {item.weaverName ? <View style={{ backgroundColor: isDarkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}><Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#6ee7b7' : '#059669' }}>W: {item.weaverName}</Text></View> : null}
                {item.weaverQuality ? <View style={{ backgroundColor: isDarkMode ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}><Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#fcd34d' : '#d97706' }}>WQ: {item.weaverQuality}</Text></View> : null}
                {item.millName ? <View style={{ backgroundColor: isDarkMode ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}><Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#c4b5fd' : '#7c3aed' }}>Mill: {item.millName}</Text></View> : null}
              </View>
            </View>
          ) : null}

          {/* Process in Mill */}
          {item.processInMill ? (
            <View style={{ borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0', paddingTop: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Process in Mill</Text>
              <Text style={{ fontSize: 12.5, color: isDarkMode ? '#67e8f9' : '#0891b2', lineHeight: 18, fontStyle: 'italic' }} numberOfLines={3}>
                {item.processInMill}
              </Text>
            </View>
          ) : null}

          {/* Notes row */}
          {item.notes ? (
            <View style={{ borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0', paddingTop: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Notes</Text>
              <Text style={{ fontSize: 12.5, color: theme.textSecondary, lineHeight: 18 }} numberOfLines={3}>
                {item.notes}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Footer — date + actions */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
        }}>
          <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '500' }}>{formatDate(item.createdAt)}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {/* Sticker — icon only */}
            <TouchableOpacity
              onPress={() => onOpenSticker(item)}
              activeOpacity={0.75}
              style={{
                width: 34, height: 34, borderRadius: 10,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDarkMode ? 'rgba(167,139,250,0.12)' : '#f5f3ff',
                borderWidth: 1, borderColor: isDarkMode ? 'rgba(167,139,250,0.3)' : '#ddd6fe',
              }}
            >
                <Tag size={15} color={isDarkMode ? '#a78bfa' : '#7c3aed'} />
              </TouchableOpacity>
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

export default function SamplingScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { theme, isDarkMode } = useTheme();
  const { isSuperAdmin, isMaster } = useAuth();
  const segments = useSegments();
  const isInTabs = (segments as string[]).includes('(tabs)');
  const queryClient = useQueryClient();
  const { isLargeScreen, modalMaxWidth, numColumns, containerMaxWidth } = useResponsiveLayout();
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
  const [debouncedMinMeter, setDebouncedMinMeter] = useState('');
  const [debouncedMaxMeter, setDebouncedMaxMeter] = useState('');
  const [debouncedMinPiece, setDebouncedMinPiece] = useState('');
  const [debouncedMaxPiece, setDebouncedMaxPiece] = useState('');

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMinMeter(minMeter);
      setDebouncedMaxMeter(maxMeter);
      setDebouncedMinPiece(minPiece);
      setDebouncedMaxPiece(maxPiece);
    }, 600);
    return () => clearTimeout(handler);
  }, [minMeter, maxMeter, minPiece, maxPiece]);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Modals visibility
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<SamplingItem | null>(null);
  const [formData, setFormData] = useState({ qualityName: '', whereToPut: '', weaverName: '', weaverQuality: '', millName: '', processInMill: '', notes: '', piece: '', meter: '' });
  const [formImages, setFormImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [cameraVisible, setCameraVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  // PDF Sticker Viewer states
  const [pdfViewerVisible, setPdfViewerVisible] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState('');
  const [pdfViewerTitle, setPdfViewerTitle] = useState('');
  const [pdfViewerFilename, setPdfViewerFilename] = useState('');
  const [pdfViewerLocalUri, setPdfViewerLocalUri] = useState<string | undefined>();
  const [pdfViewerLocalBase64, setPdfViewerLocalBase64] = useState<string | undefined>();

  const openStickerPreview = useCallback(async (item: SamplingItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const sanitizedQuality = (item.qualityName || 'Sticker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Sample_Sticker_${sanitizedQuality}.pdf`;

    try {
      const { uri, base64 } = await generateStickerPdf({
        type: 'sample',
        qualityName: item.qualityName || '',
        weaverName: '',
        remarks: item.notes || '',
        piece: item.piece != null ? Number(item.piece) : undefined,
        meter: item.meter != null ? Number(item.meter) : undefined,
      }, filename);

      setPdfViewerLocalUri(uri);
      setPdfViewerLocalBase64(base64);
      setPdfViewerUrl('');
      setPdfViewerTitle(`Sample Sticker — ${item.qualityName || 'Sticker'}`);
      setPdfViewerFilename(filename);
      setPdfViewerVisible(true);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to generate sticker', message: String(err) });
    }
  }, []);

  const [deleteTarget, setDeleteTarget] = useState<SamplingItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Animated values for sheet transitions
  const filterPanY = useRef(new RNAnimated.Value(600)).current;
  const formPanY = useRef(new RNAnimated.Value(0)).current;
  const filterScrollOffset = useRef(0);
  const formScrollOffset = useRef(0);
  const formSheetY = useRef(0);
  const filterSheetY = useRef(0);

  const FAB_BOTTOM_OFFSET = Platform.OS === 'ios' ? 220 : 170;
  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 68, y: screenHeight - FAB_BOTTOM_OFFSET })).current;
  const fabX = useRef(screenWidth - 68);
  const fabY = useRef(screenHeight - FAB_BOTTOM_OFFSET);

  const dimensionsRef = useRef({ screenWidth, screenHeight });
  dimensionsRef.current = { screenWidth, screenHeight };

  React.useEffect(() => {
    const isSnappedLeft = fabX.current < screenWidth / 2;
    const targetX = isSnappedLeft ? 16 : screenWidth - 68;
    const targetY = Math.min(Math.max(fabY.current, 120), screenHeight - FAB_BOTTOM_OFFSET);
    
    fabX.current = targetX;
    fabY.current = targetY;
    
    RNAnimated.spring(pan, {
      toValue: { x: targetX, y: targetY },
      useNativeDriver: false,
      friction: 6,
    }).start();
  }, [screenWidth, screenHeight]);

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
      const snapY = Math.min(Math.max(currentY, 120), currentScreenHeight - FAB_BOTTOM_OFFSET);
      fabX.current = snapX;
      fabY.current = snapY;
      RNAnimated.spring(pan, { toValue: { x: snapX, y: snapY }, useNativeDriver: false, friction: 6 }).start();
    },
  })).current;

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

  React.useEffect(() => {
    if (showFilterModal) {
      filterPanY.setValue(600);
      RNAnimated.spring(filterPanY, {
        toValue: 0,
        useNativeDriver: false,
        damping: 15,
        stiffness: 120,
      }).start();
    }
  }, [showFilterModal]);

  // Form modal handlers
  const closeFormModal = useCallback(() => {
    setShowForm(false);
  }, []);

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
          closeFormModal();
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

  React.useEffect(() => {
    if (showForm) {
      formPanY.setValue(0);
    } else {
      const timer = setTimeout(() => {
        formPanY.setValue(0);
      }, 300);
      return () => clearTimeout(timer);
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
    queryKey: ['sampling', debouncedSearch, sortOrder, sortBy, debouncedMinMeter, debouncedMaxMeter, debouncedMinPiece, debouncedMaxPiece],
    enabled: isAuthenticated,
    initialPageParam: 1,
    staleTime: 30000,
    queryFn: async ({ pageParam = 1 }) => {
      const params: any = { page: pageParam, limit: PAGE_SIZE, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (debouncedMinMeter) params.minMeter = debouncedMinMeter;
      if (debouncedMaxMeter) params.maxMeter = debouncedMaxMeter;
      if (debouncedMinPiece) params.minPiece = debouncedMinPiece;
      if (debouncedMaxPiece) params.maxPiece = debouncedMaxPiece;
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
    setFormData({ qualityName: '', whereToPut: '', weaverName: '', weaverQuality: '', millName: '', processInMill: '', notes: '', piece: '', meter: '' });
    setFormImages([]);
    setShowForm(true);
  };

  const openEditForm = (item: SamplingItem) => {
    setEditingItem(item);
    setFormData({ qualityName: item.qualityName || '', whereToPut: item.whereToPut || '', weaverName: item.weaverName || '', weaverQuality: item.weaverQuality || '', millName: item.millName || '', processInMill: item.processInMill || '', notes: item.notes || '', piece: item.piece?.toString() || '', meter: item.meter?.toString() || '' });
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
        weaverName: formData.weaverName.trim(), weaverQuality: formData.weaverQuality.trim(),
        millName: formData.millName.trim(), processInMill: formData.processInMill.trim(),
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, width: '100%', maxWidth: containerMaxWidth, alignSelf: 'center' }}>
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

      {/* Content */}
      {query.isLoading ? <SamplingSkeletonList count={3} /> : samples.length === 0 ? (
        <EmptyState icon={<TestTubes size={48} color={Colors.primary[500]} />} title="No Sampling" subtitle={debouncedSearch ? 'No samples match your search.' : 'No sampling items added yet.'} />
      ) : (
        <FlashList
          data={samples}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item, i) => item._id + '-' + i}
          drawDistance={800}
          ListHeaderComponent={() => {
            if (totalMatchingCount === 0 && totalActiveFiltersCount === 0 && !isOffline) return null;
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
                {(totalMatchingCount > 0 || totalActiveFiltersCount > 0) && (
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
                )}
              </View>
            );
          }}
          renderItem={({ item, index }) => (
            <SamplingCard 
              item={item} 
              index={index} 
              onEdit={openEditForm} 
              onDelete={setDeleteTarget} 
              isSuperAdmin={isSuperAdmin} 
              isMaster={isMaster} 
              onPreviewImages={handleOpenPreview} 
              onOpenSticker={openStickerPreview}
              numColumns={numColumns}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 120, paddingHorizontal: numColumns > 1 ? 8 : 0 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          removeClippedSubviews={false}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={Colors.primary[500]} />
                <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 6 }}>Loading more...</Text>
              </View>
            ) : (!query.hasNextPage && samples.length > 0) ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
                  No more sampling records to load
                </Text>
              </View>
            ) : null
          }
          refreshControl={Platform.OS !== 'web' ? <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); query.refetch(); }} tintColor={Colors.primary[500]} colors={[Colors.primary[500]]} /> : undefined}
        />
      )}

      {/* FAB */}
      {isSuperAdmin && (
        <RNAnimated.View
          {...fabPanResponder.panHandlers}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: pan.getTranslateTransform(),
            zIndex: 9999,
          }}
        >
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
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="none"
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
              maxHeight: '80%',
              width: '100%',
              maxWidth: isLargeScreen ? modalMaxWidth : '100%',
              transform: [{ translateY: filterPanY }],
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 120}
              style={{ flex: 1 }}
            >
              {/* Header Drag Zone */}
            <View style={{ width: '100%' }}>
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

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              style={{ paddingHorizontal: 24 }}
              contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 220 : 220 }}
              onScroll={(e) => { filterScrollOffset.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {/* Sort Direction */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Sort Direction</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                {([['desc', 'Newest First'], ['asc', 'Oldest First']] as const).map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSortOrder(val); }}
                    style={{
                      flex: 1,
                      paddingVertical: 11,
                      borderRadius: 12,
                      alignItems: 'center',
                      backgroundColor: sortOrder === val
                        ? (isDarkMode ? '#4f46e5' : Colors.primary[600])
                        : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                      borderWidth: 1,
                      borderColor: sortOrder === val
                        ? (isDarkMode ? '#6366f1' : Colors.primary[600])
                        : (isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: sortOrder === val ? '#fff' : theme.textSecondary }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sort By */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Sort By</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                {([['createdAt', 'Date'], ['piece', 'Pieces'], ['meter', 'Meters']] as [string, string][]).map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSortBy(val); }}
                    style={{
                      flex: 1,
                      paddingVertical: 11,
                      borderRadius: 12,
                      alignItems: 'center',
                      backgroundColor: sortBy === val
                        ? (isDarkMode ? '#4f46e5' : Colors.primary[600])
                        : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                      borderWidth: 1,
                      borderColor: sortBy === val
                        ? (isDarkMode ? '#6366f1' : Colors.primary[600])
                        : (isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: sortBy === val ? '#fff' : theme.textSecondary }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Min/Max Meter */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Meter Range</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={minMeter}
                    onChangeText={setMinMeter}
                    placeholder="Min"
                    placeholderTextColor={theme.inputPlaceholder}
                    keyboardType="numeric"
                    style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: theme.text }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={maxMeter}
                    onChangeText={setMaxMeter}
                    placeholder="Max"
                    placeholderTextColor={theme.inputPlaceholder}
                    keyboardType="numeric"
                    style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: theme.text }}
                  />
                </View>
              </View>

              {/* Min/Max Piece */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Piece Range</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={minPiece}
                    onChangeText={setMinPiece}
                    placeholder="Min"
                    placeholderTextColor={theme.inputPlaceholder}
                    keyboardType="numeric"
                    style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: theme.text }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={maxPiece}
                    onChangeText={setMaxPiece}
                    placeholder="Max"
                    placeholderTextColor={theme.inputPlaceholder}
                    keyboardType="numeric"
                    style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: theme.text }}
                  />
                </View>
              </View>
            </ScrollView>
            </KeyboardAvoidingView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal visible={showForm} animationType={isLargeScreen ? 'fade' : 'slide'} transparent statusBarTranslucent navigationBarTranslucent onRequestClose={closeFormModal}>

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
              height: isLargeScreen ? '92%' : '92%',
              width: '100%',
              maxWidth: isLargeScreen ? 850 : '100%',
              transform: isLargeScreen ? undefined : [{ translateY: formPanY }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
              style={{ flex: 1 }}
            >
              {/* Swipe Drag Handle Bar */}
              <View 
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
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 80 : 100 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                onScroll={(e) => { formScrollOffset.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Quality Name *</Text>
                <TextInput value={formData.qualityName} onChangeText={t => setFormData(p => ({ ...p, qualityName: t }))} placeholder="Enter quality name..." placeholderTextColor={theme.inputPlaceholder} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14 }} />

                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Where To Put</Text>
                <TextInput value={formData.whereToPut} onChangeText={t => setFormData(p => ({ ...p, whereToPut: t }))} placeholder="Location" placeholderTextColor={theme.inputPlaceholder} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14 }} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Weaver Name</Text>
                    <TextInput value={formData.weaverName} onChangeText={t => setFormData(p => ({ ...p, weaverName: t }))} placeholder="Weaver name" placeholderTextColor={theme.inputPlaceholder} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Weaver Quality</Text>
                    <TextInput value={formData.weaverQuality} onChangeText={t => setFormData(p => ({ ...p, weaverQuality: t }))} placeholder="Weaver quality" placeholderTextColor={theme.inputPlaceholder} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14 }} />
                  </View>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Mill Name</Text>
                <TextInput value={formData.millName} onChangeText={t => setFormData(p => ({ ...p, millName: t }))} placeholder="Mill name" placeholderTextColor={theme.inputPlaceholder} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14 }} />

                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Process in Mill</Text>
                <TextInput value={formData.processInMill} onChangeText={t => setFormData(p => ({ ...p, processInMill: t }))} placeholder="Enter process details..." placeholderTextColor={theme.inputPlaceholder} multiline numberOfLines={3} style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 14, minHeight: 70, textAlignVertical: 'top' }} />

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
                              contentFit="cover"
                              transition={100}
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 24 }}>
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

      {/* PDF Sticker Viewer Modal */}
      <PdfViewerModal
        visible={pdfViewerVisible}
        onClose={() => {
          setPdfViewerVisible(false);
          setPdfViewerLocalUri(undefined);
          setPdfViewerLocalBase64(undefined);
        }}
        title={pdfViewerTitle}
        pdfUrl={pdfViewerUrl}
        filename={pdfViewerFilename}
        localUri={pdfViewerLocalUri}
        localBase64={pdfViewerLocalBase64}
        addToast={addToast}
      />
    </SafeAreaView>
  );
}
