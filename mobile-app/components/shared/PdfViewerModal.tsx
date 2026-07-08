/**
 * PdfViewerModal — Premium full-screen PDF viewer with inline preview,
 * Save & Share actions.
 *
 * Features:
 * - Full-screen modal with inline PDF rendering via WebView
 * - PDF renders directly inside the app — no browser needed
 * - Loading spinner while PDF loads
 * - Bottom floating action bar with Share and Save buttons
 * - Dark/light mode support
 * - Haptic feedback on actions
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import { X, Download, Share2, FileText, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';
import { savePdfToDevice, sharePdf } from '../../utils/pdfUtils';
import { storage } from '../../utils/storage';
import * as Print from 'expo-print';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import ToastContainer from '../ui/Toast';

// Dynamically import WebView to avoid crashes on web
let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (e) {
  // react-native-webview not available (e.g., on web)
}



/**
 * Generate HTML with PDF.js for rendering PDFs on Android.
 * This loads PDF.js from a CDN and renders each page on a canvas.
 */
const getAndroidHtml = (base64: string, isDarkMode: boolean) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
      <title>PDF Viewer</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: ${isDarkMode ? '#0f172a' : '#f8fafc'};
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        #canvas-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 0;
          box-sizing: border-box;
        }
        .page-container {
          position: relative;
          margin-bottom: 20px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
          background-color: #ffffff;
          border-radius: 0px;
          overflow: hidden;
          width: 92%;
          max-width: 800px;
        }
        canvas {
          display: block;
          width: 100%;
          height: auto;
        }
        #loading-indicator {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-size: 16px;
          font-weight: 600;
          color: ${isDarkMode ? '#94a3b8' : '#64748b'};
        }
        .spinner {
          border: 4px solid rgba(59, 130, 246, 0.1);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border-left-color: #3b82f6;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      </script>
    </head>
    <body>
      <div id="loading-indicator">
        <div class="spinner"></div>
        <div>Loading PDF...</div>
      </div>
      <div id="canvas-container"></div>

      <script>
        try {
          const base64Data = '${base64}';
          const raw = window.atob(base64Data);
          const rawLength = raw.length;
          const array = new Uint8Array(new ArrayBuffer(rawLength));

          for(let i = 0; i < rawLength; i++) {
            array[i] = raw.charCodeAt(i);
          }

          const loadingTask = pdfjsLib.getDocument({data: array});
          loadingTask.promise.then(function(pdf) {
            document.getElementById('loading-indicator').style.display = 'none';
            const container = document.getElementById('canvas-container');
            const numPages = pdf.numPages;

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pages_loaded',
                totalPages: numPages
              }));
            }

            function renderPage(pageNumber) {
              if (pageNumber > numPages) return;

              pdf.getPage(pageNumber).then(function(page) {
                const viewport = page.getViewport({scale: 2.0});
                
                const pageDiv = document.createElement('div');
                pageDiv.className = 'page-container';
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                pageDiv.appendChild(canvas);
                container.appendChild(pageDiv);
                
                const renderContext = {
                  canvasContext: context,
                  viewport: viewport
                };
                
                page.render(renderContext).promise.then(function() {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'page_rendered',
                      page: pageNumber,
                      totalPages: numPages
                    }));
                  }
                  renderPage(pageNumber + 1);
                });
              }).catch(function(err) {
                console.error('Error rendering page:', err);
              });
            }

            renderPage(1);

          }, function (reason) {
            document.getElementById('loading-indicator').innerHTML = '<div style="color: #ef4444;">Failed to load PDF document.</div>';
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                message: reason.message
              }));
            }
          });
        } catch (e) {
          document.getElementById('loading-indicator').innerHTML = '<div style="color: #ef4444;">Initialization error: ' + e.message + '</div>';
        }
      </script>
    </body>
    </html>
  `;
};

export interface PdfViewerModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** The remote URL of the PDF */
  pdfUrl: string;
  /** Display name for the PDF */
  title: string;
  /** The filename to use when saving */
  filename: string;
  /** Optional local file URI (skip download, use directly) */
  localUri?: string;
  /** Optional base64 PDF data (skip download, use directly, Android) */
  localBase64?: string;
  /** Optional callback after successful download */
  onDownloadComplete?: () => void;
  /** Optional callback to show toast */
  addToast?: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }) => void;
}

export default function PdfViewerModal({
  visible,
  onClose,
  pdfUrl,
  title,
  filename,
  localUri,
  localBase64,
  onDownloadComplete,
  addToast,
}: PdfViewerModalProps) {
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { isLargeScreen, modalMaxWidth } = useResponsiveLayout();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [cachedUri, setCachedUri] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null);

  // Use local PDF or pre-download from remote when modal opens
  useEffect(() => {
    if (visible) {
      if (localUri) {
        setCachedUri(localUri);
        if (localBase64) {
          setPdfBase64(localBase64);
          setPdfLoading(false);
        } else if (Platform.OS === 'android') {
          setPdfLoading(true);
          FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
          }).then(base64 => {
            setPdfBase64(base64);
            setPdfLoading(false);
          }).catch(err => {
            console.warn('[PDF Preview] Failed to read local base64:', err);
            setPdfLoading(false);
          });
        } else {
          setPdfLoading(false);
        }
      } else if (pdfUrl) {
        setPdfLoading(true);
        setPdfError(false);
        setPdfErrorMessage(null);
        preCachePdf();
      }
    }
    return () => {
      setDownloadComplete(false);
      setCachedUri(null);
      setPdfBase64(null);
      setPdfLoading(true);
      setPdfError(false);
      setPdfErrorMessage(null);
    };
  }, [visible, pdfUrl, localUri, localBase64]);

  const preCachePdf = useCallback(async () => {
    try {
      const cacheUri = `${FileSystem.cacheDirectory}${filename}`;
      const token = await storage.getToken();
      console.log('[PDF Preview] preCachePdf starting for URL:', pdfUrl);
      const result = await FileSystem.downloadAsync(pdfUrl, cacheUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      console.log('[PDF Preview] downloadAsync result status:', result.status);
      if (result.status === 200) {
        if (Platform.OS === 'android') {
          const base64 = await FileSystem.readAsStringAsync(result.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setPdfBase64(base64);
        }
        setCachedUri(result.uri);
      } else {
        console.warn('[PDF Preview] PDF pre-cache failed with status:', result.status);
        setPdfError(true);
        setPdfErrorMessage(`Server returned status code ${result.status}`);
      }
    } catch (err: any) {
      console.warn('[PDF Preview] PDF pre-cache failed with exception:', err);
      setPdfError(true);
      setPdfErrorMessage(err.message || 'Unknown network error');
    }
  }, [pdfUrl, filename]);

  const handleSave = useCallback(async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const token = await storage.getToken();
      const result = await savePdfToDevice({
        url: pdfUrl,
        filename,
        token,
        dialogTitle: title,
        localUri: cachedUri || undefined,
      });

      if (result.success) {
        setDownloadComplete(true);
        if (result.localUri && !result.localUri.startsWith('content://')) {
          setCachedUri(result.localUri);
        }

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        addToast?.({
          type: 'success',
          title: 'Saved Successfully ✅',
          message: result.message,
        });

        onDownloadComplete?.();

        // Reset the checkmark after 2 seconds
        setTimeout(() => setDownloadComplete(false), 2000);
      } else {
        addToast?.({
          type: 'error',
          title: 'Save Failed ❌',
          message: result.message,
        });
      }
    } catch (err: any) {
      addToast?.({
        type: 'error',
        title: 'Error ❌',
        message: `Failed to save: ${err.message}`,
      });
    } finally {
      setIsDownloading(false);
    }
  }, [pdfUrl, filename, title, isDownloading, addToast, onDownloadComplete, cachedUri]);

  const handleShare = useCallback(async () => {
    if (isSharing) return;

    setIsSharing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      // If we have a cached file, share it directly
      let uriToShare = cachedUri;

      if (!uriToShare) {
        // Download first
        const token = await storage.getToken();
        const cacheUri = `${FileSystem.cacheDirectory}${filename}`;
        const result = await FileSystem.downloadAsync(pdfUrl, cacheUri, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (result.status === 200) {
          uriToShare = result.uri;
          setCachedUri(result.uri);
        }
      }

      if (uriToShare) {
        await sharePdf(uriToShare, filename, `Share ${title}`);
      } else {
        addToast?.({
          type: 'error',
          title: 'Share Failed ❌',
          message: 'Could not prepare PDF for sharing.',
        });
      }
    } catch (err: any) {
      console.error('Share error:', err);
    } finally {
      setIsSharing(false);
    }
  }, [cachedUri, pdfUrl, filename, title, isSharing, addToast]);

  if (!visible) return null;

  // Build the PDF preview content
  const renderPdfPreview = () => {
    // 1. Android Specific PDF.js Renderer
    if (Platform.OS === 'android' && WebView && pdfBase64) {
      return (
        <View style={[styles.webViewContainer, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
          <WebView
            source={{ html: getAndroidHtml(pdfBase64, isDarkMode) }}
            style={[styles.webView, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}
            onLoadStart={() => setPdfLoading(true)}
            onMessage={(event: any) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'page_rendered') {
                  if (data.page === 1) {
                    setPdfLoading(false);
                  }
                } else if (data.type === 'error') {
                  setPdfLoading(false);
                  setPdfError(true);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }}
            scalesPageToFit
            bounces={false}
            startInLoadingState={false}
            allowFileAccess
            allowFileAccessFromFileURLs
            originWhitelist={['*']}
            builtInZoomControls={true}
            displayZoomControls={false}
            domStorageEnabled={true}
            javaScriptEnabled={true}
          />
          {pdfLoading && (
            <View style={[styles.loadingOverlay, { backgroundColor: isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)' }]}>
              <ActivityIndicator size="large" color={Colors.primary[500]} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading PDF...
              </Text>
            </View>
          )}
        </View>
      );
    }

    // 2. iOS Native WebKit PDF Renderer
    if (Platform.OS === 'ios' && WebView && cachedUri) {
      return (
        <View style={[styles.webViewContainer, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }]}>
          <WebView
            source={{ uri: cachedUri }}
            style={[styles.webView, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }]}
            onLoadStart={() => setPdfLoading(true)}
            onLoadEnd={() => setPdfLoading(false)}
            onError={() => {
              setPdfLoading(false);
              setPdfError(true);
            }}
            scalesPageToFit
            bounces={false}
            startInLoadingState={false}
            allowFileAccess
            allowFileAccessFromFileURLs
            originWhitelist={['*']}
          />
          {pdfLoading && (
            <View style={[styles.loadingOverlay, { backgroundColor: isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)' }]}>
              <ActivityIndicator size="large" color={Colors.primary[500]} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading PDF...
              </Text>
            </View>
          )}
        </View>
      );
    }

    // 3. Fallback/Preparing states (if WebView is loading or not yet cached)
    if (Platform.OS !== 'web' && WebView && !cachedUri && !pdfError) {
      return (
        <View style={[styles.webViewContainer, styles.centeredContainer, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }]}>
          <View style={[
            styles.pdfIconContainer,
            { backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : Colors.primary[50] },
          ]}>
            <FileText size={48} color={Colors.primary[500]} />
          </View>
          <ActivityIndicator size="large" color={Colors.primary[500]} style={{ marginTop: 16 }} />
          <Text style={[styles.loadingText, { color: theme.textSecondary, marginTop: 12 }]}>
            Preparing PDF preview...
          </Text>
        </View>
      );
    }

    // 4. Fallback for Web or Error conditions
    return (
      <View style={[styles.webViewContainer, styles.centeredContainer, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }]}>
        <View style={[
          styles.pdfIconContainer,
          { backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : Colors.primary[50] },
        ]}>
          <FileText size={48} color={Colors.primary[500]} />
        </View>
        <Text style={[styles.fallbackTitle, { color: theme.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.fallbackSubtitle, { color: theme.textSecondary }]}>
          {pdfError
            ? `Could not load PDF preview (${pdfErrorMessage || 'Unknown Error'}). You can still save or share the file.`
            : filename}
        </Text>
        {!pdfError && (
          <View style={[
            styles.statusBadge,
            {
              backgroundColor: cachedUri
                ? (isDarkMode ? 'rgba(34,197,94,0.12)' : Colors.success[50])
                : (isDarkMode ? 'rgba(59,130,246,0.12)' : Colors.primary[50]),
              marginTop: 16,
            },
          ]}>
            {cachedUri ? (
              <>
                <CheckCircle size={14} color={Colors.success[500]} />
                <Text style={[styles.statusText, { color: Colors.success[500] }]}>
                  Ready to Save or Share
                </Text>
              </>
            ) : (
              <>
                <ActivityIndicator size="small" color={Colors.primary[500]} />
                <Text style={[styles.statusText, { color: Colors.primary[500] }]}>
                  Preparing PDF...
                </Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={isLargeScreen}
      animationType={isLargeScreen ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: isLargeScreen ? 'rgba(0,0,0,0.15)' : undefined, justifyContent: 'center', alignItems: 'center' }}>
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', width: isLargeScreen ? '100%' : '100%', maxWidth: isLargeScreen ? modalMaxWidth : '100%', height: isLargeScreen ? '90%' : '100%', borderRadius: 0, overflow: 'hidden' }]}>
        {/* ─── Header ─── */}
        <View style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            borderBottomColor: isDarkMode ? '#1e293b' : '#e2e8f0',
          },
        ]}>
          <View style={styles.headerLeft}>
            <View style={[
              styles.headerIcon,
              { backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : Colors.primary[50] },
            ]}>
              <FileText size={20} color={Colors.primary[500]} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text
                style={[styles.headerTitle, { color: theme.text }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {title}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                PDF Document
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            style={[
              styles.closeButton,
              { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' },
            ]}
          >
            <X size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* ─── PDF Preview Area ─── */}
        <View style={styles.contentArea}>
          {renderPdfPreview()}
        </View>

        {/* ─── Bottom Actions ─── */}
        <View style={[
          styles.actionBar,
          {
            paddingBottom: isLargeScreen ? 20 : Math.max(insets.bottom, 16),
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            borderTopColor: isDarkMode ? '#1e293b' : '#e2e8f0',
          },
        ]}>
          {/* Share Button */}
          <TouchableOpacity
            onPress={handleShare}
            disabled={isSharing}
            activeOpacity={0.8}
            style={[
              styles.actionButton,
              {
                backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                borderColor: isDarkMode ? '#475569' : '#e2e8f0',
              },
            ]}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <>
                <Share2 size={20} color={isDarkMode ? '#93c5fd' : Colors.primary[600]} />
                <Text style={[styles.actionButtonText, { color: theme.text }]}>Share</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Save / Download Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isDownloading}
            activeOpacity={0.8}
            style={[
              styles.actionButton,
              styles.primaryButton,
              downloadComplete && styles.successButton,
            ]}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : downloadComplete ? (
              <>
                <CheckCircle size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Saved!</Text>
              </>
            ) : (
              <>
                <Download size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Save to Device</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        </View>
        <ToastContainer />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  contentArea: {
    flex: 1,
  },
  webViewContainer: {
    flex: 1,
    margin: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingOverlay: {
    ...(StyleSheet.absoluteFill as any),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  pdfIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  fallbackSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Action Bar
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[600],
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  successButton: {
    backgroundColor: Colors.success[500],
    borderColor: Colors.success[500],
  },
});
