import { useT } from '@/features/i18n';
import { calendarColorVars } from '@/ui/theme/calendarColor';
import { COLOR_NAMES } from '@/ui/theme/colorNames';
import { CALENDAR_COLOR_IDS } from '@/ui/theme/tokens';

export interface EventColorProps {
  /** The event's own colour (palette id or `#rrggbb`), or `undefined` to follow its calendar. */
  readonly value: string | undefined;
  /** The calendar's colour: what "no colour of its own" looks like. */
  readonly calendarColor: string;
  readonly onChange: (color: string | undefined) => void;
}

/** One colour for this event only; the first swatch hands it back to its calendar's (D-132). */
export function EventColor({ value, calendarColor, onChange }: EventColorProps) {
  const t = useT();
  const isCustom = value !== undefined && /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <fieldset className="ed-group">
      <legend>{t('eventColor')}</legend>
      <div className="swatches" role="radiogroup" aria-label={t('eventColor')}>
        <button
          type="button"
          role="radio"
          aria-checked={value === undefined}
          aria-label={t('eventColorDefault')}
          className="swatch"
          style={{ background: calendarColorVars(calendarColor).bar }}
          onClick={() => onChange(undefined)}
        />
        {CALENDAR_COLOR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            aria-label={t(COLOR_NAMES[id])}
            className="swatch"
            style={{ background: calendarColorVars(id).bar }}
            onClick={() => onChange(id)}
          />
        ))}
        <label
          className="swatch swatch-custom"
          data-checked={isCustom}
          style={isCustom ? { background: value } : undefined}
        >
          <input
            type="color"
            aria-label={t('colorCustom')}
            value={isCustom ? value : '#3b82f6'}
            onChange={(e) => onChange(e.currentTarget.value.toLowerCase())}
          />
        </label>
      </div>
    </fieldset>
  );
}
