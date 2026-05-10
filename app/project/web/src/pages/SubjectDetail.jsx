import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { subjectsAPI, coursesAPI, practicalSeriesAPI, theoreticalSeriesAPI, examsAPI } from '../api/client';
import AppSidebar from '../components/AppSidebar';

/* Tab metadata — tw holds Tailwind class strings (labels set dynamically inside component) */
const TAB_META = [
  { key: 'courses',            tKey: 'tabs.courses',     icon: 'book_education_school_learning_study_icon_196573.png', api: coursesAPI,
    tw: { text:'text-light-primary',  bg:'bg-light-primary/10',  border:'border-light-primary/20' } },
  { key: 'practical-series',   tKey: 'tabs.practical',   icon: 'chemistry_structure_icon_125485.png', api: practicalSeriesAPI,
    tw: { text:'text-light-secondary', bg:'bg-light-secondary/10', border:'border-light-secondary/20' } },
  { key: 'theoretical-series', tKey: 'tabs.theoretical', icon: 'bag_education_atom_school_study_learning_icon_232844.png', api: theoreticalSeriesAPI,
    tw: { text:'text-light-accent', bg:'bg-light-accent/10', border:'border-light-accent/20' } },
  { key: 'exams',              tKey: 'tabs.exams',       icon: 'exam_multiple_choice_document_icon_208911.png', api: examsAPI,
    tw: { text:'text-[#0e7490]',    bg:'bg-[#0e7490]/10',    border:'border-[#0e7490]/20' } },
];

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const navigate      = useNavigate();
  const { addToast }  = useToast();
  const { t }         = useTranslation();

  const TABS = TAB_META.map(tab => ({ ...tab, label: t(`subjectDetail.${tab.tKey}`) }));

  const [subject, setSubject]     = useState(null);
  const [activeTab, setActiveTab] = useState('courses');
  const [loading, setLoading]     = useState(true);
  const [data, setData]           = useState({ courses: [], 'practical-series': [], 'theoretical-series': [], exams: [] });

  const [showForm, setShowForm]   = useState(false);
  const [formData, setFormData]   = useState({ title: '', description: '' });
  const [formFile, setFormFile]   = useState(null);
  const formFileRef               = useRef(null);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [uploadFile, setUploadFile]     = useState(null);

  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemTitle, setEditItemTitle] = useState('');

  const [generateModal, setGenerateModal] = useState({ open: false, examId: null });
  const [parseStatuses, setParseStatuses] = useState({});  // { pdfId: 'idle'|'pending'|'done'|'error' }
  const pollRef = useRef(null);

  const getTabMeta = (tab = activeTab) => TABS.find(t => t.key === tab);

  const loadAll = async () => {
    const [c, ps, ts, ex] = await Promise.all([
      coursesAPI.getAll(subjectId),
      practicalSeriesAPI.getAll(subjectId),
      theoreticalSeriesAPI.getAll(subjectId),
      examsAPI.getAll(subjectId),
    ]);
    setData({ courses: c, 'practical-series': ps, 'theoretical-series': ts, exams: ex });
  };


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await subjectsAPI.getOne(subjectId);
        if (!cancelled) { setSubject(s); await loadAll(); }
      } catch (err) {
        if (!cancelled) addToast(err.message, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subjectId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const created = await getTabMeta().api.create(subjectId, formData);
      if (formFile && created?.id) {
        await getTabMeta().api.uploadPDF(subjectId, created.id, formFile);
      }
      setFormData({ title: '', description: '' });
      setFormFile(null);
      setShowForm(false);
      await loadAll();
      addToast(t('subjectDetail.createdOk'), 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(t('subjectDetail.confirmDelete', { title }))) return;
    try {
      await getTabMeta().api.delete(subjectId, id);
      await loadAll();
      addToast(t('subjectDetail.deleted'), 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleUpload = async (itemId) => {
    if (!uploadFile) return;
    try {
      await getTabMeta().api.uploadPDF(subjectId, itemId, uploadFile);
      setUploadFile(null); setUploadingFor(null);
      await loadAll();
      addToast(t('subjectDetail.pdfUploaded'), 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleDeletePDF = async (itemId, pdfId, filename) => {
    if (!window.confirm(t('subjectDetail.confirmDeletePDF', { filename }))) return;
    try {
      await getTabMeta().api.deletePDF(subjectId, itemId, pdfId);
      await loadAll();
      addToast(t('subjectDetail.pdfDeleted'), 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const getPDFUrl = (pdf) => {
    if (pdf.filepath) {
      const rel = pdf.filepath.replace(/^\.?\/?(uploads\/)?/, '');
      return `/uploads/${rel}`;
    }
    return `/uploads/${activeTab}/${pdf.id}/${pdf.filename}`;
  };

  const detectAISubject = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('algo'))                            return 'algo';
    if (n.includes('law') || n.includes('droit'))      return 'Law';
    if (n.includes('commerce') || n.includes('busi'))  return 'commerce';
    if (n.includes('se') || n.includes('software'))    return 'se';
    if (n.includes('compil'))                          return 'compilation';
    return 'algo';
  };

  const handleExtract = async (examId, pdfId) => {
    const aiSubject = detectAISubject(subject?.name);
    setParseStatuses(prev => ({ ...prev, [pdfId]: 'pending' }));
    try {
      await examsAPI.parsePDF(subjectId, examId, pdfId, aiSubject);
      startPolling(examId, pdfId);
    } catch (err) {
      setParseStatuses(prev => ({ ...prev, [pdfId]: 'error' }));
      addToast(err.message || t('subjectDetail.extractionFailed'), 'error');
    }
  };

  const handleRenameItem = async (id, newTitle) => {
    if (!newTitle.trim()) return;
    try {
      await getTabMeta().api.update(subjectId, id, { title: newTitle.trim() });
      await loadAll();
      addToast(t('subjectDetail.renamed'), 'success');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setEditingItemId(null); }
  };

  const handleExtractAllExams = () => {
    (data['exams'] || []).forEach(exam => {
      (exam.pdfs || []).forEach(pdf => {
        if (parseStatuses[pdf.id] !== 'pending') {
          handleExtract(exam.id, pdf.id);
        }
      });
    });
  };

  const startPolling = (examId, pdfId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await examsAPI.getParseStatus(subjectId, examId, pdfId);
        const st = res.status;
        if (st === 'done') {
          setParseStatuses(prev => ({ ...prev, [pdfId]: 'done' }));
          clearInterval(pollRef.current);
          addToast(t('subjectDetail.extractionComplete'), 'success');
        } else if (st === 'error') {
          setParseStatuses(prev => ({ ...prev, [pdfId]: 'error' }));
          clearInterval(pollRef.current);
          addToast(res.detail || 'Extraction failed', 'error');
        }
      } catch { /* keep polling */ }
    }, 3000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3.5 bg-light-bg dark:bg-dark-bg">
      <div className="w-11 h-11 rounded-xl bg-light-primary/10 border border-light-primary/20 flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-light-primary/20 border-t-light-primary rounded-full animate-spin" />
      </div>
      <p className="text-light-muted dark:text-white/50 font-mono text-xs">{t('subjectDetail.loading')}</p>
    </div>
  );

  const tabMeta  = getTabMeta();
  const items    = data[activeTab] || [];

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex">

      <AppSidebar active="subjects" backTo="/subjects" backLabel={t('subjectDetail.allSubjects')} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-7 py-11 pb-20">

        {/* Subject header */}
        <div className="mb-9 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10 rounded-full px-3 py-1 mb-3">
              <span className="text-[11px] text-light-muted dark:text-white/50 font-mono tracking-[0.5px]">{t('subjectDetail.badge')}</span>
            </div>
            <h1 className="text-[32px] font-extrabold tracking-[-0.8px] leading-[1.2] mb-1.5 bg-clip-text text-transparent bg-gradient-to-r from-light-primary to-light-accent dark:from-violet-400 dark:to-cyan-400">
              {subject?.name}
            </h1>
            {subject?.description && (
              <p className="text-sm text-light-muted dark:text-white/50 leading-relaxed">{subject.description}</p>
            )}
          </div>
          <button onClick={() => navigate(`/subjects/${subjectId}/generate`)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-light-primary/10 border border-light-primary/30 rounded-xl
                       text-xs font-bold text-light-primary hover:bg-light-primary/20 hover:border-light-primary/50 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-400 dark:hover:bg-violet-500/20 transition-all mt-1">
            <img src="/image/3775742-bulb-creative-idea-light-thunder_108969.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain', verticalAlign: 'middle' }} /> {t('subjectDetail.aiGenerator')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/[0.07] rounded-2xl p-1 mb-8">
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            const count  = (data[tab.key] || []).length;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setShowForm(false); setUploadingFor(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200
                  ${active
                    ? `bg-white dark:bg-white/10 shadow-sm ${tab.tw.text}`
                    : 'text-light-muted dark:text-white/40 hover:text-light-text dark:hover:text-white/70'
                  }`}
              >
                <img src={`/image/${tab.icon}`} alt="" style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }} />
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono transition-all
                  ${active ? `${tab.tw.bg} ${tab.tw.text} border ${tab.tw.border}` : 'bg-black/5 dark:bg-white/5 text-light-muted dark:text-white/30'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add new button */}
        <div className="mb-7">
          <button onClick={() => setShowForm(!showForm)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all
              ${showForm
                ? 'bg-black/5 dark:bg-white/10 border border-light-border dark:border-white/10 text-light-muted dark:text-white/50'
                : `${tabMeta?.tw.bg} border ${tabMeta?.tw.border} ${tabMeta?.tw.text}`
              }`}>
            {showForm ? <><CloseIcon /> {t('subjectDetail.cancel')}</> : <><PlusIcon /> {t('subjectDetail.new')} {tabMeta?.label}</>}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className={`glass-card p-5 mb-6 relative overflow-hidden border ${tabMeta?.tw.border}`}>
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${tabMeta?.tw.bg}`} />
            <p className={`text-[10px] font-mono uppercase tracking-[1.2px] ${tabMeta?.tw.text} mb-3.5`}>
              + {t('subjectDetail.create')} {tabMeta?.label}
            </p>
            <form onSubmit={handleCreate} className="flex flex-col gap-2.5">
              <input type="text" placeholder={t('subjectDetail.titlePlaceholder')} value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required autoFocus className="input-field text-sm py-2.5" />
              <textarea placeholder={t('subjectDetail.descPlaceholder')} value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={2} className="input-field text-sm py-2.5 resize-y min-h-[60px]" />

              {/* File attachment */}
              <div className="flex items-center gap-2">
                <input ref={formFileRef} type="file" accept=".pdf" className="hidden"
                  onChange={e => setFormFile(e.target.files[0] || null)} />
                <button type="button"
                  onClick={() => formFileRef.current?.click()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border
                    ${formFile
                      ? `${tabMeta?.tw.bg} ${tabMeta?.tw.text} ${tabMeta?.tw.border}`
                      : 'bg-black/5 dark:bg-white/5 border-light-border dark:border-white/10 text-light-muted dark:text-white/40 hover:border-light-primary/40 dark:hover:border-white/20'
                    }`}>
                  <PdfIcon />
                  <span className="max-w-[200px] truncate">{formFile ? formFile.name : t('subjectDetail.attachPDF')}</span>
                </button>
                {formFile && (
                  <button type="button" onClick={() => setFormFile(null)}
                    className="text-light-muted dark:text-white/30 hover:text-red-400 transition-colors text-sm leading-none">✕</button>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setFormFile(null); }} className="btn-secondary text-xs px-4 py-2">{t('subjectDetail.cancel')}</button>
                <button type="submit" className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white ${tabMeta?.tw.bg.replace('/10', '/80')} border ${tabMeta?.tw.border} transition-all hover:opacity-90`}
                  style={{ background: tabMeta?.tw.text === 'text-light-primary' ? '#0891b2' : tabMeta?.tw.text === 'text-light-secondary' ? '#0284c7' : tabMeta?.tw.text === 'text-light-accent' ? '#06b6d4' : '#0e7490' }}>
                  <PlusIcon /> {t('subjectDetail.create')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Global Extract All — exams tab only */}
        {activeTab === 'exams' && items.length > 0 && (() => {
          const allPdfs = items.flatMap(ex => ex.pdfs || []);
          const anyPending = allPdfs.some(p => parseStatuses[p.id] === 'pending');
          const allDone    = allPdfs.length > 0 && allPdfs.every(p => parseStatuses[p.id] === 'done');
          return (
            <div className="mb-5">
              <button
                onClick={handleExtractAllExams}
                disabled={anyPending || allPdfs.length === 0}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border
                  ${anyPending
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 cursor-default'
                    : allDone
                      ? 'bg-transparent border-sky-500/25 text-sky-400'
                      : allPdfs.length === 0
                        ? 'bg-black/5 dark:bg-white/5 border-light-border dark:border-white/10 text-light-muted dark:text-white/30 cursor-default'
                        : 'bg-[#0e7490]/10 border-[#0e7490]/25 text-[#0e7490] hover:bg-[#0e7490]/20 dark:bg-cyan-500/10 dark:border-cyan-500/25 dark:text-cyan-400 dark:hover:bg-cyan-500/20'
                  }`}>
                {anyPending
                  ? <><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> {t('subjectDetail.extractingAllExams')}</>
                  : allDone
                    ? <><img src="/image/ok_accept_approve_checklist_tick_check_mark_confirm_icon_267804.png" alt="" style={{ width: 13, height: 13, objectFit: 'contain' }} /> {t('subjectDetail.extractedAllExams')}</>
                    : t('subjectDetail.extractAllExams')
                }
              </button>
            </div>
          );
        })()}

        {/* Timeline list */}
        {items.length === 0 ? (
          <EmptyTabState tabMeta={tabMeta} />
        ) : (
          <div className="relative">
            {/* Vertical rail */}
            <div className={`absolute left-[23px] top-6 bottom-6 w-0.5 rounded-full ${tabMeta?.tw.bg}`} />

            <div className="flex flex-col gap-3">
              {items.map((item, index) => (
                <TimelineCard
                  key={item.id}
                  item={item}
                  index={index}
                  tabMeta={tabMeta}
                  activeTab={activeTab}
                  onDelete={() => handleDelete(item.id, item.title)}
                  onUpload={() => { setUploadingFor(item.id); setUploadFile(null); }}
                  onGenerateAI={() => setGenerateModal({ open: true, examId: item.id })}
                  uploadingFor={uploadingFor}
                  uploadFile={uploadFile}
                  onFileChange={f => setUploadFile(f)}
                  onFileSave={() => handleUpload(item.id)}
                  onFileCancel={() => { setUploadingFor(null); setUploadFile(null); }}
                  onDeletePDF={(pdfId, filename) => handleDeletePDF(item.id, pdfId, filename)}
                  onExtract={(pdfId) => handleExtract(item.id, pdfId)}
                  parseStatuses={parseStatuses}
                  getPDFUrl={getPDFUrl}
                  editingTitle={editingItemId === item.id}
                  editTitleValue={editItemTitle}
                  onStartRename={() => { setEditingItemId(item.id); setEditItemTitle(item.title); }}
                  onTitleChange={v => setEditItemTitle(v)}
                  onConfirmRename={() => handleRenameItem(item.id, editItemTitle)}
                  onCancelRename={() => setEditingItemId(null)}
                />
              ))}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Generate Modal */}
      {generateModal.open && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[1000] p-4"
          onClick={e => { if (e.target === e.currentTarget) setGenerateModal({ open: false, examId: null }); }}>
          <div className="bg-white dark:bg-dark-surface border border-light-border dark:border-white/10 rounded-3xl w-full max-w-[1100px] h-[90vh] overflow-hidden flex flex-col shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-light-border dark:border-white/[0.07] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-light-primary/10 dark:bg-violet-500/10 flex items-center justify-center">
                  <img src="/image/3775742-bulb-creative-idea-light-thunder_108969.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-light-text dark:text-white">{t('subjectDetail.aiQuestionGenerator')}</p>
                  <p className="text-[11px] text-light-muted dark:text-white/50 font-mono">{t('subjectDetail.engineInfo')}</p>
                </div>
              </div>
              <button onClick={() => setGenerateModal({ open: false, examId: null })}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 border border-light-border dark:border-white/10 flex items-center justify-center text-lg text-light-muted dark:text-white/50 hover:border-red-400/60 hover:text-red-500 transition-all">
                ×
              </button>
            </div>
            <iframe
              src="https://longitude-pharmacies-luis-demo.trycloudflare.com"
              className="flex-1 border-none w-full"
              title="exam-forge"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── TimelineCard ──────────────────────────────────────────────────────── */
function TimelineCard({ item, index, tabMeta, activeTab, onDelete, onUpload, onGenerateAI, uploadingFor, uploadFile, onFileChange, onFileSave, onFileCancel, onDeletePDF, onExtract, parseStatuses, getPDFUrl,
  editingTitle, editTitleValue, onStartRename, onTitleChange, onConfirmRename, onCancelRename }) {
  const [hovered, setHovered]       = useState(false);
  const [pdfExpanded, setPdfExpanded] = useState(activeTab === 'exams');
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const num = String(index + 1).padStart(2, '0');
  const hasPDFs = item.pdfs?.length > 0;
  const tw = tabMeta?.tw || { text: 'text-light-primary', bg: 'bg-light-primary/10', border: 'border-light-primary/20' };

  return (
    <div className="flex items-start">
      {/* Timeline node */}
      <div className="flex flex-col items-center flex-shrink-0 w-12 pt-[18px]">
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-mono text-[10px] font-bold z-[1] relative transition-all duration-200
          ${hovered ? `${tw.bg} ${tw.text} ${tw.border}` : 'bg-black/5 dark:bg-white/10 border-light-border dark:border-white/15 text-light-muted dark:text-white/40'}`}>
          {num}
        </div>
      </div>

      {/* Card body */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex-1 rounded-2xl p-4 transition-all duration-200 border
          ${hovered
            ? `bg-black/[0.04] dark:bg-white/[0.07] ${tw.border}`
            : 'bg-black/[0.02] dark:bg-white/[0.03] border-light-border dark:border-white/[0.07]'
          }`}
      >
        <div className="flex justify-between items-start gap-3">
          {/* Left content */}
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 ${item.description ? 'mb-1' : ''}`}>
              <img src={`/image/${tabMeta?.icon}`} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
              {editingTitle ? (
                <input
                  autoFocus
                  value={editTitleValue}
                  onChange={e => onTitleChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onConfirmRename(); if (e.key === 'Escape') onCancelRename(); }}
                  onBlur={onConfirmRename}
                  className="text-[15px] font-bold bg-transparent border-b-2 border-light-primary dark:border-sky-400 text-light-text dark:text-white outline-none w-full tracking-tight"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <div className="flex items-center gap-1.5 group/title">
                  <p className="text-[15px] font-bold text-light-text dark:text-white tracking-tight">{item.title}</p>
                  <button
                    onClick={e => { e.stopPropagation(); onStartRename(); }}
                    title={t('subjectDetail.rename')}
                    className="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10">
                    <img src="/src/assets/icon-edit.png" alt="rename" style={{ width: 12, height: 12, objectFit: 'contain' }} />
                  </button>
                </div>
              )}
            </div>
            {item.description && (
              <p className="text-[13px] text-light-muted dark:text-white/50 mb-2.5 leading-snug pl-[23px]">
                {item.description}
              </p>
            )}

            {/* PDF section */}
            {hasPDFs && (
              <div className={`pl-[23px] ${item.description ? '' : 'mt-2'}`}>
                <button onClick={() => setPdfExpanded(!pdfExpanded)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono cursor-pointer transition-all ${pdfExpanded ? 'mb-2' : ''}
                    ${tw.bg} ${tw.text} border ${tw.border}`}>
                  <PdfIcon />
                  {item.pdfs.length} PDF{item.pdfs.length !== 1 ? 's' : ''}
                  <span className="text-[9px] opacity-70">{pdfExpanded ? '▲' : '▼'}</span>
                </button>

                {pdfExpanded && (
                  <div className="flex flex-col gap-1.5">
                    {item.pdfs.map(pdf => {
                      const ps = parseStatuses?.[pdf.id] || 'idle';
                      return (
                      <div key={pdf.id} className="flex items-center justify-between px-3 py-2 bg-black/5 dark:bg-white/[0.06] rounded-xl border border-light-border dark:border-white/[0.07]">
                        <span className="text-xs text-light-muted dark:text-white/50 font-mono flex items-center gap-1.5 overflow-hidden">
                          <span className={`text-[10px] ${tw.bg} ${tw.text} px-1.5 py-0.5 rounded border ${tw.border} flex-shrink-0`}>PDF</span>
                          <span className="truncate">{pdf.filename}</span>
                          {/* Parse status badge */}
                          {ps === 'pending' && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono flex-shrink-0">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" /> {t('subjectDetail.extracting')}
                            </span>
                          )}
                          {ps === 'done' && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono flex-shrink-0">
                              <img src="/image/ok_accept_approve_checklist_tick_check_mark_confirm_icon_267804.png" alt="" style={{ width: 12, height: 12, objectFit: 'contain' }} /> {t('subjectDetail.extracted')}
                            </span>
                          )}
                          {ps === 'error' && (
                            <span className="text-[10px] text-red-400 font-mono flex-shrink-0">{t('subjectDetail.failed')}</span>
                          )}
                        </span>
                        <div className="flex gap-1 flex-shrink-0">
                          {activeTab === 'exams' && ps !== 'pending' && (
                            <button onClick={() => onExtract(pdf.id)}
                              title="Extract exam structure to JSON"
                              className={`text-[11px] px-2 py-1 rounded-lg border font-mono transition-all
                                ${ps === 'done'
                                  ? 'bg-transparent border-sky-500/25 text-sky-400 hover:bg-sky-500/8'
                                  : ps === 'error'
                                    ? 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20'
                                    : 'bg-black/5 dark:bg-white/5 border-light-border dark:border-white/10 text-light-muted dark:text-white/40 hover:text-[#0e7490] hover:border-[#0e7490]/40 dark:hover:text-cyan-400 dark:hover:border-cyan-400/40'
                                }`}>
                              {ps === 'done' ? t('subjectDetail.reExtract') : ps === 'error' ? t('subjectDetail.retry') : t('subjectDetail.extract')}
                            </button>
                          )}
                          <a href={getPDFUrl(pdf)} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-light-primary px-2 py-1 rounded-lg bg-light-primary/10 border border-light-primary/20 dark:bg-violet-500/10 dark:border-violet-500/20 dark:text-violet-400 font-mono hover:bg-light-primary/20 dark:hover:bg-violet-500/20 transition-colors"
                            style={{ textDecoration: 'none' }}>
                            {t('subjectDetail.view')}
                          </a>
                          <button onClick={() => onDeletePDF(pdf.id, pdf.filename)}
                            title={t('subjectDetail.confirmDeletePDF', { filename: pdf.filename })}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-transparent text-light-muted dark:text-white/25 hover:border-red-400/50 hover:text-red-500 hover:bg-red-500/[0.06] transition-all">
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Upload inline */}
            {uploadingFor === item.id && (
              <div className="flex gap-2 items-center mt-2.5 pl-[23px]">
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => onFileChange(e.target.files[0])}
                  className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10 text-light-muted dark:text-white/50 hover:bg-black/10 dark:hover:bg-white/10 transition-all max-w-[220px] truncate">
                  <PdfIcon />
                  <span className="truncate">{uploadFile ? uploadFile.name : t('subjectDetail.chooseFile')}</span>
                </button>
                <button onClick={onFileSave} disabled={!uploadFile}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${uploadFile ? 'bg-sky-500 text-white' : 'bg-black/5 dark:bg-white/10 text-light-muted dark:text-white/30 cursor-default'}`}>
                  {t('subjectDetail.uploadSave')}
                </button>
                <button onClick={onFileCancel}
                  className="px-3 py-1.5 rounded-lg text-xs border border-light-border dark:border-white/10 text-light-muted dark:text-white/50 font-mono hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                  {t('subjectDetail.cancel')}
                </button>
              </div>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex gap-1.5 flex-shrink-0 items-start">
            {uploadingFor !== item.id && (
              <button onClick={onUpload} title={t('subjectDetail.upload')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-all
                  bg-black/5 dark:bg-white/5 border border-light-border dark:border-white/10 text-light-muted dark:text-white/40
                  hover:${tw.border} hover:${tw.text}`}>
                <PdfIcon /> {t('subjectDetail.upload')}
              </button>
            )}

            {activeTab === 'exams' && hasPDFs && (() => {
              const anyPending = item.pdfs.some(p => parseStatuses?.[p.id] === 'pending');
              const allDone   = item.pdfs.every(p => parseStatuses?.[p.id] === 'done');
              return (
                <button
                  onClick={() => item.pdfs.forEach(p => { if (parseStatuses?.[p.id] !== 'pending') onExtract(p.id); })}
                  disabled={anyPending}
                  title="Extract exam structure to JSON via docParser"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all
                    ${anyPending
                      ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400 cursor-default'
                      : allDone
                        ? 'bg-transparent border border-sky-500/25 text-sky-400 hover:bg-sky-500/8'
                        : 'bg-[#0e7490]/10 border border-[#0e7490]/25 text-[#0e7490] hover:bg-[#0e7490]/20 dark:bg-cyan-500/10 dark:border-cyan-500/25 dark:text-cyan-400 dark:hover:bg-cyan-500/20'
                    }`}>
                  {anyPending
                    ? <><span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" /> {t('subjectDetail.extracting_all')}</>
                    : allDone
                      ? <><img src="/image/ok_accept_approve_checklist_tick_check_mark_confirm_icon_267804.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} /> {t('subjectDetail.extracted_all')}</>
                      : <>{t('subjectDetail.extractAll')}</>
                  }
                </button>
              );
            })()}

            {activeTab === 'exams' && (
              <button onClick={onGenerateAI}
                title="AI Generate"
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all bg-light-primary/10 border border-light-primary/25 text-light-primary hover:bg-light-primary/20 hover:border-light-primary/50 dark:bg-violet-500/10 dark:border-violet-500/25 dark:text-violet-400 dark:hover:bg-violet-500/20 dark:hover:border-violet-500/50">
                <img src="/image/3775742-bulb-creative-idea-light-thunder_108969.png" alt="AI" style={{ width: 18, height: 18, objectFit: 'contain' }} />
              </button>
            )}

            <button onClick={onDelete} title="Delete"
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-transparent text-light-muted dark:text-white/25 hover:border-red-400/50 hover:text-red-500 hover:bg-red-500/[0.06] transition-all">
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────── */
function EmptyTabState({ tabMeta }) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-18">
      <div className={`w-20 h-20 rounded-3xl ${tabMeta?.tw.bg} border ${tabMeta?.tw.border} flex items-center justify-center mx-auto mb-5 shadow-lg`}>
        <img src={`/image/${tabMeta?.icon}`} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
      </div>
      <p className="text-[20px] font-bold text-light-text dark:text-white mb-1.5 tracking-tight">
        {t('subjectDetail.noItemsYet', { label: tabMeta?.label?.toLowerCase() })}
      </p>
      <p className="text-[13px] text-light-muted dark:text-white/50 leading-relaxed">
        {t('subjectDetail.addHint', { label: tabMeta?.label })}
      </p>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────────── */
function PlusIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
}
function CloseIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>;
}
function TrashIcon() {
  return <img src="/src/assets/icon-trash.png" alt="delete" style={{ width: 16, height: 16, objectFit: 'contain' }} />;
}
function PdfIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
