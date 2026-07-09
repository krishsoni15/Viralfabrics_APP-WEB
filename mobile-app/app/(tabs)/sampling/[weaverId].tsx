import React, { useState, useCallback, useRef } from 'react';
import { View, Text, RefreshControl, Platform, TouchableOpacity, ActivityIndicator, Modal, ScrollView, TextInput, KeyboardAvoidingView, Alert, PanResponder, Animated as RNAnimated, Pressable, Dimensions, Keyboard, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Phone, MapPin, TestTubes, Image as ImageIcon, Plus, Edit, Trash2, X, Camera, Search, ArrowUpDown, WifiOff, ChevronDown, Tag } from 'lucide-react-native';
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
import { useTheme } from '../../../hooks/useTheme';
import { useAuth } from '../../../hooks/useAuth';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { Colors } from '../../../constants/colors';
import { Sample, SamplingWeaver } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { formatDate, resolveImageUrl, uploadSingleImage } from '../../../utils/helpers';
import { generateStickerPdf } from '../../../utils/stickerPdf';


const TYPE_OPTIONS = ['Polyester', 'Blend', 'Viscose', 'Cotton', 'Rayon', 'Other'];

function SampleCard({
  item, index, onEdit, onDelete, isSuperAdmin, isMaster, onPreviewImages, onOpenSticker
}: {
  item: Sample;
  index: number;
  onEdit: (s: Sample) => void;
  onDelete: (s: Sample) => void;
  isSuperAdmin: boolean;
  isMaster: boolean;
  onPreviewImages: (imgs: string[]) => void;
  onOpenSticker: (s: Sample) => void;
}) {
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
                  contentFit="cover"
                  transition={100}
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
          <View style={{ marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fffbeb', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}>
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
                <Edit size={13} color={Colors.primary[600]} />
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
                <Trash2 size={13} color={Colors.error[600]} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function WeaverSamplesScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { weaverId } = useLocalSearchParams<{ weaverId: string }>();
  const { theme, isDarkMode } = useTheme();
  const { isSuperAdmin, isMaster } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useAppStore(s => s.addToast);
  const isOffline = useAppStore(s => s.isOffline);
  const insets = useSafeAreaInsets();
  const { isLargeScreen, modalMaxWidth } = useResponsiveLayout();

  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [reopenFormOnStickerClose, setReopenFormOnStickerClose] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const formPanY = useRef(new RNAnimated.Value(0)).current;
  const formScrollOffset = useRef(0);
  const formSheetY = useRef(0);

  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 68, y: screenHeight - 170 })).current;
  const fabX = useRef(screenWidth - 68);
  const fabY = useRef(screenHeight - 170);

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

  // Form modal handlers
  const closeFormModalRef = React.useRef<() => void>(() => {});

  const [editingItem, setEditingItem] = useState<Sample | null>(null);
  const [formData, setFormData] = useState({
    qualityName: '',
    type: '',
    rack: '',
    greighWidth: '',
    finishWidth: '',
    weight: '',
    gsm: '',
    content: '',
    danier: '',
    count: '',
    reed: '',
    pick: '',
    greighRate: '',
    note: '',
  });
  const [formImages, setFormImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');

  const hasUnsavedChanges = useCallback(() => {
    if (editingItem) {
      const fields = [
        'qualityName', 'type', 'rack', 'greighWidth', 'finishWidth',
        'weight', 'gsm', 'content', 'danier', 'count', 'reed', 'pick',
        'greighRate', 'note'
      ];
      for (const field of fields) {
        const initial = (editingItem as any)[field]?.toString() || '';
        const current = (formData as any)[field] || '';
        if (initial.trim() !== current.trim()) return true;
      }
      const initialImages = editingItem.images || [];
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
  }, [formData, formImages, editingItem]);

  const forceCloseForm = useCallback(() => {
    Keyboard.dismiss();
    RNAnimated.timing(formPanY, {
      toValue: 800,
      duration: 180,
      useNativeDriver: false,
    }).start(() => {
      setShowForm(false);
      setEditingItem(null);
      setFormData({
        qualityName: '',
        type: '',
        rack: '',
        greighWidth: '',
        finishWidth: '',
        weight: '',
        gsm: '',
        content: '',
        danier: '',
        count: '',
        reed: '',
        pick: '',
        greighRate: '',
        note: '',
      });
    });
  }, [formPanY]);

  const closeFormModal = useCallback(() => {
    forceCloseForm();
  }, [forceCloseForm]);

  closeFormModalRef.current = closeFormModal;

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
          closeFormModalRef.current();
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
      formPanY.setValue(800);
      RNAnimated.spring(formPanY, {
        toValue: 0,
        useNativeDriver: false,
        damping: 15,
        stiffness: 120,
      }).start();
    }
  }, [showForm]);

  // Modals visibility
  const [cameraVisible, setCameraVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  // PDF Sticker Viewer states
  const [pdfViewerVisible, setPdfViewerVisible] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState('');
  const [pdfViewerLocalUri, setPdfViewerLocalUri] = useState<string | undefined>();
  const [pdfViewerLocalBase64, setPdfViewerLocalBase64] = useState<string | undefined>();
  const [pdfViewerTitle, setPdfViewerTitle] = useState('');
  const [pdfViewerFilename, setPdfViewerFilename] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Sample | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch weaver info
  const weaverQuery = useQuery({
    queryKey: ['sampling-weaver', weaverId],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/sampling/weavers', { params: { search: '' } });
        const weavers = data?.data || [];
        return weavers.find((w: SamplingWeaver) => w._id === weaverId) || { _id: weaverId, name: 'Weaver' };
      } catch { return { _id: weaverId, name: 'Weaver' }; }
    },
  });

  // Fetch samples for this weaver
  const samplesQuery = useQuery({
    queryKey: ['sampling-samples', weaverId],
    queryFn: async () => {
      const { data } = await api.get('/api/sampling/samples', { params: { weaverId } });
      return data?.data || [];
    },
  });

  const weaver = weaverQuery.data;
  const samples: Sample[] = samplesQuery.data || [];

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
        (item.note || '').toLowerCase().includes(q) ||
        (item.gsm && item.gsm.toString().includes(q)) ||
        (item.greighRate && item.greighRate.toString().includes(q))
      );
    }
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [samples, search, sortOrder]);

  const openCreateForm = () => {
    setEditingItem(null);
    setFormData({
      qualityName: '', type: '', rack: '', greighWidth: '', finishWidth: '',
      weight: '', gsm: '', content: '', danier: '', count: '',
      reed: '', pick: '', greighRate: '', note: ''
    });
    setFormImages([]);
    setShowForm(true);
  };

  const openEditForm = (item: Sample) => {
    setEditingItem(item);
    setFormData({
      qualityName: item.qualityName || '',
      type: item.type || '',
      rack: item.rack || '',
      greighWidth: item.greighWidth?.toString() || '',
      finishWidth: item.finishWidth?.toString() || '',
      weight: item.weight?.toString() || '',
      gsm: item.gsm?.toString() || '',
      content: item.content || '',
      danier: item.danier || '',
      count: item.count || '',
      reed: item.reed || '',
      pick: item.pick || '',
      greighRate: item.greighRate?.toString() || '',
      note: item.note || '',
    });
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
        weaverId,
        qualityName: formData.qualityName.trim(),
        type: formData.type.trim(),
        rack: formData.rack.trim(),
        greighWidth: formData.greighWidth ? Number(formData.greighWidth) : undefined,
        finishWidth: formData.finishWidth ? Number(formData.finishWidth) : undefined,
        weight: formData.weight ? Number(formData.weight) : undefined,
        gsm: formData.gsm ? Number(formData.gsm) : undefined,
        content: formData.content.trim(),
        danier: formData.danier.trim(),
        count: formData.count.trim(),
        reed: formData.reed.trim(),
        pick: formData.pick.trim(),
        greighRate: formData.greighRate ? Number(formData.greighRate) : undefined,
        note: formData.note.trim(),
        images: imageUrls,
      };
      if (editingItem) {
        await api.put(`/api/sampling/samples/${editingItem._id}`, payload);
        addToast({ type: 'success', title: 'Updated', message: 'Sample updated' });
      } else {
        await api.post('/api/sampling/samples', payload);
        addToast({ type: 'success', title: 'Created', message: 'Sample created' });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      forceCloseForm();
      queryClient.invalidateQueries({ queryKey: ['sampling-samples', weaverId] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to save' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/sampling/samples/${deleteTarget._id}`);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({ type: 'success', title: 'Deleted', message: 'Sample deleted' });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['sampling-samples', weaverId] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to delete' });
    } finally { setDeleting(false); }
  };

  const handleOpenPreview = (imgs: string[]) => {
    setPreviewImages(imgs);
    setPreviewVisible(true);
  };

  const handleFormSticker = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const sample = editingItem || formData;
    const rxPVal = (sample as any).reed && (sample as any).pick ? `${(sample as any).reed}/${(sample as any).pick}` : '';
    const countVal = (sample as any).count ? String((sample as any).count) : ((sample as any).danier || '');

    const sanitizedQuality = ((sample as any).qualityName || 'Sticker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedWeaver = (weaver?.name || 'Weaver').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Sample_Sticker_${sanitizedQuality}_${sanitizedWeaver}.pdf`;

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
  }, [editingItem, formData, weaver]);

  const openStickerPreview = useCallback(async (sample: Sample) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const rxPVal = sample.reed && sample.pick ? `${sample.reed}/${sample.pick}` : '';
    const countVal = sample.count ? String(sample.count) : (sample.danier || '');

    const sanitizedQuality = (sample.qualityName || 'Sticker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedWeaver = (weaver?.name || 'Weaver').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Sample_Sticker_${sanitizedQuality}_${sanitizedWeaver}.pdf`;

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
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => setFormData(p => ({ ...p, [keyName]: t }))}
        placeholder={placeholder}
        placeholderTextColor={theme.inputPlaceholder}
        keyboardType={keyboard || 'default'}
        style={{
          backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
          borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0',
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
          fontSize: 15, color: theme.text
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <Header title={weaver?.name || 'Weaver Samples'} showBack />

      {/* Weaver Info */}
      {weaver && (weaver.phone || weaver.address) && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <View style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
            {weaver.phone && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Phone size={13} color={theme.textSecondary} />
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 8 }}>{weaver.phone}</Text>
              </View>
            )}
            {weaver.address && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MapPin size={13} color={theme.textSecondary} />
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 8 }} numberOfLines={2}>{weaver.address}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Search + Sort */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{
          flex: 1, flexDirection: 'row', alignItems: 'center',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
          borderRadius: 12, paddingHorizontal: 14, height: 44,
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
        <TouchableOpacity onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSortOrder(p => p === 'desc' ? 'asc' : 'desc'); }} style={{
          width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
          borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
        }}>
          <ArrowUpDown size={20} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
        </TouchableOpacity>
      </View>

      {/* Samples List */}
      {samplesQuery.isLoading ? <SampleSkeletonList count={3} /> : filteredSamples.length === 0 ? (
        <EmptyState icon={<TestTubes size={40} color={Colors.primary[500]} />} title="No Samples" subtitle={search ? 'No samples match your search.' : 'No samples found for this weaver.'} />
      ) : (
        <FlashList
          data={filteredSamples}
          keyExtractor={(item: Sample) => item._id}
          drawDistance={800}
          ListHeaderComponent={() => (
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
              <View style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: theme.background }}>
                <Text style={{ fontSize: 12, color: theme.textTertiary, fontWeight: '600' }}>
                  {sortOrder === 'desc' ? '↓ Newest first' : '↑ Oldest first'} · {filteredSamples.length} items
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item, index }) => <SampleCard item={item} index={index} onEdit={openEditForm} onDelete={setDeleteTarget} isSuperAdmin={isSuperAdmin} isMaster={isMaster} onPreviewImages={handleOpenPreview} onOpenSticker={openStickerPreview} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          ListFooterComponent={
            filteredSamples.length > 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
                  No more samples to load
                </Text>
              </View>
            ) : null
          }
          refreshControl={Platform.OS !== 'web' ? <RefreshControl refreshing={samplesQuery.isRefetching} onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); samplesQuery.refetch(); }} tintColor={Colors.primary[500]} colors={[Colors.primary[500]]} /> : undefined}
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

      {/* Create/Edit Modal */}
      <Modal visible={showForm} transparent={true} animationType="none" statusBarTranslucent={true} navigationBarTranslucent={true} onRequestClose={closeFormModal}>

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
              maxHeight: '92%',
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

              {/* Modal Header with Title & Close Button */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TestTubes size={20} color={isDarkMode ? '#c084fc' : '#9333ea'} />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>
                    {editingItem ? 'Edit Sample' : 'Add Sample'}
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
                {/* ─── Quality Information ─── */}
                <View style={{ borderBottomWidth: 1, borderBottomColor: theme.borderLight, paddingBottom: 6, marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Quality Information</Text>
                </View>
                {renderFormField('Quality Name *', formData.qualityName, 'qualityName', 'Quality name')}
                
                {/* Type Selector Dropdown */}
                <View style={{ marginBottom: 14, zIndex: 100 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Type</Text>
                  <View
                    style={{
                      height: 50,
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 14,
                      borderRadius: 14,
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
                              contentFit="cover"
                              transition={100}
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
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 }}>
                        {editingItem ? 'Update Sample' : 'Add Sample'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Delete */}
      <Modal visible={!!deleteTarget} animationType="fade" transparent statusBarTranslucent={true} navigationBarTranslucent={true} onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 24 }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 12 }}>Delete Sample</Text>
            <Text style={{ fontSize: 15, color: theme.textSecondary, marginBottom: 24 }}>Delete "{deleteTarget?.qualityName}"?</Text>
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
