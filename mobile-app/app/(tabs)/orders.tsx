import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  PanResponder,
  Animated as RNAnimated,
  Dimensions,
  KeyboardAvoidingView,
  Share,
  Linking,
  Keyboard,
  TouchableWithoutFeedback,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import * as FileSystem from 'expo-file-system/legacy';
let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (e) {
  // Safe fallback for builds missing native sharing modules
}


import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate } from 'react-native-reanimated';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Plus,
  FilePlus,
  ShoppingBag,
  ClipboardList,
  SlidersHorizontal,
  MoreVertical,
  Edit2,
  Trash2,
  Play,
  Check,
  Truck,
  Eye,
  X,
  RotateCcw,
  History,
  Beaker,
  FileInput,
  FileOutput,
  FileText,
  Clock,
  Search,
  Download,
  Share2,
  User,
  Phone,
  Package,
  RefreshCw,
  WifiOff,
  Zap,
  PlusCircle,
  Tag,
  Layers,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import api from '../../services/api';
import { storage } from '../../utils/storage';
import Card from '../../components/ui/Card';
import StatusBadge, { OrderTypeBadge } from '../../components/shared/StatusBadge';
import { SkeletonList, SkeletonCard, OrderSkeletonList, PulsingContainer, Skeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import DatePickerModal from '../../components/shared/DatePickerModal';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { formatDate, formatDateTime, formatShortDateTime, getDisplayOrderId, getProcessBadgeStyles, resolveImageUrl } from '../../utils/helpers';
import { Order } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { CONFIG } from '../../constants/config';
import ImagePreviewModal from '../../components/shared/ImagePreviewModal';
import GreyInformationModal from '../../components/orders/GreyInformationModal';
import MillInputModal from '../../components/orders/MillInputModal';
import MillOutputModal from '../../components/orders/MillOutputModal';
import DispatchModal from '../../components/orders/DispatchModal';
import LabDataModal from '../../components/orders/LabDataModal';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';
import PdfViewer from '../../components/orders/PdfViewer';
import PdfViewerModal from '../../components/shared/PdfViewerModal';
import { savePdfToDevice, generatePdfFromHtml } from '../../utils/pdfUtils';
import { generateOrderHtml } from '../../utils/orderPdfTemplate';
import * as Print from 'expo-print';

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
  const [imageLoaded, setImageLoaded] = useState(false);
  const aspectRatio = 1.33; // Clean, uniform 4:3 ratio for perfect grid alignment
  const isImageVisible = imageLoaded;

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
        contentFit="cover"
        onLoadEnd={() => setImageLoaded(true)}
        transition={100}
      />
      {!imageLoaded && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <PulsingContainer style={{ width: '100%', height: '100%' }}>
            <Skeleton width="100%" height="100%" borderRadius={12} style={{ backgroundColor: isDarkMode ? '#334155' : '#cbd5e1' }} />
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



const OrdersProgressBar = () => {
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

const statusFilters = [
  'All',
  'pending',
  'delivered',
];
const typeFilters = ['All', 'Dying', 'Printing'];

const searchTypeLabels: Record<string, string> = {
  all: 'All',
  orderId: 'ID',
  poNumber: 'PO',
  styleNo: 'Style',
  party: 'Party',
  quality: 'Quality',
  mill: 'Mill',
  weaver: 'Weaver',
  phone: 'Phone',
};

const searchTypeFullLabels: Record<string, string> = {
  all: 'All Fields',
  orderId: 'Order ID',
  poNumber: 'PO No',
  styleNo: 'Style No',
  party: 'Party',
  quality: 'Quality',
  mill: 'Mill',
  weaver: 'Weaver',
  phone: 'Phone',
};

const searchTypePlaceholders: Record<string, string> = {
  all: 'Search all fields...',
  orderId: 'Search by Order ID...',
  poNumber: 'Search by PO No...',
  styleNo: 'Search by Style No...',
  party: 'Search by Party Name...',
  quality: 'Search by Quality Name...',
  mill: 'Search by Mill Name...',
  weaver: 'Search by Weaver/Supplier...',
  phone: 'Search by Phone number...',
};

// ─── Filter Pill ───
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
        {label.replace('_', ' ')}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Order Card Item ───
const OrderCard = React.memo(function OrderCard({
  item,
  index,
  onDeleteOrder,
  onStatusChange,
  onGreyPill,
  onLabPill,
  onMillInputPill,
  onMillOutputPill,
  onDispatchPill,
  onViewLogs,
  onImagePreview,
  onDeleteItem,
  onDownloadPDF,
  loadingPill,
  qualities = [],
  numColumns = 1,
}: {
  item: Order;
  index: number;
  onDeleteOrder: (item: Order) => void;
  onStatusChange: (item: Order) => void;
  onGreyPill: (item: Order) => void;
  onLabPill: (item: Order) => void;
  onMillInputPill: (item: Order) => void;
  onMillOutputPill: (item: Order) => void;
  onDispatchPill: (item: Order) => void;
  onViewLogs: (item: Order) => void;
  onImagePreview: (imageUrls: string[], startIndex: number) => void;
  onDeleteItem: (orderId: string, itemIndex: number) => void;
  onDownloadPDF: (orderId: string, itemIndex: number) => void;
  loadingPill?: { orderId: string; type: string } | null;
  qualities?: any[];
  numColumns?: number;
}) {
  const { theme, isDarkMode } = useTheme();
  const [showAllItems, setShowAllItems] = useState(false);
  const user = useAppStore((state) => state.user);
  const isMaster = user?.role === 'master' || user?.role === 'superadmin';
  const isParty = user?.role === 'party';
  const partyName = typeof item.party === 'object' ? (item.party as any)?.name : item.party || 'Not selected';
  const partyContactRaw = typeof item.party === 'object' ? ((item.party as any)?.contactName || item.contactName) : item.contactName;
  const partyContact = partyContactRaw && partyContactRaw !== 'Not selected' && partyContactRaw !== 'undefined' ? partyContactRaw : null;
  const partyPhoneRaw = typeof item.party === 'object' ? ((item.party as any)?.contactPhone || item.contactPhone) : item.contactPhone;
  const partyPhone = partyPhoneRaw && partyPhoneRaw !== 'Not selected' && partyPhoneRaw !== 'undefined' ? partyPhoneRaw : null;

  const hasGrey = item.greyInformation && item.greyInformation.length > 0;
  const hasMillInput = item.millInputs && item.millInputs.length > 0;
  const hasMillOutput = item.millOutputs && item.millOutputs.length > 0;
  const hasDispatch = item.dispatches && item.dispatches.length > 0;
  const hasLab = item.items && item.items.some((it: any) => it.labData && it.labData.labSendDate);

  const cardBg = isDarkMode ? '#1e293b' : Colors.white;
  const borderColor = isDarkMode ? '#334155' : '#e2e8f0';

  return (
    <View style={{ flex: 1 }}>
      <Card style={{ marginHorizontal: numColumns > 1 ? 6 : 16, marginBottom: 12, padding: 14, borderRadius: 16, flex: 1 }}>

        {/* Top Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary[600], letterSpacing: -0.5 }}>{getDisplayOrderId(item.orderId)}</Text>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#475569' : '#cbd5e1' }} />
            <OrderTypeBadge type={item.orderType} />
          </View>
          <TouchableOpacity
            onPress={() => onStatusChange(item)}
            disabled={isParty}
            activeOpacity={isParty ? 1 : 0.7}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100], borderWidth: 1, borderColor: theme.borderLight }}
          >
            <StatusBadge status={item.status || 'Not set'} />
          </TouchableOpacity>
        </View>

        {/* Order Info & Party Grid */}
        <View style={{ borderTopWidth: 1, borderTopColor: theme.borderLight, paddingTop: 10, marginBottom: 8 }}>
          {/* PO, Style, Priority */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>PO:</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }} numberOfLines={1}>{item.poNumber || '—'}</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>Style:</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text, flex: 1 }} numberOfLines={1} ellipsizeMode="tail">{item.styleNo || '—'}</Text>
            </View>
            {!!item.priority && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>Prio:</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{item.priority}</Text>
              </View>
            )}
          </View>

          {/* Party Name & Contact details */}
          <View style={{ 
            marginBottom: 8, 
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.015)' : '#fbfcfd',
            borderRadius: 10,
            padding: 8,
            borderWidth: 1,
            borderColor: theme.borderLight
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>Party:</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text }} numberOfLines={1}>
                {partyName}
              </Text>
            </View>
            {!!(partyContact || partyPhone) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                {!!partyContact && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <User size={12} color={theme.textTertiary} />
                    <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '500' }}>
                      {partyContact}
                    </Text>
                  </View>
                )}
                {!!(partyContact && partyPhone) && (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#475569' : '#cbd5e1' }} />
                )}
                {!!partyPhone && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Phone size={11} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
                    <Text style={{ fontSize: 11, color: isDarkMode ? Colors.primary[400] : Colors.primary[600], fontWeight: '700' }}>
                      {partyPhone}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Dates & Timeline */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <CalendarDays size={12} color={theme.textTertiary} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Arrival</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>{formatDate(item.arrivalDate) || '—'}</Text>
            </View>

            <View style={{ flex: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <CalendarDays size={12} color={Colors.primary[500]} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>PO Date</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>{formatDate(item.poDate) || '—'}</Text>
            </View>

            <View style={{ flex: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <CalendarDays size={12} color={Colors.primary[600]} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>Delivery</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '900', color: Colors.primary[600] }}>{formatDate(item.deliveryDate) || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Items Section */}
        {item.items && item.items.length > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: theme.borderLight, paddingTop: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Items ({item.items.length})
            </Text>
            {(showAllItems ? item.items : item.items.slice(0, 1)).map((orderItem: any, idx: number) => {
              const qName = typeof orderItem.quality === 'object' ? orderItem.quality?.name : orderItem.quality || 'N/A';
              const pName = getHighestPriorityProcess(
                item.millInputs,
                orderItem.quality,
                orderItem.processName || orderItem.processData?.mainProcess || 'No process data',
                qualities
              );
              const badgeStyles = getProcessBadgeStyles(pName, isDarkMode);
              const allImages = [...(orderItem.imageUrls || []), ...(orderItem.images || [])]
                .map((u: any) => getFullImageUrl(u))
                .filter(Boolean) as string[];

              return (
                <View key={orderItem._id || idx} style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.borderLight }}>
                  {/* Top Row: Details & Actions */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: allImages.length > 0 ? 10 : 0 }}>
                    <View style={{ flex: 1, marginRight: 8, gap: 4 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }} numberOfLines={1} ellipsizeMode="tail">{qName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <View style={{ backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: isDarkMode ? 'rgba(59,130,246,0.2)' : '#bfdbfe' }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.primary[600] }}>Qty: {orderItem.quantity || '—'}</Text>
                        </View>
                        <View style={{ backgroundColor: badgeStyles.backgroundColor, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: badgeStyles.borderColor }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: badgeStyles.textColor }} numberOfLines={1}>{pName}</Text>
                        </View>
                      </View>
                      {orderItem.description ? (
                        <Text style={{ fontSize: 10, color: theme.textTertiary, fontStyle: 'italic', marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">Desc: {orderItem.description}</Text>
                      ) : null}
                    </View>

                    {/* Icon Actions */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {isMaster && (
                        <TouchableOpacity
                          onPress={() => onDownloadPDF(item._id!, idx)}
                          activeOpacity={0.7}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : '#eff6ff',
                            borderWidth: 1,
                            borderColor: isDarkMode ? 'rgba(59,130,246,0.3)' : '#bfdbfe',
                          }}
                        >
                          <FileText size={12} color={Colors.primary[600]} />
                        </TouchableOpacity>
                      )}

                      {isMaster && (
                        <TouchableOpacity
                          onPress={() => onDeleteItem(item._id!, idx)}
                          activeOpacity={0.7}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : '#fef2f2',
                            borderWidth: 1,
                            borderColor: isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca',
                          }}
                        >
                          <Trash2 size={12} color={Colors.error[600]} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

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
                          height={120}
                          borderColor={borderColor}
                          onPress={() => onImagePreview(allImages, imgIdx)}
                          index={imgIdx}
                          totalCount={allImages.length}
                        />
                      ))}
                    </ScrollView>
                  )}
                </View>
              );
            })}

            {item.items.length > 1 && (
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAllItems(prev => !prev);
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 8,
                  backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
                  borderRadius: 10,
                  marginTop: 4,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary[600] }}>
                  {showAllItems ? 'Show Less' : `+ ${item.items.length - 1} more item${item.items.length - 1 > 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Interactive Progress Pipeline */}
        <View style={{ marginVertical: 8 }}>
          {/* Circles & Connectors Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>

            {/* Grey */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                onPress={() => onGreyPill(item)}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: hasGrey ? (isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.12)') : (isDarkMode ? '#334155' : '#f1f5f9'), borderWidth: 1.5, borderColor: hasGrey ? (isDarkMode ? '#94a3b8' : '#64748b') : (isDarkMode ? '#475569' : '#cbd5e1') }}
              >
                {loadingPill?.orderId === item._id && loadingPill?.type === 'grey' ? (
                  <ActivityIndicator size="small" color={hasGrey ? (isDarkMode ? '#cbd5e1' : '#64748b') : theme.textSecondary} />
                ) : (
                  <FileInput size={14} color={hasGrey ? (isDarkMode ? '#cbd5e1' : '#475569') : theme.textSecondary} />
                )}
              </TouchableOpacity>
              {hasGrey && (
                <View style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e', borderWidth: 1, borderColor: isDarkMode ? '#1e293b' : Colors.white }} />
              )}
            </View>

            <View style={{ height: 2, flex: 1, backgroundColor: hasLab ? '#8b5cf6' : (hasGrey ? (isDarkMode ? '#cbd5e1' : '#475569') : (isDarkMode ? '#334155' : '#e2e8f0')), marginHorizontal: 2 }} />

            {/* Lab */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                onPress={() => onLabPill(item)}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: hasLab ? 'rgba(139,92,246,0.15)' : (isDarkMode ? '#334155' : '#f1f5f9'), borderWidth: 1.5, borderColor: hasLab ? '#8b5cf6' : (isDarkMode ? '#475569' : '#cbd5e1') }}
              >
                <Beaker size={14} color={hasLab ? '#8b5cf6' : theme.textSecondary} />
              </TouchableOpacity>
              {hasLab && (
                <View style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e', borderWidth: 1, borderColor: isDarkMode ? '#1e293b' : Colors.white }} />
              )}
            </View>

            <View style={{ height: 2, flex: 1, backgroundColor: hasMillInput ? Colors.info[500] : (hasLab ? '#8b5cf6' : (isDarkMode ? '#334155' : '#e2e8f0')), marginHorizontal: 2 }} />

            {/* Mill In */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                onPress={() => onMillInputPill(item)}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: hasMillInput ? 'rgba(6,182,212,0.15)' : (isDarkMode ? '#334155' : '#f1f5f9'), borderWidth: 1.5, borderColor: hasMillInput ? Colors.info[500] : (isDarkMode ? '#475569' : '#cbd5e1') }}
              >
                {loadingPill?.orderId === item._id && loadingPill?.type === 'mill-input' ? (
                  <ActivityIndicator size="small" color={hasMillInput ? Colors.info[600] : theme.textSecondary} />
                ) : (
                  <FileInput size={14} color={hasMillInput ? Colors.info[600] : theme.textSecondary} />
                )}
              </TouchableOpacity>
              {hasMillInput && (
                <View style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e', borderWidth: 1, borderColor: isDarkMode ? '#1e293b' : Colors.white }} />
              )}
            </View>

            <View style={{ height: 2, flex: 1, backgroundColor: hasMillOutput ? Colors.success[500] : (hasMillInput ? Colors.info[500] : (isDarkMode ? '#334155' : '#e2e8f0')), marginHorizontal: 2 }} />

            {/* Mill Out */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                onPress={() => onMillOutputPill(item)}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: hasMillOutput ? 'rgba(34,197,94,0.15)' : (isDarkMode ? '#334155' : '#f1f5f9'), borderWidth: 1.5, borderColor: hasMillOutput ? Colors.success[500] : (isDarkMode ? '#475569' : '#cbd5e1') }}
              >
                {loadingPill?.orderId === item._id && loadingPill?.type === 'mill-output' ? (
                  <ActivityIndicator size="small" color={hasMillOutput ? Colors.success[600] : theme.textSecondary} />
                ) : (
                  <FileOutput size={14} color={hasMillOutput ? Colors.success[600] : theme.textSecondary} />
                )}
              </TouchableOpacity>
              {hasMillOutput && (
                <View style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e', borderWidth: 1, borderColor: isDarkMode ? '#1e293b' : Colors.white }} />
              )}
            </View>

            <View style={{ height: 2, flex: 1, backgroundColor: hasDispatch ? '#ea580c' : (hasMillOutput ? Colors.success[500] : (isDarkMode ? '#334155' : '#e2e8f0')), marginHorizontal: 2 }} />

            {/* Dispatch */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                onPress={() => onDispatchPill(item)}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: hasDispatch ? 'rgba(234, 88, 12, 0.15)' : (isDarkMode ? '#334155' : '#f1f5f9'), borderWidth: 1.5, borderColor: hasDispatch ? '#ea580c' : (isDarkMode ? '#475569' : '#cbd5e1') }}
              >
                {loadingPill?.orderId === item._id && loadingPill?.type === 'dispatch' ? (
                  <ActivityIndicator size="small" color={hasDispatch ? '#ea580c' : theme.textSecondary} />
                ) : (
                  <Truck size={14} color={hasDispatch ? '#ea580c' : theme.textSecondary} />
                )}
              </TouchableOpacity>
              {hasDispatch && (
                <View style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e', borderWidth: 1, borderColor: isDarkMode ? '#1e293b' : Colors.white }} />
              )}
            </View>

          </View>

          {/* Labels Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 4 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', width: 40, textAlign: 'center', color: hasGrey ? (isDarkMode ? '#cbd5e1' : '#475569') : theme.textSecondary }}>Grey</Text>
            <Text style={{ fontSize: 9, fontWeight: '700', width: 40, textAlign: 'center', color: hasLab ? '#8b5cf6' : theme.textSecondary }}>Lab</Text>
            <Text style={{ fontSize: 9, fontWeight: '700', width: 40, textAlign: 'center', color: hasMillInput ? Colors.info[600] : theme.textSecondary }}>Mill In</Text>
            <Text style={{ fontSize: 9, fontWeight: '700', width: 40, textAlign: 'center', color: hasMillOutput ? Colors.success[600] : theme.textSecondary }}>Mill Out</Text>
            <Text style={{ fontSize: 9, fontWeight: '700', width: 45, textAlign: 'center', color: hasDispatch ? '#ea580c' : theme.textSecondary }}>Dispatch</Text>
          </View>
        </View>

        {/* Timestamps Footnote */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Clock size={9.5} color={theme.textTertiary} />
            <Text style={{ fontSize: 9, color: theme.textTertiary }}>
              <Text style={{ fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase' }}>CREATED </Text>
              <Text>{formatShortDateTime(item.createdAt)}</Text>
            </Text>
          </View>
          <Text style={{ fontSize: 9, color: theme.textTertiary }}>•</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <RefreshCw size={9.5} color={theme.textTertiary} />
            <Text style={{ fontSize: 9, color: theme.textTertiary }}>
              <Text style={{ fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase' }}>UPDATED </Text>
              <Text>{formatShortDateTime(item.updatedAt)}</Text>
            </Text>
          </View>
        </View>

        {/* Card Footer Divider */}
        {true && (
          <>
            <View style={{ height: 1, backgroundColor: theme.borderLight, marginVertical: 8 }} />

            {/* Footer Actions */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => router.push(`/orders/${item._id}` as any)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : Colors.primary[50], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 }}>
                  <Eye size={13} color={Colors.primary[600]} />
                  <Text style={{ color: Colors.primary[600], fontSize: 12, fontWeight: '700' }}>Details</Text>
                </TouchableOpacity>

                {!isParty && (
                  <TouchableOpacity onPress={() => onViewLogs(item)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9', borderWidth: 1, borderColor: borderColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 }}>
                    <History size={13} color={theme.textSecondary} />
                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>Logs</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 6 }}>
                {/* Edit button */}
                {user?.role !== 'party' && (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/orders/create', params: { id: item._id } } as any)}
                    activeOpacity={0.7}
                    style={{
                      padding: 7,
                      borderRadius: 8,
                      backgroundColor: isDarkMode ? 'rgba(217,119,6,0.12)' : '#fef3c7',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(217,119,6,0.2)' : '#fde68a',
                    }}
                  >
                    <Edit2 size={13} color={Colors.warning[600]} />
                  </TouchableOpacity>
                )}

                {/* Delete button */}
                {isMaster && (
                  <TouchableOpacity
                    onPress={() => onDeleteOrder(item)}
                    activeOpacity={0.7}
                    style={{
                      padding: 7,
                      borderRadius: 8,
                      backgroundColor: isDarkMode ? 'rgba(220,38,38,0.12)' : '#fee2e2',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(220,38,38,0.2)' : '#fca5a5',
                    }}
                  >
                    <Trash2 size={13} color={Colors.error[600]} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}

      </Card>
    </View>
  );
}, (prevProps, nextProps) => {
  const prevItem = prevProps.item;
  const nextItem = nextProps.item;

  const prevItems = prevItem.items || [];
  const nextItems = nextItem.items || [];
  const itemsEqual = prevItems.length === nextItems.length && prevItems.every((prevIt, i) => {
    const nextIt = nextItems[i];
    if (!nextIt) return false;
    return (
      prevIt._id === nextIt._id &&
      prevIt.quantity === nextIt.quantity &&
      (typeof prevIt.quality === 'object' ? prevIt.quality?._id : prevIt.quality) === (typeof nextIt.quality === 'object' ? nextIt.quality?._id : nextIt.quality) &&
      (typeof prevIt.quality === 'object' ? prevIt.quality?.name : '') === (typeof nextIt.quality === 'object' ? nextIt.quality?.name : '') &&
      prevIt.description === nextIt.description &&
      prevIt.weaverSupplierName === nextIt.weaverSupplierName &&
      prevIt.purchaseRate === nextIt.purchaseRate &&
      prevIt.millRate === nextIt.millRate &&
      prevIt.salesRate === nextIt.salesRate &&
      JSON.stringify(prevIt.imageUrls) === JSON.stringify(nextIt.imageUrls) &&
      JSON.stringify(prevIt.labData) === JSON.stringify(nextIt.labData)
    );
  });

  return (
    prevProps.index === nextProps.index &&
    prevItem._id === nextItem._id &&
    prevItem.updatedAt === nextItem.updatedAt &&
    prevItem.status === nextItem.status &&
    prevItem.orderType === nextItem.orderType &&
    prevItem.poNumber === nextItem.poNumber &&
    prevItem.styleNo === nextItem.styleNo &&
    (typeof prevItem.party === 'object' ? prevItem.party?._id : prevItem.party) === (typeof nextItem.party === 'object' ? nextItem.party?._id : nextItem.party) &&
    (typeof prevItem.party === 'object' ? prevItem.party?.name : '') === (typeof nextItem.party === 'object' ? nextItem.party?.name : '') &&
    prevItem.contactName === nextItem.contactName &&
    prevItem.contactPhone === nextItem.contactPhone &&
    prevItem.arrivalDate === nextItem.arrivalDate &&
    prevItem.poDate === nextItem.poDate &&
    prevItem.deliveryDate === nextItem.deliveryDate &&
    ((prevProps.loadingPill === nextProps.loadingPill) || 
     (prevProps.loadingPill?.orderId === nextProps.loadingPill?.orderId && prevProps.loadingPill?.type === nextProps.loadingPill?.type)) &&
    JSON.stringify(prevItem.greyInformation) === JSON.stringify(nextItem.greyInformation) &&
    JSON.stringify(prevItem.millInputs) === JSON.stringify(nextItem.millInputs) &&
    JSON.stringify(prevItem.millOutputs) === JSON.stringify(nextItem.millOutputs) &&
    JSON.stringify(prevItem.dispatches) === JSON.stringify(nextItem.dispatches) &&
    itemsEqual
  );
});

// Date format conversion helpers
const toDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
};

const toApiDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
  }
  return dateStr;
};

// ─── Main Orders Screen ───
export default function OrdersScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { numColumns, isLargeScreen, containerMaxWidth } = useResponsiveLayout();
  const winWidth = screenWidth;
  const winHeight = screenHeight;
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);
  const user = useAppStore((s) => s.user);
  const isMaster = user?.role === 'master' || user?.role === 'superadmin';
  const isParty = user?.role === 'party';
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isOffline = useAppStore((s) => s.isOffline);
  const params = useLocalSearchParams<{ status?: string; type?: string; search?: string; searchType?: string }>();
  
  const [transitionsFinished, setTransitionsFinished] = useState(false);

  useEffect(() => {
    const run = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (cb: any) => setTimeout(cb, 1);
    const cancel = typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback : (id: any) => clearTimeout(id);
    const handle = run(() => {
      setTransitionsFinished(true);
    });
    return () => cancel(handle as any);
  }, []);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortFilter, setSortFilter] = useState('latest_first');
  const [fyFilter, setFyFilter] = useState('');
  const [millFilter, setMillFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Date picker visibility states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // New Search & Dropdowns state
  const [searchType, setSearchType] = useState('all');
  const [showSearchTypeModal, setShowSearchTypeModal] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const [showFyModal, setShowFyModal] = useState(false);
  const [showMillModal, setShowMillModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalOrder, setStatusModalOrder] = useState<Order | null>(null);
  const [millSearchText, setMillSearchText] = useState('');

  // Quick Action States
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);
  const [showCreatePartyModal, setShowCreatePartyModal] = useState(false);
  const [showCreateQualityModal, setShowCreateQualityModal] = useState(false);
  const [showCreateMillModal, setShowCreateMillModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newQualityName, setNewQualityName] = useState('');
  const [newMillName, setNewMillName] = useState('');

  const [deleteWarning, setDeleteWarning] = useState<{ title: string; message: string } | null>(null);

  const processedParamsRef = useRef<string>('');

  React.useEffect(() => {
    const paramKey = `${params?.status || ''}-${params?.type || ''}-${params?.search || ''}-${params?.searchType || ''}`;
    if (processedParamsRef.current === paramKey) {
      return;
    }
    processedParamsRef.current = paramKey;

    let changed = false;
    if (params?.status) {
      const targetStatus = params.status;
      if (['All', 'pending', 'delivered'].includes(targetStatus)) {
        setStatusFilter(targetStatus);
        changed = true;
      }
    }
    if (params?.type) {
      const targetType = params.type;
      if (['All', 'Dying', 'Printing'].includes(targetType)) {
        setTypeFilter(targetType);
        changed = true;
      }
    }
    if (params?.search) {
      setSearch(params.search);
      setSearchVal(params.search);
      changed = true;
    }
    if (params?.searchType) {
      setSearchType(params.searchType);
      changed = true;
    }
    if (changed) {
      router.setParams({ status: undefined, type: undefined, search: undefined, searchType: undefined });
      processedParamsRef.current = '---';
    }
  }, [params?.status, params?.type, params?.search, params?.searchType]);

  const unfilteredQuery = useQuery({
    queryKey: ['orders-unfiltered-count'],
    queryFn: async () => {
      const { data } = await api.get('/api/orders', { params: { page: 1, limit: 1, t: Date.now() } });
      return data?.pagination?.total || 0;
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const hasSubFilters = useMemo(() => {
    return (
      search.trim() !== '' ||
      typeFilter !== 'All' ||
      fyFilter !== '' ||
      millFilter !== '' ||
      startDate !== '' ||
      endDate !== ''
    );
  }, [search, typeFilter, fyFilter, millFilter, startDate, endDate]);


  // Modals state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<Order | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<{ orderId: string; itemIndex: number } | null>(null);
  const [deleteLabAllTarget, setDeleteLabAllTarget] = useState<boolean>(false);

  // Swipe down to close Filter Modal
  const filterScrollOffset = useRef(0);
  const filterSheetY = useRef(0);
  const filterTouchStartPageY = useRef(0);
  const filterPanY = useRef(new RNAnimated.Value(0)).current;

  const closeFilterModal = useCallback(() => {
    RNAnimated.timing(filterPanY, {
      toValue: winHeight,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setShowFilterModal(false);
    });
  }, [filterPanY, winHeight]);

  const filterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        filterTouchStartPageY.current = pageY;
        return pageY < filterSheetY.current + 80;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return filterScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return filterScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
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
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showFilterModal) {
      filterPanY.setValue(0);
    }
  }, [showFilterModal]);

  // Swipe down to close Search Type Selection Modal
  const searchTypeScrollOffset = useRef(0);
  const searchTypeSheetY = useRef(0);
  const searchTypeTouchStartPageY = useRef(0);
  const searchTypePanY = useRef(new RNAnimated.Value(0)).current;

  const closeSearchTypeModal = useCallback(() => {
    RNAnimated.timing(searchTypePanY, {
      toValue: winHeight,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setShowSearchTypeModal(false);
    });
  }, [searchTypePanY, winHeight]);

  const searchTypePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        searchTypeTouchStartPageY.current = pageY;
        return pageY < searchTypeSheetY.current + 80;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return searchTypeScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return searchTypeScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
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
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showSearchTypeModal) {
      searchTypePanY.setValue(0);
    }
  }, [showSearchTypeModal]);

  // Swipe down to close Financial Year Selection Modal
  const fyScrollOffset = useRef(0);
  const fySheetY = useRef(0);
  const fyTouchStartPageY = useRef(0);
  const fyPanY = useRef(new RNAnimated.Value(0)).current;

  const closeFyModal = useCallback(() => {
    RNAnimated.timing(fyPanY, {
      toValue: winHeight,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setShowFyModal(false);
    });
  }, [fyPanY, winHeight]);

  const fyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        fyTouchStartPageY.current = pageY;
        return pageY < fySheetY.current + 80;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return fyScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return fyScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          fyPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (evt, gs) => {
        const isBackdropTouch = fyTouchStartPageY.current < fySheetY.current;
        if (isBackdropTouch && Math.abs(gs.dy) < 10 && Math.abs(gs.dx) < 10) {
          closeFyModal();
          return;
        }

        if (gs.dy > 50 || gs.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeFyModal();
        } else {
          RNAnimated.spring(fyPanY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showFyModal) {
      fyPanY.setValue(0);
    }
  }, [showFyModal]);

  // Swipe down to close Mill Selection Modal
  const millScrollOffset = useRef(0);
  const millSheetY = useRef(0);
  const millTouchStartPageY = useRef(0);
  const millPanY = useRef(new RNAnimated.Value(0)).current;

  const closeMillModal = useCallback(() => {
    RNAnimated.timing(millPanY, {
      toValue: winHeight,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setShowMillModal(false);
      setMillSearchText('');
    });
  }, [millPanY, winHeight]);

  const millPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        millTouchStartPageY.current = pageY;
        return pageY < millSheetY.current + 80;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return millScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return millScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          millPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (evt, gs) => {
        const isBackdropTouch = millTouchStartPageY.current < millSheetY.current;
        if (isBackdropTouch && Math.abs(gs.dy) < 10 && Math.abs(gs.dx) < 10) {
          closeMillModal();
          return;
        }

        if (gs.dy > 50 || gs.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeMillModal();
        } else {
          RNAnimated.spring(millPanY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showMillModal) {
      millPanY.setValue(0);
    }
  }, [showMillModal]);

  // Status Modal Swipe to close
  const statusSheetY = useRef(0);
  const statusTouchStartPageY = useRef(0);
  const statusPanY = useRef(new RNAnimated.Value(0)).current;

  const closeStatusModal = useCallback(() => {
    RNAnimated.timing(statusPanY, {
      toValue: winHeight,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setShowStatusModal(false);
      setStatusModalOrder(null);
    });
  }, [statusPanY, winHeight]);

  const statusPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        statusTouchStartPageY.current = pageY;
        return pageY < statusSheetY.current + 85;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && g.dy > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) statusPanY.setValue(g.dy);
      },
      onPanResponderRelease: (evt, g) => {
        const isBackdropTouch = statusTouchStartPageY.current < statusSheetY.current;
        if (isBackdropTouch && Math.abs(g.dy) < 10 && Math.abs(g.dx) < 10) {
          closeStatusModal();
          return;
        }

        if (g.dy > 50 || g.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeStatusModal();
        } else {
          RNAnimated.spring(statusPanY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showStatusModal) {
      statusPanY.setValue(0);
    }
  }, [showStatusModal]);



  // Sub-records modal and state
  const [activeModal, setActiveModal] = useState<'grey' | 'mill-input' | 'mill-output' | 'dispatch' | 'lab' | null>(null);
  const [loadingPill, setLoadingPill] = useState<{ orderId: string; type: 'grey' | 'lab' | 'mill-input' | 'mill-output' | 'dispatch' } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [greyInfo, setGreyInfo] = useState<any[]>([]);
  const [millInputsList, setMillInputsList] = useState<any[]>([]);
  const [millOutputsList, setMillOutputsList] = useState<any[]>([]);
  const [dispatchesList, setDispatchesList] = useState<any[]>([]);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedDbOrderId, setSelectedDbOrderId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  // Image modal state
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);

  // Logs modal state
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedOrderForLogs, setSelectedOrderForLogs] = useState<Order | null>(null);

  // Item selector modal for lab data
  const [showLabItemSelector, setShowLabItemSelector] = useState(false);
  const [labItemSelectorOrder, setLabItemSelectorOrder] = useState<Order | null>(null);
  const [pdfPreviewData, setPdfPreviewData] = useState<{ order: Order; itemIndex: number } | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfToken, setPdfToken] = useState<string | null>(null);

  // PDF Viewer Modal state (for native Save & Share)
  const [orderPdfViewerVisible, setOrderPdfViewerVisible] = useState(false);
  const [orderPdfViewerUrl, setOrderPdfViewerUrl] = useState('');
  const [orderPdfViewerTitle, setOrderPdfViewerTitle] = useState('');
  const [orderPdfViewerFilename, setOrderPdfViewerFilename] = useState('');

  useEffect(() => {
    if (pdfPreviewData) {
      storage.getToken().then(token => {
        setPdfToken(token);
      }).catch(err => {
        console.error('Error fetching token for PDF preview:', err);
      });
    } else {
      setPdfToken(null);
    }
  }, [pdfPreviewData]);

  // Swipe down to close Lab Item Selector Modal
  const labSelectorScrollOffset = useRef(0);
  const labSelectorSheetY = useRef(0);
  const labSelectorTouchStartPageY = useRef(0);
  const labSelectorPanY = useRef(new RNAnimated.Value(0)).current;

  const closeLabSelectorModal = useCallback(() => {
    RNAnimated.timing(labSelectorPanY, {
      toValue: winHeight,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setShowLabItemSelector(false);
    });
  }, [labSelectorPanY, winHeight]);

  const labSelectorPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        labSelectorTouchStartPageY.current = pageY;
        return pageY < labSelectorSheetY.current + 80;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return labSelectorScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return labSelectorScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          labSelectorPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (evt, gs) => {
        const isBackdropTouch = labSelectorTouchStartPageY.current < labSelectorSheetY.current;
        if (isBackdropTouch && Math.abs(gs.dy) < 10 && Math.abs(gs.dx) < 10) {
          closeLabSelectorModal();
          return;
        }

        if (gs.dy > 50 || gs.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeLabSelectorModal();
        } else {
          RNAnimated.spring(labSelectorPanY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showLabItemSelector) {
      labSelectorPanY.setValue(0);
    }
  }, [showLabItemSelector]);

  // Swipe down to close Logs Modal
  const logsScrollOffset = useRef(0);
  const logsSheetY = useRef(0);
  const logsTouchStartPageY = useRef(0);
  const logsPanY = useRef(new RNAnimated.Value(0)).current;

  const closeLogsModal = useCallback(() => {
    RNAnimated.timing(logsPanY, {
      toValue: winHeight,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setShowLogsModal(false);
    });
  }, [logsPanY, winHeight]);

  const logsPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        logsTouchStartPageY.current = pageY;
        return pageY < logsSheetY.current + 80;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return logsScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return logsScrollOffset.current <= 0 && gs.dy > 8 && gs.dy > Math.abs(gs.dx);
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          logsPanY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (evt, gs) => {
        const isBackdropTouch = logsTouchStartPageY.current < logsSheetY.current;
        if (isBackdropTouch && Math.abs(gs.dy) < 10 && Math.abs(gs.dx) < 10) {
          closeLogsModal();
          return;
        }

        if (gs.dy > 50 || gs.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeLogsModal();
        } else {
          RNAnimated.spring(logsPanY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (showLogsModal) {
      logsPanY.setValue(0);
    }
  }, [showLogsModal]);

  const partiesQuery = useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      const { data } = await api.get('/api/parties');
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000, // 10 min — parties rarely change
  });
  const parties = useMemo(() => partiesQuery.data || [], [partiesQuery.data]);

  const qualitiesQuery = useQuery({
    queryKey: ['qualities'],
    queryFn: async () => {
      const { data } = await api.get('/api/qualities');
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
  });

  const millsQuery = useQuery({
    queryKey: ['mills'],
    queryFn: async () => {
      const { data } = await api.get('/api/mills');
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
  });

  const qualities = useMemo(() => qualitiesQuery.data || [], [qualitiesQuery.data]);
  const mills = useMemo(() => millsQuery.data || [], [millsQuery.data]);

  const fyQuery = useQuery({
    queryKey: ['financialYears'],
    queryFn: async () => {
      const { data } = await api.get('/api/orders/financial-years');
      return data?.data?.options || [];
    },
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
  });
  const fyOptions = fyQuery.data || [];

  const millsList = useMemo(() => {
    if (Array.isArray(mills)) return mills;
    if (mills && typeof mills === 'object') {
      if (Array.isArray((mills as any).data)) return (mills as any).data;
      if (Array.isArray((mills as any).mills)) return (mills as any).mills;
    }
    return [];
  }, [mills]);

  const fyList = useMemo(() => {
    if (Array.isArray(fyOptions)) return fyOptions;
    if (fyOptions && typeof fyOptions === 'object') {
      if (Array.isArray((fyOptions as any).data)) return (fyOptions as any).data;
      if (Array.isArray((fyOptions as any).options)) return (fyOptions as any).options;
    }
    return [];
  }, [fyOptions]);

  const filteredMillsForFilter = useMemo(() => {
    if (!millSearchText) return millsList;
    return millsList.filter((m: any) => m.name && m.name.toLowerCase().includes(millSearchText.toLowerCase()));
  }, [millsList, millSearchText]);

  // Draggable FAB state & handlers matching User Page
  const FAB_BOTTOM_OFFSET = Platform.OS === 'ios' ? 220 : 170;
  const pan = useRef(new RNAnimated.ValueXY({ x: screenWidth - 68, y: screenHeight - FAB_BOTTOM_OFFSET })).current;
  const fabX = useRef(screenWidth - 68);
  const fabY = useRef(screenHeight - FAB_BOTTOM_OFFSET);

  const dimensionsRef = useRef({ screenWidth, screenHeight });
  dimensionsRef.current = { screenWidth, screenHeight };

  useEffect(() => {
    const isSnappedLeft = fabX.current < screenWidth / 2;
    const targetX = isSnappedLeft ? 20 : screenWidth - 68;
    const targetY = Math.min(Math.max(fabY.current, 100), screenHeight - FAB_BOTTOM_OFFSET);
    
    fabX.current = targetX;
    fabY.current = targetY;
    
    RNAnimated.spring(pan, {
      toValue: { x: targetX, y: targetY },
      useNativeDriver: false,
      friction: 6,
    }).start();
  }, [screenWidth, screenHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
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

        if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
          router.push('/orders/create');
          RNAnimated.spring(pan, {
            toValue: { x: fabX.current, y: fabY.current },
            useNativeDriver: false,
            friction: 6,
          }).start();
          return;
        }

        const currentScreenWidth = dimensionsRef.current.screenWidth;
        const currentScreenHeight = dimensionsRef.current.screenHeight;

        const currentX = fabX.current + gestureState.dx;
        const currentY = fabY.current + gestureState.dy;

        const snapLeftX = 20;
        const snapRightX = currentScreenWidth - 68;
        const targetX = currentX < currentScreenWidth / 2 ? snapLeftX : snapRightX;

        const minY = 100;
        const maxY = currentScreenHeight - FAB_BOTTOM_OFFSET;
        const targetY = Math.min(Math.max(currentY, minY), maxY);

        fabX.current = targetX;
        fabY.current = targetY;

        RNAnimated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 6,
        }).start();
      },
    })
  ).current;

  // Logs query
  const logsQuery = useQuery({
    queryKey: ['order-logs', selectedOrderForLogs?._id],
    queryFn: async () => {
      if (!selectedOrderForLogs?._id) return [];
      const { data } = await api.get(`/api/orders/${selectedOrderForLogs._id}/logs`);
      return data?.data || [];
    },
    enabled: !!selectedOrderForLogs?._id
  });

  // Status Update Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { data } = await api.patch('/api/orders/status', { orderId, status });
      return data;
    },
    onSuccess: async () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await ordersQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      addToast({
        type: 'success',
        title: 'Status Updated 🎉',
        message: 'Order status updated successfully.',
      });
    },
    onError: (err: any) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to update status';
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: errMsg,
      });
    },
  });

  // Delete Order Mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.delete(`/api/orders/${orderId}`);
      return data;
    },
    onSuccess: async () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeleteOrderTarget(null);
      await ordersQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      addToast({
        type: 'success',
        title: 'Order Deleted 🗑️',
        message: 'The order has been deleted successfully.',
      });
    },
    onError: (err: any) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to delete order';
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: errMsg,
      });
    }
  });

  // Delete Mutations
  const deleteGreyMutation = useMutation({
    mutationFn: async (itemId: string) => { await api.delete(`/api/grey-info/${itemId}`); },
    onSuccess: async (_, itemId) => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          return {
            ...order,
            greyInformation: (order.greyInformation || []).filter((x: any) => x._id !== itemId)
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Grey Info Deleted' });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => { addToast({ type: 'error', title: 'Failed to delete grey info' }); }
  });

  const deleteGreyAllForOrderMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/grey-info`, { params: { orderId: selectedOrderId } });
    },
    onSuccess: async () => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          return {
            ...order,
            greyInformation: []
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'All Grey Info Deleted' });
      setGreyInfo([]);
      setActiveModal(null);
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to delete grey info';
      addToast({ type: 'error', title: msg });
    }
  });

  const deleteMillInputMutation = useMutation({
    mutationFn: async (itemId: string) => { await api.delete(`/api/mill-inputs/${itemId}`); },
    onSuccess: async (_, itemId) => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          return {
            ...order,
            millInputs: (order.millInputs || []).filter((x: any) => x._id !== itemId)
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Mill Input Deleted' });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => { addToast({ type: 'error', title: 'Failed to delete mill input' }); }
  });

  const deleteMillOutputMutation = useMutation({
    mutationFn: async (itemId: string) => { await api.delete(`/api/mill-outputs/${itemId}`); },
    onSuccess: async (_, itemId) => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          return {
            ...order,
            millOutputs: (order.millOutputs || []).filter((x: any) => x._id !== itemId)
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Mill Output Deleted' });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => { addToast({ type: 'error', title: 'Failed to delete mill output' }); }
  });

  const deleteDispatchMutation = useMutation({
    mutationFn: async (itemId?: string) => {
      if (itemId) {
        await api.delete(`/api/dispatch/${itemId}`);
      } else {
        await api.delete('/api/dispatch', { params: { orderId: selectedOrderId } });
      }
    },
    onSuccess: async (_, itemId) => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          return {
            ...order,
            dispatches: itemId
              ? (order.dispatches || []).filter((x: any) => x._id !== itemId)
              : []
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Dispatch(es) Deleted' });
      if (itemId) {
        setDispatchesList(prev => prev.filter((x: any) => x._id !== itemId));
      } else {
        setDispatchesList([]);
        setActiveModal(null);
      }
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => { addToast({ type: 'error', title: 'Failed to delete dispatch(es)' }); }
  });

  const deleteLabMutation = useMutation({
    mutationFn: async ({ dbOrderId, itemId }: { dbOrderId: string; itemId: string }) => { await api.delete(`/api/labs/${dbOrderId}/${itemId}`); },
    onSuccess: async (_, variables) => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          const newItems = (order.items || []).map((item: any) => {
            if (item._id === variables.itemId) {
              return { ...item, labData: null };
            }
            return item;
          });
          return {
            ...order,
            items: newItems
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Lab Data Deleted' });
      setSelectedItemId(null);
      setActiveModal(null);
      if (selectedOrder?.items && selectedOrder.items.length > 1) {
        setShowLabItemSelector(true);
      }
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => { addToast({ type: 'error', title: 'Failed to delete lab data' }); }
  });

  const deleteLabsAllForOrderMutation = useMutation({
    mutationFn: async (dbOrderId: string) => {
      await api.delete(`/api/labs/delete-by-order/${dbOrderId}`);
    },
    onSuccess: async () => {
      const dbId = selectedDbOrderId;
      setDeleteLabAllTarget(false);
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          const newItems = (order.items || []).map((item: any) => ({
            ...item,
            labData: null
          }));
          return {
            ...order,
            items: newItems
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'All Lab Data Deleted' });
      closeLabSelectorModal();
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to delete all lab data' });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ orderId, itemIndex }: { orderId: string; itemIndex: number }) => {
      const { data } = await api.put(`/api/orders/${orderId}`, {
        action: 'deleteItem',
        itemIndex: itemIndex
      });
      return data;
    },
    onSuccess: async () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeleteItemTarget(null);
      await ordersQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      addToast({
        type: 'success',
        title: 'Item Deleted 🗑️',
        message: 'The item has been deleted successfully.',
      });
    },
    onError: (err: any) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to delete item';
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: errMsg,
      });
    }
  });

  // Quick Action Mutations (Party, Quality, Mill Name)
  const createPartyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post('/api/parties', { name });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      const newParty = data?.data || data?.party || data;
      addToast({
        type: 'success',
        title: 'Party Created',
        message: `Party "${newParty.name || 'New Party'}" has been added.`,
      });
      setShowCreatePartyModal(false);
      setNewPartyName('');
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to create party';
      Alert.alert('Error', errMsg);
    }
  });

  const createQualityMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post('/api/qualities', { name });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['qualities'] });
      const newQual = data?.data || data?.quality || data;
      addToast({
        type: 'success',
        title: 'Quality Created',
        message: `Quality "${newQual.name || 'New Quality'}" has been added.`,
      });
      setShowCreateQualityModal(false);
      setNewQualityName('');
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to create quality';
      Alert.alert('Error', errMsg);
    }
  });

  const createMillMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post('/api/mills', { name });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mills'] });
      const newMill = data?.data || data?.mill || data;
      addToast({
        type: 'success',
        title: 'Mill Created',
        message: `Mill "${newMill.name || 'New Mill'}" has been added.`,
      });
      setShowCreateMillModal(false);
      setNewMillName('');
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to create mill';
      Alert.alert('Error', errMsg);
    }
  });

  const [deleteMillTarget, setDeleteMillTarget] = useState<any>(null);
  const deleteMillMutation = useMutation({
    mutationFn: async (millId: string) => {
      const { data } = await api.delete(`/api/mills/${millId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mills'] });
      setDeleteMillTarget(null);
      addToast({
        type: 'success',
        title: 'Mill Deleted',
        message: 'Mill has been successfully deleted.',
      });
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to delete mill';
      setDeleteWarning({
        title: 'Cannot Delete Mill',
        message: errMsg,
      });
      setDeleteMillTarget(null);
    }
  });

  // Intercept physical Back button on Android to close active modals/sheets
  useEffect(() => {
    const handleBackButton = () => {
      // 1. Creation Modals
      if (showCreatePartyModal) {
        if (!createPartyMutation.isPending) {
          setShowCreatePartyModal(false);
        }
        return true;
      }
      if (showCreateQualityModal) {
        if (!createQualityMutation.isPending) {
          setShowCreateQualityModal(false);
        }
        return true;
      }
      if (showCreateMillModal) {
        if (!createMillMutation.isPending) {
          setShowCreateMillModal(false);
        }
        return true;
      }

      // 2. PDF Preview
      if (pdfPreviewData !== null) {
        setPdfPreviewData(null);
        return true;
      }

      // 3. Process Modals (Grey, Mill Input/Output, Dispatch, Lab)
      if (activeModal !== null) {
        setActiveModal(null);
        setEditItem(null);
        return true;
      }

      // 4. Filters & Sheet Modals
      if (showFilterModal) {
        closeFilterModal();
        return true;
      }
      if (showSearchTypeModal) {
        closeSearchTypeModal();
        return true;
      }
      if (showFyModal) {
        closeFyModal();
        return true;
      }
      if (showMillModal) {
        closeMillModal();
        return true;
      }
      if (showStatusModal) {
        closeStatusModal();
        return true;
      }
      if (showLabItemSelector) {
        closeLabSelectorModal();
        return true;
      }
      if (showLogsModal) {
        closeLogsModal();
        return true;
      }

      // 5. Delete warning / confirmations
      if (deleteWarning !== null) {
        setDeleteWarning(null);
        return true;
      }
      if (deleteOrderTarget !== null) {
        setDeleteOrderTarget(null);
        return true;
      }
      if (deleteItemTarget !== null) {
        setDeleteItemTarget(null);
        return true;
      }

      return false; // Let default system navigation handle it
    };

    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
      return () => backHandler.remove();
    }
  }, [
    showCreatePartyModal, showCreateQualityModal, showCreateMillModal,
    createPartyMutation.isPending, createQualityMutation.isPending, createMillMutation.isPending,
    pdfPreviewData, activeModal, showFilterModal, showSearchTypeModal, showFyModal,
    showMillModal, showStatusModal, showLabItemSelector, showLogsModal,
    deleteWarning, deleteOrderTarget, deleteItemTarget
  ]);

  // Save mutations (linked to query invalidation)
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
          orderId: selectedOrderId,
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
    onSuccess: async (data, variables) => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          let currentList = order.greyInformation || [];
          if (variables.deletedIds && variables.deletedIds.length > 0) {
            currentList = currentList.filter((x: any) => !variables.deletedIds.includes(x._id));
          }
          const savedItems = (data || []).map((res: any) => res?.data?.greyInfo || res?.greyInfo || res?.data || res);
          const newList = [...currentList];
          savedItems.forEach((saved: any) => {
            if (!saved || !saved._id) return;
            const idx = newList.findIndex((x: any) => x._id === saved._id);
            if (idx > -1) {
              newList[idx] = saved;
            } else {
              newList.push(saved);
            }
          });
          return { ...order, greyInformation: newList };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Grey Info Saved' });
      setActiveModal(null);
      setEditItem(null);
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save grey info';
      addToast({ type: 'error', title: msg });
    }
  });

  const saveMillInputMutation = useMutation({
    onSuccess: async (data) => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const savedItems = (data || []).map((res: any) => res?.data?.millInput || res?.millInput || res?.data || res);
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          return {
            ...order,
            millInputs: savedItems
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Mill Inputs Saved' });
      setActiveModal(null);
      setEditItem(null);
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    mutationFn: async (payload: { mill: string; millItems: any[] }) => {
      // 1. Delete all existing mill inputs for this order
      await api.delete(`/api/mill-inputs`, { params: { orderId: selectedOrderId } });

      // 2. Post all items
      const savePromises = payload.millItems.map(async (item: any) => {
        const requestBody = {
          orderId: selectedOrderId,
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
        const { data } = await api.post('/api/mill-inputs', requestBody);
        return data;
      });
      return Promise.all(savePromises);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save mill inputs';
      addToast({ type: 'error', title: msg });
    }
  });

  const deleteMillInputsForOrderMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/mill-inputs`, { params: { orderId: selectedOrderId } });
    },
    onSuccess: async () => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          return {
            ...order,
            millInputs: []
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'All Mill Inputs Deleted' });
      setMillInputsList([]);
      setActiveModal(null);
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to delete mill inputs';
      addToast({ type: 'error', title: msg });
    }
  });

  const saveMillOutputMutation = useMutation({
    onSuccess: async (data) => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const savedItems = (data || []).map((res: any) => res?.data?.millOutput || res?.millOutput || res?.data || res);
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          return {
            ...order,
            millOutputs: savedItems
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Mill Outputs Saved' });
      setActiveModal(null);
      setEditItem(null);
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    mutationFn: async (payload: { millOutputItems: any[] }) => {
      // 1. Delete all existing mill outputs for this order
      await api.delete(`/api/mill-outputs`, { params: { orderId: selectedOrderId } });

      // 2. Post all items
      const savePromises: any[] = [];
      payload.millOutputItems.forEach((item: any) => {
        // Main item
        savePromises.push((async () => {
          const { data } = await api.post('/api/mill-outputs', {
            orderId: selectedOrderId,
            recdDate: item.recdDate,
            millBillNo: item.millBillNo,
            finishedMtr: parseFloat(item.finishedMtr) || 0,
            quality: item.quality || null
          });
          return data;
        })());

        // Additional finished meters
        if (item.additionalFinishedMtr && Array.isArray(item.additionalFinishedMtr)) {
          item.additionalFinishedMtr.forEach((add: any) => {
            savePromises.push((async () => {
              const { data } = await api.post('/api/mill-outputs', {
                orderId: selectedOrderId,
                recdDate: item.recdDate,
                millBillNo: item.millBillNo,
                finishedMtr: parseFloat(add.meters) || 0,
                quality: add.quality || null
              });
              return data;
            })());
          });
        }
      });
      return Promise.all(savePromises);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save mill outputs';
      addToast({ type: 'error', title: msg });
    }
  });

  const deleteMillOutputsForOrderMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/mill-outputs`, { params: { orderId: selectedOrderId } });
    },
    onSuccess: async () => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          return {
            ...order,
            millOutputs: []
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'All Mill Outputs Deleted' });
      setMillOutputsList([]);
      setActiveModal(null);
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to delete mill outputs';
      addToast({ type: 'error', title: msg });
    }
  });

  const saveDispatchMutation = useMutation({
    mutationFn: async (payload: { dispatchItems: any[] }) => {
      // 1. Delete all existing dispatches for this order
      await api.delete('/api/dispatch', { params: { orderId: selectedOrderId } });

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
              orderId: selectedOrderId,
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
      const results: any[] = [];
      for (const dispatch of dispatchesToSave) {
        const { data } = await api.post('/api/dispatch', dispatch);
        results.push(data);
      }
      return results;
    },
    onSuccess: async (data: any) => {
      const dbId = selectedDbOrderId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          const savedList = Array.isArray(data)
            ? data.map((d: any) => d?.data || d?.dispatch || d)
            : [data?.data || data?.dispatch || data];
          return {
            ...order,
            dispatches: savedList
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Dispatch(es) Saved' });
      const savedList = Array.isArray(data)
        ? data.map((d: any) => d?.data || d?.dispatch || d)
        : [data?.data || data?.dispatch || data];
      setDispatchesList(savedList);
      setActiveModal(null);
      setEditItem(null);
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save dispatch';
      addToast({ type: 'error', title: msg });
    }
  });

  const saveLabMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post(`/api/labs/${selectedDbOrderId}/${selectedItemId}`, payload);
      return data;
    },
    onSuccess: async (res) => {
      const dbId = selectedDbOrderId;
      const itemId = selectedItemId;
      queryClient.setQueriesData({ queryKey: ['orders'], exact: false }, (oldData: any) => {
        if (!oldData) return oldData;
        const savedLab = res?.data?.labData || res?.labData || res;
        const updateOrderSubarray = (order: any) => {
          if (order._id !== dbId) return order;
          const newItems = (order.items || []).map((item: any) => {
            if (item._id === itemId) {
              return { ...item, labData: savedLab };
            }
            return item;
          });
          return {
            ...order,
            items: newItems
          };
        };
        if (Array.isArray(oldData)) return oldData.map(updateOrderSubarray);
        if (oldData.data && Array.isArray(oldData.data)) {
          return { ...oldData, data: oldData.data.map(updateOrderSubarray) };
        }
        return oldData;
      });
      addToast({ type: 'success', title: 'Lab Data Saved' });
      setActiveModal(null);
      setEditItem(null);
      setSelectedItemId(null);
      if (selectedOrder?.items && selectedOrder.items.length > 1) {
        setShowLabItemSelector(true);
      }
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save lab data';
      addToast({ type: 'error', title: msg });
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

  // Status Change Dialog Handler
  const handleStatusBadgePress = useCallback((order: Order) => {
    if (isParty) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatusModalOrder(order);
    setShowStatusModal(true);
  }, [isParty]);

  // Pill Handlers (Edit first if exists, else Add)
  const handleGreyPill = useCallback(async (order: Order) => {
    setSelectedOrder(order);
    setSelectedOrderId(order.orderId);
    setSelectedDbOrderId(order._id);

    // Initialize with local cached data immediately (so the modal opens instantly)
    const cached = order.greyInformation || [];
    setGreyInfo(cached);
    setActiveModal('grey');

    // If no existing data, do NOT trigger API call or show loading line
    if (cached.length === 0) {
      return;
    }

    try {
      setLoadingPill({ orderId: order._id, type: 'grey' });
      const { data } = await api.get('/api/grey-info', { params: { orderId: order.orderId, t: Date.now() } });
      const records = data?.data?.greyInfo || (Array.isArray(data?.data) ? data.data : data?.data || []);
      setGreyInfo(records);
    } catch (err) {
      console.log('Error fetching fresh grey info:', err);
    } finally {
      setLoadingPill(null);
    }
  }, []);

  const handleMillInputPill = useCallback(async (order: Order) => {
    setSelectedOrder(order);
    setSelectedOrderId(order.orderId);
    setSelectedDbOrderId(order._id);
    
    // Initialize with local cached data immediately
    const localMillInputs = order.millInputs || [];
    setMillInputsList(localMillInputs);
    setActiveModal('mill-input');

    // If no existing data, do NOT trigger API call or show loading line
    if (localMillInputs.length === 0) {
      return;
    }

    try {
      setLoadingPill({ orderId: order._id, type: 'mill-input' });
      const { data } = await api.get('/api/mill-inputs', { params: { orderId: order.orderId, t: Date.now() } });
      const records = data?.data?.millInputs || (Array.isArray(data?.data) ? data.data : data?.data || []);
      setMillInputsList(records);
    } catch (err) {
      console.log('Error fetching fresh mill inputs:', err);
    } finally {
      setLoadingPill(null);
    }
  }, []);

  const handleMillOutputPill = useCallback(async (order: Order) => {
    setSelectedOrder(order);
    setSelectedOrderId(order.orderId);
    setSelectedDbOrderId(order._id);
    
    // Initialize with local cached data immediately
    const localMillOutputs = order.millOutputs || [];
    setMillOutputsList(localMillOutputs);
    setActiveModal('mill-output');

    // If no existing data, do NOT trigger API call or show loading line
    if (localMillOutputs.length === 0) {
      return;
    }

    try {
      setLoadingPill({ orderId: order._id, type: 'mill-output' });
      const { data } = await api.get('/api/mill-outputs', { params: { orderId: order.orderId, t: Date.now() } });
      const records = data?.data?.millOutputs || (Array.isArray(data?.data) ? data.data : data?.data || []);
      setMillOutputsList(records);
    } catch (err) {
      console.log('Error fetching fresh mill outputs:', err);
    } finally {
      setLoadingPill(null);
    }
  }, []);

  const handleDispatchPill = useCallback(async (order: Order) => {
    setSelectedOrder(order);
    setSelectedOrderId(order.orderId);
    setSelectedDbOrderId(order._id);
    
    // Initialize with local cached data immediately for instant UI feedback
    const localDispatches = order.dispatches || [];
    setDispatchesList(localDispatches);
    
    const firstLocal = localDispatches[0];
    if (firstLocal) {
      setEditItem(firstLocal);
    } else {
      setEditItem(null);
    }
    setActiveModal('dispatch');

    // If no existing data, do NOT trigger API call or show loading line
    if (localDispatches.length === 0) {
      return;
    }

    try {
      setLoadingPill({ orderId: order._id, type: 'dispatch' });
      const { data } = await api.get('/api/dispatch', { params: { orderId: order.orderId, t: Date.now() } });
      const records = data?.data?.dispatches || (Array.isArray(data?.data) ? data.data : data?.data || []);
      setDispatchesList(records);
      if (records.length > 0) {
        setEditItem(records[0]);
      } else {
        setEditItem(null);
      }
    } catch (err) {
      console.log('Error fetching fresh dispatches:', err);
    } finally {
      setLoadingPill(null);
    }
  }, []);

  const openLabFormForItem = useCallback((orderItem: any, orderId: string, dbOrderId: string) => {
    setSelectedOrderId(orderId);
    setSelectedDbOrderId(dbOrderId);
    setSelectedItemId(orderItem._id);
    const hasLab = orderItem.labData && orderItem.labData.labSendDate;
    if (hasLab) {
      setEditItem(orderItem.labData);
      setFormData({
        labSendDate: formatDateForInput(orderItem.labData.labSendDate),
        approvalDate: formatDateForInput(orderItem.labData.approvalDate),
        sampleNumber: orderItem.labData.sampleNumber || '',
        color: orderItem.labData.color || '',
        shade: orderItem.labData.shade || '',
        notes: orderItem.labData.notes || '',
        labSendNumber: orderItem.labData.labSendNumber || '',
        status: orderItem.labData.status || 'sent',
        remarks: orderItem.labData.remarks || '',
      });
    } else {
      setEditItem(null);
      setFormData({
        labSendDate: new Date().toISOString().split('T')[0],
        approvalDate: '',
        sampleNumber: '',
        color: '',
        shade: '',
        notes: '',
        labSendNumber: '',
        status: 'sent',
        remarks: '',
      });
    }
    setActiveModal('lab');
  }, []);

  const handleLabPill = useCallback((order: Order) => {
    setSelectedOrder(order);
    if (!order.items || order.items.length === 0) {
      addToast({ type: 'error', title: 'This order has no items' });
      return;
    }
    if (order.items.length === 1) {
      openLabFormForItem(order.items[0], order.orderId, order._id!);
    } else {
      setLabItemSelectorOrder(order);
      setShowLabItemSelector(true);
    }
  }, [openLabFormForItem]);

  const handleViewLogs = useCallback((order: Order) => {
    setSelectedOrderForLogs(order);
    setShowLogsModal(true);
  }, []);

  const handleImagePreview = useCallback((images: string[], startIndex: number) => {
    setPreviewImages(images);
    setPreviewImageIndex(startIndex);
  }, []);

  const handleQuickAction = useCallback((order: Order, nextStatus: string) => {
    if (!order._id) return;
    statusMutation.mutate({ orderId: order._id, status: nextStatus });
  }, [statusMutation]);

  const handleDeleteOrder = useCallback((order: Order) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setDeleteOrderTarget(order);
  }, []);

  const [limit, setLimit] = useState(5);
  const lastLoadedLimitRef = React.useRef(5);

  const ordersQuery = useQuery({
    queryKey: ['orders', 1, limit, search, searchType, statusFilter, typeFilter, sortFilter, fyFilter, millFilter, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: 1,
        limit,
        sort: sortFilter,
      };

      const searchQuery = search.trim();
      if (searchQuery) {
        if (searchType !== 'all') {
          params.search = `${searchType}:${searchQuery}`;
        } else {
          params.search = searchQuery;
        }
      }

      if (statusFilter !== 'All') params.status = statusFilter;
      if (typeFilter !== 'All') params.orderType = typeFilter;
      if (fyFilter) params.fy = fyFilter;
      if (millFilter) params.millId = millFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;



      const { data } = await api.get('/api/orders', { params });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled: isAuthenticated,
    staleTime: 30000, // Cache for 30s to allow instant back-navigation
  });

  React.useEffect(() => {
    if (!ordersQuery?.isFetching) {
      lastLoadedLimitRef.current = limit;
    }
  }, [ordersQuery?.isFetching, limit]);

  // Reset limit to 5 when filters or search change
  React.useEffect(() => {
    setLimit(5);
    lastLoadedLimitRef.current = 5;
  }, [search, searchType, statusFilter, typeFilter, sortFilter, fyFilter, millFilter, startDate, endDate]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'pending') count++;
    if (typeFilter !== 'All') count++;
    if (sortFilter !== 'latest_first') count++;
    if (fyFilter !== '') count++;
    if (millFilter !== '') count++;
    if (startDate !== '') count++;
    if (endDate !== '') count++;
    return count;
  }, [statusFilter, typeFilter, sortFilter, fyFilter, millFilter, startDate, endDate]);

  const totalActiveFiltersCount = useMemo(() => {
    let count = activeFilterCount;
    if (search.trim() !== '') count++;
    return count;
  }, [activeFilterCount, search]);

  const clearAllFilters = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSearch('');
    setSearchVal('');
    setSearchType('all');
    setStatusFilter('pending');
    setTypeFilter('All');
    setSortFilter('latest_first');
    setFyFilter('');
    setMillFilter('');
    setStartDate('');
    setEndDate('');
  }, []);

  const orders = useMemo(() => {
    return ordersQuery.data?.data || [];
  }, [ordersQuery.data]);

  const currentSelectedOrder = useMemo(() => {
    return orders.find((o: any) => o._id === selectedOrder?._id) || selectedOrder;
  }, [orders, selectedOrder]);

  const totalOrdersCount = ordersQuery.data?.pagination?.total || 0;
  const totalPages = ordersQuery.data?.pagination?.pages || 1;

  // Separate refresh state — only true on explicit pull-to-refresh
  // NOT ordersQuery.isRefetching (that fires on pagination/focus too)
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const isPaging = ordersQuery.isFetching && limit > lastLoadedLimitRef.current;

  const handleRefresh = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    try {
      await Promise.all([
        ordersQuery.refetch(),
        unfilteredQuery.refetch()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [ordersQuery, unfilteredQuery]);

  const progress = useSharedValue(0);

  React.useEffect(() => {
    if (ordersQuery.isFetching && !isRefreshing && orders.length > 0 && !isPaging) {
      progress.value = 0;
      progress.value = withRepeat(
        withTiming(1, { duration: 750, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      progress.value = 0;
    }
  }, [ordersQuery.isFetching, isRefreshing, orders.length, isPaging]);

  const progressBarAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [-screenWidth * 0.3, screenWidth]);
    return {
      transform: [{ translateX }],
    };
  });

  const handleDeleteItem = useCallback((orderId: string, itemIndex: number) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setDeleteItemTarget({ orderId, itemIndex });
  }, []);

  const handleDownloadPDF = useCallback(async (orderId: string, itemIndex: number) => {
    if (!isMaster) {
      addToast({ type: 'error', title: 'Access Denied', message: 'Only master can download this PDF.' });
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const order = orders.find((o: any) => o._id === orderId);
    if (!order) return;

    if (Platform.OS === 'web') {
      // Web: show the old preview modal with iframe
      setPdfPreviewData({ order, itemIndex });
    } else {
      // Native: generate local HTML PDF for instant offline high-fidelity preview
      const sanitizedOrderId = (order.orderId || 'Order').replace(/[^a-zA-Z0-9-_]/g, '_');
      const filename = `Order_Sheet_${sanitizedOrderId}_Item_${itemIndex + 1}.pdf`;
      const title = `Order Sheet — ${getDisplayOrderId(order.orderId)} • Item ${itemIndex + 1}`;

      try {
        const html = generateOrderHtml(order, itemIndex);
        const { uri } = await generatePdfFromHtml(html, filename);

        setOrderPdfViewerUrl(uri);
        setOrderPdfViewerTitle(title);
        setOrderPdfViewerFilename(filename);
        setOrderPdfViewerVisible(true);
      } catch (err) {
        console.warn('[Orders] Local Order HTML generation failed, falling back to API URL:', err);
        const baseUrl = CONFIG.API_URL.endsWith('/') ? CONFIG.API_URL.slice(0, -1) : CONFIG.API_URL;
        const token = await storage.getToken();
        const pdfUrl = `${baseUrl}/api/orders/${order._id}/pdf?itemIndex=${itemIndex}${token ? `&token=${token}` : ''}`;

        setOrderPdfViewerUrl(pdfUrl);
        setOrderPdfViewerTitle(title);
        setOrderPdfViewerFilename(filename);
        setOrderPdfViewerVisible(true);
      }
    }
  }, [orders, isMaster, addToast]);

  const renderItem = useCallback(
    ({ item, index }: { item: Order; index: number }) => (
      <OrderCard
        item={item}
        index={index}
        onDeleteOrder={handleDeleteOrder}
        onStatusChange={handleStatusBadgePress}
        onGreyPill={handleGreyPill}
        onLabPill={handleLabPill}
        onMillInputPill={handleMillInputPill}
        onMillOutputPill={handleMillOutputPill}
        onDispatchPill={handleDispatchPill}
        onViewLogs={handleViewLogs}
        onImagePreview={handleImagePreview}
        onDeleteItem={handleDeleteItem}
        onDownloadPDF={handleDownloadPDF}
        loadingPill={loadingPill}
        qualities={qualities}
        numColumns={numColumns}
      />
    ),
    [handleDeleteOrder, handleStatusBadgePress, handleGreyPill, handleLabPill, handleMillInputPill, handleMillOutputPill, handleDispatchPill, handleViewLogs, handleImagePreview, handleDeleteItem, handleDownloadPDF, loadingPill, qualities, numColumns]
  );

  const keyExtractor = useCallback(
    (item: Order) => item._id || Math.random().toString(),
    []
  );

  const handleLoadMore = useCallback(() => {
    if (ordersQuery.isLoading) return;
    if (orders.length < limit) return; // Wait until current batch is fully loaded
    if (totalOrdersCount > limit) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLimit(prev => prev + 5);
    }
  }, [ordersQuery.isLoading, totalOrdersCount, limit, orders.length]);

  const renderPagination = (position: 'top' | 'bottom') => {
    const borderColor = isDarkMode ? '#334155' : '#e2e8f0';

    if (position === 'top') {
      const grandTotal = unfilteredQuery.data ?? totalOrdersCount;
      if (grandTotal === 0) return null;
      // Any filter active (status, search, type, etc.)
      const isFiltered = hasSubFilters || statusFilter !== 'All';
      return (
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          backgroundColor: theme.background,
          marginBottom: 12, // Gap/margin above the first card
        }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>
            {isFiltered ? (
              <Text>
                Showing <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{totalOrdersCount}</Text> of <Text style={{ fontWeight: '800', color: theme.text }}>{grandTotal}</Text>
              </Text>
            ) : (
              <Text>
                Total Orders: <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{grandTotal}</Text>
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
      );
    }

    // Bottom loading indicator / completion status
    if (isPaging && orders.length > 0 && orders.length < totalOrdersCount) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={Colors.primary[500]} />
        </View>
      );
    }

    if (orders.length >= totalOrdersCount && totalOrdersCount > 0) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
            No more orders to load
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={['top']}
    >
      <View style={{ flex: 1, width: '100%', maxWidth: containerMaxWidth, alignSelf: 'center' }}>
      {/* Unified Search & Filters Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingHorizontal: 16 }}>
        {/* Custom Search Bar with Search Type Dropdown */}
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
          borderRadius: 12,
          paddingLeft: 12,
          paddingRight: 8,
          height: 44,
          marginRight: 8,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}>
          {/* Dropdown Selector for Search Type */}
          <TouchableOpacity
            onPress={() => setShowSearchTypeModal(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingRight: 8,
              borderRightWidth: 1,
              borderRightColor: theme.borderLight,
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
            value={searchVal}
            onChangeText={(val) => {
              setSearchVal(val);
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => {
                setSearch(val);
              }, 500);
            }}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchVal.length > 0 ? (
            <TouchableOpacity onPress={() => { setSearchVal(''); setSearch(''); }} activeOpacity={0.6} style={{ padding: 4 }}>
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
            backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100],
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            borderWidth: 1,
            borderColor: activeFilterCount > 0
              ? (isDarkMode ? Colors.primary[500] : Colors.primary[600])
              : theme.borderLight,
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

      {/* Orders List */}
      {(!transitionsFinished || ordersQuery.isLoading || (ordersQuery.isFetching && orders.length === 0)) ? (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <OrdersProgressBar />
          <ScrollView showsVerticalScrollIndicator={false}>
            <OrderSkeletonList count={4} />
          </ScrollView>
        </View>
      ) : (ordersQuery.isError && orders.length === 0) ? (
        <EmptyState
          icon={<ClipboardList size={36} color={Colors.error[500]} />}
          title="Failed to Load Orders"
          subtitle={ordersQuery.error?.message || 'Something went wrong. Please check your connection.'}
          actionTitle="Retry"
          onAction={() => ordersQuery.refetch()}
        />
      ) : orders.length === 0 ? (
        <View style={{ flex: 1 }}>
          {renderPagination('top')}
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            refreshControl={
              Platform.OS !== 'web' ? (
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={Colors.primary[500]}
                  colors={[Colors.primary[500]]}
                />
              ) : undefined
            }
          >
            <EmptyState
              icon={<ClipboardList size={36} color={Colors.primary[500]} />}
              title="No Orders Found"
              subtitle="No orders match your current filters"
              actionTitle="Clear Filters"
              onAction={clearAllFilters}
            />
          </ScrollView>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Subtle top loading line when fetching in background */}
          {ordersQuery.isFetching && !isRefreshing && orders.length > 0 && !isPaging && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : 'rgba(37, 99, 235, 0.1)',
              zIndex: 1000,
              overflow: 'hidden'
            }}>
              <Animated.View style={[
                {
                  height: '100%',
                  width: '30%',
                  backgroundColor: isDarkMode ? Colors.primary[400] : Colors.primary[600],
                },
                progressBarAnimatedStyle
              ]} />
            </View>
          )}
          <FlashList
            key={numColumns}
            numColumns={numColumns}
            data={orders}
            extraData={ordersQuery.dataUpdatedAt}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            drawDistance={800}
            ListHeaderComponent={() => renderPagination('top')}
            ListFooterComponent={() => renderPagination('bottom')}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 65 + insets.bottom, paddingHorizontal: numColumns > 1 ? 6 : 0 }}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.8}
            removeClippedSubviews={false}
            refreshControl={
              Platform.OS !== 'web' ? (
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={Colors.primary[500]}
                  colors={[Colors.primary[500]]}
                />
              ) : undefined
            }
          />
        </View>
      )}

      {/* Draggable FAB */}
      {user?.role !== 'party' && (
        <RNAnimated.View
          {...panResponder.panHandlers}
          style={{
            left: pan.x,
            top: pan.y,
            position: 'absolute',
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              router.push('/orders/create');
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
              <ShoppingBag size={24} color="#ffffff" />
              <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary[600], borderRadius: 7, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
                <Plus size={9} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

      {/* Advanced Filter Bottom Sheet Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={closeFilterModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Clickable Backdrop */}
          <Pressable
            onPress={closeFilterModal}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />

          <RNAnimated.View
            onLayout={(e) => {
              filterSheetY.current = e.nativeEvent.layout.y;
            }}
            {...filterPanResponder.panHandlers}
            style={{
              backgroundColor: theme.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingBottom: isLargeScreen ? 24 : 0,
              paddingTop: 12,
              maxHeight: '90%',
              transform: [{ translateY: filterPanY }],
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
              {/* Modal Header Title */}
              <View style={{ marginBottom: 20, paddingRight: 120 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Filter Orders</Text>
              </View>
            </View>

            {/* Absolute Close/Reset Buttons Container */}
            <View style={{
              position: 'absolute',
              top: 34,
              right: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              zIndex: 10,
            }}>
              {(statusFilter !== 'pending' || typeFilter !== 'All' || sortFilter !== 'latest_first' || fyFilter !== '' || millFilter !== '' || startDate !== '' || endDate !== '') && (
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setStatusFilter('pending');
                    setTypeFilter('All');
                    setSortFilter('latest_first');
                    setFyFilter('');
                    setMillFilter('');
                    setStartDate('');
                    setEndDate('');
                  }}
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

            {/* Modal Content */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                filterScrollOffset.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {/* Sort Order Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort Order</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 }}>
                <FilterPill
                  label="Latest First"
                  selected={sortFilter === 'latest_first'}
                  onPress={() => setSortFilter('latest_first')}
                />
                <FilterPill
                  label="Oldest First"
                  selected={sortFilter === 'oldest_first'}
                  onPress={() => setSortFilter('oldest_first')}
                />
              </View>

              {/* Order Type Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Order Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 }}>
                {typeFilters.map((type) => (
                  <FilterPill
                    key={type}
                    label={type}
                    selected={typeFilter === type}
                    onPress={() => setTypeFilter(type)}
                  />
                ))}
              </View>

              {/* Status Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 }}>
                {statusFilters.map((status) => (
                  <FilterPill
                    key={status}
                    label={status}
                    selected={statusFilter === status}
                    onPress={() => setStatusFilter(status)}
                  />
                ))}
              </View>

              {/* Financial Year Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Financial Year</Text>
              <TouchableOpacity
                onPress={() => setShowFyModal(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginBottom: 18,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <Text style={{ fontSize: 14, color: theme.text, fontWeight: '500' }}>
                  {fyFilter === '' ? 'All Years' : fyList.find((opt: any) => opt.value === fyFilter)?.label || fyFilter}
                </Text>
                <ChevronDown size={16} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Mill Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mill</Text>
              <TouchableOpacity
                onPress={() => setShowMillModal(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginBottom: 18,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <Text style={{ fontSize: 14, color: theme.text, fontWeight: '500' }}>
                  {millFilter === '' ? 'All Mills' : millsList.find((m: any) => m._id === millFilter)?.name || 'Selected Mill'}
                </Text>
                <ChevronDown size={16} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Date Range Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date Range</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 }}>Start Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowStartDatePicker(true)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: 40,
                    }}
                  >
                    <Text numberOfLines={1} style={{
                      color: startDate ? theme.text : theme.textTertiary,
                      fontSize: 13,
                      flex: 1,
                    }}>
                      {startDate ? startDate : 'Select Date'}
                    </Text>
                    {startDate ? (
                      <TouchableOpacity onPress={(e) => { e.stopPropagation(); setStartDate(''); }}>
                        <X size={14} color={theme.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 }}>End Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowEndDatePicker(true)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      height: 40,
                    }}
                  >
                    <Text numberOfLines={1} style={{
                      color: endDate ? theme.text : theme.textTertiary,
                      fontSize: 13,
                      flex: 1,
                    }}>
                      {endDate ? endDate : 'Select Date'}
                    </Text>
                    {endDate ? (
                      <TouchableOpacity onPress={(e) => { e.stopPropagation(); setEndDate(''); }}>
                        <X size={14} color={theme.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Inline Quick Adds (Premium Card layout at bottom) */}
              {user?.role !== 'party' && (
                <View
                  style={{
                    marginTop: 16,
                    marginBottom: 8,
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.8)',
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary[500] }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quick Creation</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        closeFilterModal();
                        setTimeout(() => setShowCreatePartyModal(true), 300);
                      }}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : 'rgba(37, 99, 235, 0.15)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1,
                      }}
                    >
                      <User size={13} color={isDarkMode ? '#60a5fa' : '#2563eb'} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#60a5fa' : '#2563eb' }}>+ Party</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        closeFilterModal();
                        setTimeout(() => setShowCreateQualityModal(true), 300);
                      }}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(52, 211, 153, 0.2)' : 'rgba(5, 150, 105, 0.15)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1,
                      }}
                    >
                      <Tag size={13} color={isDarkMode ? '#34d399' : '#059669'} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#34d399' : '#059669' }}>+ Quality</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        closeFilterModal();
                        setTimeout(() => setShowCreateMillModal(true), 300);
                      }}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(217, 119, 6, 0.15)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1,
                      }}
                    >
                      <Layers size={13} color={isDarkMode ? '#fbbf24' : '#d97706'} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#fbbf24' : '#d97706' }}>+ Mill</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Apply Button */}
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
                marginTop: 16,
                marginBottom: insets.bottom > 0 ? insets.bottom + 8 : 16,
              }}
            >
              <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '700' }}>Apply Filters</Text>
            </TouchableOpacity>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Search Type Selection Modal */}
      <Modal
        visible={showSearchTypeModal}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={closeSearchTypeModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeSearchTypeModal}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: isDarkMode ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.15)',
            }}
          />
          <RNAnimated.View
            onLayout={(e) => {
              searchTypeSheetY.current = e.nativeEvent.layout.y;
            }}
            {...searchTypePanResponder.panHandlers}
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 16,
              paddingBottom: isLargeScreen ? 24 : (insets.bottom > 0 ? insets.bottom + 16 : 16),
              borderTopWidth: 1,
              borderTopColor: theme.borderLight,
              maxHeight: '60%',
              transform: [{ translateY: searchTypePanY }],
            }}
          >
            {/* Header Drag Zone */}
            <View style={{ width: '100%' }}>
              {/* Header indicator bar */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 16 }} />

              <View style={{ paddingHorizontal: 20, marginBottom: 16, paddingRight: 60 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Search Field</Text>
              </View>
            </View>

            {/* Close Button absolute */}
            <TouchableOpacity
              onPress={closeSearchTypeModal}
              style={{
                position: 'absolute',
                top: 32,
                right: 20,
                padding: 4,
                zIndex: 10,
              }}
            >
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <ScrollView 
              style={{ paddingHorizontal: 16 }} 
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                searchTypeScrollOffset.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {Object.keys(searchTypeFullLabels).map((key) => {
                const isSelected = searchType === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSearchType(key);
                      closeSearchTypeModal();
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      backgroundColor: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)') : 'transparent',
                      marginBottom: 4,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{
                        fontSize: 15,
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text,
                      }}>
                        {searchTypeFullLabels[key]}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 2 }}>
                        {searchTypePlaceholders[key]}
                      </Text>
                    </View>
                    {isSelected && <Check size={16} color={isDarkMode ? '#60a5fa' : '#2563eb'} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Financial Year Selection Modal */}
      <Modal
        visible={showFyModal}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={closeFyModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeFyModal}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />
          <RNAnimated.View
            onLayout={(e) => {
              fySheetY.current = e.nativeEvent.layout.y;
            }}
            {...fyPanResponder.panHandlers}
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 16,
              paddingBottom: isLargeScreen ? 24 : (insets.bottom > 0 ? insets.bottom + 8 : 12),
              borderTopWidth: 1,
              borderTopColor: theme.borderLight,
              maxHeight: '50%',
              transform: [{ translateY: fyPanY }],
            }}
          >
            {/* Header Drag Zone */}
            <View style={{ width: '100%' }}>
              {/* Header indicator bar */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 16 }} />

              <View style={{ paddingHorizontal: 20, marginBottom: 16, paddingRight: 60 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Select Financial Year</Text>
              </View>
            </View>

            {/* Close Button absolute */}
            <TouchableOpacity
              onPress={closeFyModal}
              style={{
                position: 'absolute',
                top: 32,
                right: 20,
                padding: 4,
                zIndex: 10,
              }}
            >
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <ScrollView 
              style={{ paddingHorizontal: 16 }} 
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                fyScrollOffset.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFyFilter('');
                  closeFyModal();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: fyFilter === '' ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)') : 'transparent',
                  marginBottom: 4,
                }}
              >
                <Text style={{
                  fontSize: 15,
                  fontWeight: fyFilter === '' ? '700' : '500',
                  color: fyFilter === '' ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text,
                }}>
                  All Years
                </Text>
                {fyFilter === '' && <Check size={16} color={isDarkMode ? '#60a5fa' : '#2563eb'} />}
              </TouchableOpacity>

              {fyList.map((option: any) => {
                const isSelected = fyFilter === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setFyFilter(option.value);
                      closeFyModal();
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      backgroundColor: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)') : 'transparent',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{
                      fontSize: 15,
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text,
                    }}>
                      {option.label}
                    </Text>
                    {isSelected && <Check size={16} color={isDarkMode ? '#60a5fa' : '#2563eb'} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Mill Selection Modal */}
      <Modal
        visible={showMillModal}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={closeMillModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeMillModal}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%' }}
          >
            <RNAnimated.View
              onLayout={(e) => {
                millSheetY.current = e.nativeEvent.layout.y;
              }}
              {...millPanResponder.panHandlers}
              style={{
                backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 16,
                paddingBottom: isLargeScreen ? 24 : (insets.bottom > 0 ? insets.bottom + 8 : 16),
                borderTopWidth: 1,
                borderTopColor: theme.borderLight,
                maxHeight: 500,
                transform: [{ translateY: millPanY }],
              }}
            >
              {/* Header Drag Zone */}
              <View style={{ width: '100%' }}>
                {/* Header indicator bar */}
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 16 }} />

                <View style={{ paddingHorizontal: 20, marginBottom: 16, paddingRight: 60 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Select Mill</Text>
                </View>
              </View>

              {/* Close Button absolute */}
              <TouchableOpacity
                onPress={closeMillModal}
                style={{
                  position: 'absolute',
                  top: 32,
                  right: 20,
                  padding: 4,
                  zIndex: 10,
                }}
              >
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Search Input inside Mill modal */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDarkMode ? Colors.neutral[900] : '#f1f5f9',
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 40,
                marginHorizontal: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}>
                <Search size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search mills..."
                  placeholderTextColor={theme.inputPlaceholder}
                  value={millSearchText}
                  onChangeText={setMillSearchText}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: theme.text,
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {millSearchText.length > 0 && (
                  <TouchableOpacity onPress={() => setMillSearchText('')}>
                    <X size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView 
                style={{ paddingHorizontal: 16 }} 
                showsVerticalScrollIndicator={false}
                onScroll={(event) => {
                  millScrollOffset.current = event.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMillFilter('');
                    setMillSearchText('');
                    closeMillModal();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: millFilter === '' ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)') : 'transparent',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: millFilter === '' ? '700' : '500',
                    color: millFilter === '' ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text,
                  }}>
                    All Mills
                  </Text>
                  {millFilter === '' && <Check size={16} color={isDarkMode ? '#60a5fa' : '#2563eb'} />}
                </TouchableOpacity>

                {filteredMillsForFilter.map((mill: any) => {
                  const isSelected = millFilter === mill._id;
                  return (
                    <View
                      key={mill._id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: 12,
                        backgroundColor: isSelected ? (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)') : 'transparent',
                        marginBottom: 4,
                        paddingRight: isMaster ? 8 : 0,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setMillFilter(mill._id);
                          setMillSearchText('');
                          closeMillModal();
                        }}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 14,
                          paddingHorizontal: 16,
                        }}
                      >
                        <Text style={{
                          fontSize: 15,
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected ? (isDarkMode ? '#60a5fa' : '#2563eb') : theme.text,
                        }}>
                          {mill.name}
                        </Text>
                        {isSelected && <Check size={16} color={isDarkMode ? '#60a5fa' : '#2563eb'} />}
                      </TouchableOpacity>

                      {isMaster && (
                        <TouchableOpacity
                          onPress={() => setDeleteMillTarget(mill)}
                          style={{ padding: 10, marginLeft: 4 }}
                        >
                          <Trash2 size={18} color={Colors.error[600]} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </RNAnimated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <DatePickerModal
        visible={showStartDatePicker}
        onClose={() => setShowStartDatePicker(false)}
        value={toDisplayDate(startDate)}
        onSelectDate={(displayDate) => setStartDate(toApiDate(displayDate))}
        title="Start Date"
      />

      <DatePickerModal
        visible={showEndDatePicker}
        onClose={() => setShowEndDatePicker(false)}
        value={toDisplayDate(endDate)}
        onSelectDate={(displayDate) => setEndDate(toApiDate(displayDate))}
        title="End Date"
      />



      {/* Separated Modals */}
      <GreyInformationModal
        visible={activeModal === 'grey'}
        onClose={() => { setActiveModal(null); setEditItem(null); }}
        order={currentSelectedOrder}
        greyInfo={greyInfo}
        qualities={qualities}
        isDarkMode={isDarkMode}
        theme={theme}
        onSave={(entries, deletedIds) => saveGreyMutation.mutate({ entries, deletedIds })}
        isSaving={saveGreyMutation.isPending}
        isMaster={isMaster}
        isLoading={loadingPill?.type === 'grey'}
        onDelete={greyInfo && greyInfo.length > 0 ? () => deleteGreyAllForOrderMutation.mutate() : undefined}
        isDeleting={deleteGreyAllForOrderMutation.isPending}
        isReadOnly={isParty}
      />

      <MillInputModal
        visible={activeModal === 'mill-input'}
        onClose={() => { setActiveModal(null); }}
        order={currentSelectedOrder}
        existingMillInputs={millInputsList}
        mills={millsList}
        qualities={qualities}
        isDarkMode={isDarkMode}
        theme={theme}
        onSave={(payload) => {
          saveMillInputMutation.mutate(payload);
        }}
        isSaving={saveMillInputMutation.isPending}
        onDelete={millInputsList && millInputsList.length > 0 ? () => deleteMillInputsForOrderMutation.mutate() : undefined}
        isMaster={isMaster}
        isLoading={loadingPill?.type === 'mill-input'}
        isDeleting={deleteMillInputsForOrderMutation.isPending}
        isReadOnly={isParty}
      />

      <MillOutputModal
        visible={activeModal === 'mill-output'}
        onClose={() => { setActiveModal(null); setEditItem(null); }}
        order={currentSelectedOrder}
        existingMillOutputs={millOutputsList}
        qualities={qualities}
        isDarkMode={isDarkMode}
        theme={theme}
        onSave={(payload) => {
          saveMillOutputMutation.mutate(payload);
        }}
        isSaving={saveMillOutputMutation.isPending}
        onDelete={millOutputsList && millOutputsList.length > 0 ? () => deleteMillOutputsForOrderMutation.mutate() : undefined}
        isLoading={loadingPill?.type === 'mill-output'}
        isMaster={isMaster}
        isDeleting={deleteMillOutputsForOrderMutation.isPending}
        isReadOnly={isParty}
      />

      <DispatchModal
        visible={activeModal === 'dispatch'}
        onClose={() => { setActiveModal(null); setEditItem(null); }}
        order={currentSelectedOrder}
        existingDispatches={dispatchesList}
        qualities={qualities}
        isDarkMode={isDarkMode}
        theme={theme}
        onSave={(payload) => {
          saveDispatchMutation.mutate(payload);
        }}
        isSaving={saveDispatchMutation.isPending}
        onDelete={dispatchesList && dispatchesList.length > 0 ? () => deleteDispatchMutation.mutate(undefined) : undefined}
        isMaster={isMaster}
        isLoading={loadingPill?.type === 'dispatch'}
        isDeleting={deleteDispatchMutation.isPending}
        isReadOnly={isParty}
      />

      <LabDataModal
        visible={activeModal === 'lab'}
        onClose={() => { setActiveModal(null); setEditItem(null); }}
        onBack={selectedOrder?.items && selectedOrder.items.length > 1 ? () => {
          setActiveModal(null);
          setEditItem(null);
          setShowLabItemSelector(true);
        } : undefined}
        order={currentSelectedOrder}
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
        onDelete={editItem && user?.role === 'master' ? () => deleteLabMutation.mutate({ dbOrderId: selectedDbOrderId!, itemId: selectedItemId! }) : undefined}
        isLoading={loadingPill?.type === 'lab'}
        isMaster={isMaster}
        isDeleting={deleteLabMutation.isPending}
        isReadOnly={isParty}
      />

      {/* Lab Item Selector Modal */}
      <Modal
        visible={showLabItemSelector}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={closeLabSelectorModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeLabSelectorModal}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />
          <RNAnimated.View
            onLayout={(e) => {
              labSelectorSheetY.current = e.nativeEvent.layout.y;
            }}
            {...labSelectorPanResponder.panHandlers}
            style={{
              backgroundColor: theme.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '75%',
              paddingBottom: isLargeScreen ? 24 : (insets.bottom > 0 ? insets.bottom + 12 : 20),
              transform: [{ translateY: labSelectorPanY }]
            }}
          >
            {/* Header Drag Zone */}
            <View style={{ width: '100%' }}>
                {/* Visual Drag Handle */}
                <View style={{ alignItems: 'center', paddingTop: 0, paddingBottom: 16 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#3a3a4a' : '#d1d5db' }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingRight: 40 }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Select Item for Lab Data</Text>
                    {currentSelectedOrder && (
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                        Order: {getDisplayOrderId(currentSelectedOrder.orderId)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Close Button absolute */}
              <TouchableOpacity
                onPress={closeLabSelectorModal}
                style={{
                  position: 'absolute',
                  top: 36,
                  right: 24,
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: isDarkMode ? '#2a2a38' : '#f3f4f6',
                  justifyContent: 'center', alignItems: 'center',
                  zIndex: 10,
                }}
              >
                <X size={16} color={isDarkMode ? '#8b8fa8' : '#6b7280'} />
              </TouchableOpacity>

              <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ paddingBottom: 24 }}
                onScroll={(event) => {
                  labSelectorScrollOffset.current = event.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
              >
                {currentSelectedOrder?.items?.map((item: any, index: number) => {
                  const qName = typeof item.quality === 'object' ? item.quality?.name : item.quality || 'N/A';
                  const hasLab = item.labData && item.labData.labSendDate;
                  const labSendDateFormatted = hasLab ? formatDate(item.labData.labSendDate) : '';
                  const approvalDateFormatted = item.labData?.approvalDate ? formatDate(item.labData.approvalDate) : '';
                  const sampleNumber = item.labData?.sampleNumber || '';

                  return (
                    <TouchableOpacity
                      key={item._id || index}
                      onPress={() => {
                        closeLabSelectorModal();
                        openLabFormForItem(item, currentSelectedOrder.orderId, currentSelectedOrder._id!);
                      }}
                      activeOpacity={0.7}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                        marginBottom: 12,
                        borderWidth: 1.5,
                        borderColor: hasLab ? (isDarkMode ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.2)') : theme.borderLight,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textTertiary, marginBottom: 4 }}>
                            Item {index + 1}
                          </Text>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                            {qName}
                          </Text>
                          <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
                            {item.quantity || 0} pcs
                          </Text>
                        </View>
                        <View style={{
                          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                          backgroundColor: hasLab ? 'rgba(139,92,246,0.12)' : (isDarkMode ? '#334155' : '#e2e8f0'),
                          alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: hasLab ? '#8b5cf6' : theme.textSecondary }}>
                            {hasLab ? '✓ Has Lab' : '+ Add Lab'}
                          </Text>
                        </View>
                      </View>

                      {hasLab && (
                        <View style={{
                          marginTop: 12,
                          padding: 12,
                          borderRadius: 10,
                          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                          borderLeftWidth: 3,
                          borderLeftColor: '#8b5cf6',
                          gap: 4
                        }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textTertiary }}>Lab Send Date:</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{labSendDateFormatted || '—'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textTertiary }}>Approval Date:</Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: approvalDateFormatted ? Colors.success[600] : '#f59e0b' }}>
                              {approvalDateFormatted ? approvalDateFormatted : 'Pending'}
                            </Text>
                          </View>
                          {sampleNumber ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textTertiary }}>Sample Number:</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{sampleNumber}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {currentSelectedOrder?.items?.some((item: any) => item.labData && item.labData.labSendDate) && user?.role === 'master' && (
                <TouchableOpacity
                  onPress={() => setDeleteLabAllTarget(true)}
                  activeOpacity={0.8}
                  style={{
                    height: 48,
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                    borderRadius: 12,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                  }}
                >
                  <Text style={{ color: Colors.error[600], fontSize: 14, fontWeight: '700' }}>
                    Delete All Lab Data
                  </Text>
                </TouchableOpacity>
              )}
            </RNAnimated.View>
        </View>
      </Modal>

      {/* Logs Viewer Modal */}
      <Modal
        visible={showLogsModal}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={closeLogsModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeLogsModal}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />
          <RNAnimated.View
            onLayout={(e) => {
              logsSheetY.current = e.nativeEvent.layout.y;
            }}
            {...logsPanResponder.panHandlers}
            style={{
              backgroundColor: theme.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              height: '70%',
              paddingBottom: isLargeScreen ? 24 : (insets.bottom > 0 ? insets.bottom + 12 : 20),
              transform: [{ translateY: logsPanY }]
            }}
          >
            {/* Header Drag Zone */}
            <View style={{ width: '100%' }}>
                {/* Visual Drag Handle */}
                <View style={{ alignItems: 'center', paddingTop: 0, paddingBottom: 16 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#3a3a4a' : '#d1d5db' }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingRight: 40 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Order Logs</Text>
                </View>
              </View>

              {/* Close Button absolute */}
              <TouchableOpacity
                onPress={closeLogsModal}
                style={{
                  position: 'absolute',
                  top: 36,
                  right: 24,
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: isDarkMode ? '#2a2a38' : '#f3f4f6',
                  justifyContent: 'center', alignItems: 'center',
                  zIndex: 10,
                }}
              >
                <X size={16} color={isDarkMode ? '#8b8fa8' : '#6b7280'} />
              </TouchableOpacity>

              {logsQuery.isLoading ? (
                <ActivityIndicator color={Colors.primary[600]} style={{ flex: 1 }} />
              ) : logsQuery.isError || !logsQuery.data || logsQuery.data.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <History size={32} color={theme.textTertiary} style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 14, color: theme.textSecondary }}>No logs recorded for this order</Text>
                </View>
              ) : (
                <FlashList
                  data={logsQuery.data}
                  keyExtractor={(log: any) => log._id || Math.random().toString()}
                  showsVerticalScrollIndicator={false}
                  onScroll={(event) => {
                    logsScrollOffset.current = event.nativeEvent.contentOffset.y;
                  }}
                  scrollEventThrottle={16}
                  renderItem={({ item: log }: any) => (
                    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderLight }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{log.username || 'System'}</Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary }}>{formatDate(log.timestamp)}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4 }}>
                        Role: {log.userRole?.toUpperCase() || 'USER'} | Action: {log.action || 'Unknown'}
                      </Text>
                      {log.details?.changeSummary ? (
                        <Text style={{ fontSize: 12, color: theme.text, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100], padding: 6, borderRadius: 6, marginTop: 4 }}>
                          {log.details.changeSummary}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />
              )}
            </RNAnimated.View>
        </View>
      </Modal>

      {/* PDF Preview Modal */}
      <Modal visible={pdfPreviewData !== null} animationType="fade" transparent statusBarTranslucent={true} onRequestClose={() => setPdfPreviewData(null)}>
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(15, 23, 42, 0.75)', // Rich slate dark overlay
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: winWidth > 768 ? 40 : 16 
        }}>
          <View style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', // Curated premium theme colors
            borderRadius: 24, // Soft premium corners
            padding: winWidth > 768 ? 28 : 20,
            width: '100%',
            maxWidth: winWidth > 768 ? 880 : 480, // High-fidelity responsive width
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDarkMode ? 0.4 : 0.15,
            shadowRadius: 30,
            elevation: 12,
          }}>
            {/* Modal Header */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottomWidth: 1, 
              borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', 
              paddingBottom: 16, 
              marginBottom: 20 
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
                }}>
                  <FileText size={22} color={isDarkMode ? '#60a5fa' : '#2563eb'} />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.4 }}>Purchase Order PDF</Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                    {pdfPreviewData && `Order ID: ${getDisplayOrderId(pdfPreviewData.order.orderId)} • Item ${pdfPreviewData.itemIndex + 1}`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setPdfPreviewData(null)} 
                activeOpacity={0.7}
                style={{ 
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {pdfPreviewData && (() => {
              const { order, itemIndex } = pdfPreviewData;
              const itemData = order.items?.[itemIndex];
              const qName = typeof itemData?.quality === 'object' ? itemData.quality?.name : itemData?.quality || 'N/A';
              const pName = getHighestPriorityProcess(
                order.millInputs,
                itemData?.quality,
                (itemData as any)?.processName || itemData?.processData?.mainProcess || 'N/A',
                qualities
              );
              const partyName = typeof order.party === 'object' ? (order.party as any)?.name : order.party || 'Not selected';
              const baseUrl = CONFIG.API_URL.endsWith('/') ? CONFIG.API_URL.slice(0, -1) : CONFIG.API_URL;
              // Appending open parameters to URL to hide browser's clunky PDF viewer toolbar and fit content cleanly
              const previewPdfUrl = `${baseUrl}/api/orders/${order._id}/pdf?itemIndex=${itemIndex}${pdfToken ? `&token=${pdfToken}` : ''}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

              return (
                <>
                  <View style={{
                    height: winWidth > 768 ? 600 : 460, // Responsive height for better reading on web
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    marginBottom: 24,
                    overflow: 'hidden',
                    backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: isDarkMode ? 0.2 : 0.05,
                    shadowRadius: 16,
                    elevation: 4,
                  }}>
                    {!pdfToken ? (
                      <ActivityIndicator size="large" color={Colors.primary[500]} />
                    ) : (
                      <PdfViewer url={previewPdfUrl} />
                    )}
                  </View>

                  <View style={{ 
                    flexDirection: 'row', 
                    gap: 12, 
                    alignItems: 'center' 
                  }}>
                    <TouchableOpacity
                      onPress={async () => {
                        setIsDownloadingPdf(true);
                        try {
                          const token = await storage.getToken();
                          const baseUrl = CONFIG.API_URL.endsWith('/')
                            ? CONFIG.API_URL.slice(0, -1)
                            : CONFIG.API_URL;
                          const pdfUrl = `${baseUrl}/api/orders/${order._id}/pdf?itemIndex=${itemIndex}${token ? `&token=${token}` : ''}`;

                          // Sanitize filename
                          const sanitizedOrderId = order.orderId.replace(/[^a-zA-Z0-9-_]/g, '_');
                          const filename = `Purchase_Order_${sanitizedOrderId}_Item_${itemIndex + 1}.pdf`;

                          if ((Platform.OS as string) === 'web') {
                            // Web: use savePdfToDevice which handles blob download
                            const result = await savePdfToDevice({ url: pdfUrl, filename, token });
                            setIsDownloadingPdf(false);
                            setPdfPreviewData(null);
                            addToast({
                              type: result.success ? 'success' : 'error',
                              title: result.success ? 'Downloaded Successfully 📥' : 'Error ❌',
                              message: result.message,
                            });
                            return;
                          }

                          // Native: Open the PDF Viewer Modal with Save & Share buttons
                          setIsDownloadingPdf(false);
                          setPdfPreviewData(null);
                          setOrderPdfViewerUrl(pdfUrl);
                          setOrderPdfViewerTitle(`Purchase Order — ${getDisplayOrderId(order.orderId)}`);
                          setOrderPdfViewerFilename(filename);
                          setOrderPdfViewerVisible(true);

                          if (Platform.OS === 'ios' || Platform.OS === 'android') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }
                        } catch (err: any) {
                          setIsDownloadingPdf(false);
                          console.error('Failed to download PDF:', err);
                          addToast({
                            type: 'error',
                            title: 'Error ❌',
                            message: 'Failed to download PDF. Please try again.',
                          });
                        }
                      }}
                      activeOpacity={0.8}
                      disabled={isDownloadingPdf}
                      style={{
                        flex: 1,
                        height: 48,
                        backgroundColor: Colors.primary[600],
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        shadowColor: Colors.primary[500],
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDarkMode ? 0.3 : 0.15,
                        shadowRadius: 10,
                        elevation: 4,
                      }}
                    >
                      {isDownloadingPdf ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <>
                          <Download size={18} color={Colors.white} />
                          <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.white }}>Download PDF</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      <ImagePreviewModal
        visible={previewImages.length > 0}
        images={previewImages}
        initialIndex={previewImageIndex}
        onClose={() => setPreviewImages([])}
      />

      {/* Update Status Modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={closeStatusModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={closeStatusModal}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.15)',
            }}
          />
          <RNAnimated.View
            onLayout={(e) => {
              statusSheetY.current = e.nativeEvent.layout.y;
            }}
            {...statusPanResponder.panHandlers}
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 16,
              paddingBottom: isLargeScreen ? 24 : (insets.bottom > 0 ? insets.bottom + 8 : 16),
              borderTopWidth: 1,
              borderTopColor: theme.borderLight,
              transform: [{ translateY: statusPanY }],
            }}
          >
            {/* Header Drag Zone */}
            <View style={{ width: '100%' }}>
              {/* Header indicator bar */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 16 }} />

              <View style={{ paddingHorizontal: 20, marginBottom: 12, paddingRight: 60 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Update Status</Text>
                {statusModalOrder && (
                  <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textSecondary, marginTop: 2 }}>
                    Order {getDisplayOrderId(statusModalOrder.orderId)}
                  </Text>
                )}
              </View>
            </View>

            {/* Close Button absolute */}
            <TouchableOpacity
              onPress={closeStatusModal}
              style={{
                position: 'absolute',
                top: 32,
                right: 20,
                padding: 4,
                zIndex: 10,
              }}
            >
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {statusModalOrder && (
              <View style={{ paddingHorizontal: 20, gap: 10, marginTop: 8 }}>
                {/* Pending Option */}
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    statusMutation.mutate({ orderId: statusModalOrder._id!, status: 'pending' });
                    closeStatusModal();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                    borderWidth: 1.5,
                    borderColor: statusModalOrder.status === 'pending'
                      ? (isDarkMode ? '#3b82f6' : Colors.primary[600])
                      : (isDarkMode ? '#334155' : '#e2e8f0'),
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: isDarkMode ? 'rgba(234, 179, 8, 0.15)' : '#fef9c3',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Clock size={18} color="#ca8a04" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Pending</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>Order is in progress</Text>
                    </View>
                  </View>
                  {statusModalOrder.status === 'pending' && (
                    <Check size={20} color={isDarkMode ? '#60a5fa' : Colors.primary[600]} />
                  )}
                </TouchableOpacity>

                {/* Delivered Option */}
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    statusMutation.mutate({ orderId: statusModalOrder._id!, status: 'delivered' });
                    closeStatusModal();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                    borderWidth: 1.5,
                    borderColor: statusModalOrder.status === 'delivered'
                      ? (isDarkMode ? '#10b981' : '#059669')
                      : (isDarkMode ? '#334155' : '#e2e8f0'),
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Check size={18} color="#059669" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Delivered</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>Order has been delivered</Text>
                    </View>
                  </View>
                  {statusModalOrder.status === 'delivered' && (
                    <Check size={20} color={isDarkMode ? '#34d399' : '#059669'} />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Global Mutation Loading Overlay */}
      {(statusMutation.isPending || deleteOrderMutation.isPending || deleteItemMutation.isPending || isDownloadingPdf) && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.15)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
        }}>
          <View style={{
            backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
            padding: 24,
            borderRadius: 16,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 8,
            borderWidth: 1,
            borderColor: isDarkMode ? '#334155' : '#e2e8f0',
            minWidth: 180,
          }}>
            <ActivityIndicator size="large" color={Colors.primary[500]} />
            <Text style={{
              marginTop: 16,
              fontSize: 14,
              fontWeight: '700',
              color: theme.text,
              textAlign: 'center',
            }}>
              {deleteOrderMutation.isPending
                ? 'Deleting Order...'
                : deleteItemMutation.isPending
                ? 'Deleting Item...'
                : isDownloadingPdf
                ? 'Preparing PDF Document...'
                : 'Updating Status...'}
            </Text>
          </View>
        </View>
      )}
      <DeleteConfirmModal
        visible={deleteOrderTarget !== null}
        onClose={() => setDeleteOrderTarget(null)}
        onConfirm={() => {
          if (deleteOrderTarget?._id) {
            deleteOrderMutation.mutate(deleteOrderTarget._id);
          }
        }}
        title="Delete Order 🗑️"
        message="Are you sure you want to delete this order? This action cannot be undone."
        confirmText="Delete"
        isDeleting={deleteOrderMutation.isPending}
      />

      <DeleteConfirmModal
        visible={deleteItemTarget !== null}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={() => {
          if (deleteItemTarget) {
            deleteItemMutation.mutate(deleteItemTarget);
          }
        }}
        title="Delete Item 🗑️"
        message="Are you sure you want to delete this item from the order? This action cannot be undone."
        confirmText="Delete"
        isDeleting={deleteItemMutation.isPending}
      />

      <DeleteConfirmModal
        visible={deleteLabAllTarget}
        onClose={() => setDeleteLabAllTarget(false)}
        onConfirm={() => {
          if (currentSelectedOrder?._id) {
            deleteLabsAllForOrderMutation.mutate(currentSelectedOrder._id);
          }
        }}
        title="Delete All Lab Data"
        message="Are you sure you want to delete all lab data for this order? This action cannot be undone."
        confirmText="Delete All"
        isDeleting={deleteLabsAllForOrderMutation.isPending}
      />

      <DeleteConfirmModal
        visible={deleteMillTarget !== null}
        onClose={() => setDeleteMillTarget(null)}
        onConfirm={() => {
          if (deleteMillTarget?._id) {
            deleteMillMutation.mutate(deleteMillTarget._id);
          }
        }}
        title="Delete Mill"
        message={`Are you sure you want to delete "${deleteMillTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        isDeleting={deleteMillMutation.isPending}
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

      {/* PDF Viewer Modal with Save & Share */}
      <PdfViewerModal
        visible={orderPdfViewerVisible}
        onClose={() => setOrderPdfViewerVisible(false)}
        pdfUrl={orderPdfViewerUrl}
        title={orderPdfViewerTitle}
        filename={orderPdfViewerFilename}
        addToast={addToast}
      />


      {/* Create Party Modal */}
      <Modal
        visible={showCreatePartyModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!createPartyMutation.isPending) setShowCreatePartyModal(false);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => {
            if (!createPartyMutation.isPending) setShowCreatePartyModal(false);
          }}
        >
          <Pressable
            style={{
              width: '90%',
              maxWidth: 340,
              borderRadius: 20,
              borderWidth: 1,
              padding: 24,
              backgroundColor: theme.card,
              borderColor: theme.border,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <TouchableOpacity
              onPress={() => setShowCreatePartyModal(false)}
              disabled={createPartyMutation.isPending}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                padding: 4,
                zIndex: 10,
              }}
            >
              <X size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                  backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                }}
              >
                <User size={24} color={isDarkMode ? '#60a5fa' : '#2563eb'} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                Add New Party
              </Text>
            </View>

            <TextInput
              placeholder="Enter party name..."
              placeholderTextColor={theme.textTertiary}
              value={newPartyName}
              onChangeText={setNewPartyName}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                borderWidth: 1.5,
                borderColor: theme.borderLight,
                paddingHorizontal: 14,
                fontSize: 14,
                color: theme.text,
                marginBottom: 20,
              }}
              autoFocus
              editable={!createPartyMutation.isPending}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? '#2a2a38' : '#f3f4f6',
                  opacity: createPartyMutation.isPending ? 0.5 : 1,
                }}
                onPress={() => {
                  setShowCreatePartyModal(false);
                  setNewPartyName('');
                }}
                disabled={createPartyMutation.isPending}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? Colors.primary[700] : Colors.primary[600],
                  opacity: createPartyMutation.isPending ? 0.7 : 1,
                }}
                onPress={() => {
                  if (!newPartyName.trim()) {
                    Alert.alert('Error', 'Please enter a party name.');
                    return;
                  }
                  createPartyMutation.mutate(newPartyName.trim());
                }}
                disabled={createPartyMutation.isPending}
              >
                {createPartyMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create Quality Modal */}
      <Modal
        visible={showCreateQualityModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!createQualityMutation.isPending) setShowCreateQualityModal(false);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => {
            if (!createQualityMutation.isPending) setShowCreateQualityModal(false);
          }}
        >
          <Pressable
            style={{
              width: '90%',
              maxWidth: 340,
              borderRadius: 20,
              borderWidth: 1,
              padding: 24,
              backgroundColor: theme.card,
              borderColor: theme.border,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <TouchableOpacity
              onPress={() => setShowCreateQualityModal(false)}
              disabled={createQualityMutation.isPending}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                padding: 4,
                zIndex: 10,
              }}
            >
              <X size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                  backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#effaf3',
                }}
              >
                <Tag size={24} color={isDarkMode ? '#34d399' : '#059669'} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                Add New Quality
              </Text>
            </View>

            <TextInput
              placeholder="Enter quality name..."
              placeholderTextColor={theme.textTertiary}
              value={newQualityName}
              onChangeText={setNewQualityName}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                borderWidth: 1.5,
                borderColor: theme.borderLight,
                paddingHorizontal: 14,
                fontSize: 14,
                color: theme.text,
                marginBottom: 20,
              }}
              autoFocus
              editable={!createQualityMutation.isPending}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? '#2a2a38' : '#f3f4f6',
                  opacity: createQualityMutation.isPending ? 0.5 : 1,
                }}
                onPress={() => {
                  setShowCreateQualityModal(false);
                  setNewQualityName('');
                }}
                disabled={createQualityMutation.isPending}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? Colors.primary[700] : Colors.primary[600],
                  opacity: createQualityMutation.isPending ? 0.7 : 1,
                }}
                onPress={() => {
                  if (!newQualityName.trim()) {
                    Alert.alert('Error', 'Please enter a quality name.');
                    return;
                  }
                  createQualityMutation.mutate(newQualityName.trim());
                }}
                disabled={createQualityMutation.isPending}
              >
                {createQualityMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create Mill Modal */}
      <Modal
        visible={showCreateMillModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!createMillMutation.isPending) setShowCreateMillModal(false);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => {
            if (!createMillMutation.isPending) setShowCreateMillModal(false);
          }}
        >
          <Pressable
            style={{
              width: '90%',
              maxWidth: 340,
              borderRadius: 20,
              borderWidth: 1,
              padding: 24,
              backgroundColor: theme.card,
              borderColor: theme.border,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <TouchableOpacity
              onPress={() => setShowCreateMillModal(false)}
              disabled={createMillMutation.isPending}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                padding: 4,
                zIndex: 10,
              }}
            >
              <X size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
                }}
              >
                <Layers size={24} color={isDarkMode ? '#fbbf24' : '#d97706'} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                Add New Mill Name
              </Text>
            </View>

            <TextInput
              placeholder="Enter mill name..."
              placeholderTextColor={theme.textTertiary}
              value={newMillName}
              onChangeText={setNewMillName}
              style={{
                height: 48,
                borderRadius: 12,
                backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[50],
                borderWidth: 1.5,
                borderColor: theme.borderLight,
                paddingHorizontal: 14,
                fontSize: 14,
                color: theme.text,
                marginBottom: 20,
              }}
              autoFocus
              editable={!createMillMutation.isPending}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? '#2a2a38' : '#f3f4f6',
                  opacity: createMillMutation.isPending ? 0.5 : 1,
                }}
                onPress={() => {
                  setShowCreateMillModal(false);
                  setNewMillName('');
                }}
                disabled={createMillMutation.isPending}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkMode ? Colors.primary[700] : Colors.primary[600],
                  opacity: createMillMutation.isPending ? 0.7 : 1,
                }}
                onPress={() => {
                  if (!newMillName.trim()) {
                    Alert.alert('Error', 'Please enter a mill name.');
                    return;
                  }
                  createMillMutation.mutate(newMillName.trim());
                }}
                disabled={createMillMutation.isPending}
              >
                {createMillMutation.isPending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      </View>
    </SafeAreaView>
  );
}
