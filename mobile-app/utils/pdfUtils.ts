/**
 * PDF Utilities — Save PDFs directly to device storage
 *
 * Android: Downloads to cache → copies to Downloads folder via SAF
 * iOS: Downloads to cache → presents "Save to Files" via expo-sharing
 * Web: Blob download with <a download> link
 */
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';

let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (e) {
  // expo-sharing not available
}

/**
 * Generate a PDF file safely from HTML.
 * On Android, Expo Print creates files in cache/Print/ that are locked by Android Print Spooler.
 * Passing base64: true and writing base64 directly into FileSystem.cacheDirectory bypasses the lock cleanly.
 */
export async function generatePdfFromHtml(
  html: string,
  filename: string,
  options?: { width?: number; height?: number }
): Promise<{ uri: string; base64?: string }> {
  const result = await Print.printToFileAsync({
    html,
    base64: true,
    ...options,
  });

  let finalUri = result.uri;
  let base64 = result.base64;

  if (Platform.OS !== 'web') {
    try {
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      if (Platform.OS === 'android' && base64) {
        await FileSystem.writeAsStringAsync(dest, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        finalUri = dest;
      } else {
        try {
          await FileSystem.copyAsync({ from: result.uri, to: dest });
          finalUri = dest;
        } catch (copyErr) {
          console.warn('[PDF Utils] copyAsync failed, using print URI directly:', copyErr);
          finalUri = result.uri;
        }
      }
    } catch (err) {
      console.warn('[PDF Utils] Failed to cache generated PDF:', err);
    }
  }

  return { uri: finalUri, base64 };
}

export interface SavePdfOptions {
  /** The remote URL of the PDF */
  url: string;
  /** The desired filename (e.g., "Sticker_Quality.pdf") */
  filename: string;
  /** Optional auth token for the request */
  token?: string | null;
  /** Optional dialog title for iOS share sheet */
  dialogTitle?: string;
  /** Optional local file URI to bypass downloading */
  localUri?: string;
}

export interface SavePdfResult {
  success: boolean;
  /** Local file URI where the PDF was saved */
  localUri?: string;
  /** User-friendly message */
  message: string;
}

/**
 * Download a PDF and save it directly to the device.
 *
 * - **Android**: Saves to the device's Downloads folder using
 *   StorageAccessFramework (SAF). No browser, no external app.
 * - **iOS**: Downloads to cache, then opens "Save to Files" sheet
 *   (the standard iOS way — there's no public Downloads folder).
 * - **Web**: Creates a blob and triggers a browser download via <a download>.
 */
export async function savePdfToDevice(options: SavePdfOptions): Promise<SavePdfResult> {
  const { url, filename, token, dialogTitle, localUri } = options;

  // ─── Web ───────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return savePdfWeb(localUri || url, filename);
  }

  // ─── Native (Android / iOS) ────────────────────────────
  if (localUri) {
    try {
      if (Platform.OS === 'android') {
        return await saveToAndroidDownloads(localUri, filename);
      } else {
        return await saveToIosFiles(localUri, filename, dialogTitle);
      }
    } catch (err: any) {
      console.log('[PDF Save] savePdfToDevice localUri error:', err.message);
      return {
        success: false,
        message: `Failed to save PDF: ${err.message}`,
      };
    }
  }

  return savePdfNative(url, filename, token, dialogTitle);
}

/**
 * Web: Fetch as blob → create object URL → click hidden <a download> link
 */
async function savePdfWeb(url: string, filename: string): Promise<SavePdfResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

    return {
      success: true,
      message: `${filename} downloaded successfully.`,
    };
  } catch (err: any) {
    // Fallback: open in new tab
    try {
      window.open(url, '_blank');
      return {
        success: true,
        message: 'PDF opened in a new tab.',
      };
    } catch {
      return {
        success: false,
        message: `Download failed: ${err.message}`,
      };
    }
  }
}

/**
 * Native: Download to cache → save to device storage
 */
