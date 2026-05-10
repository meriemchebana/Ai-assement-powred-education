import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { profileAPI, subjectsAPI } from '../api/client';
import AppSidebar from '../components/AppSidebar';

const TEACHING_LEVELS = ['L1','L2','L3','M1','M2','Doctorat','BTS','Prépa','Terminale'];
const TEACHING_PROFILE_KEY = 'exam_teaching_profile';

const POSITIONS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Lecturer',
  'Teaching Assistant',
  'Researcher',
  'Department Head',
  'Other',
];

const generateId = () => Math.random().toString(36).slice(2);

const loadContexts = () => {
  try { return JSON.parse(localStorage.getItem(TEACHING_PROFILE_KEY) || '{}').contexts || []; }
  catch { return []; }
};

const saveContexts = (ctxs) =>
  localStorage.setItem(TEACHING_PROFILE_KEY, JSON.stringify({ contexts: ctxs }));

/* ── Empty context template ── */
const emptyCtx = () => ({
  id: generateId(),
  institution: '',
  faculty: '',
  speciality: '',
  levels: [],
  subjects: [],
  academic_year: '',
  session: '',
});

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { addToast }      = useToast();
  const navigate          = useNavigate();
  const fileRef           = useRef(null);
  const { t }             = useTranslation();

  const [stats, setStats] = useState({ subjects: 0, exams: 0 });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', avatar: null,
    institution: '', department: '', position: '', phone: '', bio: '',
  });

  /* ── Teaching contexts state ── */
  const [contexts, setContexts] = useState(() => loadContexts());
  const [editingCtxId, setEditingCtxId] = useState(null); // id | 'new' | null
  const [ctxDraft, setCtxDraft] = useState(null);         // draft for inline form
  const [ctxTagInput, setCtxTagInput] = useState('');

  // Sync form whenever user object changes
  useEffect(() => {
    if (!user) return;
    setForm({
      first_name:  user.first_name  || '',
      last_name:   user.last_name   || '',
      avatar:      user.avatar      || null,
      institution: user.institution || '',
      department:  user.department  || '',
      position:    user.position    || '',
      phone:       user.phone       || '',
      bio:         user.bio         || '',
    });
  }, [user]);

  // Auto-save contexts to localStorage whenever they change
  useEffect(() => {
    saveContexts(contexts);
  }, [contexts]);

  useEffect(() => {
    subjectsAPI.getAll().then(subjects => {
      const totalExams = subjects.reduce((a, s) => a + (s.exam_count || 0), 0);
      setStats({ subjects: subjects.length, exams: totalExams });
    }).catch(() => {});
  }, []);

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { addToast('Image must be under 1MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, avatar: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await profileAPI.update({
        first_name:  form.first_name  || null,
        last_name:   form.last_name   || null,
        avatar:      form.avatar      || null,
        institution: form.institution || null,
        department:  form.department  || null,
        position:    form.position    || null,
        phone:       form.phone       || null,
        bio:         form.bio         || null,
      });
      setUser(updated);
      addToast(t('profile.profileUpdated'), 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Context editing helpers ── */
  const openAddCtx = () => {
    setCtxDraft(emptyCtx());
    setEditingCtxId('new');
    setCtxTagInput('');
  };

  const openEditCtx = (ctx) => {
    setCtxDraft({ ...ctx, levels: [...ctx.levels], subjects: [...ctx.subjects] });
    setEditingCtxId(ctx.id);
    setCtxTagInput('');
  };

  const cancelCtxEdit = () => {
    setEditingCtxId(null);
    setCtxDraft(null);
    setCtxTagInput('');
  };

  const saveCtxEdit = () => {
    if (!ctxDraft) return;
    if (editingCtxId === 'new') {
      setContexts(prev => [...prev, ctxDraft]);
    } else {
      setContexts(prev => prev.map(c => c.id === editingCtxId ? ctxDraft : c));
    }
    setEditingCtxId(null);
    setCtxDraft(null);
    setCtxTagInput('');
  };

  const deleteCtx = (id) => setContexts(prev => prev.filter(c => c.id !== id));

  const setDraftField = (key, val) => setCtxDraft(d => ({ ...d, [key]: val }));

  const toggleDraftLevel = (level) => setCtxDraft(d => ({
    ...d,
    levels: d.levels.includes(level) ? d.levels.filter(l => l !== level) : [...d.levels, level],
  }));

  const addDraftSubject = (val) => {
    const tag = val.trim().replace(/,$/, '').trim();
    if (tag && ctxDraft && !ctxDraft.subjects.includes(tag)) {
      setDraftField('subjects', [...ctxDraft.subjects, tag]);
    }
    setCtxTagInput('');
  };

  const removeDraftSubject = (tag) =>
    setDraftField('subjects', ctxDraft.subjects.filter(s => s !== tag));

  const initials = `${form.first_name?.[0] || ''}${form.last_name?.[0] || ''}`.toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex">

      <AppSidebar active="profile" />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-10">
        <div className="max-w-4xl mx-auto">

          {/* ── HERO CARD ── */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-light-primary to-blue-500 dark:from-blue-700 dark:to-dark-bg shadow-2xl mb-10 p-8 md:p-10">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <button onClick={() => fileRef.current?.click()}
                  className="w-28 h-28 md:w-32 md:h-32 rounded-3xl overflow-hidden border-4 border-white/30 shadow-2xl hover:border-white/60 transition-colors group">
                  {form.avatar
                    ? <img src={form.avatar} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-white/20 flex items-center justify-center text-white font-extrabold text-4xl backdrop-blur-sm">
                        {initials}
                      </div>
                  }
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
              </div>

              {/* Name & info */}
              <div className="text-white text-center md:text-left flex-1">
                <p className="text-[11px] font-mono uppercase tracking-[2px] text-white/60 mb-1">Teacher Profile</p>
                <h2 className="text-3xl md:text-4xl font-extrabold leading-tight mb-2">
                  {form.first_name || user?.first_name} {form.last_name || user?.last_name}
                </h2>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {form.position && (
                    <span className="text-xs bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 font-medium">
                      {form.position}
                    </span>
                  )}
                  {form.department && (
                    <span className="text-xs bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 font-medium">
                      {form.department}
                    </span>
                  )}
                  {form.institution && (
                    <span className="text-xs bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 font-medium">
                      🏛 {form.institution}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 md:flex-col md:gap-3 md:text-right">
                <div className="text-center md:text-right">
                  <p className="text-3xl font-extrabold text-white">{stats.subjects}</p>
                  <p className="text-[11px] text-white/60 font-medium uppercase tracking-wide">Subjects</p>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-3xl font-extrabold text-white">{stats.exams}</p>
                  <p className="text-[11px] text-white/60 font-medium uppercase tracking-wide">Exams</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── FORM ── */}
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Personal Info ── */}
            <div className="glass-card p-6 relative overflow-hidden md:col-span-2">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary" />
              <h3 className="text-base font-extrabold text-light-text dark:text-white mb-5 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-light-primary/10 dark:bg-dark-primary/20 flex items-center justify-center text-light-primary dark:text-sky-300 text-sm">👤</span>
                Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label={t('profile.firstName')}>
                  <input value={form.first_name} onChange={e => setForm(f => ({...f, first_name: e.target.value}))}
                    required className="input-field" placeholder="Meriem" />
                </FormField>
                <FormField label={t('profile.lastName')}>
                  <input value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))}
                    required className="input-field" placeholder="Doe" />
                </FormField>
                <FormField label={t('profile.email')}>
                  <input value={user?.email || ''} readOnly
                    className="input-field opacity-60 cursor-not-allowed" />
                </FormField>
                <FormField label={t('profile.phone')}>
                  <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                    className="input-field" placeholder="+213 6xx xxx xxx" type="tel" />
                </FormField>
              </div>
            </div>

            {/* ── Professional Info ── */}
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-light-primary to-blue-400 dark:from-blue-400 dark:to-blue-500" />
              <h3 className="text-base font-extrabold text-light-text dark:text-white mb-5 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-light-primary/10 dark:bg-blue-500/10 flex items-center justify-center text-sm">🏛</span>
                Professional Info
              </h3>
              <div className="space-y-4">
                <FormField label={t('profile.institution')}>
                  <input value={form.institution} onChange={e => setForm(f => ({...f, institution: e.target.value}))}
                    className="input-field" placeholder="e.g. University of Algiers" />
                </FormField>
                <FormField label={t('profile.department')}>
                  <input value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))}
                    className="input-field" placeholder="e.g. Computer Science" />
                </FormField>
                <FormField label={t('profile.position')}>
                  <select value={form.position} onChange={e => setForm(f => ({...f, position: e.target.value}))}
                    className="input-field">
                    <option value="">Select position…</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </FormField>
              </div>
            </div>

            {/* ── Bio ── */}
            <div className="glass-card p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <h3 className="text-base font-extrabold text-light-text dark:text-white mb-5 flex items-center gap-2">
                <span className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <img src="/image/file-edit_114433.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                </span>
                About Me
              </h3>
              <FormField label={t('profile.bio')}>
                <textarea value={form.bio} onChange={e => setForm(f => ({...f, bio: e.target.value}))}
                  className="input-field resize-none leading-relaxed" rows={7}
                  placeholder="Describe your teaching experience, research interests, and expertise…" />
              </FormField>
            </div>

            {/* ── Teaching Contexts ── */}
            <div className="glass-card p-6 relative overflow-hidden md:col-span-2">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-teal-500" />

              {/* Card Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-extrabold text-light-text dark:text-white flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-sm">📚</span>
                  Contextes d'enseignement
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                    {contexts.length}
                  </span>
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 px-2 py-0.5 rounded-md">
                    saved locally ·
                  </span>
                  {editingCtxId !== 'new' && (
                    <button type="button" onClick={openAddCtx}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Ajouter
                    </button>
                  )}
                </div>
              </div>

              {/* Context list */}
              <div className="space-y-3">
                {contexts.length === 0 && editingCtxId !== 'new' && (
                  <p className="text-[12px] text-gray-400 dark:text-white/30 font-mono text-center py-6 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                    Aucun contexte d'enseignement. Cliquez sur "Ajouter" pour commencer.
                  </p>
                )}

                {contexts.map(ctx => (
                  <div key={ctx.id}>
                    {/* Context row */}
                    {editingCtxId !== ctx.id && (
                      <div className="group flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] hover:border-blue-200 dark:hover:border-blue-500/25 hover:bg-blue-50/40 dark:hover:bg-blue-500/5 transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-[13px] font-bold text-gray-800 dark:text-white truncate">
                              {ctx.institution || <span className="italic text-gray-400 dark:text-white/30">Sans établissement</span>}
                            </span>
                            {ctx.faculty && (
                              <span className="text-[11px] text-gray-500 dark:text-white/65 truncate">· {ctx.faculty}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ctx.levels.map(l => (
                              <span key={l} className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-semibold border border-teal-200 dark:border-teal-500/30">
                                {l}
                              </span>
                            ))}
                            {ctx.subjects.map(s => (
                              <span key={s} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-white/50 text-[10px] font-medium border border-gray-200 dark:border-white/10">
                                {s}
                              </span>
                            ))}
                            {ctx.academic_year && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono border border-blue-100 dark:border-blue-500/20">
                                {ctx.academic_year}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Action buttons — visible on hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                          <button type="button" onClick={() => openEditCtx(ctx)} title="Modifier"
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button type="button" onClick={() => deleteCtx(ctx.id)} title="Supprimer"
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline edit form for this context */}
                    {editingCtxId === ctx.id && ctxDraft && (
                      <ContextForm
                        draft={ctxDraft}
                        tagInput={ctxTagInput}
                        setTagInput={setCtxTagInput}
                        onFieldChange={setDraftField}
                        onToggleLevel={toggleDraftLevel}
                        onAddSubject={addDraftSubject}
                        onRemoveSubject={removeDraftSubject}
                        onSave={saveCtxEdit}
                        onCancel={cancelCtxEdit}
                        isNew={false}
                      />
                    )}
                  </div>
                ))}

                {/* Inline "new" form */}
                {editingCtxId === 'new' && ctxDraft && (
                  <ContextForm
                    draft={ctxDraft}
                    tagInput={ctxTagInput}
                    setTagInput={setCtxTagInput}
                    onFieldChange={setDraftField}
                    onToggleLevel={toggleDraftLevel}
                    onAddSubject={addDraftSubject}
                    onRemoveSubject={removeDraftSubject}
                    onSave={saveCtxEdit}
                    onCancel={cancelCtxEdit}
                    isNew={true}
                  />
                )}
              </div>
            </div>

            {/* ── Save button ── */}
            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <Link to="/subjects" className="btn-secondary px-8 py-3" style={{ textDecoration:'none' }}>
                {t('profile.cancel')}
              </Link>
              <button type="submit" disabled={saving}
                className={`btn-primary px-10 py-3 flex items-center gap-2 ${saving ? 'opacity-70 cursor-default' : ''}`}>
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('profile.save')}…</>
                  : <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      {t('profile.save')}
                    </>
                }
              </button>
            </div>

          </form>

          {/* ── Change Password ── */}
          <ChangePasswordSection addToast={addToast} />

        </div>
      </main>
    </div>
  );
}

