import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Platform, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Image, Modal, Pressable, StyleSheet, Clipboard, PanResponder, Animated as RNAnimated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FileText, Search, X, Plus, Edit, Trash2, LogIn, LogOut, Shield, CheckCircle, XCircle, Clock, Users, Activity, User, ChevronRight, Copy, Check, Globe, SlidersHorizontal, RotateCcw } from 'lucide-react-native';
import { useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';

import api from '../../services/api';
import Header from '../../components/shared/Header';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../hooks/useAuth';
import { getRelativeTime } from '../../utils/helpers';

const ACTION_ICONS: Record<string, { icon: React.ReactElement; bg: string; darkBg: string }> = {
  create: { icon: <Plus size={16} color="#22c55e" />, bg: '#f0fdf4', darkBg: 'rgba(34,197,94,0.15)' },
  update: { icon: <Edit size={16} color="#3b82f6" />, bg: '#eff6ff', darkBg: 'rgba(59,130,246,0.15)' },
  delete: { icon: <Trash2 size={16} color="#ef4444" />, bg: '#fef2f2', darkBg: 'rgba(239,68,68,0.15)' },
  login: { icon: <LogIn size={16} color="#8b5cf6" />, bg: '#f5f3ff', darkBg: 'rgba(139,92,246,0.15)' },
  logout: { icon: <LogOut size={16} color="#f59e0b" />, bg: '#fffbeb', darkBg: 'rgba(245,158,11,0.15)' },
};

// Safe Clipboard copy helper
const copyToClipboard = async (text: string) => {
  if (Platform.OS === 'web') {
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  }
  try {
    Clipboard.setString(text);
    return true;
  } catch (err) {
    console.warn('Failed to copy to clipboard:', err);
    return false;
  }
};

const InfoRow = ({ label, value, badge, copyable, icon }: any) => {
  const { theme, isDarkMode } = useTheme();
  const [copiedRow, setCopiedRow] = useState(false);

  const handleCopyValue = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    copyToClipboard(value);
    setCopiedRow(true);
    setTimeout(() => setCopiedRow(false), 1500);
  };

  return (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>{value}</Text>
        {badge && (
          <View style={{ backgroundColor: isDarkMode ? 'rgba(139,92,246,0.15)' : '#f5f3ff', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: isDarkMode ? '#a78bfa' : '#7c3aed' }}>{badge}</Text>
          </View>
        )}
        {copyable && (
          <TouchableOpacity onPress={handleCopyValue} style={{ padding: 4 }}>
            {copiedRow ? <Check size={12} color="#22c55e" /> : <Copy size={12} color={theme.textTertiary} />}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default function LogsScreen() {
  const segments = useSegments();
  const isInTabs = (segments as string[]).includes('(tabs)');
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAppStore(s => s.isAuthenticated);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Filter States
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  // Tracking grand total (unfiltered count)
  const [grandTotal, setGrandTotal] = useState<number>(0);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pan Translation Values for swipe gestures
  const filterPanY = useRef(new RNAnimated.Value(600)).current;
  const detailsPanY = useRef(new RNAnimated.Value(600)).current;

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(text), 400);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dateFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (actionFilter !== 'all') count++;
    return count;
  }, [dateFilter, statusFilter, actionFilter]);

  // Spring animations for opening modals
  const openFilterModal = () => {
    setShowFilterModal(true);
    filterPanY.setValue(600);
    RNAnimated.spring(filterPanY, {
      toValue: 0,
      useNativeDriver: false,
      damping: 15,
      stiffness: 120,
    }).start();
  };

  const closeFilterModal = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    RNAnimated.timing(filterPanY, {
      toValue: 600,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setShowFilterModal(false);
    });
  };

  const openDetailsModal = (item: any) => {
    setSelectedLog(item);
    detailsPanY.setValue(600);
    RNAnimated.spring(detailsPanY, {
      toValue: 0,
      useNativeDriver: false,
      damping: 15,
      stiffness: 120,
    }).start();
  };

  const closeDetailsModal = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    RNAnimated.timing(detailsPanY, {
      toValue: 600,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setSelectedLog(null);
    });
  };

  const resetFilters = () => {
    setDateFilter('all');
    setStatusFilter('all');
    setActionFilter('all');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Swipe Gestures Configuration
  const filterPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          filterPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 45 || gestureState.vy > 0.25) {
          closeFilterModal();
        } else {
          RNAnimated.spring(filterPanY, {
            toValue: 0,
            useNativeDriver: false,
            friction: 7,
          }).start();
        }
      },
    })
  ).current;

  const detailsPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          detailsPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 45 || gestureState.vy > 0.25) {
          closeDetailsModal();
        } else {
          RNAnimated.spring(detailsPanY, {
            toValue: 0,
            useNativeDriver: false,
            friction: 7,
          }).start();
        }
      },
    })
  ).current;

  const PAGE_SIZE = 30;

  const logsQuery = useInfiniteQuery({
    queryKey: ['logs', dateFilter, statusFilter, actionFilter],
    enabled: isAuthenticated,
    initialPageParam: undefined as string | undefined,
    staleTime: 30000,
    queryFn: async ({ pageParam }) => {
      const params: any = { limit: PAGE_SIZE, includeStats: true };
      if (dateFilter !== 'all') params.dateFilter = dateFilter;
      if (statusFilter !== 'all') params.success = statusFilter === 'success';
      if (actionFilter !== 'all') params.action = actionFilter;
      if (pageParam) params.cursor = pageParam;
      const { data } = await api.get('/api/logs', { params });
      return data;
    },
    getNextPageParam: (lastPage) => {
      const pagination = lastPage?.pagination;
      return pagination?.hasMore ? pagination.nextCursor : undefined;
    },
  });

  // Keep track of the unfiltered grand total of all logs in the database
  useEffect(() => {
    const firstPageTotal = logsQuery.data?.pages[0]?.pagination?.total;
    if (firstPageTotal !== undefined && activeFilterCount === 0 && !debouncedSearch) {
      setGrandTotal(firstPageTotal);
    }
  }, [logsQuery.data, activeFilterCount, debouncedSearch]);

  const rawLogs = useMemo(() => {
    return logsQuery.data?.pages.flatMap(page => page.logs || page.data || []) || [];
  }, [logsQuery.data]);

  const logs = useMemo(() => {
    if (!debouncedSearch) return rawLogs;
    const lower = debouncedSearch.toLowerCase();
    return rawLogs.filter((log: any) =>
      (log.username || '').toLowerCase().includes(lower) ||
      (log.action || '').toLowerCase().includes(lower) ||
      (log.resource || '').toLowerCase().includes(lower) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(lower))
    );
  }, [rawLogs, debouncedSearch]);

  const handleCopyDetails = () => {
    if (!selectedLog?.details) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    copyToClipboard(JSON.stringify(selectedLog.details, null, 2));
    setCopiedDetails(true);
    setTimeout(() => setCopiedDetails(false), 2000);
  };

  const LogItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const actionKey = (item.action || '').toLowerCase();
    const actionStyle = ACTION_ICONS[actionKey] || ACTION_ICONS['update'];

    return (
      <View>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openDetailsModal(item);
          }}
          activeOpacity={0.7}
          style={{
            marginHorizontal: 16, marginBottom: 10, padding: 14,
            backgroundColor: theme.card, borderRadius: 14,
            borderWidth: 1, borderColor: theme.borderLight,
            flexDirection: 'row', alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDarkMode ? 0.05 : 0.01,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          {/* Action Icon */}
          <View style={{
            width: 38, height: 38, borderRadius: 12,
            backgroundColor: isDarkMode ? actionStyle.darkBg : actionStyle.bg,
            alignItems: 'center', justifyContent: 'center', marginRight: 12
          }}>
            {actionStyle.icon}
          </View>

          {/* Details Section */}
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{item.username || 'System'}</Text>
              {item.userRole && (
                <View style={{ backgroundColor: isDarkMode ? 'rgba(139,92,246,0.15)' : '#f5f3ff', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#a78bfa' : '#7c3aed' }}>{item.userRole}</Text>
                </View>
              )}
            </View>
            
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }} numberOfLines={1}>
              <Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>{item.action.replace(/_/g, ' ')}</Text>
              {item.resource ? ` • ${item.resource}` : ''}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={11} color={theme.textTertiary} />
              <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '500' }}>{getRelativeTime(item.timestamp || item.createdAt)}</Text>
              {item.ipAddress && (
                <Text style={{ fontSize: 11, color: theme.textTertiary, marginLeft: 6 }}>• {item.ipAddress}</Text>
              )}
            </View>
          </View>

          {/* Status & Arrow */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {item.success !== undefined && (
              item.success
                ? <CheckCircle size={16} color="#22c55e" />
                : <XCircle size={16} color="#ef4444" />
            )}
            <ChevronRight size={16} color={theme.textTertiary} />
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [theme, isDarkMode]);

  const renderFooter = () => {
    if (logsQuery.isFetchingNextPage) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={Colors.primary[500]} />
        </View>
      );
    }
    if (!logsQuery.hasNextPage && logs.length > 0) {
      return (
        <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, color: theme.textTertiary, fontStyle: 'italic' }}>
            No more logs to load
          </Text>
        </View>
      );
    }
    return null;
  };

  const selectedActionKey = (selectedLog?.action || '').toLowerCase();
  const selectedActionStyle = ACTION_ICONS[selectedActionKey] || ACTION_ICONS['update'];

  // Helper for filter option pills - directly applies filter and closes modal on tap
  const FilterPill = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: selected ? Colors.primary[600] : (isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
        borderWidth: 1,
        borderColor: selected ? Colors.primary[600] : (isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      <Text style={{
        fontSize: 12,
        fontWeight: '700',
        color: selected ? '#ffffff' : theme.textSecondary,
        textTransform: 'capitalize'
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {!isInTabs && <Header title="Activity Logs" showBack />}

      {/* Search and Filter Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, paddingVertical: 8 }}>
        {/* Search Bar */}
        <View style={{ 
          flex: 1, 
          flexDirection: 'row', 
          alignItems: 'center', 
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9', 
          borderRadius: 12, 
          paddingHorizontal: 14, 
          height: 44, 
          borderWidth: 1, 
          borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0' 
        }}>
          <Search size={18} color={theme.textTertiary} />
          <TextInput 
            placeholder="Search logs..." 
            placeholderTextColor={theme.inputPlaceholder} 
            value={search} 
            onChangeText={handleSearch} 
            style={{ flex: 1, marginLeft: 10, fontSize: 15, color: theme.text, paddingVertical: 0 }} 
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setDebouncedSearch(''); }}>
              <X size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button */}
        <TouchableOpacity
          onPress={openFilterModal}
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
      {logsQuery.isLoading ? (
        <SkeletonList count={8} />
      ) : logs.length === 0 ? (
        <EmptyState 
          icon={<FileText size={48} color={Colors.primary[500]} />} 
          title="No Logs Found" 
          subtitle={debouncedSearch || activeFilterCount > 0 ? 'No logs match your active filters or search term.' : 'No activity logged yet.'} 
        />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item: any, i: number) => (item._id || item.id || i.toString()) + '-' + i}
          ListHeaderComponent={() => {
            const totalMatchingCount = logsQuery.data?.pages[0]?.pagination?.total || logs.length;
            const displayGrandTotal = grandTotal || totalMatchingCount;
            const isFiltered = activeFilterCount > 0 || debouncedSearch.trim() !== '';
            
            return (
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
                      Showing <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{totalMatchingCount}</Text> of <Text style={{ fontWeight: '800', color: theme.text }}>{displayGrandTotal}</Text>
                    </Text>
                  ) : (
                    <Text>
                      Total Logs: <Text style={{ fontWeight: '800', color: isDarkMode ? Colors.primary[400] : Colors.primary[600] }}>{displayGrandTotal}</Text>
                    </Text>
                  )}
                </Text>

                {activeFilterCount > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setDateFilter('all');
                      setStatusFilter('all');
                      setActionFilter('all');
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
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
                      Clear Filters ({activeFilterCount})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          renderItem={({ item, index }) => <LogItem item={item} index={index} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (logsQuery.hasNextPage && !logsQuery.isFetchingNextPage) {
              logsQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl
                refreshing={logsQuery.isRefetching}
                onRefresh={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  logsQuery.refetch();
                }}
                tintColor={Colors.primary[500]}
                colors={[Colors.primary[500]]}
              />
            ) : undefined
          }
        />
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <Modal
          visible={showFilterModal}
          transparent
          animationType="none"
          onRequestClose={closeFilterModal}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0)',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}>
            <Pressable 
              style={StyleSheet.absoluteFill} 
              onPress={closeFilterModal} 
            />

            <RNAnimated.View 
              style={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 12,
                paddingBottom: 24 + insets.bottom,
                width: '100%',
                maxWidth: 500,
                maxHeight: '80%',
                borderTopWidth: 1,
                borderTopColor: isDarkMode ? '#334155' : '#e2e8f0',
                transform: [{ translateY: filterPanY }],
              }}
            >
              {/* Swipe Drag Handle Zone */}
              <View {...filterPanResponder.panHandlers} style={{ width: '100%' }}>
                <View style={{
                  width: '100%',
                  alignItems: 'center',
                  paddingVertical: 8,
                  marginBottom: 4,
                }}>
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

              {/* Top Right Absolute Close & Reset Container */}
              <View style={{
                position: 'absolute',
                top: 22,
                right: 24,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                zIndex: 10,
              }}>
                {activeFilterCount > 0 && (
                  <TouchableOpacity
                    onPress={resetFilters}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}
                  >
                    <RotateCcw size={13} color={Colors.error[500] || '#ef4444'} />
                    <Text style={{ color: Colors.error[500] || '#ef4444', fontSize: 13, fontWeight: '700' }}>Reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={closeFilterModal}
                  style={{
                    padding: 4,
                    borderRadius: 12,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  }}
                >
                  <X size={18} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 24 }}>
                {/* 1. Date Range Filter */}
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date Period</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
                  <FilterPill label="All Time" selected={dateFilter === 'all'} onPress={() => { setDateFilter('all'); }} />
                  <FilterPill label="Today" selected={dateFilter === 'today'} onPress={() => { setDateFilter('today'); }} />
                  <FilterPill label="This Week" selected={dateFilter === 'week'} onPress={() => { setDateFilter('week'); }} />
                  <FilterPill label="This Month" selected={dateFilter === 'month'} onPress={() => { setDateFilter('month'); }} />
                </View>

                {/* 2. Success Status Filter */}
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Success Status</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
                  <FilterPill label="All status" selected={statusFilter === 'all'} onPress={() => { setStatusFilter('all'); }} />
                  <FilterPill label="Success Only" selected={statusFilter === 'success'} onPress={() => { setStatusFilter('success'); }} />
                  <FilterPill label="Failed Only" selected={statusFilter === 'failed'} onPress={() => { setStatusFilter('failed'); }} />
                </View>

                {/* 3. Action Type Filter */}
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Action Type</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
                  <FilterPill label="All actions" selected={actionFilter === 'all'} onPress={() => { setActionFilter('all'); }} />
                  <FilterPill label="Create" selected={actionFilter === 'create'} onPress={() => { setActionFilter('create'); }} />
                  <FilterPill label="Update" selected={actionFilter === 'update'} onPress={() => { setActionFilter('update'); }} />
                  <FilterPill label="Delete" selected={actionFilter === 'delete'} onPress={() => { setActionFilter('delete'); }} />
                  <FilterPill label="Login" selected={actionFilter === 'login'} onPress={() => { setActionFilter('login'); }} />
                  <FilterPill label="Logout" selected={actionFilter === 'logout'} onPress={() => { setActionFilter('logout'); }} />
                </View>
              </ScrollView>
            </RNAnimated.View>
          </View>
        </Modal>
      )}

      {/* Details Modal */}
      {!!selectedLog && (
        <Modal
          visible={!!selectedLog}
          transparent
          animationType="none"
          onRequestClose={closeDetailsModal}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0)',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}>
            <Pressable 
              style={StyleSheet.absoluteFill} 
              onPress={closeDetailsModal} 
            />

            <RNAnimated.View 
              style={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 12,
                paddingBottom: 24 + insets.bottom,
                width: '100%',
                maxWidth: 550,
                maxHeight: '85%',
                borderTopWidth: 1,
                borderTopColor: isDarkMode ? '#334155' : '#e2e8f0',
                transform: [{ translateY: detailsPanY }],
              }}
            >
              {/* Swipe Drag Handle Zone */}
              <View {...detailsPanResponder.panHandlers} style={{ width: '100%' }}>
                <View style={{
                  width: '100%',
                  alignItems: 'center',
                  paddingVertical: 8,
                  marginBottom: 4,
                }}>
                  <View style={{
                    width: 40,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: isDarkMode ? '#475569' : '#cbd5e1',
                  }} />
                </View>
              </View>

              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Activity Details</Text>
                <TouchableOpacity 
                  onPress={closeDetailsModal}
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                    padding: 8,
                    borderRadius: 12,
                  }}
                >
                  <X size={18} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 24 }}>
                {/* Action Card */}
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  marginBottom: 16
                }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 14,
                    backgroundColor: isDarkMode ? selectedActionStyle.darkBg : selectedActionStyle.bg,
                    alignItems: 'center', justifyContent: 'center', marginRight: 14
                  }}>
                    {selectedActionStyle.icon}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, textTransform: 'capitalize' }}>
                      {selectedLog.action.replace(/_/g, ' ')}
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                      Resource: <Text style={{ fontWeight: '700', color: theme.text }}>{selectedLog.resource || 'System'}</Text>
                    </Text>
                  </View>
                  <View>
                    {selectedLog.success !== undefined && (
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: 4,
                        backgroundColor: selectedLog.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8
                      }}>
                        {selectedLog.success ? (
                          <>
                            <CheckCircle size={14} color="#22c55e" />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#22c55e' }}>Success</Text>
                          </>
                        ) : (
                          <>
                            <XCircle size={14} color="#ef4444" />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#ef4444' }}>Failed</Text>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* Details Grid */}
                <View style={{ 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.01)' : '#ffffff',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  paddingHorizontal: 14,
                  paddingVertical: 4,
                  marginBottom: 16
                }}>
                  <InfoRow label="User" value={selectedLog.username || 'System'} badge={selectedLog.userRole} icon={<User size={14} color={theme.textTertiary} />} />
                  <InfoRow label="IP Address" value={selectedLog.ipAddress || 'Unknown'} icon={<Globe size={14} color={theme.textTertiary} />} />
                  <InfoRow label="Time" value={new Date(selectedLog.timestamp || selectedLog.createdAt).toLocaleString()} icon={<Clock size={14} color={theme.textTertiary} />} />
                  <InfoRow label="Relative" value={getRelativeTime(selectedLog.timestamp || selectedLog.createdAt)} icon={<Clock size={14} color={theme.textTertiary} />} />
                  {selectedLog.resourceId && (
                    <InfoRow label="Resource ID" value={selectedLog.resourceId} copyable icon={<FileText size={14} color={theme.textTertiary} />} />
                  )}
                </View>

                {/* Payload JSON */}
                {selectedLog.details && typeof selectedLog.details === 'object' && Object.keys(selectedLog.details).length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textSecondary }}>Payload Details</Text>
                      <TouchableOpacity 
                        onPress={handleCopyDetails}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: copiedDetails ? 'rgba(34,197,94,0.1)' : (isDarkMode ? '#334155' : '#f1f5f9'),
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                      >
                        {copiedDetails ? (
                          <>
                            <Check size={12} color="#22c55e" />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#22c55e' }}>Copied</Text>
                          </>
                        ) : (
                          <>
                            <Copy size={12} color={theme.textSecondary} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>Copy JSON</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    <View style={{
                      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                      borderRadius: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                    }}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ width: '100%' }}>
                        <Text style={{
                          fontSize: 11,
                          color: isDarkMode ? '#cbd5e1' : '#334155',
                          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                          lineHeight: 16
                        }}>
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </Text>
                      </ScrollView>
                    </View>
                  </View>
                )}
              </ScrollView>
            </RNAnimated.View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
