import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate that it is a web URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from source: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const blob = await response.blob();

    // Extract filename from URL or content-type
    let filename = 'downloaded-image';
    const urlParts = imageUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1]?.split('?')[0];
    if (lastPart && lastPart.includes('.')) {
      filename = lastPart;
    } else {
      const ext = contentType.split('/')[1];
      if (ext) {
        filename += `.${ext}`;
      }
    }

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Download proxy error:', error);
    return NextResponse.json({ error: error.message || 'Failed to download file' }, { status: 500 });
  }
}
