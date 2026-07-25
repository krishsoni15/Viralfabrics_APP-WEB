import React, { useState, useCallback } from 'react';
import { View, Text, RefreshControl, Platform, TouchableOpacity, ActivityIndicator, Image, TextInput, Modal, KeyboardAvoidingView, ScrollView, Alert, PanResponder, Animated as RNAnimated, Pressable, Dimensions, useWindowDimensions, Keyboard } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { Phone, MapPin, TestTubes, Image as ImageIcon, Search, X, ArrowUpDown, Plus, Pencil, Trash2, Camera, Tag, ChevronDown, SlidersHorizontal, RotateCcw, Box, Eye, Layers, Scale, MoveHorizontal, FileText, Hash, Grid, Inbox } from 'lucide-react-native';
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
import { SampleSkeletonList } from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import ImagePreviewModal from '../../../components/shared/ImagePreviewModal';
import CustomCameraModal from '../../../components/shared/CustomCameraModal';
import PdfViewerModal from '../../../components/shared/PdfViewerModal';
import { generateStickerPdf } from '../../../utils/stickerPdf';
import { useTheme } from '../../../hooks/useTheme';
import { useAuth } from '../../../hooks/useAuth';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { Colors } from '../../../constants/colors';
import { Sample, Weaver } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { formatDate, resolveImageUrl, uploadSingleImage } from '../../../utils/helpers';
import { storage } from '../../../utils/storage';
import { CONFIG } from '../../../constants/config';

const DetailCell = React.memo(function DetailCell({
  label, value, icon: Icon
}: { label: string; value: string | number | undefined | null; icon: any }) {
  const { theme, isDarkMode } = useTheme();
  const displayValue = value != null && String(value).trim() !== '' ? String(value) : '—';
  const hasValue = displayValue !== '—';
  
  return (
    <View style={{
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0',
      borderRadius: 14,
      padding: 10,
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    }}>
      <View style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: isDarkMode 
          ? (hasValue ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.04)')
          : (hasValue ? '#e0e7ff' : '#f1f5f9'),
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={12} color={hasValue ? (isDarkMode ? '#818cf8' : '#4f46e5') : theme.textTertiary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: hasValue ? theme.text : theme.textTertiary }} numberOfLines={1}>
          {displayValue}
        </Text>
      </View>
    </View>
  );
});

