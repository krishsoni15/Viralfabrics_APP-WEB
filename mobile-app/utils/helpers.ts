import { Platform } from 'react-native';
import { CONFIG } from '../constants/config';
import api from '../services/api';

/**
 * General helper to resolve any image URL, including local proxy in development
 */
export function resolveImageUrl(photoPath: string | undefined | null): string {
  if (!photoPath) return '';
  const trimmed = photoPath.trim();
  if (!trimmed) return '';
  const cleanPath = trimmed.toLowerCase();
  if (
    cleanPath === 'null' || 
    cleanPath === 'undefined' || 
    cleanPath === '/null' || 
    cleanPath === '/undefined' ||
    cleanPath === 'null/' || 
    cleanPath === 'undefined/' ||
    cleanPath === '' ||
    cleanPath === '/'
  ) {
    return '';
  }
  let resolvedUrl = trimmed;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:') && !trimmed.startsWith('file://')) {
    // Prepend API_URL to relative paths
    const baseUrl = CONFIG.API_URL.endsWith('/') ? CONFIG.API_URL.slice(0, -1) : CONFIG.API_URL;
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    resolvedUrl = `${baseUrl}${path}`;
  }
  
  // Replace localhost or 127.0.0.1 with the host/IP from CONFIG.API_URL if we are on a real device/emulator
  if (resolvedUrl.includes('localhost:') || resolvedUrl.includes('127.0.0.1:')) {
    const apiBase = CONFIG.API_URL.endsWith('/') ? CONFIG.API_URL.slice(0, -1) : CONFIG.API_URL;
    resolvedUrl = resolvedUrl
      .replace(/https?:\/\/localhost(:\d+)?/, apiBase)
      .replace(/https?:\/\/127\.0\.0\.1(:\d+)?/, apiBase);
  }

  // If in local development (CONFIG.API_URL contains localhost, 127.0.0.1, or local IP 192.168.x.x)
  // and the URL is an external S3 URL, proxy it through our local Next.js server to ensure it loads
  // on physical devices that have local connectivity via USB (adb reverse) but no external internet.
  const isLocalApi = CONFIG.API_URL.includes('localhost') || 
                      CONFIG.API_URL.includes('127.0.0.1') || 
                      CONFIG.API_URL.includes('192.168.') || 
                      CONFIG.API_URL.includes('10.0.');
  
  if (isLocalApi && resolvedUrl.startsWith('https://viralfabrics-bucket.s3.')) {
    const apiBase = CONFIG.API_URL.endsWith('/') ? CONFIG.API_URL.slice(0, -1) : CONFIG.API_URL;
    resolvedUrl = `${apiBase}/api/proxy-image?url=${encodeURIComponent(resolvedUrl)}`;
  }
  
  // Safely encode URI to handle spaces and special characters. Fix parentheses (Fresco bug on Android).
  try {
    let resultUrl = resolvedUrl;
    if (resolvedUrl.includes('?url=')) {
      const parts = resolvedUrl.split('?url=');
      resultUrl = `${parts[0]}?url=${encodeURIComponent(decodeURIComponent(parts[1]))}`;
    } else {
      let cleanUrl = resolvedUrl.replace(/%%20/g, '%20').replace(/%2520/g, '%20').replace(/%%/g, '%');
      resultUrl = encodeURI(cleanUrl);
    }
    // Explicitly replace parentheses to prevent Fresco image loader bugs on Android
    return resultUrl.replace(/\(/g, '%28').replace(/\)/g, '%29');
  } catch (e) {
    return resolvedUrl;
  }
}

/**
 * Resolve profile photo URL (alias to resolveImageUrl for backward compatibility)
 */
export function getProfilePhotoUrl(photoPath: string | undefined | null): string {
  return resolveImageUrl(photoPath);
}

/**
 * Format currency (INR)
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return '₹0';
  return '₹' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Format date to readable string
 */
export function formatDate(date: string | undefined | null): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | undefined | null): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Format date with time in a short, single-line format
 * e.g. "23 Jun '26, 12:54"
 */
export function formatShortDateTime(date: string | undefined | null): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} '${year}, ${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

/**
 * Get dynamic badge styles (colors and borders) based on process name/priority matching the web app
 */
