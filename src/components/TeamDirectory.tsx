import { useEffect, useState } from 'react';
import { t, type Lang } from '../i18n/strings';
import { useIdentity } from '../data/use-identity';
import { can, rolesOf } from '../data/roles';
import { saveErrorMessage, listStaff } from '../data/repo';
import { clearLegacyPresets, loadLegacyPresets, type LegacyPreset } from '../data/admin-prefs';
import { loadDirectory, newMemberId, saveDirectory, useStaff, type TeamMember } from '../data/team-directory';
import { linkProjectTeams } from '../data/project-file-edit';
import AccessNotice from './AccessNotice';
import StaffAccountSelect from './StaffAccountSelect';

type Props = {
  lang: Lang;
  /** Localized base, e.g. "/ar" */
  basePath: string;
  /** Every project at build time, for "Link existing project teams" */
  projectIds: string[];
};

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; sha: string | null };
type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

const emptyMember = (): TeamMember => ({ id: newMemberId(), name: { ar: '', en: '' }, role: { ar: '', en: '' }, phone: '' });

/**
 * /{lang}/admin/team/ — the shared team directory. Project managers and
 * administrators add, edit and remove members and link each to an account;
 * the project editor's "Add from team directory" copies them into a project.
 */
export default function TeamDirectory({ lang, basePath, projectIds }: Props) {
  const identity = useIdentity();
  const user = identity.kind === 'authenticated' ? identity.user : null;
  const allowed = !!user && can(user, 'edit-projects');
  const isAdmin = !!user && rolesOf(user).includes('admin');

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [nonce, setNonce] = useState(0);
  const [save, setSave] = useState<Status>({ kind: 'idle' });
  const [dirty, setDirty] = useState(false);
  const [legacy, setLegacy] = useState<LegacyPreset[]>([]);
  const [move, setMove] = useState<Status>({ kind: 'idle' });
  const [migrate, setMigrate] = useState<Status>({ kind: 'idle' });
  const { state: staff, reload: reloadStaff } = useStaff(lang, allowed);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoad({ kind: 'loading' });
    loadDirectory().then(
      (d) => { if (!cancelled) { setMembers(d.members); setLoad({ kind: 'ready', sha: d.sha }); setDirty(false); } },
      () => { if (!cancelled) setLoad({ kind: 'error' }); },
    );
    return () => { cancelled = true; };
  }, [allowed, nonce]);

  useEffect(() => {
    if (allowed && user) setLegacy(loadLegacyPresets(user.email));
  }, [allowed, user?.email]);

  if (identity.kind === 'loading') return <AccessNotice lang={lang} state="loading" />;
  if (identity.kind === 'anonymous') return <AccessNotice lang={lang} state="signed-out" roles={['admin', 'project-manager']} />;
  if (!allowed) return <AccessNotice lang={lang} state="no-access" roles={['admin', 'project-manager']} />;

  const edit = (i: number, patch: Partial<TeamMember>) => {
    setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
    setDirty(true);
  };

  const message = (what: string) => (lang === 'ar' ? `دليل الفريق: ${what}` : `Team directory: ${what}`);

  const handleSave = async () => {
    if (load.kind !== 'ready') return;
    setSave({ kind: 'busy' });
    try {
      const sha = await saveDirectory(members, load.sha, message(lang === 'ar' ? 'تحديث' : 'update'));
      setLoad({ kind: 'ready', sha });
      setDirty(false);
      setSave({ kind: 'ok', text: t(lang, 'team_saved') });
    } catch (err) {
      setSave({ kind: 'error', text: saveErrorMessage(err, lang) });
    }
  };

  // One-time: move this browser's old "Engineer presets" into the shared file.
  const handleMove = async () => {
    setMove({ kind: 'busy' });
    try {
      const live = await loadDirectory(); // start from the latest, not unsaved edits
      const added: TeamMember[] = legacy.map((p) => ({ id: newMemberId(), name: p.name, role: p.role, ...(p.phone ? { phone: p.phone } : {}) }));
      const next = [...live.members, ...added];
      const sha = await saveDirectory(next, live.sha, message(lang === 'ar' ? 'نقل القوالب المحفوظة' : 'move saved presets'));
      clearLegacyPresets(user!.email);
      setMembers(dirty ? [...members, ...added] : next);
      setLoad({ kind: 'ready', sha });
      setLegacy([]);
      setMove({ kind: 'ok', text: t(lang, 'team_moved_presets', { n: added.length }) });
    } catch (err) {
      setMove({ kind: 'error', text: saveErrorMessage(err, lang) });
    }
  };

  // Admin, one-time: link every team entry saved with an email to its account.
  const handleMigrate = async () => {
    if (!window.confirm(t(lang, 'team_link_confirm'))) return;
    setMigrate({ kind: 'busy' });
    try {
      const r = await linkProjectTeams({
        projectIds,
        resolve: async (emails) => (await listStaff(lang, emails)).matches,
        message: lang === 'ar' ? 'ربط فرق المشاريع بحسابات الفريق' : 'Link project teams to staff accounts',
      });
      if (r.projects === 0) { setMigrate({ kind: 'ok', text: t(lang, 'team_link_nothing') }); return; }
      const text = [
        t(lang, 'team_link_done', { linked: r.linked, projects: r.projects }),
        r.unmatched ? t(lang, 'team_link_unmatched', { n: r.unmatched }) : '',
      ].filter(Boolean).join(' ');
      setMigrate({ kind: 'ok', text });
    } catch (err: any) {
      if (err?.message === 'TOO_MANY') { setMigrate({ kind: 'error', text: t(lang, 'team_link_too_many') }); return; }
      const text = err?.code === 'STAFF_UNAVAILABLE' ? t(lang, 'staff_load_error') : saveErrorMessage(err, lang);
      setMigrate({ kind: 'error', text });
    }
  };

  const statusLine = (s: Status) => (s.kind === 'ok'
    ? <p className="team-status team-status-ok" role="status">✓ {s.text}</p>
    : s.kind === 'error' ? <p className="team-status team-status-error" role="alert">⚠ {s.text}</p> : null);

  return (
    <section className="editor-section team-directory">
      <div className="editor-save-bar">
        <div className="editor-save-bar-left">
          <a href={`${basePath}/projects/`} className="editor-back-link">{t(lang, 'team_dir_back')}</a>
          <span className="editor-title-preview">{t(lang, 'team_dir_title')}</span>
        </div>
        <div className="editor-save-bar-right">
          <button
            type="button"
            className="editor-save-btn"
            onClick={handleSave}
            disabled={load.kind !== 'ready' || save.kind === 'busy' || !dirty}
          >
            {save.kind === 'busy' ? t(lang, 'team_saving') : t(lang, 'team_save')}
          </button>
        </div>
        {save.kind === 'error' && <div className="editor-save-error">⚠ {save.text}</div>}
      </div>

      <p className="team-intro">{t(lang, 'team_dir_desc')}</p>
      {save.kind === 'ok' && statusLine(save)}

      {legacy.length > 0 && (
        <div className="editor-card team-notice">
          <p>{t(lang, 'team_move_presets_hint', { n: legacy.length })}</p>
          <button type="button" className="btn-primary" onClick={handleMove} disabled={move.kind === 'busy' || load.kind !== 'ready'}>
            {move.kind === 'busy' ? t(lang, 'team_saving') : t(lang, 'team_move_presets')}
          </button>
          {statusLine(move)}
        </div>
      )}
      {legacy.length === 0 && move.kind === 'ok' && statusLine(move)}

      {staff.kind === 'error' && (
        <div className="team-account-error" role="alert">
          <span>{t(lang, 'staff_load_error')}</span>
          <button type="button" className="team-link-btn" onClick={reloadStaff}>{t(lang, 'team_retry')}</button>
        </div>
      )}

      {load.kind === 'loading' && <p className="editor-empty-note">{t(lang, 'team_loading')}</p>}
      {load.kind === 'error' && (
        <div className="team-account-error" role="alert">
          <span>{t(lang, 'team_load_error')}</span>
          <button type="button" className="team-link-btn" onClick={() => setNonce((n) => n + 1)}>{t(lang, 'team_retry')}</button>
        </div>
      )}

      {load.kind === 'ready' && (
        <div className="editor-card">
          {members.length === 0 && <p className="editor-empty-note">{t(lang, 'team_empty')}</p>}
          {members.map((m, i) => (
            <div key={m.id} className="editor-list-item">
              <div className="editor-list-item-head">
                <Pair label={t(lang, 'team_name')} value={m.name} onChange={(name) => edit(i, { name })} />
                <button
                  type="button"
                  className="editor-remove-btn"
                  onClick={() => { setMembers((ms) => ms.filter((_, j) => j !== i)); setDirty(true); }}
                  aria-label={t(lang, 'team_remove')}
                  title={t(lang, 'team_remove')}
                >
                  ✕
                </button>
              </div>
              <Pair label={t(lang, 'team_role')} value={m.role} onChange={(role) => edit(i, { role })} />
              <div className="editor-row">
                <div className="editor-field editor-field-half">
                  <StaffAccountSelect
                    lang={lang}
                    staff={staff}
                    onRetry={reloadStaff}
                    value={m.userId}
                    onChange={(userId) => {
                      const { userId: _old, ...rest } = m;
                      setMembers((ms) => ms.map((x, j) => (j === i ? (userId ? { ...rest, userId } : rest) : x)));
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="editor-field editor-field-half">
                  <label>{t(lang, 'team_phone')}</label>
                  <input
                    type="tel"
                    className="editor-text-input"
                    dir="ltr"
                    value={m.phone || ''}
                    onChange={(e) => edit(i, { phone: e.target.value })}
                  />
                  <p className="editor-field-hint">{t(lang, 'team_phone_hint')}</p>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="editor-add-btn"
            onClick={() => { setMembers((ms) => [...ms, emptyMember()]); setDirty(true); }}
          >
            + {t(lang, 'team_add_member')}
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="editor-card team-notice">
          <h3 className="editor-card-title">{t(lang, 'team_link_projects')}</h3>
          <p className="editor-field-hint">{t(lang, 'team_link_projects_hint')}</p>
          <button type="button" className="btn-secondary" onClick={handleMigrate} disabled={migrate.kind === 'busy'}>
            {migrate.kind === 'busy' ? t(lang, 'team_link_running') : t(lang, 'team_link_projects')}
          </button>
          {statusLine(migrate)}
        </div>
      )}
    </section>
  );
}

/** Arabic + English inputs for one bilingual field. */
function Pair({ label, value, onChange }: {
  label: string;
  value: { ar: string; en: string };
  onChange: (v: { ar: string; en: string }) => void;
}) {
  return (
    <div className="editor-field">
      <label>{label}</label>
      <div className="editor-bilingual-row">
        <div className="editor-bilingual-col">
          <span className="editor-bilingual-flag">★ AR</span>
          <input type="text" className="editor-text-input" dir="rtl" value={value.ar}
            onChange={(e) => onChange({ ...value, ar: e.target.value })} />
        </div>
        <div className="editor-bilingual-col">
          <span className="editor-bilingual-flag">EN</span>
          <input type="text" className="editor-text-input" dir="ltr" value={value.en}
            onChange={(e) => onChange({ ...value, en: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
