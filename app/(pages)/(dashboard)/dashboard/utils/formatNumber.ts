/**
 * Format number with thousand separators
 * @param num - Number to format
 * @param locale - Locale for formatting (default: 'en-IN')
 * @returns Formatted number string
 */
export function formatNumber(num: number | string, locale: string = 'en-IN'): string {
  const numValue = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(numValue)) return String(num);
  return new Intl.NumberFormat(locale).format(numValue);
}

