import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
  Image,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { X, Check, Zap, RotateCw, Grid, Trash2, Camera, Plus, Minus, Image as ImageIcon, ChevronLeft, ChevronRight, FlipHorizontal } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '../../constants/colors';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImagePreviewModal from './ImagePreviewModal';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
  FadeInDown,
  FadeOut,
} from 'react-native-reanimated';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';


const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Dynamic import of expo-camera to prevent bundler failure if package isn't linked
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  const cameraPkg = require('expo-camera');
  CameraView = cameraPkg.CameraView;
  useCameraPermissions = cameraPkg.useCameraPermissions;
} catch (e) {
  // Gracefully fallback
}

// Dynamic import of expo-image-picker
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  // Gracefully fallback
}

// Canvas-based horizontal flip for web (expo-image-manipulator flip doesn't work on web)
async function flipImageHorizontallyOnWeb(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new (window as any).Image() as HTMLImageElement;
    if (uri.startsWith('http') && !uri.startsWith('http://localhost') && !uri.startsWith('http://127.0.0.1')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(uri); return; }
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(uri); // fallback to original on error
    img.src = uri;
  });
}

async function cropAndFlipImageOnWeb(
  uri: string,
  crop: { originX: number; originY: number; width: number; height: number } | null,
  flipHorizontal: boolean
): Promise<string> {
  return new Promise((resolve) => {
    const img = new (window as any).Image() as HTMLImageElement;
    if (uri.startsWith('http') && !uri.startsWith('http://localhost') && !uri.startsWith('http://127.0.0.1')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const cropW = crop ? crop.width : img.naturalWidth;
      const cropH = crop ? crop.height : img.naturalHeight;
      const originX = crop ? crop.originX : 0;
      const originY = crop ? crop.originY : 0;

      canvas.width = cropW;
      canvas.height = cropH;

      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(uri); return; }

      if (flipHorizontal) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        img,
        originX,
        originY,
        cropW,
        cropH,
        0,
        0,
        cropW,
        cropH
      );

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });
}

interface CustomCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotosCaptured: (photos: string[]) => void;
  singlePhoto?: boolean;
}

function getViewfinderDimensions(
  selectedRatio: '4:3' | '16:9' | '1:1' | 'Full',
  containerW: number,
  containerH: number
) {
  let W_vf = containerW;
  let H_vf = containerH;

  if (selectedRatio === '1:1') {
    const size = Math.min(containerW, containerH);
    W_vf = size;
    H_vf = size;
  } else if (selectedRatio === '4:3') {
    if (containerW * (4 / 3) <= containerH) {
      W_vf = containerW;
      H_vf = containerW * (4 / 3);
    } else {
      H_vf = containerH;
      W_vf = containerH * (3 / 4);
    }
  } else if (selectedRatio === '16:9') {
    if (containerW * (16 / 9) <= containerH) {
      W_vf = containerW;
      H_vf = containerW * (16 / 9);
    } else {
      H_vf = containerH;
      W_vf = containerH * (9 / 16);
    }
  } else if (selectedRatio === 'Full') {
    W_vf = containerW;
    H_vf = containerH;
  }

  return { width: W_vf, height: H_vf };
}

