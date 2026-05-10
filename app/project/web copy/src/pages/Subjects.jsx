import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { subjectsAPI } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import AppSidebar from '../components/AppSidebar';

/* ── subject image map ── */
function subjectImg(name = '') {
  const n = name.toLowerCase();
  if (n.includes('algo'))                           return 'https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?auto=format&fit=crop&w=800&q=80';
  if (n.includes('law') || n.includes('droit'))    return 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80';
  if (n.includes('commerce') || n.includes('busi'))return 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80';
  if (n.includes('se') || n.includes('software'))  return 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80';
  if (n.includes('compil'))                        return 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=800&q=80';
  if (n.includes('data') || n.includes('base'))    return 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80';
  if (n.includes('math'))                          return 'https://images.unsplash.com/photo-1596496050827-8299e0220de1?auto=format&fit=crop&w=800&q=80';
  if (n.includes('ml') || n.includes('ai'))        return 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?auto=format&fit=crop&w=800&q=80';
  return 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80';
}

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1596496050827-8299e0220de1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
  // science
  'https://images.unsplash.com/photo-1564325724739-bae0bd08762c?auto=format&fit=crop&w=800&q=80',
  // history
  'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=800&q=80',
  // art
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=800&q=80',
  // engineering
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
  // languages
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
  // health
  'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80',
];

const ICONS = [
  'laptop_computer_study_technology_learning_icon_255783.png',
  'book_education_school_learning_study_icon_196573.png',
  'calculator_study_finance_school_math_accounting_icon_255789.png',
  'chemistry_structure_icon_125485.png',
  'bag_education_atom_school_study_learning_icon_232844.png',
  'profit_analytics_increase_chart_data_study_icon_143883.png',
  'civil_engineering_study_education_occupation_job_builder_contractor_worker_construction_icon_219096.png',
];

