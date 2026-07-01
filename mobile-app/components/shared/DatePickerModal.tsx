import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { Colors } from '../../constants/colors';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void; // Stored in DD/MM/YYYY format
  value: string; // Stored in DD/MM/YYYY format
  title?: string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DatePickerModal({
  visible,
  onClose,
  onSelectDate,
  value,
  title = 'Select Date',
}: DatePickerModalProps) {
  const { theme, isDarkMode } = useTheme();
  
  // Parse initial selected date
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Current calendar month view state
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth());
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);

  // Update calendar state when modal opens or value changes
  useEffect(() => {
    if (value && value.trim()) {
      const parts = value.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed month
        const year = parseInt(parts[2], 10);

        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          setSelectedDay(day);
          setSelectedMonth(month);
          setSelectedYear(year);
          setViewMonth(month);
          setViewYear(year);
          setShowYearMonthPicker(false);
          return;
        }
      }
    }
    // Default to current date if empty/invalid
    const today = new Date();
    setSelectedDay(null);
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setShowYearMonthPicker(false);
  }, [value, visible]);

  // Calendar logic helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayIndex = getFirstDayOfMonth(viewYear, viewMonth);

  // Generate calendar days grid array
  const calendarCells: (number | null)[] = [];
  
  // Empty slots for start of month offset
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  
  // Actual calendar days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push(i);
  }

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDaySelect = (day: number) => {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const dateStr = `${formattedDay}/${formattedMonth}/${viewYear}`;
    onSelectDate(dateStr);
    onClose();
  };

  const handleClear = () => {
    onSelectDate('');
    onClose();
  };

  const today = new Date();
  const isToday = (day: number) => {
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear
    );
  };

  const isSelected = (day: number) => {
    return (
      selectedDay === day &&
      selectedMonth === viewMonth &&
      selectedYear === viewYear
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.backdrop} 
        onPress={onClose}
      >
        <View style={styles.centeredView}>
          <Pressable 
            style={[
              styles.modalView, 
              { 
                backgroundColor: theme.card,
                borderColor: theme.border,
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {title}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Month/Year Selector */}
            <View style={styles.monthSelector}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowButton}>
                <ChevronLeft size={20} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowYearMonthPicker(!showYearMonthPicker)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: showYearMonthPicker
                    ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                    : 'transparent'
                }}
              >
                <Text style={[styles.monthLabel, { color: theme.text }]}>
                  {MONTHS[viewMonth]} {viewYear}
                </Text>
                <ChevronDown
                  size={16}
                  color={theme.textSecondary}
                  style={{
                    transform: [{ rotate: showYearMonthPicker ? '180deg' : '0deg' }]
                  }}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNextMonth} style={styles.arrowButton}>
                <ChevronRight size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            {showYearMonthPicker ? (
              <View>
                {/* Year Selector Row */}
                <View style={[styles.yearSelectorRow, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: theme.border, borderWidth: 1 }]}>
                  <TouchableOpacity 
                    onPress={() => setViewYear(viewYear - 1)} 
                    style={styles.arrowButton}
                  >
                    <ChevronLeft size={18} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.yearLabel, { color: theme.text }]}>
                    {viewYear}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setViewYear(viewYear + 1)} 
                    style={styles.arrowButton}
                  >
                    <ChevronRight size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>

                {/* Month Grid */}
                <View style={styles.monthGridContainer}>
                  {MONTHS.map((month, idx) => {
                    const isSelectedMonth = viewMonth === idx;
                    return (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.7}
                        onPress={() => {
                          setViewMonth(idx);
                          setShowYearMonthPicker(false);
                        }}
                        style={[
                          styles.monthGridCell,
                          {
                            backgroundColor: isSelectedMonth
                              ? Colors.primary[600]
                              : isDarkMode
                                ? '#1e293b'
                                : '#f1f5f9',
                            borderColor: theme.border,
                          }
                        ]}
                      >
                        <Text style={[
                          styles.monthGridText,
                          { color: isSelectedMonth ? '#ffffff' : theme.text },
                          isSelectedMonth && { fontWeight: '700' }
                        ]}>
                          {month.substring(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <>
                {/* Days of Week Header */}
                <View style={styles.daysOfWeekContainer}>
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <Text 
                      key={idx} 
                      style={[styles.dayOfWeekLabel, { color: theme.textSecondary }]}
                    >
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.gridContainer}>
                  {calendarCells.map((day, idx) => {
                    if (day === null) {
                      return <View key={idx} style={styles.dayCellEmpty} />;
                    }

                    const selected = isSelected(day);
                    const current = isToday(day);

                    return (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.7}
                        onPress={() => handleDaySelect(day)}
                        style={[
                          styles.dayCell,
                          selected && styles.dayCellSelected,
                          current && !selected && [styles.dayCellToday, { borderColor: Colors.primary[500] }],
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: theme.text },
                            selected && styles.dayTextSelected,
                            current && !selected && { color: Colors.primary[500], fontWeight: '700' },
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Modal Actions */}
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <TouchableOpacity 
                style={[styles.footerBtn, { backgroundColor: isDarkMode ? '#334155' : Colors.neutral[100] }]} 
                onPress={handleClear}
              >
                <Text style={[styles.footerBtnText, { color: theme.textSecondary }]}>
                  Clear
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.footerBtn, { backgroundColor: Colors.primary[600] }]} 
                onPress={onClose}
              >
                <Text style={[styles.footerBtnText, { color: '#ffffff', fontWeight: '600' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>

          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredView: {
    width: '90%',
    maxWidth: 380,
  },
  modalView: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 14,
  },
  arrowButton: {
    padding: 8,
    borderRadius: 8,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  daysOfWeekContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayOfWeekLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 9999,
  },
  dayCellEmpty: {
    width: '14.28%',
    aspectRatio: 1,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary[600],
  },
  dayCellToday: {
    borderWidth: 1.5,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  footerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  monthGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  monthGridCell: {
    width: '30%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  monthGridText: {
    fontSize: 13,
    fontWeight: '600',
  },
  yearSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    borderRadius: 8,
    paddingVertical: 4,
  },
  yearLabel: {
    fontSize: 15,
    fontWeight: '800',
    marginHorizontal: 16,
  },
});
