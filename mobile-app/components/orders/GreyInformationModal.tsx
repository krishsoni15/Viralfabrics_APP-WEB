import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  Animated, PanResponder, Dimensions, StatusBar, TouchableWithoutFeedback,
  Alert, useWindowDimensions
} from 'react-native';
import { Trash2, Plus, Calendar, ChevronDown, X, Package, FileText } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import DatePickerModal from '../shared/DatePickerModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import api from '../../services/api';
import { getDisplayOrderId } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';



const toDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return y && m && d ? `${d}/${m}/${y}` : dateStr;
};
const toISO = (dateStr: string) => {
  if (!dateStr) return '';
  const [d, m, y] = dateStr.split('/');
  return d && m && y ? `${y}-${m}-${d}` : dateStr;
};

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface Entry {
  id: string;
  date: string;
  quality: string;
  quantity: string;
  numberOfPieces: string;
  chalanNo: string;
  weaverName: string;
  weaverLoaded: boolean;
}

const makeEntry = (quality = '', weaverName = ''): Entry => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  date: '',
  quality,
  quantity: '',
  numberOfPieces: '',
  chalanNo: '',
  weaverName,
  weaverLoaded: !!weaverName,
});

function SkeletonPulse({ style, theme }: { style: any, theme: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: theme.skeleton, borderRadius: 8 }, style, { opacity }]} />;
}

