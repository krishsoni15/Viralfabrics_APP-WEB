import { NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configure AWS S3 Client (v3) - will be initialized after env check
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.S3_REGION;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

// Configure API route for large file uploads (Next.js 13+ App Router)
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for large uploads

export async function POST(req: NextRequest) {
  try {
    // Check for authentication token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Authentication required'
      }), { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Authentication token required'
      }), { status: 401 });
    }
    
    // Set a longer timeout for file uploads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for uploads
    
    try {
      // Parse form data (Next.js handles multipart/form-data automatically)
      const formData = await req.formData() as any;
      // Check for both 'file' and 'image' keys for compatibility
      const file = (formData.get('file') || formData.get('image')) as File;
      const folder = (formData.get('folder') as string) || 'general';
      const weaverId = formData.get('weaverId') as string | null;
      const sampleId = formData.get('sampleId') as string | null;
      
      if (!file) {
        clearTimeout(timeoutId);
        console.error('Upload error: No file in formData. Available keys:', Array.from(formData.keys()));
        return new Response(JSON.stringify({
          success: false,
          message: 'No file provided. Please select a file to upload.'
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if it's actually a File object
      if (!(file instanceof File)) {
        clearTimeout(timeoutId);
        console.error('Upload error: Invalid file object. Type:', typeof file, 'Value:', file);
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid file object provided'
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (file.size === 0) {
        clearTimeout(timeoutId);
        return new Response(JSON.stringify({
          success: false,
          message: 'Empty file provided'
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate file size (10MB max)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        clearTimeout(timeoutId);
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        return new Response(JSON.stringify({
          success: false,
          message: `File size (${sizeMB}MB) exceeds maximum allowed size of 10MB. Please compress the image before uploading.`
        }), { 
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get file extension for validation
      const fileExtension = file.name.toLowerCase().split('.').pop();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
      
      // Validate file type - check extension first, then MIME type
      // Some browsers/clients may not set MIME type correctly
      const hasValidExtension = fileExtension && allowedExtensions.includes(fileExtension);
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/svg'];
      const hasValidMimeType = file.type && allowedTypes.includes(file.type);
      
      // If no MIME type but has valid extension, infer it
      let contentType = file.type;
      if (!contentType && hasValidExtension) {
        const mimeMap: { [key: string]: string } = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml'
        };
        contentType = mimeMap[fileExtension] || 'application/octet-stream';
      }
      
      if (!hasValidExtension && !hasValidMimeType) {
        clearTimeout(timeoutId);
        return new Response(JSON.stringify({
          success: false,
          message: `Only image files are allowed (JPG, PNG, GIF, WEBP, SVG). Received: type="${file.type || 'none'}", extension="${fileExtension || 'none'}", name="${file.name}"`
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        clearTimeout(timeoutId);
        return new Response(JSON.stringify({
          success: false,
          message: `File size must be less than 10MB. Received: ${(file.size / 1024 / 1024).toFixed(2)}MB`
        }), { status: 400 });
      }

      // Check AWS S3 configuration
      if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME || !process.env.S3_REGION) {
        clearTimeout(timeoutId);
        console.error('AWS S3 configuration missing:', {
          hasAccessKey: !!process.env.S3_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.S3_SECRET_ACCESS_KEY,
          hasBucket: !!process.env.S3_BUCKET_NAME,
          hasRegion: !!process.env.S3_REGION
        });
        return new Response(JSON.stringify({
          success: false,
          message: 'Upload service configuration error'
        }), { status: 500 });
      }

      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Generate folder path based on context
      // For sampling: sample/{weaverId}/filename (all images directly in weaver folder, no subfolders)
      // Structure: sample/{weaverId}/timestamp-filename.jpg
      // All image types (PNG, JPEG, JPG) go directly in the weaver's folder
      // For other folders: uploads/{folder}/
      let fileName: string;
      if ((folder === 'sampling' || folder === 'weaver') && weaverId) {
        // Sample images: sample/{weaverId}/filename
        // All images go directly in weaver folder - simple structure
        const timestamp = Date.now().toString();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        fileName = `sample/${weaverId}/${timestamp}-${sanitizedFileName}`;
      } else {
        // Other folders: uploads/{folder}/
        fileName = `uploads/${folder}/${Date.now().toString()}-${file.name}`;
      }
      
      // Get S3 client (will throw if credentials are invalid)
      const client = getS3Client();
      
      // Upload to AWS S3 using v3 SDK
      const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: fileName,
        Body: buffer,
        ContentType: contentType || file.type || 'application/octet-stream'
      };

      const command = new PutObjectCommand(uploadParams);
      await client.send(command);

      // Construct the public URL (handle different region formats)
      const region = process.env.S3_REGION || 'us-east-1';
      const bucketName = process.env.S3_BUCKET_NAME!;
      // us-east-1 uses s3.amazonaws.com, other regions use s3.region.amazonaws.com
      const publicUrl = region === 'us-east-1' 
        ? `https://${bucketName}.s3.amazonaws.com/${fileName}`
        : `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;

      clearTimeout(timeoutId);
      return new Response(JSON.stringify({
        success: true,
        url: publicUrl,
        public_id: fileName,
        imageUrl: publicUrl // Add imageUrl for compatibility
      }), { status: 200 });
      
    } catch (uploadError: any) {
      clearTimeout(timeoutId);
      if (uploadError.name === 'AbortError') {
        return new Response(JSON.stringify({
          success: false,
          message: 'Upload timeout - file is too large or server is slow. Please try again.'
        }), { status: 408 });
      }
      
      throw uploadError;
    }

  } catch (error: any) {
    // Log the actual error for debugging
    console.error('Upload error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Upload timeout - please try again with a smaller file or check your connection.'
      }), { status: 408 });
    }
    
    // AWS SDK v3 error codes
    if (error.name === 'AccessDenied' || error.code === 'AccessDenied') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Access denied: Your AWS IAM user does not have permission to upload files. Please check your IAM policy includes s3:PutObject permission for the bucket.'
      }), { status: 403 });
    }
    
    if (error.name === 'CredentialsProviderError' || error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
      return new Response(JSON.stringify({
        success: false,
        message: 'AWS credentials error - please check your configuration.'
      }), { status: 503 });
    }
    
    if (error.name === 'NoSuchBucket' || error.code === 'NoSuchBucket') {
      return new Response(JSON.stringify({
        success: false,
        message: 'S3 bucket not found - please check your bucket name.'
      }), { status: 503 });
    }
    
    if (error.message && (error.message.includes('AWS') || error.message.includes('S3') || error.code === 'CredentialsError')) {
      return new Response(JSON.stringify({
        success: false,
        message: `Upload service error: ${error.message || 'Unknown AWS error'}`
      }), { status: 503 });
    }
    
    return new Response(JSON.stringify({
      success: false,
      message: `Failed to upload file: ${error.message || 'Unknown error'}`
    }), { status: 500 });
  }
}