async function savePdfNative(
  url: string,
  filename: string,
  token?: string | null,
  dialogTitle?: string,
): Promise<SavePdfResult> {
  try {
    if (!url) {
      throw new Error('No download URL provided');
    }

    // If the URL is a local file:// URI, treat it as a local file — don't download
    if (url.startsWith('file://') || !url.startsWith('http')) {
      if (Platform.OS === 'android') {
        return await saveToAndroidDownloads(url, filename);
      } else {
        return await saveToIosFiles(url, filename, dialogTitle);
      }
    }

    // Step 1: Download to cache
    const cacheUri = `${FileSystem.cacheDirectory}${filename}`;
    const downloadResult = await FileSystem.downloadAsync(url, cacheUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (downloadResult.status !== 200) {
      let serverErrorMsg = `Server returned status ${downloadResult.status}`;
      try {
        const errorBodyText = await FileSystem.readAsStringAsync(downloadResult.uri);
        const parsedError = JSON.parse(errorBodyText);
        if (parsedError && parsedError.message) {
          serverErrorMsg = `${serverErrorMsg}: ${parsedError.message}`;
        } else if (errorBodyText) {
          serverErrorMsg = `${serverErrorMsg}: ${errorBodyText.substring(0, 120)}`;
        }
      } catch (e) {
        // Ignore read/parse errors
      }
      throw new Error(serverErrorMsg);
    }

    // Step 2: Save to device storage
    if (Platform.OS === 'android') {
      return await saveToAndroidDownloads(downloadResult.uri, filename);
    } else {
      // iOS — use share sheet to "Save to Files"
      return await saveToIosFiles(downloadResult.uri, filename, dialogTitle);
    }
  } catch (err: any) {
    console.log('[PDF Save] savePdfToDevice error:', err.message);
    return {
      success: false,
      message: `Failed to save PDF: ${err.message}`,
    };
  }
}

async function saveToAndroidDownloads(
  cachedUri: string,
  filename: string,
): Promise<SavePdfResult> {
  const targetUri = cachedUri;
  const mimeType = filename.endsWith('.zip')
    ? 'application/zip'
    : filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')
    ? 'image/png'
    : 'application/pdf';

  // 1. If stored SAF directory URI exists, attempt direct write
  try {
    const storedDirectoryUri = await AsyncStorage.getItem('vf_saf_directory_uri');
    if (storedDirectoryUri) {
      const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        storedDirectoryUri,
        filename,
        mimeType
      );
      const base64Data = await FileSystem.readAsStringAsync(targetUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(newFileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return {
        success: true,
        localUri: newFileUri,
        message: `${filename} saved to device successfully.`,
      };
    }
  } catch (safErr) {
    console.log('[PDF Save] Direct SAF write failed/bypassed, using native system saver:', safErr);
  }

  // 2. Standard Modern Android Approach: Use native system action sheet (shareAsync)
  // This opens Android's native "Save to Files / Save to Downloads / Drive" dialog
  // with ZERO SAF directory permission popups and 100% reliability on Android 11+.
  try {
    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(targetUri, {
        mimeType,
        dialogTitle: `Save ${filename}`,
        UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.item',
      });
      return {
        success: true,
        localUri: targetUri,
        message: `${filename} ready to save / share.`,
      };
    }
  } catch (shareErr: any) {
    console.error('[PDF Save] Native system save failed:', shareErr);
  }

  return {
    success: false,
    message: `Failed to save ${filename}`,
  };
}

async function saveToIosFiles(
  cachedUri: string,
  filename: string,
  dialogTitle?: string,
): Promise<SavePdfResult> {
  const decodedCached = decodeURIComponent(cachedUri);
  try {
    const targetUri = `${FileSystem.documentDirectory}${filename}`;
    const decodedTarget = decodeURIComponent(targetUri);
    
    // Copy file from cache to documents directory
    await FileSystem.copyAsync({
      from: decodedCached,
      to: decodedTarget
    });
    
    return {
      success: true,
      localUri: decodedTarget,
      message: `Saved directly to Files app under "Viral Fabrics" folder.`,
    };
  } catch (err: any) {
    console.log('[PDF Save] saveToIosFiles copyAsync failed:', err.message);
    if (Sharing && (await Sharing.isAvailableAsync())) {
      try {
        await Sharing.shareAsync(decodedCached, {
          mimeType: 'application/pdf',
          dialogTitle: dialogTitle || `Save ${filename}`,
          UTI: 'com.adobe.pdf',
        });
        return {
          success: true,
          localUri: decodedCached,
          message: `${filename} ready — choose "Save to Files" to save.`,
        };
      } catch (shareErr: any) {
        console.log('[PDF Save] saveToIosFiles shareAsync failed:', shareErr.message);
        return {
          success: false,
          message: `Failed to share/save: ${shareErr.message}`,
        };
      }
    }
    return {
      success: false,
      message: `Failed to save: ${err.message}`,
    };
  }
}

/**
 * Share a cached PDF file using the native share sheet.
 * Works on both Android and iOS, allowing sharing via WhatsApp,
 * Gmail, Telegram, Bluetooth, AirDrop, etc.
 */
export async function sharePdf(
  cachedUri: string,
  filename: string,
  dialogTitle?: string,
): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      window.open(cachedUri, '_blank');
      return true;
    }

    let targetUri = cachedUri;

    // If targetUri is a remote HTTP/HTTPS URL, download to cache directory first for Expo sharing
    if (targetUri.startsWith('http://') || targetUri.startsWith('https://')) {
      const token = await storage.getToken();
      const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const localCachePath = `${FileSystem.cacheDirectory}${sanitizedName}`;

      const downloadResult = await FileSystem.downloadAsync(targetUri, localCachePath, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (downloadResult.status === 200) {
        targetUri = downloadResult.uri;
      }
    }

    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(targetUri, {
        mimeType: 'application/pdf',
        dialogTitle: dialogTitle || `Share ${filename}`,
        UTI: 'com.adobe.pdf',
      });
      return true;
    }

    Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
    return false;
  } catch (err: any) {
    console.error('sharePdf error:', err);
    return false;
  }
}
