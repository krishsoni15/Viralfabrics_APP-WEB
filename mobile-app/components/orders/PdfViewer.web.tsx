import React from 'react';

interface PdfViewerProps {
  url: string;
  style?: any;
}

export default function PdfViewer({ url, style }: PdfViewerProps) {
  return (
    <iframe
      src={url}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: 12,
        backgroundColor: '#ffffff',
        ...style,
      }}
      title="PDF Preview"
    />
  );
}
