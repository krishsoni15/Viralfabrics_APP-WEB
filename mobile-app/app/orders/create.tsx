import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Image, Modal, Share, Dimensions, Animated as RNAnimated, PanResponder, TouchableWithoutFeedback, useWindowDimensions, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ClipboardList, Plus, Trash2, Calendar, FileText, User, Tag, ArrowRight, Check, Camera, X, Share2, Copy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  // Safe fallback for builds missing native image picker modules
}

import api from '../../services/api';
import Header from '../../components/shared/Header';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import DatePickerModal from '../../components/shared/DatePickerModal';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { CONFIG } from '../../constants/config';
import { getDisplayOrderId, resolveImageUrl, uploadSingleImage } from '../../utils/helpers';
import ImagePreviewModal from '../../components/shared/ImagePreviewModal';
import CustomCameraModal from '../../components/shared/CustomCameraModal';
import { PulsingContainer, Skeleton } from '../../components/ui/Skeleton';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';

const getFullImageUrl = (url: string | null | undefined) => {
  return resolveImageUrl(url) || null;
};

const AutoRatioImage = ({
  uri,
  height,
  borderColor,
  onPress,
  index,
  totalCount,
}: {
  uri: string;
  height: number;
  borderColor: string;
  onPress: () => void;
  index?: number;
  totalCount?: number;
}) => {
  const { isDarkMode } = useTheme();
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (active && width && height) {
          setAspectRatio(width / height);
          setLoading(false);
        }
      },
      (error) => {
        console.log('Failed to get image size:', error);
        if (active) setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [uri]);

  const isImageVisible = !loading && imageLoaded;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        height: height,
        aspectRatio: aspectRatio,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: borderColor,
        backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
        flexShrink: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDarkMode ? 0.35 : 0.08,
        shadowRadius: 4,
        elevation: 3,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%', opacity: imageLoaded ? 1 : 0 }}
        resizeMode="cover"
        onLoadEnd={() => setImageLoaded(true)}
      />
      {(!imageLoaded || loading) && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <PulsingContainer style={{ width: '100%', height: '100%' }}>
            <Skeleton width="100%" height="100%" borderRadius={10} style={{ backgroundColor: isDarkMode ? '#334155' : '#cbd5e1' }} />
          </PulsingContainer>
        </View>
      )}
      {totalCount !== undefined && totalCount > 1 && index !== undefined && isImageVisible && (
        <View style={{
          position: 'absolute',
          top: 6,
          left: 6,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
          zIndex: 10,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
            {index + 1}/{totalCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};


const parseIsoToDdMmYyyy = (isoStr: string | null | undefined): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

const parseDdMmYyyyToIso = (dateStr: string | null | undefined): string | undefined => {
  if (!dateStr || !dateStr.includes('/')) return undefined;
  try {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed month
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const d = new Date(year, month, day);
        return d.toISOString();
      }
    }
  } catch {}
  return undefined;
};

const ORDER_TYPES: ('Dying' | 'Printing')[] = ['Dying', 'Printing'];

export default function CreateOrderScreen() {
  const { width: screenWidth, height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);
  const user = useAppStore((s) => s.user);
  const isMasterUser = user?.role === 'master' || user?.role === 'superadmin';
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [orderIdToUpdate, setOrderIdToUpdate] = useState<string | undefined>(id);
  const [isEditMode, setIsEditMode] = useState(!!id);
  const isEdit = isEditMode;
  const [deleteWarning, setDeleteWarning] = useState<{ title: string; message: string } | null>(null);
  const { isLargeScreen, modalMaxWidth } = useResponsiveLayout();

  // Load parties and qualities for dropdowns
  const partiesQuery = useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      const { data } = await api.get('/api/parties');
      return Array.isArray(data) ? data : data?.data || [];
    },
  });

  const qualitiesQuery = useQuery({
    queryKey: ['qualities'],
    queryFn: async () => {
      const { data } = await api.get('/api/qualities');
      return Array.isArray(data) ? data : data?.data || [];
    },
  });

  // State fields
  const [orderType, setOrderType] = useState<'Dying' | 'Printing' | ''>('');
  const [partyId, setPartyId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [styleNo, setStyleNo] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [poDate, setPoDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [status, setStatus] = useState('pending');

  // Date Picker Modals
  const [showArrivalPicker, setShowArrivalPicker] = useState(false);
  const [showPoPicker, setShowPoPicker] = useState(false);
  const [showDeliveryPicker, setShowDeliveryPicker] = useState(false);

  // Modals for selection
  const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showCreatePartyModal, setShowCreatePartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const handleDateTextChange = (text: string, setter: (val: string) => void) => {
    let cleaned = text.replace(/[^0-9/]/g, '');
    const len = cleaned.length;
    if (len === 2 && !cleaned.includes('/')) {
      cleaned = cleaned + '/';
    } else if (len === 5 && cleaned.split('/').length === 2) {
      cleaned = cleaned + '/';
    }
    if (len <= 10) {
      setter(cleaned);
    }
  };
  const [showCreateQualityModal, setShowCreateQualityModal] = useState(false);
  const [newQualityName, setNewQualityName] = useState('');
  const [creatingQualityForIndex, setCreatingQualityForIndex] = useState<number | null>(null);
  const [activeQualityItemIndex, setActiveQualityItemIndex] = useState<number | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);
  const [currentActiveIndex, setCurrentActiveIndex] = useState(0);
  const [activePreviewItemIndex, setActivePreviewItemIndex] = useState<number | null>(null);
  const [localUploading, setLocalUploading] = useState(false);
  const [showCustomCamera, setShowCustomCamera] = useState(false);
  const [cameraActiveItemIndex, setCameraActiveItemIndex] = useState<number | null>(null);

  // Searches
  const [partySearch, setPartySearch] = useState('');
  const [qualitySearch, setQualitySearch] = useState('');

  // Screen Height for swipe gestures
  const dimensionsRef = useRef({ screenWidth, SCREEN_HEIGHT });
  dimensionsRef.current = { screenWidth, SCREEN_HEIGHT };

  // Party Select Modal Swipe to close
  const partyTranslateY = useRef(new RNAnimated.Value(0)).current;
  const partyTouchStartPageY = useRef(0);
  const partySheetY = useRef(0);
  const partyScrollY = useRef(0);
  const partyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        partyTouchStartPageY.current = pageY;
        return pageY < partySheetY.current + 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        partyScrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        partyScrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) partyTranslateY.setValue(g.dy);
      },
      onPanResponderRelease: (evt, g) => {
        const isBackdropTouch = partyTouchStartPageY.current < partySheetY.current;
        if (isBackdropTouch && Math.abs(g.dy) < 10 && Math.abs(g.dx) < 10) {
          setShowPartyModal(false);
          return;
        }

        if (g.dy > 50 || g.vy > 0.2) {
          RNAnimated.timing(partyTranslateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true })
            .start(() => setShowPartyModal(false));
        } else {
          RNAnimated.spring(partyTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (showPartyModal) {
      partyTranslateY.setValue(0);
    }
  }, [showPartyModal]);

  // Quality Select Modal Swipe to close
  const qualityTranslateY = useRef(new RNAnimated.Value(0)).current;
  const qualityTouchStartPageY = useRef(0);
  const qualitySheetY = useRef(0);
  const qualityScrollY = useRef(0);
  const qualityPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        qualityTouchStartPageY.current = pageY;
        return pageY < qualitySheetY.current + 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        qualityScrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        qualityScrollY.current <= 5 && g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) qualityTranslateY.setValue(g.dy);
      },
      onPanResponderRelease: (evt, g) => {
        const isBackdropTouch = qualityTouchStartPageY.current < qualitySheetY.current;
        if (isBackdropTouch && Math.abs(g.dy) < 10 && Math.abs(g.dx) < 10) {
          setActiveQualityItemIndex(null);
          return;
        }

        if (g.dy > 50 || g.vy > 0.2) {
          RNAnimated.timing(qualityTranslateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true })
            .start(() => setActiveQualityItemIndex(null));
        } else {
          RNAnimated.spring(qualityTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (activeQualityItemIndex !== null) {
      qualityTranslateY.setValue(0);
    }
  }, [activeQualityItemIndex]);

  // Order Type Modal Swipe to close
  const orderTypeTranslateY = useRef(new RNAnimated.Value(0)).current;
  const orderTypeTouchStartPageY = useRef(0);
  const orderTypeSheetY = useRef(0);
  const orderTypePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        orderTypeTouchStartPageY.current = pageY;
        return pageY < orderTypeSheetY.current + 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && g.dy > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) orderTypeTranslateY.setValue(g.dy);
      },
      onPanResponderRelease: (evt, g) => {
        const isBackdropTouch = orderTypeTouchStartPageY.current < orderTypeSheetY.current;
        if (isBackdropTouch && Math.abs(g.dy) < 10 && Math.abs(g.dx) < 10) {
          setShowOrderTypeModal(false);
          return;
        }

        if (g.dy > 50 || g.vy > 0.2) {
          RNAnimated.timing(orderTypeTranslateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true })
            .start(() => setShowOrderTypeModal(false));
        } else {
          RNAnimated.spring(orderTypeTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (showOrderTypeModal) {
      orderTypeTranslateY.setValue(0);
    }
  }, [showOrderTypeModal]);

  // Items State (supports multiple items!)
  const [items, setItems] = useState<Array<{
    _id?: string;
    quality: string;
    quantity: string;
    weaverSupplierName: string;
    description: string;
    purchaseRate: string;
    millRate: string;
    salesRate: string;
    imageUrls: string[];
  }>>([
    { quality: '', quantity: '', weaverSupplierName: '', description: '', purchaseRate: '', millRate: '', salesRate: '', imageUrls: [] }
  ]);

  // Fetch order details for pre-filling when in edit mode
  const orderQuery = useQuery({
    queryKey: ['order', orderIdToUpdate],
    queryFn: async () => {
      if (!orderIdToUpdate) return null;
      const { data } = await api.get(`/api/orders/${orderIdToUpdate}`);
      return data?.data || data?.order || data;
    },
    enabled: isEditMode,
  });

  // Pre-fill state values on mount or when order query details load
  useEffect(() => {
    if (isEdit && orderQuery.data) {
      const order = orderQuery.data;
      setOrderType(order.orderType || '');
      setPartyId(order.party && typeof order.party === 'object' ? order.party?._id : order.party || '');
      setContactName(order.contactName || '');
      setContactPhone(order.contactPhone || '');
      setPoNumber(order.poNumber || '');
      setStyleNo(order.styleNo || '');
      setArrivalDate(parseIsoToDdMmYyyy(order.arrivalDate));
      setPoDate(parseIsoToDdMmYyyy(order.poDate));
      setDeliveryDate(parseIsoToDdMmYyyy(order.deliveryDate));
      setStatus(order.status || 'pending');

      if (Array.isArray(order.items) && order.items.length > 0) {
        setItems(order.items.map((item: any) => ({
          _id: item._id,
          quality: item.quality && typeof item.quality === 'object' ? item.quality?._id : item.quality || '',
          quantity: item.quantity !== undefined ? String(item.quantity) : '',
          weaverSupplierName: item.weaverSupplierName || '',
          description: item.description || '',
          purchaseRate: item.purchaseRate !== undefined ? String(item.purchaseRate) : '',
          millRate: item.millRate !== undefined ? String(item.millRate) : '',
          salesRate: item.salesRate !== undefined ? String(item.salesRate) : '',
          imageUrls: item.imageUrls || item.images || [],
        })));
      }
    }
  }, [isEdit, orderQuery.data]);

  const galleryRef = React.useRef<ScrollView>(null);


  useEffect(() => {
    if (previewImages.length > 0 && galleryRef.current) {
      setTimeout(() => {
        galleryRef.current?.scrollTo({ x: previewImageIndex * screenWidth, animated: false });
      }, 100);
    }
  }, [previewImages, previewImageIndex]);

  const handleAddItem = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems([
      ...items,
      { quality: '', quantity: '', weaverSupplierName: '', description: '', purchaseRate: '', millRate: '', salesRate: '', imageUrls: [] }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (items.length === 1) {
      addToast({
        type: 'error',
        title: 'Cannot remove last item',
        message: 'At least one item is required per order.',
      });
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, key: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: value };
    setItems(updated);
  };

  const [uploadingItemIndex, setUploadingItemIndex] = useState<number | null>(null);

  const handlePickImage = async (index: number, useCamera: boolean) => {
    try {
      if (!ImagePicker || !ImagePicker.requestCameraPermissionsAsync) {
        Alert.alert(
          'Feature Unavailable',
          'Camera and gallery access are not available in this client environment.'
        );
        return;
      }
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
        const updated = [...items];
        updated[index] = {
          ...updated[index],
          imageUrls: [...(updated[index].imageUrls || []), ...localUris]
        };
        setItems(updated);
      }
    } catch (err: any) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'An error occurred during image selection.');
    }
  };

  const handleUploadPhotos = async (index: number, uris: string[]) => {
    if (uris.length === 0) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      imageUrls: [...(updated[index].imageUrls || []), ...uris]
    };
    setItems(updated);
  };

  const handleUploadSingleCroppedImage = async (
    localUri: string,
    itemIdx: number,
    imgIdx: number
  ): Promise<string | null> => {
    setItems((prev) => {
      const updated = [...prev];
      if (updated[itemIdx] && updated[itemIdx].imageUrls) {
        const urls = [...updated[itemIdx].imageUrls];
        urls[imgIdx] = localUri;
        updated[itemIdx].imageUrls = urls;
      }
      return updated;
    });
    return localUri;
  };

  const createPartyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post('/api/parties', { name });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      const newParty = data?.data || data?.party || data;
      if (newParty && newParty._id) {
        setPartyId(newParty._id);
        if (newParty.contactName) setContactName(newParty.contactName);
        if (newParty.contactPhone) setContactPhone(newParty.contactPhone);
      }
      setShowCreatePartyModal(false);
      setNewPartyName('');
      addToast({
        type: 'success',
        title: 'Party Created',
        message: `Party "${newParty.name || 'New Party'}" has been added.`,
      });
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to create party';
      Alert.alert('Error', errMsg);
    }
  });

  const handleCopyOrder = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert(
      'Copy Order Details',
      'This will clone the current order details into a new order form.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          onPress: () => {
            setOrderIdToUpdate(undefined);
            setIsEditMode(false);
            setItems(prevItems => prevItems.map(item => ({ ...item, _id: undefined })));
            addToast({
              type: 'success',
              title: 'Order Details Copied 🎉',
              message: 'Now creating a new order with these details.',
            });
          }
        }
      ]
    );
  };

  const handleCreateParty = () => {
    if (!newPartyName.trim()) {
      Alert.alert('Error', 'Please enter a party name.');
      return;
    }
    createPartyMutation.mutate(newPartyName.trim());
  };

  const createQualityMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post('/api/qualities', { name });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['qualities'] });
      const newQual = data?.data || data?.quality || data;
      if (newQual && newQual._id && creatingQualityForIndex !== null) {
        handleItemChange(creatingQualityForIndex, 'quality', newQual._id);
      }
      setShowCreateQualityModal(false);
      setNewQualityName('');
      setCreatingQualityForIndex(null);
      addToast({
        type: 'success',
        title: 'Quality Created',
        message: `Quality "${newQual.name || 'New Quality'}" has been added.`,
      });
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to create quality';
      Alert.alert('Error', errMsg);
    }
  });

  const handleCreateQuality = () => {
    if (!newQualityName.trim()) {
      Alert.alert('Error', 'Please enter a quality name.');
      return;
    }
    createQualityMutation.mutate(newQualityName.trim());
  };

  const [deletePartyTarget, setDeletePartyTarget] = useState<any>(null);
  const deletePartyMutation = useMutation({
    mutationFn: async (partyId: string) => {
      const { data } = await api.delete(`/api/parties/${partyId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setDeletePartyTarget(null);
      addToast({
        type: 'success',
        title: 'Party Deleted',
        message: 'Party has been successfully deleted.',
      });
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to delete party';
      setDeleteWarning({
        title: 'Cannot Delete Party',
        message: errMsg,
      });
      setDeletePartyTarget(null);
    }
  });

  const [deleteQualityTarget, setDeleteQualityTarget] = useState<any>(null);
  const deleteQualityMutation = useMutation({
    mutationFn: async (qualityId: string) => {
      const { data } = await api.delete(`/api/qualities/${qualityId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualities'] });
      setDeleteQualityTarget(null);
      addToast({
        type: 'success',
        title: 'Quality Deleted',
        message: 'Quality has been successfully deleted.',
      });
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

  // Create Submit Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/api/orders', payload);
      return data;
    },
    onSuccess: () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({
        type: 'success',
        title: 'Order Created 🎉',
        message: 'The new order has been saved successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      router.back();
    },
    onError: (err: any) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errMsg = err?.response?.data?.message || err?.message || 'Something went wrong';
      Alert.alert('Failed to Create Order', errMsg);
    }
  });

  // Edit Update Mutation
  const updateOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.put(`/api/orders/${orderIdToUpdate}`, payload);
      return data;
    },
    onSuccess: (data) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast({
        type: 'success',
        title: 'Order Updated 🎉',
        message: 'The order has been updated successfully.',
      });

      const updatedOrder = data?.data || data?.order || data;
      if (updatedOrder && updatedOrder._id) {
        // ⚡ OPTIMISTIC CACHE UPDATE: Update the order in the list cache instantly
        queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
          if (!oldData) return oldData;
          if (Array.isArray(oldData)) {
            return oldData.map((order: any) => order._id === updatedOrder._id ? updatedOrder : order);
          }
          if (oldData.data && Array.isArray(oldData.data)) {
            return {
              ...oldData,
              data: oldData.data.map((order: any) => order._id === updatedOrder._id ? updatedOrder : order)
            };
          }
          return oldData;
        });

        // Also update the single order query cache
        queryClient.setQueryData(['order', updatedOrder._id], updatedOrder);
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      router.back();
    },
    onError: (err: any) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errMsg = err?.response?.data?.message || err?.message || 'Something went wrong';
      Alert.alert('Failed to Update Order', errMsg);
    }
  });

  const uploadLocalPhotos = async (itemsList: any[]): Promise<any[]> => {
    const updatedItems = JSON.parse(JSON.stringify(itemsList));
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      if (item.imageUrls && item.imageUrls.length > 0) {
        const uploadedUrls: string[] = [];
        for (const url of item.imageUrls) {
          if (url.startsWith('file://') || url.startsWith('ph://') || !url.startsWith('http')) {
            try {
              const remoteUrl = await uploadSingleImage(url, 'orders');
              if (remoteUrl) {
                uploadedUrls.push(remoteUrl);
              } else {
                uploadedUrls.push(url);
              }
            } catch (err) {
              console.error('Failed to upload local image on save:', err);
              uploadedUrls.push(url);
            }
          } else {
            uploadedUrls.push(url);
          }
        }
        item.imageUrls = uploadedUrls;
      }
    }
    return updatedItems;
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!orderType) {
      Alert.alert('Validation Error', 'Please select an Order Type.');
      return;
    }

    // Items validation
    for (let i = 0; i < items.length; i++) {
      if (!items[i].quality) {
        Alert.alert('Validation Error', `Please select a Quality for Item #${i + 1}.`);
        return;
      }
      
      const qtyStr = String(items[i].quantity || '').trim();
      const qtyNum = Number(qtyStr);
      if (!qtyStr || isNaN(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
        Alert.alert('Validation Error', `Quantity for Item #${i + 1} must be a positive whole number.`);
        return;
      }
    }

    try {
      setLocalUploading(true);
      const uploadedItems = await uploadLocalPhotos(items);
      setItems(uploadedItems);

      const payload = {
        orderType,
        party: partyId || undefined,
        contactName: contactName || '',
        contactPhone: contactPhone || '',
        poNumber: poNumber || '',
        styleNo: styleNo || '',
        arrivalDate: parseDdMmYyyyToIso(arrivalDate),
        poDate: parseDdMmYyyyToIso(poDate),
        deliveryDate: parseDdMmYyyyToIso(deliveryDate),
        status,
        items: uploadedItems.map(item => ({
          _id: item._id,
          quality: item.quality || undefined,
          quantity: Number(item.quantity),
          weaverSupplierName: item.weaverSupplierName || '',
          description: item.description || '',
          purchaseRate: item.purchaseRate ? Number(item.purchaseRate) : undefined,
          millRate: item.millRate ? Number(item.millRate) : undefined,
          salesRate: item.salesRate ? Number(item.salesRate) : undefined,
          imageUrls: item.imageUrls || [],
        }))
      };

      if (isEdit) {
        updateOrderMutation.mutate(payload);
      } else {
        createOrderMutation.mutate(payload);
      }
    } catch (err: any) {
      console.error('Submit failed during upload:', err);
      Alert.alert('Upload Error', 'Failed to upload local photos: ' + err.message);
    } finally {
      setLocalUploading(false);
    }
  };

  const parties = partiesQuery.data || [];
  const qualities = qualitiesQuery.data || [];

  const getSelectedPartyName = () => {
    const found = parties.find((p: any) => p && p._id === partyId);
    if (found) return found.name;
    if (orderQuery.data && typeof orderQuery.data.party === 'object' && orderQuery.data.party?._id === partyId) {
      return orderQuery.data.party?.name || '';
    }
    return '';
  };

  const getSelectedQualityName = (item: any) => {
    const found = qualities.find((q: any) => q && q._id === item.quality);
    if (found) return found.name;
    if (orderQuery.data && Array.isArray(orderQuery.data.items)) {
      const matchedItem = orderQuery.data.items.find((origItem: any) => origItem._id === item._id || origItem.id === item._id);
      if (matchedItem && matchedItem.quality && typeof matchedItem.quality === 'object' && matchedItem.quality?._id === item.quality) {
        return matchedItem.quality?.name || '';
      }
    }
    return '';
  };

  const isPending = createOrderMutation.isPending || updateOrderMutation.isPending || localUploading;

  if (isEdit && orderQuery.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <Header title="Edit Order" showBack />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
          <ActivityIndicator size="large" color={Colors.primary[600]} />
          <Text style={{ marginTop: 14, fontSize: 15, fontWeight: '600', color: theme.textSecondary }}>
            Loading Order Details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <Header 
        title={isEdit && orderQuery.data?.orderId ? `Edit Order #${getDisplayOrderId(orderQuery.data.orderId)}` : (isEdit ? "Edit Order" : "Create Order")} 
        showBack 
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          
          <Animated.View entering={FadeInUp.duration(400)} style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <Card style={{ padding: 20, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Order Details</Text>
                {isEdit && orderQuery.data?.orderId && (
                  <View style={{ backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : Colors.primary[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary[600] }}>
                      #{getDisplayOrderId(orderQuery.data.orderId)}
                    </Text>
                  </View>
                )}
              </View>
              
              {/* Order Type Selector */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 }}>Order Type *</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowOrderTypeModal(true)}
                style={{
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  paddingHorizontal: 14,
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 14, color: orderType ? theme.text : theme.textTertiary }}>
                  {orderType || 'Select Type'}
                </Text>
              </TouchableOpacity>

              {/* Party Select Dropdown & Inline Create */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 }}>Party</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <View
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowPartyModal(true);
                      setPartySearch('');
                    }}
                    style={{
                      flex: 1,
                      height: '100%',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ fontSize: 14, color: partyId ? theme.text : theme.textTertiary }} numberOfLines={1}>
                      {getSelectedPartyName() || 'Search parties...'}
                    </Text>
                  </TouchableOpacity>

                  {partyId ? (
                    <TouchableOpacity
                      onPress={() => {
                        setPartyId('');
                        setContactName('');
                        setContactPhone('');
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={{ padding: 4 }}
                    >
                      <X size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    setNewPartyName('');
                    setShowCreatePartyModal(true);
                  }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : Colors.primary[50],
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : Colors.primary[200],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={20} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
                </TouchableOpacity>
              </View>

              {/* Contact Info */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Contact Name</Text>
                  <TextInput
                    placeholder="e.g. John Doe"
                    placeholderTextColor={theme.textTertiary}
                    value={contactName}
                    onChangeText={setContactName}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      paddingHorizontal: 14,
                      fontSize: 14,
                      color: theme.text,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Contact Phone</Text>
                  <TextInput
                    placeholder="e.g. +91 98765..."
                    placeholderTextColor={theme.textTertiary}
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    keyboardType="phone-pad"
                    style={{
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      paddingHorizontal: 14,
                      fontSize: 14,
                      color: theme.text,
                    }}
                  />
                </View>
              </View>

              {/* PO Number and Style No */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>PO Number</Text>
                  <TextInput
                    placeholder="PO No"
                    placeholderTextColor={theme.textTertiary}
                    value={poNumber}
                    onChangeText={setPoNumber}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      paddingHorizontal: 14,
                      fontSize: 14,
                      color: theme.text,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Style Number</Text>
                  <TextInput
                    placeholder="Style No"
                    placeholderTextColor={theme.textTertiary}
                    value={styleNo}
                    onChangeText={setStyleNo}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      paddingHorizontal: 14,
                      fontSize: 14,
                      color: theme.text,
                    }}
                  />
                </View>
              </View>

            </Card>
          </Animated.View>

          {/* Dates & Schedule Card */}
          <Animated.View entering={FadeInUp.duration(400).delay(100)} style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <Card style={{ padding: 20, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 16 }}>Schedule</Text>
              
              <View style={{ gap: 14 }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Arrival Date</Text>
                  <View style={{
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                  }}>
                    <TextInput
                      style={{ flex: 1, color: theme.text, fontSize: 14, height: '100%', padding: 0 }}
                      placeholder="dd/mm/yyyy"
                      placeholderTextColor={theme.textTertiary}
                      value={arrivalDate}
                      onChangeText={(val) => handleDateTextChange(val, setArrivalDate)}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => setShowArrivalPicker(true)} activeOpacity={0.7} style={{ padding: 4 }}>
                      <Calendar size={18} color={Colors.primary[600]} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>PO Date</Text>
                  <View style={{
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                  }}>
                    <TextInput
                      style={{ flex: 1, color: theme.text, fontSize: 14, height: '100%', padding: 0 }}
                      placeholder="dd/mm/yyyy"
                      placeholderTextColor={theme.textTertiary}
                      value={poDate}
                      onChangeText={(val) => handleDateTextChange(val, setPoDate)}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => setShowPoPicker(true)} activeOpacity={0.7} style={{ padding: 4 }}>
                      <Calendar size={18} color={Colors.primary[600]} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Delivery Date</Text>
                  <View style={{
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                  }}>
                    <TextInput
                      style={{ flex: 1, color: theme.text, fontSize: 14, height: '100%', padding: 0 }}
                      placeholder="dd/mm/yyyy"
                      placeholderTextColor={theme.textTertiary}
                      value={deliveryDate}
                      onChangeText={(val) => handleDateTextChange(val, setDeliveryDate)}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => setShowDeliveryPicker(true)} activeOpacity={0.7} style={{ padding: 4 }}>
                      <Calendar size={18} color={Colors.primary[600]} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* Dynamic Order Items List */}
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Order Items ({items.length})</Text>
            </View>

            {items.map((item, index) => (
              <Animated.View
                key={index}
                entering={FadeInDown.duration(300)}
                style={{ marginBottom: 16 }}
              >
                <Card style={{ padding: 18, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: theme.textTertiary, textTransform: 'uppercase' }}>
                      Item #{index + 1}
                    </Text>
                    {items.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(index)}
                        activeOpacity={0.7}
                        style={{ padding: 4 }}
                      >
                        <Trash2 size={18} color={Colors.error[500]} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Quality Select Dropdown & Inline Create */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 }}>Quality *</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                        borderWidth: 1,
                        borderColor: theme.borderLight,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center'
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setActiveQualityItemIndex(index);
                          setQualitySearch('');
                        }}
                        style={{
                          flex: 1,
                          height: '100%',
                          justifyContent: 'center'
                        }}
                      >
                        <Text style={{ fontSize: 14, color: item.quality ? theme.text : theme.textTertiary }} numberOfLines={1}>
                          {getSelectedQualityName(item) || 'Search quality...'}
                        </Text>
                      </TouchableOpacity>

                      {item.quality ? (
                        <TouchableOpacity
                          onPress={() => {
                            handleItemChange(index, 'quality', '');
                          }}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={{ padding: 4 }}
                        >
                          <X size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setNewQualityName('');
                        setCreatingQualityForIndex(index);
                        setShowCreateQualityModal(true);
                      }}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : Colors.primary[50],
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : Colors.primary[200],
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Plus size={20} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
                    </TouchableOpacity>
                  </View>

                  {/* Quantity Field */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Quantity *</Text>
                  <TextInput
                    placeholder="Enter quantity"
                    placeholderTextColor={theme.textTertiary}
                    value={item.quantity}
                    onChangeText={(v) => handleItemChange(index, 'quantity', v)}
                    keyboardType="numeric"
                    style={{
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      paddingHorizontal: 14,
                      fontSize: 14,
                      color: theme.text,
                      marginBottom: 12,
                    }}
                  />

                  {/* Weaver Name */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Weaver Name</Text>
                  <TextInput
                    placeholder="Enter weaver or supplier name"
                    placeholderTextColor={theme.textTertiary}
                    value={item.weaverSupplierName}
                    onChangeText={(v) => handleItemChange(index, 'weaverSupplierName', v)}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      paddingHorizontal: 14,
                      fontSize: 14,
                      color: theme.text,
                      marginBottom: 12,
                    }}
                  />

                  {/* Description */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Description</Text>
                  <TextInput
                    placeholder="Enter description"
                    placeholderTextColor={theme.textTertiary}
                    value={item.description}
                    onChangeText={(v) => handleItemChange(index, 'description', v)}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      paddingHorizontal: 14,
                      fontSize: 14,
                      color: theme.text,
                      marginBottom: 12,
                    }}
                  />

                  {/* Rates */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Purchase Rate</Text>
                      <TextInput
                        placeholder="0.00"
                        placeholderTextColor={theme.textTertiary}
                        value={item.purchaseRate}
                        onChangeText={(v) => handleItemChange(index, 'purchaseRate', v)}
                        keyboardType="numeric"
                        style={{
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                          borderWidth: 1,
                          borderColor: theme.borderLight,
                          paddingHorizontal: 14,
                          fontSize: 14,
                          color: theme.text,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Mill Rate</Text>
                      <TextInput
                        placeholder="0.00"
                        placeholderTextColor={theme.textTertiary}
                        value={item.millRate}
                        onChangeText={(v) => handleItemChange(index, 'millRate', v)}
                        keyboardType="numeric"
                        style={{
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                          borderWidth: 1,
                          borderColor: theme.borderLight,
                          paddingHorizontal: 14,
                          fontSize: 14,
                          color: theme.text,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Sales Rate</Text>
                      <TextInput
                        placeholder="0.00"
                        placeholderTextColor={theme.textTertiary}
                        value={item.salesRate}
                        onChangeText={(v) => handleItemChange(index, 'salesRate', v)}
                        keyboardType="numeric"
                        style={{
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                          borderWidth: 1,
                          borderColor: theme.borderLight,
                          paddingHorizontal: 14,
                          fontSize: 14,
                          color: theme.text,
                        }}
                      />
                    </View>
                  </View>

                  {/* Images */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginTop: 12, marginBottom: 8 }}>Images</Text>
                  
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handlePickImage(index, false)}
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
                      <Tag size={16} color={theme.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Upload Image</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setCameraActiveItemIndex(index);
                        setShowCustomCamera(true);
                      }}
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

                  {/* Uploading progress indicator */}
                  {uploadingItemIndex === index && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <ActivityIndicator size="small" color={Colors.primary[600]} />
                      <Text style={{ fontSize: 13, color: theme.textSecondary }}>Uploading images...</Text>
                    </View>
                  )}

                  {/* Display picked thumbnails */}
                  {item.imageUrls && item.imageUrls.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ flexDirection: 'row', marginBottom: 12 }}
                      contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: 6 }}
                    >
                      {item.imageUrls.map((url, imgIdx) => {
                        const fullUrl = getFullImageUrl(url);
                        if (!fullUrl) return null;
                        return (
                          <View key={imgIdx} style={{ position: 'relative', marginRight: 10, paddingVertical: 4 }}>
                            <AutoRatioImage
                              uri={fullUrl}
                              height={80}
                              borderColor={isDarkMode ? '#334155' : '#cbd5e1'}
                              onPress={() => {
                                const allItemImages = item.imageUrls.map(u => getFullImageUrl(u)).filter(Boolean) as string[];
                                setPreviewImages(allItemImages);
                                setPreviewImageIndex(imgIdx);
                                setCurrentActiveIndex(imgIdx);
                                setActivePreviewItemIndex(index);
                              }}
                              index={imgIdx}
                              totalCount={item.imageUrls.length}
                            />
                            <TouchableOpacity
                              onPress={() => {
                                const updated = [...items];
                                updated[index].imageUrls = updated[index].imageUrls.filter((_: string, idx: number) => idx !== imgIdx);
                                setItems(updated);
                              }}
                              style={{
                                position: 'absolute',
                                top: -2,
                                right: -6,
                                backgroundColor: Colors.error[500],
                                borderRadius: 10,
                                width: 20,
                                height: 20,
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10,
                              }}
                            >
                              <X size={12} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}

                </Card>
              </Animated.View>
            ))}

            {/* Add Item Button at the bottom */}
            <TouchableOpacity
              onPress={handleAddItem}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : Colors.primary[50],
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : Colors.primary[300],
                marginTop: 8,
                marginBottom: 16,
                gap: 8,
              }}
            >
              <Plus size={18} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>
                Add Another Item
              </Text>
            </TouchableOpacity>
          </View>

          {/* Submit Actions */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Button
              title={isPending ? (isEdit ? 'Updating Order...' : 'Creating Order...') : (isEdit ? 'Update Order' : 'Submit Order')}
              onPress={handleSubmit}
              variant="primary"
              size="lg"
              fullWidth
              disabled={isPending}
              icon={isPending ? <ActivityIndicator size="small" color={Colors.white} /> : <Check size={20} color={Colors.white} />}
              style={{ borderRadius: 16, height: 56, backgroundColor: Colors.primary[600] }}
              textStyle={{ fontSize: 16, fontWeight: '700' }}
            />
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Pickers */}
      <DatePickerModal
        visible={showArrivalPicker}
        onClose={() => setShowArrivalPicker(false)}
        value={arrivalDate}
        onSelectDate={(dStr) => {
          setArrivalDate(dStr);
          setShowArrivalPicker(false);
        }}
      />

      <DatePickerModal
        visible={showPoPicker}
        onClose={() => setShowPoPicker(false)}
        value={poDate}
        onSelectDate={(dStr) => {
          setPoDate(dStr);
          setShowPoPicker(false);
        }}
      />

      <DatePickerModal
        visible={showDeliveryPicker}
        onClose={() => setShowDeliveryPicker(false)}
        value={deliveryDate}
        onSelectDate={(dStr) => {
          setDeliveryDate(dStr);
          setShowDeliveryPicker(false);
        }}
      />

      {/* Order Type Modal */}
      <Modal
        visible={showOrderTypeModal}
        animationType={isLargeScreen ? 'fade' : 'slide'}
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setShowOrderTypeModal(false)}
      >
        <View style={{ flex: 1, justifyContent: isLargeScreen ? 'center' : 'flex-end', alignItems: 'center' }}>
          <Pressable
            onPress={() => setShowOrderTypeModal(false)}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />
          <RNAnimated.View
            onLayout={(e) => {
              orderTypeSheetY.current = e.nativeEvent.layout.y;
            }}
            {...orderTypePanResponder.panHandlers}
            style={{
              backgroundColor: theme.card,
              borderRadius: isLargeScreen ? 24 : undefined,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: isLargeScreen ? 24 : (Platform.OS === 'ios' ? (insets.bottom > 0 ? insets.bottom + 8 : 16) : 16),
              maxHeight: '50%',
              width: isLargeScreen ? '100%' : '100%',
              maxWidth: isLargeScreen ? modalMaxWidth : '100%',
              borderWidth: 1,
              borderColor: theme.border,
              transform: isLargeScreen ? undefined : [{ translateY: orderTypeTranslateY }]
            }}
          >
            {/* Visual Drag Handle */}
            {!isLargeScreen && (
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#3a3a4a' : '#e2e8f0' }} />
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Select Order Type</Text>
              <TouchableOpacity onPress={() => setShowOrderTypeModal(false)} style={{ padding: 4 }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12 }}>
              {ORDER_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setOrderType(type);
                    setShowOrderTypeModal(false);
                  }}
                  style={{
                    height: 54,
                    borderRadius: 14,
                    backgroundColor: orderType === type ? Colors.primary[600] : (isDarkMode ? Colors.neutral[800] : Colors.neutral[50]),
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: orderType === type ? Colors.primary[700] : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: orderType === type ? Colors.white : theme.text }}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Party Select Modal */}
      <Modal
        visible={showPartyModal}
        animationType={isLargeScreen ? 'fade' : 'slide'}
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setShowPartyModal(false)}
      >
        <View style={{ flex: 1, justifyContent: isLargeScreen ? 'center' : 'flex-end', alignItems: 'center' }}>
          <Pressable
            onPress={() => setShowPartyModal(false)}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />

          <RNAnimated.View
            onLayout={(e) => {
              partySheetY.current = e.nativeEvent.layout.y;
            }}
            {...partyPanResponder.panHandlers}
            style={{
              backgroundColor: theme.card,
              borderRadius: isLargeScreen ? 24 : undefined,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: isLargeScreen ? 24 : (Platform.OS === 'ios' ? (insets.bottom > 0 ? insets.bottom + 8 : 16) : 16),
              height: '70%',
              width: isLargeScreen ? '100%' : '100%',
              maxWidth: isLargeScreen ? modalMaxWidth : '100%',
              borderWidth: 1,
              borderColor: theme.border,
              transform: isLargeScreen ? undefined : [{ translateY: partyTranslateY }]
            }}
          >
            {/* Visual Drag Handle */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#3a3a4a' : '#e2e8f0' }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Select Party</Text>
              <TouchableOpacity onPress={() => setShowPartyModal(false)} style={{ padding: 4 }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              placeholder="Search parties..."
              placeholderTextColor={theme.textTertiary}
              value={partySearch}
              onChangeText={setPartySearch}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                borderWidth: 1,
                borderColor: theme.borderLight,
                paddingHorizontal: 14,
                fontSize: 14,
                color: theme.text,
                marginBottom: 16,
              }}
            />

            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={(e) => { partyScrollY.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {parties
                .filter((p: any) => p && p.name && p.name.toLowerCase().includes(partySearch.toLowerCase()))
                .map((p: any) => (
                  <View
                    key={p._id}
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
                        setPartyId(p._id);
                        if (p.contactName) setContactName(p.contactName);
                        if (p.contactPhone) setContactPhone(p.contactPhone);
                        setShowPartyModal(false);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ fontSize: 16, color: theme.text, fontWeight: p && partyId === p._id ? '700' : '400' }}>
                        {p && p.name}
                      </Text>
                      {p && partyId === p._id && (
                        <Check size={20} color={Colors.primary[600]} />
                      )}
                    </TouchableOpacity>

                    {isMasterUser && (
                      <TouchableOpacity
                        onPress={() => setDeletePartyTarget(p)}
                        style={{ padding: 10, marginLeft: 8 }}
                      >
                        <Trash2 size={18} color={Colors.error[600]} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Create Party Modal */}
      <Modal
        visible={showCreatePartyModal}
        animationType={isLargeScreen ? 'fade' : 'fade'}
        transparent
        onRequestClose={() => setShowCreatePartyModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableWithoutFeedback onPress={() => setShowCreatePartyModal(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={{
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 24,
            width: isLargeScreen ? '100%' : '100%',
            maxWidth: isLargeScreen ? modalMaxWidth : '100%',
            borderWidth: 1,
            borderColor: theme.border,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Create New Party</Text>
              <TouchableOpacity onPress={() => setShowCreatePartyModal(false)} style={{ padding: 4 }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Party Name *</Text>
            <TextInput
              placeholder="Enter party name"
              placeholderTextColor={theme.textTertiary}
              value={newPartyName}
              onChangeText={setNewPartyName}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                borderWidth: 1,
                borderColor: theme.borderLight,
                paddingHorizontal: 14,
                fontSize: 14,
                color: theme.text,
                marginBottom: 20,
              }}
            />

            <TouchableOpacity
              onPress={() => {
                if (!newPartyName.trim()) {
                  Alert.alert('Error', 'Party name is required');
                  return;
                }
                createPartyMutation.mutate(newPartyName.trim(), {
                  onSuccess: (data) => {
                    const createdParty = data?.data || data?.party || data;
                    if (createdParty && createdParty._id) {
                      setPartyId(createdParty._id);
                      if (createdParty.contactName) setContactName(createdParty.contactName);
                      if (createdParty.contactPhone) setContactPhone(createdParty.contactPhone);
                    }
                    setShowCreatePartyModal(false);
                  }
                });
              }}
              disabled={createPartyMutation.isPending}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: Colors.primary[600],
                alignItems: 'center',
                justifyContent: 'center',
                opacity: createPartyMutation.isPending ? 0.7 : 1,
              }}
            >
              {createPartyMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Create Party</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Quality Modal */}
      <Modal
        visible={showCreateQualityModal}
        animationType={isLargeScreen ? 'fade' : 'fade'}
        transparent
        onRequestClose={() => setShowCreateQualityModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableWithoutFeedback onPress={() => setShowCreateQualityModal(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={{
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 24,
            width: isLargeScreen ? '100%' : '100%',
            maxWidth: isLargeScreen ? modalMaxWidth : '100%',
            borderWidth: 1,
            borderColor: theme.border,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Create New Quality</Text>
              <TouchableOpacity onPress={() => setShowCreateQualityModal(false)} style={{ padding: 4 }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 6 }}>Quality Name *</Text>
            <TextInput
              placeholder="Enter quality name"
              placeholderTextColor={theme.textTertiary}
              value={newQualityName}
              onChangeText={setNewQualityName}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                borderWidth: 1,
                borderColor: theme.borderLight,
                paddingHorizontal: 14,
                fontSize: 14,
                color: theme.text,
                marginBottom: 20,
              }}
            />

            <TouchableOpacity
              onPress={handleCreateQuality}
              disabled={createQualityMutation.isPending}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: Colors.primary[600],
                alignItems: 'center',
                justifyContent: 'center',
                opacity: createQualityMutation.isPending ? 0.7 : 1,
              }}
            >
              {createQualityMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Create Quality</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quality Search Modal */}
      <Modal
        visible={activeQualityItemIndex !== null}
        animationType={isLargeScreen ? 'fade' : 'slide'}
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setActiveQualityItemIndex(null)}
      >
        <View style={{ flex: 1, justifyContent: isLargeScreen ? 'center' : 'flex-end', alignItems: 'center' }}>
          <Pressable
            onPress={() => setActiveQualityItemIndex(null)}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />

          <RNAnimated.View
            onLayout={(e) => {
              qualitySheetY.current = e.nativeEvent.layout.y;
            }}
            {...qualityPanResponder.panHandlers}
            style={{
              backgroundColor: theme.card,
              borderRadius: isLargeScreen ? 24 : undefined,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: isLargeScreen ? 24 : (Platform.OS === 'ios' ? (insets.bottom > 0 ? insets.bottom + 8 : 16) : 16),
              height: '70%',
              width: isLargeScreen ? '100%' : '100%',
              maxWidth: isLargeScreen ? modalMaxWidth : '100%',
              borderWidth: 1,
              borderColor: theme.border,
              transform: isLargeScreen ? undefined : [{ translateY: qualityTranslateY }]
            }}
          >
            {/* Visual Drag Handle */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#3a3a4a' : '#e2e8f0' }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Select Quality</Text>
              <TouchableOpacity onPress={() => setActiveQualityItemIndex(null)} style={{ padding: 4 }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              placeholder="Search quality..."
              placeholderTextColor={theme.textTertiary}
              value={qualitySearch}
              onChangeText={setQualitySearch}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                borderWidth: 1,
                borderColor: theme.borderLight,
                paddingHorizontal: 14,
                fontSize: 14,
                color: theme.text,
                marginBottom: 16,
              }}
            />

            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={(e) => { qualityScrollY.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {qualities
                .filter((q: any) => q && q.name && q.name.toLowerCase().includes(qualitySearch.toLowerCase()))
                .map((q: any) => {
                  const currentQualityId = activeQualityItemIndex !== null ? items[activeQualityItemIndex]?.quality : null;
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
                          if (activeQualityItemIndex !== null) {
                            handleItemChange(activeQualityItemIndex, 'quality', q._id);
                          }
                          setActiveQualityItemIndex(null);
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 14,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ fontSize: 16, color: theme.text, fontWeight: q && currentQualityId === q._id ? '700' : '400' }}>
                          {q && q.name}
                        </Text>
                        {q && currentQualityId === q._id && (
                          <Check size={20} color={Colors.primary[600]} />
                        )}
                      </TouchableOpacity>

                      {isMasterUser && (
                        <TouchableOpacity
                          onPress={() => setDeleteQualityTarget(q)}
                          style={{ padding: 10, marginLeft: 8 }}
                        >
                          <Trash2 size={18} color={Colors.error[600]} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        visible={previewImages.length > 0}
        images={previewImages}
        initialIndex={previewImageIndex}
        onClose={() => setPreviewImages([])}
        onSaveCroppedImage={async (localUri, idx) => {
          if (activePreviewItemIndex === null) return null;
          const newUrl = await handleUploadSingleCroppedImage(localUri, activePreviewItemIndex, idx);
          return newUrl;
        }}
      />

      {/* Custom Camera Modal */}
      <CustomCameraModal
        visible={showCustomCamera}
        onClose={() => {
          setShowCustomCamera(false);
          setCameraActiveItemIndex(null);
        }}
        onPhotosCaptured={(uris) => {
          if (cameraActiveItemIndex !== null) {
            handleUploadPhotos(cameraActiveItemIndex, uris);
          }
        }}
        singlePhoto={false}
      />

      <DeleteConfirmModal
        visible={deletePartyTarget !== null}
        onClose={() => setDeletePartyTarget(null)}
        onConfirm={() => {
          if (deletePartyTarget?._id) {
            deletePartyMutation.mutate(deletePartyTarget._id);
          }
        }}
        title="Delete Party"
        message={`Are you sure you want to delete "${deletePartyTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isDeleting={deletePartyMutation.isPending}
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

    </SafeAreaView>
  );
}