export default function Subjects() {
  const [subjects, setSubjects]       = useState([]);
  const [images, setImages]           = useState({});
  const [icons, setIcons]             = useState({});
  const [form, setForm]               = useState({ name:'', description:'' });
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [deletingId, setDeletingId]   = useState(null);
  const [editingId, setEditingId]     = useState(null);
  const [editName, setEditName]       = useState('');
  const [pickerOpen, setPickerOpen]   = useState(null); // subject id
  const [searchQuery, setSearchQuery] = useState('');
  const { addToast } = useToast();
  const { t } = useTranslation();

  const filteredSubjects = searchQuery.trim()
    ? subjects.filter(s => {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) ||
               (s.description || '').toLowerCase().includes(q);
      })
    : subjects;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await subjectsAPI.getAll();
        if (!cancelled) {
          setSubjects(data);
          const imgs = {}, icns = {};
          data.forEach((s, i) => {
            imgs[s.id] = s.cover_image || subjectImg(s.name);
            icns[s.id] = s.icon || ICONS[i % ICONS.length];
          });
          setImages(imgs);
          setIcons(icns);
        }
      } catch (err) {
        if (!cancelled) addToast(err.message, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await subjectsAPI.create(form);
      setForm({ name:'', description:'' });
      setShowForm(false);
      const data = await subjectsAPI.getAll();
      setSubjects(data);
      const imgs = {}, icns = {};
      data.forEach((s, i) => {
        imgs[s.id] = s.cover_image || images[s.id] || subjectImg(s.name);
        icns[s.id] = s.icon || icons[s.id] || ICONS[i % ICONS.length];
      });
      setImages(imgs); setIcons(icns);
      addToast('Subject created', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    setDeletingId(id);
    try {
      await subjectsAPI.delete(id);
      setSubjects(prev => prev.filter(s => s.id !== id));
      addToast(`"${name}" deleted`, 'success');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setDeletingId(null); }
  };

  const handleRename = async (id, newName) => {
    if (!newName.trim()) return;
    try {
      await subjectsAPI.update(id, { name: newName.trim() });
      setSubjects(prev => prev.map(s => s.id === id ? { ...s, name: newName.trim() } : s));
      addToast('Subject renamed', 'success');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setEditingId(null); }
  };

  const handleImageSelect = async (id, url) => {
    const prev_url = images[id];
    setImages(prev => ({ ...prev, [id]: url }));
    setPickerOpen(null);
    try {
      await subjectsAPI.update(id, { cover_image: url });
    } catch {
      setImages(prev => ({ ...prev, [id]: prev_url })); // revert on failure
      addToast('Failed to save image', 'error');
    }
  };

  const changeIcon = async (id) => {
    const prev_icon = icons[id];
    const idx = ICONS.indexOf(icons[id]);
    const next = ICONS[(idx + 1) % ICONS.length];
    setIcons(prev => ({ ...prev, [id]: next }));
    try {
      await subjectsAPI.update(id, { icon: next });
    } catch {
      setIcons(prev => ({ ...prev, [id]: prev_icon })); // revert on failure
      addToast('Failed to save icon', 'error');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-light-primary/10 dark:bg-dark-primary/20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-light-primary/20 dark:border-sky-400/20 border-t-light-primary dark:border-t-dark-primary rounded-full animate-spin" />
        </div>
        <p className="text-light-muted dark:text-dark-muted font-semibold text-sm">{t('subjects.loading')}</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-light-bg dark:bg-dark-bg">

      <AppSidebar active="subjects" />

      {/* ═══ MAIN CONTENT ═══════════════════════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto p-8 relative z-10">

          {/* ═══ HERO ════════════════════════════════════ */}
          <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-r from-light-primary to-blue-500 dark:from-blue-600 dark:to-dark-bg shadow-2xl mb-10">
            <div className="absolute inset-0 opacity-10 dark:opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none" />
            <div className="relative p-10 md:p-14 flex flex-col md:flex-row items-center justify-between z-10 gap-8">
              <div className="text-white max-w-xl">
                <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                  Your lectures, turned into<br />smart exams instantly
                </h2>
                <p className="text-white/80 text-lg mb-8 font-medium">
                  Upload your course materials, structure your subjects, and let AI generate professional exams tailored to your content — in minutes.
                </p>
                <div className="flex bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 max-w-md">
                  <div className="flex-1 flex items-center px-4 gap-3 text-white">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="text"
                      placeholder={t('subjects.searchPlaceholder')}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none focus:outline-none w-full text-white placeholder-white/60 font-medium"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')}
                        className="text-white/50 hover:text-white transition-colors text-lg leading-none flex-shrink-0">✕</button>
                    )}
                  </div>
                  <button
                    onClick={() => {/* already live-filtering */}}
                    className="bg-white text-light-primary dark:text-sky-300 px-6 py-3 rounded-xl font-bold hover:bg-white/90 transition-colors">
                    {t('subjects.generate')}
                  </button>
                </div>
              </div>

              {/* Decorative illustration */}
              <div className="hidden md:flex relative w-72 h-72 items-center justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-light-accent dark:bg-cyan-400 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                  <img
                    src="/src/assets/logo.png"
                    alt="ExamGen"
                    className="w-full h-full object-cover"
                    style={{
                      maskImage: 'radial-gradient(circle, black 45%, transparent 72%)',
                      WebkitMaskImage: 'radial-gradient(circle, black 45%, transparent 72%)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION HEADER ══════════════════════════ */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-light-primary to-light-secondary dark:from-white dark:to-dark-accent">
                {searchQuery.trim() ? t('subjects.subtitle') : t('subjects.title')}
              </h3>
              {searchQuery.trim() && (
                <p className="text-sm text-light-muted dark:text-white/40 mt-0.5 font-mono">
                  {filteredSubjects.length} of {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
                  {filteredSubjects.length === 0 && ' — no match'}
                </p>
              )}
            </div>
            {subjects.length > 0 && (
              <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                {showForm ? t('subjects.edit') : t('subjects.newSubject')}
              </button>
            )}
          </div>

          {/* ═══ CREATE FORM ════════════════════════════ */}
          {showForm && (
            <div className="glass-card p-6 mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary" />
              <p className="text-xs font-bold text-light-primary dark:text-dark-accent uppercase tracking-widest mb-4">
                <img src="/image/3775742-bulb-creative-idea-light-thunder_108969.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain', display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />New Subject
              </p>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder={t('subjects.newSubject')} value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required autoFocus className="input-field" />
                  <input type="text" placeholder="Description (optional)" value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="input-field" />
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm px-5 py-2.5">{t('subjects.edit')}</button>
                  <button type="submit" className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    {t('subjects.newSubject')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ═══ SUBJECT GRID ════════════════════════════ */}
          {subjects.length === 0 ? (
            <EmptyState onAdd={() => setShowForm(true)} />
          ) : filteredSubjects.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-light-primary/10 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-light-muted dark:text-white/30"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <p className="text-light-muted dark:text-white/40 font-semibold mb-2">{t('subjects.noSubjects')} "<span className="text-light-text dark:text-white">{searchQuery}</span>"</p>
              <button onClick={() => setSearchQuery('')} className="text-sm text-light-primary dark:text-violet-400 underline">{t('subjects.searchPlaceholder')}</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredSubjects.map((s, i) => (
                <SubjectCard key={s.id} subject={s}
                  image={images[s.id] || subjectImg(s.name)}
                  icon={icons[s.id] || ICONS[i % ICONS.length]}
                  deleting={deletingId === s.id}
                  onDelete={() => handleDelete(s.id, s.name)}
                  onChangeImage={() => setPickerOpen(s.id)}
                  onChangeIcon={() => changeIcon(s.id)}
                  editingName={editingId === s.id}
                  editNameValue={editName}
                  onStartRename={() => { setEditingId(s.id); setEditName(s.name); }}
                  onEditNameChange={v => setEditName(v)}
                  onConfirmRename={() => handleRename(s.id, editName)}
                  onCancelRename={() => setEditingId(null)}
                  highlight={searchQuery.trim()}
                />
              ))}
            </div>
          )}
        </div>

      </main>

      {pickerOpen && (
        <ImagePickerModal
          currentImage={images[pickerOpen]}
          onSelect={url => handleImageSelect(pickerOpen, url)}
          onClose={() => setPickerOpen(null)}
        />
      )}

    </div>
  );
}

/* ════════════════════════════════════════════════════════
   IMAGE PICKER MODAL
   ════════════════════════════════════════════════════════ */
function compressToDataURL(file, maxW = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function ImagePickerModal({ onSelect, onClose, currentImage }) {
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressToDataURL(file);
      onSelect(dataUrl);
    } catch {
      onSelect(URL.createObjectURL(file)); // fallback (stays local only)
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-lg text-light-text dark:text-white">Choose Image</h3>
          <button onClick={onClose} className="text-light-muted dark:text-white/50 hover:text-red-400 transition-colors text-xl">✕</button>
        </div>

        {/* Upload */}
        <button onClick={() => fileRef.current?.click()}
          className="w-full mb-5 py-3 rounded-2xl border-2 border-dashed border-light-border dark:border-white/15 text-light-muted dark:text-white/50 hover:border-light-primary dark:hover:border-dark-primary hover:text-light-primary dark:hover:text-sky-200 transition-all font-semibold flex items-center justify-center gap-2">
          <img src="/src/assets/icon-folder.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> Upload from device
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {/* Grid */}
        <p className="text-xs text-light-muted dark:text-white/40 mb-3 font-semibold uppercase tracking-widest">Or choose from library</p>
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {SAMPLE_IMAGES.map((src, i) => (
            <button key={i} onClick={() => onSelect(src)}
              className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all ${currentImage === src ? 'border-light-primary dark:border-sky-400 scale-95' : 'border-transparent hover:border-light-primary/50 dark:hover:border-dark-primary/50'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" />
              {currentImage === src && <div className="absolute inset-0 bg-light-primary/20 dark:bg-dark-primary/20 flex items-center justify-center text-white text-lg">✓</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SUBJECT CARD — exact same structure as reference
   ════════════════════════════════════════════════════════ */
function highlightText(text, query) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-300/60 dark:bg-yellow-400/30 text-inherit rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function SubjectCard({ subject, image, icon, deleting, onDelete, onChangeImage, onChangeIcon,
  editingName, editNameValue, onStartRename, onEditNameChange, onConfirmRename, onCancelRename,
  highlight = '' }) {
  const [hovered, setHovered] = useState(false);
  const { t } = useTranslation();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="glass-card group cursor-pointer hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col border-none bg-white dark:bg-slate-800/80"
    >
      {/* Image header */}
      <div className="h-40 relative overflow-hidden group/image">
        <img src={image} alt={subject.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Change image button */}
        <button onClick={e => { e.stopPropagation(); onChangeImage(); }}
          className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 backdrop-blur-md p-2 rounded-xl opacity-0 group-hover/image:opacity-100 transition-all duration-300 border border-white/20">
          <img src="/src/assets/icon-folder.png" alt="change" style={{ width: 16, height: 16, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </button>

        {/* Badges */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-white border border-white/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span className="text-xs font-bold">{subject.course_count || 0} Courses</span>
          </div>
          <div className="bg-light-primary dark:bg-dark-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
            {subject.exam_count || 0} Exams
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-5 flex-1 flex flex-col text-sm">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="relative group/icon">
              <div className="w-11 h-11 rounded-xl bg-light-bg dark:bg-dark-surface flex items-center justify-center text-light-primary dark:text-sky-300 text-lg shadow-inner border border-light-border dark:border-white/5 transition-transform">
                <IconEmoji name={icon} />
              </div>
              <button onClick={e => { e.stopPropagation(); onChangeIcon(); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white dark:bg-dark-surface2 rounded-full shadow-lg border border-gray-100 dark:border-white/10 flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition-opacity">
                <img src="/src/assets/icon-edit.png" alt="edit" style={{ width: 11, height: 11, objectFit: 'contain' }} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              {editingName ? (
                <input
                  autoFocus
                  value={editNameValue}
                  onChange={e => onEditNameChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onConfirmRename(); if (e.key === 'Escape') onCancelRename(); }}
                  onBlur={onConfirmRename}
                  className="font-extrabold text-base bg-transparent border-b-2 border-light-primary dark:border-sky-400 text-light-text dark:text-white outline-none w-full leading-tight"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <h4 className="font-extrabold text-base text-light-text dark:text-white leading-tight">
                  {highlightText(subject.name, highlight)}
                </h4>
              )}
              {!editingName && (
                <button onClick={e => { e.stopPropagation(); onStartRename(); }}
                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <img src="/src/assets/icon-edit.png" alt="rename" style={{ width: 13, height: 13, objectFit: 'contain' }} />
                </button>
              )}
            </div>
          </div>

          {/* Delete */}
          <button onClick={e => { e.stopPropagation(); onDelete(); }} disabled={deleting}
            className={`p-1.5 transition-opacity hover:opacity-70 ${deleting ? 'opacity-30' : ''}`}>
            <img src="/src/assets/icon-trash.png" alt="delete" style={{ width: 16, height: 16, objectFit: 'contain' }} />
          </button>
        </div>

        {subject.description && (
          <p className="text-xs text-light-muted dark:text-dark-muted mb-3 leading-relaxed">
            {highlightText(subject.description, highlight)}
          </p>
        )}

        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/5">
          <Link to={`/subjects/${subject.id}`}
            className="w-full text-center text-sm font-bold text-light-primary dark:text-sky-300 hover:text-light-secondary dark:hover:text-dark-secondary transition-colors flex justify-center items-center gap-2"
            style={{ textDecoration:'none' }}>
            {t('subjects.generate')}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══ EMPTY STATE ═══════════════════════════════════════ */
function EmptyState({ onAdd }) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-20">
      <div className="w-24 h-24 rounded-3xl bg-light-primary/10 dark:bg-dark-primary/20 flex items-center justify-center mx-auto mb-6 shadow-lg">
        <img src="/image/book_education_school_learning_study_icon_196573.png" alt="" className="w-16 h-16 object-contain" />
      </div>
      <h3 className="text-2xl font-extrabold text-light-text dark:text-white mb-3">{t('subjects.noSubjects')}</h3>
      <p className="text-light-muted dark:text-dark-muted mb-8 text-lg max-w-sm mx-auto">
        {t('subjects.noSubjectsDesc')}
      </p>
      <button onClick={onAdd} className="btn-primary">
        + {t('subjects.newSubject')}
      </button>
    </div>
  );
}


/* ═══ ICON HELPERS ══════════════════════════════════════ */
function IconEmoji({ name }) {
  return <img src={`/image/${name}`} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />;
}

