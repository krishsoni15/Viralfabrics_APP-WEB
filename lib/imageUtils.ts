/**
 * Image utility functions for compression and validation
 */

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_WIDTH = 2048;
const MAX_HEIGHT = 2048;
const DEFAULT_QUALITY = 0.85;

/**
 * Validate image file
 */
export function validateImageFile(file: File): ImageValidationResult {
  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  return { valid: true };
}

/**
 * Compress image before upload
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = MAX_WIDTH,
    maxHeight = MAX_HEIGHT,
    quality = DEFAULT_QUALITY,
    maxSizeMB = 5
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with quality
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Check if compressed size is acceptable
            const sizeMB = blob.size / (1024 * 1024);
            if (sizeMB > maxSizeMB) {
              // Try with lower quality
              canvas.toBlob(
                (lowerQualityBlob) => {
                  if (!lowerQualityBlob) {
                    reject(new Error('Failed to compress image'));
                    return;
                  }
                  const compressedFile = new File(
                    [lowerQualityBlob],
                    file.name,
                    { type: file.type }
                  );
                  resolve(compressedFile);
                },
                file.type,
                0.7 // Lower quality
              );
            } else {
              const compressedFile = new File(
                [blob],
                file.name,
                { type: file.type }
              );
              resolve(compressedFile);
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Validate and compress image if needed
 */
export async function processImageFile(
  file: File,
  compress: boolean = true,
  options?: CompressionOptions
): Promise<File> {
  // Validate first
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Compress if requested and file is large
  if (compress && file.size > 2 * 1024 * 1024) { // Compress if > 2MB
    try {
      return await compressImage(file, options);
    } catch (error) {
      // If compression fails, return original file
      console.warn('Image compression failed, using original file:', error);
      return file;
    }
  }

  return file;
}

