'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  TableCellsIcon,
  Squares2X2Icon,
  EyeIcon,
  EyeSlashIcon,
  ChevronDownIcon,
  FunnelIcon,
  CameraIcon,
  CloudArrowUpIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { useDarkMode } from '../hooks/useDarkMode';
import UserCardView from './components/UserCardView';
import { useRealtimeSync } from '@/app/hooks/useRealtimeSync';
import CameraModal from '../components/CameraModal';
import { useAppStore } from '@/app/store/useAppStore';

interface User {
  _id: string;
  name: string;
  username: string;
  phoneNumber?: string;
  address?: string;
  role: string;
  isActive: boolean;
  partyId?: { _id: string; name: string } | string;
  profilePhoto?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserFormData {
  name: string;
  username: string;
  password: string;
  phoneNumber: string;
  address: string;
  role: string;
  partyId?: string;
  profilePhoto?: string;
}

// Helper function to generate the next incremented username for a party
const getNextUsername = (partyName: string, existingUsers: User[]): string => {
  const base = partyName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  if (!Array.isArray(existingUsers)) return `${base}_01`;

  const pattern = new RegExp(`^${base}(?:_(\\d+))?$`);
  let maxSuffix = 0;
  let hasMatch = false;

  existingUsers.forEach(u => {
    if (!u.username) return;
    const username = u.username.toLowerCase().trim();
    const match = username.match(pattern);
    if (match) {
      hasMatch = true;
      if (match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSuffix) {
          maxSuffix = num;
        }
      }
    }
  });

  const nextSuffix = maxSuffix > 0 ? maxSuffix + 1 : 1;
  const suffixStr = String(nextSuffix).padStart(2, '0');
  return `${base}_${suffixStr}`;
};

