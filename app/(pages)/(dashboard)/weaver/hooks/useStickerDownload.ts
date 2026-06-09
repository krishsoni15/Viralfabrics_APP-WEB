import { useState, useCallback, useRef, useEffect } from 'react';
import { generateSampleStickerPDF, downloadSampleStickerPDFDirect } from '@/lib/pdfGenerator';
import { logger } from '@/lib/logger';
import type { Sample } from '../types';

interface StickerPreviewState {
  show: boolean;
  url: string | null;
  sample: Sample | null;
  loading: boolean;
}

interface UseStickerDownloadOptions {
  isMobileDevice: boolean;
  showMessage: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function useStickerDownload({ isMobileDevice, showMessage }: UseStickerDownloadOptions) {
  const [previewState, setPreviewState] = useState<StickerPreviewState>({
    show: false,
    url: null,
    sample: null,
    loading: false
  });
  
  // Track blob URLs for cleanup
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup blob URLs on unmount or when preview closes
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const handleDownload = useCallback(async (sample: Sample) => {
    try {
      // Prepare sample data for sticker
      const weaverName = typeof sample.weaverId === 'object' && sample.weaverId !== null && 'name' in sample.weaverId
        ? sample.weaverId.name
        : undefined;
      const stickerData = {
        qualityName: sample.qualityName || '-',
        weaverName: weaverName,
        width: sample.finishWidth || undefined,
        gsm: sample.gsm || undefined,
        content: sample.content || undefined,
        count: sample.count || undefined,
        rxP: sample.reed && sample.pick ? `${sample.reed}/${sample.pick}` : undefined,
        danier: sample.danier || undefined,
        moq: undefined, // MOQ not stored in database, always empty for sticker
        rack: sample.rack || undefined
      };
      
      // On mobile devices, download directly without preview
      if (isMobileDevice) {
        try {
          downloadSampleStickerPDFDirect(stickerData);
          showMessage('success', 'Sticker PDF downloading...');
        } catch (error) {
          logger.error('Error downloading sticker on mobile', error instanceof Error ? error : new Error(String(error)));
          showMessage('error', 'Failed to download sticker. Please try again.');
        }
        return;
      }
      
      // Desktop: Show preview first
      setPreviewState(prev => ({ ...prev, loading: true }));
      
      // Generate PDF preview
      const pdfDataUrl = generateSampleStickerPDF(stickerData);
      
      // Convert data URL to blob URL for better CSP compatibility
      try {
        const base64Data = pdfDataUrl.split(',')[1] || pdfDataUrl.split('base64,')[1];
        if (base64Data) {
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          
          // Cleanup previous blob URL if exists
          cleanupBlobUrl();
          
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;
          
          setPreviewState({
            show: true,
            url: blobUrl,
            sample,
            loading: false
          });
        } else {
          setPreviewState({
            show: true,
            url: pdfDataUrl,
            sample,
            loading: false
          });
        }
      } catch (error) {
        logger.error('Error converting PDF to blob', error instanceof Error ? error : new Error(String(error)));
        setPreviewState({
          show: true,
          url: pdfDataUrl,
          sample,
          loading: false
        });
      }
    } catch (error) {
      logger.error('Error generating sticker preview', error instanceof Error ? error : new Error(String(error)));
      setPreviewState(prev => ({ ...prev, loading: false }));
      showMessage('error', 'Failed to generate sticker preview. Please try again.');
    }
  }, [isMobileDevice, showMessage, cleanupBlobUrl]);

  const handleFinalDownload = useCallback(() => {
    if (!previewState.sample) return;
    
    try {
      // Prepare sample data for sticker
      const weaverName = typeof previewState.sample.weaverId === 'object' && previewState.sample.weaverId !== null && 'name' in previewState.sample.weaverId
        ? previewState.sample.weaverId.name
        : undefined;
      const stickerData = {
        qualityName: previewState.sample.qualityName || '-',
        weaverName: weaverName,
        width: previewState.sample.finishWidth || undefined,
        gsm: previewState.sample.gsm || undefined,
        content: previewState.sample.content || undefined,
        count: previewState.sample.count || undefined,
        rxP: previewState.sample.reed && previewState.sample.pick 
          ? `${previewState.sample.reed}/${previewState.sample.pick}` 
          : undefined,
        danier: previewState.sample.danier || undefined,
        moq: undefined, // MOQ not stored in database, always empty for sticker
        rack: previewState.sample.rack || undefined
      };
      
      downloadSampleStickerPDFDirect(stickerData);
      showMessage('success', 'Sticker PDF downloading...');
      
      // Close preview and cleanup
      cleanupBlobUrl();
      setPreviewState({
        show: false,
        url: null,
        sample: null,
        loading: false
      });
    } catch (error) {
      logger.error('Error downloading sticker', error instanceof Error ? error : new Error(String(error)));
      showMessage('error', 'Failed to download sticker. Please try again.');
    }
  }, [previewState.sample, showMessage, cleanupBlobUrl]);

  const closePreview = useCallback(() => {
    cleanupBlobUrl();
    setPreviewState({
      show: false,
      url: null,
      sample: null,
      loading: false
    });
  }, [cleanupBlobUrl]);

  return {
    previewState,
    handleDownload,
    handleFinalDownload,
    closePreview
  };
}

