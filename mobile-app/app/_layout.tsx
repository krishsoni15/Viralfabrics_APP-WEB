import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, useColorScheme, Image, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
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
import { Platform } from 'react-native';
import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (e) {
  // Safe fallback for builds missing native sharing modules
}
import BackupModal from '../components/shared/BackupModal';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources / validate session
SplashScreen.preventAutoHideAsync().catch(() => {});

// CSS import removed — all styles use React Native StyleSheet / inline styles

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      if (error?.response?.status === 401) return;

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

  useEffect(() => {
    (async () => {
      try {
        const syncSystem = await storage.getSyncSystemTheme();
        setSyncSystemTheme(syncSystem);

        if (syncSystem) {
          setDarkMode(systemColorScheme === 'dark');
        } else {
          const storedMode = await storage.getDarkMode();
          if (storedMode !== null) {
            setDarkMode(storedMode);
          } else {
            setDarkMode(systemColorScheme === 'dark');
          }
        }
      } catch (e) {
        setDarkMode(systemColorScheme === 'dark');
      }
    })();
  }, [systemColorScheme]);

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

  useEffect(() => {
    if (!isOffline) {
      setDismissedOffline(false);
    }
  }, [isOffline]);

  // Restore session on app start
  useEffect(() => {
    (async () => {
      const startTime = Date.now();
      try {
        // Check for stored token and user locally (super fast)
        const token = await storage.getToken();
        const storedUser = await storage.getUser();
        
        if (!token || !storedUser) {
          clearUser();
          setLoading(false);
        } else {
          // Restore user session instantly from local storage cache
          setUser(storedUser);
          setLoading(false);
          
          // Validate session in the background
          authService.validateSession().then(async (result) => {
            if (result.valid) {
              if (result.user) {
                setUser(result.user);
                await storage.setUser(result.user); // update local cache
              }
            } else {
              // Token expired/revoked, log out silently
              await storage.clearAll();
              clearUser();
            }
          }).catch(() => {
            // Network failed, keep current session (offline/poor connection support)
            if (__DEV__) {
              console.log('[Offline Mode] Network failed to validate session, keeping local cached user.');
            }
          });
        }
      } catch (err) {
        await storage.clearAll();
        clearUser();
        setLoading(false);
      } finally {
        // Ensure the splash screen stays visible for at least 1.5 seconds so users can see the branding and loader
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 1500 - elapsedTime);
        setTimeout(() => {
          setInitializing(false);
        }, remainingTime);
      }
    })();
  }, []);

  // Hide splash screen when initialization is finished
  useEffect(() => {
    if (!initializing) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [initializing]);

  // Auth redirect logic
  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated, segments, initializing]);

  if (initializing) {
    // Render a clean background matching the splash screen.
    // This allows the native splash screen to remain on screen without any double logo or spinner.
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
        }}
      />
    );
  }

  const theme = isDarkMode ? DarkTheme : LightTheme;

  const handleBackupConfirm = async (includeImages: boolean) => {
    setIsBackupModalOpen(false);
    setIsBackupDownloading(true);
    setBackupProgress(0);
    abortBackupRef.current = false;
    setBackupStatusText('Downloading textual data...');

    const tempZipPath = Platform.OS === 'web' ? '' : `${FileSystem.cacheDirectory}temp_backup.zip`;
    let finalZipPath = '';

    try {
      const token = await storage.getToken();
      if (!token) throw new Error('No authentication token found');

      let zip;

      if (Platform.OS === 'web') {
        const response = await fetch(`${CONFIG.API_URL}/api/backup`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) throw new Error(`Backup failed with status code ${response.status}`);
        const blob = await response.blob();
        zip = await JSZip.loadAsync(blob);
      } else {
        const downloadResult = await FileSystem.downloadAsync(
          `${CONFIG.API_URL}/api/backup`,
          tempZipPath,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (downloadResult.status !== 200) {
          throw new Error(`Backup failed with status code ${downloadResult.status}`);
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

        // Fetch images in chunks
        if (includeImages) {
          const total = imageUrlsToFetch.length;
          if (total > 0) {
            setBackupStatusText(`Fetching ${total} media files...`);
            let fetched = 0;
            const chunkSize = 3;
            for (let i = 0; i < total; i += chunkSize) {
              if (abortBackupRef.current) throw new Error('BACKUP_CANCELLED');
              const chunk = imageUrlsToFetch.slice(i, i + chunkSize);
              await Promise.all(
                chunk.map(async (item) => {
                  if (abortBackupRef.current) return;
                  try {
                    if (Platform.OS === 'web') {
                      const res = await fetch(
                        `${CONFIG.API_URL}/api/proxy-image?url=${encodeURIComponent(item.url)}`,
                        {
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                        }
                      );
                      if (res.ok) {
                        const imgBlob = await res.blob();
                        zip.folder(item.folder)?.file(item.filename, imgBlob);
                      }
                    } else {
                      const imgTempPath = `${FileSystem.cacheDirectory}temp_img_${i}_${Math.random()
                        .toString(36)
                        .substring(7)}`;
                      const imgDownloadResult = await FileSystem.downloadAsync(
                        `${CONFIG.API_URL}/api/proxy-image?url=${encodeURIComponent(item.url)}`,
                        imgTempPath,
                        {
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                        }
                      );
                      if (imgDownloadResult.status === 200) {
                        const imgBase64 = await FileSystem.readAsStringAsync(imgTempPath, {
                          encoding: 'base64',
                        });
                        zip.folder(item.folder)?.file(item.filename, imgBase64, { base64: true });
                      }
                      await FileSystem.deleteAsync(imgTempPath, { idempotent: true });
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
    } catch (err: any) {
      if (err.message === 'BACKUP_CANCELLED') {
        console.log('Backup was cancelled by the user.');
      } else {
        console.error('Backup download failed:', err);
        alert(`Failed to download backup: ${err.message || err}`);
      }
    } finally {
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
          contentStyle: { backgroundColor: 'transparent' },
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
                  onPress={() => {
                    abortBackupRef.current = true;
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
    </>
  );
}

export default function RootLayout() {
  const isDarkMode = useAppStore((s) => s.isDarkMode);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={isDarkMode ? 'light' : 'dark'} />
          <RootLayoutNav />
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
