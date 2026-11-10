import type { MessageKey } from '@/features/i18n';
import type { CalendarColorId } from './tokens';

/** The spoken name of each palette colour (a swatch is a colour only; its name is its label). */
export const COLOR_NAMES: Record<CalendarColorId, MessageKey> = {
  blue: 'colorBlue',
  red: 'colorRed',
  green: 'colorGreen',
  amber: 'colorAmber',
  purple: 'colorPurple',
  teal: 'colorTeal',
  pink: 'colorPink',
  gray: 'colorGray',
};
