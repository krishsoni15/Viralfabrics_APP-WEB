import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert, Animated, PanResponder, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { ChevronDown, X, Calendar, FileInput, Trash2, Plus, Minus, Layers, Settings, FileText } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import DatePickerModal from '../shared/DatePickerModal';
import api from '../../services/api';
import { getDisplayOrderId } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';

interface MillInputModalProps {
  visible: boolean;
  onClose: () => void;
  order: any;
  existingMillInputs: any[];
  mills: any[];
  qualities: any[];
  isDarkMode: boolean;
  theme: any;
  onSave: (payload: { mill: string; millItems: any[] }) => void;
  isSaving: boolean;
  onDelete?: () => void;
  isLoading?: boolean;
  isMaster?: boolean;
  isDeleting?: boolean;
  isReadOnly?: boolean;
}

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

function MillInputModalSkeleton({ theme }: { theme: any }) {
  return (
    <View style={{ gap: 16, padding: 16 }}>
      <View style={{ gap: 6 }}>
        <SkeletonPulse theme={theme} style={{ width: 100, height: 10 }} />
        <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
      </View>

      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 16,
          gap: 16,
        }}
      >
        <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 10 }}>
          <SkeletonPulse theme={theme} style={{ width: 120, height: 14 }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SkeletonPulse theme={theme} style={{ width: 60, height: 10, marginBottom: 6 }} />
            <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
          </View>
          <View style={{ flex: 1 }}>
            <SkeletonPulse theme={theme} style={{ width: 60, height: 10, marginBottom: 6 }} />
            <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SkeletonPulse theme={theme} style={{ width: 60, height: 10, marginBottom: 6 }} />
            <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
          </View>
          <View style={{ flex: 1 }}>
            <SkeletonPulse theme={theme} style={{ width: 60, height: 10, marginBottom: 6 }} />
            <SkeletonPulse theme={theme} style={{ width: '100%', height: 44, borderRadius: 12 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

const PROCESS_OPTIONS = [
  'Lot No Greigh',
  'Charkha',
  'Drum',
  'Soflina WR',
  'long jet',
  'setting',
  'In Dyeing',
  'jigar',
  'in printing',
  'loop',
  'washing',
  'Finish',
  'folding',
  'ready to dispatch',
  'In House',
  'FOB Send'
];

const toDisplay = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

const toISO = (displayStr: string | null | undefined): string => {
  if (!displayStr || !displayStr.includes('/')) return '';
  try {
    const parts = displayStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  } catch { }
  return '';
};

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function ModalProgressBar({ isDarkMode }: { isDarkMode: boolean }) {
  const translateX = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: Dimensions.get('window').width,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [translateX]);

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

export default function MillInputModal({
  visible,
  onClose,
  order,
  existingMillInputs,
  mills,
  qualities,
  isDarkMode,
  theme,
  onSave,
  isSaving,
  onDelete,
  isLoading = false,
  isMaster = false,
  isDeleting = false,
  isReadOnly = false
}: MillInputModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedMill, setSelectedMill] = useState<string>('');
  const [millItems, setMillItems] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lastInitializedOrderIdRef = useRef<string | null>(null);
  const lastInitializedDataRef = useRef<any>(null);
  const lastDataSignatureRef = useRef<string>('');
  const saveInProgress = useRef(false);

  useEffect(() => {
    if (!visible) {
      saveInProgress.current = false;
    }
  }, [visible]);

  useEffect(() => {
    if (!isSaving) {
      saveInProgress.current = false;
    }
  }, [isSaving]);

  const [activeDatePickerIndex, setActiveDatePickerIndex] = useState<number | null>(null);

  // Bottom Sheet selector state
  const [selectorModal, setSelectorModal] = useState<{
    type: 'mill' | 'quality' | 'process';
    itemIndex: number;
    additionalIndex?: number;
  } | null>(null);
  const [selectorSearchQuery, setSelectorSearchQuery] = useState('');

  // Mill inline creation states
  const [isAddingNewMill, setIsAddingNewMill] = useState(false);
  const [newMillName, setNewMillName] = useState('');
  const [isSavingNewMill, setIsSavingNewMill] = useState(false);
  const [createdMills, setCreatedMills] = useState<any[]>([]);

  // Swipe-down-to-close implementation
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const scrollY = useRef(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const translateY = useRef(new Animated.Value(0)).current;
  const touchStartPageY = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      // Claim touch immediately if started in the header region (top of modal) or backdrop
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        touchStartPageY.current = pageY;
        return pageY < SCREEN_HEIGHT * 0.08 + 60;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        scrollY.current <= 5 && g.dy > 5 && g.dy > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        scrollY.current <= 5 && g.dy > 5 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (evt, g) => {
        const isBackdropTouch = touchStartPageY.current < SCREEN_HEIGHT * 0.08;
        if (isBackdropTouch && Math.abs(g.dy) < 10 && Math.abs(g.dx) < 10) {
          onCloseRef.current();
          return;
        }

        if (g.dy > 80 || g.vy > 0.4) {
          Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true })
            .start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

  // Selector Modal swipe-down-to-close implementation
  const selectorTranslateY = useRef(new Animated.Value(0)).current;
  const selectorTouchStartPageY = useRef(0);
  const selectorScrollY = useRef(0);
  const selectorPanResponder = useRef(
    PanResponder.create({
      // Claim touch immediately if started in the selector header region or backdrop
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        selectorTouchStartPageY.current = pageY;
        return pageY < SCREEN_HEIGHT * 0.15 + 60;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        selectorScrollY.current <= 5 && g.dy > 5 && g.dy > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        selectorScrollY.current <= 5 && g.dy > 5 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) selectorTranslateY.setValue(g.dy);
      },
      onPanResponderRelease: (evt, g) => {
        const isBackdropTouch = selectorTouchStartPageY.current < SCREEN_HEIGHT * 0.15;
        if (isBackdropTouch && Math.abs(g.dy) < 10 && Math.abs(g.dx) < 10) {
          setSelectorModal(null);
          return;
        }

        if (g.dy > 80 || g.vy > 0.4) {
          Animated.timing(selectorTranslateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true })
            .start(() => setSelectorModal(null));
        } else {
          Animated.spring(selectorTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (selectorModal !== null) {
      selectorTranslateY.setValue(0);
    }
  }, [selectorModal]);

  const allMills = [...(Array.isArray(mills) ? mills : []), ...createdMills];

  const getOrderItemQualities = () => {
    if (!order || !order.items) return [];
    const qualityMap = new Map<string, any>();
    order.items.forEach((item: any) => {
      if (item.quality) {
        const qId = typeof item.quality === 'object' ? item.quality?._id : item.quality;
        if (qId) {
          const qIdStr = String(qId);
          const found = qualities.find((q: any) => String(q._id) === qIdStr);
          if (found) {
            qualityMap.set(qIdStr, found);
          } else if (typeof item.quality === 'object') {
            qualityMap.set(qIdStr, { _id: qIdStr, name: item.quality.name || 'Unknown' });
          } else {
            qualityMap.set(qIdStr, { _id: qIdStr, name: `Quality ${qIdStr.substring(0, 5)}` });
          }
        }
      }
    });
    return Array.from(qualityMap.values());
  };

  const getQualityName = (qualityId: string) => {
    if (!qualityId) return 'Select quality...';
    const orderQualities = getOrderItemQualities();
    const foundOrder = orderQualities.find((q: any) => String(q._id) === String(qualityId));
    if (foundOrder) return foundOrder.name;
    const foundGlobal = qualities.find((q: any) => String(q._id) === String(qualityId));
    if (foundGlobal) return foundGlobal.name;
    return 'Select quality...';
  };

  const getMillName = (millId: string) => {
    if (!millId) return 'Select Mill Name';
    const found = allMills.find((m: any) => String(m._id) === String(millId));
    return found ? found.name : 'Select Mill Name';
  };

  // Sync state with props — uses data signature to detect genuine changes
  useEffect(() => {
    if (!visible) {
      lastInitializedOrderIdRef.current = null;
      lastInitializedDataRef.current = null;
      lastDataSignatureRef.current = '';
      return;
    }

    const orderId = order?._id || '';
    const hasData = existingMillInputs && existingMillInputs.length > 0;
    const dataSig = hasData
      ? `${orderId}|${JSON.stringify(existingMillInputs)}`
      : `${orderId}|0`;

    const orderChanged = lastInitializedOrderIdRef.current !== orderId;
    const dataArrived = !lastInitializedDataRef.current && hasData;
    const dataChanged = hasData && lastDataSignatureRef.current !== dataSig;
    const shouldInit = orderChanged || dataArrived || dataChanged;

    if (shouldInit) {
      lastInitializedOrderIdRef.current = orderId;
      lastInitializedDataRef.current = hasData ? existingMillInputs : null;
      lastDataSignatureRef.current = dataSig;

      translateY.setValue(0);
      setSelectorModal(null);
      setSelectorSearchQuery('');
      setIsAddingNewMill(false);

      if (hasData) {
        const first = existingMillInputs[0];
        const millId = typeof first.mill === 'object' ? first.mill?._id : first.mill || '';
        setSelectedMill(millId);

        const items = existingMillInputs.map((item, idx) => ({
          id: item._id || `local-${idx}-${Date.now()}`,
          millDate: item.millDate ? item.millDate.split('T')[0] : '',
          chalanNo: item.chalanNo || '',
          greighMtr: item.greighMtr ? String(item.greighMtr) : (item.quantity ? String(item.quantity) : ''),
          pcs: item.pcs ? String(item.pcs) : '',
          quality: typeof item.quality === 'object' ? item.quality?._id : item.quality || '',
          processName: item.processName || '',
          additionalMeters: (item.additionalMeters || []).map((am: any, amIdx: number) => ({
            id: am._id || `am-local-${amIdx}-${Date.now()}`,
            quality: typeof am.quality === 'object' ? am.quality?._id : am.quality || '',
            processName: am.processName || '',
            greighMtr: am.greighMtr ? String(am.greighMtr) : '',
            pcs: am.pcs ? String(am.pcs) : ''
          }))
        }));
        setMillItems(items);
      } else {
        setSelectedMill('');
        setMillItems([
          {
            id: `local-0-${Date.now()}`,
            millDate: '',
            chalanNo: '',
            greighMtr: '',
            pcs: '',
            quality: '',
            processName: '',
            additionalMeters: []
          }
        ]);
      }
    }
  }, [visible, existingMillInputs, mills, qualities, order?._id]);

  const handleAddMillItem = () => {
    setMillItems((prev) => [
      ...prev,
      {
        id: `local-${prev.length}-${Date.now()}`,
        millDate: '',
        chalanNo: '',
        greighMtr: '',
        pcs: '',
        quality: '',
        processName: '',
        additionalMeters: []
      }
    ]);
  };

  const handleRemoveMillItem = (index: number) => {
    setMillItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAdditionalMeters = (itemIndex: number) => {
    const updated = [...millItems];
    updated[itemIndex].additionalMeters.push({
      id: `am-local-${updated[itemIndex].additionalMeters.length}-${Date.now()}`,
      quality: '',
      processName: '',
      greighMtr: '',
      pcs: ''
    });
    setMillItems(updated);
  };

  const handleRemoveAdditionalMeters = (itemIndex: number, amIndex: number) => {
    const updated = [...millItems];
    updated[itemIndex].additionalMeters = updated[itemIndex].additionalMeters.filter((_: any, i: number) => i !== amIndex);
    setMillItems(updated);
  };

  const handleRemoveMainMillItem = (itemIndex: number) => {
    const updated = [...millItems];
    const item = updated[itemIndex];
    if (item.additionalMeters && item.additionalMeters.length > 0) {
      const firstAdditional = item.additionalMeters[0];
      updated[itemIndex] = {
        ...item,
        quality: firstAdditional.quality || '',
        processName: firstAdditional.processName || '',
        greighMtr: firstAdditional.greighMtr || '',
        pcs: firstAdditional.pcs || '',
        additionalMeters: item.additionalMeters.slice(1)
      };
    }
    setMillItems(updated);
  };

  const handleSave = () => {
    if (isSaving || saveInProgress.current) return;

    if (!selectedMill) {
      Alert.alert('Error', 'Please select a mill');
      return;
    }


    // Validate entries
    for (let i = 0; i < millItems.length; i++) {
      const item = millItems[i];
      if (!item.millDate) {
        Alert.alert('Error', `Mill Date is required for Item ${i + 1}`);
        return;
      }
      if (!item.chalanNo) {
        Alert.alert('Error', `Chalan Number is required for Item ${i + 1}`);
        return;
      }
      if (!item.greighMtr) {
        Alert.alert('Error', `Greigh Meters is required for Item ${i + 1}`);
        return;
      }
      if (!item.pcs) {
        Alert.alert('Error', `Number of Pieces is required for Item ${i + 1}`);
        return;
      }
      if (!item.quality) {
        Alert.alert('Error', `Quality is required for Item ${i + 1}`);
        return;
      }
      // Validate additional cuts
      if (item.additionalMeters) {
        for (let j = 0; j < item.additionalMeters.length; j++) {
          const am = item.additionalMeters[j];
          if (!am.quality) {
            Alert.alert('Error', `Quality is required for Item ${i + 1}, Additional Cut ${j + 1}`);
            return;
          }
          if (!am.greighMtr) {
            Alert.alert('Error', `Greigh Meters is required for Item ${i + 1}, Additional Cut ${j + 1}`);
            return;
          }
          if (!am.pcs) {
            Alert.alert('Error', `Number of Pieces is required for Item ${i + 1}, Additional Cut ${j + 1}`);
            return;
          }
        }
      }
    }

    saveInProgress.current = true;
    onSave({ mill: selectedMill, millItems });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View 
            {...panResponder.panHandlers}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
          />
        </TouchableWithoutFeedback>

        <Animated.View
          {...panResponder.panHandlers}
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 24 + insets.bottom,
            height: '92%',
            transform: [{ translateY }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.3,
            shadowRadius: 24,
            elevation: 24,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 130}
            style={{ width: '100%', flex: 1 }}
          >
            {/* Visual Drag Handle */}
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
              paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.borderLight,
              marginBottom: 16
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 42, height: 42, borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : Colors.primary[50],
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <FileInput size={20} color={Colors.primary[600]} />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
                    Mill Inputs Management
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1, fontWeight: '500' }}>
                    {order ? `Order: ${getDisplayOrderId(order.orderId) || '—'}` : 'Mill details'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: isDarkMode ? '#2a2a38' : '#f1f5f9',
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <X size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Refetching Indicator */}
            {/* {isLoading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', paddingVertical: 8, borderRadius: 8, marginBottom: 16, gap: 8 }}>
                <ActivityIndicator size="small" color={isDarkMode ? '#60a5fa' : '#3b82f6'} />
                <Text style={{ fontSize: 13, color: isDarkMode ? '#60a5fa' : '#2563eb', fontWeight: '500' }}>Refreshing data...</Text>
              </View>
            )} */}

            {isLoading && (!existingMillInputs || existingMillInputs.length === 0) ? (
              <MillInputModalSkeleton theme={theme} />
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 250 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                {/* Mill Selector Header Card styled like the Party input dropdown */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Mill Name *
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View
                      style={{
                        flex: 1,
                        height: 42,
                        borderWidth: 1,
                        borderColor: theme.border,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                        flexDirection: 'row',
                        alignItems: 'center'
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          setSelectorModal({ type: 'mill', itemIndex: -1 });
                          setSelectorSearchQuery('');
                          setIsAddingNewMill(false);
                        }}
                        disabled={isReadOnly}
                        activeOpacity={isReadOnly ? 1 : 0.7}
                        style={{
                          flex: 1,
                          height: '100%',
                          justifyContent: 'center'
                        }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 13, color: selectedMill ? theme.text : theme.textTertiary, fontWeight: '500' }}>
                          {selectedMill ? getMillName(selectedMill) : 'Select Mill Name...'}
                        </Text>
                      </TouchableOpacity>

                      {selectedMill && !isReadOnly ? (
                        <TouchableOpacity
                          onPress={() => setSelectedMill('')}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={{ padding: 4, marginRight: 4 }}
                        >
                          <X size={14} color={theme.textSecondary} />
                        </TouchableOpacity>
                      ) : null}
                      <ChevronDown size={14} color={theme.textSecondary} />
                    </View>

                    {!isReadOnly && (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectorModal({ type: 'mill', itemIndex: -1 });
                          setSelectorSearchQuery('');
                          setIsAddingNewMill(true);
                        }}
                        activeOpacity={0.7}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.4)' : Colors.primary[200],
                          backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : Colors.primary[50],
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        <Plus size={16} color={Colors.primary[600]} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              {/* Items List */}
              {millItems.length === 0 ? (
                <View style={{
                  padding: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: theme.borderLight,
                  marginVertical: 20
                }}>
                  <Layers size={36} color={theme.textTertiary} style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>No items added yet</Text>
                  <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: 'center' }}>Click the button below to add a new Chalan / Item.</Text>
                </View>
              ) : (
                millItems.map((item, itemIdx) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDarkMode ? 0.2 : 0.05,
                    shadowRadius: 12,
                    elevation: 3,
                  }}
                >
                  {/* Card Title Header */}
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.borderLight,
                    paddingBottom: 10
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: Colors.primary[600]
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>
                          ENTRY #{itemIdx + 1}
                        </Text>
                      </View>
                      {selectedMill ? (
                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
                          ({getMillName(selectedMill)})
                        </Text>
                      ) : null}
                    </View>
                    {!isReadOnly && (item.id.startsWith('local-') || isMaster) && millItems.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveMillItem(itemIdx)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        <Trash2 size={15} color={Colors.error[600]} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Grid layout for Date & Chalan */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                    {/* Mill Date */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.2 }}>
                        Mill Date *
                      </Text>
                      <TouchableOpacity
                        onPress={() => setActiveDatePickerIndex(itemIdx)}
                        disabled={isReadOnly}
                        activeOpacity={isReadOnly ? 1 : 0.7}
                        style={{
                          height: 42,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: theme.border,
                          backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: item.millDate ? theme.text : theme.textTertiary, fontWeight: '500' }}>
                          {item.millDate ? toDisplay(item.millDate) : 'Select date'}
                        </Text>
                        <Calendar size={15} color={Colors.primary[600]} />
                      </TouchableOpacity>
                    </View>

                    {/* Chalan Number */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.2 }}>
                        Chalan Number *
                      </Text>
                      <TextInput
                        style={{
                          height: 42,
                          borderWidth: 1,
                          borderColor: theme.border,
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          color: theme.text,
                          backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                          fontSize: 13,
                          fontWeight: '500'
                        }}
                        value={item.chalanNo}
                        onChangeText={(val) => {
                          const updated = [...millItems];
                          updated[itemIdx].chalanNo = val;
                          setMillItems(updated);
                        }}
                        placeholder="Chalan No."
                        placeholderTextColor={theme.textTertiary}
                        editable={!isReadOnly}
                      />
                    </View>
                  </View>
                                 {/* CUT 1 card container */}
                  <View
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 8,
                      borderWidth: 1.5,
                      borderColor: theme.borderLight,
                    }}
                  >
                    {item.additionalMeters && item.additionalMeters.length > 0 && (
                      <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                        paddingBottom: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.borderLight
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, letterSpacing: 0.5 }}>
                          MAIN CUT (CUT #1)
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveMainMillItem(itemIdx)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingVertical: 3,
                            paddingHorizontal: 6,
                            borderRadius: 5,
                            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                          }}
                        >
                          <Minus size={12} color={Colors.error[600]} />
                          <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.error[600] }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Grid layout for Quality & Process */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      {/* Quality */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4, letterSpacing: 0.2 }}>
                          Quality *
                        </Text>
                        <View
                          style={{
                            height: 36,
                            borderWidth: 1,
                            borderColor: theme.border,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                            flexDirection: 'row',
                            alignItems: 'center'
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => {
                              setSelectorModal({ type: 'quality', itemIndex: itemIdx });
                              setSelectorSearchQuery('');
                            }}
                            disabled={isReadOnly}
                            activeOpacity={isReadOnly ? 1 : 0.7}
                            style={{
                              flex: 1,
                              height: '100%',
                              justifyContent: 'center'
                            }}
                          >
                            <Text numberOfLines={1} style={{ fontSize: 12, color: item.quality ? theme.text : theme.textTertiary, fontWeight: '500' }}>
                              {getQualityName(item.quality)}
                            </Text>
                          </TouchableOpacity>
                          {item.quality && !isReadOnly ? (
                            <TouchableOpacity
                              onPress={() => {
                                const updated = [...millItems];
                                updated[itemIdx].quality = '';
                                setMillItems(updated);
                              }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              style={{ padding: 4, marginRight: 2 }}
                            >
                              <X size={12} color={theme.textSecondary} />
                            </TouchableOpacity>
                          ) : null}
                          <ChevronDown size={12} color={theme.textSecondary} />
                        </View>
                      </View>

                      {/* Process */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4, letterSpacing: 0.2 }}>
                          Process
                        </Text>
                        <View
                          style={{
                            height: 36,
                            borderWidth: 1,
                            borderColor: theme.border,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                            flexDirection: 'row',
                            alignItems: 'center'
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => {
                              setSelectorModal({ type: 'process', itemIndex: itemIdx });
                            }}
                            disabled={isReadOnly}
                            activeOpacity={isReadOnly ? 1 : 0.7}
                            style={{
                              flex: 1,
                              height: '100%',
                              justifyContent: 'center'
                            }}
                          >
                            <Text numberOfLines={1} style={{ fontSize: 12, color: item.processName ? theme.text : theme.textTertiary, fontWeight: '500' }}>
                              {item.processName || 'Select process...'}
                            </Text>
                          </TouchableOpacity>
                          {item.processName && !isReadOnly ? (
                            <TouchableOpacity
                              onPress={() => {
                                const updated = [...millItems];
                                updated[itemIdx].processName = '';
                                setMillItems(updated);
                              }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              style={{ padding: 4, marginRight: 2 }}
                            >
                              <X size={12} color={theme.textSecondary} />
                            </TouchableOpacity>
                          ) : null}
                          <ChevronDown size={12} color={theme.textSecondary} />
                        </View>
                      </View>
                    </View>

                    {/* Grid layout for Meters & Pieces */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {/* Meters */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4, letterSpacing: 0.2 }}>
                          Greigh Meters *
                        </Text>
                        <TextInput
                          style={{
                            height: 36,
                            borderWidth: 1,
                            borderColor: theme.border,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            color: theme.text,
                            backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                            fontSize: 12,
                            fontWeight: '600'
                          }}
                          value={item.greighMtr}
                          onChangeText={(val) => {
                            const updated = [...millItems];
                            updated[itemIdx].greighMtr = val;
                            setMillItems(updated);
                          }}
                          placeholder="Meters"
                          placeholderTextColor={theme.textTertiary}
                          keyboardType="numeric"
                          editable={!isReadOnly}
                        />
                      </View>

                      {/* Pieces */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4, letterSpacing: 0.2 }}>
                          Pieces *
                        </Text>
                        <TextInput
                          style={{
                            height: 36,
                            borderWidth: 1,
                            borderColor: theme.border,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            color: theme.text,
                            backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                            fontSize: 12,
                            fontWeight: '600'
                          }}
                          value={item.pcs}
                          onChangeText={(val) => {
                            const updated = [...millItems];
                            updated[itemIdx].pcs = val;
                            setMillItems(updated);
                          }}
                          placeholder="Pieces"
                          placeholderTextColor={theme.textTertiary}
                          keyboardType="numeric"
                          editable={!isReadOnly}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Additional Meters nested list */}
                  {item.additionalMeters && item.additionalMeters.length > 0 && (
                    <View style={{
                      marginTop: 10,
                      paddingTop: 12,
                      borderTopWidth: 1.5,
                      borderTopColor: theme.borderLight,
                    }}>
                      {item.additionalMeters.map((am: any, amIdx: number) => (
                        <View
                          key={am.id}
                          style={{
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                            borderRadius: 12,
                            padding: 10,
                            marginBottom: 8,
                            borderWidth: 1.5,
                            borderColor: theme.borderLight,
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.borderLight }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, letterSpacing: 0.5 }}>
                              ADDITIONAL CUT #{amIdx + 2}
                            </Text>
                            {!isReadOnly && (
                              <TouchableOpacity
                                onPress={() => handleRemoveAdditionalMeters(itemIdx, amIdx)}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  paddingVertical: 3,
                                  paddingHorizontal: 6,
                                  borderRadius: 5,
                                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                                }}
                              >
                                <Minus size={12} color={Colors.error[600]} />
                                <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.error[600] }}>Remove</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {/* Nested Quality & Process row */}
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                            <View style={{ flex: 1 }}>
                              <View
                                style={{
                                  height: 36,
                                  borderWidth: 1,
                                  borderColor: theme.border,
                                  borderRadius: 8,
                                  paddingHorizontal: 10,
                                  backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                                  flexDirection: 'row',
                                  alignItems: 'center'
                                }}
                              >
                                <TouchableOpacity
                                  onPress={() => {
                                    setSelectorModal({ type: 'quality', itemIndex: itemIdx, additionalIndex: amIdx });
                                    setSelectorSearchQuery('');
                                  }}
                                  disabled={isReadOnly}
                                  activeOpacity={isReadOnly ? 1 : 0.7}
                                  style={{
                                    flex: 1,
                                    height: '100%',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Text numberOfLines={1} style={{ fontSize: 12, color: am.quality ? theme.text : theme.textTertiary, fontWeight: '500' }}>
                                    {getQualityName(am.quality)}
                                  </Text>
                                </TouchableOpacity>
                                {am.quality && !isReadOnly ? (
                                  <TouchableOpacity
                                    onPress={() => {
                                      const updated = [...millItems];
                                      updated[itemIdx].additionalMeters[amIdx].quality = '';
                                      setMillItems(updated);
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    style={{ padding: 4, marginRight: 2 }}
                                  >
                                    <X size={12} color={theme.textSecondary} />
                                  </TouchableOpacity>
                                ) : null}
                                <ChevronDown size={12} color={theme.textSecondary} />
                              </View>
                            </View>

                            <View style={{ flex: 1 }}>
                              <View
                                style={{
                                  height: 36,
                                  borderWidth: 1,
                                  borderColor: theme.border,
                                  borderRadius: 8,
                                  paddingHorizontal: 10,
                                  backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                                  flexDirection: 'row',
                                  alignItems: 'center'
                                }}
                              >
                                <TouchableOpacity
                                  onPress={() => {
                                    setSelectorModal({ type: 'process', itemIndex: itemIdx, additionalIndex: amIdx });
                                  }}
                                  disabled={isReadOnly}
                                  activeOpacity={isReadOnly ? 1 : 0.7}
                                  style={{
                                    flex: 1,
                                    height: '100%',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Text numberOfLines={1} style={{ fontSize: 12, color: am.processName ? theme.text : theme.textTertiary, fontWeight: '500' }}>
                                    {am.processName || 'Select process...'}
                                  </Text>
                                </TouchableOpacity>
                                {am.processName && !isReadOnly ? (
                                  <TouchableOpacity
                                    onPress={() => {
                                      const updated = [...millItems];
                                      updated[itemIdx].additionalMeters[amIdx].processName = '';
                                      setMillItems(updated);
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    style={{ padding: 4, marginRight: 2 }}
                                  >
                                    <X size={12} color={theme.textSecondary} />
                                  </TouchableOpacity>
                                ) : null}
                                <ChevronDown size={12} color={theme.textSecondary} />
                              </View>
                            </View>
                          </View>

                          {/* Nested Meters & Pieces row */}
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flex: 1 }}>
                              <TextInput
                                style={{
                                  height: 36,
                                  borderWidth: 1,
                                  borderColor: theme.border,
                                  borderRadius: 8,
                                  paddingHorizontal: 10,
                                  color: theme.text,
                                  backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                                  fontSize: 12,
                                  fontWeight: '600'
                                }}
                                value={am.greighMtr}
                                onChangeText={(val) => {
                                  const updated = [...millItems];
                                  updated[itemIdx].additionalMeters[amIdx].greighMtr = val;
                                  setMillItems(updated);
                                }}
                                placeholder="Meters"
                                placeholderTextColor={theme.textTertiary}
                                keyboardType="numeric"
                                returnKeyType="done"
                                editable={!isReadOnly}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <TextInput
                                style={{
                                  height: 36,
                                  borderWidth: 1,
                                  borderColor: theme.border,
                                  borderRadius: 8,
                                  paddingHorizontal: 10,
                                  color: theme.text,
                                  backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                                  fontSize: 12,
                                  fontWeight: '600'
                                }}
                                value={am.pcs}
                                onChangeText={(val) => {
                                  const updated = [...millItems];
                                  updated[itemIdx].additionalMeters[amIdx].pcs = val;
                                  setMillItems(updated);
                                }}
                                placeholder="Pieces"
                                placeholderTextColor={theme.textTertiary}
                                keyboardType="numeric"
                                returnKeyType="done"
                                editable={!isReadOnly}
                              />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Add Additional Cut Button */}
                  {!isReadOnly && (
                    <TouchableOpacity
                      onPress={() => handleAddAdditionalMeters(itemIdx)}
                      style={{
                        height: 36,
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.4)' : Colors.primary[200],
                        borderStyle: 'dashed',
                        borderRadius: 10,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)',
                        marginTop: 10
                      }}
                    >
                      <Plus size={14} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>Add More Meters & Pieces</Text>
                    </TouchableOpacity>
                  )}

                </View>
              ))
              )}

              {/* Add Another Item / Chalan Button */}
              {!isReadOnly && (
                <TouchableOpacity
                  onPress={handleAddMillItem}
                  style={{
                    height: 48,
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.5)' : Colors.primary[300],
                    borderStyle: 'dashed',
                    borderRadius: 16,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
                    marginBottom: 24
                  }}
                >
                  <Plus size={18} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 14, fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>Add Another Item / Chalan</Text>
                </TouchableOpacity>
              )}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {isReadOnly ? (
                  <TouchableOpacity
                    onPress={onClose}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      height: 50,
                      backgroundColor: isDarkMode ? Colors.neutral[700] : Colors.neutral[600],
                      borderRadius: 14,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: isDarkMode ? 'transparent' : Colors.neutral[400],
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 12,
                      elevation: 6,
                    }}
                  >
                    <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                      Close
                    </Text>
                  </TouchableOpacity>
                ) : existingMillInputs && existingMillInputs.length > 0 && onDelete && isMaster ? (
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
                      activeOpacity={0.8}
                      style={{
                        flex: 1.8,
                        height: 50,
                        backgroundColor: isSaving ? (isDarkMode ? Colors.primary[800] : Colors.primary[400]) : (isDarkMode ? Colors.primary[700] : Colors.primary[600]),
                        borderRadius: 14,
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: isDarkMode ? 'transparent' : Colors.primary[400],
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 6,
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                          Save All Mill Inputs
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      height: 50,
                      backgroundColor: isSaving ? (isDarkMode ? Colors.primary[800] : Colors.primary[400]) : (isDarkMode ? Colors.primary[700] : Colors.primary[600]),
                      borderRadius: 14,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: isDarkMode ? 'transparent' : Colors.primary[400],
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 12,
                      elevation: 6,
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                        Save All Mill Inputs
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

            </ScrollView>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      {/* Selector Bottom Sheet Modal */}
      <Modal
        visible={selectorModal !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectorModal(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback onPress={() => setSelectorModal(null)}>
            <View 
              {...selectorPanResponder.panHandlers}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
            />
          </TouchableWithoutFeedback>

          <Animated.View
            {...selectorPanResponder.panHandlers}
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 24 + insets.bottom,
              height: '85%',
              borderWidth: 1,
              borderColor: theme.border,
              transform: [{ translateY: selectorTranslateY }],
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 40}
              style={{ width: '100%', flex: 1 }}
            >
              {/* Visual Drag Handle */}
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#3a3a4a' : '#e2e8f0' }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                  {selectorModal?.type === 'mill' ? 'Select Mill' : selectorModal?.type === 'quality' ? 'Select Quality' : 'Select Process'}
                </Text>
                <TouchableOpacity onPress={() => setSelectorModal(null)} style={{ padding: 4 }}>
                  <X size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {selectorModal?.type !== 'process' && (
                <TextInput
                  placeholder={`Search ${selectorModal?.type}...`}
                  placeholderTextColor={theme.textTertiary}
                  value={selectorSearchQuery}
                  onChangeText={setSelectorSearchQuery}
                  style={{
                    height: 42,
                    borderRadius: 10,
                    backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[100],
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    paddingHorizontal: 14,
                    fontSize: 13,
                    color: theme.text,
                    marginBottom: 12,
                  }}
                />
              )}

              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={(e) => { selectorScrollY.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                {selectorModal?.type === 'mill' && (
                  <>
                    {/* Create New Mill Card/Button at the top */}
                    <View style={{ marginTop: 4, marginBottom: 12 }}>
                      {isAddingNewMill ? (
                        <View style={{
                          padding: 16,
                          borderRadius: 16,
                          backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                          borderWidth: 1,
                          borderColor: isDarkMode ? Colors.primary[400] : Colors.primary[600],
                          marginBottom: 12,
                          gap: 12,
                        }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Create New Mill</Text>
                          <TextInput
                            style={{
                              height: 44,
                              borderWidth: 1,
                              borderColor: theme.border,
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              fontSize: 13,
                              color: theme.text,
                              backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white
                            }}
                            value={newMillName}
                            onChangeText={setNewMillName}
                            placeholder="Enter mill name..."
                            placeholderTextColor={theme.textTertiary}
                            autoFocus
                          />
                          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                            <TouchableOpacity
                              onPress={() => {
                                setIsAddingNewMill(false);
                                setNewMillName('');
                              }}
                              style={{
                                paddingHorizontal: 16,
                                height: 36,
                                borderRadius: 8,
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[200],
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              disabled={isSavingNewMill || !newMillName.trim()}
                              onPress={async () => {
                                try {
                                  setIsSavingNewMill(true);
                                  const { data } = await api.post('/api/mills', { name: newMillName.trim() });
                                  const createdMill = data?.data;
                                  if (createdMill && createdMill._id) {
                                    setCreatedMills((prev) => [...prev, createdMill]);
                                    setSelectedMill(createdMill._id);
                                    setNewMillName('');
                                    setIsAddingNewMill(false);
                                    setSelectorModal(null);
                                  }
                                } catch (err: any) {
                                  const errMsg = err.response?.data?.message || 'Failed to create mill';
                                  Alert.alert('Error', errMsg);
                                } finally {
                                  setIsSavingNewMill(false);
                                }
                              }}
                              style={{
                                paddingHorizontal: 16,
                                height: 36,
                                backgroundColor: isDarkMode ? Colors.primary[700] : Colors.primary[600],
                                borderRadius: 8,
                                justifyContent: 'center',
                                alignItems: 'center',
                                flexDirection: 'row',
                                gap: 6
                              }}
                            >
                              {isSavingNewMill ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Create</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setIsAddingNewMill(true)}
                          style={{
                            height: 42,
                            borderWidth: 1,
                            borderColor: isDarkMode ? Colors.primary[400] : Colors.primary[600],
                            borderStyle: 'dashed',
                            borderRadius: 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>+ Add New Mill</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {allMills
                      .filter((m: any) => !selectorSearchQuery || m.name?.toLowerCase().includes(selectorSearchQuery.toLowerCase()))
                      .map((m: any) => {
                        const isSelected = selectedMill === m._id;
                        return (
                          <TouchableOpacity
                            key={m._id}
                            onPress={() => {
                              setSelectedMill(m._id);
                              setSelectorModal(null);
                            }}
                            style={{
                              paddingVertical: 14,
                              borderBottomWidth: 1,
                              borderBottomColor: theme.borderLight
                            }}
                          >
                            <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? (isDarkMode ? Colors.primary[400] : Colors.primary[600]) : theme.text }}>
                              {m.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </>
                )}

                {selectorModal?.type === 'quality' && (
                  qualities
                    .filter((q: any) => !selectorSearchQuery || q.name?.toLowerCase().includes(selectorSearchQuery.toLowerCase()))
                    .map((q: any) => {
                      const { itemIndex, additionalIndex } = selectorModal;
                      const isSelected = additionalIndex !== undefined
                        ? millItems[itemIndex]?.additionalMeters[additionalIndex]?.quality === q._id
                        : millItems[itemIndex]?.quality === q._id;
                      return (
                        <TouchableOpacity
                          key={q._id}
                          onPress={() => {
                            const updated = [...millItems];
                            if (additionalIndex !== undefined) {
                              updated[itemIndex].additionalMeters[additionalIndex].quality = q._id;
                            } else {
                              updated[itemIndex].quality = q._id;
                            }
                            setMillItems(updated);
                            setSelectorModal(null);
                          }}
                          style={{
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: theme.borderLight
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? (isDarkMode ? Colors.primary[400] : Colors.primary[600]) : theme.text }}>
                            {q.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                )}

                {selectorModal?.type === 'process' && (
                  PROCESS_OPTIONS.map((pName) => {
                    const { itemIndex, additionalIndex } = selectorModal;
                    const isSelected = additionalIndex !== undefined
                      ? millItems[itemIndex]?.additionalMeters[additionalIndex]?.processName === pName
                      : millItems[itemIndex]?.processName === pName;
                    return (
                      <TouchableOpacity
                        key={pName}
                        onPress={() => {
                          const updated = [...millItems];
                          if (additionalIndex !== undefined) {
                            updated[itemIndex].additionalMeters[additionalIndex].processName = pName;
                          } else {
                            updated[itemIndex].processName = pName;
                          }
                          setMillItems(updated);
                          setSelectorModal(null);
                        }}
                        style={{
                          paddingVertical: 14,
                          borderBottomWidth: 1,
                          borderBottomColor: theme.borderLight
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? (isDarkMode ? Colors.primary[400] : Colors.primary[600]) : theme.text }}>
                          {pName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={activeDatePickerIndex !== null}
        onClose={() => setActiveDatePickerIndex(null)}
        value={activeDatePickerIndex !== null ? toDisplay(millItems[activeDatePickerIndex]?.millDate) : ''}
        onSelectDate={(ddmmyyyy) => {
          if (activeDatePickerIndex !== null) {
            const updated = [...millItems];
            updated[activeDatePickerIndex].millDate = toISO(ddmmyyyy);
            setMillItems(updated);
          }
          setActiveDatePickerIndex(null);
        }}
      />

      <DeleteConfirmModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={onDelete || (() => {})}
        title="Delete All Mill Inputs"
        message="Are you sure you want to delete all mill inputs for this order? This action cannot be undone."
        confirmText="Delete All"
        isDeleting={isDeleting}
      />
    </Modal>
  );
}