export default function CustomCameraModal({
  visible,
  onClose,
  onPhotosCaptured,
  singlePhoto = false
}: CustomCameraModalProps) {
  const insets = useSafeAreaInsets();
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(0); // 0 to 1
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);
  const [selectedRatio, setSelectedRatio] = useState<'4:3' | '16:9' | '1:1' | 'Full'>('Full');
  const [containerDimensions, setContainerDimensions] = useState({
    width: screenWidth,
    height: screenHeight - 180
  });

  const cameraRef = useRef<any>(null);

  const getCameraPreviewStyle = (): any => {
    const { width, height } = getViewfinderDimensions(
      selectedRatio,
      containerDimensions.width,
      containerDimensions.height
    );
    return { width, height };
  };

  // Reanimated values for camera flip transition
  const cameraScale = useSharedValue(1);
  const cameraRotateY = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  const cameraAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${cameraRotateY.value}deg` },
        { scale: cameraScale.value },
      ],
    };
  });

  const flashAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: flashOpacity.value,
    };
  });

  // Hook for permissions if expo-camera is resolved
  let cameraPermission: any = null;
  let requestCameraPermission: any = null;

  if (useCameraPermissions) {
    try {
      const [perm, req] = useCameraPermissions();
      cameraPermission = perm;
      requestCameraPermission = req;
    } catch (e) {
      // Ignore hook exceptions
    }
  }

  const cameraPermissionGranted = cameraPermission?.granted;

  // Request permission on mount if visible and supported
  useEffect(() => {
    if (visible && requestCameraPermission && !cameraPermissionGranted) {
      requestCameraPermission();
    }
  }, [visible, cameraPermissionGranted, requestCameraPermission]);

  // Reset captured photos when modal opens
  useEffect(() => {
    if (visible) {
      setCapturedPhotos([]);
      setZoom(0);
      setLoading(false);
      setCameraReady(false);
      cameraScale.value = 1;
      cameraRotateY.value = 0;
      flashOpacity.value = 0;
    }
  }, [visible]);

  const baseZoom = useSharedValue(0);
  const zoomShared = useSharedValue(0);

  // Synchronize state zoom with gesture shared value
  useEffect(() => {
    zoomShared.value = zoom;
  }, [zoom]);

  const focusScale = useSharedValue(1.5);
  const focusOpacity = useSharedValue(0);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  const focusAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: focusScale.value }],
      opacity: focusOpacity.value,
    };
  });

  const triggerFocusAnimation = (x: number, y: number) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        console.warn('Failed to trigger haptic feedback:', e);
      }
    }
    setFocusPoint({ x, y });
    focusScale.value = 1.5;
    focusOpacity.value = 1;

    focusScale.value = withTiming(1.0, { duration: 200, easing: Easing.out(Easing.ease) });
    focusOpacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }, (finished) => {
        if (finished) {
          runOnJS(setFocusPoint)(null);
        }
      })
    );
  };

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      baseZoom.value = zoomShared.value;
    })
    .onUpdate((event) => {
      const nextZoom = Math.max(0, Math.min(1, baseZoom.value + (event.scale - 1) * 0.5));
      runOnJS(setZoom)(nextZoom);
    });

  const tapGesture = Gesture.Tap()
    .onStart((event) => {
      runOnJS(triggerFocusAnimation)(event.x, event.y);
    });

  const combinedGesture = Gesture.Exclusive(pinchGesture, tapGesture);

  if (!visible) return null;

  const triggerShutterFlash = () => {
    flashOpacity.value = 1;
    flashOpacity.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
  };

  const handleTakePicture = async () => {
    if (loading) return;
    
    // If expo-camera is available and ready, use it
    if (CameraView && cameraRef.current && cameraReady) {
      try {
        setLoading(true);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        triggerShutterFlash();

        const options = {
          quality: 0.8,
          skipProcessing: false,
        };
        const photo = await cameraRef.current.takePictureAsync(options);
        if (photo && photo.uri) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          let finalUri = photo.uri;

          try {
            // Calculate crop regions to match viewfinder aspect ratio exactly
            const W_img = photo.width;
            const H_img = photo.height;

            let cropOptions: any = null;

            if (W_img && H_img && W_img > 0 && H_img > 0) {
              const { width: W_vf, height: H_vf } = getViewfinderDimensions(
                selectedRatio,
                containerDimensions.width,
                containerDimensions.height
              );

              const s = Math.max(W_vf / W_img, H_vf / H_img);
              const W_crop = W_vf / s;
              const H_crop = H_vf / s;

              const originX = Math.max(0, Math.floor((W_img - W_crop) / 2));
              const originY = Math.max(0, Math.floor((H_img - H_crop) / 2));
              const width = Math.min(Math.floor(W_crop), W_img - originX);
              const height = Math.min(Math.floor(H_crop), H_img - originY);

              // Check if the crop is a substantial change (not just fractional pixel rounding)
              if (width < W_img - 2 || height < H_img - 2) {
                cropOptions = { originX, originY, width, height };
              }
            }

            if (Platform.OS === 'web') {
              finalUri = await cropAndFlipImageOnWeb(photo.uri, cropOptions, facing === 'front');
            } else {
              try {
                const ImageManipulator = require('expo-image-manipulator');
                const ImageManipulatorLib = ImageManipulator ? (ImageManipulator.default || ImageManipulator) : null;
                if (ImageManipulatorLib && ImageManipulatorLib.manipulateAsync) {
                  const actions: any[] = [];
                  if (cropOptions) {
                    actions.push({ crop: cropOptions });
                  }
                  if (facing === 'front') {
                    const flipType = ImageManipulatorLib.FlipType
                      ? ImageManipulatorLib.FlipType.Horizontal
                      : ('horizontal' as any);
                    actions.push({ flip: flipType });
                  }

                  if (actions.length > 0) {
                    const manipulated = await ImageManipulatorLib.manipulateAsync(
                      photo.uri,
                      actions,
                      { compress: 0.9, format: ImageManipulatorLib.SaveFormat.JPEG }
                    );
                    finalUri = manipulated.uri;
                  }
                }
              } catch (nativeErr) {
                console.warn('Native image manipulator failed or not available:', nativeErr);
              }
            }
          } catch (postProcErr) {
            console.error('Error post-processing captured photo:', postProcErr);
          }

          if (singlePhoto) {
            setCapturedPhotos([finalUri]);
            setPreviewInitialIndex(0);
            setPreviewVisible(true);
          } else {
            setCapturedPhotos(prev => [...prev, finalUri]);
          }
        }
      } catch (err: any) {
        Alert.alert('Capture Error', 'Could not take picture: ' + err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Fallback: Launch OS Camera via expo-image-picker
      handleFallbackCapture();
    }
  };

  const handleFallbackCapture = async () => {
    if (!ImagePicker || !ImagePicker.requestCameraPermissionsAsync) {
      Alert.alert('Feature Unavailable', 'Camera module is not available in this build.');
      return;
    }

    try {
      setLoading(true);
      const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPerm.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (singlePhoto) {
          setCapturedPhotos([selectedUri]);
          setPreviewInitialIndex(0);
          setPreviewVisible(true);
        } else {
          setCapturedPhotos(prev => [...prev, selectedUri]);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to take photo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPhoto = (index: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPreviewInitialIndex(index);
    setPreviewVisible(true);
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCapturedPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleMoveLeft = (index: number) => {
    if (index === 0) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCapturedPhotos(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return copy;
    });
  };

  const handleMoveRight = (index: number) => {
    if (index === capturedPhotos.length - 1) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCapturedPhotos(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return copy;
    });
  };

  const handleDone = () => {
    if (capturedPhotos.length === 0) {
      Alert.alert('No Photos', 'Please capture at least one photo or cancel.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onPhotosCaptured(capturedPhotos);
    onClose();
  };

  const handlePickFromGallery = async () => {
    if (!ImagePicker) {
      Alert.alert('Error', 'Image picker is not available on this device');
      return;
    }
    try {
      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: !singlePhoto,
        allowsEditing: false,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (singlePhoto) {
          setCapturedPhotos([result.assets[0].uri]);
          setPreviewInitialIndex(0);
          setPreviewVisible(true);
        } else {
          const selectedUris = result.assets.map((asset: any) => asset.uri);
          setCapturedPhotos(prev => [...prev, ...selectedUris]);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to pick image: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFlash = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFlash(prev => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  };

  const toggleFacing = () => {
    const nextFacing = facing === 'back' ? 'front' : 'back';
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    if (Platform.OS === 'web') {
      setFacing(nextFacing);
      return;
    }

    // 3D camera card flip: rotate out to 90deg, switch camera midway, rotate back to 0deg
    cameraScale.value = withTiming(0.9, { duration: 150 });
    cameraRotateY.value = withTiming(90, { duration: 200, easing: Easing.in(Easing.ease) }, (finished) => {
      if (finished) {
        runOnJS(setFacing)(nextFacing);
        cameraRotateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) });
        cameraScale.value = withTiming(1, { duration: 150 });
      }
    });
  };

  const adjustZoom = (amount: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setZoom(prev => Math.max(0, Math.min(1, parseFloat((prev + amount).toFixed(1)))));
  };

  const hasNativeCameraSupport = CameraView && cameraPermission && cameraPermission.granted;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          {hasNativeCameraSupport ? (
            // Custom Camera View using expo-camera
            <View 
              style={styles.cameraContainer}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  setContainerDimensions({ width, height });
                }
              }}
            >
              <GestureDetector gesture={combinedGesture}>
                <Animated.View 
                  style={[styles.cameraPreview, getCameraPreviewStyle(), cameraAnimatedStyle]}
                >
                  <CameraView
                    ref={cameraRef}
                    style={[
                      StyleSheet.absoluteFill,
                      { objectFit: 'cover' } as any,
                      Platform.OS === 'web' && facing === 'front' ? { transform: [{ scaleX: -1 }] } : null
                    ]}
                    facing={facing}
                    flash={flash}
                    mirror={facing === 'front'}
                    enableTorch={flash === 'on' && facing === 'back'}
                    zoom={zoom}
                    onCameraReady={() => setCameraReady(true)}
                  />
                  
                  {focusPoint && (
                    <Animated.View
                      style={[
                        styles.focusRing,
                        {
                          top: focusPoint.y - 30,
                          left: focusPoint.x - 30,
                        },
                        focusAnimatedStyle
                      ]}
                    />
                  )}
                  {/* Grid Overlay Guide */}
                  {showGrid && (
                    <View style={styles.gridContainer} pointerEvents="none">
                      <View style={styles.gridRow}>
                        <View style={[styles.gridCell, styles.borderRight, styles.borderBottom]} />
                        <View style={[styles.gridCell, styles.borderRight, styles.borderBottom]} />
                        <View style={[styles.gridCell, styles.borderBottom]} />
                      </View>
                      <View style={styles.gridRow}>
                        <View style={[styles.gridCell, styles.borderRight, styles.borderBottom]} />
                        <View style={[styles.gridCell, styles.borderRight, styles.borderBottom]} />
                        <View style={[styles.gridCell, styles.borderBottom]} />
                      </View>
                      <View style={styles.gridRow}>
                        <View style={[styles.gridCell, styles.borderRight]} />
                        <View style={[styles.gridCell, styles.borderRight]} />
                        <View style={styles.gridCell} />
                      </View>
                    </View>
                  )}
                </Animated.View>
              </GestureDetector>

              {/* Custom Camera Controls Top Panel */}
              <SafeAreaOverlay style={styles.topControls}>
                <TouchableOpacity 
                  style={styles.iconButton} 
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                  }}
                >
                  <X size={22} color="#fff" />
                </TouchableOpacity>

                <View style={styles.topRightControls}>
                  {/* Flash Toggle */}
                  <TouchableOpacity style={[styles.iconButton, flash !== 'off' && styles.activeControl]} onPress={toggleFlash}>
                    <Zap size={20} color={flash === 'off' ? '#fff' : '#fbbf24'} />
                    {flash !== 'off' && (
                      <Text style={styles.controlBadge}>{flash.toUpperCase()}</Text>
                    )}
                  </TouchableOpacity>

                  {/* Grid Toggle */}
                  <TouchableOpacity style={[styles.iconButton, showGrid && styles.activeControl]} onPress={() => setShowGrid(!showGrid)}>
                    <Grid size={20} color={showGrid ? '#60a5fa' : '#fff'} />
                  </TouchableOpacity>

                  {/* Switch Camera */}
                  <TouchableOpacity style={styles.iconButton} onPress={toggleFacing}>
                    <RotateCw size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </SafeAreaOverlay>

              {/* Zoom Controls */}
              <View style={styles.zoomContainer}>
                <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(-0.1)}>
                  <Minus size={16} color="#fff" />
                </TouchableOpacity>
                <View style={styles.zoomValueContainer}>
                  <Text style={styles.zoomText}>{`${(1 + zoom * 4).toFixed(1)}x`}</Text>
                </View>
                <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(0.1)}>
                  <Plus size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
      ) : (
          // Graceful fallback when expo-camera is missing or permissions denied
          <View style={styles.fallbackContainer}>
            <View style={styles.fallbackContent}>
              <View style={styles.fallbackIconWrapper}>
                <Camera size={48} color={Colors.primary[500]} />
              </View>
              <Text style={styles.fallbackTitle}>{singlePhoto ? 'Select Profile Photo' : 'Multi-Photo Camera'}</Text>
              <Text style={styles.fallbackDescription}>
                {singlePhoto 
                  ? 'Take a photo or choose an image from your device gallery.'
                  : 'Click the button below to snap multiple photos sequentially using the native device camera. Your pictures will be added to the strip below.'
                }
              </Text>
              <TouchableOpacity
                style={styles.fallbackCaptureBtn}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleFallbackCapture();
                }}
                activeOpacity={0.8}
              >
                <Camera size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.fallbackCaptureBtnText}>Take Photo</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.fallbackCloseBtn} 
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
            >
              <X size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Captured Photos Strip and Capture Action Buttons */}
        <View
          style={[
            styles.bottomSheet,
            { paddingBottom: Math.max(16, insets.bottom + 12) }
          ]}
        >
          {capturedPhotos.length > 0 && !singlePhoto && (
            <>
              <View style={styles.stripHeader}>
                <Text style={styles.stripTitle}>Captured ({capturedPhotos.length})</Text>
                <Text style={styles.stripSubtitle}>Tap to edit</Text>
              </View>

              {/* Captured Thumbnails List */}
              <FlatList
                data={capturedPhotos}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item}
                style={styles.thumbnailList}
                contentContainerStyle={styles.thumbnailListContainer}
                renderItem={({ item, index }) => (
                  <Animated.View
                    entering={FadeInDown.springify().damping(15)}
                    exiting={FadeOut.duration(200)}
                    style={styles.thumbnailWrapper}
                  >
                    <TouchableOpacity
                      onPress={() => handlePreviewPhoto(index)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: item }} style={styles.thumbnail} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteThumbnailBtn}
                      onPress={() => handleRemovePhoto(index)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={12} color="#fff" />
                    </TouchableOpacity>
                    {index > 0 && (
                      <TouchableOpacity
                        style={styles.moveLeftBtn}
                        onPress={() => handleMoveLeft(index)}
                        activeOpacity={0.7}
                      >
                        <ChevronLeft size={10} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {index < capturedPhotos.length - 1 && (
                      <TouchableOpacity
                        style={styles.moveRightBtn}
                        onPress={() => handleMoveRight(index)}
                        activeOpacity={0.7}
                      >
                        <ChevronRight size={10} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                )}
              />
            </>
          )}

          {/* Aspect Ratio Selector */}
          <View style={styles.ratioSelectorContainer}>
            {(['4:3', '16:9', '1:1', 'Full'] as const).map((r) => {
              const isActive = selectedRatio === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedRatio(r);
                  }}
                  style={[styles.ratioOption, isActive && styles.ratioOptionActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.ratioText, isActive && styles.ratioTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Capture Trigger Panel */}
          <View style={styles.triggerPanel}>
            {/* Left Column */}
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <TouchableOpacity
                style={styles.galleryButton}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handlePickFromGallery();
                }}
                activeOpacity={0.8}
              >
                <ImageIcon size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Center Column */}
            <View style={{ alignItems: 'center' }}>
              {hasNativeCameraSupport ? (
                // Capture Shutter Button for custom camera
                <TouchableOpacity
                  style={styles.shutterOuter}
                  onPress={handleTakePicture}
                  activeOpacity={0.85}
                >
                  <View style={styles.shutterInner}>
                    {loading && <ActivityIndicator size="small" color={Colors.primary[600]} />}
                  </View>
                </TouchableOpacity>
              ) : (
                // Capture Shutter Button for native fallback camera
                <TouchableOpacity
                  style={styles.shutterOuter}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleFallbackCapture();
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.shutterInner, { backgroundColor: '#ea580c' }]}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Camera size={24} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Right Column */}
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              {!singlePhoto ? (
                <TouchableOpacity
                  style={[
                    styles.doneButton,
                    capturedPhotos.length === 0 && styles.doneButtonDisabled
                  ]}
                  onPress={handleDone}
                  disabled={capturedPhotos.length === 0}
                  activeOpacity={0.8}
                >
                  <Check size={20} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 50 }} />
              )}
            </View>
          </View>
        </View>

        {/* Shutter Screen Flash Overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#ffffff', zIndex: 9999 },
            flashAnimatedStyle
          ]}
          pointerEvents="none"
        />

        {/* Captured Photos Preview & Crop Modal */}
        <ImagePreviewModal
          visible={previewVisible}
          images={capturedPhotos}
          initialIndex={previewInitialIndex}
          singlePhoto={singlePhoto}
          onClose={() => {
            setPreviewVisible(false);
            if (singlePhoto) {
              setCapturedPhotos([]);
            }
          }}
          onSaveCroppedImage={async (croppedUri, index) => {
            setCapturedPhotos(prev => {
              const next = [...prev];
              next[index] = croppedUri;
              return next;
            });
            if (singlePhoto) {
              onPhotosCaptured([croppedUri]);
              setPreviewVisible(false);
              onClose();
            }
            return croppedUri;
          }}
        />
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// Helper component to handle top status bar safe area padding
function SafeAreaOverlay({ children, style }: { children: React.ReactNode; style: any }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[style, { paddingTop: insets.top > 0 ? insets.top + 8 : 16 }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  topRightControls: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  activeControl: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  controlBadge: {
    position: 'absolute',
    bottom: -4,
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  gridContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
  },
  borderRight: {
    borderRightWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  borderBottom: {
    borderBottomWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  zoomContainer: {
    position: 'absolute',
    right: 20,
    top: '40%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  zoomButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomValueContainer: {
    paddingVertical: 4,
  },
  zoomText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  bottomSheet: {
    width: '100%',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#0a0a0a',
  },
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stripTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  stripSubtitle: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
  },
  thumbnailList: {
    maxHeight: 64,
    marginBottom: 8,
  },
  thumbnailListContainer: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  deleteThumbnailBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error[500],
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  emptyStrip: {
    width: screenWidth - 40,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  emptyStripText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  triggerPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  shutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    opacity: 0.5,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 30,
  },
  fallbackContent: {
    alignItems: 'center',
    textAlign: 'center',
  },
  fallbackIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  fallbackTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
  },
  fallbackDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  fallbackCaptureBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  fallbackCaptureBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  fallbackCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveLeftBtn: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  moveRightBtn: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  focusGuideContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusGuideBox: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  focusCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#ffffff',
    opacity: 0.8,
  },
  focusSide: {
    position: 'absolute',
    borderColor: '#ffffff',
    opacity: 0.8,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPreview: {
    position: 'relative',
    overflow: 'hidden',
  },
  ratioSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  ratioOption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ratioOptionActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[500],
  },
  ratioText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '800',
  },
  ratioTextActive: {
    color: '#fff',
  },
  focusRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderWidth: 1.5,
    borderColor: '#fbbf24',
    borderRadius: 8,
    zIndex: 99,
  },
});