export default function UsersPage() {
  const router = useRouter();
  const { isDarkMode, mounted } = useDarkMode();
  // Load cached data immediately for instant display
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const cached = localStorage.getItem('users-cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) { // 5 minutes
          return data || [];
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return [];
  });
  const [loading, setLoading] = useState(users.length === 0); // Only show loading if no cached data
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [dateSort, setDateSort] = useState<'latest' | 'oldest'>('latest');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [screenSize, setScreenSize] = useState<number>(0);
  const { user: currentUser, setUser: setStoreUser } = useAppStore();
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    username: '',
    password: '',
    phoneNumber: '',
    address: '',
    role: 'user',
    partyId: '',
    profilePhoto: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<UserFormData>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      username: '',
      password: '',
      phoneNumber: '',
      address: '',
      role: 'user',
      partyId: '',
      profilePhoto: ''
    });
    setFormErrors({});
    setShowPassword(false);
    setPartySearch('');
    setPartyDropdownOpen(false);
  }, []);

  const handlePhotoUpload = async (file: File) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (!file.type.startsWith('image/')) {
      setValidationAlert({ type: 'error', text: 'Only image files are allowed.' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setValidationAlert({ type: 'error', text: 'File size must be less than 10MB.' });
      return;
    }

    try {
      setUploadingPhoto(true);
      const token = localStorage.getItem('token');
      const formDataPayload = new FormData();
      formDataPayload.append('file', file);
      formDataPayload.append('folder', 'profiles');

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataPayload
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && (data.url || data.imageUrl)) {
        const url = data.url || data.imageUrl;
        setFormData(prev => ({ ...prev, profilePhoto: url }));
        setValidationAlert({ type: 'success', text: 'Photo uploaded successfully' });
        setTimeout(() => setValidationAlert(null), 3000);
      } else {
        throw new Error(data.message || 'Upload failed: No URL received');
      }
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setValidationAlert({ type: 'error', text: err.message || 'Failed to upload photo.' });
      setTimeout(() => setValidationAlert(null), 5000);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCameraCapture = async (file: File) => {
    setShowCamera(false);
    await handlePhotoUpload(file);
  };
  
  // Party state management for Party role user creation
  const [parties, setParties] = useState<any[]>([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [newPartyForm, setNewPartyForm] = useState({
    name: '',
    contactName: '',
    contactPhone: '',
    address: ''
  });
  const [savingParty, setSavingParty] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [partySearch, setPartySearch] = useState('');
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // ⚡ FIX: Track deleting state for button disable
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validationAlert, setValidationAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'All'>(() => {
    if (typeof window !== 'undefined') {
      const savedItemsPerPage = localStorage.getItem('usersItemsPerPage');
      if (savedItemsPerPage) {
        if (savedItemsPerPage === 'All') {
          return 'All';
        }
        const parsed = parseInt(savedItemsPerPage, 10);
        // Validate it's one of the allowed options
        if ([10, 25, 50, 100].includes(parsed)) {
          return parsed;
        }
      }
    }
    return 10;
  });
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPageOptions = [10, 25, 50, 100, 'All'] as const; // Standard pagination options
  const fetchInProgress = useRef(false); // Prevent multiple simultaneous fetches
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Load view mode from cache on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('usersViewMode');
      if (savedMode === 'table' || savedMode === 'card') {
        setViewMode(savedMode);
      } else {
        const isMobile = window.innerWidth < 768;
        setViewMode(isMobile ? 'card' : 'table');
      }
    }
  }, []);

  // Screen resize listener to auto-switch viewMode if user has no saved preference
  useEffect(() => {
    const handleResize = () => {
      const savedMode = localStorage.getItem('usersViewMode');
      if (savedMode === 'table' || savedMode === 'card') {
        return; // Respect user preference
      }
      const isMobile = window.innerWidth < 768;
      setViewMode(isMobile ? 'card' : 'table');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [showFilters, setShowFilters] = useState(false);



  // Track screen size
  useEffect(() => {
    const handleResize = () => {
      setScreenSize(window.innerWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddPartyModal) {
          setShowAddPartyModal(false);
        } else if (showCreateModal) {
          setShowCreateModal(false);
          resetForm();
        } else if (showEditModal) {
          setShowEditModal(false);
          resetForm();
        } else if (showDeleteModal) {
          setShowDeleteModal(false);
          setSelectedUser(null);
        } else if (showProfileModal) {
          setShowProfileModal(false);
          setSelectedUser(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddPartyModal, showCreateModal, showEditModal, showDeleteModal, showProfileModal, resetForm]);

  const isLargeScreen = screenSize > 1000;
  const isMediumScreen = screenSize > 600;
  const isSmallScreen = screenSize > 500;
  const isTinyScreen = screenSize <= 500;

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (fetchInProgress.current) {
      return;
    }
    
    fetchInProgress.current = true;
    setLoading(true);
    
    try {
      // Get token from localStorage for authorization
      const token = localStorage.getItem('token');
      if (!token) {
        setMessage({ type: 'error', text: 'No authentication token found. Please log in again.' });
        setLoading(false);
        fetchInProgress.current = false;
        return;
      }

      const response = await fetch(`/api/users-instant?t=${Date.now()}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const usersData = data.data?.users || [];
          
          // Update total count
          setTotalCount(data.data?.pagination?.totalCount || 0);
          
          // Merge with existing users to preserve newly created users that might not be in backend yet
          setUsers((prevUsers: User[]) => {
            // Always merge to preserve newly created users
            // Create a map of fetched users by _id for quick lookup
            const fetchedUsersMap = new Map(usersData.map((u: any) => [String(u._id), u]));
            
            // If we have existing users, add them if they're not in fetched data
            if (prevUsers && Array.isArray(prevUsers) && prevUsers.length > 0) {
              prevUsers.forEach(existingUser => {
                const userId = String(existingUser._id);
                if (!fetchedUsersMap.has(userId)) {
                  // This is a newly created user that's not in backend yet, keep it
                  fetchedUsersMap.set(userId, existingUser);
                }
              });
            }
            
            // Convert map back to array and sort by createdAt
            const mergedUsers = Array.from(fetchedUsersMap.values()).sort((a: any, b: any) => {
              const dateA = new Date(a.createdAt || 0).getTime();
              const dateB = new Date(b.createdAt || 0).getTime();
              return dateSort === 'latest' ? dateB - dateA : dateA - dateB;
            });
            
            return mergedUsers as User[];
          });
          
          setMessage(null);
          
          // Save to localStorage for instant loading on page refresh
          // We'll update cache after state is set using useEffect
        } else {
          // Show error message if API returned success: false
          setMessage({ type: 'error', text: data.message || 'Failed to fetch users' });
          if (process.env.NODE_ENV === 'development') {
            console.error('Users API error:', data);
          }
        }
      } else {
        // Handle non-OK responses
        try {
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch users' }));
          setMessage({ type: 'error', text: errorData.message || `Error: ${response.status}` });
          if (process.env.NODE_ENV === 'development') {
            console.error('Users fetch failed:', response.status, errorData);
          }
        } catch (parseError) {
          setMessage({ type: 'error', text: `Error: ${response.status}` });
        }
      }
    } catch (error: any) {
      // Show error to user
      setMessage({ type: 'error', text: error.message || 'Failed to fetch users' });
      if (process.env.NODE_ENV === 'development') {
        console.error('Users fetch error:', error);
      }
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    // Fetch fresh data on mount only
    fetchUsers();
    
    // Lightweight prefetching for navigation (no API calls)
    const preloadPages = () => {
      router.prefetch('/dashboard');
      router.prefetch('/orders');
      router.prefetch('/fabrics');
    };
    
    // Start preloading pages after a short delay
    const timer = setTimeout(preloadPages, 500);
    return () => clearTimeout(timer);
  }, []);
  
  // Update localStorage cache when users state changes (but not during fetch)
  useEffect(() => {
    if (users.length > 0 && !loading && !fetchInProgress.current) {
      try {
        localStorage.setItem('users-cache', JSON.stringify({
          data: users,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }, [users, loading]);

  // Simple refresh - no complex logic
  const handleRefresh = useCallback(async () => {
    if (fetchInProgress.current) {
      return;
    }
    await fetchUsers();
  }, [fetchUsers]);

  // Simple retry - no messages
  const handleRetry = useCallback(() => {
    if (fetchInProgress.current) {
      return;
    }
    fetchUsers();
  }, [fetchUsers]);

  // Pagination handlers
  const handlePageChange = useCallback(async (newPage: number) => {
    if (newPage === currentPage || isChangingPage || loading) return;
    
    setIsChangingPage(true);
    setCurrentPage(newPage);
    // No need to fetch from server - client-side pagination handles this
    setIsChangingPage(false);
  }, [currentPage, isChangingPage, loading]);

  const handleItemsPerPageChange = useCallback(async (newItemsPerPage: number | 'All') => {
    if (newItemsPerPage === itemsPerPage) return;
    
    setIsChangingPage(true);
    setItemsPerPage(newItemsPerPage);
    // Save to localStorage to persist across page refreshes
    if (typeof window !== 'undefined') {
      localStorage.setItem('usersItemsPerPage', newItemsPerPage.toString());
    }
    setCurrentPage(1); // Reset to first page
    
    // No need to fetch users again - we're using client-side pagination
    // The pagination will update automatically when itemsPerPage changes
    setIsChangingPage(false);
  }, [itemsPerPage]);

  // Filter and sort users
  // Memoized filtering for better performance
  const filteredUsers = useMemo(() => {
    const usersArray = Array.isArray(users) ? users : [];
    return usersArray
      .filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             user.username.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateSort === 'latest' ? dateB - dateA : dateA - dateB;
      });
  }, [users, searchTerm, roleFilter, dateSort]);

  // Calculate total pages based on filtered users (client-side pagination)
  const totalPages = useMemo(() => {
    // If "All" selected, show all on one page
    if (itemsPerPage === 'All') return 1;
    
    const itemsPerPageValue = itemsPerPage as number;
    const calculatedPages = Math.ceil(filteredUsers.length / itemsPerPageValue);
    const result = Math.max(1, calculatedPages);
    
    // Debug logging
    console.log('Pagination Debug:', {
      filteredUsersLength: filteredUsers.length,
      itemsPerPageValue,
      calculatedPages,
      result,
      shouldShowPagination: result > 1,
      currentPage,
      isChangingPage
    });
    
    return result;
  }, [filteredUsers, itemsPerPage, currentPage, isChangingPage]);

  // Calculate pagination display info for client-side pagination
  const paginationDisplayInfo = useMemo(() => {
    // If "All" selected, show all on one page
    if (itemsPerPage === 'All') {
      return {
        showing: filteredUsers.length,
        total: filteredUsers.length,
        start: filteredUsers.length > 0 ? 1 : 0,
        end: filteredUsers.length
      };
    } else {
      const start = filteredUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
      const end = Math.min(currentPage * itemsPerPage, filteredUsers.length);
      return {
        showing: end - start + 1,
        total: filteredUsers.length,
        start: start,
        end: end
      };
    }
  }, [filteredUsers, itemsPerPage, currentPage]);

  // Apply client-side pagination
  const currentUsers = useMemo(() => {
    if (itemsPerPage === 'All') {
      return filteredUsers; // Show all users only when "All" is selected
    } else {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      return filteredUsers.slice(startIndex, endIndex);
    }
  }, [filteredUsers, itemsPerPage, currentPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, dateSort]);

  // Auto-correct current page if it exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Show message
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // ⚡ FIX: Add ref to prevent multiple simultaneous creates
  const creatingRef = useRef(false);
  // ⚡ FIX: Add ref to prevent multiple simultaneous updates
  const updatingRef = useRef(false);

  // Create user
  const handleCreateUser = async () => {
    // ⚡ FIX: Prevent multiple simultaneous creates
    if (creatingRef.current || submitting) {
      console.log('⚠️ Create already in progress, ignoring duplicate request');
      return;
    }

    // ⚡ FIX: Remove frontend validation - let backend handle it
    // Only basic checks to prevent unnecessary API calls
    if (!formData.name.trim() || !formData.username.trim() || !formData.password.trim() || (formData.role === 'party' && !formData.partyId)) {
      setFormErrors({ 
        name: !formData.name.trim() ? 'Required' : undefined,
        username: !formData.username.trim() ? 'Required' : undefined,
        password: !formData.password.trim() ? 'Required' : undefined,
        partyId: (formData.role === 'party' && !formData.partyId) ? 'Party selection is required' : undefined
      });
      return;
    }

    creatingRef.current = true;
    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setValidationAlert({ type: 'error', text: 'Please login to create user' });
        setTimeout(() => setValidationAlert(null), 5000);
        return;
      }

      // ⚡ FIX: Call backend API - backend will validate
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { success: false, message: responseText || 'Create failed' };
      }

      if (response.ok && data.success !== false) {
        const newUser = data.user || data.data;
        
        // Update UI immediately with new user
        if (newUser) {
          setUsers(prevUsers => {
            // Ensure prevUsers is an array
            if (!Array.isArray(prevUsers)) {
              return [newUser];
            }
            
            // Check if user already exists (avoid duplicates)
            const exists = prevUsers.some(u => String(u._id) === String(newUser._id) || u.username === newUser.username);
            if (exists) {
              // Update existing instead of adding duplicate
              return prevUsers.map(u => 
                (String(u._id) === String(newUser._id) || u.username === newUser.username) ? newUser : u
              );
            }
            // Add new user and sort by date
            const newUsers = [newUser, ...prevUsers];
            return newUsers.sort((a, b) => {
              const dateA = new Date(a.createdAt || 0).getTime();
              const dateB = new Date(b.createdAt || 0).getTime();
              return dateSort === 'latest' ? dateB - dateA : dateA - dateB;
            });
          });
          setTotalCount(prev => prev + 1);
          
          // localStorage cache will be updated by useEffect when users state changes
        }
        
        // Close modal and reset form
        setShowCreateModal(false);
        resetForm();
        setValidationAlert({ type: 'success', text: 'User created successfully' });
        setTimeout(() => setValidationAlert(null), 3000);
      } else {
        // ⚡ FIX: Backend validation error - show backend message
        const errorMessage = data.message || 'Create failed';
        setFormErrors(data.errors || {});
        setValidationAlert({ type: 'error', text: errorMessage });
        setTimeout(() => setValidationAlert(null), 5000);
      }
    } catch (error: any) {
      console.error('Create user error:', error);
      setValidationAlert({ type: 'error', text: `Error: ${error.message || 'Failed to create user. Please try again.'}` });
      setTimeout(() => setValidationAlert(null), 5000);
    } finally {
      setSubmitting(false);
      creatingRef.current = false;
    }
  };

  // Update user
  const handleUpdateUser = async () => {
    // ⚡ FIX: Prevent multiple simultaneous updates
    if (updatingRef.current || submitting) {
      console.log('⚠️ Update already in progress, ignoring duplicate request');
      return;
    }

    // ⚡ FIX: Re-fetch selectedUser from users list if it's missing or doesn't have _id
    let userToUpdate = selectedUser;
    if (!userToUpdate || !userToUpdate._id) {
      // Try to find user from formData if we have username
      if (formData.username) {
        userToUpdate = users.find(u => String(u.username) === String(formData.username)) || null;
      }
      
      if (!userToUpdate || !userToUpdate._id) {
        console.error('❌ No user selected or user missing _id:', { selectedUser, formData });
        setValidationAlert({ type: 'error', text: 'No user selected. Please close and reopen the edit modal.' });
        setTimeout(() => setValidationAlert(null), 5000);
        return;
      }
      
      // Update selectedUser state with the found user
      setSelectedUser(userToUpdate);
    }
    
    // ⚡ FIX: Get the latest user data from the list to ensure we have the most up-to-date _id
    const latestUser = users.find(u => String(u._id) === String(userToUpdate._id));
    if (!latestUser) {
      console.error('❌ User not found in list:', userToUpdate._id);
      setValidationAlert({ type: 'error', text: 'User not found in list. Please refresh the page.' });
      setTimeout(() => setValidationAlert(null), 5000);
      return;
    }
    
    setFormErrors({});
    const errors: Partial<UserFormData> = {};
    
    if (!formData.name.trim()) errors.name = 'Required';
    if (!formData.username.trim()) errors.username = 'Required';
    if (!formData.role.trim()) errors.role = 'Required';
    if (formData.role === 'party' && !formData.partyId) errors.partyId = 'Party selection is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    updatingRef.current = true;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const updateData: Partial<UserFormData> = { ...formData };
      if (!updateData.password || updateData.password.trim() === '') {
        delete updateData.password;
      }
      
      // ⚡ FIX: Use the latest user's _id to ensure we're updating the correct user
      const userIdToUpdate = latestUser._id;
      const response = await fetch(`/api/users/${userIdToUpdate}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const data = await response.json();
        const updatedUser = data.user;
        
        // ⚡ FIX: Ensure updatedUser has _id - use the userIdToUpdate if missing
        if (!updatedUser._id) {
          updatedUser._id = userIdToUpdate;
        }
        
        // Update the users list with the new user data
        setUsers(prevUsers => {
          if (!Array.isArray(prevUsers)) return [];
          return prevUsers.map(user => 
            String(user._id) === String(userIdToUpdate) ? updatedUser : user
          );
        });
        
        // ⚡ FIX: Update selectedUser with the latest data so we can edit again immediately
        // Ensure selectedUser always has _id and all required fields
        const userWithId = { 
          ...updatedUser, 
          _id: updatedUser._id || userIdToUpdate,
          name: updatedUser.name || formData.name,
          username: updatedUser.username || formData.username,
          phoneNumber: updatedUser.phoneNumber || formData.phoneNumber || '',
          address: updatedUser.address || formData.address || '',
          role: updatedUser.role || formData.role,
          profilePhoto: updatedUser.profilePhoto || '',
          isActive: updatedUser.isActive !== undefined ? updatedUser.isActive : true,
          createdAt: updatedUser.createdAt || latestUser.createdAt,
          updatedAt: updatedUser.updatedAt || new Date().toISOString()
        };
        setSelectedUser(userWithId);
        
        // ⚡ FIX: Update form data with the updated user data so the form shows the latest values
        setFormData({
          name: updatedUser.name || formData.name,
          username: updatedUser.username || formData.username,
          password: '', // Clear password field after update
          phoneNumber: updatedUser.phoneNumber || formData.phoneNumber || '',
          address: updatedUser.address || formData.address || '',
          role: updatedUser.role || formData.role,
          profilePhoto: updatedUser.profilePhoto || ''
        });
        
        // Update currentUser if the updated user is the current user
        if (currentUser && String(currentUser._id) === String(userIdToUpdate)) {
          setStoreUser({
            _id: updatedUser._id,
            name: updatedUser.name || formData.name,
            username: updatedUser.username || formData.username,
            role: updatedUser.role || formData.role,
            phoneNumber: updatedUser.phoneNumber || formData.phoneNumber || '',
            address: updatedUser.address || formData.address || '',
            profilePhoto: updatedUser.profilePhoto || ''
          });
          // Update localStorage as well
          try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
              const user = JSON.parse(userStr);
              user._id = updatedUser._id;
              user.username = updatedUser.username;
              user.name = updatedUser.name;
              user.role = updatedUser.role;
              user.phoneNumber = updatedUser.phoneNumber;
              user.address = updatedUser.address;
              user.profilePhoto = updatedUser.profilePhoto;
              localStorage.setItem('user', JSON.stringify(user));
            }
          } catch (e) {
            // Ignore localStorage errors
          }
        }
        
        // Update localStorage cache
        try {
          const cached = localStorage.getItem('users-cache');
          if (cached) {
            const { data: cachedData, timestamp } = JSON.parse(cached);
            const updatedData = cachedData.map((user: User) => 
              String(user._id) === String(userIdToUpdate) ? updatedUser : user
            );
            localStorage.setItem('users-cache', JSON.stringify({
              data: updatedData,
              timestamp: Date.now()
            }));
          }
        } catch (e) {
          // Ignore localStorage errors
        }
        
        // ⚡ FIX: Don't clear selectedUser or close modal - allow user to make more changes
        // Only close modal if user wants to, or keep it open for further edits
        // setSelectedUser(null); // Keep selectedUser so user can edit again
        // setShowEditModal(false); // Keep modal open for further edits
        // resetForm(); // Don't reset form - keep the updated data visible
        
        setValidationAlert({ type: 'success', text: 'User updated successfully' });
        setTimeout(() => setValidationAlert(null), 3000);
      } else {
        const error = await response.json();
        setValidationAlert({ type: 'error', text: error.message || 'Update failed' });
        setTimeout(() => setValidationAlert(null), 5000);
      }
    } catch (error) {
      setValidationAlert({ type: 'error', text: 'Update failed' });
      setTimeout(() => setValidationAlert(null), 5000);
    } finally {
        // ⚡ FIX: Reset all states to ensure delete button and update button work after update
      setSubmitting(false);
        setIsDeleting(false);
        deleteInProgressRef.current = false;
        updatingRef.current = false;
    }
  };

  // ⚡ FIX: Add ref to track deleting state and prevent multiple simultaneous deletes
  const deletingRef = useRef<Set<string>>(new Set());
  const deleteInProgressRef = useRef(false);

  // Delete user
  const handleDeleteUser = async () => {
    // ⚡ FIX: Prevent multiple simultaneous deletes
    if (deleteInProgressRef.current || isDeleting) {
      console.log('⚠️ Delete already in progress, ignoring duplicate request');
      return;
    }

    // ⚡ FIX: Re-fetch selectedUser from users list if it's missing or doesn't have _id
    let userToDelete = selectedUser;
    if (!userToDelete || !userToDelete._id) {
      // Try to find user from formData if we have username
      if (formData.username) {
        userToDelete = users.find(u => String(u.username) === String(formData.username)) || null;
      }
      
      if (!userToDelete || !userToDelete._id) {
        console.error('❌ No user selected or user missing _id for delete:', { selectedUser, formData });
        setValidationAlert({ type: 'error', text: 'No user selected. Please close and reopen the delete modal.' });
      setTimeout(() => setValidationAlert(null), 5000);
      return;
    }

      // Update selectedUser state with the found user
      setSelectedUser(userToDelete);
    }

    const deletedUserId = String(userToDelete._id); // ⚡ FIX: Ensure string comparison

    // ⚡ FIX: Check if already deleting this user
    if (deletingRef.current.has(deletedUserId)) {
      console.log('⚠️ User already being deleted, ignoring duplicate request');
      return;
    }

    // Mark as deleting to prevent duplicates
    deleteInProgressRef.current = true;
    setIsDeleting(true);
    deletingRef.current.add(deletedUserId);
    
    // Close modal immediately
    setShowDeleteModal(false);
    setSelectedUser(null);

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setValidationAlert({ type: 'error', text: 'Please login to delete user' });
        setTimeout(() => setValidationAlert(null), 5000);
        setSubmitting(false);
        deleteInProgressRef.current = false;
        setIsDeleting(false);
        deletingRef.current.delete(deletedUserId);
        return;
      }

      const response = await fetch(`/api/users/${deletedUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Parse response
      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { success: false, message: responseText || 'Delete failed' };
      }

      if (response.ok && responseData.success !== false) {
        // Remove user from UI immediately
        setUsers(prevUsers => {
          if (!Array.isArray(prevUsers)) return [];
          return prevUsers.filter(user => String(user._id) !== deletedUserId);
        });
        setTotalCount(prev => Math.max(0, prev - 1));
        
        // localStorage cache will be updated by useEffect when users state changes
        
        setValidationAlert({ type: 'success', text: responseData.message || 'User deleted successfully' });
          setTimeout(() => setValidationAlert(null), 3000);
        } else {
        // Handle error - show error message
        if (response.status === 404 || (responseData.message && responseData.message.includes('not found'))) {
          // User was already deleted, remove from UI anyway
          setUsers(prevUsers => {
            if (!Array.isArray(prevUsers)) return [];
            return prevUsers.filter(user => String(user._id) !== deletedUserId);
          });
          setTotalCount(prev => Math.max(0, prev - 1));
          setValidationAlert({ type: 'success', text: `User ${userToDelete.name} was already deleted.` });
        } else {
          const errorMessage = responseData.message || `Delete failed (${response.status})`;
          setValidationAlert({ type: 'error', text: errorMessage });
        }
          setTimeout(() => setValidationAlert(null), 5000);
      }
    } catch (error: any) {
      console.error('Delete user error:', error);
      setValidationAlert({ type: 'error', text: `Error: ${error.message || 'Failed to delete user. Please try again.'}` });
      setTimeout(() => setValidationAlert(null), 5000);
    } finally {
      setSubmitting(false);
      deleteInProgressRef.current = false;
      setIsDeleting(false);
      deletingRef.current.delete(deletedUserId);
    }
  };

  // Fetch parties list for party user dropdown
  const fetchParties = useCallback(async () => {
    setLoadingParties(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/parties?limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setParties(data.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch parties:', error);
    } finally {
      setLoadingParties(false);
    }
  }, []);

  // Fetch parties automatically when role changes to 'party'
  useEffect(() => {
    if (formData.role === 'party' && parties.length === 0 && !loadingParties) {
      fetchParties();
    }
  }, [formData.role, parties.length, loadingParties, fetchParties]);



  // Save a new party created inline
  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyForm.name.trim()) {
      setPartyError('Party name is required');
      return;
    }
    setSavingParty(true);
    setPartyError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/parties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPartyForm)
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const createdParty = data.data;
        setParties(prev => [createdParty, ...prev]);
        
        // Auto-select and autofill
        setFormData(prev => ({
          ...prev,
          partyId: createdParty._id,
          username: getNextUsername(createdParty.name, users)
        }));
        
        setNewPartyForm({
          name: '',
          contactName: '',
          contactPhone: '',
          address: ''
        });
        setShowAddPartyModal(false);
      } else {
        setPartyError(data.message || 'Failed to save party');
      }
    } catch (err: any) {
      setPartyError(err.message || 'An error occurred while saving party');
    } finally {
      setSavingParty(false);
    }
  };

  // Get user initials
  const getUserInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  // Check if user can be deleted (prevent self-deletion)
  const canDeleteUser = useCallback((user: User) => {
    // Cannot delete yourself - this would lock you out
    if (currentUser && user._id === currentUser._id) {
      return false;
    }
    return true;
  }, [currentUser]);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // 🌟 REAL-TIME SYNC
  useRealtimeSync(
    () => fetchUsers(), 
    showCreateModal || showEditModal || showDeleteModal || showProfileModal || showAddPartyModal
  );

  // Show spinner while not mounted
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      {/* Loading indicator for non-initial loads */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Loading users...
            </span>
          </div>
        </div>
      )}

      {/* Search and Controls Bar */}
      <div className={`mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border shadow-sm transition-all duration-200 ${isDarkMode ? 'bg-gray-800 border-gray-700 shadow-gray-900/50' : 'bg-white border-gray-200'}`}>
        
        {/* Main Controls Row: Stacks on mobile, single row on desktop (md and up) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 z-10 relative">
          
          {/* Left Side: Search Bar & Direct Filters (desktop) or Toggle Button (mobile) */}
          <div className="flex flex-row flex-wrap items-center flex-1 gap-2 sm:gap-3 w-full md:max-w-4xl">
            {/* Search Bar Container */}
            <div className="flex-1 min-w-[200px] relative group">
              <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-10 py-2 sm:py-2.5 rounded-lg border-2 transition-all duration-300 font-medium text-xs sm:text-sm outline-none ${isDarkMode
                    ? 'bg-white/10 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-0 focus:outline-none'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-0 focus:outline-none'
                  }`}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Clear search"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Desktop Direct Role Filter */}
            <div className="hidden md:flex items-center gap-2">
              <span className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Role:</span>
              <div className="relative sort-dropdown-container min-w-[130px]">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border transition-all duration-150 text-xs sm:text-sm appearance-none cursor-pointer input-focus font-medium ${isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 hover:border-blue-400'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 hover:border-blue-400'
                    } focus:outline-none pr-8`}
                >
                  <option value="all">All Roles</option>
                  <option value="master">Master</option>
                  <option value="superadmin">Super Admin</option>
                  <option value="user">User</option>
                  <option value="party">Party</option>
                </select>
                <ChevronDownIcon className={`absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
            </div>

            {/* Desktop Direct Sort Filter */}
            <div className="hidden md:flex items-center gap-2">
              <span className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Sort:</span>
              <div className="relative sort-dropdown-container min-w-[130px]">
                <select
                  value={dateSort}
                  onChange={(e) => setDateSort(e.target.value as 'latest' | 'oldest')}
                  className={`w-full px-3 py-2 rounded-lg border transition-all duration-150 text-xs sm:text-sm appearance-none cursor-pointer input-focus font-medium ${isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 hover:border-blue-400'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 hover:border-blue-400'
                    } focus:outline-none pr-8`}
                >
                  <option value="latest">Latest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
                <ChevronDownIcon className={`absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
            </div>

            {/* Desktop Clear Filters */}
            {((roleFilter !== 'all' ? 1 : 0) + (dateSort !== 'latest' ? 1 : 0)) > 0 && (
              <button
                onClick={() => {
                  setRoleFilter('all');
                  setDateSort('latest');
                }}
                className={`hidden md:inline-flex items-center justify-center px-3 py-2 rounded-lg border border-red-500/20 text-xs sm:text-sm font-semibold transition-all duration-200 hover-lift ${
                  isDarkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
                }`}
                title="Clear Filters"
              >
                Clear
              </button>
            )}

            {/* Filter Toggle Button (Mobile/Tablet only) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative py-2 px-3 sm:px-4 flex md:hidden items-center justify-center rounded-lg border transition-all duration-200 hover-lift active:scale-95 text-xs sm:text-sm font-semibold h-[36px] sm:h-[42px] ${
                showFilters 
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20' 
                  : isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' 
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              title="Toggle Filters"
            >
              <div className="flex items-center gap-1.5">
                <FunnelIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Filters</span>
                {((roleFilter !== 'all' ? 1 : 0) + (dateSort !== 'latest' ? 1 : 0)) > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-bold text-white shadow-sm border border-white bg-red-500 animate-pulse">
                    {(roleFilter !== 'all' ? 1 : 0) + (dateSort !== 'latest' ? 1 : 0)}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Right Side: View Actions & Create Button */}
          <div className="flex flex-row items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto">
            {/* View Mode Toggle */}
            <div className={`flex rounded-lg border overflow-hidden h-[36px] sm:h-[42px] ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => {
                  setViewMode('table');
                  if (typeof window !== 'undefined') localStorage.setItem('usersViewMode', 'table');
                }}
                className={`px-2.5 sm:px-3 h-full transition-colors flex items-center justify-center ${viewMode === 'table' ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50')}`}
                title="Table View"
              >
                <TableCellsIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode('card');
                  if (typeof window !== 'undefined') localStorage.setItem('usersViewMode', 'card');
                }}
                className={`px-2.5 sm:px-3 h-full transition-colors flex items-center justify-center ${viewMode === 'card' ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50')}`}
                title="Card View"
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`group inline-flex items-center justify-center px-3 py-1.5 sm:py-2 rounded-lg font-medium transition-all duration-200 hover-lift text-xs sm:text-sm h-[36px] sm:h-[42px] ${refreshing ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode
                  ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              title="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : 'hover-rotate-icon'} sm:mr-1`} />
              <span className="font-medium hidden sm:inline">Refresh</span>
            </button>

            {/* Add User Button */}
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
                setValidationAlert(null);
              }}
              className="inline-flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg font-semibold transition-all duration-200 hover-lift active:scale-95 text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg h-[36px] sm:h-[42px]"
              title="Add User"
            >
              <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-1.5" />
              <span className="font-semibold hidden sm:inline">Add User</span>
            </button>
          </div>
        </div>

        {/* Search Results Indicator */}
        {searchTerm && (
          <div className="flex">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${isDarkMode
              ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
              : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
              {filteredUsers.length} results for "{searchTerm}"
            </div>
          </div>
        )}

        {/* Collapsible Filter Options Panel (Mobile/Tablet only) */}
        {showFilters && (
          <div className={`p-3 rounded-lg border flex flex-col sm:flex-row gap-3 items-start sm:items-center transition-all duration-300 md:hidden ${
            isDarkMode 
              ? 'bg-gray-900/40 border-gray-700 shadow-inner' 
              : 'bg-gray-50 border-gray-200 shadow-inner'
          }`}>
            <div className="flex flex-row flex-wrap gap-3 items-center w-full">
              {/* Role Filter */}
              <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-[150px]">
                <span className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Role:</span>
                <div className="relative sort-dropdown-container flex-1">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className={`w-full px-3 py-1.5 sm:py-2 rounded-lg border transition-all duration-150 text-xs sm:text-sm appearance-none cursor-pointer input-focus font-medium ${isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 hover:border-blue-400'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 hover:border-blue-400'
                      } focus:outline-none pr-8`}
                  >
                    <option value="all">All Roles</option>
                    <option value="master">Master</option>
                    <option value="superadmin">Super Admin</option>
                    <option value="user">User</option>
                    <option value="party">Party</option>
                  </select>
                  <ChevronDownIcon className={`absolute right-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
              </div>

              {/* Sort Filter */}
              <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-[150px]">
                <span className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Sort:</span>
                <div className="relative sort-dropdown-container flex-1">
                  <select
                    value={dateSort}
                    onChange={(e) => setDateSort(e.target.value as 'latest' | 'oldest')}
                    className={`w-full px-3 py-1.5 sm:py-2 rounded-lg border transition-all duration-150 text-xs sm:text-sm appearance-none cursor-pointer input-focus font-medium ${isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 hover:border-blue-400'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 hover:border-blue-400'
                      } focus:outline-none pr-8`}
                  >
                    <option value="latest">Latest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                  <ChevronDownIcon className={`absolute right-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
              </div>

              {/* Clear Filters Button */}
              {((roleFilter !== 'all' ? 1 : 0) + (dateSort !== 'latest' ? 1 : 0)) > 0 && (
                <button
                  onClick={() => {
                    setRoleFilter('all');
                    setDateSort('latest');
                  }}
                  className={`text-xs sm:text-sm font-semibold transition-colors duration-150 ml-auto border border-red-500/20 px-3 py-1.5 rounded-lg ${
                    isDarkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>


      {/* Users Display - Table and Card Views */}
      {viewMode === 'table' ? (
        /* Table View */
        <div className={`rounded-lg border overflow-hidden ${
          isDarkMode
            ? 'bg-white/5 border-white/10'
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 border-b flex flex-row items-center justify-between gap-2 transition-all duration-150 ${
            isDarkMode 
              ? 'bg-white/5 border-white/10' 
              : 'bg-gray-50 border-gray-200'
          }`}>
          <div className="flex flex-row items-center gap-2 sm:gap-4">
            <span className={`text-[10px] xs:text-xs sm:text-sm whitespace-nowrap font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <span className="hidden sm:inline">Showing {paginationDisplayInfo.start} to {paginationDisplayInfo.end} of {paginationDisplayInfo.total} users</span>
              <span className="sm:hidden">{paginationDisplayInfo.start}-{paginationDisplayInfo.end} <span className="opacity-75">of {paginationDisplayInfo.total}</span></span>
            </span>
            
            {/* Items per page dropdown */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              <span className={`text-[10px] xs:text-xs sm:text-sm hidden xs:inline ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const value = e.target.value === 'All' ? 'All' : parseInt(e.target.value);
                  handleItemsPerPageChange(value);
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded-lg border text-[10px] xs:text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150 hover:scale-[1.02] focus:scale-[1.02] input-focus ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white hover:border-blue-400' 
                    : 'bg-white border-gray-300 text-gray-900 hover:border-blue-400'
                } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {itemsPerPageOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pagination Navigation */}
          {totalPages > 1 && (
            <div key={`pagination-${itemsPerPage}-${totalPages}`} className="flex items-center space-x-1">
              {/* Mobile pagination */}
              <div className="flex sm:hidden items-center space-x-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isChangingPage || loading}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    currentPage === 1 || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <span className="hidden xs:inline">Prev</span>
                  <span className="xs:hidden">&larr;</span>
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center space-x-0.5">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isChangingPage || loading}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                          currentPage === pageNum
                            ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                            : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isChangingPage || loading}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    currentPage === totalPages || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <span className="hidden xs:inline">Next</span>
                  <span className="xs:hidden">&rarr;</span>
                </button>
              </div>

              {/* Desktop pagination */}
              <div className="hidden sm:flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isChangingPage || loading}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === 1 || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isChangingPage || loading}
                        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentPage === pageNum
                            ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                            : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isChangingPage || loading}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === totalPages || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${
              isDarkMode
                ? 'bg-white/5 border-b border-white/10'
                : 'bg-gray-50 border-b border-gray-200'
            }`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  User
                </th>
                {isSmallScreen && (
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Role
                  </th>
                )}
                {isLargeScreen && (
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Contact Info
                  </th>
                )}
                {isMediumScreen && (
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Created
                  </th>
                )}
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${
              isDarkMode ? 'divide-white/10' : 'divide-gray-200'
            }`}>
              {loading && currentUsers.length === 0 ? (
                // Table Skeleton
                Array.from({ length: 7 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="animate-pulse">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`h-10 w-10 rounded-full ${
                          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                        }`}></div>
                        <div className="ml-4 flex-1">
                          <div className={`h-4 w-24 rounded mb-2 ${
                            isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                          }`}></div>
                          <div className={`h-3 w-20 rounded ${
                            isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                          }`}></div>
                        </div>
                      </div>
                    </td>
                    {isSmallScreen && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`h-6 w-16 rounded-full ${
                          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                        }`}></div>
                      </td>
                    )}
                    {isLargeScreen && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`h-4 w-32 rounded ${
                          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                        }`}></div>
                      </td>
                    )}
                    {isMediumScreen && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`h-4 w-20 rounded ${
                          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                        }`}></div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className={`h-8 w-8 rounded ${
                          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                        }`}></div>
                        <div className={`h-8 w-8 rounded ${
                          isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                        }`}></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                currentUsers.map((user, index) => (
                <tr key={user._id || `user-${index}`} onClick={() => {
                  setSelectedUser(user);
                  setShowProfileModal(true);
                }} className={`cursor-pointer hover:${
                  isDarkMode ? 'bg-white/5' : 'bg-gray-50'
                } transition-colors duration-200 ${
                  currentUser && user._id === currentUser._id
                    ? isDarkMode
                      ? 'bg-blue-500/5 border-l-4 border-blue-500'
                      : 'bg-blue-50 border-l-4 border-blue-500'
                    : ''
                }`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold overflow-hidden transition-all duration-300 shadow-md ${
                        isDarkMode
                          ? 'bg-gradient-to-br from-purple-500 to-indigo-650 text-white'
                          : 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white'
                      }`}>
                        {user.profilePhoto ? (
                          <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          getUserInitials(user.name)
                        )}
                      </div>
                      <div className="ml-4 flex-1">
                        <div className={`text-sm font-medium ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {user.name || 'No name'}
                        </div>
                        <div className={`text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-500'
                        } flex items-center gap-2`}>
                          {user.username}
                          {currentUser && user._id === currentUser._id && (
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                              isDarkMode
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              You
                            </span>
                          )}
                        </div>
                        {(!isLargeScreen || !isSmallScreen || !isMediumScreen) && (
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowProfileModal(true);
                            }}
                            className={`mt-1 text-xs px-2 py-1 rounded-md transition-all duration-300 ${
                              isDarkMode
                                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            }`}
                          >
                            View Profile
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  {isSmallScreen && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'master'
                          ? isDarkMode
                            ? 'bg-red-900/20 text-red-400'
                            : 'bg-red-100 text-red-800'
                          : user.role === 'superadmin'
                            ? isDarkMode
                              ? 'bg-purple-900/20 text-purple-400'
                              : 'bg-purple-100 text-purple-800'
                            : user.role === 'admin'
                              ? isDarkMode
                                ? 'bg-amber-900/20 text-amber-400'
                                : 'bg-amber-100 text-amber-800'
                              : user.role === 'party'
                                ? isDarkMode
                                  ? 'bg-green-900/20 text-green-400'
                                  : 'bg-green-100 text-green-800'
                                : isDarkMode
                                  ? 'bg-blue-900/20 text-blue-400'
                                  : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role === 'master'
                          ? 'Master'
                          : user.role === 'superadmin'
                            ? 'Super Admin'
                            : user.role === 'admin'
                              ? 'Admin'
                              : user.role === 'party'
                                ? `Party: ${typeof user.partyId === 'object' && user.partyId !== null ? user.partyId.name : (parties.find(p => p._id === user.partyId)?.name || 'Party User')}`
                                : 'User'}
                      </span>
                    </td>
                  )}
                  {isLargeScreen && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        {user.phoneNumber && (
                          <div className="mb-1">
                            📞 {user.phoneNumber}
                          </div>
                        )}
                        {user.address && (
                          <div className="text-xs">
                            📍 {user.address.length > 30 ? `${user.address.substring(0, 30)}...` : user.address}
                          </div>
                        )}
                        {!user.phoneNumber && !user.address && (
                          <span className="text-gray-400">No contact info</span>
                        )}
                      </div>
                    </td>
                  )}
                  {isMediumScreen && (
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {formatDate(user.createdAt)}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {(user.role !== 'master' || currentUser?.role === 'master') && (
                        <button
                          onClick={async () => {
                            // ⚡ FIX: Always get the latest user data from the list
                            const latestUser = users.find(u => String(u._id) === String(user._id));
                            const userToEdit = latestUser || user;
                            setSelectedUser(userToEdit);
                            
                            // Fetch user with password for editing
                            try {
                              const token = localStorage.getItem('token');
                              if (token && userToEdit._id) {
                                const response = await fetch(`/api/users/${userToEdit._id}?includePassword=true`, {
                                  headers: {
                                    'Authorization': `Bearer ${token}`
                                  }
                                });
                                if (response.ok) {
                                  const userData = await response.json();
                                  const getPartyId = (p: any) => typeof p === 'object' && p !== null ? p._id : (p || '');
                                  setFormData({
                                    name: userData.name || userToEdit.name,
                                    username: userData.username || userToEdit.username,
                                    password: userData.password || '', // This will be the hashed password
                                    phoneNumber: userData.phoneNumber || userToEdit.phoneNumber || '',
                                    address: userData.address || userToEdit.address || '',
                                    role: userData.role || userToEdit.role,
                                    partyId: getPartyId(userData.partyId) || getPartyId(userToEdit.partyId),
                                    profilePhoto: userData.profilePhoto || userToEdit.profilePhoto || ''
                                  });
                                } else {
                                  // Fallback to user data without password
                                  const getPartyId = (p: any) => typeof p === 'object' && p !== null ? p._id : (p || '');
                                  setFormData({
                                    name: userToEdit.name,
                                    username: userToEdit.username,
                                    password: '',
                                    phoneNumber: userToEdit.phoneNumber || '',
                                    address: userToEdit.address || '',
                                    role: userToEdit.role,
                                    partyId: getPartyId(userToEdit.partyId),
                                    profilePhoto: userToEdit.profilePhoto || ''
                                  });
                                }
                              } else {
                                // Fallback to user data without password
                                const getPartyId = (p: any) => typeof p === 'object' && p !== null ? p._id : (p || '');
                                setFormData({
                                  name: userToEdit.name,
                                  username: userToEdit.username,
                                  password: '',
                                  phoneNumber: userToEdit.phoneNumber || '',
                                  address: userToEdit.address || '',
                                  role: userToEdit.role,
                                  partyId: getPartyId(userToEdit.partyId),
                                  profilePhoto: userToEdit.profilePhoto || ''
                                });
                              }
                            } catch (error) {
                              // Fallback to user data without password
                              const getPartyId = (p: any) => typeof p === 'object' && p !== null ? p._id : (p || '');
                              setFormData({
                                name: userToEdit.name,
                                username: userToEdit.username,
                                password: '',
                                  phoneNumber: userToEdit.phoneNumber || '',
                                  address: userToEdit.address || '',
                                  role: userToEdit.role,
                                  partyId: getPartyId(userToEdit.partyId),
                                  profilePhoto: userToEdit.profilePhoto || ''
                                });
                              }
                              
                              setShowPassword(false); // Reset password visibility when opening edit modal
                              setShowEditModal(true);
                              setValidationAlert(null);
                            }}
                            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 ${
                              isDarkMode
                                ? 'text-blue-400 hover:bg-blue-500/20 hover:text-blue-300'
                                : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                            }`}
                            title="Edit user"
                          >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {currentUser?.role === 'master' && (
                        canDeleteUser(user) ? (
                          <button
                            onClick={() => {
                              // ⚡ FIX: Allow delete even if submitting from edit (but not if deleting)
                              if (user._id && !isDeleting && !deleteInProgressRef.current) {
                                // ⚡ FIX: Ensure we use the latest user data from the list
                                const currentUserFromList = users.find(u => String(u._id) === String(user._id));
                                if (currentUserFromList) {
                                  setSelectedUser(currentUserFromList);
                                  setShowDeleteModal(true);
                                  setValidationAlert(null);
                                } else {
                                  setSelectedUser(user);
                                  setShowDeleteModal(true);
                                  setValidationAlert(null);
                                }
                              }
                            }}
                            disabled={isDeleting || deleteInProgressRef.current}
                            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 ${
                              (isDeleting || deleteInProgressRef.current)
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                            } ${
                              isDarkMode
                                ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300 active:bg-red-500/30'
                                : 'text-red-600 hover:bg-red-50 hover:text-red-700 active:bg-red-100'
                            }`}
                            title="Delete user"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            disabled
                            className={`p-2 rounded-lg transition-all duration-200 cursor-not-allowed opacity-50 ${
                              isDarkMode
                                ? 'text-gray-500'
                                : 'text-gray-400'
                            }`}
                            title="You cannot delete yourself - This would lock you out of the system"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls - Bottom */}
        {totalPages > 1 && (
          <div className={`flex items-center justify-center px-4 py-3 border-t ${
                isDarkMode
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-gray-200'
          } sm:px-6`}>
            <div key={`bottom-pagination-${itemsPerPage}-${totalPages}`} className="flex items-center space-x-2">
              {/* Mobile pagination */}
              <div className="flex sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isChangingPage || loading}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === 1 || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isChangingPage || loading}
                        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentPage === pageNum
                            ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                            : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                </button>
                    );
                  })}
              </div>
                
            <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isChangingPage || loading}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === totalPages || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Next
            </button>
          </div>

              {/* Desktop pagination */}
              <div className="hidden sm:flex items-center space-x-2">
              <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isChangingPage || loading}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === 1 || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
              </button>
                
                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    
                    return (
                  <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isChangingPage || loading}
                        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentPage === pageNum
                            ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                            : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                  </button>
                    );
                  })}
                </div>
                
              <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isChangingPage || loading}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === totalPages || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Next
              </button>
            </div>
          </div>
        </div>
      )}

          {filteredUsers.length === 0 && !loading && (
            <div className={`text-center py-12 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <p>No users found</p>
            </div>
          )}
        </div>
      ) : (
        /* Card View */
        <div className="space-y-4">
          {/* Pagination Controls - Top for Card View */}
          <div className={`px-2 sm:px-3 md:px-4 py-2 sm:py-3 rounded-lg border flex flex-row items-center justify-between gap-2 transition-all duration-150 ${
            isDarkMode 
              ? 'bg-white/5 border-white/10' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex flex-row items-center gap-2 sm:gap-4">
              <span className={`text-[10px] xs:text-xs sm:text-sm whitespace-nowrap font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <span className="hidden sm:inline">Showing {paginationDisplayInfo.start} to {paginationDisplayInfo.end} of {paginationDisplayInfo.total} users</span>
                <span className="sm:hidden">{paginationDisplayInfo.start}-{paginationDisplayInfo.end} <span className="opacity-75">of {paginationDisplayInfo.total}</span></span>
              </span>
              
              {/* Items per page dropdown */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                <span className={`text-[10px] xs:text-xs sm:text-sm hidden xs:inline ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    const value = e.target.value === 'All' ? 'All' : parseInt(e.target.value);
                    handleItemsPerPageChange(value);
                  }}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg border text-[10px] xs:text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150 hover:scale-[1.02] focus:scale-[1.02] input-focus ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white hover:border-blue-400' 
                      : 'bg-white border-gray-300 text-gray-900 hover:border-blue-400'
                  } ${(isChangingPage || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {itemsPerPageOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pagination Navigation for Card View */}
            {totalPages > 1 && (
              <div key={`card-pagination-${itemsPerPage}-${totalPages}`} className="flex items-center space-x-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isChangingPage || loading}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    currentPage === 1 || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <span className="hidden xs:inline">Prev</span>
                  <span className="xs:hidden">&larr;</span>
                </button>
                
                <div className="flex items-center space-x-0.5">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isChangingPage || loading}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                          currentPage === pageNum
                            ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                            : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isChangingPage || loading}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    currentPage === totalPages || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <span className="hidden xs:inline">Next</span>
                  <span className="xs:hidden">&rarr;</span>
                </button>
              </div>
            )}
          </div>

          {/* Card View Component or Skeleton */}
          {loading && currentUsers.length === 0 ? (
            // Card Skeleton
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`card-skeleton-${index}`}
                  className={`rounded-lg border p-4 animate-pulse ${
                    isDarkMode
                      ? 'bg-white/5 border-white/10'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`h-12 w-12 rounded-full ${
                      isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                    }`}></div>
                    <div className="flex-1">
                      <div className={`h-4 w-24 rounded mb-2 ${
                        isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                      }`}></div>
                      <div className={`h-3 w-20 rounded ${
                        isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                      }`}></div>
                    </div>
                  </div>
                  <div className={`h-6 w-16 rounded-full mb-3 ${
                    isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                  }`}></div>
                  <div className={`h-3 w-32 rounded mb-3 ${
                    isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                  }`}></div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-white/10">
                    <div className={`h-6 w-12 rounded ${
                      isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                    }`}></div>
                    <div className="flex space-x-1">
                      <div className={`h-6 w-6 rounded ${
                        isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                      }`}></div>
                      <div className={`h-6 w-6 rounded ${
                        isDarkMode ? 'bg-white/10' : 'bg-gray-200'
                      }`}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <UserCardView
            users={currentUsers}
            currentUser={currentUser}
            isDarkMode={isDarkMode}
            onEditUser={async (user) => {
              // ⚡ FIX: Always get the latest user data from the list
              const latestUser = users.find(u => String(u._id) === String(user._id));
              const userToEdit = latestUser || user;
              setSelectedUser(userToEdit);
              
              // Fetch user with password for editing
              try {
                const token = localStorage.getItem('token');
                if (token && userToEdit._id) {
                  const response = await fetch(`/api/users/${userToEdit._id}?includePassword=true`, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  if (response.ok) {
                    const userData = await response.json();
                    const getPartyId = (p: any) => typeof p === 'object' && p !== null ? p._id : (p || '');
                    setFormData({
                      name: userData.name || userToEdit.name,
                      username: userData.username || userToEdit.username,
                      password: userData.password || '', // This will be the hashed password
                      phoneNumber: userData.phoneNumber || userToEdit.phoneNumber || '',
                      address: userData.address || userToEdit.address || '',
                      role: userData.role || userToEdit.role,
                      partyId: getPartyId(userData.partyId) || getPartyId(userToEdit.partyId),
                      profilePhoto: userData.profilePhoto || userToEdit.profilePhoto || ''
                    });
                  } else {
                    // Fallback to user data without password
                    const getPartyId = (p: any) => typeof p === 'object' && p !== null ? p._id : (p || '');
                    setFormData({
                      name: userToEdit.name,
                      username: userToEdit.username,
                      password: '',
                      phoneNumber: userToEdit.phoneNumber || '',
                      address: userToEdit.address || '',
                      role: userToEdit.role,
                      partyId: getPartyId(userToEdit.partyId),
                      profilePhoto: userToEdit.profilePhoto || ''
                    });
                  }
                } else {
                  // Fallback to user data without password
                  const getPartyId = (p: any) => typeof p === 'object' && p !== null ? p._id : (p || '');
                  setFormData({
                    name: userToEdit.name,
                    username: userToEdit.username,
                    password: '',
                    phoneNumber: userToEdit.phoneNumber || '',
                    address: userToEdit.address || '',
                    role: userToEdit.role,
                    partyId: getPartyId(userToEdit.partyId),
                    profilePhoto: userToEdit.profilePhoto || ''
                  });
                }
              } catch (error) {
                // Fallback to user data without password
                const getPartyId = (p: any) => typeof p === 'object' && p !== null ? p._id : (p || '');
                setFormData({
                  name: userToEdit.name,
                  username: userToEdit.username,
                  password: '',
                  phoneNumber: userToEdit.phoneNumber || '',
                  address: userToEdit.address || '',
                  role: userToEdit.role,
                  partyId: getPartyId(userToEdit.partyId),
                  profilePhoto: userToEdit.profilePhoto || ''
                });
              }
              
              setShowPassword(false); // Reset password visibility when opening edit modal
              setShowEditModal(true);
              setValidationAlert(null);
            }}
            onDeleteUser={(user) => {
              // ⚡ FIX: Allow delete even if submitting from edit (but not if deleting)
              if (canDeleteUser(user) && user._id && !isDeleting && !deleteInProgressRef.current) {
                // ⚡ FIX: Ensure we use the latest user data from the list
                const currentUserFromList = users.find(u => String(u._id) === String(user._id));
                if (currentUserFromList) {
                  setSelectedUser(currentUserFromList);
                  setShowDeleteModal(true);
                  setValidationAlert(null);
                } else {
                  setSelectedUser(user);
                  setShowDeleteModal(true);
                  setValidationAlert(null);
                }
              }
            }}
            onViewProfile={(user) => {
              setSelectedUser(user);
              setShowProfileModal(true);
            }}
            canDeleteUser={canDeleteUser}
            getUserInitials={getUserInitials}
            formatDate={formatDate}
          />
          )}

          {/* Pagination Controls - Bottom for Card View */}
          {totalPages > 1 && (
            <div className={`flex items-center justify-center px-4 py-3 rounded-lg border ${
              isDarkMode 
                ? 'bg-white/5 border-white/10' 
                : 'bg-white border-gray-200'
            }`}>
              <div key={`card-bottom-pagination-${itemsPerPage}-${totalPages}`} className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isChangingPage || loading}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === 1 || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Previous
                </button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isChangingPage || loading}
                        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentPage === pageNum
                            ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                            : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isChangingPage || loading}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === totalPages || isChangingPage || loading
                      ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-lg shadow-xl ${
            isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Create New User
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                  setValidationAlert(null);
                }}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDarkMode
                    ? 'text-gray-400 hover:bg-white/10'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Validation Alert - Inside Modal */}
              {validationAlert && (
                <div className={`mb-4 p-3 rounded-md border text-sm ${
                  validationAlert.type === 'success'
                    ? isDarkMode
                      ? 'bg-green-900/20 border-green-500/30 text-green-400'
                      : 'bg-green-50 border-green-200 text-green-800'
                    : isDarkMode
                      ? 'bg-red-900/20 border-red-500/30 text-red-400'
                      : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {validationAlert.type === 'success' ? (
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                      ) : (
                        <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                      )}
                      <span>{validationAlert.text}</span>
                    </div>
                    <button
                      onClick={() => setValidationAlert(null)}
                      className={`p-1 rounded transition-all duration-300 ${
                        isDarkMode
                          ? 'text-gray-400 hover:bg-white/10'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Required Fields Note */}
              <div className={`mb-6 p-3 rounded-lg border ${
                isDarkMode
                  ? 'bg-blue-900/20 border-blue-500/30'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <p className={`text-sm ${
                  isDarkMode ? 'text-blue-300' : 'text-blue-800'
                }`}>
                  <span className="text-red-500 font-semibold">*</span> Required fields
                </p>
              </div>
              
              <div className="space-y-6">
                {/* Profile Photo Upload/Capture */}
                <div className="flex flex-col items-center justify-center space-y-3 pb-4 border-b border-gray-150 dark:border-slate-700/50">
                  <div className="relative group">
                    <div className={`h-24 w-24 rounded-full flex items-center justify-center text-3xl font-semibold overflow-hidden border-2 shadow-inner transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-650 text-white border-purple-500/30 shadow-slate-900/50'
                        : 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-purple-200 shadow-gray-200'
                    }`}>
                      {formData.profilePhoto ? (
                        <img src={formData.profilePhoto} alt="Profile Preview" className="w-full h-full object-cover animate-fade-in" />
                      ) : (
                        getUserInitials(formData.name || 'New User')
                      )}
                    </div>
                    {formData.profilePhoto && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, profilePhoto: '' })}
                        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-md transition-all active:scale-90 hover:scale-110"
                        title="Remove photo"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className={`relative px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                      isDarkMode 
                        ? 'border-slate-700 hover:border-slate-650 hover:bg-slate-700/50 text-gray-300' 
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-700 shadow-sm'
                    }`}>
                      <CloudArrowUpIcon className="w-3.5 h-3.5 text-blue-500" />
                      Upload File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handlePhotoUpload(file);
                          }
                          e.target.value = '';
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                        isDarkMode 
                          ? 'border-slate-700 hover:border-slate-650 hover:bg-slate-700/50 text-gray-300' 
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-700 shadow-sm'
                      }`}
                    >
                      <CameraIcon className="w-3.5 h-3.5 text-emerald-500" />
                      Camera
                    </button>
                  </div>
                  {uploadingPhoto && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-500 animate-pulse">
                      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      Uploading photo...
                    </div>
                  )}
                </div>

                {/* Role and Party Select (Top Section) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Role */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                        formErrors.role
                          ? 'border-red-500'
                          : isDarkMode
                            ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                      }`}
                    >
                      <option value="superadmin" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>Super Admin</option>
                      <option value="user" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>User</option>
                      <option value="party" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>Party</option>
                      {formData.role === 'master' && (
                        <option value="master" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>Master</option>
                      )}
                      {formData.role === 'admin' && (
                        <option value="admin" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>Admin</option>
                      )}
                    </select>
                    {formErrors.role && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.role}</p>
                    )}
                  </div>

                  {/* Party Dropdown */}
                  {formData.role === 'party' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className={`block text-sm font-medium ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Select Party <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setPartyError(null);
                            setShowAddPartyModal(true);
                          }}
                          className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                        >
                          + Add New Party
                        </button>
                      </div>
                      <div className="relative z-50">
                        {/* The Dropdown Button / Selector Display */}
                        <button
                          type="button"
                          onClick={() => setPartyDropdownOpen(!partyDropdownOpen)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors duration-300 ${
                            formErrors.partyId
                              ? 'border-red-500'
                              : isDarkMode
                                ? 'bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700/80 focus:border-blue-500'
                                : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50 focus:border-blue-500'
                          }`}
                        >
                          <span className="block truncate">
                            {parties.find(p => p._id === formData.partyId)?.name || '-- Choose Party --'}
                          </span>
                          <span className="pointer-events-none flex items-center">
                            <ChevronDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                          </span>
                        </button>

                        {/* Dropdown Panel */}
                        {partyDropdownOpen && (
                          <>
                            {/* Click outside backdrop to close */}
                            <div 
                              className="fixed inset-0 z-40 cursor-default" 
                              onClick={() => setPartyDropdownOpen(false)} 
                            />
                            
                            <div
                              className={`absolute left-0 right-0 mt-1 max-h-60 overflow-hidden rounded-md py-1 shadow-lg ring-1 ring-black/5 focus:outline-none z-50 ${
                                isDarkMode 
                                  ? 'bg-slate-800 border border-slate-700 text-white' 
                                  : 'bg-white border border-gray-200 text-gray-900'
                              }`}
                            >
                              {/* Search input inside dropdown */}
                              <div className="p-2 border-b sticky top-0 z-10 bg-inherit border-inherit">
                                <input
                                  type="text"
                                  value={partySearch}
                                  onChange={(e) => setPartySearch(e.target.value)}
                                  placeholder="Search party..."
                                  className={`w-full px-2 py-1.5 text-sm rounded border focus:outline-none focus:border-blue-500 ${
                                    isDarkMode
                                      ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                  }`}
                                  onClick={(e) => e.stopPropagation()} // Prevent closing dropdown
                                />
                              </div>

                              {/* Options */}
                              <div className="max-h-48 overflow-y-auto">
                                {parties.filter(p => 
                                  p.name.toLowerCase().includes(partySearch.toLowerCase())
                                ).length === 0 ? (
                                  <div className="py-2 px-3 text-sm text-gray-400 text-center">
                                    No parties found
                                  </div>
                                ) : (
                                  parties
                                    .filter(p => p.name.toLowerCase().includes(partySearch.toLowerCase()))
                                    .map(p => {
                                      const isSelected = p._id === formData.partyId;
                                      return (
                                        <button
                                          key={p._id}
                                          type="button"
                                          onClick={() => {
                                            setFormData(prev => ({
                                              ...prev,
                                              partyId: p._id,
                                              username: getNextUsername(p.name, users),
                                              phoneNumber: p.contactPhone || prev.phoneNumber || '',
                                              address: p.address || prev.address || ''
                                            }));
                                            setPartyDropdownOpen(false);
                                            setPartySearch('');
                                          }}
                                          className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 flex items-center justify-between ${
                                            isSelected
                                              ? 'bg-blue-600 text-white'
                                              : isDarkMode
                                                ? 'hover:bg-slate-700 text-gray-200'
                                                : 'hover:bg-gray-100 text-gray-800'
                                          }`}
                                        >
                                          <span>{p.name}</span>
                                          {isSelected && (
                                            <CheckIcon className="h-4 w-4 text-white" />
                                          )}
                                        </button>
                                      );
                                    })
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {formErrors.partyId && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.partyId}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Rest of the fields */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                          formErrors.name
                            ? 'border-red-500'
                            : isDarkMode
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        }`}
                        placeholder="Enter full name"
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
                      )}
                    </div>

                    {/* Username */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Username <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                          formErrors.username
                            ? 'border-red-500'
                            : isDarkMode
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        }`}
                        placeholder="Enter username"
                      />
                      {formErrors.username && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.username}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className={`w-full px-3 py-2 pr-10 rounded-lg border transition-colors duration-300 ${
                            formErrors.password
                              ? 'border-red-500'
                              : isDarkMode
                                ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                                : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                          }`}
                          placeholder="Enter password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors duration-300 ${
                            isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {showPassword ? (
                            <EyeSlashIcon className="h-5 w-5" />
                          ) : (
                            <EyeIcon className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      {formErrors.password && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.password}</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Phone Number */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                          formErrors.phoneNumber
                            ? 'border-red-500'
                            : isDarkMode
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        }`}
                        placeholder="Enter phone number"
                      />
                      {formErrors.phoneNumber && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.phoneNumber}</p>
                      )}
                    </div>

                    {/* Address */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Address
                      </label>
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={3}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                          formErrors.address
                            ? 'border-red-500'
                            : isDarkMode
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        } resize-none`}
                        placeholder="Enter address"
                      />
                      {formErrors.address && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.address}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex justify-end space-x-3 p-6 border-t ${
              isDarkMode ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                  setValidationAlert(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isDarkMode
                    ? 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-300 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-lg shadow-xl ${
            isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Edit User
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  resetForm();
                  setValidationAlert(null);
                }}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDarkMode
                    ? 'text-gray-400 hover:bg-white/10'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Validation Alert */}
              {validationAlert && (
                <div className={`mb-6 p-4 rounded-lg border ${
                  validationAlert.type === 'success'
                    ? isDarkMode
                      ? 'bg-green-900/20 border-green-500/30 text-green-400'
                      : 'bg-green-50 border-green-200 text-green-800'
                    : isDarkMode
                      ? 'bg-red-900/20 border-red-500/30 text-red-400'
                      : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-center">
                    {validationAlert.type === 'success' ? (
                      <CheckIcon className="h-5 w-5 mr-2" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                    )}
                    {validationAlert.text}
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* Profile Photo Upload/Capture */}
                <div className="flex flex-col items-center justify-center space-y-3 pb-4 border-b border-gray-150 dark:border-slate-700/50">
                  <div className="relative group">
                    <div className={`h-24 w-24 rounded-full flex items-center justify-center text-3xl font-semibold overflow-hidden border-2 shadow-inner transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-650 text-white border-purple-500/30 shadow-slate-900/50'
                        : 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-purple-200 shadow-gray-200'
                    }`}>
                      {formData.profilePhoto ? (
                        <img src={formData.profilePhoto} alt="Profile Preview" className="w-full h-full object-cover animate-fade-in" />
                      ) : (
                        getUserInitials(formData.name || 'User')
                      )}
                    </div>
                    {formData.profilePhoto && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, profilePhoto: '' })}
                        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-md transition-all active:scale-90 hover:scale-110"
                        title="Remove photo"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className={`relative px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                      isDarkMode 
                        ? 'border-slate-700 hover:border-slate-650 hover:bg-slate-700/50 text-gray-300' 
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-700 shadow-sm'
                    }`}>
                      <CloudArrowUpIcon className="w-3.5 h-3.5 text-blue-500" />
                      Upload File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handlePhotoUpload(file);
                          }
                          e.target.value = '';
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                        isDarkMode 
                          ? 'border-slate-700 hover:border-slate-650 hover:bg-slate-700/50 text-gray-300' 
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-700 shadow-sm'
                      }`}
                    >
                      <CameraIcon className="w-3.5 h-3.5 text-emerald-500" />
                      Camera
                    </button>
                  </div>
                  {uploadingPhoto && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-500 animate-pulse">
                      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      Uploading photo...
                    </div>
                  )}
                </div>

                {/* Role and Party Select (Top Section) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Role */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                        isDarkMode
                          ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                      }`}
                    >
                      <option value="superadmin" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>Super Admin</option>
                      <option value="user" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>User</option>
                      <option value="party" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>Party</option>
                      {formData.role === 'master' && (
                        <option value="master" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>Master</option>
                      )}
                      {formData.role === 'admin' && (
                        <option value="admin" className={isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}>Admin</option>
                      )}
                    </select>
                  </div>

                  {/* Party Dropdown */}
                  {formData.role === 'party' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className={`block text-sm font-medium ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Select Party <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setPartyError(null);
                            setShowAddPartyModal(true);
                          }}
                          className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                        >
                          + Add New Party
                        </button>
                      </div>
                      <div className="relative z-50">
                        {/* The Dropdown Button / Selector Display */}
                        <button
                          type="button"
                          onClick={() => setPartyDropdownOpen(!partyDropdownOpen)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors duration-300 ${
                            formErrors.partyId
                              ? 'border-red-500'
                              : isDarkMode
                                ? 'bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700/80 focus:border-blue-500'
                                : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50 focus:border-blue-500'
                          }`}
                        >
                          <span className="block truncate">
                            {parties.find(p => p._id === formData.partyId)?.name || '-- Choose Party --'}
                          </span>
                          <span className="pointer-events-none flex items-center">
                            <ChevronDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                          </span>
                        </button>

                        {/* Dropdown Panel */}
                        {partyDropdownOpen && (
                          <>
                            {/* Click outside backdrop to close */}
                            <div 
                              className="fixed inset-0 z-40 cursor-default" 
                              onClick={() => setPartyDropdownOpen(false)} 
                            />
                            
                            <div
                              className={`absolute left-0 right-0 mt-1 max-h-60 overflow-hidden rounded-md py-1 shadow-lg ring-1 ring-black/5 focus:outline-none z-50 ${
                                isDarkMode 
                                  ? 'bg-slate-800 border border-slate-700 text-white' 
                                  : 'bg-white border border-gray-200 text-gray-900'
                              }`}
                            >
                              {/* Search input inside dropdown */}
                              <div className="p-2 border-b sticky top-0 z-10 bg-inherit border-inherit">
                                <input
                                  type="text"
                                  value={partySearch}
                                  onChange={(e) => setPartySearch(e.target.value)}
                                  placeholder="Search party..."
                                  className={`w-full px-2 py-1.5 text-sm rounded border focus:outline-none focus:border-blue-500 ${
                                    isDarkMode
                                      ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400'
                                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                  }`}
                                  onClick={(e) => e.stopPropagation()} // Prevent closing dropdown
                                />
                              </div>

                              {/* Options */}
                              <div className="max-h-48 overflow-y-auto">
                                {parties.filter(p => 
                                  p.name.toLowerCase().includes(partySearch.toLowerCase())
                                ).length === 0 ? (
                                  <div className="py-2 px-3 text-sm text-gray-400 text-center">
                                    No parties found
                                  </div>
                                ) : (
                                  parties
                                    .filter(p => p.name.toLowerCase().includes(partySearch.toLowerCase()))
                                    .map(p => {
                                      const isSelected = p._id === formData.partyId;
                                      return (
                                        <button
                                          key={p._id}
                                          type="button"
                                          onClick={() => {
                                            setFormData(prev => ({
                                              ...prev,
                                              partyId: p._id,
                                              username: getNextUsername(p.name, users),
                                              phoneNumber: p.contactPhone || prev.phoneNumber || '',
                                              address: p.address || prev.address || ''
                                            }));
                                            setPartyDropdownOpen(false);
                                            setPartySearch('');
                                          }}
                                          className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 flex items-center justify-between ${
                                            isSelected
                                              ? 'bg-blue-600 text-white'
                                              : isDarkMode
                                                ? 'hover:bg-slate-700 text-gray-200'
                                                : 'hover:bg-gray-100 text-gray-800'
                                          }`}
                                        >
                                          <span>{p.name}</span>
                                          {isSelected && (
                                            <CheckIcon className="h-4 w-4 text-white" />
                                          )}
                                        </button>
                                      );
                                    })
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {formErrors.partyId && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.partyId}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Rest of the fields */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                          formErrors.name
                            ? 'border-red-500'
                            : isDarkMode
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        }`}
                        placeholder="Enter full name"
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
                      )}
                    </div>

                    {/* Username */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Username
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                          formErrors.username
                            ? 'border-red-500'
                            : isDarkMode
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        }`}
                        placeholder="Enter username"
                      />
                      {formErrors.username && (
                        <p className="mt-1 text-sm text-red-500">{formErrors.username}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password || ''}
                          onChange={(e) => {
                            setFormData({ ...formData, password: e.target.value });
                          }}
                          className={`w-full px-3 py-2 pr-10 rounded-lg border transition-colors duration-300 ${
                            formErrors.password
                              ? 'border-red-500'
                              : isDarkMode
                                ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                                : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                          }`}
                          placeholder={formData.password && formData.password.startsWith('$2') ? "Current password (hashed - enter new password to change)" : "Enter password (leave blank to keep current)"}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowPassword(prev => !prev);
                          }}
                          className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors duration-300 z-10 ${
                            isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                          }`}
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeSlashIcon className="h-5 w-5" />
                          ) : (
                            <EyeIcon className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      {formData.password && formData.password.startsWith('$2') && (
                        <p className={`mt-1 text-xs ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          Password is hashed. Enter a new password below to change it, or leave blank to keep current.
                        </p>
                      )}
                      {formErrors.password && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.password}</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Phone Number */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                          formErrors.phoneNumber
                            ? 'border-red-500'
                            : isDarkMode
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        }`}
                        placeholder="Enter phone number"
                      />
                      {formErrors.phoneNumber && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.phoneNumber}</p>
                      )}
                    </div>

                    {/* Address */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Address
                      </label>
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={3}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                          formErrors.address
                            ? 'border-red-500'
                            : isDarkMode
                              ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                        } resize-none`}
                        placeholder="Enter address"
                      />
                      {formErrors.address && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.address}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex justify-end space-x-3 p-6 border-t ${
              isDarkMode ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  resetForm();
                  setValidationAlert(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isDarkMode
                    ? 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-300 disabled:opacity-50"
              >
                {submitting ? 'Updating...' : 'Update User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-lg shadow-xl ${
            isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Delete User
              </h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                  setValidationAlert(null);
                }}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDarkMode
                    ? 'text-gray-400 hover:bg-white/10'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold overflow-hidden ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                    : 'bg-gradient-to-br from-red-600 to-red-700 text-white'
                }`}>
                  {selectedUser.profilePhoto ? (
                    <img src={selectedUser.profilePhoto} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : (
                    getUserInitials(selectedUser.name)
                  )}
                </div>
                <div className="ml-4">
                  <p className={`text-lg font-medium ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {selectedUser.name}
                  </p>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    {selectedUser.username}
                  </p>
                </div>
              </div>
              
              {!canDeleteUser(selectedUser) ? (
                <div className={`p-4 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <p className="text-sm font-medium mb-1">⚠️ Cannot Delete Yourself</p>
                  <p className="text-sm">
                    You cannot delete your own account as it would lock you out of the system. 
                    Please ask another superadmin to delete your account if needed.
                  </p>
                </div>
              ) : (
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Are you sure you want to delete this user? This action cannot be undone.
                </p>
              )}
            </div>

            <div className={`flex justify-end space-x-3 p-6 border-t ${
              isDarkMode ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                  setValidationAlert(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isDarkMode
                    ? 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting || !canDeleteUser(selectedUser)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  canDeleteUser(selectedUser)
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                } disabled:opacity-50`}
              >
                {isDeleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-lg shadow-xl ${
            isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {selectedUser.role === 'party' ? 'Party Profile' : 'User Profile'}
              </h3>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setSelectedUser(null);
                }}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDarkMode
                    ? 'text-gray-400 hover:bg-white/10'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center text-xl font-semibold overflow-hidden transition-all duration-300 shadow-md ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-650 text-white'
                    : 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white'
                }`}>
                  {selectedUser.profilePhoto ? (
                    <img src={selectedUser.profilePhoto} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : (
                    getUserInitials(selectedUser.name)
                  )}
                </div>
                <div className="ml-4">
                  <h4 className={`text-xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {selectedUser.name}
                  </h4>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    {selectedUser.username}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {selectedUser.phoneNumber && (
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Phone Number
                    </label>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      📞 {selectedUser.phoneNumber}
                    </p>
                  </div>
                )}

                {selectedUser.address && (
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Address
                    </label>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      📍 {selectedUser.address}
                    </p>
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Role
                  </label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedUser.role === 'master'
                      ? isDarkMode
                        ? 'bg-red-900/20 text-red-400'
                        : 'bg-red-100 text-red-800'
                      : selectedUser.role === 'superadmin'
                        ? isDarkMode
                          ? 'bg-purple-900/20 text-purple-400'
                          : 'bg-purple-100 text-purple-800'
                        : selectedUser.role === 'admin'
                          ? isDarkMode
                            ? 'bg-amber-900/20 text-amber-400'
                            : 'bg-amber-100 text-amber-800'
                          : selectedUser.role === 'party'
                            ? isDarkMode
                              ? 'bg-green-900/20 text-green-400'
                              : 'bg-green-100 text-green-800'
                            : isDarkMode
                              ? 'bg-blue-900/20 text-blue-400'
                              : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedUser.role === 'master' ? 'Master' : selectedUser.role === 'superadmin' ? 'Super Admin' : selectedUser.role === 'admin' ? 'Admin' : selectedUser.role === 'party' ? `Party: ${typeof selectedUser.partyId === 'object' && selectedUser.partyId !== null ? selectedUser.partyId.name : (parties.find(p => p._id === selectedUser.partyId)?.name || 'Party User')}` : 'User'}
                  </span>
                </div>

                {selectedUser.role === 'party' && (
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Party Information
                    </label>
                    <div className={`p-3 rounded-lg border ${
                      isDarkMode ? 'bg-green-900/10 border-green-500/20' : 'bg-green-50 border-green-200'
                    }`}>
                      <p className={`text-sm font-medium ${
                        isDarkMode ? 'text-green-400' : 'text-green-800'
                      }`}>
                        {typeof selectedUser.partyId === 'object' && selectedUser.partyId !== null
                          ? selectedUser.partyId.name
                          : parties.find(p => p._id === selectedUser.partyId)?.name || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Created
                  </label>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {formatDate(selectedUser.createdAt)}
                  </p>
                </div>

                {!selectedUser.phoneNumber && !selectedUser.address && (
                  <div className={`text-center py-4 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    No contact information available
                  </div>
                )}
              </div>
            </div>

            <div className={`flex justify-end p-6 border-t ${
              isDarkMode ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setSelectedUser(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isDarkMode
                    ? 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Party Modal */}
      {showAddPartyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-lg shadow-xl overflow-hidden ${
            isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Add New Party
              </h3>
              <button
                onClick={() => setShowAddPartyModal(false)}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveParty}>
              <div className="p-6 space-y-4">
                {partyError && (
                  <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm border border-red-500/20">
                    {partyError}
                  </div>
                )}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Party Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newPartyForm.name}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, name: e.target.value })}
                    placeholder="Enter party name"
                    className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                      isDarkMode
                        ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={newPartyForm.contactName}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, contactName: e.target.value })}
                    placeholder="Enter contact person name"
                    className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                      isDarkMode
                        ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={newPartyForm.contactPhone}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, contactPhone: e.target.value })}
                    placeholder="Enter contact phone number"
                    className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 ${
                      isDarkMode
                        ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Address
                  </label>
                  <textarea
                    rows={2}
                    value={newPartyForm.address}
                    onChange={(e) => setNewPartyForm({ ...newPartyForm, address: e.target.value })}
                    placeholder="Enter party address"
                    className={`w-full px-3 py-2 rounded-lg border transition-colors duration-300 resize-none ${
                      isDarkMode
                        ? 'bg-white/10 border-white/20 text-white focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              <div className={`flex justify-end space-x-3 p-6 border-t ${
                isDarkMode ? 'border-slate-700' : 'border-gray-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowAddPartyModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    isDarkMode
                      ? 'text-gray-300 hover:bg-white/10'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingParty}
                  className={`px-4 py-2 rounded-lg font-medium text-white transition-all duration-300 bg-blue-600 hover:bg-blue-700 disabled:opacity-50`}
                >
                  {savingParty ? 'Saving...' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}