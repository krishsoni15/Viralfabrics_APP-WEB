import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  Image,
  StyleSheet,
  useColorScheme,
  useWindowDimensions
} from 'react-native';
import { X, Share2, Download, Maximize2, Minimize2, Crop, Check } from 'lucide-react-native';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  SharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import * as Haptics from 'expo-haptics';



// ── Image cache helpers (expo-file-system) ──
const imageCache = new Map<string, string>();

async function getCachedImageUri(remoteUri: string): Promise<string> {
  if (!remoteUri || !remoteUri.startsWith('http')) return remoteUri;
  if (imageCache.has(remoteUri)) return imageCache.get(remoteUri)!;

  if (Platform.OS === 'web') {
    imageCache.set(remoteUri, remoteUri);
    return remoteUri;
  }

  try {
    const FileSystem = require('expo-file-system');
    const FS = FileSystem?.default || FileSystem;
    if (!FS?.cacheDirectory || !FS?.getInfoAsync || !FS?.downloadAsync) {
      imageCache.set(remoteUri, remoteUri);
      return remoteUri;
    }

    // Deterministic filename from URL
    const hash = remoteUri.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    const ext = (remoteUri.split('/').pop()?.split('?')[0]?.split('.').pop()) || 'jpg';
    const localPath = `${FS.cacheDirectory}img_cache_${Math.abs(hash)}.${ext}`;

    const info = await FS.getInfoAsync(localPath);
    if (info.exists) {
      imageCache.set(remoteUri, localPath);
      return localPath;
    }

    const dl = await FS.downloadAsync(remoteUri, localPath);
    if (dl.status === 200) {
      imageCache.set(remoteUri, dl.uri);
      return dl.uri;
    }
  } catch (e) {
    console.warn('Image cache miss:', e);
  }

  imageCache.set(remoteUri, remoteUri);
  return remoteUri;
}

interface ImagePreviewModalProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  onSaveCroppedImage?: (croppedUri: string, index: number) => Promise<string | null>;
  singlePhoto?: boolean;
  isDarkMode?: boolean;
}

async function cropImageOnWeb(
  uri: string,
  originX: number,
  originY: number,
  width: number,
  height: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new (window as any).Image() as HTMLImageElement;
    if (uri.startsWith('http') && !uri.startsWith('http://localhost') && !uri.startsWith('http://127.0.0.1')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(uri);
        return;
      }
      ctx.drawImage(img, originX, originY, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = (err) => {
      console.warn('Web crop image error:', err);
      resolve(uri);
    };
    img.src = uri;
  });
}

function getCropBoxDimensions(ratio: '4:3' | '16:9' | '1:1' | 'Full', imgAspect: number, screenWidth: number, screenHeight: number) {
  const maxW = screenWidth - 40;
  const maxH = (screenHeight * 0.75) - 40;

  let w = maxW;
  let h = maxH;

  if (ratio === '1:1') {
    const size = Math.min(maxW, maxH, 280);
    w = size;
    h = size;
  } else if (ratio === '4:3') {
    if (maxW * (4 / 3) <= maxH) {
      w = maxW;
      h = maxW * (4 / 3);
    } else {
      h = maxH;
      w = maxH * (3 / 4);
    }
  } else if (ratio === '16:9') {
    if (maxW * (16 / 9) <= maxH) {
      w = maxW;
      h = maxW * (16 / 9);
    } else {
      h = maxH;
      w = maxH * (9 / 16);
    }
  } else if (ratio === 'Full') {
    const targetAspect = imgAspect > 0 ? imgAspect : 1;
    if (targetAspect > maxW / maxH) {
      w = maxW;
      h = maxW / targetAspect;
    } else {
      h = maxH;
      w = maxH * targetAspect;
    }
  }

  w = Math.max(100, w);
  h = Math.max(100, h);

  return { width: w, height: h };
}

interface ZoomableImageProps {
  uri: string;
  zoomMode: 'contain' | 'cover';
  onZoomChange: (zoomed: boolean) => void;
  scale: SharedValue<number>;
  savedScale: SharedValue<number>;
  translationX: SharedValue<number>;
  translationY: SharedValue<number>;
  savedTranslationX: SharedValue<number>;
  savedTranslationY: SharedValue<number>;
  isActive: boolean;
  isCropping: boolean;
  cropBoxX: SharedValue<number>;
  cropBoxY: SharedValue<number>;
  cropBoxW: SharedValue<number>;
  cropBoxH: SharedValue<number>;
  naturalSize: { width: number; height: number } | null;
  onLoadSize?: (size: { width: number; height: number }) => void;
}

