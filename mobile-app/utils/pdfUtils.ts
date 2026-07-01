/**
 * PDF Utilities — Save PDFs directly to device storage
 *
 * Android: Downloads to cache → copies to Downloads folder via SAF
 * iOS: Downloads to cache → presents "Save to Files" via expo-sharing
 * Web: Blob download with <a download> link
 */
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

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
  const { url, filename, token, dialogTitle } = options;

  // ─── Web ───────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return savePdfWeb(url, filename);
  }

  // ─── Native (Android / iOS) ────────────────────────────
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
    console.error('savePdfToDevice error:', err);
    return {
      success: false,
      message: `Failed to save PDF: ${err.message}`,
    };
  }
}

/**
 * Android: Use StorageAccessFramework to write the PDF to the
 * device's Downloads folder. This is fully in-app — no browser,
 * no external app dependency.
 */
async function saveToAndroidDownloads(
  cachedUri: string,
  filename: string,
): Promise<SavePdfResult> {
  try {
    // Try using StorageAccessFramework from expo-file-system
    const SAF = FileSystem.StorageAccessFramework;

    if (SAF && SAF.requestDirectoryPermissionsAsync) {
      // Ask the user for a directory (typically they'll pick Downloads)
      const permissions = await SAF.requestDirectoryPermissionsAsync();

      if (permissions.granted) {
        // Read the cached file as base64
        const fileContent = await FileSystem.readAsStringAsync(cachedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Create the file in the user-selected directory
        const createdUri = await SAF.createFileAsync(
          permissions.directoryUri,
          filename,
          'application/pdf',
        );

        // Write the content
        await FileSystem.writeAsStringAsync(createdUri, fileContent, {
          encoding: FileSystem.EncodingType.Base64,
        });

        return {
          success: true,
          localUri: createdUri,
          message: `${filename} saved to your device.`,
        };
      }
    }

    // Fallback: If SAF isn't available or user denied, use expo-sharing
    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(cachedUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Save ${filename}`,
        UTI: 'com.adobe.pdf',
      });
      return {
        success: true,
        localUri: cachedUri,
        message: `${filename} ready to save.`,
      };
    }

    // Last resort: The file is in cache, inform user
    return {
      success: true,
      localUri: cachedUri,
      message: `${filename} downloaded to app cache.`,
    };
  } catch (err: any) {
    // If SAF fails (e.g., on older devices), try sharing
    if (Sharing && (await Sharing.isAvailableAsync())) {
      try {
        await Sharing.shareAsync(cachedUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save ${filename}`,
          UTI: 'com.adobe.pdf',
        });
        return {
          success: true,
          localUri: cachedUri,
          message: `${filename} ready to save.`,
        };
      } catch {
        // Fall through
      }
    }
    return {
      success: false,
      message: `Failed to save: ${err.message}`,
    };
  }
}

/**
 * iOS: Use expo-sharing to present the "Save to Files" sheet.
 * This is the standard iOS approach — there's no public Downloads folder.
 */
async function saveToIosFiles(
  cachedUri: string,
  filename: string,
  dialogTitle?: string,
): Promise<SavePdfResult> {
  if (Sharing && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(cachedUri, {
      mimeType: 'application/pdf',
      dialogTitle: dialogTitle || `Save ${filename}`,
      UTI: 'com.adobe.pdf',
    });
    return {
      success: true,
      localUri: cachedUri,
      message: `${filename} ready — choose "Save to Files" to save.`,
    };
  }

  return {
    success: true,
    localUri: cachedUri,
    message: `${filename} downloaded to app storage.`,
  };
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
      // Web: No native share, just open in new tab
      window.open(cachedUri, '_blank');
      return true;
    }

    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(cachedUri, {
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
