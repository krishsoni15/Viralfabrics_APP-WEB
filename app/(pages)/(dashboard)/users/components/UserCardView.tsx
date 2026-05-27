'use client';

import React from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface User {
  _id: string;
  name: string;
  username: string;
  phoneNumber?: string;
  address?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserCardViewProps {
  users: User[];
  currentUser: { _id: string; username: string } | null;
  isDarkMode: boolean;
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
  onViewProfile: (user: User) => void;
  canDeleteUser: (user: User) => boolean;
  getUserInitials: (name: string) => string;
  formatDate: (date: string) => string;
}

export default function UserCardView({
  users,
  currentUser,
  isDarkMode,
  onEditUser,
  onDeleteUser,
  onViewProfile,
  canDeleteUser,
  getUserInitials,
  formatDate
}: UserCardViewProps) {
  return (
    <div className="space-y-4">
      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {users.map((user, index) => (
          <div
            key={user._id || `user-card-${index}`}
            className={`rounded-lg border p-4 transition-all duration-200 hover:shadow-lg ${
              isDarkMode
                ? 'bg-white/5 border-white/10 hover:bg-white/10'
                : 'bg-white border-gray-200 hover:shadow-md'
            } ${
              currentUser && user._id === currentUser._id
                ? isDarkMode
                  ? 'ring-2 ring-blue-500/50 bg-blue-500/5'
                  : 'ring-2 ring-blue-500/50 bg-blue-50'
                : ''
            }`}
          >
            {/* User Avatar and Basic Info */}
            <div className="flex items-center space-x-3 mb-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold ${
                isDarkMode
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white'
              }`}>
                {getUserInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-medium truncate ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {user.name}
                </h3>
                <p className={`text-xs truncate ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  {user.username}
                </p>
                {currentUser && user._id === currentUser._id && (
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full mt-1 ${
                    isDarkMode
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}>
                    You
                  </span>
                )}
              </div>
            </div>

            {/* Role Badge */}
            <div className="mb-3">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                user.role === 'superadmin'
                  ? isDarkMode
                    ? 'bg-purple-900/20 text-purple-400'
                    : 'bg-purple-100 text-purple-800'
                  : isDarkMode
                    ? 'bg-blue-900/20 text-blue-400'
                    : 'bg-blue-100 text-blue-800'
              }`}>
                {user.role === 'superadmin' ? 'Super Admin' : 'User'}
              </span>
            </div>

            {/* Contact Info */}
            {(user.phoneNumber || user.address) && (
              <div className="mb-3 space-y-1">
                {user.phoneNumber && (
                  <p className={`text-xs ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    📞 {user.phoneNumber}
                  </p>
                )}
                {user.address && (
                  <p className={`text-xs ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    📍 {user.address.length > 25 ? `${user.address.substring(0, 25)}...` : user.address}
                  </p>
                )}
              </div>
            )}

            {/* Created Date */}
            <div className="mb-3">
              <p className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Created: {formatDate(user.createdAt)}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-white/10">
              <button
                onClick={() => onViewProfile(user)}
                className={`text-xs px-2 py-1 rounded-md transition-all duration-200 ${
                  isDarkMode
                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                }`}
              >
                View
              </button>
              
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onEditUser(user)}
                  className={`p-1.5 rounded-md transition-all duration-200 hover:scale-110 ${
                    isDarkMode
                      ? 'text-blue-400 hover:bg-blue-500/20'
                      : 'text-blue-600 hover:bg-blue-50'
                  }`}
                  title="Edit user"
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
                {canDeleteUser(user) ? (
                  <button
                    onClick={() => onDeleteUser(user)}
                    className={`p-1.5 rounded-md transition-all duration-200 hover:scale-110 ${
                      isDarkMode
                        ? 'text-red-400 hover:bg-red-500/20'
                        : 'text-red-600 hover:bg-red-50'
                    }`}
                    title="Delete user"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    disabled
                    className={`p-1.5 rounded-md transition-all duration-200 cursor-not-allowed opacity-50 ${
                      isDarkMode
                        ? 'text-gray-500'
                        : 'text-gray-400'
                    }`}
                    title="You cannot delete yourself - This would lock you out of the system"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No users message */}
      {users.length === 0 && (
        <div className={`text-center py-12 ${
          isDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <p>No users found</p>
        </div>
      )}
    </div>
  );
}
