import { Timestamp } from 'firebase/firestore';
import { TagTone } from '../types/systemOne';

export function formatFirestoreTimestamp(value: unknown): string {
  if (!value) return 'Just now';
  try {
    if (value instanceof Timestamp) {
      return formatDateObj(value.toDate());
    }
    if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return formatDateObj((value as { toDate: () => Date }).toDate());
    }
    if (value instanceof Date) {
      return formatDateObj(value);
    }
  } catch {
    return 'Recent';
  }
  return 'Recent';
}

function formatDateObj(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function getTagButtonClasses(tone: TagTone, active: boolean): string {
  if (!active) {
    return 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
  }
  switch (tone) {
    case 'sky':
      return 'bg-sky-50 border-sky-600 text-sky-900';
    case 'emerald':
      return 'bg-emerald-50 border-emerald-600 text-emerald-900';
    case 'amber':
      return 'bg-amber-50 border-amber-600 text-amber-900';
    case 'indigo':
      return 'bg-indigo-50 border-indigo-600 text-indigo-900';
    default:
      return 'bg-slate-100 border-slate-700 text-slate-900';
  }
}

export function getToneAccentDot(tone: TagTone): string {
  switch (tone) {
    case 'sky':
      return 'bg-sky-600';
    case 'emerald':
      return 'bg-emerald-600';
    case 'amber':
      return 'bg-amber-600';
    case 'indigo':
      return 'bg-indigo-600';
    default:
      return 'bg-slate-600';
  }
}
