import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert, Animated, PanResponder, Dimensions, TouchableWithoutFeedback, useWindowDimensions, Pressable } from 'react-native';
import { ChevronDown, X, Calendar, FileOutput, Trash2, Plus, Minus, Layers } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import DatePickerModal from '../shared/DatePickerModal';
import api from '../../services/api';
import { getDisplayOrderId } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useQueryClient, useMutation } from '@tanstack/react-query';

interface MillOutputModalProps {
  visible: boolean;
  onClose: () => void;
  order: any;
  existingMillOutputs: any[];
  qualities: any[];
  isDarkMode: boolean;
  theme: any;
  onSave: (payload: { millOutputItems: any[] }) => void;
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

function MillOutputModalSkeleton({ theme }: { theme: any }) {
  return (
    <View style={{ gap: 16, padding: 16 }}>
      {[1, 2].map((key) => (
        <View
          key={key}
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
      ))}
    </View>
  );
}

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

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

export default function MillOutputModal({
  visible,
  onClose,
  order,
  existingMillOutputs,
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
}: MillOutputModalProps) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isLargeScreen, modalMaxWidth } = useResponsiveLayout();
  const queryClient = useQueryClient();

  const [deleteWarning, setDeleteWarning] = useState<{ title: string; message: string } | null>(null);

  const [deleteQualityTarget, setDeleteQualityTarget] = useState<any>(null);
  const deleteQualityMutation = useMutation({
    mutationFn: async (qualityId: string) => {
      const { data } = await api.delete(`/api/qualities/${qualityId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualities'] });
      setDeleteQualityTarget(null);
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to delete quality';
      setDeleteWarning({
        title: 'Cannot Delete Quality',
        message: errMsg,
      });
      setDeleteQualityTarget(null);
    }
  });

  const [millOutputItems, setMillOutputItems] = useState<any[]>([]);
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

  // Bottom Sheet selector state for quality selection
  const [selectorModal, setSelectorModal] = useState<{
    itemIndex: number;
    additionalIndex?: number;
  } | null>(null);
  const [selectorSearchQuery, setSelectorSearchQuery] = useState('');

  // Swipe-down-to-close implementation
  const scrollY = useRef(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const translateY = useRef(new Animated.Value(0)).current;
  const touchStartPageY = useRef(0);

  const dimensionsRef = useRef({ SCREEN_WIDTH, SCREEN_HEIGHT });
  dimensionsRef.current = { SCREEN_WIDTH, SCREEN_HEIGHT };

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
        const currentScreenHeight = dimensionsRef.current.SCREEN_HEIGHT;
        return pageY < currentScreenHeight * 0.15 + 60;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        selectorScrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        selectorScrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) selectorTranslateY.setValue(g.dy);
      },
      onPanResponderRelease: (evt, g) => {
        const currentScreenHeight = dimensionsRef.current.SCREEN_HEIGHT;
        const isBackdropTouch = selectorTouchStartPageY.current < currentScreenHeight * 0.15;
        if (isBackdropTouch && Math.abs(g.dy) < 10 && Math.abs(g.dx) < 10) {
          setSelectorModal(null);
          return;
        }

        if (g.dy > 50 || g.vy > 0.2) {
          Animated.timing(selectorTranslateY, { toValue: currentScreenHeight, duration: 220, useNativeDriver: true })
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

  // Helper function to group mill outputs by bill and date (same as web)
  const groupMillOutputsByBillAndDate = (millOutputs: any[]) => {
    const groups: any[] = [];
    if (!millOutputs) return groups;

    // Sort outputs by creation date to ensure consistent ordering
    const sortedOutputs = [...millOutputs].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateA.getTime() - dateB.getTime();
    });

    sortedOutputs.forEach((output: any) => {
      const dateStr = output.recdDate ? output.recdDate.split('T')[0] : '';
      const existingGroup = groups.find(group =>
        group.millBillNo === output.millBillNo && group.recdDate === dateStr
      );

      if (existingGroup) {
        existingGroup.additionalFinishedMtr.push({
          _id: output._id,
          meters: output.finishedMtr ? String(output.finishedMtr) : '',
          quality: typeof output.quality === 'object' ? (output.quality?._id || '') : (output.quality || '')
        });
      } else {
        groups.push({
          id: output._id || `group-${Date.now()}-${Math.random()}`,
          recdDate: dateStr,
          millBillNo: output.millBillNo || '',
          finishedMtr: output.finishedMtr ? String(output.finishedMtr) : '',
          millRate: output.millRate ? String(output.millRate) : '',
          quality: typeof output.quality === 'object' ? (output.quality?._id || '') : (output.quality || ''),
          additionalFinishedMtr: []
        });
      }
    });

    return groups;
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
    const hasData = existingMillOutputs && existingMillOutputs.length > 0;
    const dataSig = hasData
      ? `${orderId}|${JSON.stringify(existingMillOutputs)}`
      : `${orderId}|0`;

    const orderChanged = lastInitializedOrderIdRef.current !== orderId;
    const dataArrived = !lastInitializedDataRef.current && hasData;
    const dataChanged = hasData && lastDataSignatureRef.current !== dataSig;
    const shouldInit = orderChanged || dataArrived || dataChanged;

    if (shouldInit) {
      lastInitializedOrderIdRef.current = orderId;
      lastInitializedDataRef.current = hasData ? existingMillOutputs : null;
      lastDataSignatureRef.current = dataSig;

      translateY.setValue(0);
      setSelectorModal(null);
      setSelectorSearchQuery('');

      if (hasData) {
        const grouped = groupMillOutputsByBillAndDate(existingMillOutputs);
        setMillOutputItems(grouped);
      } else {
        setMillOutputItems([
          {
            id: `local-0-${Date.now()}`,
            recdDate: '',
            millBillNo: '',
            finishedMtr: '',
            millRate: '',
            quality: '',
            additionalFinishedMtr: []
          }
        ]);
      }
    }
  }, [visible, existingMillOutputs, qualities, order?._id]);

  const handleAddMillOutputItem = () => {
    const lastItem = millOutputItems[millOutputItems.length - 1];
    const defaultDate = (lastItem && lastItem.recdDate) ? lastItem.recdDate : '';
    const defaultRate = lastItem ? lastItem.millRate : '';

    setMillOutputItems((prev) => [
      ...prev,
      {
        id: `local-${prev.length}-${Date.now()}`,
        recdDate: defaultDate,
        millBillNo: '',
        finishedMtr: '',
        millRate: defaultRate,
        quality: '',
        additionalFinishedMtr: []
      }
    ]);
  };

  const handleRemoveMillOutputItem = (index: number) => {
    setMillOutputItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAdditionalMeters = (itemIndex: number) => {
    const updated = [...millOutputItems];
    updated[itemIndex].additionalFinishedMtr.push({
      _id: `add-local-${updated[itemIndex].additionalFinishedMtr.length}-${Date.now()}`,
      meters: '',
      quality: ''
    });
    setMillOutputItems(updated);
  };

  const handleRemoveAdditionalMeters = (itemIndex: number, addIndex: number) => {
    const updated = [...millOutputItems];
    updated[itemIndex].additionalFinishedMtr = updated[itemIndex].additionalFinishedMtr.filter((_: any, i: number) => i !== addIndex);
    setMillOutputItems(updated);
  };

  const handleRemoveMainFinishedMtr = (itemIndex: number) => {
    const updated = [...millOutputItems];
    const item = updated[itemIndex];
    if (item.additionalFinishedMtr && item.additionalFinishedMtr.length > 0) {
      const firstAdditional = item.additionalFinishedMtr[0];
      updated[itemIndex] = {
        ...item,
        quality: firstAdditional.quality || '',
        finishedMtr: firstAdditional.meters || '',
        additionalFinishedMtr: item.additionalFinishedMtr.slice(1)
      };
    }
    setMillOutputItems(updated);
  };

  const handleSave = () => {
    if (isSaving || saveInProgress.current) return;



    // Validate entries
    for (let i = 0; i < millOutputItems.length; i++) {
      const item = millOutputItems[i];
      if (!item.recdDate) {
        Alert.alert('Error', `Received Date is required for Item ${i + 1}`);
        return;
      }
      if (!item.millBillNo) {
        Alert.alert('Error', `Mill Bill Number is required for Item ${i + 1}`);
        return;
      }
      if (!item.finishedMtr) {
        Alert.alert('Error', `Finished Meters is required for Item ${i + 1}`);
        return;
      }
      if (!item.quality) {
        Alert.alert('Error', `Quality is required for Item ${i + 1}`);
        return;
      }

      // Validate additional finished meters
      if (item.additionalFinishedMtr) {
        for (let j = 0; j < item.additionalFinishedMtr.length; j++) {
          const add = item.additionalFinishedMtr[j];
          if (!add.meters) {
            Alert.alert('Error', `Finished Meters is required for Item ${i + 1} - Additional Cut ${j + 2}`);
            return;
          }
          if (!add.quality) {
            Alert.alert('Error', `Quality is required for Item ${i + 1} - Additional Cut ${j + 2}`);
            return;
          }
        }
      }
    }

    saveInProgress.current = true;
    onSave({ millOutputItems });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0)', justifyContent: 'flex-end' }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View 
            {...panResponder.panHandlers}
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.05)'
            }} 
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
            paddingBottom: isLargeScreen ? 24 : 0,
            height: '92%',
            maxWidth: isLargeScreen ? modalMaxWidth : '100%',
            width: '100%',
            alignSelf: 'center',
            transform: [{ translateY }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.3,
            shadowRadius: 24,
            elevation: 24,
          }}
        >
          <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            style={{ width: '100%', flex: 1 }}
          >
            <View style={{ backgroundColor: 'transparent' }}>
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
                    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <FileOutput size={20} color={Colors.success[600]} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
                      Mill Output Management
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1, fontWeight: '500' }}>
                      {order ? `Order: ${getDisplayOrderId(order.orderId) || '—'}` : 'Mill outputs'}
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
            </View>

            {/* Refetching Indicator */}
            {/* {isLoading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', paddingVertical: 8, borderRadius: 8, marginBottom: 16, gap: 8 }}>
                <ActivityIndicator size="small" color={isDarkMode ? '#60a5fa' : '#3b82f6'} />
                <Text style={{ fontSize: 13, color: isDarkMode ? '#60a5fa' : '#2563eb', fontWeight: '500' }}>Refreshing data...</Text>
              </View>
            )} */}

            {isLoading && (!existingMillOutputs || existingMillOutputs.length === 0) ? (
              <MillOutputModalSkeleton theme={theme} />
            ) : isReadOnly ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{
                  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                  padding: 24,
                  alignItems: 'center',
                  gap: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                  marginTop: 20
                }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: existingMillOutputs && existingMillOutputs.length > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    justifyContent: 'center', alignItems: 'center'
                  }}>
                    <FileOutput size={22} color={existingMillOutputs && existingMillOutputs.length > 0 ? '#22c55e' : '#ef4444'} />
                  </View>

                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: isDarkMode ? '#64748b' : '#94a3b8', letterSpacing: 0.5 }}>
                      Mill Output Status
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: existingMillOutputs && existingMillOutputs.length > 0 ? '#22c55e' : '#ef4444', textAlign: 'center', marginTop: 8 }}>
                      {existingMillOutputs && existingMillOutputs.length > 0 ? 'Completed / Done' : 'Pending / Not Done'}
                    </Text>
                  </View>
                </View>

                {/* Close Button */}
                <TouchableOpacity
                  onPress={onClose}
                  activeOpacity={0.8}
                  style={{
                    height: 50,
                    backgroundColor: isDarkMode ? Colors.neutral[700] : Colors.neutral[600],
                    borderRadius: 14,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: 24,
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
              </ScrollView>
            ) : (
              <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {/* Items List */}
              {millOutputItems.length === 0 ? (
                <View style={{
                  padding: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: theme.borderLight,
                  marginVertical: 20
                }}>
                  <Layers size={36} color={theme.textTertiary} style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>No items added yet</Text>
                  <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: 'center' }}>Click the button below to add a new Mill Output.</Text>
                </View>
              ) : (
                millOutputItems.map((item, itemIdx) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 20,
                    borderWidth: 1.5,
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
                        backgroundColor: Colors.success[600]
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>
                          ENTRY #{itemIdx + 1}
                        </Text>
                      </View>
                      {item.millBillNo ? (
                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
                          (Bill: {item.millBillNo})
                        </Text>
                      ) : null}
                    </View>
                    {!isReadOnly && (item.id.startsWith('local-') || isMaster) && millOutputItems.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveMillOutputItem(itemIdx)}
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

                  {/* Date and Bill Number fields */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                    {/* Recd Date */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.2 }}>
                        Recd Date *
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
                          borderWidth: 1.5,
                          borderColor: theme.border,
                          backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: item.recdDate ? theme.text : theme.textTertiary, fontWeight: '500', flex: 1 }}>
                          {item.recdDate ? toDisplay(item.recdDate) : 'Select date'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {item.recdDate && !isReadOnly ? (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                const updated = [...millOutputItems];
                                updated[itemIdx].recdDate = '';
                                setMillOutputItems(updated);
                              }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <X size={14} color={theme.textSecondary} />
                            </TouchableOpacity>
                          ) : null}
                          <Calendar size={15} color={Colors.success[600]} />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Mill Bill Number */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.2 }}>
                        Mill Bill No. *
                      </Text>
                      <TextInput
                        style={{
                          height: 42,
                          borderWidth: 1.5,
                          borderColor: theme.border,
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          color: theme.text,
                          backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                          fontSize: 13,
                          fontWeight: '500'
                        }}
                        value={item.millBillNo}
                        onChangeText={(val) => {
                          const updated = [...millOutputItems];
                          updated[itemIdx].millBillNo = val;
                          setMillOutputItems(updated);
                        }}
                        placeholder="Bill No."
                        placeholderTextColor={theme.textTertiary}
                        editable={!isReadOnly}
                      />
                    </View>
                  </View>

                  {/* CUT M1 card container */}
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
                    {!isReadOnly && item.additionalFinishedMtr && item.additionalFinishedMtr.length > 0 && (
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
                          CUT M1
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveMainFinishedMtr(itemIdx)}
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

                    {/* Quality & Finished Meters fields */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {/* Quality Selection */}
                      <View style={{ flex: 1.2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4, letterSpacing: 0.2 }}>
                          Quality *
                        </Text>
                        <View
                          style={{
                            height: 36,
                            borderWidth: 1.5,
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
                              setSelectorModal({ itemIndex: itemIdx });
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
                                const updated = [...millOutputItems];
                                updated[itemIdx].quality = '';
                                setMillOutputItems(updated);
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

                      {/* Finished Meters */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4, letterSpacing: 0.2 }}>
                          Finished Mtr *
                        </Text>
                        <TextInput
                          style={{
                            height: 36,
                            borderWidth: 1.5,
                            borderColor: theme.border,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            color: theme.text,
                            backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                            fontSize: 12,
                            fontWeight: '600'
                          }}
                          value={item.finishedMtr}
                          onChangeText={(val) => {
                            const updated = [...millOutputItems];
                            updated[itemIdx].finishedMtr = val;
                            setMillOutputItems(updated);
                          }}
                          placeholder="Meters"
                          placeholderTextColor={theme.textTertiary}
                          keyboardType="numeric"
                          editable={!isReadOnly}
                        />
                      </View>
                    </View>
                  </View>



                  {/* Additional Finished Meters & Rates nested list */}
                  <View style={{
                    marginTop: 10,
                    paddingTop: 12,
                    borderTopWidth: 1.5,
                    borderTopColor: theme.borderLight,
                  }}>
                    {item.additionalFinishedMtr?.map((add: any, addIdx: number) => (
                      <View
                        key={add._id || addIdx}
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
                            CUT M{addIdx + 2}
                          </Text>
                          {!isReadOnly && (
                            <TouchableOpacity
                              onPress={() => handleRemoveAdditionalMeters(itemIdx, addIdx)}
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

                        {/* Additional row inputs */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {/* Quality Selector */}
                          <View style={{ flex: 1.2 }}>
                            <View
                              style={{
                                height: 36,
                                borderWidth: 1.5,
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
                                  setSelectorModal({ itemIndex: itemIdx, additionalIndex: addIdx });
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
                                <Text numberOfLines={1} style={{ fontSize: 12, color: add.quality ? theme.text : theme.textTertiary, fontWeight: '500' }}>
                                  {getQualityName(add.quality)}
                                </Text>
                              </TouchableOpacity>
                              {add.quality && !isReadOnly ? (
                                <TouchableOpacity
                                  onPress={() => {
                                    const updated = [...millOutputItems];
                                    updated[itemIdx].additionalFinishedMtr[addIdx].quality = '';
                                    setMillOutputItems(updated);
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

                          {/* Finished Meters */}
                          <View style={{ flex: 1 }}>
                            <TextInput
                              style={{
                                height: 36,
                                borderWidth: 1.5,
                                borderColor: theme.border,
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                color: theme.text,
                                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                                fontSize: 12,
                                fontWeight: '600'
                              }}
                              value={add.meters}
                              onChangeText={(val) => {
                                const updated = [...millOutputItems];
                                updated[itemIdx].additionalFinishedMtr[addIdx].meters = val;
                                setMillOutputItems(updated);
                              }}
                              placeholder="Meters"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              editable={!isReadOnly}
                            />
                          </View>
                        </View>
                      </View>
                    ))}

                    {/* Add More Finished Meters button */}
                    {!isReadOnly && (
                      <TouchableOpacity
                        onPress={() => handleAddAdditionalMeters(itemIdx)}
                        style={{
                          height: 36,
                          borderWidth: 1.5,
                          borderColor: Colors.success[400],
                          borderStyle: 'dashed',
                          borderRadius: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.02)',
                          marginTop: 4
                        }}
                      >
                        <Plus size={14} color={Colors.success[600]} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.success[600] }}>
                          Add More Finished Meters
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
              )}

              {/* Add New Mill Output Item button */}
              {!isReadOnly && (
                <TouchableOpacity
                  onPress={handleAddMillOutputItem}
                  style={{
                    height: 48,
                    borderWidth: 2,
                    borderColor: isDarkMode ? '#1e293b' : '#cbd5e1',
                    borderStyle: 'dashed',
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                    marginBottom: 24,
                  }}
                >
                  <Plus size={18} color={theme.textSecondary} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary }}>
                    Add New Mill Output Item
                  </Text>
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
                      shadowOpacity: 0.35, shadowRadius: 10,
                      elevation: 6,
                    }}
                  >
                    <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                      Close
                    </Text>
                  </TouchableOpacity>
                ) : existingMillOutputs && existingMillOutputs.length > 0 && onDelete && isMaster ? (
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
                      style={{
                        flex: 1.8,
                        height: 50,
                        backgroundColor: Colors.success[600],
                        borderRadius: 14,
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: Colors.success[500],
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDarkMode ? 0.3 : 0.2,
                        shadowRadius: 8,
                        elevation: 4,
                        flexDirection: 'row',
                        gap: 8,
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                          Save All Mill Outputs
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    style={{
                      flex: 1,
                      height: 50,
                      backgroundColor: Colors.success[600],
                      borderRadius: 14,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: Colors.success[500],
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: isDarkMode ? 0.3 : 0.2,
                      shadowRadius: 8,
                      elevation: 4,
                      flexDirection: 'row',
                      gap: 8,
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                        Save All Mill Outputs
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

            </ScrollView>
            </>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={activeDatePickerIndex !== null}
        onClose={() => setActiveDatePickerIndex(null)}
        onSelectDate={(dateStr) => {
          if (activeDatePickerIndex !== null) {
            const updated = [...millOutputItems];
            updated[activeDatePickerIndex].recdDate = dateStr;
            setMillOutputItems(updated);
          }
          setActiveDatePickerIndex(null);
        }}
        value={activeDatePickerIndex !== null ? (millOutputItems[activeDatePickerIndex]?.recdDate || '') : ''}
      />

      {/* Selector Bottom Sheet Modal */}
      <Modal
        visible={selectorModal !== null}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setSelectorModal(null)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => setSelectorModal(null)}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />

          <Animated.View
            {...selectorPanResponder.panHandlers}
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: isLargeScreen ? 24 : (insets.bottom > 0 ? insets.bottom + 8 : 16),
              height: '85%',
              borderWidth: 1,
              borderColor: theme.border,
              transform: [{ translateY: selectorTranslateY }],
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 110}
              style={{ width: '100%', flex: 1 }}
            >
              {/* Visual Drag Handle */}
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#3a3a4a' : '#e2e8f0' }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                  Select Quality
                </Text>
                <TouchableOpacity onPress={() => setSelectorModal(null)} style={{ padding: 4 }}>
                  <X size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="Search quality..."
                placeholderTextColor={theme.textTertiary}
                value={selectorSearchQuery}
                onChangeText={setSelectorSearchQuery}
                style={{
                  height: 42,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[100],
                  borderWidth: 1.5,
                  borderColor: theme.borderLight,
                  paddingHorizontal: 14,
                  fontSize: 13,
                  color: theme.text,
                  marginBottom: 12,
                }}
              />

              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={(e) => { selectorScrollY.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                {qualities
                  .filter((q: any) => !selectorSearchQuery || q.name?.toLowerCase().includes(selectorSearchQuery.toLowerCase()))
                  .map((q: any) => {
                    const isSelected = selectorModal
                      ? (selectorModal.additionalIndex !== undefined
                        ? millOutputItems[selectorModal.itemIndex]?.additionalFinishedMtr[selectorModal.additionalIndex]?.quality === q._id
                        : millOutputItems[selectorModal.itemIndex]?.quality === q._id)
                      : false;

                    return (
                      <View
                        key={q._id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottomWidth: 1,
                          borderBottomColor: theme.borderLight,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            if (selectorModal) {
                              const updated = [...millOutputItems];
                              if (selectorModal.additionalIndex !== undefined) {
                                updated[selectorModal.itemIndex].additionalFinishedMtr[selectorModal.additionalIndex].quality = q._id;
                              } else {
                                updated[selectorModal.itemIndex].quality = q._id;
                              }
                              setMillOutputItems(updated);
                            }
                            setSelectorModal(null);
                          }}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: 10,
                            backgroundColor: isSelected ? (isDarkMode ? Colors.success[900] : Colors.success[50]) : 'transparent',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontWeight: isSelected ? '700' : '500',
                            color: isSelected ? Colors.success[600] : theme.text
                          }}>
                            {q.name}
                          </Text>
                        </TouchableOpacity>

                        {isMaster && (
                          <TouchableOpacity
                            onPress={() => setDeleteQualityTarget(q)}
                            style={{ padding: 10, marginLeft: 8 }}
                          >
                            <Trash2 size={16} color={Colors.error[600]} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>

      <DeleteConfirmModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={onDelete || (() => {})}
        title="Delete All Mill Outputs"
        message="Are you sure you want to delete all mill outputs for this order? This action cannot be undone."
        confirmText="Delete All"
        isDeleting={isDeleting}
      />

      <DeleteConfirmModal
        visible={deleteQualityTarget !== null}
        onClose={() => setDeleteQualityTarget(null)}
        onConfirm={() => {
          if (deleteQualityTarget?._id) {
            deleteQualityMutation.mutate(deleteQualityTarget._id);
          }
        }}
        title="Delete Quality"
        message={`Are you sure you want to delete "${deleteQualityTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isDeleting={deleteQualityMutation.isPending}
      />
      <DeleteConfirmModal
        visible={deleteWarning !== null}
        onClose={() => setDeleteWarning(null)}
        onConfirm={() => setDeleteWarning(null)}
        title={deleteWarning?.title || 'Cannot Delete'}
        message={deleteWarning?.message || ''}
        isAlert={true}
        alertBtnText="Close"
      />
    </Modal>
  );
}
