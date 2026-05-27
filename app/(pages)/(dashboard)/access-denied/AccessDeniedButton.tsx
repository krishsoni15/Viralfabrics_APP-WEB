'use client';

import { HomeIcon } from '@heroicons/react/24/outline';

export default function AccessDeniedButton() {
  const handleGoToDashboard = () => {
    window.location.href = '/dashboard';
  };

  return (
    <button
      onClick={handleGoToDashboard}
      className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-700"
    >
      <HomeIcon className="h-5 w-5 mr-2" />
      Go to Dashboard
    </button>
  );
}
