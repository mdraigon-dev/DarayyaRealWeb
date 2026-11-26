import { t, type Lang } from '../i18n/strings';
import { ROLE_LABELS, type Role } from '../data/roles';
import type { StaffState } from '../data/team-directory';

type Props = {
  lang: Lang;
  staff: StaffState;
  onRetry: () => void;
  value?: string;
  onChange: (userId: string | undefined) => void;
  /** Shown when the entry is still matched by a legacy email (no userId yet). */
  legacy?: boolean;
};

/**
 * "Linked account" dropdown for a team entry. Lists engineers and project
 * managers by name and role only; emails are never sent to the browser.
 */
export default function StaffAccountSelect({ lang, staff, onRetry, value, onChange, legacy }: Props) {
  const roleText = (roles: string[]) =>
    roles.map((r) => ROLE_LABELS[r as Role]?.[lang] ?? r).join(lang === 'ar' ? '، ' : ', ');

  return (
    <div className="editor-field team-account-field">
      <label>{t(lang, 'team_linked_account')}</label>
      {staff.kind === 'error' ? (
        <div className="team-account-error" role="alert">
          <span>{t(lang, 'staff_load_error')}</span>
          <button type="button" className="team-link-btn" onClick={onRetry}>{t(lang, 'team_retry')}</button>
        </div>
      ) : (
        <select
          className="editor-text-input"
          value={value || ''}
          disabled={staff.kind !== 'ready'}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          {staff.kind !== 'ready' ? (
            <option value={value || ''}>{t(lang, 'team_staff_loading')}</option>
          ) : (
            <>
              <option value="">{t(lang, 'team_not_linked')}</option>
              {value && !staff.staff.some((s) => s.id === value) && (
                <option value={value}>{t(lang, 'team_account_missing')}</option>
              )}
              {staff.staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {roleText(s.roles)}</option>
              ))}
            </>
          )}
        </select>
      )}
      <p className="editor-field-hint">{legacy && !value ? t(lang, 'team_legacy_link') : t(lang, 'team_linked_hint')}</p>
    </div>
  );
}