const SampleCard = React.memo(function SampleCard({
  item, index, onEdit, onDelete, isSuperAdmin, isMaster, onPreviewImages, onOpenSticker
}: { item: Sample; index: number; onEdit: (s: Sample) => void; onDelete: (s: Sample) => void; isSuperAdmin: boolean; isMaster: boolean; onPreviewImages: (imgs: string[]) => void; onOpenSticker: (s: Sample) => void }) {
  const { theme, isDarkMode } = useTheme();

  const countDanierVal = item.count && item.danier 
    ? `${item.count}/${item.danier}` 
    : item.count || item.danier || '-';
  const hasReed = item.reed !== undefined && item.reed !== null && item.reed !== '' && String(item.reed) !== '0';
  const hasPick = item.pick !== undefined && item.pick !== null && item.pick !== '' && String(item.pick) !== '0';
  const reedPickVal = hasReed || hasPick
    ? `${item.reed ?? '-'}/${item.pick ?? '-'}`
    : '-';

  const hasWeight = item.weight !== undefined && item.weight !== null && Number(item.weight) > 0;
  const hasGreighWidth = item.greighWidth !== undefined && item.greighWidth !== null && Number(item.greighWidth) > 0;
  const hasFinishWidth = item.finishWidth !== undefined && item.finishWidth !== null && Number(item.finishWidth) > 0;
  const hasGsm = item.gsm !== undefined && item.gsm !== null && Number(item.gsm) > 0;

  const gridCell = (label: string, value: string, color: string, hasDivider?: boolean) => (
    <View style={{ 
      flex: 1, 
      paddingVertical: 8, 
      paddingHorizontal: 8,
      borderRightWidth: hasDivider ? 1 : 0,
      borderRightColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    }}>
      <Text style={{ fontSize: 9.5, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '800', color: color }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={{
      marginHorizontal: 16,
      marginBottom: 14,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.borderLight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.12 : 0.04,
      shadowRadius: 12,
      elevation: 4,
      overflow: 'hidden',
    }}>
      <View style={{ padding: 14 }}>
        {/* Header Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, flex: 1 }} numberOfLines={1}>
            {item.qualityName}
          </Text>
          {!!item.type && (
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 6,
              backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.12)' : '#eef2ff',
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#818cf8' : '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.3 }}>{item.type}</Text>
            </View>
          )}
        </View>

        {/* Image Strip */}
        {item.images && item.images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {item.images.map((img, imgIdx) => (
              <TouchableOpacity 
                key={imgIdx} 
                onPress={() => onPreviewImages(item.images || [])} 
                activeOpacity={0.8}
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
                }}
              >
                <Image 
                  source={{ uri: resolveImageUrl(img) }} 
                  style={{ width: 72, height: 72 }} 
                  resizeMode="cover" 
                  resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                  fadeDuration={100}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Spec Grid */}
        <View style={{
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.15)' : '#f8fafc',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
          overflow: 'hidden',
        }}>
          {/* Row 1 */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
            {gridCell("GSM", hasGsm ? String(item.gsm) : '-', '#db2777', true)}
            {gridCell("Greigh W.", hasGreighWidth ? `${item.greighWidth}"` : '-', isDarkMode ? '#34d399' : '#059669', true)}
            {gridCell("Finish W.", hasFinishWidth ? `${item.finishWidth}"` : '-', isDarkMode ? '#2dd4bf' : '#0d9488')}
          </View>
          {/* Row 2 */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
            {gridCell("Weight", hasWeight ? `${item.weight} KG` : '-', isDarkMode ? '#fbbf24' : '#d97706', true)}
            {gridCell("Count/Dan", String(countDanierVal), isDarkMode ? '#facc15' : '#ca8a04', true)}
            {gridCell("Reed/Pick", String(reedPickVal), isDarkMode ? '#38bdf8' : '#0284c7')}
          </View>
          {/* Row 3 */}
          <View style={{ flexDirection: 'row' }}>
            {gridCell("Rate", item.greighRate != null && Number(item.greighRate) > 0 ? `₹${item.greighRate}` : '-', isDarkMode ? '#34d399' : '#059669', true)}
            {gridCell("Rack", item.rack || '-', isDarkMode ? '#22d3ee' : '#0891b2', true)}
            {gridCell("Content", item.content || '-', isDarkMode ? '#818cf8' : '#4f46e5')}
          </View>
        </View>

        {/* Print Tag — minimal inline */}
        {!!item.label && (
          <View style={{ 
            marginTop: 12, 
            paddingHorizontal: 12,
            paddingVertical: 10, 
            backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.05)' : '#f5f3ff', 
            borderRadius: 10, 
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: isDarkMode ? 'rgba(139, 92, 246, 0.3)' : '#ddd6fe',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <View style={{
              backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.2)' : '#e0e7ff',
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: isDarkMode ? '#a78bfa' : '#6d28d9', textTransform: 'uppercase', letterSpacing: 0.5 }}>PRINT TAG</Text>
            </View>
            <Text style={{ 
              fontSize: 12, 
              color: isDarkMode ? '#d8b4fe' : '#5b21b6', 
              fontWeight: '700',
              flex: 1,
            }}>
              {item.label}
            </Text>
          </View>
        )}

        {/* Note */}
        {!!item.note && (
          <View style={{ marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fffbeb', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: Colors.warning?.[500] || '#f59e0b' }}>
            <Text style={{ fontSize: 11.5, color: theme.textTertiary, fontStyle: 'italic' }}>{item.note}</Text>
          </View>
        )}

        {/* Footer: date left, actions right */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
          <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '500' }}>
            {formatDate(item.createdAt)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity 
              onPress={() => onOpenSticker(item)} 
              activeOpacity={0.7} 
              style={{ 
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, 
                backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.1)' : '#f5f3ff', 
              }}
            >
              <Tag size={12} color={isDarkMode ? '#a78bfa' : '#7c3aed'} />
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDarkMode ? '#a78bfa' : '#7c3aed' }}>Sticker</Text>
            </TouchableOpacity>

            {isSuperAdmin && (
              <TouchableOpacity 
                onPress={() => onEdit(item)} 
                activeOpacity={0.7} 
                style={{ 
                  width: 28, height: 28, borderRadius: 8, 
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', 
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe',
                }}
              >
                <Pencil size={12} color={isDarkMode ? '#60a5fa' : '#2563eb'} />
              </TouchableOpacity>
            )}

            {isMaster && (
              <TouchableOpacity 
                onPress={() => onDelete(item)} 
                activeOpacity={0.7} 
                style={{ 
                  width: 28, height: 28, borderRadius: 8, 
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', 
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
                }}
              >
                <Trash2 size={12} color={isDarkMode ? '#f87171' : '#dc2626'} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
});

const TYPE_OPTIONS = ['Polyester', 'Blend', 'Viscose', 'Cotton', 'Rayon', 'Other'];

export default function WeaverDetailScreen() {
  const { id, addSample } = useLocalSearchParams<{ id: string; addSample?: string }>();
  const insets = useSafeAreaInsets();
  const { isLargeScreen, modalMaxWidth } = useResponsiveLayout();
  const { theme, isDarkMode } = useTheme();
  const { isSuperAdmin, isMaster } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useAppStore(s => s.addToast);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [visibleCount, setVisibleCount] = useState(5);
  const [loadingMore, setLoadingMore] = useState(false);

  // Advanced Filter Modal States
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [reopenFormOnStickerClose, setReopenFormOnStickerClose] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [formData, setFormData] = useState({
    qualityName: '', type: '', rack: '', greighWidth: '', finishWidth: '',
    weight: '', gsm: '', content: '', danier: '', count: '',
    reed: '', pick: '', greighRate: '', note: ''
  });
  const [formImages, setFormImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Modals visibility
  const [cameraVisible, setCameraVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Sample | null>(null);
  const [deleting, setDeleting] = useState(false);

  // PDF Viewer Modal state
  const [pdfViewerVisible, setPdfViewerVisible] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState('');
  const [pdfViewerLocalUri, setPdfViewerLocalUri] = useState<string | undefined>();
  const [pdfViewerLocalBase64, setPdfViewerLocalBase64] = useState<string | undefined>();
  const [pdfViewerTitle, setPdfViewerTitle] = useState('');
  const [pdfViewerFilename, setPdfViewerFilename] = useState('');

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const modalTranslateY = React.useRef(new RNAnimated.Value(800)).current;
  const formScrollOffset = React.useRef(0);
  const formTouchStartPageY = React.useRef(0);
  const formSheetY = React.useRef(0);

  const filterScrollOffset = React.useRef(0);
  const filterTouchStartPageY = React.useRef(0);
  const filterSheetY = React.useRef(0);

  const FAB_BOTTOM_OFFSET = Platform.OS === 'ios' ? 220 : 170;
  const pan = React.useRef(new RNAnimated.ValueXY({ x: screenWidth - 68, y: screenHeight - FAB_BOTTOM_OFFSET })).current;
  const fabX = React.useRef(screenWidth - 68);
  const fabY = React.useRef(screenHeight - FAB_BOTTOM_OFFSET);

  const dimensionsRef = React.useRef({ screenWidth, screenHeight });
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
      tension: 40,
      friction: 12,
    }).start();
  }, [screenWidth, screenHeight]);

  const fabPanResponder = React.useRef(PanResponder.create({
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
      RNAnimated.spring(pan, { toValue: { x: snapX, y: snapY }, useNativeDriver: false, tension: 40, friction: 12 }).start();
    },
  })).current;

  const hasUnsavedChanges = useCallback(() => {
    if (editingSample) {
      const fields = [
        'qualityName', 'type', 'rack', 'greighWidth', 'finishWidth',
        'weight', 'gsm', 'content', 'danier', 'count', 'reed', 'pick',
        'greighRate', 'note'
      ];
      for (const field of fields) {
        const initial = (editingSample as any)[field]?.toString() || '';
        const current = (formData as any)[field] || '';
        if (initial.trim() !== current.trim()) return true;
      }
      const initialImages = editingSample.images || [];
      if (initialImages.length !== formImages.length) return true;
      for (let i = 0; i < initialImages.length; i++) {
        if (initialImages[i] !== formImages[i]) return true;
      }
      return false;
    } else {
      const values = Object.values(formData);
      const hasText = values.some(v => v && v.trim() !== '');
      return hasText || formImages.length > 0;
    }
  }, [formData, formImages, editingSample]);

  const closeFormModalRef = React.useRef<() => void>(() => {});

  const modalPanResponder = React.useRef(
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

  const forceCloseForm = useCallback(() => {
    setShowForm(false);
  }, []);

  const closeFormModal = useCallback(() => {
    setShowForm(false);
  }, []);

  closeFormModalRef.current = closeFormModal;

  const filterModalTranslateY = React.useRef(new RNAnimated.Value(0)).current;

  const filterPanResponder = React.useRef(
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
          filterModalTranslateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.5) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeFilterModal();
        } else {
          RNAnimated.spring(filterModalTranslateY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  const closeFilterModal = useCallback(() => {
    setShowFilterModal(false);
  }, []);

  React.useEffect(() => {
    if (addSample === 'true') {
      openCreateForm();
      router.setParams({ addSample: undefined } as any);
    }
  }, [addSample]);

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

  React.useEffect(() => {
    if (showFilterModal) {
      filterModalTranslateY.setValue(0);
    } else {
      const timer = setTimeout(() => {
        filterModalTranslateY.setValue(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showFilterModal]);



  const compressAndAdd = (uris: string[]) => {
    setFormImages(prev => [...prev, ...uris]);
  };

  // Fetch weaver details
  const weaverQuery = useQuery({
    queryKey: ['weaver-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/weaver/weavers`, { params: { search: '', page: 1, limit: 100 } });
      const weavers = data?.data || [];
      return weavers.find((w: Weaver) => w._id === id) || { _id: id, name: 'Weaver' };
    },
  });

  // Fetch samples
  const samplesQuery = useQuery({
    queryKey: ['weaver-samples', id],
    queryFn: async () => {
      const { data } = await api.get('/api/weaver/samples', { params: { weaverId: id } });
      return data?.data || [];
    },
  });

  const weaver = weaverQuery.data;
  const samples = samplesQuery.data || [];

  // Local Search and Sort
  const filteredSamples = React.useMemo(() => {
    let result = [...samples];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(item => 
        (item.qualityName || '').toLowerCase().includes(q) ||
        (item.type || '').toLowerCase().includes(q) ||
        (item.rack || '').toLowerCase().includes(q) ||
        (item.content || '').toLowerCase().includes(q) ||
        (item.label || '').toLowerCase().includes(q) ||
        (item.note || '').toLowerCase().includes(q) ||
        (item.gsm && item.gsm.toString().includes(q)) ||
        (item.greighRate && item.greighRate.toString().includes(q)) ||
        (item.greighWidth && item.greighWidth.toString().includes(q)) ||
        (item.finishWidth && item.finishWidth.toString().includes(q)) ||
        (item.weight && item.weight.toString().includes(q)) ||
        (item.reed && item.reed.toString().includes(q)) ||
        (item.pick && item.pick.toString().includes(q)) ||
        (item.danier && item.danier.toString().includes(q)) ||
        (item.count && item.count.toString().includes(q))
      );
    }
    if (typeFilter !== 'All') {
      result = result.filter(item => 
        (item.type || '').toLowerCase() === typeFilter.toLowerCase()
      );
    }
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [samples, search, sortOrder, typeFilter]);

  // Reset pagination when search, typeFilter, or sortOrder changes
  React.useEffect(() => {
    setVisibleCount(5);
    setLoadingMore(false);
  }, [search, typeFilter, sortOrder]);

  const paginatedSamples = React.useMemo(() => {
    return filteredSamples.slice(0, visibleCount);
  }, [filteredSamples, visibleCount]);

  const handleLoadMore = useCallback(() => {
    if (filteredSamples.length > visibleCount && !loadingMore) {
      setLoadingMore(true);
      setTimeout(() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setVisibleCount(prev => Math.min(prev + 5, filteredSamples.length));
        setLoadingMore(false);
      }, 800);
    }
  }, [filteredSamples.length, visibleCount, loadingMore]);

  const totalActiveFiltersCount = React.useMemo(() => {
    let count = 0;
    if (typeFilter !== 'All') count++;
    return count;
  }, [typeFilter]);

  const clearAllFilters = () => {
    setTypeFilter('All');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToast({ type: 'info', title: 'Filters Reset', message: 'All filters cleared successfully' });
  };

  const openCreateForm = () => {
    setEditingSample(null);
    setFormData({
      qualityName: '', type: '', rack: '', greighWidth: '', finishWidth: '',
      weight: '', gsm: '', content: '', danier: '', count: '',
      reed: '', pick: '', greighRate: '', note: ''
    });
    setFormImages([]);
    setShowTypeDropdown(false);
    setTypeSearch('');
    setShowForm(true);
  };

  const openEditForm = (item: Sample) => {
    setEditingSample(item);
    setFormData({
      qualityName: item.qualityName || '', type: item.type || '', rack: item.rack || '',
      greighWidth: item.greighWidth?.toString() || '', finishWidth: item.finishWidth?.toString() || '',
      weight: item.weight?.toString() || '', gsm: item.gsm?.toString() || '', content: item.content || '',
      danier: item.danier || '', count: item.count?.toString() || '', reed: item.reed?.toString() || '', pick: item.pick?.toString() || '',
      greighRate: item.greighRate?.toString() || '', note: item.note || ''
    });
    setFormImages(item.images || []);
    setShowTypeDropdown(false);
    setTypeSearch('');
    setShowForm(true);
  };

  const pickImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Image picker is not available on this platform/device');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: true });
    if (!result.canceled && result.assets) {
      await compressAndAdd(result.assets.map((a: any) => a.uri));
    }
  };

  const handleCameraCapture = async (uris: string[]) => {
    await compressAndAdd(uris);
  };

  const uploadImages = async (localUris: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of localUris) {
      try {
        const uploadedUrl = await uploadSingleImage(uri, 'samples');
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
        weaverId: id,
        qualityName: formData.qualityName.trim(), type: formData.type.trim(), rack: formData.rack.trim(),
        greighWidth: formData.greighWidth ? Number(formData.greighWidth) : undefined,
        finishWidth: formData.finishWidth ? Number(formData.finishWidth) : undefined,
        weight: formData.weight ? Number(formData.weight) : undefined,
        gsm: formData.gsm ? Number(formData.gsm) : undefined,
        content: formData.content.trim(), danier: formData.danier.trim(), count: formData.count.trim(),
        reed: formData.reed.trim(), pick: formData.pick.trim(),
        greighRate: formData.greighRate ? Number(formData.greighRate) : undefined,
        note: formData.note.trim(), images: imageUrls
      };

      if (editingSample) {
        await api.put(`/api/weaver/samples/${editingSample._id}`, payload);
        addToast({ type: 'success', title: 'Updated', message: 'Sample updated successfully' });
      } else {
        await api.post('/api/weaver/samples', payload);
        addToast({ type: 'success', title: 'Created', message: 'Sample created successfully' });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeFormModal();
      queryClient.invalidateQueries({ queryKey: ['weaver-samples', id] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to save sample' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/weaver/samples/${deleteTarget._id}`);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({ type: 'success', title: 'Deleted', message: 'Sample deleted successfully' });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['weaver-samples', id] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to delete sample' });
    } finally { setDeleting(false); }
  };

  const handleDeleteAll = async () => {
    setShowDeleteAllConfirm(false);
    setDeletingAll(true);
    try {
      const deletePromises = samples.map((sample: Sample) => 
        api.delete(`/api/weaver/samples/${sample._id}`)
      );
      await Promise.all(deletePromises);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({ type: 'success', title: 'Deleted All', message: 'All samples deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['weaver-samples', id] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to delete all samples' });
    } finally { setDeletingAll(false); }
  };

  const handleOpenPreview = (imgs: string[]) => {
    setPreviewImages(imgs);
    setPreviewVisible(true);
  };

  const handleSaveCroppedImage = async (croppedUri: string, index: number): Promise<string | null> => {
    setFormImages(prev => {
      const next = [...prev];
      if (index >= 0 && index < next.length) {
        next[index] = croppedUri;
      }
      return next;
    });
    setPreviewImages(prev => {
      const next = [...prev];
      if (index >= 0 && index < next.length) {
        next[index] = croppedUri;
      }
      return next;
    });
    return croppedUri;
  };

  const handleFormSticker = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const sample = editingSample || formData;
    const rxPVal = (sample as any).reed && (sample as any).pick ? `${(sample as any).reed}/${(sample as any).pick}` : '';
    const countVal = (sample as any).count ? String((sample as any).count) : ((sample as any).danier || '');

    const sanitizedQuality = ((sample as any).qualityName || 'Sticker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedWeaver = (weaver?.name || 'Weaver').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Sticker_${sanitizedQuality}_${sanitizedWeaver}.pdf`;

    try {
      const { uri, base64 } = await generateStickerPdf({
        type: 'sample',
        qualityName: (sample as any).qualityName || '',
        weaverName: weaver?.name || '',
        width: (sample as any).finishWidth ? Number((sample as any).finishWidth) : undefined,
        gsm: (sample as any).gsm ? Number((sample as any).gsm) : undefined,
        content: (sample as any).content || '',
        count: countVal || undefined,
        rxP: rxPVal || undefined,
        danier: (sample as any).danier || undefined,
      }, filename);

      setPdfViewerLocalUri(uri);
      setPdfViewerLocalBase64(base64);
      setPdfViewerUrl('');
      setPdfViewerTitle(`Sample Sticker — ${(sample as any).qualityName || 'Sticker'}`);
      setPdfViewerFilename(filename);
      setReopenFormOnStickerClose(true);
      setShowForm(false);
      await new Promise(r => setTimeout(r, 150));
      setPdfViewerVisible(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate sticker: ' + String(err));
    }
  }, [editingSample, formData, weaver]);

  const openStickerPreview = useCallback(async (sample: Sample) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const rxPVal = sample.reed && sample.pick ? `${sample.reed}/${sample.pick}` : '';
    const countVal = sample.count ? String(sample.count) : (sample.danier || '');

    const sanitizedQuality = (sample.qualityName || 'Sticker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedWeaver = (weaver?.name || 'Weaver').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Sticker_${sanitizedQuality}_${sanitizedWeaver}.pdf`;

    try {
      const { uri, base64 } = await generateStickerPdf({
        type: 'sample',
        qualityName: sample.qualityName || '',
        weaverName: weaver?.name || '',
        width: sample.finishWidth ? Number(sample.finishWidth) : undefined,
        gsm: sample.gsm ? Number(sample.gsm) : undefined,
        content: sample.content || '',
        count: countVal || undefined,
        rxP: rxPVal || undefined,
        danier: sample.danier || undefined,
      }, filename);

      setPdfViewerLocalUri(uri);
      setPdfViewerLocalBase64(base64);
      setPdfViewerUrl('');
      setPdfViewerTitle(`Sample Sticker — ${sample.qualityName || 'Sticker'}`);
      setPdfViewerFilename(filename);
      setReopenFormOnStickerClose(false);
      setPdfViewerVisible(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate sticker: ' + String(err));
    }
  }, [weaver]);

  const renderFormField = (label: string, value: string, keyName: string, placeholder?: string, keyboard?: 'default' | 'numeric') => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => setFormData(p => ({ ...p, [keyName]: t }))}
        placeholder={placeholder}
        placeholderTextColor={theme.inputPlaceholder}
        keyboardType={keyboard || 'default'}
        style={{
          backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
          borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0',
          borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
          fontSize: 14.5, color: theme.text,
          height: 42,
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <Header title={weaver?.name || 'Weaver Details'} showBack />



      {/* Search + Filter */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{
          flex: 1, flexDirection: 'row', alignItems: 'center',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
          borderRadius: 14, paddingHorizontal: 14, height: 46,
          borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
        }}>
          <Search size={18} color={theme.textTertiary} />
          <TextInput
            placeholder="Search samples..."
            placeholderTextColor={theme.inputPlaceholder}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: theme.text, paddingVertical: 0 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
            width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: totalActiveFiltersCount > 0
              ? (isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff')
              : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
            borderWidth: 1, 
            borderColor: totalActiveFiltersCount > 0
              ? (isDarkMode ? Colors.primary[500] : Colors.primary[300])
              : (isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
            position: 'relative'
          }}>
          <SlidersHorizontal size={20} color={totalActiveFiltersCount > 0 ? (isDarkMode ? Colors.primary[400] : Colors.primary[600]) : (isDarkMode ? theme.textSecondary : '#475569')} />
          {totalActiveFiltersCount > 0 && (
            <View style={{
              position: 'absolute', top: -3, right: -3,
              backgroundColor: Colors.primary[500],
              minWidth: 16, height: 16, borderRadius: 8,
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 4,
              borderWidth: 1.5, borderColor: isDarkMode ? '#0f172a' : '#fff'
            }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{totalActiveFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Samples List */}
      {samplesQuery.isLoading ? (
        <View style={{ flex: 1, paddingTop: 10 }}>
          <SampleSkeletonList count={4} />
        </View>
      ) : filteredSamples.length === 0 ? (
        <EmptyState
          icon={<TestTubes size={40} color={isDarkMode ? Colors.primary[400] : Colors.primary[500]} />}
          title={search ? 'No Samples Found' : 'No Samples Yet'}
          subtitle={search ? 'No samples match your search.' : 'Tap the + button to add a sample.'}
        />
      ) : (
        <FlashList
          data={paginatedSamples}
          keyExtractor={(item: Sample) => item._id}
          drawDistance={800}
          ListHeaderComponent={() => (
            <View style={{ 
              paddingHorizontal: 20, 
              paddingVertical: 8,
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              backgroundColor: theme.background
            }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>
                {search.trim() || totalActiveFiltersCount > 0 ? (
                  <Text>
                    Showing <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{filteredSamples.length}</Text> of <Text style={{ fontWeight: '800', color: theme.text }}>{samples.length}</Text>
                  </Text>
                ) : (
                  <Text>
                    Total Samples: <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{samples.length}</Text>
                  </Text>
                )}
              </Text>
              {isMaster && samples.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowDeleteAllConfirm(true);
                  }}
                  activeOpacity={0.7}
                  disabled={deletingAll}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
                    borderColor: isDarkMode ? '#991b1b' : '#fca5a5',
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                    gap: 4
                  }}
                >
                  {deletingAll ? (
                    <ActivityIndicator size="small" color={Colors.error[500]} />
                  ) : (
                    <>
                      <Trash2 size={12} color={isDarkMode ? '#fca5a5' : '#c53030'} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#fca5a5' : '#c53030' }}>
                        Delete All
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
          renderItem={({ item, index }) => <SampleCard item={item} index={index} onEdit={openEditForm} onDelete={setDeleteTarget} isSuperAdmin={isSuperAdmin} isMaster={isMaster} onPreviewImages={handleOpenPreview} onOpenSticker={openStickerPreview} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={Colors.primary[500]} />
              </View>
            ) : (visibleCount >= filteredSamples.length && filteredSamples.length > 0) ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
                  No more samples to load
                </Text>
              </View>
            ) : null
          }
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl
                refreshing={samplesQuery.isRefetching}
                onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); samplesQuery.refetch(); }}
                tintColor={Colors.primary[500]}
                colors={[Colors.primary[500]]}
              />
            ) : undefined
          }
        />
      )}

      {/* FAB - Add Sample */}
      {isSuperAdmin && (
        <RNAnimated.View
          {...fabPanResponder.panHandlers}
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
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: Colors.primary[600],
              alignItems: 'center', justifyContent: 'center',
              elevation: 8,
              shadowColor: Colors.primary[600],
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
          >
            <View style={{ position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <TestTubes size={24} color="#ffffff" />
              <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary[600], borderRadius: 7, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
                <Plus size={9} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

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
              height: isLargeScreen ? '92%' : '92%',
              width: '100%',
              maxWidth: isLargeScreen ? 850 : '100%',
              transform: [{ translateY: modalTranslateY }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 120}
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
                  <TestTubes size={20} color={isDarkMode ? '#c084fc' : '#9333ea'} />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>
                    {editingSample ? 'Edit Sample' : 'Add Sample'}
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
                contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 220 : 220 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                onScroll={(e) => { formScrollOffset.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                {/* ─── Quality Information ─── */}
                <View style={{ borderBottomWidth: 1, borderBottomColor: theme.borderLight, paddingBottom: 6, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Quality Information</Text>
                </View>
                {renderFormField('Quality Name *', formData.qualityName, 'qualityName', 'Quality name')}
                
                {/* Type Selector Dropdown */}
                <View style={{ marginBottom: 10, zIndex: 100 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Type</Text>
                  <View
                    style={{
                      height: 42,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: showTypeDropdown ? (isDarkMode ? Colors.primary[400] : Colors.primary[600]) : (isDarkMode ? '#334155' : '#e2e8f0'),
                      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setShowTypeDropdown(!showTypeDropdown);
                        setTypeSearch('');
                      }}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        height: '100%',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 15, color: formData.type ? theme.text : theme.inputPlaceholder, fontWeight: formData.type ? '500' : '400' }}>
                        {formData.type || 'Search or select type...'}
                      </Text>
                    </TouchableOpacity>

                    {formData.type ? (
                      <TouchableOpacity
                        onPress={() => setFormData(p => ({ ...p, type: '' }))}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{ padding: 4, marginRight: 4 }}
                      >
                        <X size={16} color={theme.textTertiary} />
                      </TouchableOpacity>
                    ) : null}
                    
                    <TouchableOpacity onPress={() => setShowTypeDropdown(!showTypeDropdown)}>
                      <ChevronDown 
                        size={18} 
                        color={theme.textTertiary} 
                        style={{ transform: [{ rotate: showTypeDropdown ? '180deg' : '0deg' }] }} 
                      />
                    </TouchableOpacity>
                  </View>

                  {showTypeDropdown && (
                    <View style={{
                      marginTop: 6,
                      backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                      elevation: 10,
                      overflow: 'hidden',
                      maxHeight: 250,
                    }}>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 12,
                        height: 44,
                        borderBottomWidth: 1,
                        borderBottomColor: isDarkMode ? '#334155' : '#e2e8f0',
                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                      }}>
                        <Search size={16} color={theme.textTertiary} />
                        <TextInput
                          style={{ flex: 1, fontSize: 14, color: theme.text, padding: 0 }}
                          value={typeSearch}
                          onChangeText={setTypeSearch}
                          placeholder="Search type..."
                          placeholderTextColor={theme.inputPlaceholder}
                          autoFocus={false}
                        />
                        {typeSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setTypeSearch('')}>
                            <X size={14} color={theme.textTertiary} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                        {TYPE_OPTIONS.filter(opt => !typeSearch || opt.toLowerCase().includes(typeSearch.toLowerCase())).map((opt) => {
                          const isSelected = formData.type === opt;
                          return (
                            <TouchableOpacity
                              key={opt}
                              onPress={() => {
                                setFormData(p => ({ ...p, type: opt }));
                                setShowTypeDropdown(false);
                              }}
                              style={{
                                paddingVertical: 12,
                                paddingHorizontal: 14,
                                backgroundColor: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : 'transparent',
                                borderBottomWidth: 1,
                                borderBottomColor: isDarkMode ? '#334155' : '#e2e8f0',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '400', color: isSelected ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text }}>
                                {opt}
                              </Text>
                              {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDarkMode ? '#60a5fa' : '#2563eb' }} />}
                            </TouchableOpacity>
                          );
                        })}
                        {/* Custom write-in search option */}
                        {typeSearch.trim().length > 0 && !TYPE_OPTIONS.some(o => o.toLowerCase() === typeSearch.trim().toLowerCase()) && (
                          <TouchableOpacity
                            onPress={() => {
                              setFormData(p => ({ ...p, type: typeSearch.trim() }));
                              setShowTypeDropdown(false);
                            }}
                            style={{
                              paddingVertical: 12,
                              paddingHorizontal: 14,
                              borderBottomWidth: 1,
                              borderBottomColor: isDarkMode ? '#334155' : '#e2e8f0',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <Plus size={16} color={isDarkMode ? '#60a5fa' : '#2563eb'} />
                            <Text style={{ fontSize: 15, color: isDarkMode ? '#60a5fa' : '#2563eb', fontWeight: '600' }}>
                              Use "{typeSearch.trim()}"
                            </Text>
                          </TouchableOpacity>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* ─── Images ─── */}
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 }}>Images</Text>
                  
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    {/* Camera button */}
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setCameraVisible(true)}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: isDarkMode ? Colors.primary[500] : Colors.primary[600],
                        backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.05)' : '#eff6ff',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                      }}>
                      <Camera size={16} color={isDarkMode ? '#818cf8' : '#4f46e5'} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#818cf8' : '#4f46e5' }}>Camera</Text>
                    </TouchableOpacity>

                    {/* Gallery button */}
                    <TouchableOpacity activeOpacity={0.7} onPress={pickImage}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: isDarkMode ? Colors.primary[500] : Colors.primary[600],
                        backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.05)' : '#eff6ff',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                      }}>
                      <ImageIcon size={16} color={isDarkMode ? '#818cf8' : '#4f46e5'} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#818cf8' : '#4f46e5' }}>Upload Image</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Thumbnail strip */}
                  {formImages.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ flexDirection: 'row' }}
                      contentContainerStyle={{ paddingVertical: 6, gap: 10 }}
                    >
                      {formImages.map((img, i) => (
                        <View key={i} style={{ position: 'relative', marginRight: 4 }}>
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => handleOpenPreview(formImages)}
                          >
                            <Image
                              source={{ uri: resolveImageUrl(img) }}
                              style={{ width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                              resizeMode="cover"
                              resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                              fadeDuration={100}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setFormImages(p => p.filter((_, idx) => idx !== i))}
                            style={{
                              position: 'absolute', top: -4, right: -6,
                              backgroundColor: Colors.error[500],
                              width: 20, height: 20, borderRadius: 10,
                              alignItems: 'center', justifyContent: 'center',
                              zIndex: 10,
                            }}
                          >
                            <X size={12} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* ─── Weaver Information ─── */}
                <View style={{ borderBottomWidth: 1, borderBottomColor: theme.borderLight, paddingBottom: 6, marginTop: 12, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Weaver Information</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    {renderFormField('Greigh Width (inches)', formData.greighWidth, 'greighWidth', 'e.g., 58.5', 'numeric')}
                  </View>
                  <View style={{ flex: 1 }}>
                    {renderFormField('Finish Width (inches)', formData.finishWidth, 'finishWidth', 'e.g., 56.0', 'numeric')}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    {renderFormField('Weight (KG)', formData.weight, 'weight', 'e.g., 8.0', 'numeric')}
                  </View>
                  <View style={{ flex: 1 }}>
                    {renderFormField('GSM', formData.gsm, 'gsm', 'e.g., 72.5', 'numeric')}
                  </View>
                </View>

                {renderFormField('Content', formData.content, 'content', 'e.g., 100% Polyester')}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    {renderFormField('Danier (Count)', formData.danier, 'danier', 'e.g., 55*22D')}
                  </View>
                  <View style={{ flex: 1 }}>
                    {renderFormField('Count', formData.count, 'count', 'Count')}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    {renderFormField('Reed', formData.reed, 'reed', 'e.g., 120')}
                  </View>
                  <View style={{ flex: 1 }}>
                    {renderFormField('Pick', formData.pick, 'pick', 'e.g., 80')}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    {renderFormField('Greigh Rate (₹)', formData.greighRate, 'greighRate', 'e.g., 150.00', 'numeric')}
                  </View>
                  <View style={{ flex: 1 }}>
                    {renderFormField('Rack', formData.rack, 'rack', 'Enter rack')}
                  </View>
                </View>

                {renderFormField('Note', formData.note, 'note', 'Add a short note')}



                <View style={{ marginTop: 8 }}>
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
                      elevation: 4
                    }}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                        {editingSample ? 'Update' : 'Create'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Delete Modal */}
      <Modal visible={!!deleteTarget} animationType="fade" transparent onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 24 }}>
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
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : Colors.error[50], alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Trash2 size={24} color={Colors.error[600]} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 8 }}>Delete Sample</Text>
            <Text style={{ fontSize: 15, color: theme.textTertiary, marginBottom: 24, lineHeight: 21 }}>Are you sure you want to delete this sample? This action cannot be undone.</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setDeleteTarget(null)} activeOpacity={0.7} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} disabled={deleting} activeOpacity={0.8} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.error[600], shadowColor: Colors.error[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}>
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete All Samples Modal */}
      <Modal visible={showDeleteAllConfirm} animationType="fade" transparent onRequestClose={() => setShowDeleteAllConfirm(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 24 }}>
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
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : Colors.error[50], alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Trash2 size={24} color={Colors.error[600]} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 8 }}>Delete All Samples</Text>
            <Text style={{ fontSize: 15, color: theme.textTertiary, marginBottom: 24, lineHeight: 21 }}>
              Are you sure you want to delete <Text style={{ fontWeight: '800', color: theme.text }}>all {samples.length} samples</Text> of this weaver? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowDeleteAllConfirm(false)} activeOpacity={0.7} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteAll} disabled={deletingAll} activeOpacity={0.8} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.error[600], shadowColor: Colors.error[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}>
                {deletingAll ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Delete All</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <CustomCameraModal visible={cameraVisible} onClose={() => setCameraVisible(false)} onPhotosCaptured={handleCameraCapture} />

      {/* Image Preview Modal */}
      <ImagePreviewModal 
        visible={previewVisible} 
        images={previewImages} 
        onClose={() => setPreviewVisible(false)} 
        onSaveCroppedImage={showForm ? handleSaveCroppedImage : undefined}
      />

      {/* Filter Modal */}
      <Modal visible={showFilterModal} animationType={isLargeScreen ? 'fade' : 'slide'} transparent statusBarTranslucent={true} navigationBarTranslucent={true} onRequestClose={closeFilterModal}>

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
              paddingTop: 12,
              paddingHorizontal: 24,
              paddingBottom: isLargeScreen ? 24 : 0,
              height: isLargeScreen ? 550 : 520,
              width: '100%',
              maxWidth: isLargeScreen ? 800 : '100%',
              transform: [{ translateY: filterModalTranslateY }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            {/* Drag Handle Indicator */}
            <View style={{ width: '100%', alignItems: 'center', paddingVertical: 12, marginBottom: 4, backgroundColor: 'transparent' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#d1d5db' }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>Filters</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                {totalActiveFiltersCount > 0 && (
                  <TouchableOpacity onPress={clearAllFilters} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <RotateCcw size={15} color={Colors.error[500]} />
                    <Text style={{ color: Colors.error[500], fontSize: 14, fontWeight: '700' }}>Reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={closeFilterModal}
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
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
              keyboardShouldPersistTaps="handled"
              onScroll={(e) => { filterScrollOffset.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {/* Sort Order Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort By</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSortOrder('desc');
                  }}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 18,
                    backgroundColor: sortOrder === 'desc'
                      ? Colors.primary[600]
                      : isDarkMode
                        ? Colors.neutral[800]
                        : Colors.neutral[100],
                    borderWidth: 1,
                    borderColor: sortOrder === 'desc'
                      ? Colors.primary[600]
                      : isDarkMode
                        ? 'rgba(255,255,255,0.08)'
                        : '#cbd5e1',
                  }}
                >
                  <Text style={{ 
                    fontSize: 12.5, 
                    fontWeight: '600', 
                    color: sortOrder === 'desc' ? Colors.white : theme.textSecondary 
                  }}>
                    Newest first
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSortOrder('asc');
                  }}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 18,
                    backgroundColor: sortOrder === 'asc'
                      ? Colors.primary[600]
                      : isDarkMode
                        ? Colors.neutral[800]
                        : Colors.neutral[100],
                    borderWidth: 1,
                    borderColor: sortOrder === 'asc'
                      ? Colors.primary[600]
                      : isDarkMode
                        ? 'rgba(255,255,255,0.08)'
                        : '#cbd5e1',
                  }}
                >
                  <Text style={{ 
                    fontSize: 12.5, 
                    fontWeight: '600', 
                    color: sortOrder === 'asc' ? Colors.white : theme.textSecondary 
                  }}>
                    Oldest first
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Type Filter */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fabric Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24, gap: 8 }}>
                {['All', ...TYPE_OPTIONS].map((type) => {
                  const isSelected = typeFilter === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTypeFilter(type);
                      }}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 18,
                        backgroundColor: isSelected
                          ? Colors.primary[600]
                          : isDarkMode
                            ? Colors.neutral[800]
                            : Colors.neutral[100],
                        borderWidth: 1,
                        borderColor: isSelected
                          ? Colors.primary[600]
                          : isDarkMode
                            ? 'rgba(255,255,255,0.08)'
                            : '#cbd5e1',
                      }}
                    >
                      <Text style={{ 
                        fontSize: 12.5, 
                        fontWeight: '600', 
                        color: isSelected 
                          ? Colors.white 
                          : theme.textSecondary 
                      }}>
                        {type === 'All' ? 'All Types' : type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* PDF Sticker Viewer Modal */}
      <PdfViewerModal
        visible={pdfViewerVisible}
        pdfUrl={pdfViewerUrl}
        title={pdfViewerTitle}
        filename={pdfViewerFilename}
        localUri={pdfViewerLocalUri}
        localBase64={pdfViewerLocalBase64}
        addToast={addToast}
        onClose={() => {
          setPdfViewerVisible(false);
          setPdfViewerLocalUri(undefined);
          setPdfViewerLocalBase64(undefined);
          if (reopenFormOnStickerClose) {
            setShowForm(true);
            setReopenFormOnStickerClose(false);
          }
        }}
      />
    </SafeAreaView>
  );
}
