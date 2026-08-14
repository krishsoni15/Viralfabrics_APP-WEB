import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, RefreshControl, Platform, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Alert, Pressable, PanResponder, Animated as RNAnimated, Dimensions, Keyboard, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { useSegments, Redirect } from 'expo-router';
import { Boxes, Search, X, ArrowUpDown, Plus, Image as ImageIcon, Trash2, Edit, Camera, User, WifiOff, SlidersHorizontal, RotateCcw, Tag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import PdfViewerModal from '../../components/shared/PdfViewerModal';
import { generateStickerPdf } from '../../utils/stickerPdf';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
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
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface GroupedGreyMaterial {
  qualityCode: string;
  qualityName: string;
  type: string;
  images: string[];
  items: GreyMaterial[];
}

const GreyMaterialCard = React.memo(function GreyMaterialCard({
  group, index, onEdit, onDelete, isSuperAdmin, isMaster, canAccessStickers, onPreviewImages, onOpenSticker,
  numColumns = 1,
}: { 
  group: GroupedGreyMaterial; 
  index: number; 
  onEdit: (g: GreyMaterial) => void; 
  onDelete: (qualityCode: string, qualityName: string) => void; 
  isSuperAdmin: boolean; 
  isMaster: boolean;
  canAccessStickers: boolean;
  onPreviewImages: (imgs: string[]) => void;
  onOpenSticker: (item: GreyMaterial, group: GroupedGreyMaterial) => void;
  numColumns?: number;
}) {
  const { theme, isDarkMode } = useTheme();
  const [expanded, setExpanded] = useState(false);

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
    <Animated.View style={{ flex: 1 }}>
      <View style={{
        marginHorizontal: numColumns && numColumns > 1 ? 8 : 16,
        marginBottom: 16,
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
        {allGroupImages.length > 0 && (
          <TouchableOpacity
            onPress={() => onPreviewImages(allGroupImages)}
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
              source={{ uri: resolveImageUrl(allGroupImages[0]) }} 
              style={{ width: '100%', height: 220 }} 
              contentFit="contain" 
              transition={100}
            />
            {allGroupImages.length > 1 && (
              <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}>
                <ImageIcon size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 5 }}>{allGroupImages.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Quality Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, letterSpacing: -0.2 }} numberOfLines={1}>
              {group.qualityName}
            </Text>
            {group.type ? (
              <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginTop: 2 }}>{group.type}</Text>
            ) : null}
          </View>
          
          {!!group.qualityCode && (
            <View style={{
              backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe'
            }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: Colors.primary[600], textTransform: 'uppercase', letterSpacing: 0.3 }}>
                QC: {group.qualityCode}
              </Text>
            </View>
          )}
        </View>

        {/* Weavers List Section */}
        <View style={{ borderTopWidth: 1, borderColor: theme.borderLight, paddingTop: 12, marginTop: 4, gap: 10 }}>
          {(expanded ? group.items : group.items.slice(0, 1)).map((item, idx) => (
            <View 
              key={item._id || idx} 
              style={{ 
                padding: 12, 
                borderRadius: 12,
                backgroundColor: isDarkMode ? 'rgba(0,0,0,0.15)' : '#f8fafc',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0',
                marginBottom: idx === group.items.length - 1 ? 0 : 10,
              }}
            >
              {/* Weaver Name and Date */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <User size={13} color={isDarkMode ? '#818cf8' : '#4f46e5'} />
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: theme.text }}>
                    {item.weaver || '—'}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '500' }}>
                  {formatDate(item.createdAt)}
                </Text>
              </View>

              {/* Weaver Info Table/Grid (instead of button-like Badges) */}
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                rowGap: 8,
                columnGap: 14,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
              }}>
                {item.piece != null && item.piece > 0 && (
                  <View style={{ minWidth: 70 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 }}>Pieces</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{item.piece} Pcs</Text>
                  </View>
                )}
                {item.meter != null && item.meter > 0 && (
                  <View style={{ minWidth: 70 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 }}>Meters</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{item.meter} Mtr</Text>
                  </View>
                )}
                {!!item.challanNumber && (
                  <View style={{ minWidth: 75 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 }}>Challan #</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }} numberOfLines={1}>{item.challanNumber}</Text>
                  </View>
                )}
                {item.gsm != null && String(item.gsm).trim() !== '' && (
                  <View style={{ minWidth: 60 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 }}>GSM</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{item.gsm}</Text>
                  </View>
                )}
                {item.greighWidth != null && item.greighWidth > 0 && (
                  <View style={{ minWidth: 70 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 }}>Width</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{item.greighWidth}"</Text>
                  </View>
                )}
                {item.greighRate != null && item.greighRate > 0 && (
                  <View style={{ minWidth: 60 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 }}>Rate</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>₹{item.greighRate}</Text>
                  </View>
                )}
                {!!item.rack && (
                  <View style={{ minWidth: 60 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 }}>Rack</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }} numberOfLines={1}>{item.rack}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}

          {group.items.length > 1 && (
            <TouchableOpacity
              onPress={() => setExpanded(!expanded)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary[600] }}>
                {expanded 
                  ? 'View Less Weavers' 
                  : `View More Weavers (+${group.items.length - 1})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Card Footer Actions */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
          <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '500' }}>
            Added {formatDate(group.items[0]?.createdAt)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {canAccessStickers && (
              <TouchableOpacity
                onPress={() => onOpenSticker(group.items[0], group)}
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
            )}
            {isSuperAdmin && (
              <TouchableOpacity
                onPress={() => onEdit(group.items[0])}
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
                onPress={() => onDelete(group.qualityCode, group.qualityName)}
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
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { isSuperAdmin, isMaster, canAccessStickers, user } = useAuth();
  const { isLargeScreen, modalMaxWidth, numColumns, containerMaxWidth } = useResponsiveLayout();
  const queryClient = useQueryClient();
  const addToast = useAppStore(s => s.addToast);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const isOffline = useAppStore(s => s.isOffline);
  const segments = useSegments();
  const isInTabs = (segments as string[]).includes('(tabs)');

  const [transitionsFinished, setTransitionsFinished] = useState(false);

  React.useEffect(() => {
    const run = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (cb: any) => setTimeout(cb, 1);
    const cancel = typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback : (id: any) => clearTimeout(id);
    const handle = run(() => {
      setTransitionsFinished(true);
    });
    return () => cancel(handle as any);
  }, []);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterType, setFilterType] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

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
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Form Pan and Gesture animation
  const formPanY = useRef(new RNAnimated.Value(0)).current;
  const filterScrollOffset = useRef(0);
  const formScrollOffset = useRef(0);
  const formSheetY = useRef(0);
  const filterSheetY = useRef(0);

  const closeForm = useCallback(() => {
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
      onPanResponderGrant: (_, gs) => {
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          formPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.5) {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          closeForm();
        } else {
          RNAnimated.spring(formPanY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 65,
            friction: 11
          }).start();
        }
      }
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
  }, [showForm, formPanY]);

  // Filter Modal Pan and Gesture animation
  const filterPanY = useRef(new RNAnimated.Value(600)).current;

  const closeFilter = useCallback(() => {
    if ((Platform.OS as string) !== 'web') {
      RNAnimated.timing(filterPanY, {
        toValue: 600,
        duration: 180,
        useNativeDriver: false
      }).start(() => setShowFilterModal(false));
    } else {
      setShowFilterModal(false);
    }
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
      onPanResponderGrant: (_, gs) => {
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          filterPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.5) {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          closeFilter();
        } else {
          RNAnimated.spring(filterPanY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 65,
            friction: 11
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
        useNativeDriver: false,
        damping: 15,
        stiffness: 120
      }).start();
    }
  }, [showFilterModal, filterPanY]);

  // Draggable FAB animation setup
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

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
    onPanResponderGrant: () => { 
      pan.setOffset({ x: fabX.current, y: fabY.current }); 
      pan.setValue({ x: 0, y: 0 }); 
    },
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

  // Modals visibility
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

  const openStickerPreview = useCallback(async (item: GreyMaterial, group: GroupedGreyMaterial) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const sanitizedQuality = (group.qualityName || 'Sticker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedWeaver = (item.weaver || 'Weaver').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Grey_Sticker_${sanitizedQuality}_${sanitizedWeaver}.pdf`;

    try {
      const remarksParts = [];
      if (item.weaver) remarksParts.push(`Weaver: ${item.weaver}`);
      if (item.challanNumber) remarksParts.push(`Challan: ${item.challanNumber}`);
      if (item.piece) remarksParts.push(`Pcs: ${item.piece}`);
      if (item.meter) remarksParts.push(`Mtr: ${item.meter}`);
      const remarksStr = remarksParts.join(' | ');

      const { uri, base64 } = await generateStickerPdf({
        type: 'grey',
        qualityCode: item.qualityCode || '',
        qualityName: group.qualityName || '',
        weaverName: item.weaver || '',
        width: item.greighWidth != null ? Number(item.greighWidth) : undefined,
        gsm: item.gsm != null ? Number(item.gsm) : undefined,
        content: item.content || '',
        remarks: remarksStr,
      }, filename);

      setPdfViewerLocalUri(uri);
      setPdfViewerLocalBase64(base64);
      setPdfViewerUrl('');
      setPdfViewerTitle(`Grey Sticker — ${group.qualityName || 'Sticker'}`);
      setPdfViewerFilename(filename);
      setPdfViewerVisible(true);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to generate sticker', message: String(err) });
    }
  }, []);

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
    staleTime: 30000,
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const params: any = { page: pageParam, limit: PAGE_SIZE, sortBy: 'createdAt', sortOrder };
        if (debouncedSearch) params.search = debouncedSearch;
        if (filterType && filterType !== 'All') params.type = filterType;
        const { data } = await api.get('/api/grey-materials', { params });
        const items = data?.data || data?.greyMaterials || data?.items || (Array.isArray(data) ? data : []);
        const pagination = data?.pagination || {};
        const totalPages = pagination.totalPages || pagination.pages || 1;
        return { items, hasNext: pageParam < totalPages, nextPage: pageParam + 1, totalCount: pagination.totalCount || pagination.total || items.length };
      } catch (e) {
        return { items: [], hasNext: false, nextPage: 1 };
      }
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, width: '100%', maxWidth: containerMaxWidth, alignSelf: 'center' }}>
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

      {/* Content */}
      {(!transitionsFinished || query.isLoading) ? <GreyMaterialSkeletonList count={3} /> : groupedMaterials.length === 0 ? (
        <EmptyState icon={<Boxes size={48} color={Colors.primary[500]} />} title="No Grey Materials" subtitle={debouncedSearch || filterType !== 'All' ? 'No materials match your filters.' : 'No grey materials added yet.'} />
      ) : (
        <FlashList
          data={groupedMaterials}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item, i) => `${item.qualityCode}_${item.qualityName}_${i}`}
          drawDistance={800}
          ListHeaderComponent={() => {
            const isFiltered = debouncedSearch.trim() !== '' || filterType !== 'All';
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
              </View>
            );
          }}
          renderItem={({ item, index }) => (
            <GreyMaterialCard 
              group={item} 
              index={index} 
              onEdit={openEditForm} 
              onDelete={(qc, qn) => setDeleteTarget({ qualityCode: qc, qualityName: qn })} 
              isSuperAdmin={isSuperAdmin} 
              isMaster={isMaster}
              canAccessStickers={canAccessStickers}
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
            ) : (!query.hasNextPage && groupedMaterials.length > 0) ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
                  No more grey materials to load
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
            zIndex: 100,
          }}
        >
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
      </View>

      {/* Slide-Up Filter Modal */}
      <Modal visible={showFilterModal} animationType="none" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={closeFilter}>

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
            <Pressable onPress={closeFilter} style={{ flex: 1 }} />
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
              paddingBottom: isLargeScreen ? 24 : (insets.bottom > 0 ? insets.bottom + 16 : 32),
              width: '100%',
              maxWidth: isLargeScreen ? modalMaxWidth : '100%',
              transform: [{ translateY: filterPanY }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            {/* Drag Handle */}
            <View style={{ width: '100%', alignItems: 'center', paddingVertical: 12, marginBottom: 4, backgroundColor: 'transparent' }}>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 }}>
              <FilterPill
                label="Newest first"
                selected={sortOrder === 'desc'}
                onPress={() => setSortOrder('desc')}
              />
              <FilterPill
                label="Oldest first"
                selected={sortOrder === 'asc'}
                onPress={() => setSortOrder('asc')}
              />
            </View>

            {/* Type Filtering Options */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary, marginBottom: 10 }}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {['All', 'Polyester', 'Blend', 'Viscose', 'Cotton', 'Rayon', 'Other'].map((t) => (
                <FilterPill
                  key={t}
                  label={t === 'All' ? 'All Types' : t}
                  selected={filterType === t}
                  onPress={() => setFilterType(t)}
                />
              ))}
            </View>

            {/* Apply Button */}
            <View style={{ marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  closeFilter();
                }}
                activeOpacity={0.8}
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: Colors.primary[600],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal visible={showForm} animationType={isLargeScreen ? 'fade' : 'slide'} transparent statusBarTranslucent navigationBarTranslucent onRequestClose={closeForm}>

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
              height: isLargeScreen ? '85%' : '92%',
              width: '100%',
              maxWidth: isLargeScreen ? 850 : '100%',
              transform: isLargeScreen ? undefined : [{ translateY: formPanY }],
              shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 120}
              style={{ flex: 1 }}
            >
              {/* Drag Handle */}
              <View style={{ width: '100%', alignItems: 'center', paddingVertical: 12, marginBottom: 4, backgroundColor: 'transparent' }}>
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
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 220 : 220 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                onScroll={(e) => { formScrollOffset.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
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
                            <Image source={{ uri: resolveImageUrl(img) }} style={{ width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }} contentFit="cover" transition={100} />
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 24 }}>
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


