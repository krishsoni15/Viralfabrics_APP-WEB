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
  const [isInfiniteScrollEnabled, setIsInfiniteScrollEnabled] = useState(true);
  const [sortField, setSortField] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Optimized fetch logs with better caching and performance
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
      
      // Build query parameters with optimized settings
      const params = new URLSearchParams();
      params.append('limit', '100'); // Increased for better performance
      params.append('includeStats', 'true');
      
      if (dateFilter !== 'all') {
        params.append('dateFilter', dateFilter);
      }
      
      // Add cursor for pagination
      if (loadMore && nextCursor) {
        params.append('cursor', nextCursor);
      }
      
      // Add timeout and abort controller for better performance
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
          // Append new logs to existing ones and remove duplicates
          setLogs(prevLogs => {
            const newLogs = data.logs || [];
            const existingIds = new Set(prevLogs.map(log => log._id));
            const uniqueNewLogs = newLogs.filter(log => !existingIds.has(log._id));
            return [...prevLogs, ...uniqueNewLogs];
          });
        } else {
          // Replace logs for new search/filter
          setLogs(data.logs || []);
        }
        
        // Update pagination state
        if (data.pagination) {
          setHasMore(data.pagination.hasMore);
          setNextCursor(data.pagination.nextCursor);
          setTotalLogs(data.pagination.total);
        }
        
        // Update stats only on first load
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

  // Load logs on component mount
  useEffect(() => {
    if (user && !sessionLoading) {
      fetchLogs(false);
    }
  }, [user, sessionLoading, dateFilter]);

  // Infinite scroll functionality
  useEffect(() => {
    if (!isInfiniteScrollEnabled) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Load more when user is near bottom (within 200px)
      if (scrollTop + windowHeight >= documentHeight - 200) {
        if (hasMore && !isLoadingMore && !isLoading) {
          loadMoreLogs();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, isLoading, isInfiniteScrollEnabled]);

  // Auto-load all logs if enabled (disabled for infinite scroll)
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

  // Function to load more logs
  const loadMoreLogs = () => {
    if (hasMore && !isLoadingMore && !isLoading) {
      fetchLogs(true);
    }
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!sessionLoading && !isLoading && !user) {
      router.push('/login');
    }
  }, [sessionLoading, isLoading, user, router]);

  // Optimized filtering and sorting with useMemo for better performance
  const filteredAndSortedLogs = useMemo(() => {
    return logs
      .filter(log => {
        // Exclude routine page view logs
        if (log.action === 'view' && log.resource === 'log') {
          return false;
        }
        
        // Only show important operations (exclude routine views)
        const importantActions = [
          'login', 'logout', 'login_failed', 'password_change', 'password_reset',
          'user_create', 'user_update', 'user_delete', 'user_activate', 'user_deactivate',
          'order_create', 'order_update', 'order_delete', 'order_status_change',
          'lab_create', 'lab_update', 'lab_delete', 'lab_status_change',
          'party_create', 'party_update', 'party_delete',
          'quality_create', 'quality_update', 'quality_delete',
          'fabric_create', 'fabric_update', 'fabric_delete', // Added fabric operations
          'file_upload', 'file_delete', 'file_download',
          'system_backup', 'system_restore', 'system_config_change',
          'export', 'import', 'search', 'filter'
        ];
        
        if (!importantActions.includes(log.action)) {
          return false;
        }
        
        const matchesSearch = searchTerm === '' || 
          log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.resource.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesAction = actionFilter === 'all' || log.action === actionFilter;
        const matchesSuccess = successFilter === 'all' || 
          (successFilter === 'success' && log.success) ||
          (successFilter === 'failed' && !log.success);
        
        const matchesUserRole = userRoleFilter === 'all' || 
          (userRoleFilter === 'user' && log.userRole === 'user') ||
          (userRoleFilter === 'superadmin' && log.userRole === 'superadmin');
        
        return matchesSearch && matchesAction && matchesSuccess && matchesUserRole;
      })
      .sort((a, b) => {
        let aValue: any = a[sortField as keyof Log];
        let bValue: any = b[sortField as keyof Log];
        
        // Handle timestamp sorting
        if (sortField === 'timestamp') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }
        
        // Handle string sorting
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

  // Ensure we don't show more logs than total
  const displayLogs = useMemo(() => {
    return filteredAndSortedLogs.slice(0, Math.min(filteredAndSortedLogs.length, totalLogs));
  }, [filteredAndSortedLogs, totalLogs]);

  // Get unique actions for filter dropdown
  const uniqueActions = useMemo(() => {
    return [...new Set(logs.map(log => log.action))].sort();
  }, [logs]);

  // Optimized utility functions with useCallback
  const formatTimestamp = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  }, []);

  // Get severity icon
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

  // Get action icon based on action type
  const getActionIcon = useCallback((action: string) => {
    const actionLower = action.toLowerCase();
    
    // Authentication actions
    if (actionLower.includes('login') || actionLower.includes('signin')) {
      return <LogIn className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (actionLower.includes('logout') || actionLower.includes('signout')) {
      return <LogOut className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    
    // User management actions
    if (actionLower.includes('create') || actionLower.includes('add')) {
      return <Plus className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) {
      return <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (actionLower.includes('delete') || actionLower.includes('remove')) {
      return <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (actionLower.includes('view') || actionLower.includes('read') || actionLower.includes('get')) {
      return <Eye className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    
    // Security actions
    if (actionLower.includes('auth') || actionLower.includes('authenticate')) {
      return <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }
    if (actionLower.includes('lock') || actionLower.includes('secure')) {
      return <Lock className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (actionLower.includes('unlock') || actionLower.includes('access')) {
      return <Unlock className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    
    // Data operations
    if (actionLower.includes('export') || actionLower.includes('download')) {
      return <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (actionLower.includes('import') || actionLower.includes('upload')) {
      return <Upload className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (actionLower.includes('refresh') || actionLower.includes('reload')) {
      return <RefreshCw className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    
    // Default action icon
    return <ActivityIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
  }, []);

  // Get resource icon based on resource type
  const getResourceIcon = useCallback((resource: string) => {
    const resourceLower = resource.toLowerCase();
    
    // User-related resources
    if (resourceLower.includes('user') || resourceLower.includes('profile')) {
      return <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (resourceLower.includes('admin') || resourceLower.includes('superadmin')) {
      return <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    
    // Order-related resources
    if (resourceLower.includes('order')) {
      return <ShoppingBag className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (resourceLower.includes('fabric')) {
      return <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    
    // Lab-related resources
    if (resourceLower.includes('lab')) {
      return <TestTube className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (resourceLower.includes('test') || resourceLower.includes('experiment')) {
      return <Microscope className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }
    
    // System resources
    if (resourceLower.includes('log')) {
      return <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
    if (resourceLower.includes('system') || resourceLower.includes('config')) {
      return <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
    if (resourceLower.includes('database') || resourceLower.includes('db')) {
      return <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    
    // Dashboard and analytics
    if (resourceLower.includes('dashboard') || resourceLower.includes('home')) {
      return <Home className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (resourceLower.includes('analytics') || resourceLower.includes('stats')) {
      return <BarChart3 className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    
    // Communication resources
    if (resourceLower.includes('email') || resourceLower.includes('mail')) {
      return <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (resourceLower.includes('phone') || resourceLower.includes('call')) {
      return <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (resourceLower.includes('notification') || resourceLower.includes('alert')) {
      return <BellIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    
    // Location and shipping
    if (resourceLower.includes('address') || resourceLower.includes('location')) {
      return <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
    if (resourceLower.includes('shipping') || resourceLower.includes('delivery')) {
      return <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    
    // Financial resources
    if (resourceLower.includes('payment') || resourceLower.includes('billing')) {
      return <CreditCard className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    if (resourceLower.includes('price') || resourceLower.includes('cost')) {
      return <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />;
    }
    
    // Manufacturing and production
    if (resourceLower.includes('factory') || resourceLower.includes('production')) {
      return <Factory className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
    if (resourceLower.includes('quality') || resourceLower.includes('qc')) {
      return <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    
    // Default resource icon
    return <Hash className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
  }, []);

  // Get action background color based on action type
  const getActionBgColor = useCallback((action: string) => {
    const actionLower = action.toLowerCase();
    
    // Authentication actions
    if (actionLower.includes('login') || actionLower.includes('signin')) {
      return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100';
    }
    if (actionLower.includes('logout') || actionLower.includes('signout')) {
      return isDarkMode ? 'bg-orange-900/30' : 'bg-orange-100';
    }
    
    // User management actions
    if (actionLower.includes('create') || actionLower.includes('add')) {
      return isDarkMode ? 'bg-green-900/30' : 'bg-green-100';
    }
    if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) {
      return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100';
    }
    if (actionLower.includes('delete') || actionLower.includes('remove')) {
      return isDarkMode ? 'bg-red-900/30' : 'bg-red-100';
    }
    if (actionLower.includes('view') || actionLower.includes('read') || actionLower.includes('get')) {
      return isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100';
    }
    
    // Security actions
    if (actionLower.includes('auth') || actionLower.includes('authenticate')) {
      return isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-100';
    }
    if (actionLower.includes('lock') || actionLower.includes('secure')) {
      return isDarkMode ? 'bg-red-900/30' : 'bg-red-100';
    }
    if (actionLower.includes('unlock') || actionLower.includes('access')) {
      return isDarkMode ? 'bg-green-900/30' : 'bg-green-100';
    }
    
    // Default action background
    return isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100';
  }, [isDarkMode]);

  // Get user role icon based on user role
  const getUserRoleIcon = useCallback((userRole: string) => {
    const roleLower = userRole.toLowerCase();
    
    if (roleLower.includes('superadmin') || roleLower.includes('admin')) {
      return <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    
    // Default user icon
    return <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  }, []);

  // Get user role background color based on user role
  const getUserRoleBgColor = useCallback((userRole: string) => {
    const roleLower = userRole.toLowerCase();
    
    if (roleLower.includes('superadmin') || roleLower.includes('admin')) {
      return isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100';
    }
    
    // Default user background
    return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100';
  }, [isDarkMode]);

  // Get resource background color based on resource type
  const getResourceBgColor = useCallback((resource: string) => {
    const resourceLower = resource.toLowerCase();
    
    // User-related resources
    if (resourceLower.includes('user') || resourceLower.includes('profile')) {
      return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100';
    }
    if (resourceLower.includes('admin') || resourceLower.includes('superadmin')) {
      return isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100';
    }
    
    // Order-related resources
    if (resourceLower.includes('order')) {
      return isDarkMode ? 'bg-green-900/30' : 'bg-green-100';
    }
    if (resourceLower.includes('fabric')) {
      return isDarkMode ? 'bg-orange-900/30' : 'bg-orange-100';
    }
    
    // Lab-related resources
    if (resourceLower.includes('lab')) {
      return isDarkMode ? 'bg-red-900/30' : 'bg-red-100';
    }
    if (resourceLower.includes('test') || resourceLower.includes('experiment')) {
      return isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-100';
    }
    
    // System resources
    if (resourceLower.includes('log')) {
      return isDarkMode ? 'bg-gray-900/30' : 'bg-gray-100';
    }
    if (resourceLower.includes('system') || resourceLower.includes('config')) {
      return isDarkMode ? 'bg-gray-900/30' : 'bg-gray-100';
    }
    if (resourceLower.includes('database') || resourceLower.includes('db')) {
      return isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100';
    }
    
    // Default resource background
    return isDarkMode ? 'bg-gray-900/30' : 'bg-gray-100';
  }, [isDarkMode]);

  // Get success status
  const getSuccessStatus = useCallback((success: boolean) => {
    return success ? (
      <div className="flex items-center">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center mr-2 ${
          isDarkMode ? 'bg-green-900/30' : 'bg-green-50'
        }`}>
          <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
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
          <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
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

  // Show skeleton when loading
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
              className={`px-6 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                isDarkMode 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              }`}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className={`inline-flex items-center px-4 py-2 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-white/80 backdrop-blur-sm'} shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} mb-4`}>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">🔒 Important Activity Logs</span>
          </div>
          <h1 className={`text-4xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            System Activity Monitor
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Critical system operations and user actions (excluding routine page views)
          </p>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} p-6 hover:shadow-xl transition-all duration-300`}>
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-xl ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center mr-4`}>
                  <ActivityIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Logs</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
                </div>
              </div>
            </div>
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} p-6 hover:shadow-xl transition-all duration-300`}>
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-xl ${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'} flex items-center justify-center mr-4`}>
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Successful</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.successful}</p>
                </div>
              </div>
            </div>
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} p-6 hover:shadow-xl transition-all duration-300`}>
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-xl ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'} flex items-center justify-center mr-4`}>
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Failed</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.failed}</p>
                </div>
              </div>
            </div>
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} p-6 hover:shadow-xl transition-all duration-300`}>
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-xl ${isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100'} flex items-center justify-center mr-4`}>
                  <User className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Unique Users</p>
                  <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.uniqueUsers}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Filters */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} mb-8`}>
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center`}>
                <div className={`w-10 h-10 rounded-xl ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center mr-3`}>
                  <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                Clear All
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
              {/* Search */}
              <div className="space-y-3">
                <label className={`block text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  🔍 Search
                </label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      isDarkMode 
                        ? 'border-gray-600 bg-gray-700 text-white hover:border-gray-500' 
                        : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 shadow-sm'
                    }`}
                  />
                </div>
              </div>

              {/* Date Filter */}
              <div className="space-y-3">
                <label className={`block text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  📅 Date Range
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className={`w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    isDarkMode 
                      ? 'border-gray-600 bg-gray-700 text-white hover:border-gray-500' 
                      : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 shadow-sm'
                  }`}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>

              {/* Action Filter */}
              <div className="space-y-3">
                <label className={`block text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  ⚡ Action
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className={`w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    isDarkMode 
                      ? 'border-gray-600 bg-gray-700 text-white hover:border-gray-500' 
                      : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 shadow-sm'
                  }`}
                >
                  <option value="all">All Actions</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>

              {/* Success Filter */}
              <div className="space-y-3">
                <label className={`block text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  ✅ Status
                </label>
                <select
                  value={successFilter}
                  onChange={(e) => setSuccessFilter(e.target.value)}
                  className={`w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    isDarkMode 
                      ? 'border-gray-600 bg-gray-700 text-white hover:border-gray-500' 
                      : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 shadow-sm'
                  }`}
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* User Role Filter */}
              <div className="space-y-3">
                <label className={`block text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  👤 User Role
                </label>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className={`w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    isDarkMode 
                      ? 'border-gray-600 bg-gray-700 text-white hover:border-gray-500' 
                      : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 shadow-sm'
                  }`}
                >
                  <option value="all">All Users</option>
                  <option value="user">User</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>

              {/* Infinite Scroll Toggle */}
              <div className="space-y-3">
                <label className={`block text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  🔄 Auto Load
                </label>
                <div className="flex items-center h-12">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="infiniteScroll"
                      checked={isInfiniteScrollEnabled}
                      onChange={(e) => setIsInfiniteScrollEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 ${
                      isDarkMode 
                        ? 'bg-gray-700 after:border-gray-600' 
                        : 'bg-gray-200 after:border-gray-300'
                    }`}></div>
                    <span className={`ml-3 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {isInfiniteScrollEnabled ? 'On' : 'Off'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/90 backdrop-blur-sm'} rounded-2xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200/50'} overflow-hidden`}>
          <div className={`px-8 py-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center`}>
                  <div className={`w-8 h-8 rounded-lg ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center mr-3`}>
                    <span className="text-blue-600 dark:text-blue-400">🔒</span>
                  </div>
                  Activity Logs ({displayLogs.length} of {totalLogs} total)
                </h2>
                {totalLogs > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center text-sm">
                      <div className={`flex-1 rounded-full h-3 mr-4 max-w-xs ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 shadow-sm ${
                            isDarkMode 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                              : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                          }`}
                          style={{ width: `${Math.min((logs.length / totalLogs) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {logs.length} of {totalLogs} loaded
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => fetchLogs(false)}
                  className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm ${
                    isDarkMode 
                      ? 'text-gray-300 bg-gray-600 border border-gray-500 hover:bg-gray-500 hover:text-white' 
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </button>
                {isLoadingMore && (
                  <div className={`flex items-center text-sm px-4 py-2.5 rounded-xl border ${
                    isDarkMode 
                      ? 'text-gray-400 bg-gray-600 border-gray-500' 
                      : 'text-gray-600 bg-white border-gray-300'
                  }`}>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </div>
                )}
                {hasMore && !isInfiniteScrollEnabled && (
                  <button
                    onClick={loadMoreLogs}
                    disabled={isLoadingMore}
                    className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 ${
                      isDarkMode 
                        ? 'text-blue-300 bg-blue-900/50 border border-blue-700 hover:bg-blue-900' 
                        : 'text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Load More
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className={`w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} sticky top-0 z-10`}>
                <tr>
                  <th 
                    className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'} uppercase tracking-wider cursor-pointer transition-colors w-24`}
                    onClick={() => {
                      if (sortField === 'username') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('username');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>👤 User</span>
                      {sortField === 'username' && (
                        <span className="text-blue-500">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'} uppercase tracking-wider cursor-pointer transition-colors w-32`}
                    onClick={() => {
                      if (sortField === 'timestamp') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('timestamp');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>🕒 Date & Time</span>
                      {sortField === 'timestamp' && (
                        <span className="text-blue-500">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'} uppercase tracking-wider cursor-pointer transition-colors w-28`}
                    onClick={() => {
                      if (sortField === 'action') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('action');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>⚡ Action</span>
                      {sortField === 'action' && (
                        <span className="text-blue-500">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'} uppercase tracking-wider cursor-pointer transition-colors w-24`}
                    onClick={() => {
                      if (sortField === 'resource') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('resource');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>📁 Resource</span>
                      {sortField === 'resource' && (
                        <span className="text-blue-500">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
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
                  <tr key={`${log._id}-${index}`} className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50/80'} transition-all duration-200 border-l-4 border-transparent hover:border-l-blue-500`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${getUserRoleBgColor(log.userRole)} rounded-lg flex items-center justify-center mr-3`}>
                          {getUserRoleIcon(log.userRole)}
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate max-w-16`}>
                            {log.username}
                          </div>
                          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} capitalize`}>
                            {log.userRole}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} rounded-lg flex items-center justify-center mr-3`}>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${getActionBgColor(log.action)} rounded-lg flex items-center justify-center mr-3`}>
                          {getActionIcon(log.action)}
                        </div>
                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate max-w-20`}>
                          {log.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${getResourceBgColor(log.resource)} rounded-lg flex items-center justify-center mr-3`}>
                          {getResourceIcon(log.resource)}
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate max-w-16`}>
                            {log.resource}
                          </div>
                          {log.resourceId && (
                            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {log.resourceId}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSuccessStatus(log.success)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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

          {/* Enhanced Infinite Scroll Loading Indicator */}
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
    </div>
  );
}