/* ── ChangePasswordSection ──────────────────────────────────────────────── */
function ChangePasswordSection({ addToast }) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm)
      return addToast('كلمتا المرور الجديدتان غير متطابقتين', 'error');
    if (form.next.length < 6)
      return addToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
    setSaving(true);
    try {
      await profileAPI.changePassword(form.current, form.next);
      addToast(t('profile.passwordUpdated'), 'success');
      setForm({ current: '', next: '', confirm: '' });
      setOpen(false);
    } catch (err) {
      addToast(err.message || t('profile.wrongPassword'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden mt-6">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <span className="font-semibold text-sm text-light-text dark:text-white">{t('profile.changePassword')}</span>
        </div>
        <span style={{ transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: 'rgba(148,163,184,0.6)', fontSize: 13 }}>▾</span>
      </button>

      {/* Collapsible body */}
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.3s ease',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 flex flex-col gap-4" style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
            <PwField label={t('profile.currentPassword')} value={form.current} onChange={set('current')} show={showCur} onToggle={() => setShowCur(v=>!v)} />
            <PwField label={t('profile.newPassword')}     value={form.next}    onChange={set('next')}    show={showNew} onToggle={() => setShowNew(v=>!v)} />
            <PwField label={t('profile.newPassword')}     value={form.confirm} onChange={set('confirm')} show={showCon} onToggle={() => setShowCon(v=>!v)} />
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setOpen(false)}
                className="btn-secondary px-6 py-2.5 text-sm">{t('profile.cancel')}</button>
              <button type="submit" disabled={saving}
                className={`btn-primary px-8 py-2.5 text-sm flex items-center gap-2 ${saving ? 'opacity-70 cursor-default' : ''}`}>
                {saving ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>{t('profile.save')}…</> : t('profile.updatePassword')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function PwField({ label, value, onChange, show, onToggle }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-light-muted dark:text-dark-muted uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
          className="input-field w-full pr-10"
          placeholder="••••••••"
        />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.6)', display: 'flex' }}>
          {show
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

/* ── ContextForm — inline form for add/edit ─────────────────────────────── */
function ContextForm({ draft, tagInput, setTagInput, onFieldChange, onToggleLevel, onAddSubject, onRemoveSubject, onSave, onCancel, isNew }) {
  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); onAddSubject(tagInput); }
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5 p-4 space-y-4">
      <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">
        {isNew ? 'Nouveau contexte' : 'Modifier le contexte'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 dark:text-white/65 uppercase tracking-wider mb-1.5">Institution</label>
          <input value={draft.institution} onChange={e => onFieldChange('institution', e.target.value)}
            placeholder="ex. Université d'Alger 1"
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[12px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 dark:text-white/65 uppercase tracking-wider mb-1.5">Faculté / Département</label>
          <input value={draft.faculty} onChange={e => onFieldChange('faculty', e.target.value)}
            placeholder="ex. Faculté d'Informatique"
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[12px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 dark:text-white/65 uppercase tracking-wider mb-1.5">Spécialité</label>
          <input value={draft.speciality} onChange={e => onFieldChange('speciality', e.target.value)}
            placeholder="ex. Génie logiciel"
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[12px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 dark:text-white/65 uppercase tracking-wider mb-1.5">Année académique</label>
          <input value={draft.academic_year} onChange={e => onFieldChange('academic_year', e.target.value)}
            placeholder="2024/2025"
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[12px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 dark:text-white/65 uppercase tracking-wider mb-1.5">Session par défaut</label>
          <input value={draft.session} onChange={e => onFieldChange('session', e.target.value)}
            placeholder="S1"
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[12px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all" />
        </div>
      </div>

      {/* Levels */}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 dark:text-white/65 uppercase tracking-wider mb-2">Niveaux</label>
        <div className="flex flex-wrap gap-1.5">
          {TEACHING_LEVELS.map(level => (
            <button type="button" key={level} onClick={() => onToggleLevel(level)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all
                ${draft.levels.includes(level)
                  ? 'bg-teal-500 border-teal-500 text-white dark:bg-teal-500 dark:border-teal-400'
                  : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/65 hover:border-teal-300 dark:hover:border-teal-500/40 hover:text-teal-700 dark:hover:text-teal-300'}`}>
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Subjects tag input */}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 dark:text-white/65 uppercase tracking-wider mb-2">Matières</label>
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 focus-within:border-blue-400 dark:focus-within:border-blue-500/50 transition-all min-h-[44px]">
          {draft.subjects.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-700 dark:text-white/60 text-[11px] font-semibold border border-gray-200 dark:border-white/10">
              {tag}
              <button type="button" onClick={() => onRemoveSubject(tag)}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-gray-300 dark:hover:bg-white/20 transition-colors">
                <svg width="6" height="6" viewBox="0 0 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="5" y2="5"/><line x1="5" y1="1" x2="1" y2="5"/></svg>
              </button>
            </span>
          ))}
          <input value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => { if (tagInput.trim()) onAddSubject(tagInput); }}
            placeholder={draft.subjects.length === 0 ? 'Tapez une matière + Entrée…' : ''}
            className="flex-1 min-w-[140px] bg-transparent border-none outline-none text-[12px] text-gray-700 dark:text-white placeholder-gray-300 dark:placeholder-white/20 py-0.5" />
        </div>
      </div>

      {/* Inline form footer */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/65 text-[12px] font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
          Annuler
        </button>
        <button type="button" onClick={onSave}
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold transition-all shadow-sm">
          Enregistrer
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-light-muted dark:text-dark-muted uppercase tracking-wider mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
