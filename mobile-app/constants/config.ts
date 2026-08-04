import Constants from 'expo-constants';

const DEFAULT_PROD_API_URL = 'https://viralfabrics-app-web.vercel.app';

// Dynamically extract the Metro host IP address to fallback if EXPO_PUBLIC_API_URL is missing or local
const getDevApiUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri || 
                  (Constants.expoConfig as any)?.debuggerHost || 
                  (Constants.manifest as any)?.debuggerHost;
                  
  if (!hostUri) return DEFAULT_PROD_API_URL;
  const ip = hostUri.split(':')[0];
  
  // If it's a tunnel connection, we shouldn't append port 3000
  if (ip.includes('exp.direct') || ip.includes('ngrok')) {
    return `https://${ip}`;
  }
  
  return `http://${ip}:3000`;
};

// Check if we should override the API URL with the Metro host IP in development
const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (__DEV__) {
    return getDevApiUrl();
  }
  return DEFAULT_PROD_API_URL;
};

export const CONFIG = {
  API_URL: getApiUrl(),
  APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Viral Fabrics',
  TOKEN_KEY: 'vf_token',
  USER_KEY: 'vf_user',
  DARK_MODE_KEY: 'vf_darkmode',
  QUERY_STALE_TIME: 5 * 60 * 1000, // 5 minutes
  QUERY_CACHE_TIME: 30 * 60 * 1000, // 30 minutes
  DEBOUNCE_MS: 500,
  PAGE_SIZE: 20,
  MAX_RETRIES: 3,
  TOAST_DURATION: 3000,
} as const;
