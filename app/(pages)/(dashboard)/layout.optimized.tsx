import { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardLayoutClient from './DashboardLayoutClient';
import { Loading } from '@/app/components/feedback';

export const metadata: Metadata = {
  title: {
    default: 'Dashboard | ViralFabrics',
    template: '%s | ViralFabrics',
  },
  description: 'ViralFabrics CRM Management System',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<Loading type="spinner" message="Loading..." />}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </Suspense>
  );
}

