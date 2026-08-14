import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform, Modal, TextInput, ActivityIndicator, Image, Share, Dimensions, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronDown, ChevronUp, Package, Beaker, Truck, Factory, FileInput, FileOutput, Edit, Plus, Trash2, Calendar, X, Share2, FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import api from '../../services/api';
import { CONFIG } from '../../constants/config';
import Header from '../../components/shared/Header';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import StatusBadge, { OrderTypeBadge } from '../../components/shared/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { useAppStore } from '../../store/useAppStore';
import { Colors } from '../../constants/colors';
import { formatDate, formatCurrency, getDisplayOrderId, getProcessBadgeStyles } from '../../utils/helpers';
import { Order } from '../../types';
import ImagePreviewModal from '../../components/shared/ImagePreviewModal';
import DatePickerModal from '../../components/shared/DatePickerModal';
import GreyInformationModal from '../../components/orders/GreyInformationModal';
import MillInputModal from '../../components/orders/MillInputModal';
import MillOutputModal from '../../components/orders/MillOutputModal';
import DispatchModal from '../../components/orders/DispatchModal';
import LabDataModal from '../../components/orders/LabDataModal';

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

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        height: height,
        aspectRatio: aspectRatio,
        borderRadius: 12,
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
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={Colors.primary[500]} />
        </View>
      )}
      {totalCount && totalCount > 0 && index !== undefined && (
        <View style={{
          position: 'absolute',
          top: 6,
          left: 6,
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>
            {index + 1}/{totalCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const getHighestPriorityProcess = (
  orderMillInputsData: any[] | undefined,
  itemQuality: any,
  fallback?: string,
  qualitiesList: any[] = []
) => {
  if (!itemQuality) return fallback || 'No process data';

  const isQualityMatch = (q1: any, q2: any) => {
    if (!q1 || !q2) return false;
    const id1 = typeof q1 === 'object' ? q1._id || q1.id : q1;
    const name1 = typeof q1 === 'object' ? q1.name : q1;
    const id2 = typeof q2 === 'object' ? q2._id || q2.id : q2;
    const name2 = typeof q2 === 'object' ? q2.name : q2;

    const id1Str = String(id1 || '').trim().toLowerCase();
    const name1Str = String(name1 || '').trim().toLowerCase();
    const id2Str = String(id2 || '').trim().toLowerCase();
    const name2Str = String(name2 || '').trim().toLowerCase();

    if (id1Str && id2Str && id1Str === id2Str) return true;
    if (name1Str && name2Str && name1Str === name2Str) return true;
    if (id1Str && name2Str && id1Str === name2Str) return true;
    if (name1Str && id2Str && name1Str === id2Str) return true;
    return false;
  };

  const allProcesses: string[] = [];

  if (Array.isArray(orderMillInputsData)) {
    orderMillInputsData.forEach((input: any) => {
      if (!input.quality) return;
      
      // Check main quality
      if (isQualityMatch(itemQuality, input.quality)) {
        if (input.processName && input.processName.trim() !== '') {
          allProcesses.push(input.processName.trim());
        }
      }

      // Check additional meters
      if (input.additionalMeters && Array.isArray(input.additionalMeters)) {
        input.additionalMeters.forEach((additional: any) => {
          if (additional.quality && isQualityMatch(itemQuality, additional.quality)) {
            if (additional.processName && additional.processName.trim() !== '') {
              allProcesses.push(additional.processName.trim());
            }
          }
        });
      }
    });
  }

  if (allProcesses.length > 0) {
    const priorityMap: { [key: string]: number } = {
      'fob send': 1,
      'in house': 2,
      'ready to dispatch': 3,
      'folding': 4,
      'finish': 5,
      'washing': 6,
      'loop': 7,
      'in printing': 8,
      'jigar': 9,
      'in dyeing': 10,
      'setting': 11,
      'long jet': 12,
      'soflina wr': 13,
      'drum': 14,
      'charkha': 15,
      'lot no greigh': 16
    };

    let highestProcess = allProcesses[0];
    let minPriority = 999;

    for (const p of allProcesses) {
      const key = p.toLowerCase().trim();
      const prio = priorityMap[key] !== undefined ? priorityMap[key] : 99;
      if (prio <= minPriority) {
        minPriority = prio;
        highestProcess = p;
      }
    }
    return highestProcess;
  }

  // Check if there are mill inputs for this quality but no process names
  if (Array.isArray(orderMillInputsData)) {
    const hasMillInputsForQuality = orderMillInputsData.some((input: any) => {
      if (!input.quality) return false;
      return isQualityMatch(itemQuality, input.quality);
    });
    if (hasMillInputsForQuality) {
      return fallback && fallback !== 'No process data' ? fallback : 'Processing...';
    }
  }

  return fallback || 'No process data';
};

function SkeletonBox({ width, height, borderRadius = 6, style }: { width?: number | string; height: number; borderRadius?: number; style?: any }) {
  const { theme } = useTheme();
  return <View style={[{ width: width || '100%', height, borderRadius, backgroundColor: theme.skeleton }, style]} />;
}

function SectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <View style={{ paddingTop: 12, gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ gap: 6 }}>
          <SkeletonBox height={14} width="60%" />
          <SkeletonBox height={11} width="85%" />
          <SkeletonBox height={11} width="45%" />
        </View>
      ))}
    </View>
  );
}

