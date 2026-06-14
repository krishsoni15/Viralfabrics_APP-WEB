'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  isDarkMode: boolean;
}

export default function CameraModal({ isOpen, onClose, onCapture, isDarkMode }: CameraModalProps) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [cameraError, setCameraError] = useState<string | React.ReactNode | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const autoRetryIntervalRef = useRef<any>(null);

  // Get available cameras
  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(cameras);
      return cameras;
    } catch (error) {
      console.error('Error enumerating cameras:', error);
      return [];
    }
  };

  // Start camera - use ref to prevent infinite loops
  const startCameraRef = useRef<(() => Promise<void>) | null>(null);
  
  const startCamera = useCallback(async () => {
    try {
      // Clear any previous errors first
      setCameraError(null);
      setCameraLoading(true);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera not supported in this browser');
        setCameraLoading(false);
        return;
      }
      
      let stream: MediaStream | null = null;
      
      // First, try to get a basic camera stream
      // Don't check permission status - just try to get the stream
      // If permission is granted, this will work. If not, it will throw an error.
      try {
        console.log('Requesting camera access...');
        
        // Try with less strict constraints first - just basic video
        let constraints: MediaStreamConstraints = { video: true };
        
        // Try to get camera stream with basic constraints first
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('Camera stream obtained successfully with basic constraints');
        } catch (basicError) {
          // If basic fails, try with facingMode
          console.log('Basic constraints failed, trying with facingMode...');
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: {
                facingMode: { ideal: 'environment' } // Prefer back camera, but not required
              }
            });
            console.log('Camera stream obtained with facingMode');
          } catch (facingError) {
            // Last resort: try user-facing camera
            console.log('Environment camera failed, trying user-facing...');
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: {
                facingMode: { ideal: 'user' }
              }
            });
            console.log('Camera stream obtained with user-facing');
          }
        }
        
        // Success! Clear any errors and set the stream
        setCameraError(null);
        
        // Store video track for flash control FIRST
        if (stream.getVideoTracks().length > 0) {
          videoTrackRef.current = stream.getVideoTracks()[0];
          // Check if camera supports flash/torch
          const capabilities = videoTrackRef.current.getCapabilities() as any;
          if (capabilities.torch || capabilities.fillLightMode) {
            setHasFlash(true);
          }
        }
        
        // CRITICAL: Set video srcObject IMMEDIATELY before setting state
        // This ensures the video element has the stream as soon as possible
        if (videoRef.current) {
          const video = videoRef.current;
          
          // Stop any existing stream first
          if (video.srcObject) {
            const oldStream = video.srcObject as MediaStream;
            oldStream.getTracks().forEach(track => track.stop());
          }
          
          // Set stream IMMEDIATELY
          video.srcObject = stream;
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true;
          video.setAttribute('autoplay', 'true');
          video.setAttribute('playsinline', 'true');
          video.setAttribute('muted', 'true');
          video.style.display = 'block';
          video.style.visibility = 'visible';
          video.style.opacity = '1';
          video.style.backgroundColor = 'transparent';
          
          console.log('✅ Stream assigned to video element immediately');
          
          // CRITICAL: Wait for video to be ready, then play
          const attemptPlay = () => {
            if (video.readyState >= 2) {
              video.play()
                .then(() => {
                  console.log('✅ Video playing immediately after stream assignment!');
                  video.style.opacity = '1';
                  setCameraLoading(false);
                })
                .catch(err => {
                  console.log('Initial play attempt failed, will retry:', err.name);
                  // Retry after metadata loads
                  setTimeout(() => video.play().catch(() => {}), 200);
                });
            } else {
              // Wait for video to be ready
              video.addEventListener('loadedmetadata', () => {
                video.play().catch(() => {});
              }, { once: true });
            }
          };
          
          // Try immediately
          attemptPlay();
          
          // Also try after a short delay
          setTimeout(attemptPlay, 100);
        }
        
        // Set state to trigger re-render and useEffect
        setCameraStream(stream);
        setCameraLoading(false);
        
        // Now try to enumerate cameras for switching (optional)
        setTimeout(async () => {
          try {
            const cameras = await getAvailableCameras();
            console.log('Found cameras:', cameras.length);
            if (cameras.length > 0) {
              setAvailableCameras(cameras);
            }
          } catch (enumError) {
            console.log('Could not enumerate cameras, but stream is working');
          }
        }, 500);
        
        return; // Success - exit early
        
      } catch (permError: any) {
        console.error('Camera access error:', permError.name, permError.message);
        
        // Only show error if it's actually a permission error
        if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
          // Simple retry function - directly attempts camera access
          const retryCamera = async () => {
            // Reset all camera states
            setCameraError(null);
            setCameraLoading(true);
            setAvailableCameras([]);
            setCurrentCameraIndex(0);
            setHasFlash(false);
            setFlashEnabled(false);
            
            // Stop any existing stream
            if (cameraStream) {
              cameraStream.getTracks().forEach(track => track.stop());
              setCameraStream(null);
            }
            videoTrackRef.current = null;
            
            // Wait a bit then directly try to access camera
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Directly try to access camera - don't just check permissions
            try {
              // Try with basic constraints first
              let newStream: MediaStream;
              try {
                newStream = await navigator.mediaDevices.getUserMedia({ video: true });
              } catch (basicError) {
                // Try with facingMode
                try {
                  newStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: { ideal: 'environment' } }
                  });
                } catch (facingError) {
                  // Last resort: user-facing
                  newStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: { ideal: 'user' } }
                  });
                }
              }
              
              // Success! Set the stream
              setCameraError(null);
              setCameraStream(newStream);
              setCameraLoading(false);
              
              // Set video source and play with improved handling
              if (videoRef.current) {
                const video = videoRef.current;
                
                // Stop any existing stream
                if (video.srcObject) {
                  const oldStream = video.srcObject as MediaStream;
                  oldStream.getTracks().forEach(track => track.stop());
                }
                
                video.srcObject = newStream;
                video.autoplay = true;
                video.playsInline = true;
                video.muted = true;
                video.style.display = 'block';
                video.style.visibility = 'visible';
                video.style.opacity = '1';
                
                const playVideo = async () => {
                  if (!video || !video.srcObject) return;
                  
                  try {
                    if (video.readyState >= 2) {
                      await video.play();
                      video.style.opacity = '1';
                      video.style.display = 'block';
                    } else {
                      const waitForReady = () => {
                        if (video && video.srcObject) {
                          if (video.readyState >= 2) {
                            video.play().catch(e => console.error('Play error:', e));
                            video.style.opacity = '1';
                          } else {
                            setTimeout(waitForReady, 50);
                          }
                        }
                      };
                      waitForReady();
                    }
                  } catch (e) {
                    console.error('Play error:', e);
                    setTimeout(() => {
                      if (video && video.srcObject) {
                        video.play().catch(err => console.error('Retry play error:', err));
                      }
                    }, 200);
                  }
                };
                
                video.onloadedmetadata = playVideo;
                video.onloadeddata = playVideo;
                video.oncanplay = playVideo;
                video.oncanplaythrough = playVideo;
                video.onplaying = () => {
                  video.style.opacity = '1';
                  video.style.display = 'block';
                };
                
                playVideo();
                setTimeout(playVideo, 100);
                setTimeout(playVideo, 300);
                setTimeout(playVideo, 500);
              }
              
              // Store video track
              if (newStream.getVideoTracks().length > 0) {
                videoTrackRef.current = newStream.getVideoTracks()[0];
                const capabilities = videoTrackRef.current.getCapabilities() as any;
                if (capabilities.torch || capabilities.fillLightMode) {
                  setHasFlash(true);
                }
              }
              
              // Enumerate cameras
              setTimeout(async () => {
                try {
                  const cameras = await getAvailableCameras();
                  if (cameras.length > 0) {
                    setAvailableCameras(cameras);
                  }
                } catch (enumError) {
                  // Ignore enumeration errors
                }
              }, 500);
              
            } catch (error: any) {
              // If still fails, show error again
              setCameraLoading(false);
              if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setCameraError(<SimpleErrorMessage />);
              } else {
                setCameraError('Camera access failed. Please try again.');
              }
            }
          };
          
          // Simple error message without complex instructions
          const SimpleErrorMessage = () => (
            <div className="text-center w-full">
              <p className="text-sm font-semibold mb-4 text-gray-700 dark:text-gray-300">
                📷 Camera access needed
              </p>
              <p className="text-xs mb-4 text-gray-600 dark:text-gray-400">
                Please allow camera access in your browser settings, then click "Try Again"
              </p>
              <button
                type="button"
                onClick={retryCamera}
                className="px-6 py-2 rounded-lg text-sm font-medium transition-all bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          );
          
          setCameraError(<SimpleErrorMessage />);
          setCameraLoading(false);
          
          // Clear any existing auto-retry interval
          if (autoRetryIntervalRef.current) {
            clearInterval(autoRetryIntervalRef.current);
          }
          
          // Automatically retry every 5 seconds - directly try camera access
          // Reduced frequency to avoid permission policy violations
          autoRetryIntervalRef.current = setInterval(async () => {
            try {
              // Directly try to access camera instead of just checking permissions
              const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
              
              // If we got here, permission is granted! Stop the stream and retry properly
              testStream.getTracks().forEach(track => track.stop());
              
              if (autoRetryIntervalRef.current) {
                clearInterval(autoRetryIntervalRef.current);
                autoRetryIntervalRef.current = null;
              }
              
              // Now retry with full setup
              retryCamera();
            } catch (e: any) {
              // Still no permission or other error - keep trying
              // Don't log errors to avoid console spam
              if (e.name !== 'NotAllowedError' && e.name !== 'PermissionDeniedError' && e.name !== 'NotReadableError') {
                // Some other error - stop auto-retry
                if (autoRetryIntervalRef.current) {
                  clearInterval(autoRetryIntervalRef.current);
                  autoRetryIntervalRef.current = null;
                }
              }
            }
          }, 5000); // Increased from 2s to 5s to reduce violations
          
          return;
        }
        
        // For other errors, re-throw to be handled by outer catch
        throw permError;
      }
    } catch (error: any) {
      setCameraLoading(false);
      console.error('Camera error:', error);
      
      // Handle other types of errors (permission errors are already handled above)
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (error.name === 'NotSupportedError' || error.name === 'ConstraintNotSatisfiedError') {
        setCameraError('Camera not supported or constraints not satisfied. Please use a modern browser.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setCameraError('Camera is already in use by another application. Please close other applications using the camera.');
      } else if (error.name === 'OverconstrainedError') {
        setCameraError('Camera constraints could not be satisfied. Trying with basic settings...');
        // Retry with minimal constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraStream(stream);
          setCameraLoading(false);
          setCameraError(null); // Clear error on success
          
          if (videoRef.current) {
            const video = videoRef.current;
            
            // Stop any existing stream
            if (video.srcObject) {
              const oldStream = video.srcObject as MediaStream;
              oldStream.getTracks().forEach(track => track.stop());
            }
            
            video.srcObject = stream;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.style.display = 'block';
            video.style.visibility = 'visible';
            video.style.opacity = '1';
            
            const playVideo = async () => {
              if (!video || !video.srcObject) return;
              
              try {
                if (video.readyState >= 2) {
                  await video.play();
                  video.style.opacity = '1';
                  video.style.display = 'block';
                } else {
                  const waitForReady = () => {
                    if (video && video.srcObject) {
                      if (video.readyState >= 2) {
                        video.play().catch(e => console.error('Play error:', e));
                        video.style.opacity = '1';
                      } else {
                        setTimeout(waitForReady, 50);
                      }
                    }
                  };
                  waitForReady();
                }
              } catch (e) {
                console.error('Play error:', e);
                setTimeout(() => {
                  if (video && video.srcObject) {
                    video.play().catch(err => console.error('Retry play error:', err));
                  }
                }, 200);
              }
            };
            
            video.onloadedmetadata = playVideo;
            video.onloadeddata = playVideo;
            video.oncanplay = playVideo;
            video.oncanplaythrough = playVideo;
            video.onplaying = () => {
              video.style.opacity = '1';
              video.style.display = 'block';
            };
            
            playVideo();
            setTimeout(playVideo, 100);
            setTimeout(playVideo, 300);
            setTimeout(playVideo, 500);
          }
        } catch (retryError: any) {
          setCameraError(`Camera error: ${retryError.message || 'Unknown error'}`);
        }
      } else {
        setCameraError(`Camera error: ${error.message || 'Unknown error'}. Please check your browser permissions.`);
      }
    }
  }, []);
  
  // Store startCamera in ref
  useEffect(() => {
    startCameraRef.current = startCamera;
  }, [startCamera]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    videoTrackRef.current = null;
    setCameraError(null);
    setCameraLoading(false);
    setFlashEnabled(false);
    setHasFlash(false);
  }, [cameraStream]);

  // Switch camera - COMPLETE REWRITE for 100% reliability
  const switchCamera = async () => {
    if (availableCameras.length <= 1) return;
    
    setCameraLoading(true);
    setCameraError(null);
    
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];
    
    console.log('🔄 Switching to camera:', nextCamera.label, 'deviceId:', nextCamera.deviceId);
    
    // COMPLETE cleanup of old stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.label, track.readyState);
      });
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const oldStream = videoRef.current.srcObject as MediaStream;
      oldStream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Clear state
    setCameraStream(null);
    videoTrackRef.current = null;
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      let stream: MediaStream | null = null;
      
      // Strategy 1: Try exact deviceId first
      try {
        console.log('Attempting exact deviceId...');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { deviceId: { exact: nextCamera.deviceId } }
        });
        console.log('✅ Success with exact deviceId');
      } catch (exactError: any) {
        console.log('Exact failed:', exactError.name);
        
        // Strategy 2: Try ideal deviceId
        try {
          console.log('Attempting ideal deviceId...');
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: { ideal: nextCamera.deviceId } }
          });
          console.log('✅ Success with ideal deviceId');
        } catch (idealError: any) {
          console.log('Ideal failed:', idealError.name);
          
          // Strategy 3: Try facingMode based on label
          try {
            const label = nextCamera.label.toLowerCase();
            const facingMode = (label.includes('back') || label.includes('rear') || 
                               label.includes('environment') || label.includes('external'))
                               ? 'environment' : 'user';
            console.log('Attempting facingMode:', facingMode);
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: { ideal: facingMode } }
            });
            console.log('✅ Success with facingMode:', facingMode);
          } catch (facingError: any) {
            console.log('FacingMode failed:', facingError.name);
            
            // Strategy 4: Last resort - basic video
            console.log('Attempting basic video...');
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            console.log('✅ Success with basic video');
          }
        }
      }
      
      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('No video tracks available');
      }
      
      // Validate stream (readyState might be 'new' or 'connecting' initially, that's OK)
      const tracks = stream.getVideoTracks();
      if (tracks.length === 0) {
        throw new Error('No video tracks in stream');
      }
      
      console.log('✅ Stream obtained, tracks:', tracks.length, 'readyState:', tracks[0].readyState, 'active:', stream.active);
      
      // Store track for flash
      videoTrackRef.current = tracks[0];
      const capabilities = videoTrackRef.current.getCapabilities() as any;
      setHasFlash(!!(capabilities.torch || capabilities.fillLightMode));
      
      // CRITICAL: Set video element IMMEDIATELY
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }
      
      const video = videoRef.current;
      
      // Clear old stream completely
      if (video.srcObject) {
        const old = video.srcObject as MediaStream;
        old.getTracks().forEach(t => t.stop());
      }
      
      // Set new stream
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.setAttribute('autoplay', 'true');
      video.setAttribute('playsinline', 'true');
      video.setAttribute('muted', 'true');
      
      // Force styles
      video.style.display = 'block';
      video.style.visibility = 'visible';
      video.style.opacity = '1';
      video.style.backgroundColor = 'transparent';
      
      console.log('✅ Stream assigned to video, readyState:', video.readyState);
      
      // AGGRESSIVE play strategy
      const forcePlay = async (attempt = 0) => {
        if (!video || !video.srcObject) {
          console.log('No video or srcObject');
          return;
        }
        
        const vStream = video.srcObject as MediaStream;
        if (!vStream.active || vStream.getVideoTracks().length === 0) {
          console.log('Stream not active or no tracks');
          if (attempt < 10) {
            setTimeout(() => forcePlay(attempt + 1), 200);
          }
          return;
        }
        
        try {
          if (video.readyState >= 2) {
            await video.play();
            console.log('✅ Video playing! readyState:', video.readyState);
            video.style.opacity = '1';
            setCameraLoading(false);
          } else {
            console.log('Video not ready, readyState:', video.readyState);
            if (attempt < 20) {
              setTimeout(() => forcePlay(attempt + 1), 100);
            }
          }
        } catch (err: any) {
          console.log('Play error:', err.name, 'attempt:', attempt);
          if (attempt < 20) {
            setTimeout(() => forcePlay(attempt + 1), 200);
          }
        }
      };
      
      // Set up event listeners
      const onReady = () => {
        console.log('Video ready event fired');
        forcePlay();
      };
      
      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('canplaythrough', onReady, { once: true });
      
      // Set state to trigger useEffect
      setCameraStream(stream);
      setCurrentCameraIndex(nextIndex);
      
      // Start aggressive play attempts
      forcePlay();
      setTimeout(() => forcePlay(1), 100);
      setTimeout(() => forcePlay(2), 300);
      setTimeout(() => forcePlay(3), 500);
      setTimeout(() => forcePlay(4), 1000);
      
    } catch (error: any) {
      console.error('❌ Camera switch failed:', error);
      setCameraError('Failed to switch camera. Please try again.');
      setCameraLoading(false);
      
      // Try to restore
      try {
        const restore = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(restore);
        if (videoRef.current) {
          videoRef.current.srcObject = restore;
          videoRef.current.play().catch(() => {});
        }
      } catch (restoreError) {
        console.error('Restore failed:', restoreError);
      }
    }
  };

  // Toggle mirror
  const toggleMirror = () => {
    setIsMirrored(!isMirrored);
  };

  // Toggle grid
  const toggleGrid = () => {
    setShowGrid(!showGrid);
  };

  // Toggle flash
  const toggleFlash = async () => {
    if (!videoTrackRef.current || !hasFlash) return;
    
    try {
      const track = videoTrackRef.current;
      const capabilities = track.getCapabilities() as any;
      
      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !flashEnabled } as any]
        });
        setFlashEnabled(!flashEnabled);
      } else if (capabilities.fillLightMode) {
        await track.applyConstraints({
          advanced: [{ fillLightMode: flashEnabled ? 'off' : 'flash' } as any]
        });
        setFlashEnabled(!flashEnabled);
      }
    } catch (error) {
      console.error('Error toggling flash:', error);
    }
  };

  // Capture photo
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Apply mirroring if enabled
        if (isMirrored) {
          context.scale(-1, 1);
          context.drawImage(video, -canvas.width, 0);
        } else {
          context.drawImage(video, 0, 0);
        }
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `camera-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(file);
            stopCamera();
            onClose();
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  // Start camera when modal opens - only depend on isOpen to prevent loops
  useEffect(() => {
    if (isOpen) {
      // Reset all states when modal opens
      setCameraError(null);
      setCameraLoading(false);
      setCurrentCameraIndex(0);
      setShowGrid(false);
      setFlashEnabled(false);
      
      // Initialize video element immediately
      if (videoRef.current) {
        const video = videoRef.current;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.setAttribute('autoplay', 'true');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.style.opacity = '0'; // Start invisible until stream is ready
      }
      
      // Small delay to ensure state is reset before starting camera
      const timer = setTimeout(() => {
        if (startCameraRef.current) {
          startCameraRef.current();
        }
      }, 100);
      
      return () => {
        clearTimeout(timer);
        if (autoRetryIntervalRef.current) {
          clearInterval(autoRetryIntervalRef.current);
          autoRetryIntervalRef.current = null;
        }
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        videoTrackRef.current = null;
        // Clear video srcObject on cleanup
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };
    } else {
      // Stop camera when modal closes
      if (autoRetryIntervalRef.current) {
        clearInterval(autoRetryIntervalRef.current);
        autoRetryIntervalRef.current = null;
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      videoTrackRef.current = null;
      setCameraError(null);
      setCameraLoading(false);
      setFlashEnabled(false);
      // Clear video srcObject when modal closes
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [isOpen]); // Only depend on isOpen

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoRetryIntervalRef.current) {
        clearInterval(autoRetryIntervalRef.current);
        autoRetryIntervalRef.current = null;
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      videoTrackRef.current = null;
    };
  }, [cameraStream]);

  // Apply mirror transform to video
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
    }
  }, [isMirrored, cameraStream]);

  // FUNDAMENTAL FIX: Continuous monitoring and force play when stream is set
  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;

    const video = videoRef.current;
    const stream = cameraStream;

    console.log('🎥 Setting up video stream:', {
      streamActive: stream.active,
      videoTracks: stream.getVideoTracks().length,
      videoElement: !!video,
      currentSrcObject: !!video.srcObject
    });

    // CRITICAL: Set stream immediately
    if (!video.srcObject || video.srcObject !== stream) {
      console.log('🎥 Assigning stream to video element');
      video.srcObject = stream;
    }

    // Ensure video attributes are set
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('autoplay', 'true');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');

    // Force visibility
    video.style.display = 'block';
    video.style.visibility = 'visible';
    video.style.opacity = '1';
    video.style.backgroundColor = 'transparent';

    // Function to force play
    const ensurePlaying = () => {
      if (!video || !videoRef.current) {
        console.log('⚠️ Video element not available');
        return;
      }
      
      const currentVideo = videoRef.current;
      
      // Always ensure stream is set
      if (!currentVideo.srcObject) {
        console.log('⚠️ No srcObject, setting stream');
        currentVideo.srcObject = stream;
        return;
      }

      const videoStream = currentVideo.srcObject as MediaStream;
      
      // Check if stream is active
      if (!videoStream || !videoStream.active) {
        console.log('⚠️ Stream not active');
        return;
      }

      // Check if video tracks are live
      const tracks = videoStream.getVideoTracks();
      if (tracks.length === 0) {
        console.log('⚠️ No video tracks');
        return;
      }

      const track = tracks[0];
      if (track.readyState !== 'live') {
        console.log('⚠️ Track not live:', track.readyState);
        return;
      }

      // Force play if paused
      if (currentVideo.paused || currentVideo.ended) {
        console.log('▶️ Attempting to play video, readyState:', currentVideo.readyState);
        currentVideo.play()
          .then(() => {
            console.log('✅ Video playing successfully!');
            currentVideo.style.opacity = '1';
            currentVideo.style.display = 'block';
            currentVideo.style.visibility = 'visible';
            setCameraLoading(false);
          })
          .catch((err) => {
            console.error('❌ Play failed:', err.name, err.message);
            // Retry after short delay
            setTimeout(ensurePlaying, 100);
          });
      } else {
        console.log('✅ Video is already playing');
        currentVideo.style.opacity = '1';
        currentVideo.style.display = 'block';
        currentVideo.style.visibility = 'visible';
        setCameraLoading(false);
      }
    };

    // Run immediately
    ensurePlaying();

    // Set up interval to continuously check (extended to 15 seconds for camera switching)
    const interval = setInterval(ensurePlaying, 50);
    const intervalTimeout = setTimeout(() => {
      clearInterval(interval);
    }, 15000);

    // Also use requestAnimationFrame for smoother checking (extended to 15 seconds)
    let rafId: number | null = null;
    let rafActive = true;
    const checkWithRAF = () => {
      if (!rafActive) return;
      ensurePlaying();
      if (rafActive) {
        rafId = requestAnimationFrame(checkWithRAF);
      }
    };
    rafId = requestAnimationFrame(checkWithRAF);
    
    const rafTimeout = setTimeout(() => {
      rafActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    }, 15000);

    // Cleanup
    return () => {
      clearInterval(interval);
      clearTimeout(intervalTimeout);
      clearTimeout(rafTimeout);
      rafActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [cameraStream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-0 sm:p-4 modal-enter">
      <div className={`relative w-full h-full sm:max-w-4xl sm:h-auto sm:rounded-xl overflow-hidden modal-enter flex flex-col ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="p-2 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h3 className={`text-base sm:text-lg font-semibold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>📸 Camera</h3>
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Mirror Toggle Button - Always show */}
            <button
              type="button"
              onClick={toggleMirror}
              className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation ${
                isDarkMode 
                  ? isMirrored
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                  : isMirrored
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title={isMirrored ? 'Mirror On' : 'Mirror Off'}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            {/* Grid Toggle Button */}
            <button
              type="button"
              onClick={toggleGrid}
              className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation ${
                isDarkMode 
                  ? showGrid
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                  : showGrid
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title={showGrid ? 'Grid On' : 'Grid Off'}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
            
            {/* Flash Button - Only show if camera supports flash */}
            {hasFlash && (
              <button
                type="button"
                onClick={toggleFlash}
                className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation ${
                  isDarkMode 
                    ? flashEnabled
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                    : flashEnabled
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title={flashEnabled ? 'Flash On' : 'Flash Off'}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
            
            {/* Switch Camera Button - Only show if 2+ cameras */}
            {availableCameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                disabled={cameraLoading}
                className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title={cameraLoading && cameraStream ? 'Switching camera...' : 'Switch Camera'}
              >
                {cameraLoading && cameraStream ? (
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-current border-t-transparent"></div>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                )}
              </button>
            )}
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors touch-manipulation ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <XMarkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-2 sm:p-4 flex-1 flex flex-col min-h-0">
          {cameraError ? (
            <div className={`flex items-center justify-center min-h-48 sm:min-h-64 rounded-lg transition-colors duration-300 p-4 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <div className="text-center w-full max-w-md">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {typeof cameraError === 'string' ? <p>{cameraError}</p> : cameraError}
                </div>
              </div>
            </div>
          ) : cameraLoading ? (
            <div className={`flex items-center justify-center flex-1 min-h-0 rounded-lg transition-colors duration-300 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <p className={`text-sm sm:text-base font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {cameraStream ? 'Switching camera...' : 'Opening camera...'}
                </p>
                <p className={`text-xs sm:text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Please wait
                </p>
              </div>
            </div>
          ) : (
            <div className="relative bg-black overflow-hidden flex-1 min-h-0 w-full" style={{ 
              minHeight: 'calc(100vh - 140px)',
              height: 'calc(100vh - 140px)'
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                className="w-full h-full"
                style={{
                  transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)',
                  transformOrigin: 'center center',
                  display: 'block',
                  visibility: 'visible',
                  opacity: cameraStream ? 1 : 0,
                  backgroundColor: 'black',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  minWidth: '100%',
                  minHeight: '100%'
                }}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  console.log('onLoadedMetadata fired, readyState:', video.readyState);
                  video.play().catch(err => {
                    console.error('onLoadedMetadata play error:', err);
                    setTimeout(() => video.play().catch(console.error), 100);
                  });
                }}
                onLoadedData={(e) => {
                  const video = e.currentTarget;
                  console.log('onLoadedData fired, readyState:', video.readyState);
                  video.play().catch(err => {
                    console.error('onLoadedData play error:', err);
                    setTimeout(() => video.play().catch(console.error), 100);
                  });
                }}
                onCanPlay={(e) => {
                  const video = e.currentTarget;
                  console.log('onCanPlay fired, readyState:', video.readyState);
                  video.play().catch(err => {
                    console.error('onCanPlay play error:', err);
                    setTimeout(() => video.play().catch(console.error), 100);
                  });
                }}
                onPlaying={(e) => {
                  const video = e.currentTarget;
                  console.log('✅ onPlaying fired - video is playing!');
                  video.style.opacity = '1';
                  setCameraLoading(false);
                }}
                onPlay={(e) => {
                  const video = e.currentTarget;
                  console.log('✅ onPlay fired');
                  video.style.opacity = '1';
                  setCameraLoading(false);
                }}
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Grid Overlay */}
              {showGrid && (
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '33.33% 33.33%'
                }} />
              )}
              
              {/* Camera Info */}
              {cameraStream && (
                <div className={`absolute top-2 left-2 sm:top-4 sm:left-4 bg-black/70 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm transition-colors duration-300 text-white z-20`}>
                  {availableCameras[currentCameraIndex]?.label || `Camera ${currentCameraIndex + 1}`}
                  {isMirrored && ' 🪞'}
                  {flashEnabled && ' ⚡'}
                </div>
              )}
              
              {/* Camera Controls */}
              <div className="absolute bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-20">
                <button
                  type="button"
                  onClick={capturePhoto}
                  onTouchStart={(e) => {
                    e.preventDefault();
                  }}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 touch-manipulation"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full border-[3px] sm:border-4 border-white flex items-center justify-center">
                    <PhotoIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className={`p-2 sm:p-4 border-t transition-colors duration-300 flex-shrink-0 ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-700' 
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {availableCameras.length > 0 ? `${currentCameraIndex + 1} of ${availableCameras.length} cameras` : 'No cameras available'}
            </span>
            <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {isMirrored ? '🪞 Mirrored' : 'Normal'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

