import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Platform, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, ScrollView, KeyboardAvoidingView, Alert, Pressable, PanResponder, Animated as RNAnimated, Dimensions, Linking, Keyboard, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { BookOpen, Search, Sparkles, X, ArrowUpDown, Plus, Image as ImageIcon, Edit, Trash2, Camera, ChevronDown, ChevronUp, SlidersHorizontal, RotateCcw, Tag, Printer, Package, WifiOff } from 'lucide-react-native';
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
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { SkeletonList, FabricSkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ImagePreviewModal from '../../components/shared/ImagePreviewModal';
import CustomCameraModal from '../../components/shared/CustomCameraModal';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { Fabric } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { formatDate, resolveImageUrl, uploadSingleImage } from '../../utils/helpers';
import { CONFIG } from '../../constants/config';
import { storage } from '../../utils/storage';

const PAGE_SIZE = 5;

const FabricsProgressBar = () => {
  const { isDarkMode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const translateX = useSharedValue(-150);

  React.useEffect(() => {
    translateX.value = -150;
    translateX.value = withRepeat(
      withTiming(screenWidth, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [screenWidth]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={{
      width: '100%',
      height: 3,
      backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0',
      overflow: 'hidden',
    }}>
      <Animated.View
        style={[
          {
            width: 150,
            height: '100%',
            backgroundColor: Colors.primary[500],
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};

const fabricTypes = ['All', 'Polyester', 'Blend', 'Viscose', 'Cotton', 'Rayon', 'Other'];

const searchTypeLabels: Record<string, string> = {
  all: 'All',
  qualityCode: 'Code',
  qualityName: 'Quality',
  type: 'Type',
  weaver: 'Weaver',
  weaverQualityName: 'WQ',
};

const searchTypeFullLabels: Record<string, string> = {
  all: 'All Fields',
  qualityCode: 'Quality Code',
  qualityName: 'Quality Name',
  type: 'Fabric Type',
  weaver: 'Weaver Name',
  weaverQualityName: 'Weaver Quality',
};

const searchTypePlaceholders: Record<string, string> = {
  all: 'Search fabrics...',
  qualityCode: 'Search by quality code...',
  qualityName: 'Search by quality name...',
  type: 'Search by type...',
  weaver: 'Search by weaver name...',
  weaverQualityName: 'Search by weaver quality...',
};

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
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 18,
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
          fontSize: 12,
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

export interface GroupedFabric {
  qualityCode: string;
  qualityName: string;
  type: string;
  images: string[];
  items: Fabric[];
}

const GroupedFabricCard = React.memo(function GroupedFabricCard({
  group, index, onEdit, onDeleteWeaver, onDeleteGroup, isSuperAdmin, isMaster, onPreviewImages, isExpanded, onToggleExpand, onOpenSticker,
  numColumns = 1,
}: {
  group: GroupedFabric;
  index: number;
  onEdit: (f: Fabric) => void;
  onDeleteWeaver: (f: Fabric) => void;
  onDeleteGroup: (qualityCode: string, qualityName: string) => void;
  isSuperAdmin: boolean;
  isMaster: boolean;
  onPreviewImages: (imgs: string[]) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenSticker: (weaver: Fabric, group: GroupedFabric) => void;
  numColumns?: number;
}) {
  const { theme, isDarkMode } = useTheme();
  const mainFabric = group.items[0];
  const itemsToShow = isExpanded ? group.items : [mainFabric];

  const gridCell = (label: string, value: string, color: string, hasDivider?: boolean) => (
    <View style={{ 
      flex: 1, 
      paddingVertical: 8, 
      paddingHorizontal: 8,
      borderRightWidth: hasDivider ? 1 : 0,
      borderRightColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '800', color: color }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Card
        style={{
          marginHorizontal: numColumns && numColumns > 1 ? 6 : 12,
          marginBottom: 14,
          flex: 1,
          borderWidth: 1,
          borderColor: theme.borderLight,
          backgroundColor: theme.card,
          borderRadius: 16,
          padding: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDarkMode ? 0.12 : 0.04,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        {/* Clickable Image Preview */}
        {group.images && group.images.length > 0 && (
          <TouchableOpacity
            onPress={() => onPreviewImages(group.images || [])}
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
              source={{ uri: resolveImageUrl(group.images[0]) }}
              style={{ width: '100%', height: 220 }}
              resizeMode="contain"
              resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
              fadeDuration={100}
            />
            {group.images.length > 1 && (
              <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}>
                <ImageIcon size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 5 }}>{group.images.length}</Text>
              </View>
            )}
            <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(79,70,229,0.9)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                {group.items.length} Weaver{group.items.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Header: Quality Name + QC & Type Badges aligned horizontally */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3, flex: 1, marginRight: 8 }} numberOfLines={1}>
            {group.qualityName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{
              backgroundColor: isDarkMode ? 'rgba(59,130,246,0.12)' : '#eff6ff',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(59,130,246,0.25)' : '#bfdbfe'
            }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: Colors.primary[600], textTransform: 'uppercase', letterSpacing: 0.3 }}>
                QC: {group.qualityCode}
              </Text>
            </View>
            {!!group.type && (
              <View style={{
                backgroundColor: isDarkMode ? 'rgba(249,115,22,0.12)' : '#fff7ed',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(249,115,22,0.25)' : '#ffedd5'
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#f97316' : '#ea580c' }}>
                  {group.type}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Weavers List Header */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, marginTop: 4, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Weavers ({group.items.length})
        </Text>

        {itemsToShow.map((w, idx) => {
          const countDanierVal = w.count && w.danier 
            ? `${w.count}/${w.danier}` 
            : w.count || w.danier || '-';
          const hasReed = w.reed !== undefined && w.reed !== null && w.reed !== '';
          const hasPick = w.pick !== undefined && w.pick !== null && w.pick !== '';
          const reedPickVal = hasReed || hasPick
            ? `${w.reed ?? '-'}/${w.pick ?? '-'}`
            : '-';

          const hasWeight = w.weight !== undefined && w.weight !== null && Number(w.weight) > 0;
          const hasGreighWidth = w.greighWidth !== undefined && w.greighWidth !== null && Number(w.greighWidth) > 0;
          const hasFinishWidth = w.finishWidth !== undefined && w.finishWidth !== null && Number(w.finishWidth) > 0;
          const hasGsm = w.gsm !== undefined && w.gsm !== null && Number(w.gsm) > 0;

          return (
            <View
              key={w._id || idx.toString()}
              style={{
                backgroundColor: isDarkMode ? 'rgba(30,41,59,0.4)' : '#f8fafc',
                borderRadius: 12,
                padding: 10,
                marginBottom: idx === itemsToShow.length - 1 ? 0 : 8,
                borderWidth: 1,
                borderColor: theme.borderLight,
                borderLeftWidth: 3,
                borderLeftColor: Colors.primary[600],
              }}
            >
              {/* Sub-card Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: isDarkMode ? 'rgba(59,130,246,0.18)' : '#eff6ff', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.primary[600] }}>#{idx + 1}</Text>
                  </View>
                  <View style={{ flexDirection: 'column' }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Weaver</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, maxWidth: 140 }} numberOfLines={1}>
                      {w.weaver}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{
                    backgroundColor: isDarkMode ? 'rgba(16,185,129,0.12)' : '#ecfdf5',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(16,185,129,0.25)' : '#a7f3d0',
                    alignItems: 'center',
                    minWidth: 52
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: isDarkMode ? '#34d399' : '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>RATE</Text>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: isDarkMode ? '#34d399' : '#059669' }}>
                      {w.greighRate != null && Number(w.greighRate) > 0 ? `₹${w.greighRate}` : '-'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onOpenSticker(w, group)}
                    style={{ padding: 8, borderRadius: 8, backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.15)' : '#f5f3ff' }}
                  >
                    <Tag size={14} color={isDarkMode ? '#a78bfa' : '#7c3aed'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Unified Spec Sheet Table Grid */}
              <View style={{
                backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                padding: 4,
                marginTop: 6
              }}>
                {/* Row 1 */}
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  {gridCell("GSM", hasGsm ? String(w.gsm) : '-', '#db2777', true)}
                  {gridCell("Greigh W.", hasGreighWidth ? `${w.greighWidth}"` : '-', isDarkMode ? '#34d399' : '#059669', true)}
                  {gridCell("Finish W.", hasFinishWidth ? `${w.finishWidth}"` : '-', isDarkMode ? '#2dd4bf' : '#0d9488')}
                </View>
                {/* Row 2 */}
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  {gridCell("Weight", hasWeight ? `${w.weight} KG` : '-', isDarkMode ? '#fbbf24' : '#d97706', true)}
                  {gridCell("Count/Dan", countDanierVal, isDarkMode ? '#facc15' : '#ca8a04', true)}
                  {gridCell("Reed/Pick", reedPickVal, isDarkMode ? '#38bdf8' : '#0284c7')}
                </View>
                {/* Row 3 */}
                <View style={{ flexDirection: 'row' }}>
                  {gridCell("WQ Name", w.weaverQualityName || '-', isDarkMode ? '#c084fc' : '#7c3aed', true)}
                  {gridCell("Rack", w.rack || '-', isDarkMode ? '#22d3ee' : '#0891b2', true)}
                  {gridCell("Content", w.content || '-', isDarkMode ? '#818cf8' : '#4f46e5')}
                </View>
              </View>
            </View>
          );
        })}

        {/* Toggle Expand Button */}
        {group.items.length > 1 && (
          <TouchableOpacity
            onPress={onToggleExpand}
            activeOpacity={0.7}
            style={{
              marginTop: 6,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: isDarkMode ? '#475569' : '#cbd5e1',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>
              {isExpanded ? 'Show Less' : `+${group.items.length - 1} More`}
            </Text>
            {isExpanded ? (
              <ChevronUp size={14} color={theme.textSecondary} />
            ) : (
              <ChevronDown size={14} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        )}

        {/* Card Footer Actions */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
          <Text style={{ fontSize: 12, color: theme.textTertiary, fontWeight: '500' }}>
            {formatDate(mainFabric.createdAt)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {isSuperAdmin && (
              <TouchableOpacity
                onPress={() => onEdit(mainFabric)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(59,130,246,0.3)' : '#bfdbfe',
                  backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff',
                }}
              >
                <Edit size={14} color={Colors.primary[600]} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary[600] }}>Edit</Text>
              </TouchableOpacity>
            )}
            {isMaster && (
              <TouchableOpacity
                onPress={() => onDeleteGroup(group.qualityCode, group.qualityName)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(239,68,68,0.3)' : '#fca5a5',
                  backgroundColor: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                }}
              >
                <Trash2 size={14} color={Colors.error[600]} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.error[600] }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    </View>
  );
});

export default function FabricsScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { theme, isDarkMode } = useTheme();
  const { isSuperAdmin, isMaster } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isLargeScreen, modalMaxWidth, numColumns, containerMaxWidth } = useResponsiveLayout();
  const user = useAppStore((state) => state.user);
  const addToast = useAppStore((state) => state.addToast);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const isOffline = useAppStore((state) => state.isOffline);

  // 1. State declarations
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'qualityCode' | 'qualityName' | 'type' | 'weaver' | 'weaverQualityName'>('all');
  const [showSearchTypeModal, setShowSearchTypeModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFabric, setEditingFabric] = useState<Fabric | null>(null);
  // Multi-weaver form: shared quality info + repeatable weaver cards
  const [formQuality, setFormQuality] = useState({ qualityName: '', qualityCode: '', type: '' });
  const [formWeavers, setFormWeavers] = useState<Array<{
    weaver: string; weaverQualityName: string; rack: string;
    greighWidth: string; finishWidth: string; weight: string; gsm: string;
    content: string; danier: string; count: string; reed: string; pick: string;
    greighRate: string; label: string;
  }>>([{
    weaver: '', weaverQualityName: '', rack: '',
    greighWidth: '', finishWidth: '', weight: '', gsm: '',
    content: '', danier: '', count: '', reed: '', pick: '',
    greighRate: '', label: ''
  }]);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Fabric | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ qualityCode: string; qualityName: string } | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedStickerWeaver, setSelectedStickerWeaver] = useState<any>(null);
  const [selectedStickerGroup, setSelectedStickerGroup] = useState<any>(null);

  // 2. Ref declarations
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterPanY = useRef(new RNAnimated.Value(600)).current;
  const searchTypePanY = useRef(new RNAnimated.Value(600)).current;
  const formPanY = useRef(new RNAnimated.Value(800)).current;
  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 68, y: screenHeight - 170 })).current;
  const fabX = useRef(screenWidth - 68);
  const fabY = useRef(screenHeight - 170);

  const dimensionsRef = useRef({ screenWidth, screenHeight });
  dimensionsRef.current = { screenWidth, screenHeight };

  React.useEffect(() => {
    const isSnappedLeft = fabX.current < screenWidth / 2;
    const targetX = isSnappedLeft ? 20 : screenWidth - 68;
    const targetY = Math.min(Math.max(fabY.current, 100), screenHeight - 170);
    
    fabX.current = targetX;
    fabY.current = targetY;
    
    RNAnimated.spring(pan, {
      toValue: { x: targetX, y: targetY },
      useNativeDriver: false,
      tension: 40,
      friction: 12,
    }).start();
  }, [screenWidth, screenHeight]);

  const filterScrollOffset = useRef(0);
  const filterCapturedDy = useRef(0);
  const filterSheetY = useRef(0);
  const filterTouchStartPageY = useRef(0);
  const searchTypeScrollOffset = useRef(0);
  const searchTypeCapturedDy = useRef(0);
  const searchTypeSheetY = useRef(0);
  const searchTypeTouchStartPageY = useRef(0);
  const formScrollOffset = useRef(0);
  const formCapturedDy = useRef(0);
  const formSheetY = useRef(0);
  const formTouchStartPageY = useRef(0);

  // 3. Callback & Helper Function declarations
  const closeFilterModal = useCallback(() => {
    RNAnimated.timing(filterPanY, {
      toValue: 600,
      duration: 160,
      useNativeDriver: false,
    }).start(() => {
      setShowFilterModal(false);
    });
  }, [filterPanY]);

  const closeSearchTypeModal = useCallback(() => {
    RNAnimated.timing(searchTypePanY, {
      toValue: 600,
      duration: 160,
      useNativeDriver: false,
    }).start(() => {
      setShowSearchTypeModal(false);
    });
  }, [searchTypePanY]);

  const closeForm = useCallback(() => {
    RNAnimated.timing(formPanY, {
      toValue: 800,
      duration: 180,
      useNativeDriver: false,
    }).start(() => {
      setShowForm(false);
    });
  }, [formPanY]);

  const clearAllFilters = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSearch('');
    setDebouncedSearch('');
    setSearchType('all');
    setSortOrder('desc');
    setTypeFilter('All');
  }, []);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 500);
  }, []);

  const emptyWeaver = () => ({
    weaver: '', weaverQualityName: '', rack: '',
    greighWidth: '', finishWidth: '', weight: '', gsm: '',
    content: '', danier: '', count: '', reed: '', pick: '',
    greighRate: '', label: ''
  });

  const openCreateForm = useCallback(() => {
    setEditingFabric(null);
    setFormQuality({ qualityName: '', qualityCode: '', type: '' });
    setFormWeavers([emptyWeaver()]);
    setFormImages([]);
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((item: Fabric) => {
    setEditingFabric(item);
    setFormQuality({
      qualityName: item.qualityName || '', qualityCode: item.qualityCode || '', type: item.type || ''
    });
    setFormWeavers([{
      weaver: item.weaver || '', weaverQualityName: item.weaverQualityName || '', rack: item.rack || '',
      greighWidth: item.greighWidth?.toString() || '', finishWidth: item.finishWidth?.toString() || '',
      weight: item.weight?.toString() || '', gsm: item.gsm?.toString() || '', content: item.content || '',
      danier: item.danier || '', count: item.count?.toString() || '', reed: item.reed?.toString() || '', pick: item.pick?.toString() || '',
      greighRate: item.greighRate?.toString() || '', label: item.label || ''
    }]);
    setFormImages(item.images || []);
    setShowForm(true);
  }, []);

  const addWeaver = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormWeavers(prev => [...prev, emptyWeaver()]);
  }, []);

  const removeWeaver = useCallback((idx: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFormWeavers(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateWeaver = useCallback((idx: number, key: string, value: string) => {
    setFormWeavers(prev => prev.map((w, i) => i === idx ? { ...w, [key]: value } : w));
  }, []);

  const pickImage = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Image picker is not available on this platform/device');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true
    });
    if (!result.canceled && result.assets) {
      setFormImages(prev => [...prev, ...result.assets.map((a: any) => a.uri)]);
    }
  }, []);

  const handleCameraCapture = useCallback((uris: string[]) => {
    setFormImages(prev => [...prev, ...uris]);
  }, []);

  const uploadImages = useCallback(async (localUris: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of localUris) {
      try {
        const uploadedUrl = await uploadSingleImage(uri, 'fabrics');
        urls.push(uploadedUrl);
      } catch (err) {
        console.error('Error uploading image:', err);
      }
    }
    return urls;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formQuality.qualityName.trim()) {
      addToast({ type: 'error', title: 'Validation', message: 'Quality name is required' });
      return;
    }
    if (!formQuality.qualityCode.trim()) {
      addToast({ type: 'error', title: 'Validation', message: 'Quality code is required' });
      return;
    }
    // Validate at least one weaver has a name
    const validWeavers = formWeavers.filter(w => w.weaver.trim());
    if (validWeavers.length === 0) {
      addToast({ type: 'error', title: 'Validation', message: 'At least one weaver name is required' });
      return;
    }
    setSubmitting(true);
    try {
      const imageUrls = await uploadImages(formImages);

      if (editingFabric) {
        // Edit mode: update single fabric
        const w = formWeavers[0];
        const payload = {
          qualityName: formQuality.qualityName.trim(),
          qualityCode: formQuality.qualityCode.trim(),
          type: formQuality.type.trim(),
          weaver: w.weaver.trim(),
          weaverQualityName: w.weaverQualityName.trim(),
          rack: w.rack.trim(),
          greighWidth: w.greighWidth ? Number(w.greighWidth) : 0,
          finishWidth: w.finishWidth ? Number(w.finishWidth) : 0,
          weight: w.weight ? Number(w.weight) : 0,
          gsm: w.gsm ? Number(w.gsm) : 0,
          content: w.content.trim(),
          danier: w.danier.trim(),
          count: w.count ? Number(w.count) : 0,
          reed: w.reed ? Number(w.reed) : 0,
          pick: w.pick ? Number(w.pick) : 0,
          greighRate: w.greighRate ? Number(w.greighRate) : 0,
          label: w.label.trim(),
          images: imageUrls
        };
        await api.put(`/api/fabrics/${editingFabric._id}`, payload);
        addToast({ type: 'success', title: 'Updated', message: 'Fabric quality updated successfully' });
      } else {
        // Create mode: send array of fabrics (one per weaver)
        const fabricsPayload = validWeavers.map(w => ({
          qualityName: formQuality.qualityName.trim(),
          qualityCode: formQuality.qualityCode.trim(),
          type: formQuality.type.trim(),
          weaver: w.weaver.trim(),
          weaverQualityName: w.weaverQualityName.trim(),
          rack: w.rack.trim(),
          greighWidth: w.greighWidth ? Number(w.greighWidth) : 0,
          finishWidth: w.finishWidth ? Number(w.finishWidth) : 0,
          weight: w.weight ? Number(w.weight) : 0,
          gsm: w.gsm ? Number(w.gsm) : 0,
          content: w.content.trim(),
          danier: w.danier.trim(),
          count: w.count ? Number(w.count) : 0,
          reed: w.reed ? Number(w.reed) : 0,
          pick: w.pick ? Number(w.pick) : 0,
          greighRate: w.greighRate ? Number(w.greighRate) : 0,
          label: w.label.trim(),
          images: imageUrls
        }));
        await api.post('/api/fabrics', fabricsPayload);
        addToast({ type: 'success', title: 'Created', message: `${fabricsPayload.length} fabric weaver(s) created successfully` });
      }

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['fabrics'] });
      queryClient.invalidateQueries({ queryKey: ['fabrics-unfiltered-count'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to save fabric' });
    } finally {
      setSubmitting(false);
    }
  }, [formQuality, formWeavers, formImages, editingFabric, uploadImages, closeForm, queryClient, addToast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/fabrics/${deleteTarget._id}`);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({ type: 'success', title: 'Deleted', message: 'Fabric quality deleted successfully' });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['fabrics'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to delete fabric' });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, addToast, queryClient]);

  const handleDeleteGroup = useCallback(async () => {
    if (!deleteGroupTarget) return;
    setDeletingGroup(true);
    try {
      await api.delete(`/api/fabrics?qualityCode=${encodeURIComponent(deleteGroupTarget.qualityCode)}&qualityName=${encodeURIComponent(deleteGroupTarget.qualityName)}`);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({ type: 'success', title: 'Deleted', message: 'Fabric group deleted successfully' });
      setDeleteGroupTarget(null);
      queryClient.invalidateQueries({ queryKey: ['fabrics'] });
      queryClient.invalidateQueries({ queryKey: ['fabrics-unfiltered-count'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err?.response?.data?.message || 'Failed to delete group' });
    } finally {
      setDeletingGroup(false);
    }
  }, [deleteGroupTarget, addToast, queryClient]);

  const handleOpenPreview = useCallback((imgs: string[], index: number = 0) => {
    setPreviewImages(imgs);
    setPreviewImageIndex(index);
    setPreviewVisible(true);
  }, []);

  const openStickerPreview = useCallback(async (weaverData: any, groupData: any) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStickerWeaver(weaverData);
    setSelectedStickerGroup(groupData);

    const rxPVal = weaverData.reed && weaverData.pick ? `${weaverData.reed}/${weaverData.pick}` : '';
    const countVal = weaverData.count ? String(weaverData.count) : (weaverData.danier || '');

    const sanitizedQuality = (groupData.qualityName || 'Sticker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedWeaver = (weaverData.weaver || 'Weaver').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Sticker_${sanitizedQuality}_${sanitizedWeaver}.pdf`;

    try {
      const { uri, base64 } = await generateStickerPdf({
        type: 'fabric',
        qualityCode: groupData.qualityCode || '',
        qualityName: groupData.qualityName || '',
        weaverName: weaverData.weaver || '',
        width: weaverData.finishWidth ? Number(weaverData.finishWidth) : undefined,
        gsm: weaverData.gsm ? Number(weaverData.gsm) : undefined,
        content: weaverData.content || '',
        count: countVal || undefined,
        rxP: rxPVal || undefined,
        danier: weaverData.danier || undefined,
        moq: weaverData.moq ? String(weaverData.moq) : undefined,
        remarks: weaverData.remarks || '',
      }, filename);

      setPdfViewerLocalUri(uri);
      setPdfViewerLocalBase64(base64);
      setPdfViewerUrl('');
      setPdfViewerTitle(`Fabric Sticker — ${groupData.qualityName || 'Sticker'}`);
      setPdfViewerFilename(filename);
      setPdfViewerVisible(true);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to generate sticker', message: String(err) });
    }
  }, []);

  // PDF Viewer Modal state
  const [pdfViewerVisible, setPdfViewerVisible] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState('');
  const [pdfViewerTitle, setPdfViewerTitle] = useState('');
  const [pdfViewerFilename, setPdfViewerFilename] = useState('');
  const [pdfViewerLocalUri, setPdfViewerLocalUri] = useState<string | undefined>();
  const [pdfViewerLocalBase64, setPdfViewerLocalBase64] = useState<string | undefined>();




  const toggleCardExpand = useCallback((key: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleSort = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  }, []);

  // 4. PanResponder declarations
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

  const searchTypePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        searchTypeTouchStartPageY.current = pageY;
        return pageY < searchTypeSheetY.current + 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return searchTypeScrollOffset.current <= 5 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return searchTypeScrollOffset.current <= 5 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          searchTypePanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (evt, gs) => {
        const isBackdropTouch = searchTypeTouchStartPageY.current < searchTypeSheetY.current;
        if (isBackdropTouch && Math.abs(gs.dy) < 10 && Math.abs(gs.dx) < 10) {
          closeSearchTypeModal();
          return;
        }

        if (gs.dy > 50 || gs.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeSearchTypeModal();
        } else {
          RNAnimated.spring(searchTypePanY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 40,
            friction: 9,
          }).start();
        }
      },
    })
  ).current;

  const formPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        formTouchStartPageY.current = pageY;
        return pageY < formSheetY.current + 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return formScrollOffset.current <= 5 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return formScrollOffset.current <= 5 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onPanResponderGrant: () => {
        Keyboard.dismiss();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          formPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (evt, gs) => {
        const isBackdropTouch = formTouchStartPageY.current < formSheetY.current;
        if (isBackdropTouch && Math.abs(gs.dy) < 10 && Math.abs(gs.dx) < 10) {
          closeForm();
          return;
        }

        if (gs.dy > 50 || gs.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeForm();
        } else {
          RNAnimated.spring(formPanY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 40,
            friction: 9,
          }).start();
        }
      },
    })
  ).current;

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

        const snapLeftX = 20;
        const snapRightX = currentScreenWidth - 68;
        const targetX = currentX < currentScreenWidth / 2 ? snapLeftX : snapRightX;

        const minY = 100;
        const maxY = currentScreenHeight - 110;
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

  // 5. Effects
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

  React.useEffect(() => {
    if (showSearchTypeModal) {
      searchTypePanY.setValue(600);
      RNAnimated.timing(searchTypePanY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    }
  }, [showSearchTypeModal]);

  React.useEffect(() => {
    if (showForm) {
      formPanY.setValue(800);
      RNAnimated.timing(formPanY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    }
  }, [showForm]);

  // 6. Queries and computations
  const unfilteredQuery = useQuery({
    queryKey: ['fabrics-unfiltered-count'],
    queryFn: async () => {
      const { data } = await api.get('/api/fabrics', { params: { page: 1, limit: 1 } });
      const pagination = data?.pagination || {};
      return pagination.totalCount || 0;
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sortOrder !== 'desc') count++;
    if (typeFilter !== 'All') count++;
    return count;
  }, [sortOrder, typeFilter]);

  const totalActiveFiltersCount = useMemo(() => {
    let count = activeFilterCount;
    if (debouncedSearch.trim() !== '') count++;
    return count;
  }, [activeFilterCount, debouncedSearch]);

  const fabricsQuery = useInfiniteQuery({
    queryKey: ['fabrics', debouncedSearch, sortOrder, searchType, typeFilter],
    enabled: isAuthenticated,
    initialPageParam: 1,
    staleTime: 30000,
    queryFn: async ({ pageParam = 1 }) => {
      const params: any = { page: pageParam, limit: PAGE_SIZE, sortBy: 'createdAt', sortOrder };
      
      if (debouncedSearch) {
        if (searchType === 'all') {
          params.search = debouncedSearch;
        } else {
          params[searchType] = debouncedSearch;
        }
      }
      
      if (typeFilter && typeFilter !== 'All') {
        params.type = typeFilter;
      }
      
      const { data } = await api.get('/api/fabrics', { params });
      const items = Array.isArray(data) ? data : data?.data || [];
      const pagination = data?.pagination || {};
      return { 
        items, 
        hasNext: pagination.hasNextPage || items.length >= PAGE_SIZE, 
        nextPage: pageParam + 1,
        totalCount: pagination.totalCount || items.length
      };
    },
    getNextPageParam: (lastPage) => lastPage.hasNext ? lastPage.nextPage : undefined,
  });

  const fabrics = fabricsQuery.data?.pages.flatMap(p => p.items) || [];

  // Group fabrics by qualityCode for grouped card rendering
  const groupedFabrics = useMemo(() => {
    const map = new Map<string, GroupedFabric>();
    for (const fabric of fabrics) {
      const key = `${fabric.qualityCode || ''}__${fabric.qualityName || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          qualityCode: fabric.qualityCode || '',
          qualityName: fabric.qualityName || '',
          type: fabric.type || '',
          images: fabric.images || [],
          items: []
        });
      }
      const group = map.get(key)!;
      group.items.push(fabric);
      // Merge images from all weavers into the group
      if (fabric.images && fabric.images.length > 0) {
        const existingUrls = new Set(group.images);
        for (const img of fabric.images) {
          if (!existingUrls.has(img)) {
            group.images.push(img);
            existingUrls.add(img);
          }
        }
      }
    }
    return Array.from(map.values());
  }, [fabrics]);

  const handleLoadMore = useCallback(() => {
    if (fabricsQuery.hasNextPage && !fabricsQuery.isFetchingNextPage) {
      fabricsQuery.fetchNextPage();
    }
  }, [fabricsQuery]);

  // 7. Inline input helper
  const renderInput = (label: string, value: string, onChange: (t: string) => void, placeholder: string, keyboard?: string) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.inputPlaceholder}
        keyboardType={(keyboard as any) || 'default'}
        style={{
          backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
          borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0',
          borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
          fontSize: 15, color: theme.text
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, width: '100%', maxWidth: containerMaxWidth, alignSelf: 'center' }}>
      
      {/* ─── Search & Filters Header ─── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingHorizontal: 16, gap: 8 }}>
        {/* Custom Search Bar with Search Type Dropdown */}
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
          borderRadius: 12,
          paddingLeft: 12,
          paddingRight: 8,
          height: 44,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
        }}>
          {/* Dropdown Selector for Search Type */}
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSearchTypeModal(true);
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingRight: 8,
              borderRightWidth: 1,
              borderRightColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              marginRight: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginRight: 2 }}>
              {searchTypeLabels[searchType] || 'All'}
            </Text>
            <ChevronDown size={14} color={theme.textSecondary} />
          </TouchableOpacity>

          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              color: theme.text,
              paddingVertical: 8,
            }}
            placeholder={searchTypePlaceholders[searchType] || 'Search...'}
            placeholderTextColor={theme.inputPlaceholder}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => { setSearch(''); setDebouncedSearch(''); }} activeOpacity={0.6} style={{ padding: 4 }}>
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : (
            <Search size={16} color={theme.textSecondary} style={{ marginLeft: 4 }} />
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
      {(fabricsQuery.isLoading || (fabricsQuery.isFetching && fabrics.length === 0)) ? (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <FabricsProgressBar />
          <ScrollView showsVerticalScrollIndicator={false}>
            <FabricSkeletonList count={4} />
          </ScrollView>
        </View>
      ) : groupedFabrics.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={48} color={isDarkMode ? Colors.primary[400] : Colors.primary[500]} />}
          title="No Fabrics Found"
          subtitle={debouncedSearch ? 'No fabrics match your search.' : 'No fabrics added yet.'}
        />
      ) : (
        <FlatList
          data={groupedFabrics}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(group: GroupedFabric) => `${group.qualityCode}__${group.qualityName}`}
          ListHeaderComponent={() => {
            const totalMatchingCount = fabricsQuery.data?.pages[0]?.totalCount || 0;
            const grandTotal = unfilteredQuery.data ?? totalMatchingCount;
            const isFiltered = debouncedSearch.trim() !== '' || typeFilter !== 'All';
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
                    backgroundColor: theme.background
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>
                      {isFiltered ? (
                        <Text>
                          Showing <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{totalMatchingCount}</Text> of <Text style={{ fontWeight: '800', color: theme.text }}>{grandTotal}</Text>
                        </Text>
                      ) : (
                        <Text>
                          Total Fabrics: <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{grandTotal}</Text>
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
                          backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                          borderColor: isDarkMode ? '#991b1b' : '#fca5a5',
                          borderWidth: 1,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 20,
                          gap: 4
                        }}
                      >
                        <Trash2 size={12} color={isDarkMode ? '#fca5a5' : '#c53030'} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#fca5a5' : '#c53030' }}>
                          Clear Filters ({totalActiveFiltersCount})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          renderItem={({ item: group, index }) => {
            const cardKey = `${group.qualityCode}__${group.qualityName}`;
            return (
              <GroupedFabricCard
                group={group}
                index={index}
                onEdit={openEditForm}
                onDeleteWeaver={setDeleteTarget}
                onDeleteGroup={(qc, qn) => setDeleteGroupTarget({ qualityCode: qc, qualityName: qn })}
                isSuperAdmin={isSuperAdmin}
                isMaster={isMaster}
                onPreviewImages={handleOpenPreview}
                isExpanded={!!expandedCards[cardKey]}
                onToggleExpand={() => toggleCardExpand(cardKey)}
                onOpenSticker={openStickerPreview}
                numColumns={numColumns}
              />
            );
          }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 65 + insets.bottom, paddingHorizontal: numColumns > 1 ? 6 : 0 }}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListFooterComponent={
            fabricsQuery.isFetchingNextPage ? (
              <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={Colors.primary[500]} />
              </View>
            ) : (!fabricsQuery.hasNextPage && fabrics.length > 0) ? (
              <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
                  No more fabrics to load
                </Text>
              </View>
            ) : null
          }
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl
                refreshing={(fabricsQuery.isRefetching || unfilteredQuery.isRefetching) && !fabricsQuery.isFetchingNextPage}
                onRefresh={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  fabricsQuery.refetch();
                  unfilteredQuery.refetch();
                }}
                tintColor={Colors.primary[500]}
                colors={[Colors.primary[500]]}
              />
            ) : undefined
          }
        />
      )}

      {/* Draggable FAB */}
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
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
              <Package size={24} color="#ffffff" />
              <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary[600], borderRadius: 7, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
                <Plus size={9} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}
      </View>

      {/* Floating Action Button for Adding New Fabric */}
      <Modal visible={showForm} animationType="none" hardwareAccelerated={true} transparent={true} statusBarTranslucent={true} onRequestClose={closeForm}>

        <View style={{
          flex: 1,
          justifyContent: isLargeScreen ? 'center' : 'flex-end',
          alignItems: isLargeScreen ? 'center' : 'stretch'
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
              maxHeight: isLargeScreen ? '85%' : '92%',
              width: '100%',
              maxWidth: modalMaxWidth,
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

              {/* Modal Header with Title & Close Button */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Package size={20} color={isDarkMode ? '#60a5fa' : '#2563eb'} />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>
                    {editingFabric ? 'Edit Fabric Quality' : 'Add Fabric Quality'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeForm}
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
                contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 48 : 60 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScroll={(e) => { formScrollOffset.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                {/* ─── Shared Quality Information ─── */}
                <View style={{ marginBottom: 16, backgroundColor: isDarkMode ? '#0f172a' : '#f0f4ff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isDarkMode ? '#1e3a5f' : '#c7d2fe' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: isDarkMode ? '#93c5fd' : Colors.primary[700], marginBottom: 10 }}>Quality Information</Text>
                  {renderInput('Quality Name *', formQuality.qualityName, (t) => setFormQuality(p => ({ ...p, qualityName: t })), 'Enter quality name')}
                  {renderInput('Quality Code *', formQuality.qualityCode, (t) => setFormQuality(p => ({ ...p, qualityCode: t })), 'Enter quality code')}
                  
                  {/* Type Selector */}
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>Fabric Type</Text>
                    <TouchableOpacity
                      onPress={() => setShowTypeModal(true)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                        borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <Text style={{ fontSize: 15, color: formQuality.type ? theme.text : theme.inputPlaceholder }}>
                        {formQuality.type || 'Select type'}
                      </Text>
                      <ChevronDown size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {/* ─── Images (inside Quality Info) ─── */}
                  <View style={{ marginTop: 4, marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 }}>Images</Text>
                    
                    {/* Upload buttons row — same as orders page */}
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
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Camera</Text>
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
                              onPress={() => handleOpenPreview(formImages, i)}
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
                </View>
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>
                      Weavers ({formWeavers.length})
                    </Text>
                    {/* {!editingFabric && (
                      <TouchableOpacity
                        onPress={addWeaver}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                          backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : Colors.primary[50]
                        }}
                      >
                        <Plus size={14} color={Colors.primary[600]} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary[600] }}>Add Weaver</Text>
                      </TouchableOpacity>
                    )} */}
                  </View>

                  {formWeavers.map((w, wIdx) => (
                    <View
                      key={wIdx}
                      style={{
                        marginBottom: 12,
                        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                      }}
                    >
                      {/* Weaver Card Header */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primary[600] }}>#{wIdx + 1}</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Weaver Details</Text>
                        </View>
                        {formWeavers.length > 1 && !editingFabric && (
                          <TouchableOpacity
                            onPress={() => removeWeaver(wIdx)}
                            style={{ padding: 6, borderRadius: 8, backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#fee2e2' }}
                          >
                            <Trash2 size={14} color={Colors.error[600]} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {renderInput('Weaver Name *', w.weaver, (t) => updateWeaver(wIdx, 'weaver', t), 'Enter weaver name')}
                      {renderInput('Weaver Quality Name *', w.weaverQualityName, (t) => updateWeaver(wIdx, 'weaverQualityName', t), 'Enter weaver quality name')}

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>{renderInput('Greigh Width (inches)', w.greighWidth, (t) => updateWeaver(wIdx, 'greighWidth', t), 'e.g., 58.5', 'numeric')}</View>
                        <View style={{ flex: 1 }}>{renderInput('Finish Width (inches)', w.finishWidth, (t) => updateWeaver(wIdx, 'finishWidth', t), 'e.g., 56.0', 'numeric')}</View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>{renderInput('Weight (KG)', w.weight, (t) => updateWeaver(wIdx, 'weight', t), 'e.g., 8.0', 'numeric')}</View>
                        <View style={{ flex: 1 }}>{renderInput('GSM', w.gsm, (t) => updateWeaver(wIdx, 'gsm', t), 'e.g., 72.5', 'numeric')}</View>
                      </View>

                      {renderInput('Content', w.content, (t) => updateWeaver(wIdx, 'content', t), 'e.g., 100% Polyester')}
                      {renderInput('Danier (Count)', w.danier, (t) => updateWeaver(wIdx, 'danier', t), 'e.g., 55*22D')}

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>{renderInput('Reed', w.reed, (t) => updateWeaver(wIdx, 'reed', t), 'e.g., 120', 'numeric')}</View>
                        <View style={{ flex: 1 }}>{renderInput('Pick', w.pick, (t) => updateWeaver(wIdx, 'pick', t), 'e.g., 80', 'numeric')}</View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>{renderInput('Greigh Rate (₹)', w.greighRate, (t) => updateWeaver(wIdx, 'greighRate', t), 'e.g., 150.00', 'numeric')}</View>
                        <View style={{ flex: 1 }}>{renderInput('Rack', w.rack, (t) => updateWeaver(wIdx, 'rack', t), 'Enter rack')}</View>
                      </View>
                    </View>
                  ))}

                  {/* Add More Weaver Button (Dashed) */}
                  {!editingFabric && (
                    <TouchableOpacity
                      onPress={addWeaver}
                      activeOpacity={0.7}
                      style={{
                        paddingVertical: 14,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                        borderStyle: 'dashed',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginBottom: 16,
                      }}
                    >
                      <Plus size={16} color={theme.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Add Another Weaver</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ marginTop: 8 }}>
                  <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={{ width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: submitting ? Colors.primary[400] : Colors.primary[600] }}>
                    {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{editingFabric ? 'Update' : `Create${formWeavers.length > 1 ? ` (${formWeavers.filter(w => w.weaver.trim()).length})` : ''}`}</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Delete Modal */}
      <Modal visible={!!deleteTarget} animationType="fade" transparent={true} statusBarTranslucent={true}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 24 }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 12 }}>Delete Fabric Quality</Text>
            <Text style={{ fontSize: 15, color: theme.textSecondary, marginBottom: 24 }}>Are you sure you want to delete "{deleteTarget?.qualityName}"? This action cannot be undone.</Text>
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

      {/* Delete Group Modal */}
      <Modal visible={!!deleteGroupTarget} animationType="fade" transparent={true} statusBarTranslucent={true}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: 24 }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 12 }}>Delete Entire Group</Text>
            <Text style={{ fontSize: 15, color: theme.textSecondary, marginBottom: 24 }}>
              Are you sure you want to delete ALL weavers in the "{deleteGroupTarget?.qualityName}" group (Code: {deleteGroupTarget?.qualityCode})? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setDeleteGroupTarget(null)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteGroup} disabled={deletingGroup} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.error[600] }}>
                {deletingGroup ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Delete All</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Type Selection Modal */}
      <Modal visible={showTypeModal} animationType="fade" transparent={true} statusBarTranslucent={true} onRequestClose={() => setShowTypeModal(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 24 }}>
          {/* Clickable Backdrop */}
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowTypeModal(false)} />
          
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, zIndex: 1 }}>
            {/* Header Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Select Fabric Type</Text>
              <TouchableOpacity
                onPress={() => setShowTypeModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                }}
              >
                <X size={16} color={theme.text} />
              </TouchableOpacity>
            </View>

            {fabricTypes.filter(t => t !== 'All').map((type) => {
              const isSelected = formQuality.type === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setFormQuality(p => ({ ...p, type }));
                    setShowTypeModal(false);
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 4,
                    backgroundColor: isSelected ? (isDarkMode ? 'rgba(59,130,246,0.15)' : '#eff6ff') : 'transparent'
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '500', color: isSelected ? Colors.primary[600] : theme.text }}>{type}</Text>
                  {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary[600] }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <CustomCameraModal visible={cameraVisible} onClose={() => setCameraVisible(false)} onPhotosCaptured={handleCameraCapture} />

      {/* Image Preview Modal */}
      <ImagePreviewModal visible={previewVisible} images={previewImages} initialIndex={previewImageIndex} onClose={() => setPreviewVisible(false)} />

      {/* Search Type Selection Modal */}
      <Modal
        visible={showSearchTypeModal}
        transparent={true}
        animationType="none"
        hardwareAccelerated={true}
        statusBarTranslucent={true}
        onRequestClose={closeSearchTypeModal}
      >
        <View style={{
          flex: 1,
          justifyContent: 'flex-end',
        }}>
          {/* Clickable Backdrop */}
          <RNAnimated.View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'transparent',
            }}
          >
            <Pressable onPress={closeSearchTypeModal} style={{ flex: 1 }} />
          </RNAnimated.View>

          <RNAnimated.View
            onLayout={(e) => {
              searchTypeSheetY.current = e.nativeEvent.layout.y;
            }}
            {...searchTypePanResponder.panHandlers}
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingBottom: 24 + insets.bottom,
              borderTopWidth: 1,
              borderTopColor: isDarkMode ? '#334155' : '#e2e8f0',
              maxHeight: '60%',
              transform: isLargeScreen ? undefined : [{ translateY: searchTypePanY }],
            }}
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
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Search Field</Text>
              </View>
            </View>

            {/* Absolute Close Button */}
            <TouchableOpacity
              onPress={closeSearchTypeModal}
              style={{
                position: 'absolute',
                top: 24,
                right: 24,
                padding: 4,
                borderRadius: 12,
                backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
                zIndex: 10,
              }}
            >
              <X size={18} color={theme.text} />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              onScroll={(e) => { searchTypeScrollOffset.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {Object.keys(searchTypeFullLabels).map((type) => {
                const isSelected = searchType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSearchType(type as any);
                      if (search.trim() !== '') {
                        setDebouncedSearch(search);
                      }
                      closeSearchTypeModal();
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 24,
                      paddingVertical: 14,
                      backgroundColor: isSelected ? (isDarkMode ? 'rgba(59,130,246,0.15)' : '#eff6ff') : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 15, color: isSelected ? Colors.primary[600] : theme.text, fontWeight: isSelected ? '700' : '500' }}>
                      {searchTypeFullLabels[type]}
                    </Text>
                    {isSelected && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary[600] }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="none"
        hardwareAccelerated={true}
        statusBarTranslucent={true}
        onRequestClose={closeFilterModal}
      >
        <View style={{
          flex: 1,
          justifyContent: 'flex-end',
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
              paddingTop: 12,
              paddingBottom: 24 + insets.bottom,
              borderTopWidth: 1,
              borderTopColor: isDarkMode ? '#334155' : '#e2e8f0',
              maxHeight: '80%',
              transform: isLargeScreen ? undefined : [{ translateY: filterPanY }],
            }}
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
              onScroll={(e) => { filterScrollOffset.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {/* Sort Order Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort By</Text>
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

              {/* Fabric Type Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fabric Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 }}>
                {fabricTypes.map((type) => (
                  <FilterPill
                    key={type}
                    label={type === 'All' ? 'All Types' : type}
                    selected={typeFilter === type}
                    onPress={() => setTypeFilter(type)}
                  />
                ))}
              </View>
            </ScrollView>

            {/* Apply Button */}
            <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  closeFilterModal();
                }}
                activeOpacity={0.8}
                style={{
                  backgroundColor: Colors.primary[600],
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '700' }}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </RNAnimated.View>
        </View>
      </Modal>



      {/* PDF Viewer Modal with Save & Share */}
      <PdfViewerModal
        visible={pdfViewerVisible}
        onClose={() => { setPdfViewerVisible(false); setPdfViewerLocalUri(undefined); setPdfViewerLocalBase64(undefined); }}
        pdfUrl={pdfViewerUrl}
        title={pdfViewerTitle}
        filename={pdfViewerFilename}
        localUri={pdfViewerLocalUri}
        localBase64={pdfViewerLocalBase64}
        addToast={addToast}
      />
    </SafeAreaView>
  );
}
