'use client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from '@/app/(pages)/(dashboard)/hooks/useSession';
import { useRouter } from 'next/navigation';
import { useDarkMode } from '@/app/(pages)/(dashboard)/hooks/useDarkMode';
import { 
  Calendar, 
  Search, 
  Download, 
  RefreshCw, 
  User, 
  ActivityIcon, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  LogIn,
  LogOut,
  Shield,
  Users,
  ShoppingBag,
  Package,
  FileText,
  Settings,
  Database,
  Trash2,
  Edit,
  Plus,
  Eye,
  Lock,
  Unlock,
  Key,
  Home,
  BarChart3,
  BellIcon, 
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  Factory,
  TestTube,
  Microscope,
  Clipboard,
  Calculator,
  CalendarDays,
  ClockIcon, 
  Star,
  Heart,
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Hash,
  Upload
} from 'lucide-react';

import LogsPageSkeleton from './components/LogsPageSkeleton';

interface Log {
  _id: string;
  userId: string;
  username: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  success: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

interface LogsResponse {
  success: boolean;
  logs: Log[];
  pagination?: {
    hasMore: boolean;
    nextCursor: string | null;
    total: number;
    limit: number;
  };
  statistics?: {
    total: number;
    successful: number;
    failed: number;
    uniqueUsers: number;
  };
}

// Sub-component for rendering visual property changes (Visual Diff)
function VisualDiffViewer({ oldValues, newValues, isDarkMode }: { oldValues: any, newValues: any, isDarkMode: boolean }) {
  const diffs = useMemo(() => {
    const oldObj = oldValues && typeof oldValues === 'object' ? oldValues : {};
    const newObj = newValues && typeof newValues === 'object' ? newValues : {};
    
    // Get unique set of keys from both old and new values
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    const result: Array<{ key: string; type: 'added' | 'removed' | 'modified' | 'unchanged'; oldVal: string; newVal: string }> = [];
    
    for (const key of allKeys) {
      if (key === 'password') continue; // Skip security sensitive keys
      const oldVal = oldObj[key];
      const newVal = newObj[key];
      
      const oldValStr = oldVal !== undefined ? (typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)) : '';
      const newValStr = newVal !== undefined ? (typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)) : '';
      
      if (oldVal === undefined) {
        result.push({ key, type: 'added', oldVal: '', newVal: newValStr });
      } else if (newVal === undefined) {
        result.push({ key, type: 'removed', oldVal: oldValStr, newVal: '' });
      } else if (oldValStr !== newValStr) {
        result.push({ key, type: 'modified', oldVal: oldValStr, newVal: newValStr });
      }
    }
    return result;
  }, [oldValues, newValues]);

  if (diffs.length === 0) {
    return (
      <div className={`p-4 rounded-xl text-sm ${isDarkMode ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-50 text-gray-500'} italic text-center border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        No specific property changes detailed in this log.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
      {diffs.map(({ key, type, oldVal, newVal }) => (
        <div 
          key={key} 
          className={`p-3 rounded-xl border ${
            isDarkMode ? 'border-gray-700/60 bg-gray-850/50' : 'border-gray-200/60 bg-white/50'
          } shadow-sm transition-all hover:scale-[1.005]`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
              isDarkMode ? 'bg-gray-750 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}>
              {key}
            </span>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
              type === 'added' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : type === 'removed'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              {type}
            </span>
          </div>
          
          <div className="space-y-1">
            {type !== 'added' && (
              <div className="flex items-start text-xs font-mono">
                <span className="text-red-500 mr-2 select-none font-bold font-mono">-</span>
                <span className={`line-through break-all ${isDarkMode ? 'text-red-400/80' : 'text-red-650/80'}`}>
                  {oldVal || '(empty)'}
                </span>
              </div>
            )}
            {type !== 'removed' && (
              <div className="flex items-start text-xs font-mono">
                <span className="text-green-500 mr-2 select-none font-bold font-mono">+</span>
                <span className={`break-all ${isDarkMode ? 'text-green-400' : 'text-green-650'}`}>
                  {newVal || '(empty)'}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LogsPage() {
  const { user, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const { isDarkMode } = useDarkMode();
  
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [successFilter, setSuccessFilter] = useState('all');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalLogs, setTotalLogs] = useState(0);
  const [autoLoadAll, setAutoLoadAll] = useState(false);
  const [isInfiniteScrollEnabled] = useState(true); 
  const [sortField, setSortField] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // High-fidelity details modal states
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Fetch logs with pagination
  const fetchLogs = useCallback(async (loadMore = false) => {
    try {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found');
        setIsLoading(false);
        return;
      }
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', '100'); 
      params.append('includeStats', 'true');
      
      if (dateFilter !== 'all') {
        params.append('dateFilter', dateFilter);
      }
      
      // Add cursor for pagination
      if (loadMore && nextCursor) {
        params.append('cursor', nextCursor);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`/api/logs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'max-age=60, stale-while-revalidate=120'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
        } else {
          setError(`Failed to fetch logs (${response.status})`);
        }
        return;
      }
      
      const data: LogsResponse = await response.json();
      
      if (data.success) {
        if (loadMore) {
          setLogs(prevLogs => {
            const newLogs = data.logs || [];
            const existingIds = new Set(prevLogs.map(log => log._id));
            const uniqueNewLogs = newLogs.filter(log => !existingIds.has(log._id));
            return [...prevLogs, ...uniqueNewLogs];
          });
        } else {
          setLogs(data.logs || []);
        }
        
        if (data.pagination) {
          setHasMore(data.pagination.hasMore);
          setNextCursor(data.pagination.nextCursor);
          setTotalLogs(data.pagination.total);
        }
        
        if (!loadMore && data.statistics) {
          setStats(data.statistics);
        }
      } else {
        setError('Failed to fetch logs');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timeout. Please try again.');
      } else {
        setError('Error loading logs');
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [dateFilter, nextCursor]);

  // Load logs on mount
  useEffect(() => {
    if (user && !sessionLoading) {
      fetchLogs(false);
    }
  }, [user, sessionLoading, dateFilter]);

  // Infinite scroll
  useEffect(() => {
    if (!isInfiniteScrollEnabled) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      if (scrollTop + windowHeight >= documentHeight - 200) {
        if (hasMore && !isLoadingMore && !isLoading) {
          loadMoreLogs();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, isLoading, isInfiniteScrollEnabled]);

  // Auto-load all (non-infinite scroll backup)
  useEffect(() => {
    if (autoLoadAll && hasMore && !isLoadingMore && logs.length > 0 && !isInfiniteScrollEnabled) {
      const loadAllLogs = async () => {
        while (hasMore && !isLoadingMore) {
          await fetchLogs(true);
        }
      };
      loadAllLogs();
    }
  }, [autoLoadAll, hasMore, isLoadingMore, logs.length, isInfiniteScrollEnabled]);

  const loadMoreLogs = () => {
    if (hasMore && !isLoadingMore && !isLoading) {
      fetchLogs(true);
    }
  };

  // Redirect to login if not auth'd
  useEffect(() => {
    if (!sessionLoading && !isLoading && !user) {
      router.push('/login');
    }
  }, [sessionLoading, isLoading, user, router]);

  // Copy helper
  const handleCopyJson = (details: any) => {
    if (!details) return;
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 2000);
  };

  // Filtering & Sorting (checks details stringified to enable advanced query payload search)
  const filteredAndSortedLogs = useMemo(() => {
    return logs
      .filter(log => {
        if (log.action === 'view' && log.resource === 'log') {
          return false;
        }
        
        const importantActions = [
          'login', 'logout', 'login_failed', 'password_change', 'password_reset',
          'user_create', 'user_update', 'user_delete', 'user_activate', 'user_deactivate',
          'order_create', 'order_update', 'order_delete', 'order_status_change',
          'lab_create', 'lab_update', 'lab_delete', 'lab_status_change',
          'party_create', 'party_update', 'party_delete',
          'quality_create', 'quality_update', 'quality_delete',
          'fabric_create', 'fabric_update', 'fabric_delete', 
          'file_upload', 'file_delete', 'file_download',
          'system_backup', 'system_restore', 'system_config_change',
          'export', 'import', 'search', 'filter'
        ];
        
        if (!importantActions.includes(log.action)) {
          return false;
        }
        
        // Deep search check inside logs details payload
        const detailsString = log.details ? JSON.stringify(log.details).toLowerCase() : '';
        const matchesSearch = searchTerm === '' || 
          log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (log.resourceId && log.resourceId.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (log.ipAddress && log.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (log.userAgent && log.userAgent.toLowerCase().includes(searchTerm.toLowerCase())) ||
          detailsString.includes(searchTerm.toLowerCase());
        
        const matchesAction = actionFilter === 'all' || log.action === actionFilter;
        const matchesSuccess = successFilter === 'all' || 
          (successFilter === 'success' && log.success) ||
          (successFilter === 'failed' && !log.success);
        
        // Clean dynamic role filter checking
        const matchesUserRole = userRoleFilter === 'all' || log.userRole === userRoleFilter;
        
        return matchesSearch && matchesAction && matchesSuccess && matchesUserRole;
      })
      .sort((a, b) => {
        let aValue: any = a[sortField as keyof Log];
        let bValue: any = b[sortField as keyof Log];
        
        if (sortField === 'timestamp') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }
        
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
  }, [logs, searchTerm, actionFilter, successFilter, userRoleFilter, sortField, sortDirection]);

  const displayLogs = useMemo(() => {
    return filteredAndSortedLogs.slice(0, Math.min(filteredAndSortedLogs.length, totalLogs));
  }, [filteredAndSortedLogs, totalLogs]);

  const uniqueActions = useMemo(() => {
    return [...new Set(logs.map(log => log.action))].sort();
  }, [logs]);

  const formatTimestamp = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  }, []);

  const getSeverityIcon = useCallback((severity: string) => {
    switch (severity) {
      case 'error':
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  }, []);

  const getActionIcon = useCallback((action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('login')) {
      return <LogIn className="w-4 h-4 text-blue-650 dark:text-blue-400" />;
    }
    if (actionLower.includes('logout')) {
      return <LogOut className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    if (actionLower.includes('create') || actionLower.includes('add')) {
      return <Plus className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) {
      return <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (actionLower.includes('delete') || actionLower.includes('remove')) {
      return <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (actionLower.includes('view')) {
      return <Eye className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    return <ActivityIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
  }, []);

  const getResourceIcon = useCallback((resource: string) => {
    const resourceLower = resource.toLowerCase();
    if (resourceLower.includes('user')) {
      return <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (resourceLower.includes('order')) {
      return <ShoppingBag className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (resourceLower.includes('fabric')) {
      return <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    if (resourceLower.includes('lab')) {
      return <TestTube className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (resourceLower.includes('log')) {
      return <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
    if (resourceLower.includes('system') || resourceLower.includes('config')) {
      return <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
    return <Hash className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
  }, []);

  const getActionBgColor = useCallback((action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('login')) {
      return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100';
    }
    if (actionLower.includes('logout')) {
      return isDarkMode ? 'bg-orange-900/30' : 'bg-orange-100';
    }
    if (actionLower.includes('create') || actionLower.includes('add')) {
      return isDarkMode ? 'bg-green-900/30' : 'bg-green-100';
    }
    if (actionLower.includes('update') || actionLower.includes('edit')) {
      return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100';
    }
    if (actionLower.includes('delete')) {
      return isDarkMode ? 'bg-red-900/30' : 'bg-red-100';
    }
    return isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100';
  }, [isDarkMode]);

  const getUserRoleIcon = useCallback((userRole: string) => {
    const roleLower = userRole?.toLowerCase() || '';
    if (roleLower.includes('master')) {
      return <Shield className="w-4.5 h-4.5 text-red-600 dark:text-red-400" />;
    }
    if (roleLower.includes('superadmin')) {
      return <Shield className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />;
    }
    if (roleLower.includes('admin')) {
      return <Shield className="w-4.5 h-4.5 text-purple-650 dark:text-purple-400" />;
    }
    if (roleLower.includes('party')) {
      return <Users className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />;
    }
    return <User className="w-4.5 h-4.5 text-blue-650 dark:text-blue-400" />;
  }, []);

  const getUserRoleBgColor = useCallback((userRole: string) => {
    const roleLower = userRole?.toLowerCase() || '';
    if (roleLower.includes('master')) {
      return isDarkMode ? 'bg-red-900/30' : 'bg-red-100';
    }
    if (roleLower.includes('superadmin')) {
      return isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-100';
    }
    if (roleLower.includes('admin')) {
      return isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100';
    }
    if (roleLower.includes('party')) {
      return isDarkMode ? 'bg-emerald-900/30' : 'bg-emerald-100';
    }
    return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100';
  }, [isDarkMode]);

  const getResourceBgColor = useCallback((resource: string) => {
    const resourceLower = resource.toLowerCase();
    if (resourceLower.includes('user')) {
      return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100';
    }
    if (resourceLower.includes('order')) {
      return isDarkMode ? 'bg-green-900/30' : 'bg-green-100';
    }
    if (resourceLower.includes('fabric')) {
      return isDarkMode ? 'bg-orange-900/30' : 'bg-orange-100';
    }
    if (resourceLower.includes('lab')) {
      return isDarkMode ? 'bg-red-900/30' : 'bg-red-100';
    }
    return isDarkMode ? 'bg-gray-900/30' : 'bg-gray-100';
  }, [isDarkMode]);

  const getSuccessStatus = useCallback((success: boolean) => {
    return success ? (
      <div className="flex items-center">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center mr-2 ${
          isDarkMode ? 'bg-green-900/30' : 'bg-green-50'
        }`}>
          <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
          isDarkMode 
            ? 'bg-green-900/50 text-green-300 border border-green-700' 
            : 'bg-green-50 text-green-700 border border-green-200 shadow-sm'
        }`}>
          Success
        </span>
      </div>
    ) : (
      <div className="flex items-center">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center mr-2 ${
          isDarkMode ? 'bg-red-900/30' : 'bg-red-50'
        }`}>
          <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
          isDarkMode 
            ? 'bg-red-900/50 text-red-300 border border-red-700' 
            : 'bg-red-50 text-red-700 border border-red-200 shadow-sm'
        }`}>
          Failed
        </span>
      </div>
    );
  }, [isDarkMode]);

  if (sessionLoading || isLoading) {
    return <LogsPageSkeleton />;
  }

  if (error && !sessionLoading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-[#1D293D]' : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className={`text-center p-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white/90'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} max-w-md`}>
            <div className={`w-16 h-16 mx-auto ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'} rounded-2xl flex items-center justify-center mb-4`}>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>Error Loading Logs</h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>{error}</p>
            <button 
              onClick={() => fetchLogs(false)}
              className={`px-6 py-3 text-sm font-medium rounded-xl transition-all duration-205 bg-blue-600 text-white hover:bg-blue-700 shadow-sm`}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#1D293D]' : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className={`inline-flex items-center px-4 py-2 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-white/80 backdrop-blur-sm'} shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} mb-3 sm:mb-4`}>
            <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">🔒 Secure Activity Audit Logs</span>
          </div>
          <h1 className={`text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            System Activity Monitor
          </h1>
          <p className={`text-xs sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Audit trail of system activity, logins, and critical updates (fabrics, orders, profiles) filtered by administrative roles.
          </p>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} p-4 sm:p-6 hover:shadow-xl transition-all duration-300`}>
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center mr-3 sm:mr-4`}>
                  <ActivityIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Logs</p>
                  <p className={`text-xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
                </div>
              </div>
            </div>

            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} p-4 sm:p-6 hover:shadow-xl transition-all duration-300`}>
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'} flex items-center justify-center mr-3 sm:mr-4`}>
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Successful</p>
                  <p className={`text-xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.successful}</p>
                </div>
              </div>
            </div>

            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} p-4 sm:p-6 hover:shadow-xl transition-all duration-300`}>
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'} flex items-center justify-center mr-3 sm:mr-4`}>
                  <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Failed Actions</p>
                  <p className={`text-xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.failed}</p>
                </div>
              </div>
            </div>

            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} p-4 sm:p-6 hover:shadow-xl transition-all duration-300`}>
              <div className="flex items-center">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100'} flex items-center justify-center mr-3 sm:mr-4`}>
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Unique Users</p>
                  <p className={`text-xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.uniqueUsers}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Filters */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} mb-6 sm:mb-8`}>
          <div className="p-4 sm:p-6 md:p-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center`}>
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center mr-2.5 sm:mr-3`}>
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                </div>
                Filters & Search
              </h3>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setDateFilter('all');
                  setActionFilter('all');
                  setSuccessFilter('all');
                  setUserRoleFilter('all');
                }}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                Clear All
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-2">
                  <label className={`block text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    🔍 Search logs, payloads & metadata
                  </label>
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <input
                      type="text"
                      placeholder="Search by user, action, order ID, changes, IP..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 sm:py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-205 ${
                        isDarkMode 
                          ? 'border-gray-600 bg-gray-700 text-white hover:border-gray-500' 
                          : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 shadow-sm'
                      }`}
                    />
                  </div>
                </div>
                
                <div className="flex md:hidden items-end">
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className={`w-full py-2.5 px-4 rounded-xl border font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center space-x-2 ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' 
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-55 shadow-sm'
                    }`}
                  >
                    <span>⚙️</span>
                    <span>{showMobileFilters ? 'Hide Filters' : 'Show Filters'}</span>
                    {(dateFilter !== 'all' || actionFilter !== 'all' || successFilter !== 'all' || userRoleFilter !== 'all') && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Advanced Dropdown selectors (expanded with Admin and Party roles) */}
              <div className={`${showMobileFilters ? 'grid' : 'hidden md:grid'} grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6`}>
                <div className="space-y-2">
                  <label className={`block text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    📅 Date Range
                  </label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className={`w-full px-3 py-2.5 sm:py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700 text-white' 
                        : 'border-gray-300 bg-white text-gray-900 shadow-sm'
                    }`}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={`block text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    ⚡ Action
                  </label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className={`w-full px-3 py-2.5 sm:py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700 text-white' 
                        : 'border-gray-300 bg-white text-gray-900 shadow-sm'
                    }`}
                  >
                    <option value="all">All Actions</option>
                    {uniqueActions.map(action => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={`block text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    ✅ Status
                  </label>
                  <select
                    value={successFilter}
                    onChange={(e) => setSuccessFilter(e.target.value)}
                    className={`w-full px-3 py-2.5 sm:py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700 text-white' 
                        : 'border-gray-300 bg-white text-gray-900 shadow-sm'
                    }`}
                  >
                    <option value="all">All Status</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={`block text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    👤 User Role
                  </label>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className={`w-full px-3 py-2.5 sm:py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700 text-white' 
                        : 'border-gray-300 bg-white text-gray-900 shadow-sm'
                    }`}
                  >
                    <option value="all">All Roles</option>
                    <option value="master">Master</option>
                    <option value="superadmin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                    <option value="party">Party</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logs Table / Cards Container */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} overflow-hidden`}>
          <div className={`px-4 sm:px-6 md:px-8 py-4 sm:py-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center`}>
                  <div className={`w-8 h-8 rounded-lg ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center mr-3`}>
                    <span className="text-blue-600 dark:text-blue-400 text-sm">🔒</span>
                  </div>
                  Activity Audit Logs ({displayLogs.length} of {totalLogs} total)
                </h2>
                {totalLogs > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center text-xs sm:text-sm">
                      <div className={`flex-1 rounded-full h-2 sm:h-3 mr-4 max-w-xs ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                        <div 
                          className={`h-2 sm:h-3 rounded-full transition-all duration-300 shadow-sm ${
                            isDarkMode 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                              : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                          }`}
                          style={{ width: `${Math.min((logs.length / totalLogs) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className={`font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {logs.length} of {totalLogs} loaded
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end space-x-2 sm:space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => fetchLogs(false)}
                  className={`flex items-center px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all duration-200 shadow-sm ${
                    isDarkMode 
                      ? 'text-gray-300 bg-gray-600 border border-gray-500 hover:bg-gray-550 hover:text-white' 
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  Refresh
                </button>
                {isLoadingMore && (
                  <div className={`flex items-center text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border ${
                    isDarkMode 
                      ? 'text-gray-400 bg-gray-600 border-gray-500' 
                      : 'text-gray-600 bg-white border-gray-300'
                  }`}>
                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
                    Loading...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className={`w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} sticky top-0 z-10`}>
                <tr>
                  <th 
                    className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'} uppercase tracking-wider cursor-pointer transition-colors w-24`}
                    onClick={() => {
                      setSortField('username');
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>👤 User</span>
                      {sortField === 'username' && <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'} uppercase tracking-wider cursor-pointer transition-colors w-32`}
                    onClick={() => {
                      setSortField('timestamp');
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>🕒 Date & Time</span>
                      {sortField === 'timestamp' && <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'} uppercase tracking-wider cursor-pointer transition-colors w-28`}
                    onClick={() => {
                      setSortField('action');
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>⚡ Action</span>
                      {sortField === 'action' && <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'} uppercase tracking-wider cursor-pointer transition-colors w-24`}
                    onClick={() => {
                      setSortField('resource');
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>📁 Resource</span>
                      {sortField === 'resource' && <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} uppercase tracking-wider w-20`}>
                    ✅ Status
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} uppercase tracking-wider w-20`}>
                    🚨 Level
                  </th>
                </tr>
              </thead>
              <tbody className={`${isDarkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'} divide-y`}>
                {displayLogs.map((log: Log, index: number) => (
                  <tr 
                    key={`${log._id}-${index}`} 
                    onClick={() => setSelectedLog(log)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedLog(log); }}
                    className={`cursor-pointer ${isDarkMode ? 'hover:bg-gray-700/80 focus:bg-gray-700' : 'hover:bg-gray-50 focus:bg-gray-100'} transition-all duration-200 border-l-4 border-transparent hover:border-l-blue-500 outline-none`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${getUserRoleBgColor(log.userRole)} rounded-lg flex items-center justify-center mr-3 shadow-inner`}>
                          {getUserRoleIcon(log.userRole)}
                        </div>
                        <div>
                          <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate max-w-16`}>
                            {log.username}
                          </div>
                          <div className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} capitalize font-semibold`}>
                            {log.userRole}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-100/50'} rounded-lg flex items-center justify-center mr-3`}>
                          <ClockIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {new Date(log.timestamp).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit', 
                              hour12: true 
                            })}
                          </div>
                          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {new Date(log.timestamp).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${getActionBgColor(log.action)} rounded-lg flex items-center justify-center mr-3`}>
                          {getActionIcon(log.action)}
                        </div>
                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate max-w-20`}>
                          {log.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${getResourceBgColor(log.resource)} rounded-lg flex items-center justify-center mr-3`}>
                          {getResourceIcon(log.resource)}
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate max-w-16`}>
                            {log.resource}
                          </div>
                          {log.resourceId && (
                            <div className={`text-[10px] font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              ID: {log.resourceId.slice(-6)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getSuccessStatus(log.success)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                          log.severity === 'critical' || log.severity === 'error' 
                            ? isDarkMode ? 'bg-red-900/30' : 'bg-red-100'
                            : log.severity === 'warning'
                            ? isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-100'
                            : isDarkMode ? 'bg-green-900/30' : 'bg-green-100'
                        }`}>
                          {getSeverityIcon(log.severity)}
                        </div>
                        <span className={`text-sm font-semibold capitalize ${
                          log.severity === 'critical' || log.severity === 'error'
                            ? isDarkMode ? 'text-red-400' : 'text-red-700'
                            : log.severity === 'warning'
                            ? isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
                            : isDarkMode ? 'text-green-400' : 'text-green-700'
                        }`}>
                          {log.severity}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (Clickable Cards) */}
          <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {displayLogs.map((log: Log, index: number) => (
              <div 
                key={`${log._id}-mobile-${index}`} 
                onClick={() => setSelectedLog(log)}
                className={`p-4 cursor-pointer active:scale-[0.99] transition-all ${
                  isDarkMode 
                    ? 'hover:bg-gray-750 bg-gray-800' 
                    : 'hover:bg-gray-50 bg-white'
                } border-l-4 border-transparent hover:border-l-blue-500`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-8 h-8 ${getUserRoleBgColor(log.userRole)} rounded-lg flex items-center justify-center`}>
                      {getUserRoleIcon(log.userRole)}
                    </div>
                    <div>
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} block`}>
                        {log.username}
                      </span>
                      <span className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} capitalize font-semibold`}>
                        {log.userRole}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col items-end">
                    <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center`}>
                      <ClockIcon className="w-3.5 h-3.5 mr-1 text-blue-500" />
                      {new Date(log.timestamp).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit', 
                        hour12: true 
                      })}
                    </span>
                    <span className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(log.timestamp).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-md ${getActionBgColor(log.action)} flex items-center justify-center mr-1.5`}>
                      {getActionIcon(log.action)}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${getActionBgColor(log.action)} ${
                      isDarkMode ? 'text-blue-300' : 'text-blue-800'
                    }`}>
                      {log.action}
                    </span>
                  </div>

                  <span className="text-gray-400 text-xs">→</span>

                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-md ${getResourceBgColor(log.resource)} flex items-center justify-center mr-1.5`}>
                      {getResourceIcon(log.resource)}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${getResourceBgColor(log.resource)} ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-800'
                    }`}>
                      {log.resource}
                    </span>
                    {log.resourceId && (
                      <span className={`ml-1.5 text-[10px] ${isDarkMode ? 'text-gray-450' : 'text-gray-450'} font-mono`}>
                        ({log.resourceId.slice(-6)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-2.5 mt-2.5 border-gray-100 dark:border-gray-700/50">
                  <div>
                    {getSuccessStatus(log.success)}
                  </div>

                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center mr-1.5 ${
                      log.severity === 'critical' || log.severity === 'error' 
                        ? isDarkMode ? 'bg-red-900/30' : 'bg-red-100'
                        : log.severity === 'warning'
                        ? isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-100'
                        : isDarkMode ? 'bg-green-900/30' : 'bg-green-100'
                    }`}>
                      {getSeverityIcon(log.severity)}
                    </div>
                    <span className={`text-xs font-semibold capitalize ${
                      log.severity === 'critical' || log.severity === 'error'
                        ? isDarkMode ? 'text-red-400' : 'text-red-700'
                        : log.severity === 'warning'
                        ? isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
                        : isDarkMode ? 'text-green-400' : 'text-green-700'
                    }`}>
                      {log.severity}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {displayLogs.length === 0 && (
            <div className="text-center py-16">
              <div className={`w-16 h-16 mx-auto ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-2xl flex items-center justify-center mb-4`}>
                <ActivityIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-2`}>No logs found</h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Try adjusting your search or filter criteria.
              </p>
            </div>
          )}

          {isLoadingMore && (
            <div className={`px-8 py-8 border-t ${isDarkMode ? 'border-gray-700 bg-gray-700/50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-4 mb-3">
                  <div className={`w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin ${isDarkMode ? 'border-blue-400' : 'border-blue-600'}`}></div>
                  <span className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Loading more logs...
                  </span>
                </div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Fetching next batch of logs
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div 
            className={`relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border ${
              isDarkMode 
                ? 'bg-gray-800/95 border-gray-750 text-white' 
                : 'bg-white/95 border-gray-200 text-gray-900'
            } shadow-2xl flex flex-col`}
          >
            {/* Modal Header */}
            <div className={`p-5 border-b flex items-center justify-between ${
              isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-150 bg-gray-50'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  getActionBgColor(selectedLog.action)
                }`}>
                  {getActionIcon(selectedLog.action)}
                </div>
                <div>
                  <h3 className="text-lg font-bold capitalize">
                    {selectedLog.action.replace(/_/g, ' ')}
                  </h3>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Resource: <span className="font-semibold">{selectedLog.resource}</span>
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  setSelectedLog(null);
                  setShowRawJson(false);
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-150 text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className="text-base font-bold">✕</span>
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-150'}`}>
                  <p className={`text-[10px] uppercase tracking-wider font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>User</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${getUserRoleBgColor(selectedLog.userRole)}`}>
                      {getUserRoleIcon(selectedLog.userRole)}
                    </div>
                    <span className="text-sm font-bold truncate">{selectedLog.username}</span>
                  </div>
                </div>
                
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-150'}`}>
                  <p className={`text-[10px] uppercase tracking-wider font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Date & Time</p>
                  <p className="text-sm font-bold mt-1.5">{formatTimestamp(selectedLog.timestamp)}</p>
                </div>
                
                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-150'}`}>
                  <p className={`text-[10px] uppercase tracking-wider font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>IP Address</p>
                  <p className="text-sm font-bold mt-1.5 truncate font-mono">{selectedLog.ipAddress || 'Unknown'}</p>
                </div>

                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-150'} col-span-2`}>
                  <p className={`text-[10px] uppercase tracking-wider font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>User Agent</p>
                  <p className="text-xs font-semibold mt-1 truncate" title={selectedLog.userAgent}>{selectedLog.userAgent || 'Unknown'}</p>
                </div>

                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-150'}`}>
                  <p className={`text-[10px] uppercase tracking-wider font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Severity & Status</p>
                  <div className="flex items-center space-x-2 mt-1.5">
                    <span className="text-sm capitalize font-bold">{selectedLog.severity}</span>
                    <span className="text-xs">•</span>
                    <span className={`text-xs font-bold ${selectedLog.success ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedLog.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedLog.resourceId && (
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-150'} flex justify-between items-center`}>
                  <div>
                    <p className={`text-[10px] uppercase tracking-wider font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Target Resource ID</p>
                    <p className="text-sm font-mono mt-1 select-all">{selectedLog.resourceId}</p>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(selectedLog.resourceId || '');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      isDarkMode 
                        ? 'border-gray-600 hover:bg-gray-700 text-gray-300' 
                        : 'border-gray-200 hover:bg-white text-gray-600 shadow-sm'
                    }`}
                  >
                    Copy ID
                  </button>
                </div>
              )}

              {selectedLog.details && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {showRawJson ? 'Raw JSON Payload' : 'Changes Audit trail'}
                    </h4>
                    
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => setShowRawJson(!showRawJson)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                          isDarkMode 
                            ? 'border-gray-600 hover:bg-gray-700 text-gray-300' 
                            : 'border-gray-200 hover:bg-white text-gray-600 shadow-sm'
                        }`}
                      >
                        {showRawJson ? 'Show Visual Diff' : 'Show Raw JSON'}
                      </button>

                      <button 
                        onClick={() => handleCopyJson(selectedLog.details)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                          isCopying
                            ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400'
                            : isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <span>{isCopying ? '✓ Copied' : 'Copy JSON'}</span>
                      </button>
                    </div>
                  </div>

                  {showRawJson ? (
                    <pre className={`p-4 rounded-xl border text-xs font-mono overflow-x-auto max-h-64 ${
                      isDarkMode 
                        ? 'bg-gray-900 border-gray-750 text-gray-300' 
                        : 'bg-gray-55 border-gray-200 text-gray-850'
                    }`}>
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  ) : (
                    <VisualDiffViewer 
                      oldValues={selectedLog.details.oldValues ?? (selectedLog.action.includes('delete') ? selectedLog.details : null)} 
                      newValues={selectedLog.details.newValues ?? (selectedLog.action.includes('create') ? selectedLog.details : null)}
                      isDarkMode={isDarkMode} 
                    />
                  )}
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-150 bg-gray-50'
            }`}>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setSearchTerm(selectedLog.username);
                    setSelectedLog(null);
                  }}
                  className={`flex-1 sm:flex-initial text-center px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                    isDarkMode 
                      ? 'border-gray-600 hover:bg-gray-700 text-gray-300' 
                      : 'border-gray-200 hover:bg-white text-gray-600 shadow-sm'
                  }`}
                >
                  Filter by User
                </button>
                <button
                  onClick={() => {
                    setActionFilter(selectedLog.action);
                    setSelectedLog(null);
                  }}
                  className={`flex-1 sm:flex-initial text-center px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                    isDarkMode 
                      ? 'border-gray-600 hover:bg-gray-700 text-gray-300' 
                      : 'border-gray-200 hover:bg-white text-gray-600 shadow-sm'
                  }`}
                >
                  Filter by Action
                </button>
              </div>
              
              <button 
                onClick={() => {
                  setSelectedLog(null);
                  setShowRawJson(false);
                }}
                className="w-full sm:w-auto text-center px-6 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