function ZoomableImage({
  uri,
  zoomMode,
  onZoomChange,
  scale,
  savedScale,
  translationX,
  translationY,
  savedTranslationX,
  savedTranslationY,
  isActive,
  isCropping,
  cropBoxX,
  cropBoxY,
  cropBoxW,
  cropBoxH,
  naturalSize,
  onLoadSize
}: ZoomableImageProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isZoomedRef = useRef(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [cachedUri, setCachedUri] = useState(uri);

  // Resolve cached URI on mount / URI change
  useEffect(() => {
    setHasLoaded(false);
    let cancelled = false;
    getCachedImageUri(uri).then((resolved) => {
      if (!cancelled) setCachedUri(resolved);
    });
    return () => { cancelled = true; };
  }, [uri]);

  const updateZoomState = useCallback((zoomed: boolean) => {
    if (isZoomedRef.current !== zoomed) {
      isZoomedRef.current = zoomed;
      setIsZoomed(zoomed);
      onZoomChange(zoomed);
    }
  }, [onZoomChange]);

  // Sync scale with the toolbar zoomMode changes
  useEffect(() => {
    if (!isActive) return;
    const targetScale = zoomMode === 'cover' ? 1.8 : 1;
    scale.value = withTiming(targetScale);
    savedScale.value = targetScale;
    if (targetScale === 1) {
      translationX.value = withTiming(0);
      translationY.value = withTiming(0);
      savedTranslationX.value = 0;
      savedTranslationY.value = 0;
    }
    updateZoomState(targetScale !== 1);
  }, [zoomMode, updateZoomState, isActive]);


  const pinchGesture = Gesture.Pinch()
    .enabled(isActive)
    .onUpdate((e) => {
      const nextScale = Math.max(1, Math.min(6, savedScale.value * e.scale));
      scale.value = nextScale;
      runOnJS(updateZoomState)(nextScale > 1.05);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
        runOnJS(updateZoomState)(false);
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(isActive)
    .minDistance((isZoomed || isCropping) ? 5 : 99999)
    .onUpdate((e) => {
      if (scale.value > 1.05 || isCropping) {
        // Calculate boundaries so the image doesn't pan out of the screen view limits
        let displayedWidth = screenWidth;
        let displayedHeight = screenHeight * 0.75;

        if (naturalSize) {
          const imageAspect = naturalSize.width / naturalSize.height;
          const viewportAspect = screenWidth / (screenHeight * 0.75);

          if (imageAspect > viewportAspect) {
            displayedWidth = screenWidth;
            displayedHeight = screenWidth / imageAspect;
          } else {
            displayedHeight = screenHeight * 0.75;
            displayedWidth = (screenHeight * 0.75) * imageAspect;
          }
        }

        const scaledWidth = displayedWidth * scale.value;
        const scaledHeight = displayedHeight * scale.value;

        const viewportWidth = screenWidth;
        const viewportHeight = screenHeight * 0.75;

        const minTx = isCropping 
          ? cropBoxX.value + cropBoxW.value - viewportWidth / 2 - scaledWidth / 2
          : -Math.max(0, (scaledWidth - screenWidth) / 2);
        
        const maxTx = isCropping
          ? cropBoxX.value - viewportWidth / 2 + scaledWidth / 2
          : Math.max(0, (scaledWidth - screenWidth) / 2);

        const minTy = isCropping
          ? cropBoxY.value + cropBoxH.value - viewportHeight / 2 - scaledHeight / 2
          : -Math.max(0, (scaledHeight - screenHeight * 0.75) / 2);

        const maxTy = isCropping
          ? cropBoxY.value - viewportHeight / 2 + scaledHeight / 2
          : Math.max(0, (scaledHeight - screenHeight * 0.75) / 2);

        const nextTx = savedTranslationX.value + e.translationX;
        const nextTy = savedTranslationY.value + e.translationY;

        if (isCropping && scaledWidth < cropBoxW.value) {
          translationX.value = (cropBoxX.value + cropBoxW.value / 2) - viewportWidth / 2;
        } else {
          translationX.value = Math.max(minTx, Math.min(maxTx, nextTx));
        }

        if (isCropping && scaledHeight < cropBoxH.value) {
          translationY.value = (cropBoxY.value + cropBoxH.value / 2) - viewportHeight / 2;
        } else {
          translationY.value = Math.max(minTy, Math.min(maxTy, nextTy));
        }
      }
    })
    .onEnd(() => {
      savedTranslationX.value = translationX.value;
      savedTranslationY.value = translationY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .enabled(isActive)
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.05) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translationX.value = withTiming(0);
        translationY.value = withTiming(0);
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
        runOnJS(updateZoomState)(false);
      } else {
        scale.value = withTiming(3);
        savedScale.value = 3;
        runOnJS(updateZoomState)(true);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translationX.value },
        { translateY: translationY.value },
      ],
    };
  });

  const combinedGesture = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, pinchGesture),
    panGesture
  );

  return (
    <GestureDetector gesture={combinedGesture}>
      <View style={{ width: screenWidth, height: '100%', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        {!hasLoaded && (
          <ActivityIndicator
            size="large"
            color="#6366f1"
            style={{ position: 'absolute', zIndex: 5 }}
          />
        )}
        <Animated.Image
          source={{ uri: cachedUri }}
          style={[
            {
              width: screenWidth,
              height: screenHeight * 0.75,
            },
            animatedStyle
          ]}
          resizeMode="contain"
          onLoad={(event) => {
            setHasLoaded(true);
            if (event.nativeEvent?.source) {
              const { width, height } = event.nativeEvent.source;
              if (width && height) {
                onLoadSize?.({ width, height });
              }
            }
          }}
          onLoadEnd={() => setHasLoaded(true)}
          onError={() => setHasLoaded(true)}
        />
      </View>
    </GestureDetector>
  );
}

const fetchImageSize = async (uri: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS === 'web') {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error)
      );
    } else {
      try {
        const ImageManipulator = require('expo-image-manipulator');
        const ImageManipulatorLib = ImageManipulator ? (ImageManipulator.default || ImageManipulator) : null;
        if (ImageManipulatorLib && ImageManipulatorLib.manipulateAsync) {
          ImageManipulatorLib.manipulateAsync(uri, [])
            .then((result: any) => {
              resolve({ width: result.width, height: result.height });
            })
            .catch((err: any) => {
              Image.getSize(
                uri,
                (width, height) => resolve({ width, height }),
                (error) => reject(error)
              );
            });
        } else {
          Image.getSize(
            uri,
            (width, height) => resolve({ width, height }),
            (error) => reject(error)
          );
        }
      } catch {
        Image.getSize(
          uri,
          (width, height) => resolve({ width, height }),
          (error) => reject(error)
        );
      }
    }
  });
};

