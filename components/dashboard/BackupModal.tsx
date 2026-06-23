import React, { useState } from 'react';
import { X, HardDrive, Image as ImageIcon, CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import clsx from 'clsx';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (includeImages: boolean) => void;
  isDownloading: boolean;
  progress: number;
  statusText: string;
}

export default function BackupModal({
  isOpen,
  onClose,
  onConfirm,
  isDownloading,
  progress,
  statusText,
}: BackupModalProps) {
  const [includeImages, setIncludeImages] = useState(false);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => { /* Do not close on backdrop click */ }}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-xl transition-all border border-slate-200 dark:border-slate-800">
                
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDownloading}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Close"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>

                <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-slate-900 dark:text-white flex items-center gap-2">
                  <HardDrive className="text-indigo-600 dark:text-indigo-400" size={24} />
                  System Backup
                </Dialog.Title>

                <div className="mt-4">
                  {!isDownloading ? (
                    <>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                        Choose how you want to download your system data.
                      </p>

                      <div className="space-y-3">
                        {/* Option 1: Text Only */}
                        <label className={clsx(
                          "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                          !includeImages 
                            ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20" 
                            : "border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700"
                        )}>
                          <div className="flex items-center h-5">
                            <input
                              type="radio"
                              name="backupType"
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-600"
                              checked={!includeImages}
                              onChange={() => setIncludeImages(false)}
                            />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                              Fast Data Backup <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Default</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Downloads JSON, CSV, and Excel records without heavy media files. Very fast.
                            </p>
                          </div>
                        </label>

                        {/* Option 2: Text + Images */}
                        <label className={clsx(
                          "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                          includeImages 
                            ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20" 
                            : "border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700"
                        )}>
                          <div className="flex items-center h-5">
                            <input
                              type="radio"
                              name="backupType"
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-600"
                              checked={includeImages}
                              onChange={() => setIncludeImages(true)}
                            />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                              Full Backup with Media <ImageIcon size={14} className="text-emerald-500" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Includes all photos and attachments. Safely downloaded in chunks. May take a few minutes.
                            </p>
                          </div>
                        </label>
                      </div>

                      <div className="mt-8 flex justify-end gap-3">
                        <button
                          type="button"
                          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          onClick={onClose}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/30"
                          onClick={() => onConfirm(includeImages)}
                        >
                          Start Download
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 flex flex-col items-center">
                      {progress < 100 ? (
                        <div className="relative mb-6">
                          <Loader2 size={48} className="text-indigo-600 animate-spin opacity-20" />
                          <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-indigo-600 dark:text-indigo-400">
                            {Math.round(progress)}%
                          </div>
                        </div>
                      ) : (
                        <CheckCircle size={48} className="text-emerald-500 mb-6" />
                      )}
                      
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        {progress >= 100 ? "Finalizing Backup..." : "Generating Backup"}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 text-center px-4">
                        {statusText}
                      </p>

                      {/* Sleek Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden relative">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out absolute left-0 top-0"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
