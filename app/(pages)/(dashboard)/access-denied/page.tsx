import { Suspense } from 'react';
import { 
  ShieldExclamationIcon,
  HomeIcon
} from '@heroicons/react/24/outline';
import { BRAND_NAME } from '@/lib/config';
import AccessDeniedClient from './AccessDeniedClient';
import AccessDeniedButton from './AccessDeniedButton';  

// Force dynamic rendering
export const dynamic = 'force-dynamic';  

// Server Component - Static content
function AccessDeniedContent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 transition-all duration-300">
      <div className="max-w-md w-full mx-auto p-8 rounded-xl shadow-2xl bg-white/90 backdrop-blur-sm border border-gray-200/50 dark:bg-slate-800/90 dark:border-slate-600/50">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 shadow-lg">
            <ShieldExclamationIcon className="h-12 w-12" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
            Access Denied
          </h1>
          <p className="text-lg text-red-600 dark:text-red-400">
            Superadmin Access Only
          </p>
        </div>

        {/* Message */}
        <div className="text-center mb-8 text-gray-600 dark:text-gray-300">
          <p className="mb-4">
            You don&apos;t have permission to access this page. This area is restricted to superadmin users only.
          </p>
        </div>

        {/* Client Component for User Info */}
        <AccessDeniedClient />

        {/* Action Button - Client Component */}
        <div className="flex justify-center">
          <AccessDeniedButton />
        </div>

        {/* Brand Info */}
        <div className="text-center mt-8 pt-6 border-t border-gray-200/50 dark:border-slate-600/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {BRAND_NAME}
          </p>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function AccessDeniedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    }>
      <AccessDeniedContent />
    </Suspense>
  );
}
