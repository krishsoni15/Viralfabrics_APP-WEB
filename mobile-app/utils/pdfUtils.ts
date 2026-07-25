/**
 * PDF Utilities — Save PDFs directly to device storage
 *
 * Android: Downloads to cache → copies to Downloads folder via SAF
 * iOS: Downloads to cache → presents "Save to Files" via expo-sharing
 * Web: Blob download with <a download> link
 */
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (e) {
  // expo-sharing not available
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
      const decodedLocal = decodeURIComponent(localUri);
      if (Platform.OS === 'android') {
        return await saveToAndroidDownloads(decodedLocal, filename);
      } else {
        return await saveToIosFiles(decodedLocal, filename, dialogTitle);
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
  const decodedCached = decodeURIComponent(cachedUri);
  try {
    const mimeType = filename.endsWith('.zip') ? 'application/zip' : 'application/pdf';
    const storedDirectoryUri = await AsyncStorage.getItem('vf_saf_directory_uri');
    
    let newFileUri: string | null = null;
    let directoryUriToUse: string | null = storedDirectoryUri;

    if (directoryUriToUse) {
      try {
        newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          directoryUriToUse,
          filename,
          mimeType
        );
      } catch (createErr: any) {
        console.log('[PDF Save] Stored directory URI write failed, trying unique suffix:', createErr.message);
        try {
          const dotIndex = filename.lastIndexOf('.');
          const nameWithoutExt = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
          const ext = dotIndex !== -1 ? filename.slice(dotIndex) : (filename.endsWith('.zip') ? '.zip' : '.pdf');
          const timestamp = Math.floor(Date.now() / 1000);
          const uniqueFilename = `${nameWithoutExt}_${timestamp}${ext}`;
          
          newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            directoryUriToUse,
            uniqueFilename,
            mimeType
          );
        } catch (uniqueErr) {
          console.log('[PDF Save] Stored directory URI is invalid or revoked. Clearing stored URI.');
          directoryUriToUse = null;
          await AsyncStorage.removeItem('vf_saf_directory_uri');
        }
      }
    }

    if (!newFileUri || !directoryUriToUse) {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      
      if (!permissions.granted) {
        console.log('[PDF Save] SAF Permission denied, falling back to share sheet...');
        if (Sharing && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(decodedCached, {
            mimeType,
            dialogTitle: `Save ${filename}`,
            UTI: filename.endsWith('.zip') ? 'public.zip-archive' : 'com.adobe.pdf',
          });
          return {
            success: true,
            localUri: decodedCached,
            message: 'Folder permission denied. Opened share/save menu instead.',
          };
        }
        return {
          success: false,
          message: 'Permission to save file was denied, and sharing is unavailable.',
        };
      }

      directoryUriToUse = permissions.directoryUri;
      await AsyncStorage.setItem('vf_saf_directory_uri', directoryUriToUse);

      try {
        newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          directoryUriToUse,
          filename,
          mimeType
        );
      } catch (createErr: any) {
        console.log('[PDF Save] createFileAsync failed on new directory, trying unique suffix:', createErr.message);
        const dotIndex = filename.lastIndexOf('.');
        const nameWithoutExt = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
        const ext = dotIndex !== -1 ? filename.slice(dotIndex) : (filename.endsWith('.zip') ? '.zip' : '.pdf');
        const timestamp = Math.floor(Date.now() / 1000);
        const uniqueFilename = `${nameWithoutExt}_${timestamp}${ext}`;
        
        newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          directoryUriToUse,
          uniqueFilename,
          mimeType
        );
      }
    }

    const base64Data = await FileSystem.readAsStringAsync(decodedCached, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    await FileSystem.writeAsStringAsync(newFileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    return {
      success: true,
      localUri: newFileUri,
      message: 'Saved to device successfully.',
    };
  } catch (err: any) {
    console.log('[PDF Save] Android SAF save failed, falling back to share sheet:', err.message);
    try {
      if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(decodedCached, {
          mimeType: 'application/pdf',
          dialogTitle: `Save ${filename}`,
          UTI: 'com.adobe.pdf',
        });
        return {
          success: true,
          localUri: decodedCached,
          message: 'Direct save failed. Opened share/save menu instead.',
        };
      }
    } catch (shareErr: any) {
      console.error('[PDF Save] Sharing fallback also failed:', shareErr);
    }
    
    return {
      success: false,
      message: `Failed to save: ${err.message}`,
    };
  }
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
  const decodedCached = decodeURIComponent(cachedUri);
  try {
    if (Platform.OS === 'web') {
      // Web: No native share, just open in new tab
      window.open(decodedCached, '_blank');
      return true;
    }

    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(decodedCached, {
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
