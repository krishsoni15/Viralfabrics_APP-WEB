import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert, Animated, PanResponder, Dimensions, TouchableWithoutFeedback, useWindowDimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, X, Calendar, Plus, Minus, Layers, Trash2, Truck, Camera, Upload } from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { CONFIG } from '../../constants/config';
import api from '../../services/api';
import CustomCameraModal from '../shared/CustomCameraModal';
import ImagePreviewModal from '../shared/ImagePreviewModal';
import DatePickerModal from '../shared/DatePickerModal';
import { getDisplayOrderId, uploadSingleImage } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useQueryClient, useMutation } from '@tanstack/react-query';

let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {}

interface DispatchModalProps {
  visible: boolean;
  onClose: () => void;
  order: any;
  existingDispatches: any[];
  qualities: any[];
  isDarkMode: boolean;
  theme: any;
  onSave: (payload: { dispatchItems: any[] }) => void;
  isSaving: boolean;
  onDelete?: () => void;
  isMaster?: boolean;
  isLoading?: boolean;
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

function DispatchModalSkeleton({ theme }: { theme: any }) {
  return (
    <View style={{ gap: 16, padding: 16 }}>
      {[1, 2].map((key) => (
        <View
          key={key}
          style={{
            backgroundColor: theme.card,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: theme.borderLight,
            padding: 16,
            gap: 16,
          }}
        >
          {/* Header */}
          <View style={{ borderBottomWidth: 1, borderBottomColor: theme.borderLight, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
            <SkeletonPulse theme={theme} style={{ width: 100, height: 16 }} />
          </View>

          {/* Date & Bill */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <SkeletonPulse theme={theme} style={{ width: 80, height: 10, marginBottom: 6 }} />
              <SkeletonPulse theme={theme} style={{ width: '100%', height: 42, borderRadius: 10 }} />
            </View>
            <View style={{ flex: 1 }}>
              <SkeletonPulse theme={theme} style={{ width: 80, height: 10, marginBottom: 6 }} />
              <SkeletonPulse theme={theme} style={{ width: '100%', height: 42, borderRadius: 10 }} />
            </View>
          </View>

          {/* Transport & LR */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <SkeletonPulse theme={theme} style={{ width: 100, height: 10, marginBottom: 6 }} />
              <SkeletonPulse theme={theme} style={{ width: '100%', height: 42, borderRadius: 10 }} />
            </View>
            <View style={{ flex: 1 }}>
              <SkeletonPulse theme={theme} style={{ width: 80, height: 10, marginBottom: 6 }} />
              <SkeletonPulse theme={theme} style={{ width: '100%', height: 42, borderRadius: 10 }} />
            </View>
          </View>

          {/* Sub-items list */}
          <View style={{ borderTopWidth: 1.5, borderTopColor: theme.borderLight, paddingTop: 12, gap: 12 }}>
            <SkeletonPulse theme={theme} style={{ width: 150, height: 12, marginBottom: 4 }} />
            
            <View style={{ backgroundColor: 'rgba(0,0,0,0.01)', borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: theme.borderLight, gap: 10 }}>
              <SkeletonPulse theme={theme} style={{ width: 80, height: 10 }} />
              <View>
                <SkeletonPulse theme={theme} style={{ width: 60, height: 10, marginBottom: 6 }} />
                <SkeletonPulse theme={theme} style={{ width: '100%', height: 38, borderRadius: 8 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <SkeletonPulse theme={theme} style={{ width: 80, height: 10, marginBottom: 6 }} />
                  <SkeletonPulse theme={theme} style={{ width: '100%', height: 38, borderRadius: 8 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <SkeletonPulse theme={theme} style={{ width: 60, height: 10, marginBottom: 6 }} />
                  <SkeletonPulse theme={theme} style={{ width: '100%', height: 38, borderRadius: 8 }} />
                </View>
              </View>
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

export default function DispatchModal({
  visible,
  onClose,
  order,
  existingDispatches,
  qualities,
  isDarkMode,
  theme,
  onSave,
  isSaving,
  onDelete,
  isMaster = false,
  isLoading = false,
  isDeleting = false,
  isReadOnly = false
}: DispatchModalProps) {
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

  const [dispatchItems, setDispatchItems] = useState<any[]>([]);
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

  const [uploading, setUploading] = useState(false);
  const [localUploading, setLocalUploading] = useState(false);
  const [showCustomCamera, setShowCustomCamera] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);

  // Target for photo uploads
  const [photoTarget, setPhotoTarget] = useState<{ itemIndex: number; subItemIndex: number } | null>(null);
  const [activePreviewTarget, setActivePreviewTarget] = useState<{ itemIdx: number; subIdx: number } | null>(null);

  // Bottom Sheet selector state for quality selection
  const [selectorModal, setSelectorModal] = useState<{
    itemIndex: number;
    subItemIndex: number;
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

  const groupDispatchesByBillAndDate = (existingDispatches: any[]) => {
    if (!existingDispatches || existingDispatches.length === 0) return [];

    // Sort dispatches by createdAt (oldest first) before grouping
    const sortedDispatches = [...existingDispatches].sort((a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

    const groups: any = {};
    sortedDispatches.forEach((dispatch: any) => {
      const dateStr = dispatch.dispatchDate ? dispatch.dispatchDate.split('T')[0] : '';
      const key = `${dateStr}_${dispatch.billNo}`;
      if (!groups[key]) {
        groups[key] = {
          dispatchDate: dateStr,
          billNo: dispatch.billNo || '',
          transportNo: dispatch.transportNo || '',
          lrNo: dispatch.lrNo || '',
          createdAt: dispatch.createdAt,
          subItems: []
        };
      }
      groups[key].subItems.push({
        _id: dispatch._id,
        finishMtr: (dispatch.finishMtr || 0).toString(),
        quality: typeof dispatch.quality === 'object' ? (dispatch.quality?._id || '') : (dispatch.quality || ''),
        photos: dispatch.photos || [],
        chindiKg: dispatch.chindiKg !== undefined && dispatch.chindiKg !== null ? String(dispatch.chindiKg) : '',
        cutPieceMtr: dispatch.cutPieceMtr !== undefined && dispatch.cutPieceMtr !== null ? String(dispatch.cutPieceMtr) : '',
        rejectedMtr: dispatch.rejectedMtr !== undefined && dispatch.rejectedMtr !== null ? String(dispatch.rejectedMtr) : ''
      });
    });

    const groupEntries = Object.values(groups).sort((a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

    return groupEntries.map((group: any, index: number) => {
      const subItemsWithIds = group.subItems.map((subItem: any, subIndex: number) => ({
        ...subItem,
        id: `sub-${index}-${subIndex}-${Date.now()}`
      }));
      return {
        id: `group-${index}-${Date.now()}`,
        dispatchDate: group.dispatchDate,
        billNo: group.billNo,
        transportNo: group.transportNo || '',
        lrNo: group.lrNo || '',
        subItems: subItemsWithIds
      };
    });
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
    const hasData = existingDispatches && existingDispatches.length > 0;
    const dataSig = hasData
      ? `${orderId}|${JSON.stringify(existingDispatches)}`
      : `${orderId}|0`;

    const orderChanged = lastInitializedOrderIdRef.current !== orderId;
    const dataArrived = !lastInitializedDataRef.current && hasData;
    const dataChanged = hasData && lastDataSignatureRef.current !== dataSig;
    const shouldInit = orderChanged || dataArrived || dataChanged;

    if (shouldInit) {
      lastInitializedOrderIdRef.current = orderId;
      lastInitializedDataRef.current = hasData ? existingDispatches : null;
      lastDataSignatureRef.current = dataSig;

      translateY.setValue(0);
      setSelectorModal(null);
      setSelectorSearchQuery('');

      if (hasData) {
        const grouped = groupDispatchesByBillAndDate(existingDispatches);
        setDispatchItems(grouped);
      } else {
        setDispatchItems([
          {
            id: `local-0-${Date.now()}`,
            dispatchDate: '',
            billNo: '',
            transportNo: '',
            lrNo: '',
            subItems: [
              {
                id: `sub-0-0-${Date.now()}`,
                finishMtr: '',
                quality: '',
                photos: [],
                chindiKg: '',
                cutPieceMtr: '',
                rejectedMtr: ''
              }
            ]
          }
        ]);
      }
    }
  }, [visible, existingDispatches, qualities, order?._id]);

  const handleAddDispatchItem = () => {
    const lastItem = dispatchItems[dispatchItems.length - 1];
    const defaultDate = (lastItem && lastItem.dispatchDate) ? lastItem.dispatchDate : '';

    setDispatchItems((prev) => [
      ...prev,
      {
        id: `local-${prev.length}-${Date.now()}`,
        dispatchDate: defaultDate,
        billNo: '',
        transportNo: '',
        lrNo: '',
        subItems: [
          {
            id: `sub-${prev.length}-0-${Date.now()}`,
            finishMtr: '',
            quality: '',
            photos: [],
            chindiKg: '',
            cutPieceMtr: '',
            rejectedMtr: ''
          }
        ]
      }
    ]);
  };

  const handleRemoveDispatchItem = (index: number) => {
    setDispatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddSubItem = (itemIndex: number) => {
    const updated = [...dispatchItems];
    updated[itemIndex].subItems.push({
      id: `sub-${itemIndex}-${updated[itemIndex].subItems.length}-${Date.now()}`,
      finishMtr: '',
      quality: '',
      photos: [],
      chindiKg: '',
      cutPieceMtr: '',
      rejectedMtr: ''
    });
    setDispatchItems(updated);
  };

  const handleRemoveSubItem = (itemIndex: number, subIndex: number) => {
    const updated = [...dispatchItems];
    updated[itemIndex].subItems = updated[itemIndex].subItems.filter((_: any, i: number) => i !== subIndex);
    setDispatchItems(updated);
  };

  const getFullImageUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    const baseUrl = CONFIG.API_URL.endsWith('/')
      ? CONFIG.API_URL.slice(0, -1)
      : CONFIG.API_URL;
    return `${baseUrl}${cleanUrl}`;
  };

  const handlePickImage = async (useCamera: boolean, itemIdx: number, subIdx: number) => {
    try {
      if (!ImagePicker || !ImagePicker.requestCameraPermissionsAsync) {
        Alert.alert(
          'Feature Unavailable',
          'Camera and gallery access are not available in this client environment.'
        );
        return;
      }

      setPhotoTarget({ itemIndex: itemIdx, subItemIndex: subIdx });

      let result;
      if (useCamera) {
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPerm.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      } else {
        const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libraryPerm.granted) {
          Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsMultipleSelection: true,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const localUris = result.assets.map((asset: any) => asset.uri);

      if (localUris.length > 0) {
        setDispatchItems((prev) => {
          const updated = [...prev];
          const it = updated[itemIdx];
          if (it && it.subItems && it.subItems[subIdx]) {
            it.subItems[subIdx].photos = [...(it.subItems[subIdx].photos || []), ...localUris];
          }
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'An error occurred during image selection.');
    } finally {
      setPhotoTarget(null);
    }
  };

  const handleUploadPhotos = async (uris: string[]) => {
    if (uris.length === 0 || !photoTarget) return;
    const { itemIndex, subItemIndex } = photoTarget;

    setDispatchItems((prev) => {
      const updated = [...prev];
      const it = updated[itemIndex];
      if (it && it.subItems && it.subItems[subItemIndex]) {
        it.subItems[subItemIndex].photos = [...(it.subItems[subItemIndex].photos || []), ...uris];
      }
      return updated;
    });
  };

  const handleUploadSingleCroppedImage = async (
    localUri: string,
    itemIdx: number,
    subIdx: number,
    imgIdx: number
  ): Promise<string | null> => {
    setDispatchItems((prev) => {
      const updated = [...prev];
      const it = updated[itemIdx];
      if (it && it.subItems && it.subItems[subIdx] && it.subItems[subIdx].photos) {
        const photos = [...it.subItems[subIdx].photos];
        photos[imgIdx] = localUri;
        it.subItems[subIdx].photos = photos;
      }
      return updated;
    });
    return localUri;
  };

  const uploadLocalPhotos = async (itemsList: any[]): Promise<any[]> => {
    const updatedItems = JSON.parse(JSON.stringify(itemsList));
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      if (item.subItems) {
        for (let j = 0; j < item.subItems.length; j++) {
          const sub = item.subItems[j];
          if (sub.photos && sub.photos.length > 0) {
            const uploadedPhotos: string[] = [];
            for (const photo of sub.photos) {
              if (photo.startsWith('file://') || photo.startsWith('ph://') || !photo.startsWith('http')) {
                try {
                  const remoteUrl = await uploadSingleImage(photo, 'dispatch');
                  if (remoteUrl) {
                    uploadedPhotos.push(remoteUrl);
                  } else {
                    uploadedPhotos.push(photo);
                  }
                } catch (err) {
                  console.error('Failed to upload local photo on save:', err);
                  uploadedPhotos.push(photo);
                }
              } else {
                uploadedPhotos.push(photo);
              }
            }
            sub.photos = uploadedPhotos;
          }
        }
      }
    }
    return updatedItems;
  };

  const handleSave = async () => {
    if (isSaving || saveInProgress.current || localUploading) return;
    if (uploading) {
      Alert.alert('Please Wait', 'Images are still uploading. Please wait for upload to complete.');
      return;
    }

    // Validate entries
    for (let i = 0; i < dispatchItems.length; i++) {
      const item = dispatchItems[i];
      if (!item.dispatchDate) {
        Alert.alert('Error', `Dispatch Date is required for Item ${i + 1}`);
        return;
      }
      if (!item.billNo) {
        Alert.alert('Error', `Bill Number is required for Item ${i + 1}`);
        return;
      }

      if (!item.subItems || item.subItems.length === 0) {
        Alert.alert('Error', `At least one Quality & Finish sub-item is required for Item ${i + 1}`);
        return;
      }

      for (let j = 0; j < item.subItems.length; j++) {
        const sub = item.subItems[j];
        if (!sub.finishMtr) {
          Alert.alert('Error', `Finish Meters is required for Item ${i + 1} - Row ${j + 1}`);
          return;
        }
        if (!sub.quality) {
          Alert.alert('Error', `Quality is required for Item ${i + 1} - Row ${j + 1}`);
          return;
        }
      }
    }

    try {
      setLocalUploading(true);
      const uploadedItems = await uploadLocalPhotos(dispatchItems);
      setDispatchItems(uploadedItems);
      saveInProgress.current = true;
      onSave({ dispatchItems: uploadedItems });
    } catch (err: any) {
      console.error('Save failed during upload:', err);
      Alert.alert('Upload Error', 'Failed to upload local photos: ' + err.message);
    } finally {
      setLocalUploading(false);
    }
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
                  backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.15)' : 'rgba(234, 88, 12, 0.1)',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Truck size={20} color={'#ea580c'} />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
                    Dispatch Management
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1, fontWeight: '500' }}>
                    {order ? `Order: ${getDisplayOrderId(order.orderId) || '—'}` : 'Dispatches'}
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

            {isReadOnly ? (
              // Beautiful Read-Only Grid Display for Dispatch details
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }}
                showsVerticalScrollIndicator={false}
              >
                {dispatchItems.length === 0 ? (
                  <View style={{
                    padding: 30,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: theme.border,
                    marginVertical: 20
                  }}>
                    <Truck size={36} color={theme.textTertiary} style={{ marginBottom: 12 }} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>No Dispatch Data</Text>
                    <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: 'center' }}>No dispatch information has been recorded for this order yet.</Text>
                  </View>
                ) : (
                  dispatchItems.map((item, idx) => (
                    <View
                      key={item.id}
                      style={{
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        padding: 16,
                        gap: 12,
                        marginBottom: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 8,
                        elevation: 2
                      }}
                    >
                      {/* Group Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#f1f5f9', paddingBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Truck size={16} color="#ea580c" />
                          <Text style={{ fontSize: 14, fontWeight: '800', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>Dispatch Group #{idx + 1}</Text>
                        </View>
                        {item.dispatchDate ? (
                          <Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? '#94a3b8' : '#64748b' }}>{toDisplay(item.dispatchDate)}</Text>
                        ) : null}
                      </View>

                      {/* Transport Info Grid */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: isDarkMode ? '#64748b' : '#94a3b8', marginBottom: 2 }}>Bill / Invoice No</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#cbd5e1' : '#334155' }}>{item.billNo || 'N/A'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: isDarkMode ? '#64748b' : '#94a3b8', marginBottom: 2 }}>Transport</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#cbd5e1' : '#334155' }}>{item.transportNo || 'N/A'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: isDarkMode ? '#64748b' : '#94a3b8', marginBottom: 2 }}>LR No</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#cbd5e1' : '#334155' }}>{item.lrNo || 'N/A'}</Text>
                        </View>
                      </View>

                      {/* Sub-items Table/Cards */}
                      <View style={{ marginTop: 8, gap: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', letterSpacing: 0.3 }}>Dispatched Items</Text>
                        {(item.subItems || []).map((sub: any, subIdx: number) => {
                          const qualityName = qualities.find((q: any) => String(q._id) === String(sub.quality))?.name || 'Unknown Quality';
                          return (
                            <View
                              key={sub.id}
                              style={{
                                backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                                borderRadius: 12,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                                gap: 8
                              }}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>{qualityName}</Text>
                                {sub.invoiceNo ? (
                                  <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>Inv: {sub.invoiceNo}</Text>
                                ) : null}
                              </View>
                              <View style={{ flexDirection: 'row', gap: 16 }}>
                                <View>
                                  <Text style={{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', color: isDarkMode ? '#475569' : '#94a3b8' }}>Finish Qty</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>{sub.finishMtr || '0'} Mtr</Text>
                                </View>
                                <View>
                                  <Text style={{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', color: isDarkMode ? '#475569' : '#94a3b8' }}>Pieces</Text>
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#cbd5e1' : '#475569' }}>{sub.pcs || '0'} Pcs</Text>
                                </View>
                              </View>

                              {/* Photo Preview inside Grid if present */}
                              {sub.photos && sub.photos.length > 0 && (
                                <View style={{ marginTop: 6, gap: 4 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', color: isDarkMode ? '#475569' : '#94a3b8' }}>Photos</Text>
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                    {sub.photos.map((photoUrl: string, pIdx: number) => {
                                      const fullUrl = getFullImageUrl(photoUrl);
                                      if (!fullUrl) return null;
                                      return (
                                        <TouchableOpacity
                                          key={pIdx}
                                          onPress={() => {
                                            const allImages = sub.photos.map((u: string) => getFullImageUrl(u)).filter(Boolean) as string[];
                                            setPreviewImages(allImages);
                                            setPreviewImageIndex(pIdx);
                                          }}
                                        >
                                          <Image
                                            source={{ uri: fullUrl }}
                                            style={{ width: 44, height: 44, borderRadius: 6, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}
                                          />
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </ScrollView>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))
                )}

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
                    marginTop: 8,
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
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {/* Refetching Indicator */}
              {/* {isLoading && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', paddingVertical: 8, borderRadius: 8, marginBottom: 16, gap: 8 }}>
                  <ActivityIndicator size="small" color={isDarkMode ? '#60a5fa' : '#3b82f6'} />
                  <Text style={{ fontSize: 13, color: isDarkMode ? '#60a5fa' : '#2563eb', fontWeight: '500' }}>Refreshing data...</Text>
                </View>
              )} */}

              {isLoading && (!existingDispatches || existingDispatches.length === 0) ? (
                <DispatchModalSkeleton theme={theme} />
              ) : (
              <View>
              {/* Items List */}
              {dispatchItems.length === 0 ? (
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
                  <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: 'center' }}>Click the button below to add a new Dispatch.</Text>
                </View>
              ) : (
                dispatchItems.map((item, itemIdx) => (
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
                        backgroundColor: '#ea580c'
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>
                          ENTRY #{itemIdx + 1}
                        </Text>
                      </View>
                      {item.billNo ? (
                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
                          (Bill: {item.billNo})
                        </Text>
                      ) : null}
                    </View>
                    {!isReadOnly && (item.id.startsWith('local-') || isMaster) && dispatchItems.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveDispatchItem(itemIdx)}
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

                  {/* Dispatch Date & Bill Number */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                    {/* Dispatch Date */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.2 }}>
                        Dispatch Date *
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
                        <Text style={{ fontSize: 13, color: item.dispatchDate ? theme.text : theme.textTertiary, fontWeight: '500', flex: 1 }}>
                          {item.dispatchDate ? toDisplay(item.dispatchDate) : 'Select date'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {item.dispatchDate && !isReadOnly ? (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                const updated = [...dispatchItems];
                                updated[itemIdx].dispatchDate = '';
                                setDispatchItems(updated);
                              }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <X size={14} color={theme.textSecondary} />
                            </TouchableOpacity>
                          ) : null}
                          <Calendar size={15} color={'#ea580c'} />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Bill Number */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.2 }}>
                        Bill Number *
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
                        value={item.billNo}
                        onChangeText={(val) => {
                          const updated = [...dispatchItems];
                          updated[itemIdx].billNo = val;
                          setDispatchItems(updated);
                        }}
                        placeholder="Bill No."
                        placeholderTextColor={theme.textTertiary}
                        editable={!isReadOnly}
                      />
                    </View>
                  </View>

                  {/* Transport & LR numbers */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                    {/* Transport Number */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.2 }}>
                        Transport Number
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
                        value={item.transportNo}
                        onChangeText={(val) => {
                          const updated = [...dispatchItems];
                          updated[itemIdx].transportNo = val;
                          setDispatchItems(updated);
                        }}
                        placeholder="Transport No."
                        placeholderTextColor={theme.textTertiary}
                        editable={!isReadOnly}
                      />
                    </View>

                    {/* LR Number */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.2 }}>
                        LR Number
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
                        value={item.lrNo}
                        onChangeText={(val) => {
                          const updated = [...dispatchItems];
                          updated[itemIdx].lrNo = val;
                          setDispatchItems(updated);
                        }}
                        placeholder="LR No."
                        placeholderTextColor={theme.textTertiary}
                        editable={!isReadOnly}
                      />
                    </View>
                  </View>

                  {/* Nested Sub-items (Quality & Finish Items) */}
                  <View style={{
                    marginTop: 10,
                    paddingTop: 12,
                    borderTopWidth: 1.5,
                    borderTopColor: theme.borderLight,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <Layers size={14} color={'#ea580c'} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text, letterSpacing: -0.1 }}>
                        Quality & Finish Items ({item.subItems?.length || 0})
                      </Text>
                    </View>

                    {item.subItems?.map((sub: any, subIdx: number) => (
                      <View
                        key={sub.id || subIdx}
                        style={{
                          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                          borderRadius: 16,
                          padding: 12,
                          marginBottom: 12,
                          borderWidth: 1.5,
                          borderColor: theme.borderLight,
                          position: 'relative',
                        }}
                      >
                        {/* Remove subitem button */}
                        {!isReadOnly && item.subItems && item.subItems.length > 1 && (
                          <TouchableOpacity
                            onPress={() => handleRemoveSubItem(itemIdx, subIdx)}
                            style={{
                              position: 'absolute',
                              top: 10,
                              right: 10,
                              width: 26,
                              height: 26,
                              borderRadius: 6,
                              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                              justifyContent: 'center',
                              alignItems: 'center',
                              zIndex: 10
                            }}
                          >
                            <Minus size={14} color={Colors.error[600]} />
                          </TouchableOpacity>
                        )}

                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>
                          ITEM M{subIdx + 1}
                        </Text>

                        {/* Quality Selection */}
                        <View style={{ marginBottom: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>
                            Quality *
                          </Text>
                          <View
                            style={{
                              height: 38,
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
                                setSelectorModal({ itemIndex: itemIdx, subItemIndex: subIdx });
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
                              <Text numberOfLines={1} style={{ fontSize: 12, color: sub.quality ? theme.text : theme.textTertiary, fontWeight: '500' }}>
                                {getQualityName(sub.quality)}
                              </Text>
                            </TouchableOpacity>
                            {sub.quality && !isReadOnly ? (
                              <TouchableOpacity
                                onPress={() => {
                                  const updated = [...dispatchItems];
                                  updated[itemIdx].subItems[subIdx].quality = '';
                                  setDispatchItems(updated);
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

                        {/* Finish Meters, Chindi, Cut Piece, Rejected row */}
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                          {/* Finish Meters */}
                          <View style={{ flex: 1.2 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>
                              Finish Mtr *
                            </Text>
                            <TextInput
                              style={{
                                height: 36,
                                borderWidth: 1.5,
                                borderColor: theme.border,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                color: theme.text,
                                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                                fontSize: 12,
                                fontWeight: '600'
                              }}
                              value={sub.finishMtr}
                              onChangeText={(val) => {
                                const updated = [...dispatchItems];
                                updated[itemIdx].subItems[subIdx].finishMtr = val;
                                setDispatchItems(updated);
                              }}
                              placeholder="Meters"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              editable={!isReadOnly}
                            />
                          </View>

                          {/* Chindi KG */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>
                              Chindi (Kg)
                            </Text>
                            <TextInput
                              style={{
                                height: 36,
                                borderWidth: 1.5,
                                borderColor: theme.border,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                color: theme.text,
                                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                                fontSize: 12,
                                fontWeight: '500'
                              }}
                              value={sub.chindiKg}
                              onChangeText={(val) => {
                                const updated = [...dispatchItems];
                                updated[itemIdx].subItems[subIdx].chindiKg = val;
                                setDispatchItems(updated);
                              }}
                              placeholder="Kg"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              editable={!isReadOnly}
                            />
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                          {/* Cut Piece */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>
                              Cut Piece (m)
                            </Text>
                            <TextInput
                              style={{
                                height: 36,
                                borderWidth: 1.5,
                                borderColor: theme.border,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                color: theme.text,
                                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                                fontSize: 12,
                                fontWeight: '500'
                              }}
                              value={sub.cutPieceMtr}
                              onChangeText={(val) => {
                                const updated = [...dispatchItems];
                                updated[itemIdx].subItems[subIdx].cutPieceMtr = val;
                                setDispatchItems(updated);
                              }}
                              placeholder="Mtr"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              editable={!isReadOnly}
                            />
                          </View>

                          {/* Rejected */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 }}>
                              Rejected (m)
                            </Text>
                            <TextInput
                              style={{
                                height: 36,
                                borderWidth: 1.5,
                                borderColor: theme.border,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                color: theme.text,
                                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
                                fontSize: 12,
                                fontWeight: '500'
                              }}
                              value={sub.rejectedMtr}
                              onChangeText={(val) => {
                                const updated = [...dispatchItems];
                                updated[itemIdx].subItems[subIdx].rejectedMtr = val;
                                setDispatchItems(updated);
                              }}
                              placeholder="Mtr"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              editable={!isReadOnly}
                            />
                          </View>
                        </View>

                        {/* Dispatch Photos for this subitem */}
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>
                          Dispatch Photos
                        </Text>
                        {!isReadOnly && (
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => handlePickImage(false, itemIdx, subIdx)}
                              style={{
                                flex: 1,
                                height: 34,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderStyle: 'dashed',
                                borderColor: isDarkMode ? Colors.neutral[700] : Colors.neutral[300],
                                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              <Upload size={14} color={theme.textSecondary} />
                              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>Upload</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                setPhotoTarget({ itemIndex: itemIdx, subItemIndex: subIdx });
                                setShowCustomCamera(true);
                              }}
                              style={{
                                flex: 1,
                                height: 34,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderStyle: 'dashed',
                                borderColor: isDarkMode ? Colors.neutral[700] : Colors.neutral[300],
                                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              <Camera size={14} color={theme.textSecondary} />
                              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>Camera</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Picked thumbnails for this subitem */}
                        {sub.photos && sub.photos.length > 0 && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ flexDirection: 'row', marginTop: 4, marginBottom: 4 }}
                            contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: 6 }}
                          >
                            {sub.photos.map((url: string, imgIdx: number) => {
                              const fullUrl = getFullImageUrl(url);
                              if (!fullUrl) return null;
                              return (
                                <View key={imgIdx} style={{ position: 'relative', marginRight: 8 }}>
                                  <TouchableOpacity onPress={() => {
                                    const allImages = sub.photos.map((u: string) => getFullImageUrl(u)).filter(Boolean) as string[];
                                    setPreviewImages(allImages);
                                    setPreviewImageIndex(imgIdx);
                                    setActivePreviewTarget({ itemIdx, subIdx });
                                  }}>
                                    <Image source={{ uri: fullUrl }} style={{ width: 50, height: 50, borderRadius: 6, backgroundColor: isDarkMode ? '#1e293b' : '#cbd5e1' }} contentFit="cover" transition={100} />
                                  </TouchableOpacity>
                                  {!isReadOnly && (
                                    <TouchableOpacity
                                      onPress={() => {
                                        const updated = [...dispatchItems];
                                        updated[itemIdx].subItems[subIdx].photos = sub.photos.filter((_: any, idx: number) => idx !== imgIdx);
                                        setDispatchItems(updated);
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: -5,
                                        right: -5,
                                        backgroundColor: Colors.error[500],
                                        borderRadius: 8,
                                        width: 16,
                                        height: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <X size={10} color="#fff" />
                                    </TouchableOpacity>
                                  )}
                                </View>
                              );
                            })}
                          </ScrollView>
                        )}
                      </View>
                    ))}

                    {/* Add More Sub Items button */}
                    {!isReadOnly && (
                      <TouchableOpacity
                        onPress={() => handleAddSubItem(itemIdx)}
                        style={{
                          height: 36,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? 'rgba(234, 88, 12, 0.4)' : '#fed7aa',
                          borderStyle: 'dashed',
                          borderRadius: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.05)' : 'rgba(234, 88, 12, 0.02)',
                          marginTop: 4
                        }}
                      >
                        <Plus size={14} color={'#ea580c'} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#ea580c' }}>
                          Add Quality & Finish Item
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
              )}

              {/* Add New Dispatch Item button */}
              {!isReadOnly && (
                <TouchableOpacity
                  onPress={handleAddDispatchItem}
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
                    Add New Dispatch Item
                  </Text>
                </TouchableOpacity>
              )}

              {/* Uploading progress indicator */}
              {(uploading || localUploading) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color={'#ea580c'} />
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>Uploading images...</Text>
                </View>
              )}

              {/* Save Button */}
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
                ) : existingDispatches && existingDispatches.length > 0 && onDelete && isMaster ? (
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
                      disabled={isSaving || localUploading}
                      style={{
                        flex: 1.8,
                        height: 50,
                        backgroundColor: '#ea580c',
                        borderRadius: 14,
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: '#ea580c',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDarkMode ? 0.3 : 0.2,
                        shadowRadius: 8,
                        elevation: 4,
                        flexDirection: 'row',
                        gap: 8,
                        opacity: (isSaving || localUploading) ? 0.7 : 1,
                      }}
                    >
                      {isSaving || localUploading ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                          <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800' }}>
                            {localUploading ? 'Uploading Photos...' : 'Saving...'}
                          </Text>
                        </>
                      ) : (
                        <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                          Save All Dispatches
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving || localUploading}
                    style={{
                      flex: 1,
                      height: 50,
                      backgroundColor: '#ea580c',
                      borderRadius: 14,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: '#ea580c',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: isDarkMode ? 0.3 : 0.2,
                      shadowRadius: 8,
                      elevation: 4,
                      flexDirection: 'row',
                      gap: 8,
                      opacity: (isSaving || localUploading) ? 0.7 : 1,
                    }}
                  >
                    {isSaving || localUploading ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                        <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800' }}>
                          {localUploading ? 'Uploading Photos...' : 'Saving...'}
                        </Text>
                      </>
                    ) : (
                      <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                        Save All Dispatches
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              </View>
              )}
            </ScrollView>
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
            const updated = [...dispatchItems];
            updated[activeDatePickerIndex].dispatchDate = dateStr;
            setDispatchItems(updated);
          }
          setActiveDatePickerIndex(null);
        }}
        value={activeDatePickerIndex !== null ? (dispatchItems[activeDatePickerIndex]?.dispatchDate || '') : ''}
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
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 40}
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
                      ? dispatchItems[selectorModal.itemIndex]?.subItems[selectorModal.subItemIndex]?.quality === q._id
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
                              const updated = [...dispatchItems];
                              updated[selectorModal.itemIndex].subItems[selectorModal.subItemIndex].quality = q._id;
                              setDispatchItems(updated);
                            }
                            setSelectorModal(null);
                          }}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: 10,
                            backgroundColor: isSelected ? (isDarkMode ? 'rgba(234, 88, 12, 0.25)' : '#ffedd5') : 'transparent',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontWeight: isSelected ? '700' : '500',
                            color: isSelected ? '#ea580c' : theme.text
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

       {/* Custom Camera Modal */}
       <CustomCameraModal
         visible={showCustomCamera}
         onClose={() => {
           setShowCustomCamera(false);
           setPhotoTarget(null);
         }}
         onPhotosCaptured={(uris) => {
           handleUploadPhotos(uris);
         }}
         singlePhoto={false}
       />
 
       {/* Image Preview Modal */}
       <ImagePreviewModal
         visible={previewImages.length > 0}
         images={previewImages}
         initialIndex={previewImageIndex}
         onClose={() => setPreviewImages([])}
         onSaveCroppedImage={async (localUri, idx) => {
           if (!activePreviewTarget) return null;
           const { itemIdx, subIdx } = activePreviewTarget;
           const newUrl = await handleUploadSingleCroppedImage(localUri, itemIdx, subIdx, idx);
           return newUrl;
         }}
       />

       <DeleteConfirmModal
          visible={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={onDelete || (() => {})}
          title="Delete All Dispatches"
          message="Are you sure you want to delete all dispatches for this order? This action cannot be undone."
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
