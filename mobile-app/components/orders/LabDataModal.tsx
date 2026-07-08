import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  PanResponder,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  useWindowDimensions
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Calendar, X, Trash2, Tag, Check, AlertCircle, ArrowLeft, Beaker } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import DatePickerModal from '../shared/DatePickerModal';
import { getDisplayOrderId } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';



// Date conversion helpers
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
  } catch {}
  return '';
};

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

const LabDataModalSkeleton = ({ theme }: { theme: any }) => {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
      {/* Skeleton for Lab Send Date */}
      <View style={{ marginBottom: 16 }}>
        <SkeletonPulse theme={theme} style={{ width: 100, height: 14, marginBottom: 8 }} />
        <View style={{ width: '100%', height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: theme.borderLight, overflow: 'hidden' }}>
          <SkeletonPulse theme={theme} style={{ width: '100%', height: '100%' }} />
        </View>
      </View>

      {/* Skeleton for Approval Date */}
      <View style={{ marginBottom: 16 }}>
        <SkeletonPulse theme={theme} style={{ width: 150, height: 14, marginBottom: 8 }} />
        <View style={{ width: '100%', height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: theme.borderLight, overflow: 'hidden' }}>
          <SkeletonPulse theme={theme} style={{ width: '100%', height: '100%' }} />
        </View>
      </View>

      {/* Skeleton for Sample Number */}
      <View style={{ marginBottom: 24 }}>
        <SkeletonPulse theme={theme} style={{ width: 100, height: 14, marginBottom: 8 }} />
        <View style={{ width: '100%', height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: theme.borderLight, overflow: 'hidden' }}>
          <SkeletonPulse theme={theme} style={{ width: '100%', height: '100%' }} />
        </View>
      </View>

      {/* Skeleton for Buttons */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <SkeletonPulse theme={theme} style={{ flex: 1, height: 50, borderRadius: 14 }} />
        <SkeletonPulse theme={theme} style={{ flex: 2, height: 50, borderRadius: 14 }} />
      </View>
    </View>
  );
};