export default function ImagePreviewModal({
  visible,
  images,
  initialIndex = 0,
  onClose,
  onSaveCroppedImage,
  singlePhoto,
  isDarkMode
}: ImagePreviewModalProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const effectiveIsDarkMode = isDarkMode ?? colorScheme === 'dark';
  const themeSurface = effectiveIsDarkMode ? '#020617' : '#f8fafc';
  const themePanel = effectiveIsDarkMode ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const themeBorder = effectiveIsDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const themeText = effectiveIsDarkMode ? '#f8fafc' : '#0f172a';
  const themeSecondaryText = effectiveIsDarkMode ? '#cbd5e1' : '#475569';
  const themeIcon = effectiveIsDarkMode ? '#e2e8f0' : '#1e293b';
  const overlayTint = effectiveIsDarkMode ? 'rgba(2, 6, 23, 0.82)' : 'rgba(15, 23, 42, 0.72)';
  const cropGuideColor = effectiveIsDarkMode ? 'rgba(248, 250, 252, 0.28)' : 'rgba(15, 23, 42, 0.28)';
  const cropGridColor = effectiveIsDarkMode ? 'rgba(248, 250, 252, 0.14)' : 'rgba(15, 23, 42, 0.14)';
  const imagesSerialized = JSON.stringify(images);
  const [localImages, setLocalImages] = useState<string[]>(images);
  const insets = useSafeAreaInsets();
  const [currentActiveIndex, setCurrentActiveIndex] = useState(initialIndex);
  const [zoomMode, setZoomMode] = useState<'contain' | 'cover'>('contain');
  const [isZoomed, setIsZoomed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [savingCropped, setSavingCropped] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [cropRatio, setCropRatio] = useState<'4:3' | '16:9' | '1:1' | 'Full'>('Full');

  const galleryRef = useRef<ScrollView>(null);

  // Sync state copy of images list
  useEffect(() => {
    setLocalImages(images);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesSerialized]);

  // Fetch natural size of the active image to calculate crop box bounds
  useEffect(() => {
    const currentUrl = localImages?.[currentActiveIndex];
    setNaturalSize(null); // Reset natural size when active image changes
    if (currentUrl) {
      fetchImageSize(currentUrl)
        .then((size) => {
          setNaturalSize(size);
        })
        .catch((error) => {
          console.warn('Failed to get image size:', error);
        });
    }
  }, [currentActiveIndex, localImages]);

  // Shared values for zoom/pan gestures
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);

  // Interactive Resizable & Draggable Crop Box Shared Values
  const cropBoxX = useSharedValue(0);
  const cropBoxY = useSharedValue(0);
  const cropBoxW = useSharedValue(0);
  const cropBoxH = useSharedValue(0);

  const startBoxX = useSharedValue(0);
  const startBoxY = useSharedValue(0);
  const startBoxW = useSharedValue(0);
  const startBoxH = useSharedValue(0);

  const handleZoomChange = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed);
  }, []);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const dragGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-10, 10])
    .enabled(!isZoomed && !isCropping) // Lock drag-to-dismiss in zoom or crop modes
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        opacity.value = Math.max(0.3, 1 - e.translationY / 400);
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 500) {
        translateY.value = withTiming(screenHeight, { duration: 200 }, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withTiming(0);
        opacity.value = withTiming(1);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  const resetCropBox = useCallback((ratio: '4:3' | '16:9' | '1:1' | 'Full', size: { width: number; height: number } | null) => {
    const aspect = size ? size.width / size.height : 1;
    const { width: initW, height: initH } = getCropBoxDimensions(ratio, aspect, screenWidth, screenHeight);
    cropBoxW.value = initW;
    cropBoxH.value = initH;
    cropBoxX.value = (screenWidth - initW) / 2;
    cropBoxY.value = (screenHeight * 0.75 - initH) / 2;
  }, [screenWidth, screenHeight]);

  // Sync active index when modal becomes visible or initialIndex changes
  useEffect(() => {
    if (visible) {
      setCurrentActiveIndex(initialIndex);
      setZoomMode('contain'); // Reset zoom mode when opening
      setIsZoomed(singlePhoto ? true : false);
      setIsCropping(singlePhoto ? true : false);
      setSavingCropped(false);
      setCropRatio('Full'); // Default crop ratio
      translateY.value = 0;
      opacity.value = 1;
      
      // Reset gestures
      scale.value = 1;
      savedScale.value = 1;
      translationX.value = 0;
      translationY.value = 0;
      savedTranslationX.value = 0;
      savedTranslationY.value = 0;

      // Centered initial crop box setup
      const parsedImages = JSON.parse(imagesSerialized);
      const currentUrl = parsedImages[initialIndex];
      if (currentUrl) {
        fetchImageSize(currentUrl)
          .then((size) => {
            setNaturalSize(size);
            resetCropBox('Full', size);
          })
          .catch((error) => {
            console.warn('Failed to get initial image size:', error);
            resetCropBox('Full', null);
          });
      } else {
        resetCropBox('Full', null);
      }

      setTimeout(() => {
        galleryRef.current?.scrollTo({ x: initialIndex * screenWidth, animated: false });
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialIndex, imagesSerialized, resetCropBox, singlePhoto]);

  const handleShare = async () => {
    const currentUrl = localImages[currentActiveIndex];
    if (!currentUrl) return;
    try {
      await Share.share({
        url: currentUrl,
        message: currentUrl,
      });
    } catch (error: any) {
      Alert.alert('Error', 'Could not share the image: ' + error.message);
    }
  };

  const handleDownload = async () => {
    const currentUrl = localImages[currentActiveIndex];
    if (!currentUrl) return;

    try {
      setDownloading(true);

      if (Platform.OS === 'web') {
        const response = await fetch(currentUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        const filename = currentUrl.split('/').pop() || 'download.jpg';
        link.download = filename.split('?')[0];
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        Alert.alert('Success', 'Image downloaded successfully!');
        return;
      }

      const FileSystem = require('expo-file-system');
      const MediaLibrary = require('expo-media-library');

      const FileSystemLib = FileSystem ? (FileSystem.default || FileSystem) : null;
      const MediaLibraryLib = MediaLibrary ? (MediaLibrary.default || MediaLibrary) : null;

      if (!FileSystemLib || !MediaLibraryLib || !MediaLibraryLib.requestPermissionsAsync || !FileSystemLib.downloadAsync) {
        throw new Error('Required Expo native modules are not fully resolved. Please restart your Metro server.');
      }

      const { status } = await MediaLibraryLib.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Viral Fabrics needs access to storage to save images.');
        setDownloading(false);
        return;
      }

      const filename = currentUrl.split('/').pop() || 'download.jpg';
      const cleanFilename = filename.split('?')[0];
      const fileUri = `${FileSystemLib.documentDirectory}${Date.now()}_${cleanFilename}`;

      const downloadRes = await FileSystemLib.downloadAsync(currentUrl, fileUri);
      if (downloadRes.status !== 200) {
        throw new Error('Server returned status code ' + downloadRes.status);
      }

      const asset = await MediaLibraryLib.createAssetAsync(downloadRes.uri);
      await MediaLibraryLib.createAlbumAsync('Viral Fabrics', asset, false);

      Alert.alert('Success', 'Image downloaded successfully and saved to your Gallery!');
    } catch (error: any) {
      Alert.alert('Error', 'Could not save the image: ' + error.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleConfirmOriginal = async () => {
    const currentUrl = localImages[currentActiveIndex];
    if (!currentUrl || !onSaveCroppedImage) return;

    try {
      setSavingCropped(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await onSaveCroppedImage(currentUrl, currentActiveIndex);
    } catch (err: any) {
      console.error('Error saving original photo:', err);
      Alert.alert('Error', 'Failed to save photo: ' + err.message);
    } finally {
      setSavingCropped(false);
    }
  };

  const handleSaveCrop = async () => {
    const currentUrl = localImages[currentActiveIndex];
    if (!currentUrl || !onSaveCroppedImage) return;

    if (!naturalSize) {
      Alert.alert('Loading', 'Please wait for the image to load fully.');
      return;
    }

    try {
      setSavingCropped(true);

      const s = scale.value;
      const tx = translationX.value;
      const ty = translationY.value;

      const viewportWidth = screenWidth;
      const viewportHeight = screenHeight * 0.75;

      // Calculate displayed image size within containment box
      let displayedWidth = viewportWidth;
      let displayedHeight = viewportHeight;

      const imageAspect = naturalSize.width / naturalSize.height;
      const viewportAspect = viewportWidth / viewportHeight;

      if (imageAspect > viewportAspect) {
        displayedWidth = viewportWidth;
        displayedHeight = viewportWidth / imageAspect;
      } else {
        displayedHeight = viewportHeight;
        displayedWidth = viewportHeight * imageAspect;
      }

      const scaledWidth = displayedWidth * s;
      const scaledHeight = displayedHeight * s;

      const centerX = viewportWidth / 2 + tx;
      const centerY = viewportHeight / 2 + ty;

      const imageLeft = centerX - scaledWidth / 2;
      const imageTop = centerY - scaledHeight / 2;

      const cbX = cropBoxX.value;
      const cbY = cropBoxY.value;
      const cbW = cropBoxW.value;
      const cbH = cropBoxH.value;

      const relativeCropLeft = cbX - imageLeft;
      const relativeCropTop = cbY - imageTop;

      // Map to natural image dimensions
      const cropX = (relativeCropLeft / scaledWidth) * naturalSize.width;
      const cropY = (relativeCropTop / scaledHeight) * naturalSize.height;
      const cropW = (cbW / scaledWidth) * naturalSize.width;
      const cropH = (cbH / scaledHeight) * naturalSize.height;

      // Clamp coordinates to prevent out-of-bound crashes
      let originX = Math.max(0, Math.round(cropX));
      let originY = Math.max(0, Math.round(cropY));
      let width = Math.max(1, Math.round(cropW));
      let height = Math.max(1, Math.round(cropH));

      if (originX + width > naturalSize.width) {
        width = Math.max(1, naturalSize.width - originX);
      }
      if (originY + height > naturalSize.height) {
        height = Math.max(1, naturalSize.height - originY);
      }

      let manipulateResult: { uri: string } = { uri: currentUrl };

      if (Platform.OS === 'web') {
        const croppedDataUrl = await cropImageOnWeb(currentUrl, originX, originY, width, height);
        manipulateResult = { uri: croppedDataUrl };
      } else {
        try {
          // Programmatically crop using expo-image-manipulator
          const ImageManipulator = require('expo-image-manipulator');
          const ImageManipulatorLib = ImageManipulator ? (ImageManipulator.default || ImageManipulator) : null;

          if (!ImageManipulatorLib || !ImageManipulatorLib.manipulateAsync) {
            throw new Error('expo-image-manipulator is not available.');
          }

          manipulateResult = await ImageManipulatorLib.manipulateAsync(
            currentUrl,
            [
              {
                crop: {
                  originX,
                  originY,
                  width,
                  height,
                },
              },
            ],
            { compress: 0.9, format: ImageManipulatorLib.SaveFormat.JPEG }
          );
        } catch (nativeErr: any) {
          console.warn('Native cropping failed:', nativeErr);
          Alert.alert(
            'Cropping Unavailable',
            'Native cropping is not available. The photo will be saved without cropping.',
            [{ text: 'OK' }]
          );
          manipulateResult = { uri: currentUrl };
        }
      }

      // Call the callback to upload and update parent state
      const newUploadedUrl = await onSaveCroppedImage(manipulateResult.uri, currentActiveIndex);
      if (newUploadedUrl) {
        setLocalImages(prev => {
          const updated = [...prev];
          updated[currentActiveIndex] = newUploadedUrl;
          return updated;
        });

        setIsCropping(false);
        // Reset scale/pan
        scale.value = 1;
        savedScale.value = 1;
        translationX.value = 0;
        translationY.value = 0;
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
        setIsZoomed(false);
        Alert.alert('Success', 'Image cropped and saved successfully!');
      } else {
        throw new Error('Upload returned null');
      }
    } catch (err: any) {
      console.error('Error during image crop/save:', err);
      Alert.alert('Error', 'Failed to crop and save the image: ' + err.message);
    } finally {
      setSavingCropped(false);
    }
  };

  const toggleZoomMode = () => {
    setZoomMode(prev => (prev === 'contain' ? 'cover' : 'contain'));
  };

  // Reanimated Animated Styles for Dynamic Mask Rendering
  const animatedTopMaskStyle = useAnimatedStyle(() => {
    return {
      top: 0,
      left: 0,
      right: 0,
      height: cropBoxY.value,
    };
  });

  const animatedBottomMaskStyle = useAnimatedStyle(() => {
    return {
      top: cropBoxY.value + cropBoxH.value,
      left: 0,
      right: 0,
      bottom: 0,
    };
  });

  const animatedLeftMaskStyle = useAnimatedStyle(() => {
    return {
      top: cropBoxY.value,
      left: 0,
      width: cropBoxX.value,
      height: cropBoxH.value,
    };
  });

  const animatedRightMaskStyle = useAnimatedStyle(() => {
    return {
      top: cropBoxY.value,
      left: cropBoxX.value + cropBoxW.value,
      right: 0,
      height: cropBoxH.value,
    };
  });

  const animatedCropBoxStyle = useAnimatedStyle(() => {
    return {
      left: cropBoxX.value,
      top: cropBoxY.value,
      width: cropBoxW.value,
      height: cropBoxH.value,
    };
  });

  const minW = 80;
  const minH = 80;
  const viewportWidth = screenWidth;
  const viewportHeight = screenHeight * 0.75;

  // Gesture definitions for interactive crop box corners resizing
  const tlGesture = Gesture.Pan()
    .onStart(() => {
      startBoxX.value = cropBoxX.value;
      startBoxY.value = cropBoxY.value;
      startBoxW.value = cropBoxW.value;
      startBoxH.value = cropBoxH.value;
    })
    .onUpdate((e) => {
      const fixedRight = startBoxX.value + startBoxW.value;
      const fixedBottom = startBoxY.value + startBoxH.value;

      let nextX = startBoxX.value + e.translationX;
      let nextY = startBoxY.value + e.translationY;

      nextX = Math.max(0, Math.min(fixedRight - minW, nextX));
      nextY = Math.max(0, Math.min(fixedBottom - minH, nextY));

      if (cropRatio === 'Full') {
        cropBoxX.value = nextX;
        cropBoxY.value = nextY;
        cropBoxW.value = fixedRight - nextX;
        cropBoxH.value = fixedBottom - nextY;
      } else {
        let R = 1;
        if (cropRatio === '4:3') R = 3/4;
        else if (cropRatio === '16:9') R = 9/16;

        let newW = fixedRight - nextX;
        let newH = newW / R;
        let calcY = fixedBottom - newH;

        if (calcY < 0) {
          calcY = 0;
          newH = fixedBottom;
          newW = newH * R;
          nextX = fixedRight - newW;
        }

        cropBoxX.value = nextX;
        cropBoxY.value = calcY;
        cropBoxW.value = newW;
        cropBoxH.value = newH;
      }
    });

  const trGesture = Gesture.Pan()
    .onStart(() => {
      startBoxX.value = cropBoxX.value;
      startBoxY.value = cropBoxY.value;
      startBoxW.value = cropBoxW.value;
      startBoxH.value = cropBoxH.value;
    })
    .onUpdate((e) => {
      const fixedLeft = startBoxX.value;
      const fixedBottom = startBoxY.value + startBoxH.value;

      let nextW = startBoxW.value + e.translationX;
      let nextY = startBoxY.value + e.translationY;

      nextW = Math.max(minW, Math.min(viewportWidth - fixedLeft, nextW));
      nextY = Math.max(0, Math.min(fixedBottom - minH, nextY));

      if (cropRatio === 'Full') {
        cropBoxY.value = nextY;
        cropBoxW.value = nextW;
        cropBoxH.value = fixedBottom - nextY;
      } else {
        let R = 1;
        if (cropRatio === '4:3') R = 3/4;
        else if (cropRatio === '16:9') R = 9/16;

        let newH = nextW / R;
        let calcY = fixedBottom - newH;

        if (calcY < 0) {
          calcY = 0;
          newH = fixedBottom;
          nextW = newH * R;
        }

        if (fixedLeft + nextW > viewportWidth) {
          nextW = viewportWidth - fixedLeft;
          newH = nextW / R;
          calcY = fixedBottom - newH;
        }

        cropBoxY.value = calcY;
        cropBoxW.value = nextW;
        cropBoxH.value = newH;
      }
    });

  const blGesture = Gesture.Pan()
    .onStart(() => {
      startBoxX.value = cropBoxX.value;
      startBoxY.value = cropBoxY.value;
      startBoxW.value = cropBoxW.value;
      startBoxH.value = cropBoxH.value;
    })
    .onUpdate((e) => {
      const fixedRight = startBoxX.value + startBoxW.value;
      const fixedTop = startBoxY.value;

      let nextX = startBoxX.value + e.translationX;
      let nextH = startBoxH.value + e.translationY;

      nextX = Math.max(0, Math.min(fixedRight - minW, nextX));
      nextH = Math.max(minH, Math.min(viewportHeight - fixedTop, nextH));

      if (cropRatio === 'Full') {
        cropBoxX.value = nextX;
        cropBoxW.value = fixedRight - nextX;
        cropBoxH.value = nextH;
      } else {
        let R = 1;
        if (cropRatio === '4:3') R = 3/4;
        else if (cropRatio === '16:9') R = 9/16;

        let newW = fixedRight - nextX;
        let newH = newW / R;

        if (fixedTop + newH > viewportHeight) {
          newH = viewportHeight - fixedTop;
          newW = newH * R;
          nextX = fixedRight - newW;
        }

        cropBoxX.value = nextX;
        cropBoxW.value = newW;
        cropBoxH.value = newH;
      }
    });

  const brGesture = Gesture.Pan()
    .onStart(() => {
      startBoxX.value = cropBoxX.value;
      startBoxY.value = cropBoxY.value;
      startBoxW.value = cropBoxW.value;
      startBoxH.value = cropBoxH.value;
    })
    .onUpdate((e) => {
      const fixedLeft = startBoxX.value;
      const fixedTop = startBoxY.value;

      let nextW = startBoxW.value + e.translationX;
      let nextH = startBoxH.value + e.translationY;

      nextW = Math.max(minW, Math.min(viewportWidth - fixedLeft, nextW));
      nextH = Math.max(minH, Math.min(viewportHeight - fixedTop, nextH));

      if (cropRatio === 'Full') {
        cropBoxW.value = nextW;
        cropBoxH.value = nextH;
      } else {
        let R = 1;
        if (cropRatio === '4:3') R = 3/4;
        else if (cropRatio === '16:9') R = 9/16;

        let newH = nextW / R;

        if (fixedTop + newH > viewportHeight) {
          newH = viewportHeight - fixedTop;
          nextW = newH * R;
        }

        if (fixedLeft + nextW > viewportWidth) {
          nextW = viewportWidth - fixedLeft;
          newH = nextW / R;
        }

        cropBoxW.value = nextW;
        cropBoxH.value = newH;
      }
    });

  const borderMoveGesture = Gesture.Pan()
    .onStart(() => {
      startBoxX.value = cropBoxX.value;
      startBoxY.value = cropBoxY.value;
    })
    .onUpdate((e) => {
      let nextX = startBoxX.value + e.translationX;
      let nextY = startBoxY.value + e.translationY;

      nextX = Math.max(0, Math.min(viewportWidth - cropBoxW.value, nextX));
      nextY = Math.max(0, Math.min(viewportHeight - cropBoxH.value, nextY));

      cropBoxX.value = nextX;
      cropBoxY.value = nextY;
    });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      {visible && localImages && localImages.length > 0 ? (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <GestureDetector gesture={dragGesture}>
            <Animated.View style={[{ flex: 1, width: '100%', backgroundColor: themeSurface, justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
            
            {/* Header Controls */}
            <View style={{
              position: 'absolute',
              top: insets.top > 0 ? insets.top + 8 : 20,
              left: 0,
              right: 0,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 14,
              zIndex: 10,
            }}>
              {isCropping ? (
                // Cropping Header
                <>
                  <TouchableOpacity
                    style={{
                      height: 36,
                      paddingHorizontal: 12,
                      borderRadius: 18,
                      backgroundColor: themePanel,
                      borderWidth: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      setIsCropping(false);
                      scale.value = 1;
                      savedScale.value = 1;
                      translationX.value = 0;
                      translationY.value = 0;
                      savedTranslationX.value = 0;
                      savedTranslationY.value = 0;
                      setIsZoomed(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: themeText, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>

                  <Text style={{ fontSize: 16, fontWeight: '700', color: themeText }}>
                    Crop Photo
                  </Text>

                  <TouchableOpacity
                    style={{
                      height: 38,
                      paddingHorizontal: 16,
                      borderRadius: 19,
                      backgroundColor: '#ea580c',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={handleSaveCrop}
                    disabled={savingCropped}
                    activeOpacity={0.7}
                  >
                    {savingCropped ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Save</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                // Normal Preview Header
                <>
                  {/* Close button on the top-left */}
                  <TouchableOpacity
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: themePanel,
                      borderWidth: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <X size={22} color={themeIcon} />
                  </TouchableOpacity>

                  {/* Counter in the middle */}
                  <Text style={{ fontSize: 16, fontWeight: '700', color: themeText }}>
                    {`${currentActiveIndex + 1} of ${localImages.length}`}
                  </Text>

                  {/* Right hand controls */}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {/* Crop action (if callback supplied) */}
                    {onSaveCroppedImage && (
                      <TouchableOpacity
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: themePanel,
                          borderWidth: 0,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setIsCropping(true);
                          scale.value = 1;
                          savedScale.value = 1;
                          translationX.value = 0;
                          translationY.value = 0;
                          savedTranslationX.value = 0;
                          savedTranslationY.value = 0;
                          setIsZoomed(true); // Enable translation boundaries
                          resetCropBox(cropRatio, naturalSize);
                        }}
                        activeOpacity={0.7}
                      >
                        <Crop size={20} color={themeIcon} />
                      </TouchableOpacity>
                    )}

                    {/* Share Button */}
                    <TouchableOpacity
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: themePanel,
                        borderWidth: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleShare();
                      }}
                      activeOpacity={0.7}
                    >
                      <Share2 size={20} color={themeIcon} />
                    </TouchableOpacity>

                    {/* Download Button */}
                    <TouchableOpacity
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: themePanel,
                        borderWidth: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleDownload();
                      }}
                      disabled={downloading}
                      activeOpacity={0.7}
                    >
                      {downloading ? (
                        <ActivityIndicator size="small" color={themeIcon} />
                      ) : (
                        <Download size={20} color={themeIcon} />
                      )}
                    </TouchableOpacity>

                    {/* Zoom mode aspect ratio toggle */}
                    <TouchableOpacity
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: themePanel,
                        borderWidth: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toggleZoomMode();
                      }}
                      activeOpacity={0.7}
                    >
                      {zoomMode === 'contain' ? (
                        <Maximize2 size={20} color={themeIcon} />
                      ) : (
                        <Minimize2 size={20} color={themeIcon} />
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {/* Unified Viewport Container (Guarantees perfect alignment between image and crop box) */}
            <View style={{
              width: screenWidth,
              height: screenHeight * 0.75,
              position: 'relative',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {/* Swipeable ScrollView Gallery */}
              <ScrollView
                ref={galleryRef}
                horizontal
                pagingEnabled
                scrollEnabled={!isZoomed && !isCropping} // Lock swiping when current image is zoomed or cropping
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                  if (idx >= 0 && idx < localImages.length) {
                    setCurrentActiveIndex(idx);
                    setZoomMode('contain'); // Reset zoom when swiping pages
                    setIsZoomed(false);
                    setIsCropping(false);
                  }
                }}
                style={{ width: '100%', height: '100%' }}
              >
                {localImages.map((uri, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: screenWidth,
                      height: '100%',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <ZoomableImage
                      key={idx}
                      uri={uri}
                      zoomMode={currentActiveIndex === idx ? zoomMode : 'contain'}
                      onZoomChange={handleZoomChange}
                      scale={scale}
                      savedScale={savedScale}
                      translationX={translationX}
                      translationY={translationY}
                      savedTranslationX={savedTranslationX}
                      savedTranslationY={savedTranslationY}
                      isActive={currentActiveIndex === idx}
                      isCropping={isCropping}
                      cropBoxX={cropBoxX}
                      cropBoxY={cropBoxY}
                      cropBoxW={cropBoxW}
                      cropBoxH={cropBoxH}
                      naturalSize={currentActiveIndex === idx ? naturalSize : null}
                      onLoadSize={(size) => {
                        if (currentActiveIndex === idx) {
                          setNaturalSize(size);
                        }
                      }}
                    />
                  </View>
                ))}
              </ScrollView>

              {isCropping && (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }} pointerEvents="box-none">
                  {/* Top Mask */}
                  <Animated.View style={[{
                    position: 'absolute',
                    backgroundColor: overlayTint
                  }, animatedTopMaskStyle]} pointerEvents="none" />
                  
                  {/* Bottom Mask */}
                  <Animated.View style={[{
                    position: 'absolute',
                    backgroundColor: overlayTint
                  }, animatedBottomMaskStyle]} pointerEvents="none" />
                  
                  {/* Left Mask */}
                  <Animated.View style={[{
                    position: 'absolute',
                    backgroundColor: overlayTint
                  }, animatedLeftMaskStyle]} pointerEvents="none" />
                  
                  {/* Right Mask */}
                  <Animated.View style={[{
                    position: 'absolute',
                    backgroundColor: overlayTint
                  }, animatedRightMaskStyle]} pointerEvents="none" />
                  
                  {/* Crop Border Box Cutout */}
                  <Animated.View style={[
                    {
                      position: 'absolute',
                      borderWidth: 1,
                      borderColor: cropGuideColor,
                      borderStyle: 'solid',
                    },
                    animatedCropBoxStyle
                  ]} pointerEvents="box-none">
                    {/* Top-Left Resize Target */}
                    <GestureDetector gesture={tlGesture}>
                      <Animated.View style={{
                        position: 'absolute',
                        top: -15,
                        left: -15,
                        width: 30,
                        height: 30,
                        backgroundColor: 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 30,
                      }}>
                        <View style={[styles.cropCorner, { top: 11, left: 11, borderLeftWidth: 3, borderTopWidth: 3 }]} pointerEvents="none" />
                      </Animated.View>
                    </GestureDetector>

                    {/* Top-Right Resize Target */}
                    <GestureDetector gesture={trGesture}>
                      <Animated.View style={{
                        position: 'absolute',
                        top: -15,
                        right: -15,
                        width: 30,
                        height: 30,
                        backgroundColor: 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 30,
                      }}>
                        <View style={[styles.cropCorner, { top: 11, right: 11, borderRightWidth: 3, borderTopWidth: 3 }]} pointerEvents="none" />
                      </Animated.View>
                    </GestureDetector>

                    {/* Bottom-Left Resize Target */}
                    <GestureDetector gesture={blGesture}>
                      <Animated.View style={{
                        position: 'absolute',
                        bottom: -15,
                        left: -15,
                        width: 30,
                        height: 30,
                        backgroundColor: 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 30,
                      }}>
                        <View style={[styles.cropCorner, { bottom: 11, left: 11, borderLeftWidth: 3, borderBottomWidth: 3 }]} pointerEvents="none" />
                      </Animated.View>
                    </GestureDetector>

                    {/* Bottom-Right Resize Target */}
                    <GestureDetector gesture={brGesture}>
                      <Animated.View style={{
                        position: 'absolute',
                        bottom: -15,
                        right: -15,
                        width: 30,
                        height: 30,
                        backgroundColor: 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 30,
                      }}>
                        <View style={[styles.cropCorner, { bottom: 11, right: 11, borderRightWidth: 3, borderBottomWidth: 3 }]} pointerEvents="none" />
                      </Animated.View>
                    </GestureDetector>

                    {/* Border Drag-to-Move Targets */}
                    {/* Top Border */}
                    <GestureDetector gesture={borderMoveGesture}>
                      <Animated.View style={{
                        position: 'absolute',
                        top: -10,
                        left: 15,
                        right: 15,
                        height: 20,
                        backgroundColor: 'transparent',
                        zIndex: 25,
                      }} />
                    </GestureDetector>

                    {/* Bottom Border */}
                    <GestureDetector gesture={borderMoveGesture}>
                      <Animated.View style={{
                        position: 'absolute',
                        bottom: -10,
                        left: 15,
                        right: 15,
                        height: 20,
                        backgroundColor: 'transparent',
                        zIndex: 25,
                      }} />
                    </GestureDetector>

                    {/* Left Border */}
                    <GestureDetector gesture={borderMoveGesture}>
                      <Animated.View style={{
                        position: 'absolute',
                        left: -10,
                        top: 15,
                        bottom: 15,
                        width: 20,
                        backgroundColor: 'transparent',
                        zIndex: 25,
                      }} />
                    </GestureDetector>

                    {/* Right Border */}
                    <GestureDetector gesture={borderMoveGesture}>
                      <Animated.View style={{
                        position: 'absolute',
                        right: -10,
                        top: 15,
                        bottom: 15,
                        width: 20,
                        backgroundColor: 'transparent',
                        zIndex: 25,
                      }} />
                    </GestureDetector>

                    {/* Inside Draggable Area for Moving the Crop Box */}
                    <GestureDetector gesture={borderMoveGesture}>
                      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                        {/* visual grid lines within the crop box cutout */}
                        <View style={{ flex: 1, borderStyle: 'solid', borderWidth: 0.5, borderColor: cropGridColor }} pointerEvents="none">
                          <View style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, height: 0.5, backgroundColor: cropGridColor }} />
                          <View style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, height: 0.5, backgroundColor: cropGridColor }} />
                          <View style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, width: 0.5, backgroundColor: cropGridColor }} />
                          <View style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, width: 0.5, backgroundColor: cropGridColor }} />
                        </View>
                      </View>
                    </GestureDetector>
                  </Animated.View>
                </View>
              )}
            </View>

            {/* Crop Ratio Selector Toolbar */}
            {isCropping && (
              <View style={{
                position: 'absolute',
                bottom: insets.bottom > 0 ? insets.bottom + 10 : 30,
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
                zIndex: 20,
              }}>
                {(['4:3', '16:9', '1:1', 'Full'] as const).map((r) => {
                  const isActive = cropRatio === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setCropRatio(r);
                        scale.value = 1;
                        savedScale.value = 1;
                        translationX.value = 0;
                        translationY.value = 0;
                        savedTranslationX.value = 0;
                        savedTranslationY.value = 0;
                        resetCropBox(r, naturalSize);
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 14,
                        backgroundColor: isActive ? '#ea580c' : (effectiveIsDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'),
                        borderWidth: 0,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        color: isActive ? '#fff' : themeText,
                        fontSize: 12,
                        fontWeight: '700',
                      }}>{r === 'Full' ? 'Free' : r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Save / Select Original Button at the Bottom */}
            {!isCropping && onSaveCroppedImage && singlePhoto && (
              <View style={{
                position: 'absolute',
                bottom: insets.bottom > 0 ? insets.bottom + 20 : 40,
                left: 0,
                right: 0,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
              }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 24,
                    backgroundColor: '#16a34a',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 5,
                    elevation: 6,
                    gap: 8,
                  }}
                  onPress={handleConfirmOriginal}
                  disabled={savingCropped}
                  activeOpacity={0.8}
                >
                  {savingCropped ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Check size={18} color="#fff" strokeWidth={3} />
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Set Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            </Animated.View>
          </GestureDetector>

          {savingCropped && (
            <View style={{
              ...StyleSheet.absoluteFill,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
            }}>
              <View style={[
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 16,
                  paddingHorizontal: 28,
                  paddingVertical: 24,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  elevation: 10,
                  maxWidth: screenWidth - 60,
                },
                Platform.OS === 'web' && {
                  // @ts-ignore
                  backdropFilter: 'blur(10px)',
                }
              ]}>
                <ActivityIndicator size="large" color="#ffffff" style={{ marginBottom: 16 }} />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                  Processing Photo
                </Text>
                <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                  Uploading and saving, please wait...
                </Text>
              </View>
            </View>
          )}
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  cropCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#ffffff',
  },
  cropSide: {
    position: 'absolute',
    borderColor: '#ffffff',
  },
});
