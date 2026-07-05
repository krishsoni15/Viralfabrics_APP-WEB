import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
  PanResponder,
  Animated as RNAnimated,
  Dimensions,
  KeyboardAvoidingView,
  Pressable,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import * as print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ClipboardList,
  SlidersHorizontal,
  Search,
  X,
  FileText,
  Trash2,
  CalendarDays,
  Edit2,
  Building2,
  User,
  Phone,
  Truck,
  Check,
  ChevronDown,
  RotateCcw,
  Info,
  Eye,
  FileDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import api from '../../services/api';
import Card from '../../components/ui/Card';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import DatePickerModal from '../../components/shared/DatePickerModal';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';
import { formatDate, getCalculatedFYOptions, getDisplayOrderId } from '../../utils/helpers';
import { PurchaseOrder } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { generatePoHtml } from '../../utils/poPdfTemplate';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Date conversion helpers for DatePickerModal
const toDisplayDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
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

const toIsoDate = (displayDateStr?: string) => {
  if (!displayDateStr) return '';
  const parts = displayDateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day).toISOString();
  }
  return '';
};

// ─── Component Helpers ───

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



const sortFilterLabels: Record<string, string> = {
  latest_first: 'Latest',
  oldest_first: 'Oldest',
  po_number_asc: 'PO Number Asc',
  po_number_desc: 'PO Number Desc',
};

const companyLabels: Record<string, string> = {
  '': 'All Companies',
  'Viral Fabrics': 'Viral Fabrics',
  'Viral Enterprise': 'Viral Enterprise',
};