interface LabDataModalProps {
  visible: boolean;
  onClose: () => void;
  order: any;
  editItem: any;
  isDarkMode: boolean;
  theme: any;
  onSave: (formData: any) => void;
  isSaving: boolean;
  onDelete?: () => void;
  onBack?: () => void;
  isLoading?: boolean;
  isMaster?: boolean;
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

export default function LabDataModal({
  visible,
  onClose,
  order,
  editItem,
  isDarkMode,
  theme,
  onSave,
  isSaving,
  onDelete,
  onBack,
  isLoading = false,
  isMaster = false,
  isDeleting = false,
  isReadOnly = false
}: LabDataModalProps) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isLargeScreen, modalMaxWidth } = useResponsiveLayout();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState<any>({
    labSendDate: '',
    approvalDate: '',
    sampleNumber: ''
  });

  const [datePickerFor, setDatePickerFor] = useState<'send' | 'approval' | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  // Swipe-down-to-close gesture on the whole sheet
  const scrollY = useRef(0);
  const sheetY = useRef(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const translateY = useRef(new Animated.Value(0)).current;
  const touchStartPageY = useRef(0);

  const dimensionsRef = useRef({ SCREEN_WIDTH, SCREEN_HEIGHT });
  dimensionsRef.current = { SCREEN_WIDTH, SCREEN_HEIGHT };

  const closeModal = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onCloseRef.current();
    });
  }, [translateY, SCREEN_HEIGHT]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        touchStartPageY.current = pageY;
        return pageY < sheetY.current + 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        return scrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, g) => {
        return scrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx);
      },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (evt, g) => {
        const isBackdropTouch = touchStartPageY.current < sheetY.current;
        if (isBackdropTouch && Math.abs(g.dy) < 10 && Math.abs(g.dx) < 10) {
          closeModal();
          return;
        }

        if (g.dy > 50 || g.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeModal();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;
  // Sync state with editItem and visible changes
  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      setValidationErrors({});

      if (editItem) {
        setFormData({
          id: editItem._id || editItem.id,
          labSendDate: editItem.labSendDate ? editItem.labSendDate.split('T')[0] : '',
          approvalDate: editItem.approvalDate ? editItem.approvalDate.split('T')[0] : '',
          sampleNumber: editItem.sampleNumber || ''
        });
      } else {
        setFormData({
          labSendDate: '',
          approvalDate: '',
          sampleNumber: ''
        });
      }
    }
  }, [visible, editItem]);

  const handleSave = () => {
    if (!formData.labSendDate) {
      setValidationErrors({ labSendDate: true });
      return;
    }
    setValidationErrors({});
    onSave(formData);
  };

  const setToday = (field: 'labSendDate' | 'approvalDate') => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev: any) => ({ ...prev, [field]: today }));
    setValidationErrors((prev) => ({ ...prev, [field]: false }));
  };

  const bg = isDarkMode ? '#0f0f14' : '#ffffff';
  const cardBg = isDarkMode ? '#18181f' : '#f9f9fb';
  const inputBg = isDarkMode ? '#111118' : '#ffffff';
  const borderCol = isDarkMode ? '#2a2a38' : '#e5e7eb';
  const labelCol = isDarkMode ? '#8b8fa8' : '#6b7280';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={closeModal}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0)', justifyContent: 'flex-end' }}>
        {/* Backdrop overlay */}
        <TouchableWithoutFeedback onPress={closeModal}>
          <View 
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
          onLayout={(e) => {
            sheetY.current = e.nativeEvent.layout.y;
          }}
          {...panResponder.panHandlers}
          style={{
            backgroundColor: bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            height: '85%',
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
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
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
            paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {onBack && (
                <TouchableOpacity
                  onPress={onBack}
                  activeOpacity={0.7}
                  style={{
                    width: 34, height: 34, borderRadius: 17,
                    backgroundColor: isDarkMode ? '#2a2a38' : '#f3f4f6',
                    justifyContent: 'center', alignItems: 'center',
                    marginRight: 4
                  }}
                >
                  <ArrowLeft size={16} color={labelCol} />
                </TouchableOpacity>
              )}
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: isDarkMode ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Beaker size={18} color={isDarkMode ? '#c084fc' : '#9333ea'} />
              </View>
              <View>
                <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
                  {editItem ? 'Edit' : 'Add'} Lab Test Data
                </Text>
                <Text style={{ fontSize: 12, color: labelCol, marginTop: 1 }}>
                  {order ? `Order: ${getDisplayOrderId(order.orderId) || '—'}` : 'Lab details'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={closeModal}
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: isDarkMode ? '#2a2a38' : '#f3f4f6',
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <X size={16} color={labelCol} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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

            {isLoading && !editItem ? (
              <LabDataModalSkeleton theme={theme} />
            ) : (
            <View>
            {/* Lab Send Date */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: labelCol, letterSpacing: 0.3, textTransform: 'uppercase' }}>Lab Send Date</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#ef4444', lineHeight: 16 }}>*</Text>
              </View>
              {validationErrors.labSendDate && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                  <AlertCircle size={12} color="#ef4444" />
                  <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '600' }}>Lab Send Date is required</Text>
                </View>
              )}
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  onPress={() => setDatePickerFor('send')}
                  disabled={isReadOnly}
                  activeOpacity={isReadOnly ? 1 : 0.7}
                  style={{
                    width: '100%', height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
                    borderColor: validationErrors.labSendDate ? '#ef4444' : borderCol,
                    backgroundColor: inputBg,
                  }}
                >
                  <Text style={{ fontSize: 14, color: formData.labSendDate ? theme.text : labelCol }}>
                    {formData.labSendDate ? toDisplay(formData.labSendDate) : 'Select date'}
                  </Text>
                  <View style={{ width: 15 }} />
                </TouchableOpacity>
                <View style={{ position: 'absolute', right: 12, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {formData.labSendDate && !isReadOnly ? (
                    <TouchableOpacity
                      onPress={() => setFormData((prev: any) => ({ ...prev, labSendDate: '' }))}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={15} color={labelCol} />
                    </TouchableOpacity>
                  ) : null}
                  <Calendar size={15} color={isDarkMode ? '#c084fc' : '#9333ea'} />
                </View>
              </View>
            </View>

            {/* Approval Date */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: labelCol, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' }}>Approval Date (Optional)</Text>
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  onPress={() => setDatePickerFor('approval')}
                  disabled={isReadOnly}
                  activeOpacity={isReadOnly ? 1 : 0.7}
                  style={{
                    width: '100%', height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
                    borderColor: borderCol, backgroundColor: inputBg,
                  }}
                >
                  <Text style={{ fontSize: 14, color: formData.approvalDate ? theme.text : labelCol }}>
                    {formData.approvalDate ? toDisplay(formData.approvalDate) : 'Select date'}
                  </Text>
                  <View style={{ width: 15 }} />
                </TouchableOpacity>
                <View style={{ position: 'absolute', right: 12, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {formData.approvalDate && !isReadOnly ? (
                    <TouchableOpacity
                      onPress={() => setFormData((prev: any) => ({ ...prev, approvalDate: '' }))}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={15} color={labelCol} />
                    </TouchableOpacity>
                  ) : null}
                  <Calendar size={15} color={isDarkMode ? '#c084fc' : '#9333ea'} />
                </View>
              </View>
            </View>

            {/* Sample Number */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: labelCol, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' }}>Sample Number</Text>
              <TextInput
                style={{
                  height: 44, borderWidth: 1.5, borderColor: borderCol,
                  borderRadius: 12, paddingHorizontal: 14,
                  color: theme.text, backgroundColor: inputBg, fontSize: 14,
                }}
                value={formData.sampleNumber}
                onChangeText={(val) => setFormData((prev: any) => ({ ...prev, sampleNumber: val }))}
                placeholder="Enter sample number"
                placeholderTextColor={labelCol}
                editable={!isReadOnly}
              />
            </View>

            {/* Bottom Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              {isReadOnly ? (
                <TouchableOpacity
                  onPress={closeModal}
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
              ) : editItem && onDelete && isMaster ? (
                <>
                  <TouchableOpacity
                    onPress={() => setShowDeleteConfirm(true)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      height: 50,
                      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
                      borderRadius: 14,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fecaca',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Trash2 size={16} color={Colors.error[600]} />
                      <Text style={{ color: Colors.error[600], fontSize: 14, fontWeight: '700' }}>Delete</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.85}
                    style={{
                      flex: 1.8, height: 50, borderRadius: 14,
                      backgroundColor: isSaving ? (isDarkMode ? '#6b21a8' : '#c084fc') : (isDarkMode ? '#7e22ce' : '#9333ea'),
                      justifyContent: 'center', alignItems: 'center',
                      shadowColor: isDarkMode ? 'transparent' : '#c084fc',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35, shadowRadius: 10,
                      elevation: 6,
                    }}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Check size={16} color="#fff" />
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 }}>
                          Save Lab Data
                        </Text>
                      </View>
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
                    backgroundColor: isSaving ? (isDarkMode ? '#6b21a8' : '#c084fc') : (isDarkMode ? '#7e22ce' : '#9333ea'),
                    justifyContent: 'center', alignItems: 'center',
                    shadowColor: isDarkMode ? 'transparent' : '#c084fc',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35, shadowRadius: 10,
                    elevation: 6,
                  }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Check size={16} color="#fff" />
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 }}>
                        Save Lab Data
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
            </View>
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      {/* Date Pickers */}
      <DatePickerModal
        visible={datePickerFor !== null}
        onClose={() => setDatePickerFor(null)}
        value={datePickerFor === 'send' ? toDisplay(formData.labSendDate) : toDisplay(formData.approvalDate)}
        title={datePickerFor === 'send' ? 'Select Send Date' : 'Select Approval Date'}
        onSelectDate={(ddmmyyyy) => {
          if (datePickerFor) {
            const iso = toISO(ddmmyyyy);
            const fieldName = datePickerFor === 'send' ? 'labSendDate' : 'approvalDate';
            setFormData((prev: any) => ({ ...prev, [fieldName]: iso }));
            setValidationErrors((prev) => ({ ...prev, [fieldName]: false }));
          }
          setDatePickerFor(null);
        }}
      />

      <DeleteConfirmModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={onDelete || (() => {})}
        title="Delete Lab Data"
        message="Are you sure you want to delete this lab data record? This action cannot be undone."
        confirmText="Delete"
        isDeleting={isDeleting}
      />
    </Modal>
  );
}
