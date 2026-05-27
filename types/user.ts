/**
 * User-related TypeScript types
 */

import type { UserRole, UserTheme, UserLanguage } from '@/constants/enums';

export interface User {
  _id: string;
  name: string;
  username: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
  loginCount?: number;
  preferences?: {
    theme: UserTheme;
    language: UserLanguage;
    notifications: boolean;
    timezone: string;
  };
  metadata?: {
    createdBy?: string;
    department?: string;
    employeeId?: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserFormData {
  name: string;
  username: string;
  password?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  role: UserRole;
  isActive?: boolean;
}

