import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Platform, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Image, Alert, Pressable, PanResponder, Animated as RNAnimated, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { useSegments, Redirect } from 'expo-router';
import { Boxes, Search, X, ArrowUpDown, Plus, Image as ImageIcon, Trash2, Edit, Camera, User, WifiOff, SlidersHorizontal, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.warn('expo-image-picker failed to load:', e);
}

import api from '../../services/api';
import Header from '../../components/shared/Header';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { GreyMaterialSkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ImagePreviewModal from '../../components/shared/ImagePreviewModal';
import CustomCameraModal from '../../components/shared/CustomCameraModal';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { GreyMaterial } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatDate, resolveImageUrl, uploadSingleImage } from '../../utils/helpers';

const PAGE_SIZE = 20;

interface GroupedGreyMaterial {
  qualityCode: string;
  qualityName: string;
  type: string;
  images: string[];
  items: GreyMaterial[];
}

const GreyMaterialCard = React.memo(function GreyMaterialCard({
  group, index, onEdit, onDelete, isSuperAdmin, isMaster, onPreviewImages
}: { 
  group: GroupedGreyMaterial; 
  index: number; 
  onEdit: (g: GreyMaterial) => void; 
  onDelete: (qualityCode: string, qualityName: string) => void; 
  isSuperAdmin: boolean; 
  isMaster: boolean;
  onPreviewImages: (imgs: string[]) => void;
}) {
  const { theme, isDarkMode } = useTheme();

  // Combine images from the group fields and all inner items
  const allGroupImages = useMemo(() => {
    const urls: string[] = [];
    if (group.images && group.images.length > 0) {
      urls.push(...group.images);
    }
    for (const item of group.items) {
      if (item.images && item.images.length > 0) {
        for (const img of item.images) {
          if (!urls.includes(img)) urls.push(img);
        }
      }
    }
    return urls;
  }, [group]);

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

  const challanColor = {
    bg: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
    text: isDarkMode ? '#fbbf24' : '#b45309',
    border: isDarkMode ? 'rgba(245, 158, 11, 0.25)' : '#fde68a'
  };

  const gsmColor = {
    bg: isDarkMode ? 'rgba(139, 92, 246, 0.12)' : '#f5f3ff',
    text: isDarkMode ? '#a78bfa' : '#6d28d9',
    border: isDarkMode ? 'rgba(139, 92, 246, 0.25)' : '#ddd6fe'
  };

  const codeColor = {
    bg: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
    text: isDarkMode ? '#818cf8' : '#4f46e5',
    border: isDarkMode ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe'
  };

  return (
    <Animated.View>
      <Card style={{ marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.borderLight, backgroundColor: theme.card, borderRadius: 16, padding: 18 }}>
        {/* Combined Images clickable preview */}
        {allGroupImages.length > 0 && (
          <TouchableOpacity onPress={() => onPreviewImages(allGroupImages)} activeOpacity={0.9} style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}>
            <Image source={{ uri: resolveImageUrl(allGroupImages[0]) }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
            {allGroupImages.length > 1 && (
              <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                <ImageIcon size={11} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{allGroupImages.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Quality Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }} numberOfLines={2}>{group.qualityName}</Text>
            {group.type ? (
              <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginTop: 2 }}>{group.type}</Text>
            ) : null}
          </View>
          {group.qualityCode && <Badge text={group.qualityCode} color={codeColor} />}
        </View>

        {/* Weavers List Section */}
        <View style={{ borderTopWidth: 1, borderColor: theme.borderLight, paddingTop: 12, marginTop: 4, gap: 10 }}>
          {group.items.map((item, idx) => (
            <View 
              key={item._id || idx} 
              style={{ 
                padding: 12, 
                borderRadius: 12,
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                borderLeftWidth: 3,
                borderLeftColor: isDarkMode ? Colors.primary[500] : Colors.primary[600],
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9'
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={12} color={isDarkMode ? '#818cf8' : '#4f46e5'} />
                    </View>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: theme.text }}>
                      {item.weaver || '—'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '500' }}>
                    {formatDate(item.createdAt)}
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {item.piece != null && item.piece > 0 && <Badge text={`${item.piece} pcs`} color={pieceColor} />}
                  {item.meter != null && item.meter > 0 && <Badge text={`${item.meter} mtr`} color={meterColor} />}
                  {item.challanNumber && <Badge text={`#${item.challanNumber}`} color={challanColor} />}
                  {item.gsm != null && item.gsm > 0 && <Badge text={`GSM: ${item.gsm}`} color={gsmColor} />}
                  {item.greighWidth != null && item.greighWidth > 0 && <Badge text={`${item.greighWidth}" Width`} />}
                  {item.greighRate != null && item.greighRate > 0 && <Badge text={`₹${item.greighRate}`} />}
                  {item.rack ? <Badge text={`Rack: ${item.rack}`} /> : null}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Card Footer Actions - same as fabrics page */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
          <Text style={{ fontSize: 11.5, color: theme.textTertiary, fontWeight: '500' }}>
            Added {formatDate(group.items[0]?.createdAt)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {isSuperAdmin && (
              <TouchableOpacity
                onPress={() => onEdit(group.items[0])}
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
                onPress={() => onDelete(group.qualityCode, group.qualityName)}
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

const FormField = ({ label, value, onChangeText, placeholder, keyboard, multiline, theme, isDarkMode }: any) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>{label}</Text>
    <TextInput
      value={value} onChangeText={onChangeText}
      placeholder={placeholder} placeholderTextColor={theme.inputPlaceholder}
      keyboardType={keyboard || 'default'} multiline={multiline}
      style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, ...(multiline ? { minHeight: 60, textAlignVertical: 'top' as any } : {}) }}
    />
  </View>
);

const WeaverFormField = ({ label, value, onChangeText, placeholder, keyboard, theme, isDarkMode }: any) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>{label}</Text>
    <TextInput
      value={value} 
      onChangeText={onChangeText}
      placeholder={placeholder} placeholderTextColor={theme.inputPlaceholder}
      keyboardType={keyboard || 'default'}
      style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text }}
    />
  </View>
);

export default function GreyMaterialsScreen() {
  const segments = useSegments();
  const isInTabs = (segments as string[]).includes('(tabs)');

  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { isSuperAdmin, isMaster, user } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useAppStore(s => s.addToast);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const isOffline = useAppStore(s => s.isOffline);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterType, setFilterType] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFiltered = debouncedSearch.trim() !== '' || filterType !== 'All';

  const totalActiveFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch.trim() !== '') count++;
    if (filterType !== 'All') count++;
    return count;
  }, [debouncedSearch, filterType]);

  const clearAllFilters = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSearch('');
    setDebouncedSearch('');
    setFilterType('All');
    setSortOrder('desc');
  }, []);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<GreyMaterial | null>(null);
  const [formData, setFormData] = useState({ qualityName: '', qualityCode: '', type: '' });
  
  // Weavers multi-add state
  const [formWeavers, setFormWeavers] = useState<Array<{ name: string; piece: string; meter: string; challanNumber: string }>>([
    { name: '', piece: '', meter: '', challanNumber: '' }
  ]);

  const [formImages, setFormImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form Pan and Gesture animation
  const formPanY = useRef(new RNAnimated.Value(800)).current;

  const closeForm = useCallback(() => {
    if ((Platform.OS as string) !== 'web') {
      RNAnimated.timing(formPanY, {
        toValue: 800,
        duration: 180,
        useNativeDriver: (Platform.OS as string) !== 'web'
      }).start(() => setShowForm(false));
    } else {
      setShowForm(false);
    }
  }, [formPanY]);

  const formPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) formPanY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          closeForm();
        } else {
          RNAnimated.spring(formPanY, {
            toValue: 0,
            useNativeDriver: (Platform.OS as string) !== 'web',
            friction: 5
          }).start();
        }
      }
    })
  ).current;

  React.useEffect(() => {
    if (showForm) {
      formPanY.setValue(800);
      RNAnimated.spring(formPanY, {
        toValue: 0,
        useNativeDriver: (Platform.OS as string) !== 'web',
        damping: 15,
        stiffness: 120
      }).start();
    }
  }, [showForm, formPanY]);

  // Filter Modal Pan and Gesture animation
  const filterPanY = useRef(new RNAnimated.Value(600)).current;

  const closeFilter = useCallback(() => {
    if ((Platform.OS as string) !== 'web') {
      RNAnimated.timing(filterPanY, {
        toValue: 600,
        duration: 180,
        useNativeDriver: (Platform.OS as string) !== 'web'
      }).start(() => setShowFilterModal(false));
    } else {
      setShowFilterModal(false);
    }
  }, [filterPanY]);

  const filterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) filterPanY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.3) {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          closeFilter();
        } else {
          RNAnimated.spring(filterPanY, {
            toValue: 0,
            useNativeDriver: (Platform.OS as string) !== 'web',
            friction: 5
          }).start();
        }
      }
    })
  ).current;

  React.useEffect(() => {
    if (showFilterModal) {
      filterPanY.setValue(600);
      RNAnimated.spring(filterPanY, {
        toValue: 0,
        useNativeDriver: (Platform.OS as string) !== 'web',
        damping: 15,
        stiffness: 120
      }).start();
    }
  }, [showFilterModal, filterPanY]);

  // Draggable FAB animation setup
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 68, y: screenHeight - 150 })).current;

  const fabPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
    onPanResponderGrant: () => { 
      pan.setOffset({ x: (pan.x as any)._value || 0, y: (pan.y as any)._value || 0 }); 
      pan.setValue({ x: 0, y: 0 }); 
    },
    onPanResponderMove: RNAnimated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: () => {
      pan.flattenOffset();
      const snapX = (pan.x as any)._value < screenWidth / 2 ? 16 : screenWidth - 68;
      const snapY = Math.min(Math.max((pan.y as any)._value, 120), screenHeight - 200);
      RNAnimated.spring(pan, { toValue: { x: snapX, y: snapY }, useNativeDriver: false, friction: 6 }).start();
    },
  })).current;

  // Modals visibility
  const [cameraVisible, setCameraVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ qualityCode: string; qualityName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(text), 500);
  }, []);

  const query = useInfiniteQuery({
    queryKey: ['grey-materials', debouncedSearch, sortOrder, filterType],
    enabled: isAuthenticated,
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const params: any = { page: pageParam, limit: PAGE_SIZE, sortBy: 'createdAt', sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterType && filterType !== 'All') params.type = filterType;
      const { data } = await api.get('/api/grey-materials', { params });
      const items = data?.data || [];
      const pagination = data?.pagination || {};
      const totalPages = pagination.totalPages || pagination.pages || 1;
      return { items, hasNext: pageParam < totalPages, nextPage: pageParam + 1 };
    },
    getNextPageParam: (lastPage) => lastPage.hasNext ? lastPage.nextPage : undefined,
  });

  const rawMaterials = query.data?.pages.flatMap(p => p.items) || [];

  // Group raw materials by Quality Code & Name
  const groupedMaterials = useMemo(() => {
    const groups: GroupedGreyMaterial[] = [];
    const map = new Map<string, GroupedGreyMaterial>();

    for (const item of rawMaterials) {
      const key = `${(item.qualityCode || '').trim().toLowerCase()}_${(item.qualityName || '').trim().toLowerCase()}`;
      if (!map.has(key)) {
        const group: GroupedGreyMaterial = {
          qualityCode: item.qualityCode || '',
          qualityName: item.qualityName || '',
          type: item.type || '',
          images: item.images || [],
          items: []
        };
        map.set(key, group);
        groups.push(group);
      }
      map.get(key)!.items.push(item);
    }
    return groups;
  }, [rawMaterials]);

  const openCreateForm = () => {
    setEditingItem(null);
    setFormData({ qualityName: '', qualityCode: '', type: '' });
    setFormWeavers([{ name: '', piece: '', meter: '', challanNumber: '' }]);
    setFormImages([]);
    setShowForm(true);
  };

  const openEditForm = (item: GreyMaterial) => {
    setEditingItem(item);
    setFormData({
      qualityName: item.qualityName || '',
      qualityCode: item.qualityCode || '',
      type: item.type || '',
    });
    setFormWeavers([
      {
        name: item.weaver || '',
        piece: item.piece?.toString() || '',
        meter: item.meter?.toString() || '',
        challanNumber: item.challanNumber || ''
      }
    ]);
    setFormImages(item.images || []);
    setShowForm(true);
  };

  const addWeaver = () => {
    setFormWeavers(prev => [...prev, { name: '', piece: '', meter: '', challanNumber: '' }]);
  };

  const removeWeaver = (index: number) => {
    setFormWeavers(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateWeaver = (index: number, key: string, val: string) => {
    setFormWeavers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const pickImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Image picker is not available on this platform/device');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: true });
    if (!result.canceled && result.assets) {
      const uris = result.assets.map((a: any) => a.uri);
      setFormImages(prev => [...prev, ...uris]);
    }
  };

  const handleCameraCapture = (uris: string[]) => {
    setFormImages(prev => [...prev, ...uris]);
  };

  const uploadImages = async (localUris: string[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const uri of localUris) {
      try {
        const uploadedUrl = await uploadSingleImage(uri, 'grey-materials');
        uploadedUrls.push(uploadedUrl);
      } catch (err) {
        console.error('Error uploading image:', err);
      }
    }
    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!formData.qualityName.trim()) {
      addToast({ type: 'warning', title: 'Validation', message: 'Quality Name is required' });
      return;
    }
    if (!formData.qualityCode.trim()) {
      addToast({ type: 'warning', title: 'Validation', message: 'Quality Code is required' });
      return;
    }

    // Validate weavers
    for (let i = 0; i < formWeavers.length; i++) {
      if (!formWeavers[i].name.trim()) {
        addToast({ type: 'warning', title: 'Validation', message: `Weaver #${i + 1} Name is required` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const finalImages = await uploadImages(formImages);
      
      if (editingItem) {
        // Editing a single weaver document
        const payload = {
          qualityName: formData.qualityName.trim(),
          qualityCode: formData.qualityCode.trim(),
          type: formData.type.trim(),
          images: finalImages,
          weaver: formWeavers[0].name.trim(),
          piece: formWeavers[0].piece ? Number(formWeavers[0].piece) : undefined,
          meter: formWeavers[0].meter ? Number(formWeavers[0].meter) : undefined,
          challanNumber: formWeavers[0].challanNumber.trim()
        };
        await api.put(`/api/grey-materials/${editingItem._id}`, payload);

        // If extra weavers were added in edit mode, create them as new documents
        if (formWeavers.length > 1) {
          const createPayload = {
            qualityName: formData.qualityName.trim(),
            qualityCode: formData.qualityCode.trim(),
            type: formData.type.trim(),
            images: finalImages,
            weavers: formWeavers.slice(1).map(w => ({
              name: w.name.trim(),
              piece: w.piece ? Number(w.piece) : undefined,
              meter: w.meter ? Number(w.meter) : undefined,
              challanNumber: w.challanNumber.trim()
            }))
          };
          await api.post('/api/grey-materials', createPayload);
        }
        
        addToast({ type: 'success', title: 'Updated', message: 'Grey material updated' });
      } else {
        // Creating multiple weaver documents
        const payload = {
          qualityName: formData.qualityName.trim(),
          qualityCode: formData.qualityCode.trim(),
          type: formData.type.trim(),
          images: finalImages,
          weavers: formWeavers.map(w => ({
            name: w.name.trim(),
            piece: w.piece ? Number(w.piece) : undefined,
            meter: w.meter ? Number(w.meter) : undefined,
            challanNumber: w.challanNumber.trim()
          }))
        };
        await api.post('/api/grey-materials', payload);
        addToast({ type: 'success', title: 'Created', message: 'Grey material created' });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['grey-materials'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to save' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/grey-materials?qualityCode=${encodeURIComponent(deleteTarget.qualityCode)}&qualityName=${encodeURIComponent(deleteTarget.qualityName)}`);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({ type: 'success', title: 'Deleted', message: 'Grey material group deleted' });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['grey-materials'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to delete' });
    } finally { setDeleting(false); }
  };

  const handleOpenPreview = (imgs: string[]) => {
    setPreviewImages(imgs);
    setPreviewVisible(true);
  };

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterType !== 'All') c++;
    return c;
  }, [filterType]);

  if (!isInTabs) {
    return <Redirect href="/(tabs)/grey-materials" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {!isInTabs && (
        <Header 
          title="Stock" 
          showBack={false} 
          hideBorder={true}
          rightAction={
            <Boxes size={22} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
          } 
        />
      )}

      {/* Search & Filters Row */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: isInTabs ? 12 : 0 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}>
          <Search size={18} color={theme.textTertiary} />
          <TextInput placeholder="Search stock..." placeholderTextColor={theme.inputPlaceholder} value={search} onChangeText={handleSearch} style={{ flex: 1, marginLeft: 10, fontSize: 15, color: theme.text, paddingVertical: 0 }} />
          {search.length > 0 && <TouchableOpacity onPress={() => { setSearch(''); setDebouncedSearch(''); }}><X size={18} color={theme.textTertiary} /></TouchableOpacity>}
        </View>
        <TouchableOpacity 
          onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilterModal(true); }} 
          style={{ 
            width: 44, 
            height: 44, 
            borderRadius: 12, 
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: showFilterModal || filterType !== 'All' ? (isDarkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.08)') : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'), 
            borderWidth: 1, 
            borderColor: filterType !== 'All' ? (isDarkMode ? '#60a5fa' : '#2563eb') : (isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0') 
          }}
        >
          <SlidersHorizontal size={20} color={filterType !== 'All' ? (isDarkMode ? Colors.primary[400] : Colors.primary[600]) : theme.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary[600], alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{activeFilterCount}</Text>
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

      {/* Unified Count & Active Filters Row */}
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
              Showing <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{groupedMaterials.length}</Text> qualities
            </Text>
          ) : (
            <Text>
              Total Qualities: <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{groupedMaterials.length}</Text>
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
              gap: 4, 
              paddingHorizontal: 10, 
              paddingVertical: 5, 
              borderRadius: 10, 
              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5'
            }}
          >
            <RotateCcw size={12} color={Colors.error[500]} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.error[500] }}>Clear ({totalActiveFiltersCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {query.isLoading ? <GreyMaterialSkeletonList count={3} /> : groupedMaterials.length === 0 ? (
        <EmptyState icon={<Boxes size={48} color={Colors.primary[500]} />} title="No Grey Materials" subtitle={debouncedSearch || filterType !== 'All' ? 'No materials match your filters.' : 'No grey materials added yet.'} />
      ) : (
        <FlatList
          data={groupedMaterials}
          keyExtractor={(item, i) => `${item.qualityCode}_${item.qualityName}_${i}`}
          renderItem={({ item, index }) => (
            <GreyMaterialCard 
              group={item} 
              index={index} 
              onEdit={openEditForm} 
              onDelete={(qc, qn) => setDeleteTarget({ qualityCode: qc, qualityName: qn })} 
              isSuperAdmin={isSuperAdmin} 
              isMaster={isMaster}
              onPreviewImages={handleOpenPreview} 
            />
          )}
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
        <RNAnimated.View {...fabPanResponder.panHandlers} style={[{ position: 'absolute', zIndex: 100 }, { transform: pan.getTranslateTransform() }]}>
          <TouchableOpacity 
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openCreateForm(); }} 
            activeOpacity={0.85} 
            style={{ 
              width: 56, 
              height: 56, 
              borderRadius: 28, 
              backgroundColor: Colors.primary[600], 
              alignItems: 'center', 
              justifyContent: 'center', 
              elevation: 8, 
              shadowColor: Colors.primary[600], 
              shadowOffset: { width: 0, height: 4 }, 
              shadowOpacity: 0.3, 
              shadowRadius: 8,
            }}
          >
            <View style={{ position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={24} color="#ffffff" />
              <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary[600], borderRadius: 7, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
                <Plus size={9} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

      {/* Slide-Up Filter Modal */}
      <Modal visible={showFilterModal} animationType="none" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={closeFilter}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Pressable onPress={closeFilter} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <RNAnimated.View style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingTop: 12, paddingHorizontal: 24, paddingBottom: 24 + insets.bottom,
            transform: [{ translateY: filterPanY }], shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
          }}>
            {/* Drag Handle */}
            <View {...filterPanResponder.panHandlers} style={{ width: '100%', alignItems: 'center', paddingVertical: 12, marginBottom: 4, backgroundColor: 'transparent' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#d1d5db' }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Filter & Sort</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {(filterType !== 'All' || sortOrder !== 'desc') && (
                  <TouchableOpacity 
                    onPress={() => {
                      setFilterType('All');
                      setSortOrder('desc');
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                  >
                    <Text style={{ color: Colors.primary[600], fontWeight: '700', fontSize: 14 }}>Reset All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={closeFilter} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100], justifyContent: 'center', alignItems: 'center' }}>
                  <X size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sort Order Options */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary, marginBottom: 10 }}>Sort By</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              <TouchableOpacity 
                onPress={() => {
                  setSortOrder('desc');
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }} 
                style={{ 
                  flex: 1, 
                  paddingVertical: 12, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  backgroundColor: sortOrder === 'desc' ? (isDarkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.08)') : (isDarkMode ? '#0f172a' : '#f8fafc'), 
                  borderWidth: 1, 
                  borderColor: sortOrder === 'desc' ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.borderLight 
                }}
              >
                <Text style={{ color: sortOrder === 'desc' ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textSecondary, fontWeight: '700', fontSize: 14 }}>Newest first</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  setSortOrder('asc');
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }} 
                style={{ 
                  flex: 1, 
                  paddingVertical: 12, 
                  borderRadius: 12, 
                  alignItems: 'center', 
                  backgroundColor: sortOrder === 'asc' ? (isDarkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.08)') : (isDarkMode ? '#0f172a' : '#f8fafc'), 
                  borderWidth: 1, 
                  borderColor: sortOrder === 'asc' ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.borderLight 
                }}
              >
                <Text style={{ color: sortOrder === 'asc' ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textSecondary, fontWeight: '700', fontSize: 14 }}>Oldest first</Text>
              </TouchableOpacity>
            </View>

            {/* Type Filtering Options */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary, marginBottom: 10 }}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['All', 'Polyester', 'Blend', 'Viscose', 'Cotton', 'Rayon', 'Other'].map((t) => (
                <TouchableOpacity 
                  key={t} 
                  onPress={() => {
                    setFilterType(t);
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }} 
                  style={{ 
                    paddingHorizontal: 16, 
                    paddingVertical: 10, 
                    borderRadius: 10, 
                    backgroundColor: filterType === t ? (isDarkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.08)') : (isDarkMode ? '#0f172a' : '#f8fafc'), 
                    borderWidth: 1, 
                    borderColor: filterType === t ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.borderLight 
                  }}
                >
                  <Text style={{ color: filterType === t ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.textSecondary, fontWeight: '700', fontSize: 13 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal visible={showForm} animationType="none" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={closeForm}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Pressable onPress={closeForm} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <RNAnimated.View style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingTop: 12, paddingHorizontal: 24, paddingBottom: 24 + insets.bottom, height: '92%',
            transform: [{ translateY: formPanY }], shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
          }}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 130}
              style={{ flex: 1 }}
            >
              {/* Drag Handle */}
              <View {...formPanResponder.panHandlers} style={{ width: '100%', alignItems: 'center', paddingVertical: 12, marginBottom: 4, backgroundColor: 'transparent' }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#d1d5db' }} />
              </View>

              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text }}>{editingItem ? 'Edit Grey Material' : 'Add Grey Material'}</Text>
                <TouchableOpacity onPress={closeForm} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100], justifyContent: 'center', alignItems: 'center' }}>
                  <X size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 180 + insets.bottom }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {/* Quality details at the top */}
                <FormField
                  label="Quality Name *"
                  value={formData.qualityName}
                  onChangeText={(t: string) => setFormData(p => ({ ...p, qualityName: t }))}
                  placeholder="Enter quality name"
                  theme={theme}
                  isDarkMode={isDarkMode}
                />
                <FormField
                  label="Quality Code *"
                  value={formData.qualityCode}
                  onChangeText={(t: string) => setFormData(p => ({ ...p, qualityCode: t }))}
                  placeholder="Enter quality code"
                  theme={theme}
                  isDarkMode={isDarkMode}
                />
                <FormField
                  label="Type"
                  value={formData.type}
                  onChangeText={(t: string) => setFormData(p => ({ ...p, type: t }))}
                  placeholder="e.g., Polyester, Viscose, etc."
                  theme={theme}
                  isDarkMode={isDarkMode}
                />

                {/* Images section right after Type */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 }}>Images</Text>
                  
                  {/* Upload buttons row — same as fabrics / orders page */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
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
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Take Photo</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Thumbnail strip */}
                  {formImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {formImages.map((img, i) => (
                        <View key={i} style={{ position: 'relative' }}>
                          <TouchableOpacity 
                            activeOpacity={0.8}
                            onPress={() => handleOpenPreview([img])}
                          >
                            <Image source={{ uri: resolveImageUrl(img) }} style={{ width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }} resizeMode="cover" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setFormImages(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: -4, right: -4, backgroundColor: Colors.error[500], width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            <X size={12} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* Weavers Section */}
                <View style={{ borderTopWidth: 1, borderColor: theme.borderLight, paddingTop: 16, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>
                      Weavers ({formWeavers.length})
                    </Text>
                  </View>

                  {formWeavers.map((w, wIdx) => (
                    <View
                      key={wIdx}
                      style={{
                        marginBottom: 16,
                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                      }}
                    >
                      {/* Weaver Row Header */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primary[600] }}>#{wIdx + 1}</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Weaver Details</Text>
                        </View>
                        {formWeavers.length > 1 && (!editingItem || wIdx > 0) && (
                          <TouchableOpacity
                            onPress={() => removeWeaver(wIdx)}
                            style={{ padding: 6, borderRadius: 8, backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#fee2e2' }}
                          >
                            <Trash2 size={14} color={Colors.error[600]} />
                          </TouchableOpacity>
                        )}
                      </View>

                      <WeaverFormField
                        label="Weaver Name *"
                        value={formWeavers[wIdx]?.name || ''}
                        onChangeText={(t: string) => updateWeaver(wIdx, 'name', t)}
                        placeholder="Enter weaver name"
                        theme={theme}
                        isDarkMode={isDarkMode}
                      />
                      
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <WeaverFormField
                            label="Piece"
                            value={formWeavers[wIdx]?.piece || ''}
                            onChangeText={(t: string) => updateWeaver(wIdx, 'piece', t)}
                            placeholder="0"
                            keyboard="numeric"
                            theme={theme}
                            isDarkMode={isDarkMode}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <WeaverFormField
                            label="Meter"
                            value={formWeavers[wIdx]?.meter || ''}
                            onChangeText={(t: string) => updateWeaver(wIdx, 'meter', t)}
                            placeholder="0"
                            keyboard="numeric"
                            theme={theme}
                            isDarkMode={isDarkMode}
                          />
                        </View>
                      </View>

                      <WeaverFormField
                        label="Challan #"
                        value={formWeavers[wIdx]?.challanNumber || ''}
                        onChangeText={(t: string) => updateWeaver(wIdx, 'challanNumber', t)}
                        placeholder="Enter challan number"
                        theme={theme}
                        isDarkMode={isDarkMode}
                      />
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={addWeaver}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 12, 
                      borderRadius: 12,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: isDarkMode ? Colors.primary[400] : Colors.primary[600],
                      backgroundColor: isDarkMode ? 'rgba(59,130,246,0.06)' : 'rgba(37, 99, 235, 0.04)',
                      marginTop: 4,
                      marginBottom: 16
                    }}
                  >
                    <Plus size={16} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>Add Weaver</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 12 }}>
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
      <Modal visible={!!deleteTarget} animationType="fade" transparent statusBarTranslucent={true} navigationBarTranslucent={true} onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 12 }}>Delete Grey Material</Text>
            <Text style={{ fontSize: 15, color: theme.textSecondary, marginBottom: 24 }}>Are you sure you want to delete "{deleteTarget?.qualityName}"?</Text>
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