const PurchaseOrderCard = ({ 
  item, 
  index, 
  isMaster, 
  theme, 
  isDarkMode, 
  openModal, 
  handleDelete, 
  generatePDF, 
  previewPDF 
}: { 
  item: PurchaseOrder; 
  index: number; 
  isMaster: boolean; 
  theme: any; 
  isDarkMode: boolean; 
  openModal: (po: PurchaseOrder) => void; 
  handleDelete: (id: string) => void; 
  generatePDF: (po: PurchaseOrder) => void; 
  previewPDF: (po: PurchaseOrder) => void; 
}) => {
  const [isAddressExpanded, setIsAddressExpanded] = useState(false);
  const [isPaymentTermsExpanded, setIsPaymentTermsExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  const badgeStyles = item.companyHeader === 'Viral Fabrics' 
    ? {
        bg: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
        border: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe',
        text: isDarkMode ? '#93c5fd' : '#2563eb',
        label: 'Viral Fabrics'
      }
    : {
        bg: isDarkMode ? 'rgba(168, 85, 247, 0.15)' : '#faf5ff',
        border: isDarkMode ? 'rgba(168, 85, 247, 0.3)' : '#e9d5ff',
        text: isDarkMode ? '#d8b4fe' : '#9333ea',
        label: 'Viral Enterprise'
      };

  return (
    <Animated.View entering={FadeInDown.duration(300).delay((index % 5) * 60)}>
      <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 16 }}>
        {/* Top Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary[600], letterSpacing: -0.5 }}>
              #{getDisplayOrderId(item.poNumber)}
            </Text>
            <View style={{ 
              backgroundColor: badgeStyles.bg, 
              paddingHorizontal: 8, 
              paddingVertical: 3, 
              borderRadius: 12, 
              borderWidth: 1, 
              borderColor: badgeStyles.border 
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: badgeStyles.text }}>
                {badgeStyles.label}
              </Text>
            </View>
          </View>

          {/* Action Icons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => previewPDF(item)} style={{ padding: 4 }}>
              <Eye size={16} color={Colors.primary[500]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => generatePDF(item)} style={{ padding: 4 }}>
              <FileDown size={16} color={Colors.success[600]} />
            </TouchableOpacity>
            {isMaster && (
              <TouchableOpacity onPress={() => openModal(item)} style={{ padding: 4 }}>
                <Edit2 size={16} color="#fbbf24" />
              </TouchableOpacity>
            )}
            {isMaster && (
              <TouchableOpacity onPress={() => handleDelete(item._id)} style={{ padding: 4 }}>
                <Trash2 size={16} color={Colors.error[600]} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Date Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          <CalendarDays size={13} color={theme.textSecondary} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
            {formatDate(item.poDate)}
          </Text>
        </View>

        {/* Broker Row */}
        {item.brokerName && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>Broker:</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>
              {item.brokerName} {item.brokerPhone ? `(${item.brokerPhone})` : ''}
            </Text>
          </View>
        )}

        <View style={{ height: 1, backgroundColor: theme.borderLight, marginVertical: 8 }} />

        {/* Supplier Section */}
        {item.supplierName && (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: theme.textSecondary, marginBottom: 4 }}>
              SUPPLIER DETAILS
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>
              {item.supplierName}
            </Text>
            {item.supplierAddress && (
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setIsAddressExpanded(!isAddressExpanded)}
                style={isAddressExpanded ? {
                  backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9',
                  padding: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  marginTop: 4
                } : { marginTop: 2 }}
              >
                <Text 
                  numberOfLines={isAddressExpanded ? undefined : 1}
                  style={{ 
                    fontSize: 12, 
                    color: isAddressExpanded ? (isDarkMode ? '#93c5fd' : '#1e293b') : theme.textSecondary,
                    fontWeight: isAddressExpanded ? '600' : '400',
                    lineHeight: 16
                  }}
                >
                  {item.supplierAddress}
                </Text>
              </TouchableOpacity>
            )}
            {item.supplierGstin && (
              <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: theme.textTertiary, marginTop: 4 }}>
                GSTIN: {item.supplierGstin}
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 1, backgroundColor: theme.borderLight, marginVertical: 8 }} />

        {/* Quality & Delivery */}
        {item.quality && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>Quality & Delivery:</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
              {item.quality} {item.pcsMtr ? `(${item.pcsMtr} Pcs/Mtr)` : ''}
            </Text>
          </View>
        )}

        {/* Rate & Terms */}
        {item.rate && (
          <View style={{ marginTop: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>Rate & Terms:</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#10b981' }}>
                ₹ {item.rate}
              </Text>
            </View>
            {item.paymentTerms && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsPaymentTermsExpanded(!isPaymentTermsExpanded)}
                style={isPaymentTermsExpanded ? {
                  backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9',
                  padding: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  marginTop: 4
                } : { marginTop: 2, alignItems: 'flex-end' }}
              >
                <Text 
                  numberOfLines={isPaymentTermsExpanded ? undefined : 1}
                  style={{ 
                    fontSize: 11, 
                    color: isPaymentTermsExpanded ? (isDarkMode ? '#93c5fd' : '#1e293b') : theme.textSecondary,
                    fontWeight: isPaymentTermsExpanded ? '600' : '400',
                    textAlign: isPaymentTermsExpanded ? 'left' : 'right'
                  }}
                >
                  {item.paymentTerms}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Specs Grid */}
        {(item.specs?.finishGsm || item.specs?.greyWidth || item.specs?.finishWidth || item.specs?.weight) && (
          <View style={{ marginTop: 10 }}>
            <View style={{ height: 1, backgroundColor: theme.borderLight, marginBottom: 8 }} />
            <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: theme.textSecondary, marginBottom: 6 }}>
              SPECIFICATIONS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[
                { label: 'GSM', val: item.specs?.finishGsm },
                { label: 'Grey W', val: item.specs?.greyWidth },
                { label: 'Finish W', val: item.specs?.finishWidth },
                { label: 'Weight', val: item.specs?.weight }
              ].filter(s => s.val).map((spec, i) => (
                <View 
                  key={i} 
                  style={{ 
                    width: '48%', 
                    padding: 8, 
                    borderRadius: 8, 
                    borderWidth: 1, 
                    borderColor: isDarkMode ? '#475569' : '#cbd5e1', 
                    backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.6)' : '#f1f5f9' 
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.text }}>
                    {spec.label}: {spec.val}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        {item.notes && (
          <View style={{ marginTop: 10 }}>
            <View style={{ height: 1, backgroundColor: theme.borderLight, marginBottom: 8 }} />
            <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: theme.textSecondary, marginBottom: 4 }}>
              Notes:
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsNotesExpanded(!isNotesExpanded)}
              style={isNotesExpanded ? {
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9',
                padding: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.borderLight,
                marginTop: 2
              } : { marginTop: 2 }}
            >
              <Text 
                numberOfLines={isNotesExpanded ? undefined : 1}
                style={{ 
                  fontSize: 11, 
                  color: isNotesExpanded ? (isDarkMode ? '#93c5fd' : '#1e293b') : theme.textSecondary,
                  fontWeight: isNotesExpanded ? '600' : '400',
                  lineHeight: 16
                }}
              >
                {item.notes ? item.notes.replace(/<[^>]+>/g, '') : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </Animated.View>
  );
};

// ─── Purchase Orders Tab ───

export default function PurchaseOrdersScreen() {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const addToast = useAppStore((state) => state.addToast);
  
  const isMaster = user?.role === 'master' || user?.role === 'superadmin';

  // State: List & Filters
  const [page, setPage] = useState(1);
  const [searchVal, setSearchVal] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [companyHeader, setCompanyHeader] = useState('');
  const [fyFilter, setFyFilter] = useState('');
  const [sortFilter, setSortFilter] = useState('latest_first');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const fyOptions = useMemo(() => getCalculatedFYOptions(), []);

  // Draggable FAB setup
  const fabPan = useRef(new RNAnimated.ValueXY({ 
    x: screenWidth - 68, 
    y: screenHeight - 110 - (insets.bottom > 0 ? insets.bottom : 16) 
  })).current;
  
  const fabPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        fabPan.setOffset({
          x: (fabPan.x as any)._value || 0,
          y: (fabPan.y as any)._value || 0,
        });
        fabPan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: RNAnimated.event(
        [null, { dx: fabPan.x, dy: fabPan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (e, gestureState) => {
        fabPan.flattenOffset();

        const currentX = (fabPan.x as any)._value;
        const currentY = (fabPan.y as any)._value;

        const snapLeftX = 20;
        const snapRightX = screenWidth - 68;
        const targetX = currentX < screenWidth / 2 ? snapLeftX : snapRightX;

        const minY = 100;
        const maxY = screenHeight - 110 - (insets.bottom > 0 ? insets.bottom : 16);
        const targetY = Math.min(Math.max(currentY, minY), maxY);

        RNAnimated.spring(fabPan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 6,
        }).start();
      },
    })
  ).current;

  // Swipe down to close Filter Modal
  const filterScrollOffset = useRef(0);
  const filterPanY = useRef(new RNAnimated.Value(600)).current;

  const closeFilterModal = useCallback(() => {
    RNAnimated.timing(filterPanY, {
      toValue: 600,
      duration: 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setShowFilterModal(false);
    });
  }, [filterPanY]);

  const filterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          filterPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 40 || gestureState.vy > 0.2) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          closeFilterModal();
        } else {
          RNAnimated.spring(filterPanY, {
            toValue: 0,
            useNativeDriver: Platform.OS !== 'web',
            friction: 7,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (showFilterModal) {
      filterPanY.setValue(600);
      RNAnimated.spring(filterPanY, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        damping: 15,
        stiffness: 120,
      }).start();
    }
  }, [showFilterModal]);





  // State: Modals & Forms
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    companyHeader: 'Viral Fabrics',
    poDate: new Date().toISOString(),
    specs: { finishGsm: '', greyWidth: '', finishWidth: '', weight: '' }
  });
  const [nextPoDetails, setNextPoDetails] = useState<{ poNumber: string; sequence: number; financialYear: string } | null>(null);
  
  // State: Deletion
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // State: Date Picker
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // State: Suggestions Autocomplete
  const [brokerSuggestions, setBrokerSuggestions] = useState<any[]>([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState<any[]>([]);
  const [showBrokerSuggestions, setShowBrokerSuggestions] = useState(false);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  // Selection state for textareas
  const [termsSel, setTermsSel] = useState({ start: 0, end: 0 });
  const [notesSel, setNotesSel] = useState({ start: 0, end: 0 });

  // Debounce search
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchVal);
      setPage(1);
    }, 500);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchVal]);

  // Fetch Suggestions
  const fetchSuggestions = async (q: string) => {
    try {
      const res = await api.get(`/api/purchase-orders/suggestions?q=${encodeURIComponent(q)}`);
      if (res.data?.success) {
        setBrokerSuggestions(res.data.data.brokers || []);
        setSupplierSuggestions(res.data.data.suppliers || []);
      }
    } catch (error) {
      console.log('Error fetching suggestions', error);
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchSuggestions('');
    }
  }, [isModalOpen]);



  // Fetch PO List
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['purchaseOrders', page, debouncedSearch, companyHeader, fyFilter, sortFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort: sortFilter,
      });

      const queryTerm = debouncedSearch.trim();
      if (queryTerm) {
        params.append('search', queryTerm);
      }

      if (companyHeader) params.append('companyHeader', companyHeader);
      if (fyFilter) params.append('fy', fyFilter);

      const res = await api.get(`/api/purchase-orders?${params.toString()}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const orders: PurchaseOrder[] = data?.data || [];
  const pagination = data?.pagination || { totalPages: 1, hasNext: false };

  // Fetch Next PO Number
  const fetchNextNumber = async (company: string, date: string) => {
    try {
      const params = new URLSearchParams({ companyHeader: company });
      if (date) params.append('poDate', date);
      const res = await api.get(`/api/purchase-orders/next-number?${params.toString()}`);
      if (res.data?.success) {
        setNextPoDetails(res.data.data);
      }
    } catch (err) {
      console.log('Error fetching next PO number', err);
    }
  };

  useEffect(() => {
    if (isModalOpen && !isEditMode && formData.companyHeader) {
      fetchNextNumber(formData.companyHeader, formData.poDate || new Date().toISOString());
    }
  }, [isModalOpen, isEditMode, formData.companyHeader, formData.poDate]);

  // Active filters calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (companyHeader !== '') count++;
    if (fyFilter !== '') count++;
    if (sortFilter !== 'latest_first') count++;
    return count;
  }, [companyHeader, fyFilter, sortFilter]);

  const totalActiveFiltersCount = useMemo(() => {
    let count = activeFilterCount;
    if (debouncedSearch.trim() !== '') count++;
    return count;
  }, [activeFilterCount, debouncedSearch]);

  const clearAllFilters = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setCompanyHeader('');
    setFyFilter('');
    setSortFilter('latest_first');
    setSearchVal('');
    setDebouncedSearch('');
  }, []);

  // Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPage(1);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    setIsRefreshing(false);
  }, [queryClient]);

  const loadMore = () => {
    if (pagination.hasNext && !isFetching) {
      setPage((p) => p + 1);
    }
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newPo: any) => api.post('/api/purchase-orders', newPo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      addToast({ type: 'success', title: 'PO Created', message: 'Purchase order created successfully.' });
      closeModal();
    },
    onError: (error: any) => {
      addToast({ type: 'error', title: 'Error', message: error.response?.data?.message || 'Failed to create PO.' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => api.put(`/api/purchase-orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      addToast({ type: 'success', title: 'PO Updated', message: 'Purchase order updated successfully.' });
      closeModal();
    },
    onError: (error: any) => {
      addToast({ type: 'error', title: 'Error', message: error.response?.data?.message || 'Failed to update PO.' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/purchase-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      addToast({ type: 'success', title: 'PO Deleted', message: 'Purchase order deleted successfully.' });
      setIsDeleteModalOpen(false);
      setDeleteId(null);
    },
    onError: (error: any) => {
      addToast({ type: 'error', title: 'Error', message: error.response?.data?.message || 'Failed to delete PO.' });
      setIsDeleteModalOpen(false);
    }
  });

  // Modal Handling
  const sheetTranslateY = useSharedValue(screenHeight);

  const openModal = (order?: PurchaseOrder) => {
    if (order) {
      setIsEditMode(true);
      setEditId(order._id);
      setFormData({
        ...order,
        specs: order.specs || { finishGsm: '', greyWidth: '', finishWidth: '', weight: '' }
      });
      setNextPoDetails(null);
    } else {
      setIsEditMode(false);
      setEditId(null);
      setFormData({
        companyHeader: 'Viral Fabrics',
        poDate: new Date().toISOString(),
        specs: { finishGsm: '', greyWidth: '', finishWidth: '', weight: '' }
      });
    }
    
    setIsModalOpen(true);
    sheetTranslateY.value = screenHeight;
    sheetTranslateY.value = withSpring(0, { damping: 25, stiffness: 250, mass: 0.8 });
  };

  const closeModal = (velocity = 0) => {
    const handleFinished = () => {
      setIsModalOpen(false);
    };

    if (velocity > 0) {
      sheetTranslateY.value = withSpring(
        screenHeight,
        { damping: 30, stiffness: 280, mass: 0.8, velocity },
        (isFinished) => { if (isFinished) { import('react-native-reanimated').then(rea => rea.runOnJS(handleFinished)()); } }
      );
    } else {
      sheetTranslateY.value = withSpring(
        screenHeight,
        { damping: 28, stiffness: 300, mass: 0.8 },
        (isFinished) => { if (isFinished) { import('react-native-reanimated').then(rea => rea.runOnJS(handleFinished)()); } }
      );
    }
  };

  const animatedSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: sheetTranslateY.value }]
    };
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 15 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          sheetTranslateY.value = g.dy;
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.3) {
          closeModal(g.vy * 1000);
        } else {
          sheetTranslateY.value = withSpring(0, { damping: 25, stiffness: 280, mass: 0.8 });
        }
      },
    })
  ).current;

  // Handlers
  const handleSave = () => {
    if (!formData.companyHeader || !formData.poDate || !formData.quality) {
      addToast({ type: 'error', title: 'Validation Error', message: 'Company, Date, and Quality are required.' });
      return;
    }
    if (isEditMode && editId) {
      updateMutation.mutate({ id: editId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const previewPDF = async (po: PurchaseOrder) => {
    try {
      const html = generatePoHtml(po);
      await print.printAsync({ html });
    } catch (err) {
      console.log('Error printing PDF:', err);
      addToast({ type: 'error', title: 'PDF Preview Error', message: 'Failed to open preview.' });
    }
  };
  
  const generatePDF = async (po: PurchaseOrder) => {
    try {
      const html = generatePoHtml(po);
      const displayId = getDisplayOrderId(po.poNumber);
      
      const { uri } = await print.printToFileAsync({ 
        html,
        base64: false
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Purchase Order ${displayId}`,
          UTI: 'com.adobe.pdf'
        });
      } else {
        addToast({ type: 'warning', title: 'Sharing Unavailable', message: 'Could not open sharing dialog on this device.' });
      }
    } catch (err) {
      console.log('Error generating PDF:', err);
      addToast({ type: 'error', title: 'PDF Error', message: 'Failed to generate PDF.' });
    }
  };

  // Form Input Helpers
  const sanitizeNumeric = (val: string) => {
    if (!val) return '';
    let cleaned = val.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  };

  const updateField = (field: string, value: any) => {
    if (field === 'pcsMtr' || field === 'rate') {
      value = sanitizeNumeric(value);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormatMobile = (field: 'paymentTerms' | 'notes', formatType: 'bold' | 'italic' | 'underline' | 'bullet' | 'number') => {
    const val = (formData as any)[field] || '';
    const sel = field === 'paymentTerms' ? termsSel : notesSel;
    const start = sel.start;
    const end = sel.end;
    const selectedText = (start !== end && start < end) ? val.substring(start, end) : '';

    let newText = val;
    if (formatType === 'bold') {
      if (selectedText) {
        if (selectedText.startsWith('<b>') && selectedText.endsWith('</b>')) {
          newText = val.substring(0, start) + selectedText.slice(3, -4) + val.substring(end);
        } else {
          newText = val.substring(0, start) + `<b>${selectedText}</b>` + val.substring(end);
        }
      } else {
        newText = val ? `${val} <b>bold text</b>` : '<b>bold text</b>';
      }
    } else if (formatType === 'italic') {
      if (selectedText) {
        if (selectedText.startsWith('<i>') && selectedText.endsWith('</i>')) {
          newText = val.substring(0, start) + selectedText.slice(3, -4) + val.substring(end);
        } else {
          newText = val.substring(0, start) + `<i>${selectedText}</i>` + val.substring(end);
        }
      } else {
        newText = val ? `${val} <i>italic text</i>` : '<i>italic text</i>';
      }
    } else if (formatType === 'underline') {
      if (selectedText) {
        if (selectedText.startsWith('<u>') && selectedText.endsWith('</u>')) {
          newText = val.substring(0, start) + selectedText.slice(3, -4) + val.substring(end);
        } else {
          newText = val.substring(0, start) + `<u>${selectedText}</u>` + val.substring(end);
        }
      } else {
        newText = val ? `${val} <u>underlined text</u>` : '<u>underlined text</u>';
      }
    } else if (formatType === 'bullet') {
      newText = val ? `${val}\n• ` : '• ';
    } else if (formatType === 'number') {
      newText = val ? `${val}\n1. ` : '1. ';
    }

    updateField(field, newText);
  };

  const updateSpec = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      specs: { ...(prev.specs as any), [field]: sanitizeNumeric(value) }
    }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Unified Search & Filters Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingHorizontal: 16 }}>
        {/* Custom Search Bar */}
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
          {/* Search Icon on Left Side of text input */}
          <Search size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />

          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              color: theme.text,
              paddingVertical: 8,
            }}
            placeholder="Search POs..."
            placeholderTextColor={theme.inputPlaceholder}
            value={searchVal}
            onChangeText={(val) => {
              setSearchVal(val);
            }}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchVal.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchVal(''); setDebouncedSearch(''); }} activeOpacity={0.6} style={{ padding: 4 }}>
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
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




      {/* List */}
      <View style={{ flex: 1 }}>
        {isLoading && page === 1 ? (
          <SkeletonList count={5} height={180} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={48} color={Colors.primary[500]} />}
            title="No Purchase Orders"
            subtitle={debouncedSearch || companyHeader || fyFilter ? "Try adjusting your filters" : "Create your first purchase order"}
            actionTitle={isMaster ? "Create Order" : undefined}
            onAction={isMaster ? () => openModal() : undefined}
          />
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingVertical: 16, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary[500]} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            renderItem={({ item, index }) => (
              <PurchaseOrderCard
                item={item}
                index={index}
                isMaster={isMaster}
                theme={theme}
                isDarkMode={isDarkMode}
                openModal={openModal}
                handleDelete={handleDelete}
                generatePDF={generatePDF}
                previewPDF={previewPDF}
              />
            )}
            ListFooterComponent={
              isFetching && page > 1 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={Colors.primary[500]} />
                </View>
              ) : <View style={{ height: 40 }} />
            }
          />
        )}
      </View>

      {/* Draggable FAB */}
      {isMaster && (
        <RNAnimated.View
          {...fabPanResponder.panHandlers}
          style={{
            left: fabPan.x,
            top: fabPan.y,
            position: 'absolute',
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              openModal();
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
            }}
          >
            <View style={{ position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={24} color="#ffffff" />
              <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.primary[600], borderRadius: 7, width: 14, height: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff' }}>
                <Plus size={9} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

      {/* Full Screen Bottom Sheet Modal for Create/Edit */}
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType="none"
        onRequestClose={() => closeModal()}
      >
        <View style={[{ flex: 1, position: 'relative' }]}>
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.overlay }]} />
          
          <Animated.View 
            style={[
              { position: 'absolute', left: 0, right: 0, bottom: 0, top: insets.top + 20, backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20 },
              animatedSheetStyle
            ]}
          >
            {/* Draggable Header */}
            <View {...panResponder.panHandlers} style={{ borderBottomWidth: 1, borderBottomColor: theme.borderLight, paddingBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? Colors.neutral[600] : Colors.neutral[300], alignSelf: 'center', marginTop: 12, marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }} numberOfLines={1}>
                    {isEditMode ? 'Edit Purchase Order' : 'Create Purchase Order'} {(!isEditMode && nextPoDetails?.poNumber) ? `#${nextPoDetails.poNumber}` : (isEditMode && formData.poNumber ? `#${formData.poNumber}` : '')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => closeModal()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100], alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
                
                {/* Company Header Selector */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Company Header *</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {[
                      { id: 'Viral Fabrics', name: 'VIRAL FABRICS', gstin: '24AXYPP4119J1ZW' },
                      { id: 'Viral Enterprise', name: 'VIRAL ENTERPRISE', gstin: '24AAJHV2286E1Z0' }
                    ].map(company => {
                      const isSelected = formData.companyHeader === company.id;
                      return (
                        <TouchableOpacity
                          key={company.id}
                          onPress={() => {
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                            updateField('companyHeader', company.id);
                          }}
                          activeOpacity={0.8}
                          style={{
                            flex: 1,
                            paddingHorizontal: 12,
                            paddingVertical: 14,
                            borderRadius: 14,
                            borderWidth: 1.5,
                            borderColor: isSelected ? Colors.primary[600] : theme.borderLight,
                            backgroundColor: isSelected ? (isDarkMode ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.06)') : theme.input,
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: 84
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? Colors.primary[600] : theme.text }}>
                              {company.name}
                            </Text>
                            <Info size={14} color={isSelected ? Colors.primary[500] : theme.textTertiary} />
                          </View>
                          <Text style={{ fontSize: 10.5, fontWeight: '600', color: isSelected ? Colors.primary[500] : theme.textTertiary, marginTop: 6 }}>
                            GSTIN: {company.gstin}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* PO Date */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>PO Date *</Text>
                  <TouchableOpacity
                    onPress={() => setIsDatePickerOpen(true)}
                    activeOpacity={0.7}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      backgroundColor: theme.input, 
                      borderWidth: 1, 
                      borderColor: theme.inputBorder, 
                      borderRadius: 12, 
                      padding: 14 
                    }}
                  >
                    <Text style={{ fontSize: 15, color: theme.text, fontWeight: '500' }}>{formatDate(formData.poDate)}</Text>
                    <CalendarDays size={18} color={theme.textTertiary} />
                  </TouchableOpacity>
                </View>

                {/* Broker Info */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20, zIndex: 100 }}>
                  <View style={{ flex: 1, position: 'relative' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Broker Name</Text>
                    <TextInput
                      style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text }}
                      value={formData.brokerName || ''}
                      onChangeText={(t) => { updateField('brokerName', t); setShowBrokerSuggestions(true); fetchSuggestions(t); }}
                      placeholder="Type or press Arrow keys..."
                      placeholderTextColor={theme.inputPlaceholder}
                    />
                    {showBrokerSuggestions && brokerSuggestions.length > 0 && formData.brokerName && (
                      <View style={{ position: 'absolute', top: 76, left: 0, right: 0, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.borderLight, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 }}>
                        {brokerSuggestions.slice(0, 3).map((b, i) => (
                          <TouchableOpacity 
                            key={b._id || i} 
                            style={{ padding: 12, borderBottomWidth: i < Math.min(brokerSuggestions.length, 3) - 1 ? 1 : 0, borderBottomColor: theme.borderLight }} 
                            onPress={() => { 
                              updateField('brokerName', b.name); 
                              updateField('brokerPhone', b.phone || formData.brokerPhone); 
                              setShowBrokerSuggestions(false); 
                            }}
                          >
                            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{b.name}</Text>
                            {b.phone ? <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>{b.phone}</Text> : null}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Broker Mobile</Text>
                    <TextInput
                      style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text }}
                      value={formData.brokerPhone || ''}
                      onChangeText={(t) => updateField('brokerPhone', t)}
                      placeholder="Phone number"
                      placeholderTextColor={theme.inputPlaceholder}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Supplier Info */}
                <View style={{ marginBottom: 20, zIndex: 90, position: 'relative' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Supplier Name *</Text>
                  <TextInput
                    style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text }}
                    value={formData.supplierName || ''}
                    onChangeText={(t) => { updateField('supplierName', t); setShowSupplierSuggestions(true); fetchSuggestions(t); }}
                    placeholder="Type or press Arrow keys..."
                    placeholderTextColor={theme.inputPlaceholder}
                  />
                  {showSupplierSuggestions && supplierSuggestions.length > 0 && formData.supplierName && (
                    <View style={{ position: 'absolute', top: 76, left: 0, right: 0, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.borderLight, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 }}>
                      {supplierSuggestions.slice(0, 3).map((s, i) => (
                        <TouchableOpacity 
                          key={s._id || i} 
                          style={{ padding: 12, borderBottomWidth: i < Math.min(supplierSuggestions.length, 3) - 1 ? 1 : 0, borderBottomColor: theme.borderLight }} 
                          onPress={() => { 
                            updateField('supplierName', s.name); 
                            updateField('supplierAddress', s.address || formData.supplierAddress); 
                            updateField('supplierGstin', s.gstin || formData.supplierGstin); 
                            setShowSupplierSuggestions(false); 
                          }}
                        >
                          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{s.name}</Text>
                          {s.gstin ? <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>GSTIN: {s.gstin}</Text> : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Supplier Address</Text>
                  <TextInput
                    style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text, minHeight: 80 }}
                    value={formData.supplierAddress || ''}
                    onChangeText={(t) => updateField('supplierAddress', t)}
                    placeholder="Supplier full address"
                    placeholderTextColor={theme.inputPlaceholder}
                    multiline
                  />
                </View>

                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Supplier GSTIN</Text>
                  <TextInput
                    style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text }}
                    value={formData.supplierGstin || ''}
                    onChangeText={(t) => updateField('supplierGstin', t.toUpperCase())}
                    placeholder="e.g. 09AACFW3350K1ZY"
                    placeholderTextColor={theme.inputPlaceholder}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Quality */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quality *</Text>
                  <TextInput
                    style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text }}
                    value={formData.quality || ''}
                    onChangeText={(t) => updateField('quality', t)}
                    placeholder="e.g. GREY 20% RECYCLE POLY SATIN"
                    placeholderTextColor={theme.inputPlaceholder}
                  />
                </View>

                {/* Pcs / Mtr & Delivery */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pcs / Mtr</Text>
                    <TextInput
                      style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text }}
                      value={formData.pcsMtr || ''}
                      onChangeText={(t) => updateField('pcsMtr', t)}
                      placeholder="e.g. 3606.00"
                      placeholderTextColor={theme.inputPlaceholder}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Delivery</Text>
                    <TextInput
                      style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text }}
                      value={formData.delivery || ''}
                      onChangeText={(t) => updateField('delivery', t)}
                      placeholder="e.g. office"
                      placeholderTextColor={theme.inputPlaceholder}
                    />
                  </View>
                </View>

                {/* Rate */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rate</Text>
                  <TextInput
                    style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text, fontWeight: '600' }}
                    value={formData.rate || ''}
                    onChangeText={(t) => updateField('rate', t)}
                    placeholder="e.g. 79.50"
                    placeholderTextColor={theme.inputPlaceholder}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Payment Terms */}
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Terms</Text>
                    {/* Rich Formatting Toolbar */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => handleFormatMobile('paymentTerms', 'bold')}
                        style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>B</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleFormatMobile('paymentTerms', 'italic')}
                        style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 13, fontStyle: 'italic', fontWeight: '900', color: theme.text }}>I</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleFormatMobile('paymentTerms', 'underline')}
                        style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '900', textDecorationLine: 'underline', color: theme.text }}>U</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TextInput
                    style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text, minHeight: 80, textAlignVertical: 'top' }}
                    value={formData.paymentTerms || ''}
                    onChangeText={(t) => updateField('paymentTerms', t)}
                    onSelectionChange={(e) => setTermsSel(e.nativeEvent.selection)}
                    placeholder="e.g. 30 Days"
                    placeholderTextColor={theme.inputPlaceholder}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Specifications Table Layout */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Specifications</Text>
                  <View style={{ borderRadius: 12, borderWidth: 1, borderColor: theme.borderLight, overflow: 'hidden', backgroundColor: theme.surface }}>
                    {[
                      { key: 'finishGsm', label: 'Finish GSM' },
                      { key: 'greyWidth', label: 'Grey Width' },
                      { key: 'finishWidth', label: 'Finish Width' },
                      { key: 'weight', label: 'Weight' }
                    ].map((spec, index) => (
                      <View 
                        key={spec.key} 
                        style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          borderBottomWidth: index < 3 ? 1 : 0, 
                          borderBottomColor: theme.borderLight,
                          height: 48
                        }}
                      >
                        <View style={{ 
                          width: 120, 
                          height: '100%', 
                          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', 
                          justifyContent: 'center', 
                          paddingHorizontal: 12,
                          borderRightWidth: 1,
                          borderRightColor: theme.borderLight
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>{spec.label}</Text>
                        </View>
                        <TextInput
                          style={{ 
                            flex: 1, 
                            height: '100%', 
                            paddingHorizontal: 14, 
                            fontSize: 14, 
                            color: theme.text,
                            backgroundColor: 'transparent'
                          }}
                          value={formData.specs?.[spec.key as keyof typeof formData.specs] || ''}
                          onChangeText={(t) => updateSpec(spec.key as any, t)}
                          placeholder=""
                          keyboardType="decimal-pad"
                        />
                      </View>
                    ))}
                  </View>
                </View>

                {/* Notes */}
                <View style={{ marginBottom: 40 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</Text>
                    {/* Rich Formatting Toolbar */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => handleFormatMobile('notes', 'bold')}
                        style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>B</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleFormatMobile('notes', 'italic')}
                        style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 13, fontStyle: 'italic', fontWeight: '900', color: theme.text }}>I</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleFormatMobile('notes', 'underline')}
                        style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '900', textDecorationLine: 'underline', color: theme.text }}>U</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TextInput
                    style={{ backgroundColor: theme.input, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: theme.text, minHeight: 100, textAlignVertical: 'top' }}
                    value={formData.notes}
                    onChangeText={(t) => updateField('notes', t)}
                    onSelectionChange={(e) => setNotesSel(e.nativeEvent.selection)}
                    placeholder="Additional notes..."
                    placeholderTextColor={theme.inputPlaceholder}
                    multiline
                  />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
            
            {/* Action Bar */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.borderLight, paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 16, flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => closeModal()} style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: isDarkMode ? Colors.neutral[800] : Colors.neutral[100], alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={createMutation.isPending || updateMutation.isPending} style={{ flex: 2, padding: 16, borderRadius: 12, backgroundColor: Colors.primary[600], alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                {createMutation.isPending || updateMutation.isPending ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Check size={18} color={Colors.white} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.white }}>{isEditMode ? 'Update Order' : 'Create Order'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Date Picker Modal for Form */}
      <DatePickerModal
        visible={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onSelectDate={(date: string) => updateField('poDate', toIsoDate(date))}
        value={toDisplayDate(formData.poDate)}
      />



      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        visible={isDeleteModalOpen}
        title="Delete Purchase Order"
        message="Are you sure you want to delete this purchase order? This action cannot be undone."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onClose={() => { setIsDeleteModalOpen(false); setDeleteId(null); }}
        isDeleting={deleteMutation.isPending}
      />






      {/* Advanced Filter Bottom Sheet Modal */}
      <Modal
        visible={showFilterModal}
        animationType="none"
        transparent={true}
        onRequestClose={closeFilterModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Backdrop Overlay sibling */}
          <TouchableWithoutFeedback onPress={closeFilterModal}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]} />
          </TouchableWithoutFeedback>

          <RNAnimated.View
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : Colors.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 16,
              paddingBottom: (Platform.OS === 'ios' ? 16 : 12) + insets.bottom,
              borderTopWidth: 1,
              borderTopColor: theme.borderLight,
              maxHeight: '85%',
              transform: [{ translateY: filterPanY }],
            }}
          >
            {/* Header Drag Zone */}
            <View {...filterPanResponder.panHandlers} style={{ width: '100%' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 16 }} />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16, paddingRight: 60 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Filter Purchase Orders</Text>
                {activeFilterCount > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setCompanyHeader('');
                      setFyFilter('');
                      setSortFilter('latest_first');
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <RotateCcw size={14} color={isDarkMode ? Colors.primary[400] : Colors.primary[600]} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Close Button absolute */}
            <TouchableOpacity
              onPress={closeFilterModal}
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
              style={{ paddingHorizontal: 20 }}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                filterScrollOffset.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {/* Sort Order Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort Order</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {[
                  { id: 'latest_first', label: 'Latest First' },
                  { id: 'oldest_first', label: 'Oldest First' },
                ].map((opt) => {
                  const isSelected = sortFilter === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setSortFilter(opt.id);
                      }}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: isSelected ? Colors.primary[600] : (isDarkMode ? '#334155' : '#f1f5f9'),
                        borderWidth: 1,
                        borderColor: isSelected ? Colors.primary[600] : theme.borderLight,
                      }}
                    >
                      <Text style={{
                        fontSize: 12.5,
                        fontWeight: '600',
                        color: isSelected ? Colors.white : theme.textSecondary,
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Company Header Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Company Header</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {[
                  { id: '', label: 'All' },
                  { id: 'Viral Fabrics', label: 'Viral Fabrics' },
                  { id: 'Viral Enterprise', label: 'Viral Enterprise' },
                ].map((opt) => {
                  const isSelected = companyHeader === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setCompanyHeader(opt.id);
                      }}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: isSelected ? Colors.primary[600] : (isDarkMode ? '#334155' : '#f1f5f9'),
                        borderWidth: 1,
                        borderColor: isSelected ? Colors.primary[600] : theme.borderLight,
                      }}
                    >
                      <Text style={{
                        fontSize: 12.5,
                        fontWeight: '600',
                        color: isSelected ? Colors.white : theme.textSecondary,
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Financial Year Section */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Financial Year</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setFyFilter('');
                  }}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: fyFilter === '' ? Colors.primary[600] : (isDarkMode ? '#334155' : '#f1f5f9'),
                    borderWidth: 1,
                    borderColor: fyFilter === '' ? Colors.primary[600] : theme.borderLight,
                  }}
                >
                  <Text style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: fyFilter === '' ? Colors.white : theme.textSecondary,
                  }}>
                    All Years
                  </Text>
                </TouchableOpacity>

                {fyOptions.map((opt: any) => {
                  const isSelected = fyFilter === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setFyFilter(opt.value);
                      }}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: isSelected ? Colors.primary[600] : (isDarkMode ? '#334155' : '#f1f5f9'),
                        borderWidth: 1,
                        borderColor: isSelected ? Colors.primary[600] : theme.borderLight,
                      }}
                    >
                      <Text style={{
                        fontSize: 12.5,
                        fontWeight: '600',
                        color: isSelected ? Colors.white : theme.textSecondary,
                      }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>



              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    setPage(1);
                    closeFilterModal();
                  }}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: Colors.primary[600],
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.white }}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
