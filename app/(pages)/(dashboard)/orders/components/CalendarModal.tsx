// 'use client';

// import { useState } from 'react';
// import { 
//   XMarkIcon,
//   ChevronLeftIcon,
//   ChevronRightIcon,
//   CalendarIcon
// } from '@heroicons/react/24/outline';
// import { useDarkMode } from '../../hooks/useDarkMode';

// interface CalendarModalProps {
//   onClose: () => void;
//   onDateSelect: (date: string, field?: string) => void;
//   selectedDate?: string;
//   field?: string;
// }

// export default function CalendarModal({ onClose, onDateSelect, selectedDate, field }: CalendarModalProps) {
//   const { isDarkMode, mounted } = useDarkMode();
//   const [currentDate, setCurrentDate] = useState(() => {
//     if (selectedDate) {
//       return new Date(selectedDate);
//     }
//     return new Date();
//   });

//   const getDaysInMonth = (date: Date) => {
//     const year = date.getFullYear();
//     const month = date.getMonth();
//     const daysInMonth = new Date(year, month + 1, 0).getDate();
//     const firstDayOfMonth = new Date(year, month, 1).getDay();
    
//     const days = [];
    
//     // Add empty cells for days before the first day of the month
//     for (let i = 0; i < firstDayOfMonth; i++) {
//       days.push(null);
//     }
    
//     // Add days of the month
//     for (let i = 1; i <= daysInMonth; i++) {
//       days.push(new Date(year, month, i));
//     }
    
//     return days;
//   };

//   const formatDate = (date: Date) => {
//     return date.toISOString().split('T')[0];
//   };

//   const isToday = (date: Date) => {
//     const today = new Date();
//     return date.toDateString() === today.toDateString();
//   };

//   const isSelected = (date: Date) => {
//     if (!selectedDate) return false;
//     return formatDate(date) === selectedDate;
//   };

//   const isPastDate = (date: Date) => {
//     return false; // Allow all dates
//   };

//   const handleDateClick = (date: Date) => {
//     onDateSelect(formatDate(date), field);
//   };

//   const goToPreviousMonth = () => {
//     setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
//   };

//   const goToNextMonth = () => {
//     setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
//   };

//   const goToToday = () => {
//     setCurrentDate(new Date());
//   };

//   const monthNames = [
//     'January', 'February', 'March', 'April', 'May', 'June',
//     'July', 'August', 'September', 'October', 'November', 'December'
//   ];

//   const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
//   const days = getDaysInMonth(currentDate);

//   // Prevent hydration mismatch by not rendering until mounted
//   if (!mounted) {
//     return (
//       <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
//         <div className="w-full max-w-sm rounded-xl shadow-2xl bg-white border border-gray-200 flex items-center justify-center">
//           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
//       <div className={`w-full max-w-sm rounded-xl shadow-2xl ${
//         isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
//       }`}>
//         {/* Header */}
//         <div className={`flex justify-between items-center p-4 border-b ${
//           isDarkMode ? 'border-slate-700' : 'border-gray-200'
//         }`}>
//           <div className="flex items-center space-x-3">
//             <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
//               isDarkMode 
//                 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
//                 : 'bg-gradient-to-br from-blue-600 to-indigo-700'
//             }`}>
//               <CalendarIcon className="h-4 w-4 text-white" />
//             </div>
//                          <div>
//                <h2 className={`text-lg font-bold ${
//                  isDarkMode ? 'text-white' : 'text-gray-900'
//                }`}>
//                  Select Date
//                </h2>
//              </div>
//           </div>
//           <button
//             onClick={onClose}
//             className={`p-2 rounded-lg transition-all duration-300 ${
//               isDarkMode
//                 ? 'text-gray-400 hover:bg-white/10 hover:text-gray-300'
//                 : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
//             }`}
//           >
//             <XMarkIcon className="h-5 w-5" />
//           </button>
//         </div>

//         {/* Calendar */}
//         <div className="p-4">
//           {/* Month Navigation */}
//           <div className="flex justify-between items-center mb-4">
//             <button
//               onClick={goToPreviousMonth}
//               className={`p-2 rounded-lg transition-all duration-300 ${
//                 isDarkMode
//                   ? 'text-gray-400 hover:bg-white/10 hover:text-gray-300'
//                   : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
//               }`}
//             >
//               <ChevronLeftIcon className="h-5 w-5" />
//             </button>
            
//                          <h3 className={`text-lg font-semibold ${
//                isDarkMode ? 'text-white' : 'text-gray-900'
//              }`}>
//                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
//              </h3>
            
//             <button
//               onClick={goToNextMonth}
//               className={`p-2 rounded-lg transition-all duration-300 ${
//                 isDarkMode
//                   ? 'text-gray-400 hover:bg-white/10 hover:text-gray-300'
//                   : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
//               }`}
//             >
//               <ChevronRightIcon className="h-5 w-5" />
//             </button>
//           </div>

//           {/* Day Headers */}
//           <div className="grid grid-cols-7 gap-1 mb-2">
//             {dayNames.map((day) => (
//               <div
//                 key={day}
//                 className={`text-center text-xs font-medium py-2 ${
//                   isDarkMode ? 'text-gray-400' : 'text-gray-500'
//                 }`}
//               >
//                 {day}
//               </div>
//             ))}
//           </div>

//           {/* Calendar Grid */}
//           <div className="grid grid-cols-7 gap-1">
//             {days.map((date, index) => (
//               <div key={index} className="aspect-square">
//                 {date ? (
//                   <button
//                     onClick={() => handleDateClick(date)}
//                                          disabled={false}
//                     className={`w-full h-full rounded-lg text-sm font-medium transition-all duration-300 ${
//                       isSelected(date)
//                         ? isDarkMode
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-blue-600 text-white'
//                         : isToday(date)
//                         ? isDarkMode
//                           ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
//                           : 'bg-blue-100 text-blue-700 border border-blue-200'
//                                                  : isDarkMode
//                            ? 'text-white hover:bg-white/10'
//                            : 'text-gray-900 hover:bg-gray-100'
//                     }`}
//                   >
//                     {date.getDate()}
//                   </button>
//                 ) : (
//                   <div className="w-full h-full" />
//                 )}
//               </div>
//             ))}
//           </div>

//           {/* Footer */}
//           <div className={`flex justify-end space-x-3 pt-4 mt-4 border-t ${
//             isDarkMode ? 'border-slate-700' : 'border-gray-200'
//           }`}>
//             <button
//               type="button"
//               onClick={onClose}
//               className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
//                 isDarkMode
//                   ? 'text-gray-300 hover:bg-white/10'
//                   : 'text-gray-700 hover:bg-gray-100'
//               }`}
//             >
//               Cancel
//             </button>
//             <button
//               type="button"
//               onClick={() => {
//                 if (selectedDate) {
//                   onDateSelect(selectedDate, field);
//                 }
//               }}
//               className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
//                 selectedDate
//                   ? isDarkMode
//                     ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
//                     : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
//                   : isDarkMode
//                     ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
//                     : 'bg-gray-300 text-gray-500 cursor-not-allowed'
//               }`}
//               disabled={!selectedDate}
//             >
//               Select Date
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