export function getProcessBadgeStyles(processName: string | undefined | null, isDarkMode: boolean = false) {
  const name = (processName || '').trim().toLowerCase();
  const priorities: { [key: string]: number } = {
    'fob send': 1,
    'in house': 2,
    'ready to dispatch': 3,
    'folding': 4,
    'finish': 5,
    'washing': 6,
    'loop': 7,
    'in printing': 8,
    'jigar': 9,
    'in dyeing': 10,
    'setting': 11,
    'long jet': 12,
    'soflina wr': 13,
    'drum': 14,
    'charkha': 15,
    'lot no greigh': 16
  };
  
  const priority = priorities[name] || 0;
  
  if (priority === 0) {
    // Unknown priority / No process data - Grey
    return {
      backgroundColor: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : '#f1f5f9',
      textColor: isDarkMode ? '#cbd5e1' : '#475569',
      borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : '#cbd5e1'
    };
  }
  
  if (priority <= 5) {
    // High priority (ready to dispatch, folding, Finish, In House, FOB Send) - Green
    return {
      backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
      textColor: isDarkMode ? '#4ade80' : '#15803d',
      borderColor: isDarkMode ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0'
    };
  } else if (priority <= 9) {
    // Medium-high priority (washing, loop, in printing, jigar) - Blue
    return {
      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
      textColor: isDarkMode ? '#60a5fa' : '#1d4ed8',
      borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#bfdbfe'
    };
  } else if (priority <= 13) {
    // Medium priority (In Dyeing, setting, long jet, Soflina WR) - Yellow/Amber
    return {
      backgroundColor: isDarkMode ? 'rgba(234, 179, 8, 0.15)' : '#fef9c3',
      textColor: isDarkMode ? '#facc15' : '#a16207',
      borderColor: isDarkMode ? 'rgba(234, 179, 8, 0.3)' : '#fef08a'
    };
  } else {
    // Low priority (Drum, Charkha, Lot No Greigh) - Orange
    return {
      backgroundColor: isDarkMode ? 'rgba(249, 115, 22, 0.15)' : '#ffedd5',
      textColor: isDarkMode ? '#fb923c' : '#c2410c',
      borderColor: isDarkMode ? 'rgba(249, 115, 22, 0.3)' : '#fed7aa'
    };
  }
}


/**
 * Get greeting based on time
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Get initials from name
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Truncate text
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format status display label
 */
export function formatStatus(status: string): string {
  if (!status) return 'Not Set';
  return status
    .split('_')
    .map((word) => capitalize(word))
    .join(' ');
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

/**
 * Check if user is superadmin
 */
export function isSuperAdmin(role?: string): boolean {
  return role === 'superadmin' || role === 'master';
}

/**
 * Extract display-friendly order ID (strips FY prefix)
 * e.g. "FY2526-001" → "001", "042" → "042" (legacy)
 */
export function getDisplayOrderId(orderId?: string | null): string {
  if (!orderId) return '';
  const idStr = String(orderId).trim();
  
  // Split by common separators: '/', '-', or space
  const parts = idStr.split(/[\/\-\s]+/);
  const lastPart = parts[parts.length - 1];
  
  // If the last part consists of digits, return it
  if (lastPart && /^\d+$/.test(lastPart)) {
    return lastPart;
  }
  
  // Fallback: strip leading FY prefixes
  return idStr.replace(/^FY\s*-?\s*/i, '');
}

/**
 * Helper to upload an image file to S3 via the API, handles both Web and Native platforms
 */
export async function uploadSingleImage(uri: string, folder = 'general', weaverId?: string): Promise<string> {
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('data:image/') ||
    uri.startsWith('uploads/') ||
    uri.startsWith('/uploads/') ||
    uri.startsWith('/api/')
  ) {
    return uri;
  }
  
  const form = new FormData();
  const filename = uri.split('/').pop() || 'image.jpg';
  
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    form.append('image', blob, filename);
  } else {
    form.append('image', {
      uri,
      name: filename,
      type: 'image/jpeg'
    } as any);
  }
  
  if (folder) {
    form.append('folder', folder);
  }
  if (weaverId) {
    form.append('weaverId', weaverId);
  }

  const { data } = await api.post('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  const imageUrl = data?.imageUrl || data?.url;
  if (!imageUrl) {
    throw new Error('Upload succeeded but no URL returned');
  }
  return imageUrl;
}

/**
 * Get dynamic FY option calculator for filters
 */
export function getCalculatedFYOptions() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  // Financial year starts in April (month 3)
  const startYear = month >= 3 ? year : year - 1;

  const currentFYCode = `${String(startYear).slice(-2)}${String(startYear + 1).slice(-2)}`;
  const options: { value: string; label: string; isCurrent: boolean }[] = [];

  // Assuming FY 25-26 is the starting point based on web logic
  for (let sYr = startYear; sYr >= 2025; sYr--) {
    const eYr = sYr + 1;
    const code = `${String(sYr).slice(-2)}${String(eYr).slice(-2)}`;
    const label = `FY ${String(sYr).slice(-2)}-${String(eYr).slice(-2)}`;
    options.push({
      value: code,
      label,
      isCurrent: code === currentFYCode
    });
  }

  return options;
}
