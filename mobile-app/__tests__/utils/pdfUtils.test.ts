// Set Platform to Android for Android SAF tests
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android || obj.default,
  },
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) || null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///document/',
  cacheDirectory: 'file:///cache/',
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
  writeAsStringAsync: jest.fn(async () => {}),
  readAsStringAsync: jest.fn(async () => ''),
  deleteAsync: jest.fn(async () => {}),
  downloadAsync: jest.fn(async () => ({
    status: 200,
    uri: 'file:///temp',
  })),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(async () => ({
      granted: true,
      directoryUri: 'file:///downloads/',
    })),
    createFileAsync: jest.fn(async () => 'file:///downloads/test.pdf'),
    makeDirectoryAsync: jest.fn(async (parentUri: string, dirName: string) => `${parentUri}${dirName}/`),
  },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

import { savePdfToDevice } from '../../utils/pdfUtils';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('PDF Save Utilities', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeAll(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should attempt Storage Access Framework saving on Android first', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    const result = await savePdfToDevice({
      url: 'http://localhost/invoice.pdf',
      filename: 'Invoice.pdf',
      localUri: 'file:///cache/invoice.pdf',
    });

    expect(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).toHaveBeenCalled();
    expect(FileSystem.StorageAccessFramework.createFileAsync).toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('vf_saf_directory_uri', 'file:///downloads/');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Saved to device successfully');
  });

  test('should reuse stored directory URI if it is available in AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('file:///cached_downloads/');
    (FileSystem.StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValueOnce('file:///cached_downloads/Invoice.pdf');

    const result = await savePdfToDevice({
      url: 'http://localhost/invoice.pdf',
      filename: 'Invoice.pdf',
      localUri: 'file:///cache/invoice.pdf',
    });

    expect(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).not.toHaveBeenCalled();
    expect(FileSystem.StorageAccessFramework.createFileAsync).toHaveBeenCalledWith(
      'file:///cached_downloads/',
      'Invoice.pdf',
      'application/pdf'
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain('Saved to device successfully');
  });

  test('should clear stored directory URI and request directory permission if stored directory URI fails to write', async () => {
    // 1. AsyncStorage has stored directory URI
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('file:///invalid_cached_downloads/');
    
    // 2. Initial createFileAsync on stored directory fails (both initial and unique name retry)
    (FileSystem.StorageAccessFramework.createFileAsync as jest.Mock)
      .mockRejectedValueOnce(new Error('Permission Revoked')) // Initial try on cached URI
      .mockRejectedValueOnce(new Error('Permission Revoked')) // Unique suffix try on cached URI
      .mockResolvedValueOnce('file:///downloads/Invoice.pdf'); // Succeeds on newly requested URI

    const result = await savePdfToDevice({
      url: 'http://localhost/invoice.pdf',
      filename: 'Invoice.pdf',
      localUri: 'file:///cache/invoice.pdf',
    });

    // 3. Verify it removed invalid cached URI and requested new directory permissions
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('vf_saf_directory_uri');
    expect(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('vf_saf_directory_uri', 'file:///downloads/');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Saved to device successfully');
  });

  test('should fallback to sharing sheet if SAF createFileAsync throws a rejection permanently', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    // Force createFileAsync to fail permanently (both initial and unique name retry)
    (FileSystem.StorageAccessFramework.createFileAsync as jest.Mock).mockRejectedValue(
      new Error('SAF Permission Error')
    );

    const result = await savePdfToDevice({
      url: 'http://localhost/invoice.pdf',
      filename: 'Invoice.pdf',
      localUri: 'file:///cache/invoice.pdf',
    });

    // Verify it fell back to sharing sheet
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/invoice.pdf', expect.any(Object));
    expect(result.success).toBe(true);
    expect(result.message).toContain('Direct save failed');
  });
});
