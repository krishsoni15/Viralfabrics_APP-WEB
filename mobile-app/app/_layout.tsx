import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, useColorScheme, Image, Modal, TouchableOpacity, Pressable, LogBox, StatusBar, Platform, AppState } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

import { useAppStore } from '../store/useAppStore';
import { storage } from '../utils/storage';
import { authService } from '../services/auth';
import api from '../services/api';
import { Colors, LightTheme, DarkTheme } from '../constants/colors';
import { CONFIG } from '../constants/config';
import ToastContainer from '../components/ui/Toast';
import Button from '../components/ui/Button';
import { ShieldAlert, HardDrive, CheckCircle, X, AlertTriangle, WifiOff } from 'lucide-react-native';
// JSZip and FileSystem are lazy-imported in handleBackupConfirm to avoid slowing startup
let _JSZip: any = null;
let _FileSystem: any = null;
let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (e) {
  // Safe fallback for builds missing native sharing modules
}
import BackupModal from '../components/shared/BackupModal';
import * as SplashScreen from 'expo-splash-screen';
import { savePdfToDevice } from '../utils/pdfUtils';

// Keep the splash screen visible while we fetch resources / validate session
SplashScreen.preventAutoHideAsync().catch(() => {});

// Suppress deprecated warnings in development terminal & browser console
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = typeof args[0] === 'string' ? args[0] : args.join(' ');
  if (
    message.includes('InteractionManager has been deprecated') ||
    (message.includes('shadow*') && message.includes('deprecated')) ||
    message.includes('boxShadow') ||
    message.includes('pointerEvents is deprecated')
  ) {
    return;
  }
  originalWarn(...args);
};

LogBox.ignoreLogs([
  'shadow* style props are deprecated',
  'boxShadow',
  'InteractionManager has been deprecated',
  'props.pointerEvents is deprecated',
]);

// Production logging overrides (CPU optimization)
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
}

// Global hook to trigger garbage collection when app is backgrounded (adaptive RAM saving)
AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'background' && (global as any).gc) {
    try {
      (global as any).gc();
    } catch (e) {
      // Fail silently in production
    }
  }
});

