import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BRAND_NAME, BRAND_DESCRIPTION } from '@/lib/config';
import { DarkModeProvider } from './contexts/DarkModeContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap', // Optimize font loading
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap', // Optimize font loading
});

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: `${BRAND_NAME} - ${BRAND_DESCRIPTION}`,
  keywords: ['CRM', 'Order Management', 'Fabric', 'Textile'],
  authors: [{ name: BRAND_NAME }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: `${BRAND_NAME} - ${BRAND_DESCRIPTION}`,
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND_NAME,
    description: `${BRAND_NAME} - ${BRAND_DESCRIPTION}`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' }
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
      <head>
        {/* Favicon */}
        <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
        <link rel="shortcut icon" type="image/x-icon" href="/icons/favicon.ico" />
        
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        
        {/* Microsoft Tiles */}
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Initialize dark mode before React hydration to prevent flash */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
                    const savedMode = localStorage.getItem('darkMode');
                    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    const isDark = savedMode !== null ? savedMode === 'true' : (prefersDark || false);
                    
                    // Set initial theme on window object for React
                    window.__INITIAL_THEME__ = isDark;
                    
                    // Apply theme immediately to prevent flash
                    if (isDark) {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                    }
                  }
                } catch (e) {
                  // Fallback to light mode if localStorage is not available
                  if (typeof window !== 'undefined') {
                    window.__INITIAL_THEME__ = false;
                  }
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <DarkModeProvider>
          {children}
        </DarkModeProvider>
      </body>
    </html>
  );
}
