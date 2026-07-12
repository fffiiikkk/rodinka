import {
  format, formatRelative, isToday, isTomorrow, isThisWeek,
  parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, addWeeks, addDays, eachDayOfInterval,
} from 'date-fns';
import { cs, enGB } from 'date-fns/locale';

const PRAGUE_TZ = 'Europe/Prague';

export function getLocale(lang: string) {
  return lang === 'en' ? enGB : cs;
}

export function formatDate(date: Date | string, lang = 'cs', fmt = 'd. MMMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt, { locale: getLocale(lang) });
}

export function formatTime(date: Date | string, lang = 'cs'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm', { locale: getLocale(lang) });
}

export function formatDateTime(date: Date | string, lang = 'cs'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd. M. HH:mm', { locale: getLocale(lang) });
}

export function formatRelativeDate(date: Date | string, lang = 'cs'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isToday(d)) return lang === 'cs' ? 'Dnes' : 'Today';
  if (isTomorrow(d)) return lang === 'cs' ? 'Zítra' : 'Tomorrow';
  if (isThisWeek(d)) return format(d, 'EEEE', { locale: getLocale(lang) });
  return formatDate(d, lang);
}

export function monthRange(date: Date) {
  return {
    from: startOfMonth(date),
    to: endOfMonth(date),
  };
}

export function weekRange(date: Date) {
  return {
    from: startOfWeek(date, { weekStartsOn: 1 }),
    to: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export { addMonths, addWeeks, addDays, eachDayOfInterval, parseISO, isToday, format };