// CSS import removed — all styles use React Native StyleSheet / inline styles

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      if (error?.response?.status === 401) return;
      
      const isOffline = useAppStore.getState().isOffline;
      const isNetworkError = !error?.response || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
      if (isOffline || isNetworkError) return;

      const message = error?.response?.data?.message || error?.message || 'Server connection failed';
      useAppStore.getState().addToast({
        type: 'error',
        title: 'Server Error',
        message: message,
      });
    }
  }),
  mutationCache: new MutationCache({
    onError: (error: any) => {
      if (error?.response?.status === 401) return;
      
      const isOffline = useAppStore.getState().isOffline;
      const isNetworkError = !error?.response || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
      if (isOffline || isNetworkError) return;

      const message = error?.response?.data?.message || error?.message || 'Could not complete request';
      useAppStore.getState().addToast({
        type: 'error',
        title: 'Action Failed',
        message: message,
      });
    }
  }),
  defaultOptions: {
    queries: {
      staleTime: CONFIG.QUERY_STALE_TIME,
      gcTime: CONFIG.QUERY_CACHE_TIME,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayoutNav() {
  const {
    isAuthenticated,
    isLoading,
    setUser,
    clearUser,
    setLoading,
    setDarkMode,
    isDarkMode,
    syncSystemTheme,
    setSyncSystemTheme,
    setThemePreference,
    user,
    isBackupModalOpen,
    setIsBackupModalOpen,
    isBackupDownloading,
    setIsBackupDownloading,
    backupProgress,
    setBackupProgress,
    backupStatusText,
    setBackupStatusText,
    isOffline,
    setIsOffline,
  } = useAppStore();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [initializing, setInitializing] = useState(true);

  const abortBackupRef = useRef(false);
  const activeDownloadRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [dismissedOffline, setDismissedOffline] = useState(false);

  // Real-time polling sync fallback
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isPolling = false;
    let lastCheckedDataChangeTimestamp: string | null = null;

    const interval = setInterval(async () => {
      // Pause polling if app is in background to save battery, data, and prevent OS terminations
      if (AppState.currentState !== 'active') {
        return;
      }

      if (isPolling) return;
      isPolling = true;

      try {
        const response = await api.get('/api/realtime/data-changed-status', {
          headers: { 'Cache-Control': 'no-cache' }
        });

        if (response.data?.success && response.data?.lastChange) {
          const { module, timestamp } = response.data.lastChange;

          if (lastCheckedDataChangeTimestamp !== timestamp) {
            const isFirstLoad = lastCheckedDataChangeTimestamp === null;
            lastCheckedDataChangeTimestamp = timestamp;

            if (!isFirstLoad) {
              if (__DEV__) {
                console.log(`[Realtime Sync] Data change detected: module = ${module}, invalidating queries.`);
              }
              // Invalidate all active queries to fetch fresh data instantly
              queryClient.invalidateQueries();
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[Realtime Sync] Polling sync failed:', error);
        }
      } finally {
        isPolling = false;
      }
    }, 6000); // Snappy 6-second polling interval

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // Animations for premium loading screen
  const logoScale = useSharedValue(0.95);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const loadingProgress = useSharedValue(-0.45);

  useEffect(() => {
    if (initializing) {
      // Clean, single-shot entrance animation on boot
      logoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.2)) });
      logoOpacity.value = withTiming(1, { duration: 500 });
      textOpacity.value = withTiming(1, { duration: 750 });
      
      // Indeterminate sliding loader segment
      loadingProgress.value = withRepeat(
        withTiming(1.2, {
          duration: 1500,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
        }),
        -1,
        false
      );
    }
  }, [initializing]);

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      opacity: logoOpacity.value,
      transform: [{ scale: logoScale.value }],
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
    };
  });

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      left: `${loadingProgress.value * 100}%`,
    };
  });

  // Sync system dark mode automatically or use stored preference
  const systemColorScheme = useColorScheme();

  // Load stored theme preference once on mount — parallelized for speed
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [syncSystem, storedMode] = await Promise.all([
          storage.getSyncSystemTheme(),
          storage.getDarkMode(),
        ]);
        if (!isMounted) return;

        const resolvedDark = syncSystem
          ? (systemColorScheme === 'dark')
          : (storedMode !== null ? storedMode : (systemColorScheme === 'dark'));

        setThemePreference(syncSystem, resolvedDark);
      } catch (e) {
        if (isMounted) {
          setThemePreference(true, systemColorScheme === 'dark');
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update theme dynamically when system color scheme changes, if sync is enabled
  useEffect(() => {
    if (syncSystemTheme) {
      setThemePreference(true, systemColorScheme === 'dark');
    }
  }, [systemColorScheme, syncSystemTheme]);

  // Synchronize browser online/offline status dynamically on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      if (typeof navigator !== 'undefined') {
        setIsOffline(!navigator.onLine);
      }

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Synchronize network online/offline status periodically on native mobile
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let isMounted = true;
    let timer: NodeJS.Timeout;

    const checkConnectivity = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        // Fetch to verify network path to API server is reachable
        await fetch(`${CONFIG.API_URL}/api/weavers`, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' }
        }).catch((err) => {
          // 401 Unauthorized or other HTTP responses don't reject fetch, only network errors do.
          // If we receive any HTTP response (even error status), the server is reachable and we are online.
          // If fetch fails completely, it throws a network error.
          throw err;
        });
        
        clearTimeout(timeoutId);
        if (isMounted) {
          setIsOffline(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsOffline(true);
        }
      }
    };

    checkConnectivity();
    timer = setInterval(checkConnectivity, 10000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [setIsOffline]);

  useEffect(() => {
    if (!isOffline) {
      setDismissedOffline(false);
    }
  }, [isOffline]);

  // Restore session on app start — parallelized storage reads for speed
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const startTime = Date.now();
      try {
        // Read token and user in parallel (single round-trip)
        const [token, storedUser] = await Promise.all([
          storage.getToken(),
          storage.getUser(),
        ]);
        
        if (!isMounted) return;

        if (!token || !storedUser) {
          clearUser();
          setLoading(false);
        } else {
          // Restore user session state locally
          setUser(storedUser);
          
          try {
            // Validate session with a 2-second timeout to avoid locking the screen on poor connections
            const validationPromise = authService.validateSession();
            const timeoutPromise = new Promise<{ valid: boolean; user?: any }>((resolve) => 
              setTimeout(() => resolve({ valid: true }), 2000)
            );
            
            const result = await Promise.race([validationPromise, timeoutPromise]);
            if (!isMounted) return;

            if (result.valid) {
              if (result.user && (result.user.id || result.user._id)) {
                setUser(result.user);
                await storage.setUser(result.user); // update local cache
              }
            } else {
              // Token expired/revoked, log out silently
              await storage.clearAll();
              clearUser();
            }
          } catch (err) {
            // Network failed, keep current session (offline/poor connection support)
            if (__DEV__) {
              console.log('[Offline Mode] Network failed to validate session, keeping local cached user.');
            }
          } finally {
            if (isMounted) {
              setLoading(false);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          await storage.clearAll();
          clearUser();
          setLoading(false);
        }
      } finally {
        if (isMounted) {
          // Brief splash for branding (300ms) — reduced from 1500ms for faster startup
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, 300 - elapsedTime);
          setTimeout(() => {
            if (isMounted) {
              setInitializing(false);
            }
          }, remainingTime);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Hide splash screen when initialization is finished
  useEffect(() => {
    if (!initializing) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [initializing]);

  // Auth redirect logic
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated, segments, isLoading]);

  const theme = isDarkMode ? DarkTheme : LightTheme;

  const handleBackupConfirm = async (includeImages: boolean) => {
    setIsBackupModalOpen(false);
    setIsBackupDownloading(true);
    setBackupProgress(0);
    abortBackupRef.current = false;
    setBackupStatusText('Downloading textual data...');

    // Lazy-load heavy modules only when backup is used
    if (!_JSZip) {
      const mod = await import('jszip');
      _JSZip = mod.default || mod;
    }
    if (!_FileSystem && Platform.OS !== 'web') {
      _FileSystem = await import('expo-file-system/legacy');
    }
    const FileSystem = _FileSystem;
    const JSZip = _JSZip;

    const tempZipPath = Platform.OS === 'web' ? '' : `${FileSystem.cacheDirectory}temp_backup.zip`;
    let finalZipPath = '';

    try {
      const token = await storage.getToken();
      if (!token) throw new Error('No authentication token found');

      let zip;

      if (Platform.OS === 'web') {
        const response = await fetch(`${CONFIG.API_URL}/api/backup?client=true`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) throw new Error(`Backup failed with status code ${response.status}`);
        const blob = await response.blob();
        zip = await JSZip.loadAsync(blob);
      } else {
        const downloadResumable = FileSystem.createDownloadResumable(
          `${CONFIG.API_URL}/api/backup?client=true`,
          tempZipPath,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          (downloadProgress: any) => {
            const totalBytesWritten = downloadProgress.totalBytesWritten;
            const totalBytesExpectedToWrite = downloadProgress.totalBytesExpectedToWrite;
            let progress = 0;
            if (totalBytesExpectedToWrite > 0) {
              progress = Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100);
            } else {
              // Estimate progress assuming a standard 1MB zip size if Content-Length is missing or chunked
              const estimatedTotal = 1000 * 1024;
              progress = Math.floor((totalBytesWritten / estimatedTotal) * 100);
            }
            setBackupProgress(Math.min(99, progress));
            setBackupStatusText(`Downloading data (${totalBytesWritten.toLocaleString()} / ${totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite.toLocaleString() : '1,000,000+'} bytes)...`);
          }
        );
        
        activeDownloadRef.current = downloadResumable;
        const downloadResult = await downloadResumable.downloadAsync();
        activeDownloadRef.current = null;

        if (!downloadResult || downloadResult.status !== 200) {
          throw new Error(`Backup failed with status code ${downloadResult ? downloadResult.status : 'cancelled'}`);
        }

        if (abortBackupRef.current) throw new Error('BACKUP_CANCELLED');

        setBackupStatusText('Reading backup files...');
        const base64Zip = await FileSystem.readAsStringAsync(tempZipPath, {
          encoding: 'base64',
        });

        zip = await JSZip.loadAsync(base64Zip, { base64: true });
      }

      const jsonFile = zip.file(/JSON\/full_backup\.json$/)[0];

      let filename = 'ViralFabrics_Backup.zip';
      if (includeImages) {
        filename = 'ViralFabrics_Backup_WithMedia.zip';
      }

      if (jsonFile) {
        setBackupStatusText('Generating Organized Folders...');
        const jsonStr = await jsonFile.async('string');
        const backupData = JSON.parse(jsonStr);
        const collections = backupData.collections || {};

        const organizedRoot = zip.folder('Organized Client Backup');
        if (organizedRoot) {
          organizedRoot.folder('Orders');
          organizedRoot.folder('Purchase Orders');
          organizedRoot.folder('Dispatches');
          organizedRoot.folder('Labs');
          organizedRoot.folder('Samples');
          organizedRoot.folder('Samplings');
          organizedRoot.folder('GreyMaterials');
          organizedRoot.folder('FinishLotStocks');
          organizedRoot.folder('Fabrics');
          organizedRoot.folder('Users');
        }
        const imageUrlsToFetch: { url: string; folder: string; filename: string }[] = [];

        const processDoc = (
          doc: any,
          collectionName: string,
          idField: string,
          imageExtractionFn: (d: any) => string[]
        ) => {
          if (!doc) return;
          const docId = doc[idField] || doc._id?.$oid || doc._id || 'unknown';
          const safeId = String(docId).replace(/[^a-zA-Z0-9_-]/g, '_');
          const docFolder = `Organized Client Backup/${collectionName}/${safeId}`;

          organizedRoot
            ?.folder(collectionName)
            ?.folder(safeId)
            ?.file('details.json', JSON.stringify(doc, null, 2));

          if (includeImages) {
            const urls = imageExtractionFn(doc) || [];
            urls.forEach((url, idx) => {
              if (typeof url === 'string' && url.trim() !== '') {
                const extMatch = url.match(/\.([^.?]+)(\?.*)?$/);
                const ext = extMatch ? extMatch[1] : 'jpg';
                imageUrlsToFetch.push({
                  url,
                  folder: `${docFolder}/images`,
                  filename: `image_${idx + 1}.${ext}`,
                });
              }
            });
          }
        };

        // Orders
        (collections.orders || []).forEach((order: any) => {
          processDoc(order, 'Orders', 'orderId', (d) => {
            const urls: string[] = [];
            if (d.items && Array.isArray(d.items)) {
              d.items.forEach((item: any) => {
                if (item.imageUrls && Array.isArray(item.imageUrls)) {
                  urls.push(...item.imageUrls);
                }
              });
            }
            return urls;
          });
        });

        // Dispatches
        (collections.dispatches || []).forEach((dispatch: any) => {
          processDoc(dispatch, 'Dispatches', 'dispatchNo', (d) => d.photos || []);
        });

        // Labs
        (collections.labs || []).forEach((lab: any) => {
          processDoc(lab, 'Labs', 'labId', (d) => (d.attachments || []).map((a: any) => a.url));
        });

        // Samples
        (collections.samples || []).forEach((sample: any) => {
          processDoc(sample, 'Samples', 'sampleId', (d) => d.images || []);
        });

        // Samplings
        (collections.samplings || []).forEach((sampling: any) => {
          processDoc(sampling, 'Samplings', 'samplingNo', (d) => d.images || []);
        });

        // GreyMaterials
        (collections.greyMaterials || []).forEach((gm: any) => {
          processDoc(gm, 'GreyMaterials', 'materialId', (d) => d.images || []);
        });

        // FinishLotStocks
        (collections.finishLotStocks || []).forEach((fls: any) => {
          processDoc(fls, 'FinishLotStocks', 'lotId', (d) => d.images || []);
        });

        // Fabrics
        (collections.fabrics || []).forEach((fab: any) => {
          processDoc(fab, 'Fabrics', 'fabricId', (d) => d.images || []);
        });

        // Users
        (collections.users || []).forEach((user: any) => {
          processDoc(user, 'Users', 'email', (d) => (d.profilePhoto ? [d.profilePhoto] : []));
        });

        // PurchaseOrders
        (collections.purchaseOrders || []).forEach((po: any) => {
          processDoc(po, 'Purchase Orders', 'poNumber', (d) => {
            const urls: string[] = [];
            if (d.specs && d.specs.attachments && Array.isArray(d.specs.attachments)) {
              d.specs.attachments.forEach((a: any) => {
                if (a.url) urls.push(a.url);
              });
            }
            return urls;
          });
        });

        // Fetch images in chunks
        if (includeImages) {
          const total = imageUrlsToFetch.length;
          if (total > 0) {
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            
            setBackupStatusText(`Fetching ${total} media files...`);
            let fetched = 0;
            const chunkSize = 15; // Increased from 3 to 15 for faster concurrent downloads
            for (let i = 0; i < total; i += chunkSize) {
              if (abortBackupRef.current) throw new Error('BACKUP_CANCELLED');
              const chunk = imageUrlsToFetch.slice(i, i + chunkSize);
              await Promise.all(
                chunk.map(async (item) => {
                  if (abortBackupRef.current) return;
                  try {
                    const res = await fetch(
                      `${CONFIG.API_URL}/api/proxy-image?url=${encodeURIComponent(item.url)}`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                        signal: abortController.signal,
                      }
                    );
                    if (res.ok) {
                      const arrayBuffer = await res.arrayBuffer();
                      zip.folder(item.folder)?.file(item.filename, arrayBuffer);
                    }
                  } catch (e) {
                    console.warn('Failed to fetch image', item.url, e);
                  }
                  fetched++;
                })
              );
              setBackupProgress(Math.floor((fetched / total) * 100));
              setBackupStatusText(`Fetching media files (${fetched}/${total})...`);
            }
          }
        }
      }

      if (abortBackupRef.current) throw new Error('BACKUP_CANCELLED');

      setBackupProgress(100);
      setBackupStatusText('Zipping files (This might take a moment)...');

      if (abortBackupRef.current) throw new Error('BACKUP_CANCELLED');

      if (Platform.OS === 'web') {
        const finalZipBlob = await zip.generateAsync({ type: 'blob' });
        const url = window.URL.createObjectURL(finalZipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const finalZipBase64 = await zip.generateAsync({ type: 'base64' });
        finalZipPath = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(finalZipPath, finalZipBase64, {
          encoding: 'base64',
        });
        
        if (Platform.OS === 'android') {
          const saveResult = await savePdfToDevice({
            url: '',
            filename,
            localUri: finalZipPath,
            dialogTitle: 'Save System Backup',
          });
          
          if (!saveResult.success) {
            if (Sharing && await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(finalZipPath, {
                mimeType: 'application/zip',
                dialogTitle: 'Save System Backup',
                UTI: 'public.zip-archive',
              });
            } else {
              alert(saveResult.message || 'Failed to save backup.');
            }
          } else {
            alert(`Backup saved successfully to organized folder!`);
          }
        } else {
          if (Sharing && await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(finalZipPath, {
              mimeType: 'application/zip',
              dialogTitle: 'Save System Backup',
              UTI: 'public.zip-archive',
            });
          } else {
            alert('Sharing is not available on this device');
          }
        }
      }
    } catch (err: any) {
      if (err.message === 'BACKUP_CANCELLED' || err.message?.includes('cancelled') || err.message?.includes('aborted')) {
        console.log('Backup was cancelled by the user.');
      } else {
        console.error('Backup download failed:', err);
        alert(`Failed to download backup: ${err.message || err}`);
      }
    } finally {
      activeDownloadRef.current = null;
      abortControllerRef.current = null;
      if (Platform.OS !== 'web') {
        try {
          await FileSystem.deleteAsync(tempZipPath, { idempotent: true });
        } catch {}
        if (finalZipPath) {
          try {
            await FileSystem.deleteAsync(finalZipPath, { idempotent: true });
          } catch {}
        }
      }
      setIsBackupDownloading(false);
    }
  };

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.neutral[100] },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="orders/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="orders/create"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />

        <Stack.Screen
          name="users/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="logs/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="access-denied"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="+not-found"
          options={{ headerShown: false }}
        />
      </Stack>
      <ToastContainer />
      <BackupModal
        visible={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onConfirm={handleBackupConfirm}
      />
      {isBackupDownloading && (
        <View style={[
          styles.progressCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          }
        ]}>
          <View style={styles.progressHeader}>
            <View style={styles.progressInfo}>
              <ActivityIndicator size="small" color={Colors.primary[600]} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.progressTitle, { color: theme.text }]}>
                  System Backup ({Math.round(backupProgress)}%)
                </Text>
                <Text style={[styles.progressSubtitle, { color: theme.textSecondary }]}>
                  {backupStatusText}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.cancelProgressBtn} 
              onPress={() => setShowCancelConfirm(true)}
            >
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Progress Bar */}
          <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? '#334155' : Colors.neutral[200] }]}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${backupProgress}%`, 
                  backgroundColor: Colors.primary[600] 
                }
              ]} 
            />
          </View>
        </View>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        transparent
        visible={showCancelConfirm}
        animationType="fade"
        onRequestClose={() => setShowCancelConfirm(false)}
      >
        <Pressable style={styles.modalBackdrop}>
          <View style={styles.confirmView}>
            <View style={[
              styles.confirmCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              }
            ]}>
              <View style={styles.confirmHeader}>
                <AlertTriangle size={24} color="#ef4444" style={{ marginRight: 8 }} />
                <Text style={[styles.confirmTitle, { color: theme.text }]}>Cancel Backup?</Text>
              </View>
              <Text style={[styles.confirmMessage, { color: theme.textSecondary }]}>
                Are you sure you want to abort the current backup download? Any progress will be lost.
              </Text>
              <View style={styles.confirmFooter}>
                <TouchableOpacity 
                  style={[styles.confirmBtn, { backgroundColor: isDarkMode ? '#334155' : Colors.neutral[100] }]}
                  onPress={() => setShowCancelConfirm(false)}
                >
                  <Text style={[styles.confirmBtnText, { color: theme.textSecondary }]}>No, Continue</Text>
                </TouchableOpacity>
                 <TouchableOpacity 
                  style={[styles.confirmBtn, { backgroundColor: '#ef4444' }]}
                  onPress={async () => {
                    abortBackupRef.current = true;
                    if (activeDownloadRef.current) {
                      try {
                        await activeDownloadRef.current.cancelAsync();
                      } catch (e) {
                        console.warn('Failed to cancel active download:', e);
                      }
                    }
                    if (abortControllerRef.current) {
                      try {
                        abortControllerRef.current.abort();
                      } catch (e) {
                        console.warn('Failed to abort fetch controller:', e);
                      }
                    }
                    setShowCancelConfirm(false);
                  }}
                >
                  <Text style={[styles.confirmBtnText, { color: '#ffffff', fontWeight: '600' }]}>Yes, Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>
      {isOffline && !dismissedOffline && (
        <View style={{
          position: 'absolute',
          top: insets.top + 6,
          left: 16,
          right: 16,
          backgroundColor: isDarkMode ? '#fbbf24' : '#d97706',
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 5,
          zIndex: 9999,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <WifiOff size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              Working Offline (Showing Cached Data)
            </Text>
          </View>
          <TouchableOpacity onPress={() => setDismissedOffline(true)} style={{ padding: 4, marginLeft: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {initializing && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDarkMode ? Colors.neutral[900] : Colors.white,
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 99999,
            }
          ]}
        >
          {/* Logo Animation */}
          <Animated.View style={[{ alignItems: 'center' }, animatedLogoStyle]}>
            <Image
              source={require('../assets/logo-clean.png')}
              style={{ width: 140, height: 140, marginBottom: 24 }}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Text Animation */}
          <Animated.View style={[{ alignItems: 'center' }, animatedTextStyle]}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '900',
                color: isDarkMode ? Colors.neutral[50] : Colors.neutral[900],
                letterSpacing: -0.5,
                marginBottom: 6,
              }}
            >
              Viral Fabrics
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: theme.textSecondary,
                marginBottom: 32,
              }}
            >
              Loading active session...
            </Text>
          </Animated.View>

          {/* Premium Indeterminate Progress Bar */}
          <View
            style={{
              width: 180,
              height: 4,
              backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: '45%',
                  backgroundColor: Colors.primary[600],
                  borderRadius: 2,
                },
                animatedProgressStyle,
              ]}
            />
          </View>
        </Animated.View>
      )}
    </>
  );
}

import { ThemeProvider as NavigationProvider, DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme } from 'expo-router';

export default function RootLayout() {
  const isDarkMode = useAppStore((s) => s.isDarkMode);

  const navTheme = {
    ...(isDarkMode ? NavDarkTheme : NavDefaultTheme),
    dark: isDarkMode,
    colors: {
      ...(isDarkMode ? NavDarkTheme.colors : NavDefaultTheme.colors),
      primary: Colors.primary[600],
      background: isDarkMode ? Colors.neutral[900] : Colors.white,
      card: isDarkMode ? Colors.neutral[800] : Colors.white,
      text: isDarkMode ? Colors.neutral[50] : Colors.neutral[900],
      border: isDarkMode ? Colors.neutral[700] : Colors.neutral[200],
      notification: Colors.primary[500],
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationProvider value={navTheme}>
            <StatusBar
              barStyle={isDarkMode ? 'light-content' : 'dark-content'}
              translucent={true}
              backgroundColor="transparent"
            />
            <RootLayoutNav />
          </NavigationProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ErrorBoundary for catching and rendering global application errors
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const theme = isDarkMode ? DarkTheme : LightTheme;

  return (
    <SafeAreaProvider style={{ backgroundColor: theme.background }}>
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <View style={styles.errorCard}>
          <View style={[
            styles.errorIconContainer,
            {
              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.08)' : Colors.error[50],
              borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
              borderWidth: 1,
            }
          ]}>
            <ShieldAlert size={40} color={Colors.error[500]} />
          </View>

          <Text style={[styles.errorTitle, { color: theme.text }]}>Something went wrong</Text>
          <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>
            An unexpected error occurred in the application. Please try resetting the app state.
          </Text>

          <View style={{
            width: '100%',
            padding: 16,
            borderRadius: 12,
            backgroundColor: isDarkMode ? '#17171c' : '#f8fafc',
            borderWidth: 1,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            marginBottom: 28,
          }}>
            <Text style={{
              fontSize: 12,
              fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
              color: isDarkMode ? '#fca5a5' : '#b91c1c',
            }} numberOfLines={5}>
              {error.message || 'Unknown error'}
            </Text>
          </View>

          <View style={{ width: '100%' }}>
            <Button
              title="Try Again"
              onPress={async () => {
                await retry();
              }}
              variant="primary"
              size="lg"
            />
          </View>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconContainer: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: Colors.error[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 3,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  errorSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  progressCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 9999,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  progressSubtitle: {
    fontSize: 12,
  },
  cancelProgressBtn: {
    padding: 6,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmView: {
    width: '85%',
    maxWidth: 320,
  },
  confirmCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  confirmMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  confirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
  },
});