function CollapsibleSection({ title, icon, count, children, defaultOpen, isLoading }: { title: string; icon: React.ReactNode; count?: number; children: React.ReactNode; defaultOpen?: boolean; isLoading?: boolean }) {
  const [open, setOpen] = useState(defaultOpen || false);
  const { theme, isDarkMode } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: 12 }}>
      <Card padding={0}>
        <TouchableOpacity onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen(!open); }} activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {icon}
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginLeft: 10 }}>{title}</Text>
            {isLoading ? (
              <View style={{ marginLeft: 8, width: 28, height: 18, borderRadius: 6, backgroundColor: theme.skeleton }} />
            ) : count != null && count > 0 ? (
              <View style={{ backgroundColor: isDarkMode ? Colors.primary[900] : Colors.primary[50], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary[600] }}>{count}</Text>
              </View>
            ) : null}
          </View>
          {open ? <ChevronUp size={18} color={theme.textSecondary} /> : <ChevronDown size={18} color={theme.textSecondary} />}
        </TouchableOpacity>
        {open && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: theme.borderLight }}>
            {isLoading ? <SectionSkeleton rows={2} /> : children}
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, isDarkMode } = useTheme();
  const addToast = useAppStore(s => s.addToast);
  const user = useAppStore(s => s.user);
  const isMaster = user?.role === 'master' || user?.role === 'superadmin' || user?.role === 'admin';
  const isMasterOnly = user?.role === 'master';
  const isParty = user?.role === 'party';
  const queryClient = useQueryClient();

  // Delete Order Mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete(`/api/orders/${order?._id || id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Order Deleted' });
      router.replace('/(tabs)/orders');
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to delete order' });
    }
  });

  const handleDeleteOrder = () => {
    Alert.alert('Delete Order', 'Are you sure you want to delete this entire order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteOrderMutation.mutate() }
    ]);
  };

  const handleEditOrder = () => {
    router.push({ pathname: '/orders/create', params: { id: order?._id || id } } as any);
  };


  const [activeModal, setActiveModal] = useState<'grey' | 'mill-input' | 'mill-output' | 'dispatch' | 'lab' | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);

  const orderQuery = useQuery<Order>({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/orders/${id}`, { params: { t: Date.now() } });
      return data?.data || data?.order || data;
    }
  });

  const order = orderQuery.data;
  const displayOrderId = order?.orderId;

  const greyQuery = useQuery({ queryKey: ['grey-info', displayOrderId], queryFn: async () => { if (!displayOrderId) return []; try { const { data } = await api.get('/api/grey-info', { params: { orderId: displayOrderId } }); return data?.data?.greyInfo || (Array.isArray(data?.data) ? data.data : data?.data || []); } catch { return []; } }, enabled: !!displayOrderId });
  const millInputQuery = useQuery({ queryKey: ['mill-inputs', displayOrderId], queryFn: async () => { if (!displayOrderId) return []; try { const { data } = await api.get('/api/mill-inputs', { params: { orderId: displayOrderId } }); return data?.data?.millInputs || (Array.isArray(data?.data) ? data.data : data?.data || []); } catch { return []; } }, enabled: !!displayOrderId });
  const millOutputQuery = useQuery({ queryKey: ['mill-outputs', displayOrderId], queryFn: async () => { if (!displayOrderId) return []; try { const { data } = await api.get('/api/mill-outputs', { params: { orderId: displayOrderId } }); return data?.data?.millOutputs || (Array.isArray(data?.data) ? data.data : data?.data || []); } catch { return []; } }, enabled: !!displayOrderId });
  const dispatchQuery = useQuery({ queryKey: ['dispatches', displayOrderId], queryFn: async () => { if (!displayOrderId) return []; try { const { data } = await api.get('/api/dispatch', { params: { orderId: displayOrderId } }); return data?.data?.dispatches || (Array.isArray(data?.data) ? data.data : data?.data || []); } catch { return []; } }, enabled: !!displayOrderId });

  const qualitiesQuery = useQuery({
    queryKey: ['qualities'],
    queryFn: async () => {
      const { data } = await api.get('/api/qualities');
      return Array.isArray(data) ? data : data?.data || [];
    }
  });

  const millsQuery = useQuery({
    queryKey: ['mills'],
    queryFn: async () => {
      const { data } = await api.get('/api/mills');
      return Array.isArray(data) ? data : data?.data || [];
    }
  });

  const qualities = Array.isArray(qualitiesQuery.data) ? qualitiesQuery.data : (qualitiesQuery.data as any)?.data || [];
  const mills = Array.isArray(millsQuery.data) ? millsQuery.data : (millsQuery.data as any)?.data || [];

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => { const { data } = await api.patch('/api/orders/status', { orderId: id, status: newStatus }); return data; },
    onSuccess: async () => { await orderQuery.refetch(); queryClient.invalidateQueries({ queryKey: ['orders'] }); addToast({ type: 'success', title: 'Status Updated' }); },
    onError: () => { addToast({ type: 'error', title: 'Failed to update status' }); },
  });

  // Save Grey Information Mutation
  const saveGreyMutation = useMutation({
    mutationFn: async ({ entries, deletedIds }: { entries: any[], deletedIds: string[] }) => {
      // 1. Delete all marked for deletion
      const deletePromises = deletedIds.map(async (itemId) => {
        await api.delete(`/api/grey-info/${itemId}`);
      });
      await Promise.all(deletePromises);

      // 2. Save / update all entries in parallel
      const savePromises = entries.map(async (entry) => {
        const payload: any = {
          orderId: displayOrderId,
          date: entry.date,
          quality: entry.quality,
          quantity: entry.quantity ? parseFloat(entry.quantity) : undefined,
          numberOfPieces: entry.numberOfPieces ? parseInt(entry.numberOfPieces) : undefined,
          chalanNo: entry.chalanNo
        };

        if (entry.id && !entry.id.startsWith('new-')) {
          const { data } = await api.put(`/api/grey-info/${entry.id}`, payload);
          return data;
        } else {
          const { data } = await api.post('/api/grey-info', payload);
          return data;
        }
      });
      
      return Promise.all(savePromises);
    },
    onSuccess: async () => {
      await Promise.all([orderQuery.refetch(), greyQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Grey Info Saved' });
      setActiveModal(null);
      setEditItem(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save grey info';
      addToast({ type: 'error', title: msg });
    }
  });

  // Delete Grey Info
  const deleteGreyMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/api/grey-info/${itemId}`);
    },
    onSuccess: async () => {
      await Promise.all([orderQuery.refetch(), greyQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Grey Info Deleted' });
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to delete grey info' });
    }
  });

  const deleteGreyAllForOrderMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/grey-info`, { params: { orderId: order?.orderId } });
    },
    onSuccess: async () => {
      await Promise.all([orderQuery.refetch(), greyQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'All Grey Info Deleted' });
      setActiveModal(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to delete grey info';
      addToast({ type: 'error', title: msg });
    }
  });

  // Save Mill Input Mutation
  const saveMillInputMutation = useMutation({
    mutationFn: async (payload: { mill: string; millItems: any[] }) => {
      // 1. Delete all existing mill inputs for this order
      await api.delete(`/api/mill-inputs`, { params: { orderId: displayOrderId } });

      // 2. Post all items
      const savePromises = payload.millItems.map((item: any) => {
        const requestBody = {
          orderId: displayOrderId,
          mill: payload.mill,
          millDate: item.millDate,
          chalanNo: item.chalanNo,
          greighMtr: parseFloat(item.greighMtr) || 0,
          pcs: parseInt(item.pcs) || 0,
          quality: item.quality,
          processName: item.processName || '',
          additionalMeters: (item.additionalMeters || []).map((am: any) => ({
            greighMtr: parseFloat(am.greighMtr) || 0,
            pcs: parseInt(am.pcs) || 0,
            quality: am.quality,
            processName: am.processName || ''
          })),
          notes: ''
        };
        return api.post('/api/mill-inputs', requestBody);
      });
      return Promise.all(savePromises);
    },
    onSuccess: async () => {
      await Promise.all([millInputQuery.refetch(), orderQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Mill Input Saved' });
      setActiveModal(null);
      setEditItem(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save mill input';
      addToast({ type: 'error', title: msg });
    }
  });

  // Delete Mill Input
  const deleteMillInputMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/api/mill-inputs/${itemId}`);
    },
    onSuccess: async () => {
      await Promise.all([millInputQuery.refetch(), orderQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Mill Input Deleted' });
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to delete mill input' });
    }
  });

  const deleteMillInputsForOrderMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/mill-inputs`, { params: { orderId: displayOrderId } });
    },
    onSuccess: async () => {
      await Promise.all([millInputQuery.refetch(), orderQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'All Mill Inputs Deleted' });
      setActiveModal(null);
      setEditItem(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to delete mill inputs';
      addToast({ type: 'error', title: msg });
    }
  });

  const saveMillOutputMutation = useMutation({
    mutationFn: async (payload: { millOutputItems: any[] }) => {
      // 1. Delete all existing mill outputs for this order
      await api.delete(`/api/mill-outputs`, { params: { orderId: displayOrderId } });

      // 2. Post all items
      const savePromises: any[] = [];
      payload.millOutputItems.forEach((item: any) => {
        // Main item
        savePromises.push(api.post('/api/mill-outputs', {
          orderId: displayOrderId,
          recdDate: item.recdDate,
          millBillNo: item.millBillNo,
          finishedMtr: parseFloat(item.finishedMtr) || 0,
          quality: item.quality || null
        }));

        // Additional finished meters
        if (item.additionalFinishedMtr && Array.isArray(item.additionalFinishedMtr)) {
          item.additionalFinishedMtr.forEach((add: any) => {
            savePromises.push(api.post('/api/mill-outputs', {
              orderId: displayOrderId,
              recdDate: item.recdDate,
              millBillNo: item.millBillNo,
              finishedMtr: parseFloat(add.meters) || 0,
              quality: add.quality || null
            }));
          });
        }
      });
      return Promise.all(savePromises);
    },
    onSuccess: async () => {
      await Promise.all([orderQuery.refetch(), millOutputQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Mill Outputs Saved' });
      setActiveModal(null);
      setEditItem(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save mill outputs';
      addToast({ type: 'error', title: msg });
    }
  });

  const deleteMillOutputsForOrderMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/mill-outputs`, { params: { orderId: displayOrderId } });
    },
    onSuccess: async () => {
      await Promise.all([orderQuery.refetch(), millOutputQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'All Mill Outputs Deleted' });
      setActiveModal(null);
      setEditItem(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to delete mill outputs';
      addToast({ type: 'error', title: msg });
    }
  });

  // Delete Mill Output
  const deleteMillOutputMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/api/mill-outputs/${itemId}`);
    },
    onSuccess: async () => {
      await Promise.all([orderQuery.refetch(), millOutputQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Mill Output Deleted' });
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to delete mill output' });
    }
  });

  // Save Dispatch Mutation
  const saveDispatchMutation = useMutation({
    mutationFn: async (payload: { dispatchItems: any[] }) => {
      // 1. Delete all existing dispatches for this order
      await api.delete('/api/dispatch', { params: { orderId: displayOrderId } });

      // 2. Build list of dispatches to save
      const dispatchesToSave: any[] = [];
      payload.dispatchItems.forEach((item: any) => {
        const validSubItems = (item.subItems || []).filter((subItem: any) => {
          const hasFinishMtr = subItem.finishMtr && String(subItem.finishMtr).trim() !== '';
          const hasQuality = subItem.quality && String(subItem.quality).trim() !== '';
          return hasFinishMtr && hasQuality;
        });

        validSubItems.forEach((subItem: any) => {
          const finishMtrValue = parseFloat(subItem.finishMtr);
          if (!isNaN(finishMtrValue) && finishMtrValue > 0) {
            dispatchesToSave.push({
              orderId: displayOrderId,
              dispatchDate: item.dispatchDate,
              billNo: String(item.billNo).trim(),
              transportNo: String(item.transportNo || '').trim(),
              lrNo: String(item.lrNo || '').trim(),
              finishMtr: finishMtrValue,
              quality: String(subItem.quality).trim(),
              photos: Array.isArray(subItem.photos) ? subItem.photos.filter((url: any) => typeof url === 'string') : [],
              chindiKg: subItem.chindiKg && String(subItem.chindiKg).trim() !== '' ? Number(subItem.chindiKg) : 0,
              cutPieceMtr: subItem.cutPieceMtr && String(subItem.cutPieceMtr).trim() !== '' ? Number(subItem.cutPieceMtr) : 0,
              rejectedMtr: subItem.rejectedMtr && String(subItem.rejectedMtr).trim() !== '' ? Number(subItem.rejectedMtr) : 0
            });
          }
        });
      });

      // 3. Post sequentially to prevent race conditions
      const results = [];
      for (const dispatch of dispatchesToSave) {
        const { data } = await api.post('/api/dispatch', dispatch);
        results.push(data);
      }
      return results;
    },
    onSuccess: async () => {
      await Promise.all([orderQuery.refetch(), dispatchQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Dispatch Saved' });
      setActiveModal(null);
      setEditItem(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save dispatch';
      addToast({ type: 'error', title: msg });
    }
  });

  // Delete Dispatch
  const deleteDispatchMutation = useMutation({
    mutationFn: async (itemId?: string) => {
      if (itemId) {
        await api.delete(`/api/dispatch/${itemId}`);
      } else {
        await api.delete('/api/dispatch', { params: { orderId: displayOrderId } });
      }
    },
    onSuccess: async () => {
      await Promise.all([orderQuery.refetch(), dispatchQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Dispatch(es) Deleted' });
      setActiveModal(null);
      setEditItem(null);
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to delete dispatch(es)' });
    }
  });

  // Save Lab Data Mutation
  const saveLabMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post(`/api/labs/${order?._id}/${selectedItemId}`, payload);
      return data;
    },
    onSuccess: async () => {
      await orderQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Lab Data Saved' });
      setActiveModal(null);
      setEditItem(null);
      setSelectedItemId(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save lab data';
      addToast({ type: 'error', title: msg });
    }
  });

  // Delete Lab Data Mutation
  const deleteLabMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/api/labs/${order?._id}/${itemId}`);
    },
    onSuccess: async () => {
      await orderQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      addToast({ type: 'success', title: 'Lab Data Deleted' });
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to delete lab data' });
    }
  });

  const formatDateForInput = (dateStr: any) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleStatusChange = useCallback(() => {
    const statuses = ['pending', 'in_progress', 'completed', 'delivered', 'cancelled'];
    Alert.alert('Update Status', 'Select new status', statuses.map((s: string) => ({ text: s.replace('_', ' ').toUpperCase(), onPress: () => statusMutation.mutate(s) })).concat([{ text: 'Cancel', onPress: () => {}, style: 'cancel' } as any]));
  }, []);

  const handleRefresh = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    orderQuery.refetch(); greyQuery.refetch(); millInputQuery.refetch(); millOutputQuery.refetch(); dispatchQuery.refetch();
  }, []);

  // Form Openers
  const handleAddGrey = () => {
    greyQuery.refetch();
    setActiveModal('grey');
    setEditItem(null);
  };

  const handleEditGrey = (item: any) => {
    greyQuery.refetch();
    setActiveModal('grey');
    setEditItem(item);
  };

  const handleDeleteGrey = (itemId: string) => {
    Alert.alert('Delete Grey Info', 'Are you sure you want to delete this grey information entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteGreyMutation.mutate(itemId) }
    ]);
  };

  const handleAddMillInput = () => {
    millInputQuery.refetch();
    setActiveModal('mill-input');
    setEditItem(null);
    setFormData({
      millDate: new Date().toISOString().split('T')[0],
      mill: mills[0]?._id || '',
      quality: qualities[0]?._id || '',
      greighMtr: '',
      pcs: '',
      chalanNo: '',
      processName: 'Lot No Greigh'
    });
  };

  const handleEditMillInput = (item: any) => {
    millInputQuery.refetch();
    setActiveModal('mill-input');
    setEditItem(item);
    setFormData({
      id: item._id,
      millDate: formatDateForInput(item.millDate),
      mill: typeof item.mill === 'object' ? item.mill?._id : item.mill || '',
      quality: typeof item.quality === 'object' ? item.quality?._id : item.quality || '',
      greighMtr: item.greighMtr ? String(item.greighMtr) : '',
      pcs: item.pcs ? String(item.pcs) : '',
      chalanNo: item.chalanNo || '',
      processName: item.processName || 'Lot No Greigh'
    });
  };

  const handleDeleteMillInput = (itemId: string) => {
    Alert.alert('Delete Mill Input', 'Are you sure you want to delete this mill input entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMillInputMutation.mutate(itemId) }
    ]);
  };

  const handleAddMillOutput = () => {
    millOutputQuery.refetch();
    setActiveModal('mill-output');
    setEditItem(null);
    setFormData({
      recdDate: new Date().toISOString().split('T')[0],
      quality: qualities[0]?._id || '',
      finishedMtr: '',
      millRate: '',
      millBillNo: ''
    });
  };

  const handleEditMillOutput = (item: any) => {
    millOutputQuery.refetch();
    setActiveModal('mill-output');
    setEditItem(item);
    setFormData({
      id: item._id,
      recdDate: formatDateForInput(item.recdDate),
      quality: typeof item.quality === 'object' ? item.quality?._id : item.quality || '',
      finishedMtr: item.finishedMtr ? String(item.finishedMtr) : '',
      millRate: item.millRate ? String(item.millRate) : '',
      millBillNo: item.millBillNo || ''
    });
  };

  const handleDeleteMillOutput = (itemId: string) => {
    Alert.alert('Delete Mill Output', 'Are you sure you want to delete this mill output entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMillOutputMutation.mutate(itemId) }
    ]);
  };

  const handleAddDispatch = () => {
    dispatchQuery.refetch();
    setActiveModal('dispatch');
    setEditItem(null);
    setFormData({
      dispatchDate: new Date().toISOString().split('T')[0],
      quality: qualities[0]?._id || '',
      finishMtr: '',
      saleRate: '',
      billNo: '',
      transportNo: '',
      lrNo: ''
    });
  };

  const handleEditDispatch = (item: any) => {
    dispatchQuery.refetch();
    setActiveModal('dispatch');
    setEditItem(item);
    setFormData({
      id: item._id,
      dispatchDate: formatDateForInput(item.dispatchDate),
      quality: typeof item.quality === 'object' ? item.quality?._id : item.quality || '',
      finishMtr: item.finishMtr ? String(item.finishMtr) : '',
      saleRate: item.saleRate ? String(item.saleRate) : '',
      billNo: item.billNo || '',
      transportNo: item.transportNo || '',
      lrNo: item.lrNo || ''
    });
  };

  const handleDeleteDispatch = (itemId: string) => {
    Alert.alert('Delete Dispatch', 'Are you sure you want to delete this dispatch entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDispatchMutation.mutate(itemId) }
    ]);
  };

  const handleAddLab = (item: any) => {
    orderQuery.refetch();
    setSelectedItemId(item._id);
    setActiveModal('lab');
    setEditItem(null);
    setFormData({
      labSendDate: new Date().toISOString().split('T')[0],
      approvalDate: '',
      sampleNumber: ''
    });
  };

  const handleEditLab = (item: any) => {
    orderQuery.refetch();
    setSelectedItemId(item._id);
    setActiveModal('lab');
    setEditItem(item.labData);
    setFormData({
      labSendDate: formatDateForInput(item.labData.labSendDate),
      approvalDate: formatDateForInput(item.labData.approvalDate),
      sampleNumber: item.labData.sampleNumber || ''
    });
  };

  const handleDeleteLab = (itemId: string) => {
    Alert.alert('Delete Lab Data', 'Are you sure you want to delete this lab data entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteLabMutation.mutate(itemId) }
    ]);
  };

  if (orderQuery.isLoading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Order Detail" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Order Header Card Skeleton */}
        <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.borderLight }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <SkeletonBox height={24} width={80} borderRadius={8} />
            <SkeletonBox height={24} width={70} borderRadius={8} />
          </View>
          <SkeletonBox height={18} width="60%" style={{ marginBottom: 12 }} />
          <SkeletonBox height={13} width="40%" style={{ marginBottom: 16 }} />
          
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Calendar size={12} color={theme.textSecondary} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Arrival</Text>
              </View>
              <SkeletonBox height={12} width={60} />
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Calendar size={12} color={theme.textSecondary} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>PO Date</Text>
              </View>
              <SkeletonBox height={12} width={60} />
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Calendar size={12} color={theme.textSecondary} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Delivery</Text>
              </View>
              <SkeletonBox height={12} width={60} />
            </View>
          </View>
        </View>

        {/* Expanded Items & Lab Data Section Skeleton */}
        <View style={{ marginBottom: 12 }}>
          <Card padding={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Package size={18} color={theme.textSecondary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginLeft: 10 }}>Items & Lab Data</Text>
                <View style={{ backgroundColor: theme.borderLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 8 }}>
                  <SkeletonBox height={10} width={15} />
                </View>
              </View>
              <ChevronUp size={18} color={theme.textSecondary} />
            </View>
            
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: theme.borderLight, paddingTop: 12 }}>
              {/* Item Card Skeleton 1 */}
              <View style={{ backgroundColor: theme.surface, padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.borderLight }}>
                <SkeletonBox height={16} width="60%" style={{ marginBottom: 8 }} />
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                  <SkeletonBox height={18} width={50} borderRadius={6} />
                  <SkeletonBox height={18} width={80} borderRadius={6} />
                </View>
                {/* Image Horizontal Scroll representation (Big images matching layout) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10 }}
                  style={{ marginVertical: 8 }}
                >
                  <SkeletonBox width={200} height={150} borderRadius={12} />
                  <SkeletonBox width={150} height={150} borderRadius={12} />
                </ScrollView>
                {/* Lab Data block skeleton */}
                <View style={{ marginTop: 10, backgroundColor: theme.card, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, gap: 6 }}>
                  <SkeletonBox height={10} width={60} />
                  <SkeletonBox height={12} width="80%" />
                  <SkeletonBox height={12} width="50%" />
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Collapsed Sections Skeletons */}
        {[
          { title: 'Grey Information', icon: <FileText size={18} color={theme.textSecondary} /> },
          { title: 'Mill Inputs', icon: <FileInput size={18} color={theme.textSecondary} /> },
          { title: 'Mill Outputs', icon: <FileOutput size={18} color={theme.textSecondary} /> },
          { title: 'Dispatches', icon: <Truck size={18} color={theme.textSecondary} /> }
        ].map(s => (
          <View key={s.title} style={{ marginBottom: 12 }}>
            <Card padding={0}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  {s.icon}
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginLeft: 10 }}>{s.title}</Text>
                </View>
                <ChevronDown size={18} color={theme.textSecondary} />
              </View>
            </Card>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );

  if (!order) return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}><Header title="Order" showBack /><EmptyState title="Order Not Found" subtitle="This order may have been deleted" /></SafeAreaView>;

  const partyName = typeof order.party === 'object' ? (order.party as any)?.name : order.party || 'Unknown';
  const greyInfo = (greyQuery.data && greyQuery.data.length > 0) ? greyQuery.data : (order.greyInformation || []);
  const millInputs = (millInputQuery.data && millInputQuery.data.length > 0) ? millInputQuery.data : (order.millInputs || []);
  const millOutputs = (millOutputQuery.data && millOutputQuery.data.length > 0) ? millOutputQuery.data : (order.millOutputs || []);
  const dispatches = (dispatchQuery.data && dispatchQuery.data.length > 0) ? dispatchQuery.data : (order.dispatches || []);

  const isSaving = saveGreyMutation.isPending || saveMillInputMutation.isPending || saveMillOutputMutation.isPending || saveDispatchMutation.isPending || saveLabMutation.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title={order.orderId ? getDisplayOrderId(order.orderId) : 'Order Detail'} showBack rightAction={
        !isParty && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={handleEditOrder}
              style={{
                backgroundColor: isDarkMode ? 'rgba(217,119,6,0.12)' : '#fef3c7',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(217,119,6,0.2)' : '#fde68a',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Edit size={13} color={Colors.warning[600]} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.warning[600] }}>Edit</Text>
            </TouchableOpacity>

            {isMasterOnly && (
              <TouchableOpacity
                onPress={handleDeleteOrder}
                style={{
                  backgroundColor: isDarkMode ? 'rgba(220,38,38,0.12)' : '#fee2e2',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(220,38,38,0.2)' : '#fca5a5',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Trash2 size={13} color={Colors.error[600]} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.error[600] }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      } />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl
              refreshing={orderQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={Colors.primary[500]}
              colors={[Colors.primary[500]]}
            />
          ) : undefined
        }>

        {/* Order Header Card */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <OrderTypeBadge type={order.orderType} size="md" />
              </View>
              {isParty ? (
                <View>
                  <StatusBadge status={order.status || 'Not set'} size="md" />
                </View>
              ) : (
                <TouchableOpacity onPress={handleStatusChange} activeOpacity={0.7}>
                  <StatusBadge status={order.status || 'Not set'} size="md" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 8 }}>{partyName}</Text>
            {!!order.contactPhone && <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 2 }}>📞 {order.contactPhone}</Text>}
            <View style={{ borderTopWidth: 1, borderTopColor: theme.borderLight, marginTop: 10, paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                {!!order.poNumber && (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>PO Number</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{getDisplayOrderId(order.poNumber)}</Text>
                  </View>
                )}
                {!!order.priority && (
                  <View style={{ flex: 1, paddingLeft: 10, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Priority</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{order.priority}</Text>
                  </View>
                )}
              </View>

              {/* Style Number (Full Width wrapping support) */}
              {!!order.styleNo && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 2 }}>Style Number</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, flexWrap: 'wrap' }}>{order.styleNo}</Text>
                </View>
              )}

              {/* Dates Grid matching Orders list page */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <View style={{ flex: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Calendar size={12} color={theme.textSecondary} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Arrival</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>{formatDate(order.arrivalDate) || '—'}</Text>
                </View>

                <View style={{ flex: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Calendar size={12} color={Colors.primary[500]} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>PO Date</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>{formatDate(order.poDate) || '—'}</Text>
                </View>

                <View style={{ flex: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Calendar size={12} color={Colors.primary[600]} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Delivery</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: Colors.primary[600] }}>{formatDate(order.deliveryDate) || '—'}</Text>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Order Items */}
        <CollapsibleSection title="Items & Lab Data" icon={<Package size={18} color={Colors.primary[600]} />} count={order.items?.length || 0} defaultOpen>
          {order.items?.length ? order.items.map((item, i) => {
            const qualityName = typeof item.quality === 'object' ? (item.quality as any)?.name : item.quality || 'N/A';
            const allImages = [...(item.imageUrls || []), ...((item as any).images || [])]
              .map((u: any) => getFullImageUrl(u))
              .filter(Boolean) as string[];

            return (
              <View key={i} style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.borderLight }}>
                
                {/* Upper row: full width details */}
                <View style={{ gap: 4, width: '100%' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }} numberOfLines={1} ellipsizeMode="tail">{qualityName}</Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>Qty: <Text style={{ fontWeight: '700', color: theme.text }}>{item.quantity || '—'}</Text></Text>
                    {item.weaverSupplierName ? (
                      <>
                        <View style={{ width: 1, height: 10, backgroundColor: theme.borderLight }} />
                        <Text style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1} ellipsizeMode="tail">Weaver: <Text style={{ fontWeight: '700', color: theme.text }}>{item.weaverSupplierName}</Text></Text>
                      </>
                    ) : null}
                    <View style={{ width: 1, height: 10, backgroundColor: theme.borderLight }} />
                    {(() => {
                      const pName = getHighestPriorityProcess(millInputs, item.quality, (item as any).processName || item.processData?.mainProcess || 'No process data', qualities);
                      const badgeStyles = getProcessBadgeStyles(pName, isDarkMode);
                      return (
                        <View style={{ backgroundColor: badgeStyles.backgroundColor, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: badgeStyles.borderColor }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: badgeStyles.textColor }} numberOfLines={1}>
                            {pName}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>

                  {/* Rates badges */}
                  {(item.purchaseRate || item.millRate || item.salesRate) ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                      {item.purchaseRate ? (
                        <View style={{ backgroundColor: isDarkMode ? 'rgba(34,197,94,0.1)' : '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: isDarkMode ? 'rgba(34,197,94,0.2)' : '#bbf7d0' }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#4ade80' : '#15803d' }}>P: {formatCurrency(item.purchaseRate)}</Text>
                        </View>
                      ) : null}
                      {item.millRate ? (
                        <View style={{ backgroundColor: isDarkMode ? 'rgba(139,92,246,0.1)' : '#f5f3ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: isDarkMode ? 'rgba(139,92,246,0.2)' : '#ddd6fe' }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#a78bfa' : '#6d28d9' }}>M: {formatCurrency(item.millRate)}</Text>
                        </View>
                      ) : null}
                      {item.salesRate ? (
                        <View style={{ backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: isDarkMode ? 'rgba(59,130,246,0.2)' : '#bfdbfe' }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#60a5fa' : '#1d4ed8' }}>S: {formatCurrency(item.salesRate)}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {item.description ? (
                  <View style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f1f5f9', padding: 8, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: theme.borderLight }}>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, fontStyle: 'italic' }}>Desc: {item.description}</Text>
                  </View>
                ) : null}

                {/* Horizontal Scroll of Enlarged Images */}
                {allImages.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingHorizontal: 2 }}
                    style={{ marginTop: 8 }}
                  >
                    {allImages.map((imageUrl, imgIdx) => (
                      <AutoRatioImage
                        key={imgIdx}
                        uri={imageUrl}
                        height={150}
                        borderColor={theme.borderLight}
                        onPress={() => {
                          setPreviewImages(allImages);
                          setPreviewImageIndex(imgIdx);
                        }}
                        index={imgIdx}
                        totalCount={allImages.length}
                      />
                    ))}
                  </ScrollView>
                )}

                {/* Lab Data management block */}
                {item.labData && item.labData.labSendDate ? (
                  <View style={{ marginTop: 10, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[50], padding: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: theme.textSecondary, letterSpacing: 0.5 }}>LAB DATA</Text>
                      {!isParty && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={() => handleEditLab(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 4, backgroundColor: isDarkMode ? Colors.neutral[700] : Colors.neutral[200] }}>
                            <Edit size={10} color={theme.text} />
                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.text }}>Edit</Text>
                          </TouchableOpacity>
                          {isMaster && (
                            <TouchableOpacity onPress={() => handleDeleteLab(item._id || '')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 4, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                              <Trash2 size={10} color={Colors.error[600]} />
                              <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.error[600] }}>Delete</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={{ gap: 2 }}>
                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>Sent: <Text style={{ fontWeight: '600', color: theme.text }}>{formatDate(item.labData.labSendDate)}</Text></Text>
                      {item.labData.sampleNumber ? <Text style={{ fontSize: 12, color: theme.textSecondary }}>Sample No: <Text style={{ fontWeight: '600', color: theme.text }}>{item.labData.sampleNumber}</Text></Text> : null}
                      {item.labData.approvalDate ? <Text style={{ fontSize: 12, color: theme.textSecondary }}>Approved: <Text style={{ fontWeight: '600', color: theme.text }}>{formatDate(item.labData.approvalDate)}</Text></Text> : null}
                      {item.labData.status ? <StatusBadge status={item.labData.status} style={{ marginTop: 4, alignSelf: 'flex-start' }} /> : null}
                    </View>
                  </View>
                ) : !isParty ? (
                  <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'flex-start' }}>
                    <TouchableOpacity onPress={() => handleAddLab(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDarkMode ? 'rgba(147, 51, 234, 0.2)' : '#f3e8ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? 'rgba(147, 51, 234, 0.3)' : '#e9d5ff' }}>
                      <Beaker size={12} color={isDarkMode ? '#c084fc' : '#9333ea'} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#c084fc' : '#9333ea' }}>Add Lab Data</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          }) : <Text style={{ fontSize: 13, color: theme.textSecondary, paddingTop: 8 }}>No items</Text>}
        </CollapsibleSection>

        {/* Grey Information */}
        <CollapsibleSection title="Grey Information" icon={<FileText size={18} color={Colors.neutral[500]} />} count={greyInfo.length} isLoading={greyQuery.isLoading}>
          {!isParty && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, marginTop: 4 }}>
              <TouchableOpacity onPress={handleAddGrey} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100], paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? Colors.neutral[700] : Colors.neutral[300] }}>
                <Plus size={14} color={isDarkMode ? Colors.neutral[300] : Colors.neutral[600]} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? Colors.neutral[300] : Colors.neutral[600] }}>Add Grey Info</Text>
              </TouchableOpacity>
            </View>
          )}
          {greyInfo.length ? greyInfo.map((g: any, i: number) => (
            <View key={g._id || i} style={{ paddingVertical: 12, borderBottomWidth: i < greyInfo.length - 1 ? 1 : 0, borderBottomColor: theme.borderLight, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: 8, gap: 3 }}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {!!g.quality && <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{typeof g.quality === 'object' ? g.quality?.name : g.quality}</Text>}
                  {!!g.chalanNo && <View style={{ backgroundColor: isDarkMode ? 'rgba(99,102,241,0.15)' : '#eef2ff', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}><Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? '#818cf8' : '#4f46e5' }}>Chalan #{g.chalanNo}</Text></View>}
                </View>
                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                  {!!g.quantity && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Qty: <Text style={{ fontWeight: '600', color: theme.text }}>{g.quantity}</Text></Text>}
                  {!!g.numberOfPieces && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Pcs: <Text style={{ fontWeight: '600', color: theme.text }}>{g.numberOfPieces}</Text></Text>}
                  {!!g.date && <Text style={{ fontSize: 12, color: theme.textSecondary }}>{formatDate(g.date)}</Text>}
                </View>
              </View>
              {!isParty && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => handleEditGrey(g)} style={{ padding: 6, borderRadius: 6, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100] }}>
                    <Edit size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {isMaster && (
                    <TouchableOpacity onPress={() => handleDeleteGrey(g._id)} style={{ padding: 6, borderRadius: 6, backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }}>
                      <Trash2 size={14} color={Colors.error[600]} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )) : <Text style={{ fontSize: 13, color: theme.textSecondary, paddingTop: 8 }}>No grey information</Text>}
        </CollapsibleSection>

        {/* Mill Inputs */}
        <CollapsibleSection title="Mill Inputs" icon={<FileInput size={18} color={Colors.primary[600]} />} count={millInputs.length} isLoading={millInputQuery.isLoading}>
          {!isParty && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, marginTop: 4 }}>
              <TouchableOpacity onPress={handleAddMillInput} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.2)' : Colors.primary[50], paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? 'rgba(37, 99, 235, 0.3)' : Colors.primary[200] }}>
                <Plus size={14} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>Add Mill Input</Text>
              </TouchableOpacity>
            </View>
          )}
          {millInputs.length ? millInputs.map((m: any, i: number) => (
            <View key={m._id || i} style={{ paddingVertical: 12, borderBottomWidth: i < millInputs.length - 1 ? 1 : 0, borderBottomColor: theme.borderLight }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8, gap: 3 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{typeof m.mill === 'object' ? m.mill?.name : m.mill || 'N/A'}</Text>
                    {!!m.processName && <View style={{ backgroundColor: isDarkMode ? 'rgba(37,99,235,0.15)' : Colors.primary[50], paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}><Text style={{ fontSize: 11, fontWeight: '600', color: Colors.primary[600] }}>{m.processName}</Text></View>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    {!!m.quality && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Quality: <Text style={{ fontWeight: '600', color: theme.text }}>{typeof m.quality === 'object' ? m.quality?.name : m.quality}</Text></Text>}
                    {!!m.greighMtr && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Mtr: <Text style={{ fontWeight: '600', color: theme.text }}>{m.greighMtr}</Text></Text>}
                    {!!m.pcs && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Pcs: <Text style={{ fontWeight: '600', color: theme.text }}>{m.pcs}</Text></Text>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    {!!m.chalanNo && <Text style={{ fontSize: 11, color: theme.textSecondary }}>Chalan: {m.chalanNo}</Text>}
                    {!!m.millDate && <Text style={{ fontSize: 11, color: theme.textSecondary }}>{formatDate(m.millDate)}</Text>}
                  </View>
                  {m.additionalMeters?.length > 0 && (
                    <View style={{ marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: Colors.primary[200], gap: 2 }}>
                      {m.additionalMeters.map((am: any, ai: number) => (
                        <Text key={ai} style={{ fontSize: 11, color: theme.textSecondary }}>{typeof am.quality === 'object' ? am.quality?.name : am.quality}: {am.greighMtr} mtr, {am.pcs} pcs{am.processName ? ` · ${am.processName}` : ''}</Text>
                      ))}
                    </View>
                  )}
                </View>
              {!isParty && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => handleEditMillInput(m)} style={{ padding: 6, borderRadius: 6, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100] }}>
                    <Edit size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {isMaster && (
                    <TouchableOpacity onPress={() => handleDeleteMillInput(m._id)} style={{ padding: 6, borderRadius: 6, backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }}>
                      <Trash2 size={14} color={Colors.error[600]} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              </View>
            </View>
          )) : <Text style={{ fontSize: 13, color: theme.textSecondary, paddingTop: 8 }}>No mill inputs</Text>}
        </CollapsibleSection>

        {/* Mill Outputs */}
        <CollapsibleSection title="Mill Outputs" icon={<FileOutput size={18} color={'#0d9488'} />} count={millOutputs.length} isLoading={millOutputQuery.isLoading}>
          {!isParty && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, marginTop: 4 }}>
              <TouchableOpacity onPress={handleAddMillOutput} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDarkMode ? 'rgba(13, 148, 136, 0.2)' : '#ccfbf1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? 'rgba(13, 148, 136, 0.3)' : '#99f6e4' }}>
                <Plus size={14} color={isDarkMode ? '#2dd4bf' : '#0d9488'} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#2dd4bf' : '#0d9488' }}>Add Mill Output</Text>
              </TouchableOpacity>
            </View>
          )}
          {millOutputs.length ? millOutputs.map((m: any, i: number) => (
            <View key={m._id || i} style={{ paddingVertical: 12, borderBottomWidth: i < millOutputs.length - 1 ? 1 : 0, borderBottomColor: theme.borderLight }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8, gap: 3 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {!!m.quality && <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{typeof m.quality === 'object' ? m.quality?.name : m.quality}</Text>}
                    {!!m.millBillNo && <View style={{ backgroundColor: isDarkMode ? 'rgba(13,148,136,0.15)' : '#ccfbf1', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}><Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? '#2dd4bf' : '#0d9488' }}>Bill #{m.millBillNo}</Text></View>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    {!!m.finishedMtr && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Finished: <Text style={{ fontWeight: '600', color: theme.text }}>{m.finishedMtr} mtr</Text></Text>}
                    {!!m.millRate && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Rate: <Text style={{ fontWeight: '600', color: theme.text }}>{formatCurrency(m.millRate)}</Text></Text>}
                    {!!m.recdDate && <Text style={{ fontSize: 11, color: theme.textSecondary }}>{formatDate(m.recdDate)}</Text>}
                  </View>
                </View>
              {!isParty && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => handleEditMillOutput(m)} style={{ padding: 6, borderRadius: 6, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100] }}>
                    <Edit size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {isMaster && (
                    <TouchableOpacity onPress={() => handleDeleteMillOutput(m._id)} style={{ padding: 6, borderRadius: 6, backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }}>
                      <Trash2 size={14} color={Colors.error[600]} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              </View>
            </View>
          )) : <Text style={{ fontSize: 13, color: theme.textSecondary, paddingTop: 8 }}>No mill outputs</Text>}
        </CollapsibleSection>

        {/* Dispatches */}
        <CollapsibleSection title="Dispatches" icon={<Truck size={18} color={'#ea580c'} />} count={dispatches.length} isLoading={dispatchQuery.isLoading}>
          {!isParty && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, marginTop: 4 }}>
              <TouchableOpacity onPress={handleAddDispatch} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDarkMode ? 'rgba(234, 88, 12, 0.2)' : '#ffedd5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? 'rgba(234, 88, 12, 0.3)' : '#fed7aa' }}>
                <Plus size={14} color={isDarkMode ? '#fb923c' : '#ea580c'} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#fb923c' : '#ea580c' }}>Add Dispatch</Text>
              </TouchableOpacity>
            </View>
          )}
          {dispatches.length ? dispatches.map((d: any, i: number) => (
            <View key={d._id || i} style={{ paddingVertical: 12, borderBottomWidth: i < dispatches.length - 1 ? 1 : 0, borderBottomColor: theme.borderLight }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8, gap: 3 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {!!d.quality && <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{typeof d.quality === 'object' ? d.quality?.name : d.quality}</Text>}
                    {!!d.billNo && <View style={{ backgroundColor: isDarkMode ? 'rgba(234,88,12,0.15)' : '#ffedd5', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 }}><Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? '#fb923c' : '#ea580c' }}>Bill #{d.billNo}</Text></View>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    {!!d.finishMtr && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Qty: <Text style={{ fontWeight: '600', color: theme.text }}>{d.finishMtr} m</Text></Text>}
                    {!!d.saleRate && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Rate: <Text style={{ fontWeight: '600', color: theme.text }}>{formatCurrency(d.saleRate)}</Text></Text>}
                    {!!d.dispatchDate && <Text style={{ fontSize: 11, color: theme.textSecondary }}>{formatDate(d.dispatchDate)}</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    {!!d.transportNo && <Text style={{ fontSize: 11, color: theme.textSecondary }}>Transport: {d.transportNo}</Text>}
                    {!!d.lrNo && <Text style={{ fontSize: 11, color: theme.textSecondary }}>LR: {d.lrNo}</Text>}
                  </View>
                </View>
              {!isParty && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => handleEditDispatch(d)} style={{ padding: 6, borderRadius: 6, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100] }}>
                    <Edit size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {isMaster && (
                    <TouchableOpacity onPress={() => handleDeleteDispatch(d._id)} style={{ padding: 6, borderRadius: 6, backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }}>
                      <Trash2 size={14} color={Colors.error[600]} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              </View>
            </View>
          )) : <Text style={{ fontSize: 13, color: theme.textSecondary, paddingTop: 8 }}>No dispatches</Text>}
        </CollapsibleSection>
      </ScrollView>

      {/* Separated Modals */}
      <GreyInformationModal
        visible={activeModal === 'grey'}
        onClose={() => { setActiveModal(null); setEditItem(null); }}
        order={order}
        greyInfo={greyInfo}
        qualities={qualities}
        isDarkMode={isDarkMode}
        theme={theme}
        onSave={(entries, deletedIds) => saveGreyMutation.mutate({ entries, deletedIds })}
        isSaving={saveGreyMutation.isPending}
        isLoading={greyQuery.isFetching && (!greyInfo || greyInfo.length === 0)}
        isMaster={isMaster}
        onDelete={greyInfo && greyInfo.length > 0 ? () => deleteGreyAllForOrderMutation.mutate() : undefined}
      />

      <MillInputModal
        visible={activeModal === 'mill-input'}
        onClose={() => { setActiveModal(null); setEditItem(null); }}
        order={order}
        existingMillInputs={millInputs}
        mills={mills}
        qualities={qualities}
        isDarkMode={isDarkMode}
        theme={theme}
        onSave={(payload) => {
          saveMillInputMutation.mutate(payload);
        }}
        isSaving={saveMillInputMutation.isPending}
        isLoading={millInputQuery.isFetching && (!millInputs || millInputs.length === 0)}
        onDelete={millInputs && millInputs.length > 0 ? () => deleteMillInputsForOrderMutation.mutate() : undefined}
        isMaster={isMaster}
      />

      <MillOutputModal
        visible={activeModal === 'mill-output'}
        onClose={() => { setActiveModal(null); setEditItem(null); }}
        order={order}
        existingMillOutputs={millOutputs}
        qualities={qualities}
        isDarkMode={isDarkMode}
        theme={theme}
        onSave={(payload) => {
          saveMillOutputMutation.mutate(payload);
        }}
        isSaving={saveMillOutputMutation.isPending}
        onDelete={millOutputs && millOutputs.length > 0 ? () => deleteMillOutputsForOrderMutation.mutate() : undefined}
        isLoading={millOutputQuery.isFetching && (!millOutputs || millOutputs.length === 0)}
        isMaster={isMaster}
      />

      <DispatchModal
        visible={activeModal === 'dispatch'}
        onClose={() => { setActiveModal(null); setEditItem(null); }}
        order={order}
        existingDispatches={dispatches}
        qualities={qualities}
        isDarkMode={isDarkMode}
        theme={theme}
        onSave={(payload) => {
          saveDispatchMutation.mutate(payload);
        }}
        isSaving={saveDispatchMutation.isPending}
        isLoading={dispatchQuery.isFetching && (!dispatches || dispatches.length === 0)}
        onDelete={dispatches && dispatches.length > 0 ? () => deleteDispatchMutation.mutate(undefined) : undefined}
        isMaster={isMaster}
      />

      <LabDataModal
        visible={activeModal === 'lab'}
        onClose={() => { setActiveModal(null); setEditItem(null); }}
        order={order}
        editItem={editItem}
        isDarkMode={isDarkMode}
        theme={theme}
        onSave={(formData) => {
          if (!formData.labSendDate) {
            addToast({ type: 'error', title: 'Lab send date is required' });
            return;
          }
          saveLabMutation.mutate(formData);
        }}
        isSaving={saveLabMutation.isPending}
        isLoading={orderQuery.isFetching && (!order?.items || order.items.length === 0)}
        isMaster={isMaster}
        onDelete={editItem && isMaster ? () => deleteLabMutation.mutate(selectedItemId!) : undefined}
      />

      <ImagePreviewModal
        visible={previewImages.length > 0}
        images={previewImages}
        initialIndex={previewImageIndex}
        onClose={() => setPreviewImages([])}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 13, color: theme.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{value}</Text>
    </View>
  );
}