function GreyInformationModalSkeleton({ theme, cardBg, borderCol }: { theme: any, cardBg: string, borderCol: string }) {
  return (
    <View style={{ gap: 12 }}>
      {[1, 2].map((key) => (
        <View
          key={key}
          style={{
            backgroundColor: cardBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: borderCol,
            padding: 14,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: borderCol, paddingBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SkeletonPulse theme={theme} style={{ width: 22, height: 22, borderRadius: 11 }} />
              <SkeletonPulse theme={theme} style={{ width: 100, height: 14 }} />
            </View>
          </View>

          <View>
            <SkeletonPulse theme={theme} style={{ width: 60, height: 10, marginBottom: 6 }} />
            <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
          </View>

          <View>
            <SkeletonPulse theme={theme} style={{ width: 80, height: 10, marginBottom: 6 }} />
            <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <SkeletonPulse theme={theme} style={{ width: 40, height: 10, marginBottom: 6 }} />
              <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
            </View>
            <View style={{ flex: 1.2 }}>
              <SkeletonPulse theme={theme} style={{ width: 60, height: 10, marginBottom: 6 }} />
              <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
            </View>
            <View style={{ flex: 1 }}>
              <SkeletonPulse theme={theme} style={{ width: 60, height: 10, marginBottom: 6 }} />
              <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

interface GreyInformationModalProps {
  visible: boolean;
  onClose: () => void;
  order: any;
  greyInfo: any[];
  qualities: any[];
  isDarkMode: boolean;
  theme: any;
  onSave: (entries: any[], deletedIds: string[]) => void;
  isSaving: boolean;
  isLoading?: boolean;
  isMaster?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
  isReadOnly?: boolean;
}

function ModalProgressBar({ isDarkMode }: { isDarkMode: boolean }) {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: SCREEN_WIDTH,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [translateX, SCREEN_WIDTH]);

  return (
    <View style={{
      width: '100%',
      height: 3,
      backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0',
      overflow: 'hidden',
    }}>
      <Animated.View
        style={{
          width: 150,
          height: '100%',
          backgroundColor: Colors.primary[500],
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}


export default function GreyInformationModal({
  visible, onClose, order, greyInfo, qualities,
  isDarkMode, theme, onSave, isSaving, isLoading = false, isMaster = false,
  onDelete, isDeleting = false, isReadOnly = false
}: GreyInformationModalProps) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isLargeScreen, modalMaxWidth } = useResponsiveLayout();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
  const [dropdownFor, setDropdownFor] = useState<string | null>(null);
  const [qualitySearch, setQualitySearch] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const deletedIds = useRef<string[]>([]);
  const loadingIds = useRef<Set<string>>(new Set());

  // Track ScrollView scroll position — only close when at the top
  const scrollY = useRef(0);

  // Keep latest onClose in a ref so PanResponder doesn't capture stale closure
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const lastInitializedOrderIdRef = useRef<string | null>(null);
  const lastInitializedDataRef = useRef<any>(null);
  // Tracks a "signature" of the last initialized data to avoid re-initing same data with new array reference
  const lastDataSignatureRef = useRef<string>('');
  const touchStartPageY = useRef(0);

  const dimensionsRef = useRef({ SCREEN_WIDTH, SCREEN_HEIGHT });
  dimensionsRef.current = { SCREEN_WIDTH, SCREEN_HEIGHT };

  // Swipe-down-to-close gesture on the whole sheet
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      // Claim touch immediately if started in the header region (top of modal) or backdrop
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        touchStartPageY.current = pageY;
        const currentScreenHeight = dimensionsRef.current.SCREEN_HEIGHT;
        return pageY < currentScreenHeight * 0.08 + 60;
      },
      onStartShouldSetPanResponderCapture: () => false,
      // Only intercept if: scrolled to top AND swipe is downward
      onMoveShouldSetPanResponder: (_, g) =>
        scrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        scrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (evt, g) => {
        const currentScreenHeight = dimensionsRef.current.SCREEN_HEIGHT;
        const isBackdropTouch = touchStartPageY.current < currentScreenHeight * 0.08;
        if (isBackdropTouch && Math.abs(g.dy) < 10 && Math.abs(g.dx) < 10) {
          onCloseRef.current();
          return;
        }

        if (g.dy > 50 || g.vy > 0.2) {
          Animated.timing(translateY, { toValue: currentScreenHeight, duration: 220, useNativeDriver: true })
            .start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;
  // Get qualities that belong to this order only
  const getOrderQualities = useCallback((): any[] => {
    if (!order?.items) return [];
    const seen = new Map<string, any>();
    for (const item of order.items) {
      if (!item.quality) continue;
      const qId = typeof item.quality === 'object' ? item.quality._id : item.quality;
      if (!qId || seen.has(String(qId))) continue;
      const found = qualities.find((q: any) => String(q._id) === String(qId));
      seen.set(String(qId), found || {
        _id: String(qId),
        name: typeof item.quality === 'object' ? (item.quality.name || 'Unknown') : `Quality`,
      });
    }
    return Array.from(seen.values());
  }, [order, qualities]);

  // Fetch weaver for an order item by quality
  const fetchWeaver = useCallback(async (qualityId: string): Promise<string> => {
    if (!qualityId) return '';
    try {
      // First try order items directly
      if (order?.items) {
        for (const item of order.items) {
          const iQId = typeof item.quality === 'object' ? item.quality._id : item.quality;
          if (String(iQId) === String(qualityId) && item.weaverSupplierName) {
            return item.weaverSupplierName;
          }
        }
      }
      // Fallback to API
      const qName = qualities.find((q: any) => String(q._id) === String(qualityId))?.name || '';
      if (!qName) return '';
      const { data } = await api.get(`/api/fabrics/weavers?qualityName=${encodeURIComponent(qName)}`);
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        return data.data[0]?.name || data.data[0]?.weaverName || '';
      }
    } catch { /* silent */ }
    return '';
  }, [order, qualities]);

  // Load weaver for single entry (prevents loop with Set)
  const loadWeaver = useCallback(async (entryId: string, qualityId: string) => {
    if (!qualityId || loadingIds.current.has(entryId)) return;
    loadingIds.current.add(entryId);
    const name = await fetchWeaver(qualityId);
    loadingIds.current.delete(entryId);
    setEntries(prev =>
      prev.map(e => e.id === entryId ? { ...e, weaverName: name, weaverLoaded: true } : e)
    );
  }, [fetchWeaver]);

  // Init on open — uses a data signature so same data with new array reference won't re-init
  useEffect(() => {
    if (!visible) {
      lastInitializedOrderIdRef.current = null;
      lastInitializedDataRef.current = null;
      lastDataSignatureRef.current = '';
      return;
    }

    const orderId = order?._id || '';
    const hasData = greyInfo && greyInfo.length > 0;
    // Signature includes complete stringified content to ensure any field updates re-initialize the form properly
    const dataSig = hasData
      ? `${orderId}|${JSON.stringify(greyInfo)}`
      : `${orderId}|0`;

    const orderChanged = lastInitializedOrderIdRef.current !== orderId;
    const dataArrived = !lastInitializedDataRef.current && hasData;
    const dataChanged = hasData && lastDataSignatureRef.current !== dataSig;
    const shouldInit = orderChanged || dataArrived || dataChanged;

    if (shouldInit) {
      lastInitializedOrderIdRef.current = orderId;
      lastInitializedDataRef.current = hasData ? greyInfo : null;
      lastDataSignatureRef.current = dataSig;

      translateY.setValue(0);
      deletedIds.current = [];
      loadingIds.current = new Set();
      setValidationErrors({});

      if (hasData) {
        const init: Entry[] = greyInfo.map((g: any) => {
          const qObj = g.quality;
          const qId = typeof qObj === 'object' ? (qObj?._id || qObj?.id || qObj?.name || '') : (qObj || '');
          return {
            id: g._id || `grey-${Date.now()}-${Math.random()}`,
            date: g.date ? g.date.split('T')[0] : '',
            quality: String(qId),
            quantity: g.quantity !== undefined && g.quantity !== null ? String(g.quantity) : '',
            numberOfPieces: g.numberOfPieces !== undefined && g.numberOfPieces !== null ? String(g.numberOfPieces) : '',
            chalanNo: g.chalanNo || '',
            weaverName: g.weaverName || '',
            weaverLoaded: !!g.weaverName,
          };
        });
        setEntries(init);
        // Load each weaver once
        init.forEach(e => { if (e.quality) loadWeaver(e.id, e.quality); });
      } else {
        // No existing data — start blank, user must select quality
        const newEntry = makeEntry('', '');
        setEntries([newEntry]);
      }
    }
  }, [visible, greyInfo, order?._id]);

  const handleQualityChange = useCallback((entryId: string, qId: string) => {
    // If same quality already selected, just close dropdown
    setEntries(prev => {
      const current = prev.find(e => e.id === entryId);
      if (current?.quality === qId) {
        setDropdownFor(null);
        return prev;
      }
      // Clear validation error for this entry
      setValidationErrors(prev2 => { const n = {...prev2}; delete n[entryId]; return n; });
      return prev.map(e => e.id === entryId ? { ...e, quality: qId, weaverName: '', weaverLoaded: false } : e);
    });
    // Remove from loading set so it can reload
    loadingIds.current.delete(entryId);
    loadWeaver(entryId, qId);
    setDropdownFor(null);
  }, [loadWeaver]);

  const handleAddEntry = useCallback(() => {
    const last = entries[entries.length - 1];
    const newEntry = makeEntry(last?.quality || '', last?.weaverName || '');
    // If last entry had weaver loaded, reuse it; else load
    if (last?.quality && !last.weaverLoaded) {
      loadWeaver(newEntry.id, last.quality);
    } else {
      newEntry.weaverLoaded = !!newEntry.weaverName;
    }
    setEntries(prev => [...prev, newEntry]);
  }, [entries, loadWeaver]);

  const handleRemove = useCallback((entryId: string) => {
    if (!entryId.startsWith('new-')) deletedIds.current.push(entryId);
    loadingIds.current.delete(entryId);
    setValidationErrors(prev => { const n = {...prev}; delete n[entryId]; return n; });
    setEntries(prev => prev.filter(e => e.id !== entryId));
  }, []);

  const handleSave = useCallback(() => {
    // Validate all entries have quality selected
    const errors: Record<string, boolean> = {};
    entries.forEach(e => { if (!e.quality) errors[e.id] = true; });
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    onSave(entries, deletedIds.current);
  }, [entries, onSave]);

  const updateEntry = useCallback((entryId: string, field: string, val: string) => {
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, [field]: val } : e));
  }, []);

  const filtered = getOrderQualities().filter((q: any) =>
    !qualitySearch || q.name?.toLowerCase().includes(qualitySearch.toLowerCase())
  );

  const bg = isDarkMode ? '#0f0f14' : '#ffffff';
  const cardBg = isDarkMode ? '#18181f' : '#f9f9fb';
  const inputBg = isDarkMode ? '#111118' : '#ffffff';
  const borderCol = isDarkMode ? '#2a2a38' : '#e5e7eb';
  const labelCol = isDarkMode ? '#8b8fa8' : '#6b7280';

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0)', justifyContent: 'flex-end' }}>
        {/* Backdrop — tap anywhere outside sheet to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View 
            {...panResponder.panHandlers}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
          />
        </TouchableWithoutFeedback>

        <Animated.View
          {...panResponder.panHandlers}
          style={{
            backgroundColor: bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            height: '92%',
            maxWidth: isLargeScreen ? modalMaxWidth : '100%',
            width: '100%',
            alignSelf: 'center',
            transform: [{ translateY }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 20,
            paddingBottom: isLargeScreen ? 24 : 0,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 120}
            style={{ width: '100%', flex: 1 }}
          >
            {/* Drag Handle (visual only) */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#3a3a4a' : '#d1d5db' }} />
            </View>

            {isLoading ? (
              <ModalProgressBar isDarkMode={isDarkMode} />
            ) : (
              <View style={{ height: 3, width: '100%' }} />
            )}

            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: isDarkMode ? 'rgba(115,115,115,0.15)' : 'rgba(115,115,115,0.1)',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <FileText size={18} color={isDarkMode ? Colors.neutral[300] : Colors.neutral[600]} />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
                    Grey Information
                  </Text>
                  <Text style={{ fontSize: 12, color: labelCol, marginTop: 1 }}>
                    {order ? `Order: ${getDisplayOrderId(order.orderId) || '—'}` : 'Grey details'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: isDarkMode ? '#2a2a38' : '#f3f4f6',
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <X size={16} color={labelCol} />
              </TouchableOpacity>
            </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 220 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEventThrottle={16}
            onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          >
            {/* Refetching Indicator */}
            {/* {isLoading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', paddingVertical: 8, borderRadius: 8, marginBottom: 16, gap: 8 }}>
                <ActivityIndicator size="small" color={isDarkMode ? '#60a5fa' : '#3b82f6'} />
                <Text style={{ fontSize: 13, color: isDarkMode ? '#60a5fa' : '#2563eb', fontWeight: '500' }}>Refreshing data...</Text>
              </View>
            )} */}

            {isLoading && (!greyInfo || greyInfo.length === 0) ? (
              <GreyInformationModalSkeleton theme={theme} cardBg={cardBg} borderCol={borderCol} />
            ) : (
              <>
              {entries.length === 0 ? (
                <View style={{
                  padding: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: borderCol,
                  marginVertical: 20
                }}>
                  <Package size={36} color={theme.textTertiary} style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>No entries added yet</Text>
                  <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: 'center' }}>Click the button below to add a grey material entry.</Text>
                </View>
              ) : (
                entries.map((entry, idx) => (
                <View
                  key={entry.id}
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: borderCol,
                    marginBottom: 12,
                    overflow: 'visible',
                  }}
                >
                  {/* Card Top strip with index dot + remove */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 14, paddingVertical: 10,
                    borderBottomWidth: 1, borderBottomColor: borderCol,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: isDarkMode ? Colors.neutral[600] : Colors.neutral[500],
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{idx + 1}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
                        {entry.quality
                          ? (qualities.find((q: any) => String(q._id) === String(entry.quality))?.name || 'Grey Info')
                          : 'Grey Info'}
                      </Text>
                    </View>
                    {!isReadOnly && (entry.id.startsWith('new-') || isMaster) && entries.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemove(entry.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                          backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : '#fef2f2',
                        }}
                      >
                        <Trash2 size={12} color={Colors.error[500]} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.error[500] }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ padding: 14, gap: 10 }}>
                    {/* Quality */}
                    <View style={{ zIndex: dropdownFor === entry.id ? 999 : 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: labelCol, letterSpacing: 0.3, textTransform: 'uppercase' }}>Quality</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#ef4444', lineHeight: 16 }}>*</Text>
                      </View>
                      {validationErrors[entry.id] && (
                        <Text style={{ fontSize: 11, color: '#ef4444', marginBottom: 5, fontWeight: '600' }}>
                          ⚠ Quality is required
                        </Text>
                      )}
                      <View
                        style={{
                          height: 44, flexDirection: 'row', alignItems: 'center',
                          paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
                          borderColor: validationErrors[entry.id] ? '#ef4444' : (dropdownFor === entry.id ? (isDarkMode ? Colors.neutral[400] : Colors.neutral[500]) : borderCol),
                          backgroundColor: inputBg,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => { setDropdownFor(dropdownFor === entry.id ? null : entry.id); setQualitySearch(''); }}
                          disabled={isReadOnly}
                          activeOpacity={isReadOnly ? 1 : 0.7}
                          style={{
                            flex: 1,
                            height: '100%',
                            justifyContent: 'center'
                          }}
                        >
                          <Text style={{ fontSize: 14, color: entry.quality ? theme.text : labelCol, fontWeight: entry.quality ? '500' : '400' }}>
                            {entry.quality
                              ? (qualities.find((q: any) => String(q._id) === String(entry.quality))?.name || 'Select Quality')
                              : 'Select Quality'}
                          </Text>
                        </TouchableOpacity>

                        {entry.quality && !isReadOnly ? (
                          <TouchableOpacity
                            onPress={() => handleQualityChange(entry.id, '')}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={{ padding: 4, marginRight: 4 }}
                          >
                            <X size={15} color={dropdownFor === entry.id ? (isDarkMode ? Colors.neutral[400] : Colors.neutral[500]) : labelCol} />
                          </TouchableOpacity>
                        ) : null}
                        <ChevronDown size={15} color={dropdownFor === entry.id ? (isDarkMode ? Colors.neutral[400] : Colors.neutral[500]) : labelCol} />
                      </View>

                      {dropdownFor === entry.id && (
                        <View style={{
                          position: 'absolute', top: 72, left: 0, right: 0,
                          backgroundColor: inputBg, borderRadius: 14, borderWidth: 1.5,
                          borderColor: isDarkMode ? Colors.neutral[500] : Colors.neutral[400], zIndex: 9999,
                          shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: 0.18, shadowRadius: 12, elevation: 20,
                          overflow: 'hidden', maxHeight: 220,
                        }}>
                          <View style={{
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                            paddingHorizontal: 12, height: 42,
                            borderBottomWidth: 1, borderBottomColor: borderCol,
                            backgroundColor: isDarkMode ? '#111118' : '#f9fafb',
                          }}>
                            <TextInput
                              style={{ flex: 1, fontSize: 13, color: theme.text, padding: 0 }}
                              value={qualitySearch}
                              onChangeText={setQualitySearch}
                              placeholder="Search..."
                              placeholderTextColor={labelCol}
                              autoFocus
                            />
                            {qualitySearch.length > 0 && (
                              <TouchableOpacity onPress={() => setQualitySearch('')}>
                                <X size={13} color={labelCol} />
                              </TouchableOpacity>
                            )}
                          </View>
                          <ScrollView nestedScrollEnabled style={{ maxHeight: 178 }}>
                            {filtered.map((q: any) => {
                              const sel = entry.quality === q._id;
                              return (
                                <TouchableOpacity
                                  key={q._id}
                                  onPress={() => handleQualityChange(entry.id, q._id)}
                                  style={{
                                    paddingVertical: 13, paddingHorizontal: 14,
                                    backgroundColor: sel ? (isDarkMode ? 'rgba(115,115,115,0.15)' : 'rgba(115,115,115,0.06)') : 'transparent',
                                    borderBottomWidth: 1, borderBottomColor: borderCol,
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                  }}
                                >
                                  <Text style={{ fontSize: 14, fontWeight: sel ? '700' : '400', color: sel ? (isDarkMode ? Colors.neutral[200] : Colors.neutral[800]) : theme.text }}>
                                    {q.name}
                                  </Text>
                                  {sel && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDarkMode ? Colors.neutral[300] : Colors.neutral[600] }} />}
                                </TouchableOpacity>
                              );
                            })}
                            {filtered.length === 0 && (
                              <View style={{ padding: 16, alignItems: 'center' }}>
                                <Text style={{ fontSize: 13, color: labelCol }}>No qualities found</Text>
                              </View>
                            )}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Weaver (auto-filled read-only) */}
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: labelCol, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' }}>Weaver</Text>
                      <View style={{
                        height: 44, flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
                        borderColor: borderCol,
                        backgroundColor: isDarkMode ? '#0d0d14' : '#f9fafb',
                      }}>
                        {!entry.weaverLoaded && entry.quality ? (
                          <>
                            <ActivityIndicator size="small" color={isDarkMode ? Colors.neutral[400] : Colors.neutral[500]} style={{ marginRight: 8 }} />
                            <Text style={{ fontSize: 13, color: labelCol, fontStyle: 'italic' }}>Loading...</Text>
                          </>
                        ) : (
                          <Text style={{ fontSize: 14, color: entry.weaverName ? theme.text : labelCol, fontStyle: entry.weaverName ? 'normal' : 'italic' }}>
                            {!entry.quality ? 'Select quality first' : (entry.weaverName || 'No weaver found')}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Date */}
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: labelCol, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' }}>Date</Text>
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity
                          onPress={() => setDatePickerFor(entry.id)}
                          disabled={isReadOnly}
                          activeOpacity={isReadOnly ? 1 : 0.7}
                          style={{
                            height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
                            borderColor: borderCol, backgroundColor: inputBg,
                          }}
                        >
                          <Text style={{ fontSize: 14, color: entry.date ? theme.text : labelCol }}>
                            {entry.date ? toDisplay(entry.date) : 'Select date'}
                          </Text>
                          <View style={{ width: 15 }} />
                        </TouchableOpacity>
                        <View style={{ position: 'absolute', right: 12, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {entry.date && !isReadOnly ? (
                            <TouchableOpacity
                              onPress={() => updateEntry(entry.id, 'date', '')}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <X size={15} color={labelCol} />
                            </TouchableOpacity>
                          ) : null}
                          <Calendar size={15} color={isDarkMode ? Colors.neutral[300] : Colors.neutral[500]} />
                        </View>
                      </View>
                    </View>

                    {/* Qty + Pieces */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: labelCol, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' }}>Qty (Mtr)</Text>
                        <TextInput
                          style={{
                            height: 44, borderWidth: 1.5, borderColor: borderCol,
                            borderRadius: 12, paddingHorizontal: 14,
                            color: theme.text, backgroundColor: inputBg, fontSize: 14,
                          }}
                          value={entry.quantity}
                          onChangeText={v => updateEntry(entry.id, 'quantity', v)}
                          placeholder="0"
                          placeholderTextColor={labelCol}
                          keyboardType="numeric"
                          editable={!isReadOnly}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: labelCol, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' }}>Pieces</Text>
                        <TextInput
                          style={{
                            height: 44, borderWidth: 1.5, borderColor: borderCol,
                            borderRadius: 12, paddingHorizontal: 14,
                            color: theme.text, backgroundColor: inputBg, fontSize: 14,
                          }}
                          value={entry.numberOfPieces}
                          onChangeText={v => updateEntry(entry.id, 'numberOfPieces', v)}
                          placeholder="0"
                          placeholderTextColor={labelCol}
                          keyboardType="numeric"
                          editable={!isReadOnly}
                        />
                      </View>
                    </View>

                    {/* Chalan No */}
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: labelCol, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' }}>Chalan No</Text>
                      <TextInput
                        style={{
                          height: 44, borderWidth: 1.5, borderColor: borderCol,
                          borderRadius: 12, paddingHorizontal: 14,
                          color: theme.text, backgroundColor: inputBg, fontSize: 14,
                        }}
                        value={entry.chalanNo}
                        onChangeText={v => updateEntry(entry.id, 'chalanNo', v)}
                        placeholder="Enter chalan number"
                        placeholderTextColor={labelCol}
                        editable={!isReadOnly}
                      />
                    </View>
                  </View>
                </View>
              ))
              )}

              {/* Add Entry */}
              {!isReadOnly && (
                <TouchableOpacity
                  onPress={handleAddEntry}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 6, paddingVertical: 12, marginBottom: 16,
                    borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed',
                    borderColor: isDarkMode ? Colors.neutral[600] : Colors.neutral[300],
                    backgroundColor: isDarkMode ? 'rgba(115,115,115,0.05)' : 'rgba(115,115,115,0.04)',
                  }}
                >
                  <Plus size={14} color={isDarkMode ? Colors.neutral[300] : Colors.neutral[500]} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? Colors.neutral[200] : Colors.neutral[600] }}>Add Entry</Text>
                </TouchableOpacity>
              )}

              {/* Bottom Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : 12 }}>
                {isReadOnly ? (
                  <TouchableOpacity
                    onPress={onClose}
                    activeOpacity={0.85}
                    style={{
                      flex: 1, height: 50, borderRadius: 14,
                      backgroundColor: isDarkMode ? Colors.neutral[700] : Colors.neutral[600],
                      justifyContent: 'center', alignItems: 'center',
                      shadowColor: isDarkMode ? 'transparent' : Colors.neutral[400],
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35, shadowRadius: 10,
                      elevation: 6,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 }}>
                      Close
                    </Text>
                  </TouchableOpacity>
                ) : greyInfo && greyInfo.length > 0 && onDelete && isMaster ? (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowDeleteConfirm(true)}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        height: 50,
                        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                        borderRadius: 14,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fecaca',
                      }}
                    >
                      <Text style={{ color: Colors.error[600], fontSize: 14, fontWeight: '700' }}>Delete All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSave}
                      disabled={isSaving}
                      activeOpacity={0.85}
                      style={{
                        flex: 1.8, height: 50, borderRadius: 14,
                        backgroundColor: isSaving ? (isDarkMode ? Colors.neutral[700] : Colors.neutral[400]) : (isDarkMode ? Colors.neutral[50] : Colors.neutral[600]),
                        justifyContent: 'center', alignItems: 'center',
                        shadowColor: isDarkMode ? 'transparent' : Colors.neutral[400],
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.35, shadowRadius: 10,
                        elevation: 6,
                      }}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ fontSize: 15, fontWeight: '800', color: isDarkMode ? Colors.neutral[900] : '#fff', letterSpacing: -0.2 }}>
                          Save {entries.length > 1 ? `(${entries.length})` : ''}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.85}
                    style={{
                      flex: 1, height: 50, borderRadius: 14,
                      backgroundColor: isSaving ? (isDarkMode ? Colors.neutral[700] : Colors.neutral[400]) : (isDarkMode ? Colors.neutral[50] : Colors.neutral[600]),
                      justifyContent: 'center', alignItems: 'center',
                      shadowColor: isDarkMode ? 'transparent' : Colors.neutral[400],
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35, shadowRadius: 10,
                      elevation: 6,
                    }}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ fontSize: 15, fontWeight: '800', color: isDarkMode ? Colors.neutral[900] : '#fff', letterSpacing: -0.2 }}>
                        Save {entries.length > 1 ? `(${entries.length})` : ''}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              </>
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      <DatePickerModal
        visible={datePickerFor !== null}
        onClose={() => setDatePickerFor(null)}
        value={(() => {
          if (!datePickerFor) return '';
          const e = entries.find(x => x.id === datePickerFor);
          return e ? toDisplay(e.date) : '';
        })()}
        onSelectDate={(ddmmyyyy) => {
          if (datePickerFor) {
            updateEntry(datePickerFor, 'date', toISO(ddmmyyyy));
          }
          setDatePickerFor(null);
        }}
      />

      <DeleteConfirmModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={onDelete || (() => {})}
        title="Delete All Grey Info"
        message="Are you sure you want to delete all grey information for this order? This action cannot be undone."
        confirmText="Delete All"
        isDeleting={isDeleting}
      />
    </Modal>
  );
}
