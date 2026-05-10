import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppSidebar from '../components/AppSidebar';
import { archiveAPI } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';

/* ── SmartInput — autocomplete from profile hints ────────────────────────── */
function SmartInput({ value, onChange, placeholder, suggestions = [] }) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter(s => s && s.toLowerCase().includes((value || '').toLowerCase()) && s !== value);

  return (
    <div className="relative">
      <input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[13px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a2035] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
          {filtered.slice(0, 6).map(s => (
            <button key={s} onMouseDown={() => { onChange(s); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[12px] text-gray-700 dark:text-white/80 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────── */
const IMG = {
  bank:     '/image/folderwithdocuments_120818.png',
  draft:    '/image/compass_draft_project_plan_ruler_icon_181792.png',
  save:     '/image/savedisk_121993.png',
  accept:   '/image/ok_accept_approve_checklist_tick_check_mark_confirm_icon_267804.png',
  trash:    '/image/trash_delete_remove_recycle_bin_icon_176367.png',
  edit:     '/image/file-edit_114433.png',
  exam:     '/image/exam_multiple_choice_document_icon_208911.png',
};

function Icon({ src, size = 16, alt = '', className = '' }) {
  return <img src={src} alt={alt} width={size} height={size} style={{ objectFit: 'contain' }} className={className} />;
}

function CloseBtn({ onClick, className = '' }) {
  return (
    <button onClick={onClick}
      className={`w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all ${className}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
      </svg>
    </button>
  );
}

/* ── Header fields ───────────────────────────────────────────────────────── */
const HEADER_FIELDS = [
  { id: 'institution', label: 'Établissement / Université', priority: 1 },
  { id: 'faculty',     label: 'Faculté / Département',      priority: 1 },
  { id: 'subject',     label: 'Module / Matière',           priority: 2 },
  { id: 'duration',    label: 'Durée',                      priority: 2 },
  { id: 'level',       label: 'Niveau / Année',             priority: 3 },
  { id: 'session',     label: 'Session',                    priority: 3 },
  { id: 'date',        label: 'Date',                       priority: 4 },
  { id: 'total_pts',   label: 'Barème total',               priority: 4 },
  { id: 'notes',       label: 'Instructions générales',     priority: 5 },
];

function groupByPriority(fields) {
  const map = {};
  fields.forEach(f => { if (!map[f.priority]) map[f.priority] = []; map[f.priority].push(f); });
  return Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]));
}
const PRIORITY_GROUPS = groupByPriority(HEADER_FIELDS);

/* ── Extract exercises from archive entries ─────────────────────────────── */
function extractBankItems(entries) {
  const items = [];
  entries.forEach(entry => {
    if (entry.status !== 'accepted') return;
    if (entry.mode === 'full_exam' && entry.content?.exercises) {
      entry.content.exercises.forEach((ex, i) => {
        items.push({
          _bankId: `${entry.id}_ex_${i}`,
          _sourceId: entry.id,
          _sourceTitle: entry.title,
          ai_subject: entry.ai_subject,
          title: ex.title || `Exercise ${i + 1}`,
          introduction_context: ex.introduction_context || '',
          questions: ex.questions || [],
          total_exercise_points: ex.total_exercise_points,
          type: 'exercise',
        });
      });
    } else if (entry.mode === 'questions' && Array.isArray(entry.content)) {
      items.push({
        _bankId: `${entry.id}_qbank`,
        _sourceId: entry.id,
        _sourceTitle: entry.title,
        ai_subject: entry.ai_subject,
        title: entry.title || 'Question Bank',
        introduction_context: '',
        questions: entry.content,
        total_exercise_points: null,
        type: 'questions',
      });
    }
  });
  return items;
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function ExamBuilderPage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [bankItems, setBankItems]         = useState([]);
  const [loadingBank, setLoadingBank]     = useState(true);
  const [examItems, setExamItems]         = useState([]);
  const [headerData, setHeaderData]       = useState({});
  const [showHeaderModal, setShowHeaderModal] = useState(false);
  const [editingItem, setEditingItem]     = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [filterSubject, setFilterSubject] = useState('all');
  const [searchBank, setSearchBank]       = useState('');
  const [dragBankId, setDragBankId]       = useState(null);
  const [dragExamIdx, setDragExamIdx]     = useState(null);
  const [dragOverExamIdx, setDragOverExamIdx] = useState(null);
  const [focusedExamId, setFocusedExamId] = useState(null);
  const [exerciseHeights, setExerciseHeights] = useState({});
  const [saveStatus, setSaveStatus]       = useState('saved');
  const [showBank, setShowBank]           = useState(false);
  const [zoom, setZoom]                   = useState(1.0);
  const pagesContainerRef = useRef(null);
  const exerciseElRefs    = useRef({});
  const saveTimer         = useRef(null);

  // Scope draft to the logged-in user so two teachers on the same browser never share state
  const DRAFT_KEY = user?.id ? `exam_builder_draft_${user.id}` : null;

  /* ── Auto-save draft (debounced 1.5s) ── */
  useEffect(() => {
    if (!DRAFT_KEY) return;
    if (!examItems.length && !Object.keys(headerData).length) return;
    setSaveStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ examItems, headerData, savedAt: new Date().toISOString() }));
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error'); // storage full (large images)
      }
    }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [examItems, headerData]);

  const clearDraft = () => {
    if (DRAFT_KEY) localStorage.removeItem(DRAFT_KEY);
    setExamItems([]);
    setHeaderData({});
    setSaveStatus('saved');
  };

  /* ── Exercise height tracking (for page distribution) ── */
  useEffect(() => {
    const ros = {};
    examItems.forEach(item => {
      const el = exerciseElRefs.current[item._examId];
      if (!el) return;
      ros[item._examId] = new ResizeObserver(() =>
        setExerciseHeights(prev => ({ ...prev, [item._examId]: el.offsetHeight }))
      );
      ros[item._examId].observe(el);
    });
    return () => Object.values(ros).forEach(ro => ro.disconnect());
  }, [examItems]);

  /* ── Global paste → image ── */
  useEffect(() => {
    const onPaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find(it => it.type.startsWith('image/'));
      if (!imgItem) return;
      const file = imgItem.getAsFile();
      const reader = new FileReader();
      reader.onload = ev => {
        const targetId = focusedExamId || (examItems.length > 0 ? examItems[examItems.length - 1]._examId : null);
        if (targetId) addImageToItem(targetId, ev.target.result);
        else addToast(t('examBuilder.hoverThenPaste'), 'info');
      };
      reader.readAsDataURL(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [focusedExamId, examItems]);

  /* ── Load draft on mount (re-runs when user becomes available) ── */
  useEffect(() => {
    archiveAPI.getAll()
      .then(entries => setBankItems(extractBankItems(entries)))
      .catch(e => addToast(e.message, 'error'))
      .finally(() => setLoadingBank(false));

    if (!DRAFT_KEY) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      let savedHeader = null;
      if (raw) {
        const { examItems: savedItems, headerData: sh } = JSON.parse(raw);
        if (savedItems?.length) setExamItems(savedItems);
        if (sh && Object.keys(sh).length) { setHeaderData(sh); savedHeader = sh; }
      }
      if (!savedHeader || !Object.keys(savedHeader).length) {
        try {
          const profileKey = `exam_teaching_profile_${user.id}`;
          const { contexts = [] } = JSON.parse(localStorage.getItem(profileKey) || '{}');
          const autoHeader = {};
          const firstCtx = contexts[0];
          if (firstCtx) {
            if (firstCtx.institution)   autoHeader.institution = firstCtx.institution;
            if (firstCtx.faculty)       autoHeader.faculty     = firstCtx.faculty;
            if (firstCtx.levels?.[0])   autoHeader.level       = firstCtx.levels[0];
            if (firstCtx.session)       autoHeader.session     = firstCtx.session;
            if (firstCtx.academic_year) autoHeader.date        = firstCtx.academic_year;
            if (firstCtx.speciality)    autoHeader.notes       = firstCtx.speciality;
          }
          if (!autoHeader.institution && user?.institution) autoHeader.institution = user.institution;
          if (!autoHeader.faculty     && user?.department)  autoHeader.faculty     = user.department;
          if (Object.keys(autoHeader).length) setHeaderData(autoHeader);
        } catch {}
      }
    } catch { /* ignore corrupt draft */ }
  }, [DRAFT_KEY]);

  /* ── Page assignment (distribute exercises across A4 pages) ── */
  const pageAssignments = useMemo(() => {
    const CONTENT_H = 900;  // px available per page
    const HEADER_H  = 120;  // header takes this on page 1
    const pages = [[]];
    let usedH = HEADER_H;
    examItems.forEach(item => {
      const h = (exerciseHeights[item._examId] || 110) + 28;
      if (usedH + h > CONTENT_H && pages[pages.length - 1].length > 0) {
        pages.push([]);
        usedH = 0;
      }
      pages[pages.length - 1].push(item._examId);
      usedH += h;
    });
    return pages;
  }, [examItems, exerciseHeights]);

  const pageCount = pageAssignments.length;

  /* ── Bank filter ── */
  const subjects = [...new Set(bankItems.map(i => i.ai_subject))];
  const filteredBank = bankItems.filter(item => {
    const matchSubj   = filterSubject === 'all' || item.ai_subject === filterSubject;
    const matchSearch = !searchBank.trim() || item.title.toLowerCase().includes(searchBank.toLowerCase());
    return matchSubj && matchSearch;
  });

  /* ── Drag bank → exam ── */
  const handleBankDragStart  = (e, bankId) => { setDragBankId(bankId); e.dataTransfer.effectAllowed = 'copy'; };
  const handleExamDragOver   = (e)         => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const handleExamDrop       = (e)         => {
    e.preventDefault();
    if (!dragBankId) return;
    const item = bankItems.find(i => i._bankId === dragBankId);
    if (!item) return;
    if (examItems.find(i => i._bankId === dragBankId)) { addToast(t('examBuilder.alreadyInExam'), 'info'); setDragBankId(null); return; }
    setExamItems(prev => [...prev, { ...item, _examId: `${dragBankId}_${Date.now()}` }]);
    setDragBankId(null); setDragOverExamIdx(null);
  };

  const addToExam = (item) => {
    if (examItems.find(i => i._bankId === item._bankId)) { addToast(t('examBuilder.alreadyInExam'), 'info'); return; }
    setExamItems(prev => [...prev, { ...item, _examId: `${item._bankId}_${Date.now()}` }]);
  };

  const removeFromExam = (examId) => setExamItems(prev => prev.filter(i => i._examId !== examId));

  /* ── Images ── */
  const addImageToItem = (examId, dataUrl, insertIdx = null) =>
    setExamItems(prev => prev.map(i => i._examId !== examId ? i :
      { ...i, images: [...(i.images || []), { id: Date.now() + Math.random(), dataUrl, caption: '', insertIdx }] }));

  const removeImageFromItem = (examId, imageId) =>
    setExamItems(prev => prev.map(i => i._examId !== examId ? i :
      { ...i, images: (i.images || []).filter(img => img.id !== imageId) }));

  const updateImageCaption = (examId, imageId, caption) =>
    setExamItems(prev => prev.map(i => i._examId !== examId ? i :
      { ...i, images: (i.images || []).map(img => img.id === imageId ? { ...img, caption } : img) }));

  /* ── Tables ── */
  const addTableToItem = (examId) =>
    setExamItems(prev => prev.map(i => i._examId !== examId ? i :
      { ...i, tables: [...(i.tables || []), { id: Date.now() + Math.random(), title: '', rows: 3, cols: 3, cells: {} }] }));

  const removeTableFromItem = (examId, tableId) =>
    setExamItems(prev => prev.map(i => i._examId !== examId ? i :
      { ...i, tables: (i.tables || []).filter(t => t.id !== tableId) }));

  const updateTableField = (examId, tableId, key, val) =>
    setExamItems(prev => prev.map(i => i._examId !== examId ? i :
      { ...i, tables: (i.tables || []).map(t => t.id === tableId ? { ...t, [key]: val } : t) }));

  const updateTableCell = (examId, tableId, row, col, val) =>
    setExamItems(prev => prev.map(i => i._examId !== examId ? i :
      { ...i, tables: (i.tables || []).map(t => t.id !== tableId ? t :
        { ...t, cells: { ...(t.cells || {}), [`${row}-${col}`]: val } }) }));

  /* ── Upload image from file ── */
  const uploadImageForExam = (examId, file, insertIdx = null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => addImageToItem(examId, ev.target.result, insertIdx);
    reader.readAsDataURL(file);
  };

  const saveEdit = (examId, updatedItem) => {
    setExamItems(prev => prev.map(i => i._examId === examId ? { ...i, ...updatedItem } : i));
    setEditingItem(null);
    addToast(t('examBuilder.exerciseUpdated'), 'success');
  };

  /* ── Reorder within exam ── */
  const handleExamItemDragStart = (e, idx) => { setDragExamIdx(idx); e.dataTransfer.effectAllowed = 'move'; };
  const handleExamItemDragOver  = (e, idx) => { e.preventDefault(); if (dragExamIdx === null) return; setDragOverExamIdx(idx); };
  const handleExamItemDrop      = (e, toIdx) => {
    e.preventDefault();
    if (dragExamIdx === null || dragExamIdx === toIdx) { setDragExamIdx(null); setDragOverExamIdx(null); return; }
    setExamItems(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragExamIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    setDragExamIdx(null); setDragOverExamIdx(null);
  };

  /* ── Export PDF ── */
  const exportPDF = () => {
    const html = `<!DOCTYPE html><html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; margin: 0; color: #111; line-height: 1.5; }
</style>
</head>
<body>
${buildHeaderHtml(headerData)}
${examItems.map((item, i) => buildExerciseHtml(item, i)).join('\n')}
</body>
</html>`;
    const w = window.open('', '_blank', 'width=860,height=700');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.addEventListener('afterprint', () => w.close());
    setTimeout(() => w.print(), 400);
  };

  /* ── Export Word ── */
  const exportWord = () => {
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  @page WordSection1 { size:21cm 29.7cm; margin:2cm 2.5cm; mso-page-orientation:portrait; }
  div.WordSection1 { page:WordSection1; }
  body{font-family:'Times New Roman',serif;font-size:12pt;margin:0}
  .exam-header{border:2px solid #000;padding:10pt;margin-bottom:16pt}
  .exercise{margin-bottom:20pt}
  .exercise-title{font-weight:bold;font-size:13pt;border-bottom:1px solid #000;padding-bottom:3pt;margin-bottom:8pt}
  .exercise-intro{font-style:italic;margin-bottom:8pt;color:#444}
  .question{margin:6pt 0 6pt 16pt}
  .question-stem{font-size:11pt}
  .choice{margin-left:24pt;font-size:10.5pt}
</style></head><body>
<div class="WordSection1">
${buildHeaderHtml(headerData)}
${examItems.map((item, i) => buildExerciseHtml(item, i)).join('')}
</div>
</body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `exam-${headerData.subject || 'generated'}-${Date.now()}.doc` });
    a.click(); URL.revokeObjectURL(url);
  };

  /* ── Add exam to favorites ── */
  const finalizeExam = async () => {
    if (examItems.length === 0) { addToast(t('examBuilder.addExercisesFirst'), 'info'); return; }
    try {
      await archiveAPI.save({
        ai_subject: examItems[0]?.ai_subject || 'mixed',
        title: headerData.subject || 'Final Exam',
        mode: 'full_exam',
        status: 'accepted',
        content: { exercises: examItems.map(({ title, introduction_context, questions, total_exercise_points }) =>
          ({ title, introduction_context, questions, total_exercise_points })) },
      });
      addToast(t('examBuilder.addedToFavorites'), 'success');
    } catch (e) { addToast(e.message, 'error'); }
  };

  const totalPoints = examItems.reduce((s, i) => s + (Number(i.total_exercise_points) || 0), 0);
  const totalQs     = examItems.reduce((s, i) => s + (i.questions?.length || 0), 0);

  const profileHints = useMemo(() => {
    if (!user?.id) return { contexts: [], allInstitutions: [], allFaculties: [], allLevels: [], allSubjects: [], allYears: [], allSessions: [], allSpecialities: [] };
    try {
      const profileKey = `exam_teaching_profile_${user.id}`;
      const { contexts = [] } = JSON.parse(localStorage.getItem(profileKey) || '{}');
      const allInstitutions = [...new Set(contexts.map(c => c.institution).filter(Boolean))];
      const allFaculties    = [...new Set(contexts.map(c => c.faculty).filter(Boolean))];
      const allLevels       = [...new Set(contexts.flatMap(c => c.levels || []))];
      const allSubjects     = [...new Set(contexts.flatMap(c => c.subjects || []))];
      const allYears        = [...new Set(contexts.map(c => c.academic_year).filter(Boolean))];
      const allSessions     = [...new Set(contexts.map(c => c.session).filter(Boolean))];
      const allSpecialities = [...new Set(contexts.map(c => c.speciality).filter(Boolean))];
      if (user.institution && !allInstitutions.includes(user.institution)) allInstitutions.unshift(user.institution);
      if (user.department  && !allFaculties.includes(user.department))    allFaculties.unshift(user.department);
      return { contexts, allInstitutions, allFaculties, allLevels, allSubjects, allYears, allSessions, allSpecialities };
    } catch {
      return { contexts: [], allInstitutions: [], allFaculties: [], allLevels: [], allSubjects: [], allYears: [], allSessions: [], allSpecialities: [] };
    }
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#00053B]">
      <AppSidebar active="exam-builder" />

      {/* ── Document area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="mx-4 mt-3 mb-0 flex-shrink-0 rounded-2xl overflow-hidden
          bg-gradient-to-r from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary
          shadow-lg shadow-light-primary/25 dark:shadow-dark-primary/35">
          <div className="flex items-center justify-between px-4 py-2.5">

            <div className="flex items-center gap-3">
              {/* Bank toggle */}
              <button onClick={() => setShowBank(b => !b)} title="Exercise Bank"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-bold
                  backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0
                  ${showBank
                    ? 'bg-white/25 border-white/40 text-white shadow-sm shadow-black/10'
                    : 'bg-white/10 border-white/20 text-white/85 hover:bg-white/20 hover:border-white/35'}`}>
                <Icon src={IMG.bank} size={15} className="brightness-[10]" />
                <span>{t('examBuilder.bank')}</span>
                {bankItems.length > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${showBank ? 'bg-white/30 text-white' : 'bg-white/15 text-white/80'}`}>
                    {filteredBank.length}
                  </span>
                )}
              </button>

              <div className="h-5 w-px bg-white/20" />

              <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shadow-sm">
                <Icon src={IMG.exam} size={18} className="brightness-[10]" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">{t('examBuilder.title')}</p>
                <p className="text-[10px] text-white/60 font-mono">
                  {examItems.length > 0
                    ? `${examItems.length} ex · ${totalQs} q${totalPoints > 0 ? ` · ${totalPoints} pts` : ''} · `
                    : ''}
                  <span className="text-white/90 font-semibold">{pageCount} page{pageCount !== 1 ? 's' : ''}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {examItems.length > 0 && (
                <button onClick={clearDraft} title="مسح المسودة"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold
                    backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5
                    bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:border-white/35 hover:text-white">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
                  <span>Clear</span>
                </button>
              )}
              <div className="h-5 w-px bg-white/20" />
              <ToolbarBtn onClick={finalizeExam} svgIcon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              } label={t('examBuilder.addToFavorites')}
                cls="bg-white/10 border-white/20 text-white hover:bg-white/22 hover:border-white/35" />
              <ToolbarBtn onClick={exportPDF} label="PDF" svgIcon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              } cls="bg-white/10 border-white/20 text-white hover:bg-white/22 hover:border-white/35" />
              <ToolbarBtn onClick={exportWord} label="Word" svgIcon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              } cls="bg-white/10 border-white/20 text-white hover:bg-white/22 hover:border-white/35" />
            </div>

          </div>
        </div>

        {/* ── Bank overlay + Canvas ────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden relative">

          {/* ── Exercise Bank — absolute, slides top→bottom, no push ─── */}
          <div className={`absolute top-0 left-0 z-20 w-[300px] h-[85%] print:hidden pointer-events-none`}>
            <div className={`w-full h-full flex flex-col
              bg-sky-50/95 dark:bg-[#060e2e]/96 backdrop-blur-md
              border border-sky-100 dark:border-white/[0.07]
              rounded-2xl shadow-2xl shadow-black/15 dark:shadow-black/40
              overflow-hidden
              transition-transform duration-300 ease-out pointer-events-auto
              ${showBank ? 'translate-y-0' : '-translate-y-full'}`}>

              {/* Panel header */}
              <div className="px-5 pt-5 pb-4 border-b border-sky-100 dark:border-white/[0.07] flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-transparent border border-sky-200/50 dark:border-sky-500/20 flex items-center justify-center">
                      <Icon src={IMG.bank} size={19} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-900 dark:text-white">{t('examBuilder.exerciseBank')}</p>
                      <p className="text-[10px] text-gray-400 dark:text-white/40 font-mono">
                        {bankItems.length} · {t('examBuilder.bankSubtitle')}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowBank(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="10" y2="10"/><line x1="10" y1="1" x2="1" y2="10"/></svg>
                  </button>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 dark:bg-white/5 border border-sky-100 dark:border-white/10 mb-3">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400 dark:text-white/30 flex-shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input value={searchBank} onChange={e => setSearchBank(e.target.value)}
                    placeholder="Search exercises…"
                    className="bg-transparent border-none outline-none flex-1 text-[12px] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-white/30" />
                  {searchBank && (
                    <button onClick={() => setSearchBank('')} className="text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/50 transition-colors">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
                    </button>
                  )}
                </div>

                {/* Subject filter */}
                {subjects.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {['all', ...subjects].map(s => (
                      <button key={s} onClick={() => setFilterSubject(s)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-mono transition-all border
                          ${filterSubject === s
                            ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/30 dark:text-sky-300'
                            : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-white/5 dark:border-white/10 dark:text-white/40 hover:border-gray-300 dark:hover:border-white/20'}`}>
                        {s === 'all' ? 'All' : s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bank items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingBank ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <span className="w-6 h-6 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
                    <p className="text-gray-400 dark:text-white/30 font-mono text-[11px]">Loading…</p>
                  </div>
                ) : filteredBank.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Icon src={IMG.bank} size={22} className="opacity-30" />
                    </div>
                    <p className="text-gray-400 dark:text-white/30 font-mono text-[11px] leading-relaxed">
                      {bankItems.length === 0 ? 'No accepted drafts yet.' : 'No results.'}
                    </p>
                    {bankItems.length === 0 && (
                      <Link to="/archive" onClick={() => setShowBank(false)}
                        className="mt-3 inline-flex items-center gap-1 text-[11px] text-sky-500 dark:text-sky-400 hover:underline">
                        Open Archive →
                      </Link>
                    )}
                  </div>
                ) : filteredBank.map(item => (
                  <BankItem key={item._bankId} item={item}
                    inExam={!!examItems.find(i => i._bankId === item._bankId)}
                    onAdd={() => addToExam(item)}
                    onDragStart={handleBankDragStart} />
                ))}
              </div>

              <div className="px-4 py-3 border-t border-sky-100 dark:border-white/[0.07] flex-shrink-0">
                <p className="text-[10px] text-gray-400 dark:text-white/30 font-mono text-center">
                  Drag onto the document · or click <span className="text-light-primary dark:text-dark-accent">+</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Canvas ────────────────────────────────────────────────── */}
          <div className="h-full overflow-y-auto bg-[#525659] dark:bg-[#111827] py-8 px-4 relative">
            {examItems.length > 0 && (
              <p className="text-center text-[10px] text-white/50 font-mono mb-4 print:hidden">
                Hover an exercise · <kbd className="px-1 bg-white/15 border border-white/20 rounded text-[9px]">Ctrl+V</kbd> to paste image
              </p>
            )}

            {/* Pages container — zoom applied here */}
            <div ref={pagesContainerRef} className="flex flex-col items-center gap-6" style={{ zoom }}>
            {pageAssignments.map((pageItemIds, pageIdx) => (
              <div key={pageIdx}
                className="exam-page bg-white shadow-2xl print:shadow-none print:mb-0"
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  padding: '18mm 20mm 28mm',
                  fontFamily: '"Times New Roman", Georgia, serif',
                  color: '#111',
                  fontSize: '12pt',
                  lineHeight: 1.5,
                  position: 'relative',
                  boxSizing: 'border-box',
                }}>

                {pageIdx === 0 && <ExamHeader data={headerData} onEdit={() => setShowHeaderModal(true)} />}

                <div onDragOver={handleExamDragOver} onDrop={handleExamDrop}>
                  {pageIdx === 0 && examItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-lg mt-6">
                      <Icon src={IMG.bank} size={32} className="opacity-30 mb-3" />
                      <p className="text-gray-400 text-sm font-sans">Drag exercises here or click +</p>
                      <p className="text-gray-300 text-xs font-sans mt-1">From the Exercise Bank on the left</p>
                    </div>
                  ) : (
                    pageItemIds.map(examId => {
                      const item = examItems.find(i => i._examId === examId);
                      if (!item) return null;
                      const idx = examItems.findIndex(i => i._examId === examId);
                      return (
                        <div key={examId} ref={el => { if (el) exerciseElRefs.current[examId] = el; }}>
                          <ExamExerciseItem item={item} index={idx}
                            isDragOver={dragOverExamIdx === idx}
                            onDragStart={e => handleExamItemDragStart(e, idx)}
                            onDragOver={e => handleExamItemDragOver(e, idx)}
                            onDrop={e => handleExamItemDrop(e, idx)}
                            onDragEnd={() => { setDragExamIdx(null); setDragOverExamIdx(null); }}
                            onRemove={() => setConfirmRemove(item._examId)}
                            onEdit={() => setEditingItem(item)}
                            onMouseEnter={() => setFocusedExamId(item._examId)}
                            onMouseLeave={() => setFocusedExamId(null)}
                            onAddImage={(file, insertIdx) => uploadImageForExam(item._examId, file, insertIdx)}
                            onRemoveImage={imageId => removeImageFromItem(item._examId, imageId)}
                            onUpdateCaption={(imageId, cap) => updateImageCaption(item._examId, imageId, cap)}
                            onAddTable={() => addTableToItem(item._examId)}
                            onRemoveTable={tableId => removeTableFromItem(item._examId, tableId)}
                            onUpdateTable={(tableId, key, val) => updateTableField(item._examId, tableId, key, val)}
                            onUpdateTableCell={(tableId, row, col, val) => updateTableCell(item._examId, tableId, row, col, val)}
                            isFocused={focusedExamId === item._examId}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Page number — bottom center */}
                <div style={{ position: 'absolute', bottom: '10mm', left: 0, right: 0, textAlign: 'center', fontSize: '9pt', color: '#aaa', fontFamily: 'serif' }}>
                  — {pageIdx + 1} —
                </div>
              </div>
            ))}
          </div>

            {/* ── Zoom controls (floating bottom-right) ─────────────── */}
            <div className="fixed bottom-5 right-5 z-20 flex items-center gap-1 print:hidden
              bg-white/90 dark:bg-[#1a2035]/90 backdrop-blur-md
              border border-gray-200 dark:border-white/10 shadow-xl rounded-2xl px-2 py-1.5">
              <button
                onClick={() => setZoom(z => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
                disabled={zoom <= 0.4}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-all text-[16px] font-light">
                {'-'}
              </button>
              <button
                onClick={() => setZoom(1.0)}
                className="min-w-[44px] text-center text-[11px] font-mono text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors px-1"
                title="Reset to 100%">
                {Math.round(zoom * 100)}{'%'}
              </button>
              <button
                onClick={() => setZoom(z => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
                disabled={zoom >= 2.0}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-all text-[16px] font-light">
                {'+'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Modals ── */}
      {showHeaderModal && (
        <HeaderFillModal data={headerData} onChange={setHeaderData} onClose={() => setShowHeaderModal(false)} profileHints={profileHints} user={user} />
      )}
      {editingItem && (
        <EditExerciseModal item={editingItem} onSave={updated => saveEdit(editingItem._examId, updated)} onClose={() => setEditingItem(null)} />
      )}
      {confirmRemove && (
        <ConfirmModal
          title="Remove Exercise"
          message="Remove this exercise from the exam? It will remain in the bank."
          confirmLabel="Remove"
          confirmCls="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={() => { removeFromExam(confirmRemove); setConfirmRemove(null); }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

/* ── ToolbarBtn ─────────────────────────────────────────────────────────── */
function ToolbarBtn({ onClick, icon, svgIcon, label, cls }) {
  return (
    <button onClick={onClick} title={label}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold
        backdrop-blur-sm transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${cls}`}>
      {icon    && <Icon src={icon} size={14} />}
      {svgIcon && svgIcon}
      <span>{label}</span>
    </button>
  );
}

/* ── BankItem ───────────────────────────────────────────────────────────── */
function BankItem({ item, inExam, onAdd, onDragStart, horizontal = false }) {
  if (horizontal) {
    return (
      <div draggable onDragStart={e => onDragStart(e, item._bankId)}
        className={`group flex-shrink-0 flex flex-col gap-1.5 p-2.5 rounded-2xl border cursor-grab active:cursor-grabbing transition-all w-[180px]
          ${inExam
            ? 'border-sky-200/50 dark:border-sky-500/20 bg-sky-50/30 dark:bg-sky-500/5 opacity-50'
            : 'border-gray-200 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03] hover:border-sky-300 dark:hover:border-sky-500/30 hover:bg-sky-50 dark:hover:bg-sky-500/5'}`}>
        <div className="flex items-start justify-between gap-1">
          <p className="text-[11px] font-semibold text-gray-800 dark:text-white line-clamp-2 flex-1 leading-snug">{item.title}</p>
          <button onClick={onAdd} disabled={inExam} title={inExam ? 'Already added' : 'Add to exam'}
            className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all mt-0.5
              ${inExam
                ? 'text-sky-500 dark:text-sky-400'
                : 'border border-gray-300 dark:border-white/10 text-gray-400 dark:text-white/40 hover:border-sky-400 hover:text-sky-600 dark:hover:border-sky-500/50 dark:hover:text-sky-300'}`}>
            {inExam
              ? <svg width="10" height="8" viewBox="0 0 11 9" fill="none"><path d="M1 4.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="9" height="9" viewBox="0 0 11 11" fill="none"><line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            }
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-white/40 font-mono">
          {item.ai_subject} · {item.questions?.length || 0}q{item.total_exercise_points ? ` · ${item.total_exercise_points}pt` : ''}
        </p>
      </div>
    );
  }

  return (
    <div draggable onDragStart={e => onDragStart(e, item._bankId)}
      className={`group flex items-start gap-2.5 p-3 rounded-3xl border cursor-grab active:cursor-grabbing transition-all
        ${inExam
          ? 'border-sky-200/50 dark:border-sky-500/20 bg-sky-50/30 dark:bg-sky-500/5 opacity-50'
          : 'border-gray-200 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03] hover:border-sky-300 dark:hover:border-sky-500/30 hover:bg-sky-50 dark:hover:bg-sky-500/5'}`}>

      <div className="flex-shrink-0 mt-0.5 text-gray-300 dark:text-white/20 group-hover:text-gray-400 dark:group-hover:text-white/50 transition-colors">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/></svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-gray-800 dark:text-white truncate">{item.title}</p>
        <p className="text-[10px] text-gray-400 dark:text-white/40 font-mono mt-0.5">
          {item.ai_subject} · {item.questions?.length || 0} q{item.total_exercise_points ? ` · ${item.total_exercise_points}pts` : ''}
        </p>
        {item.introduction_context && (
          <p className="text-[10px] text-gray-400 dark:text-white/30 mt-1 line-clamp-1 italic">{item.introduction_context}</p>
        )}
      </div>

      <button onClick={onAdd} disabled={inExam} title={inExam ? 'Already added' : 'Add to exam'}
        className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-all
          ${inExam
            ? 'text-sky-500 dark:text-sky-400'
            : 'border border-gray-300 dark:border-white/10 text-gray-400 dark:text-white/40 hover:border-sky-400 hover:text-sky-600 dark:hover:border-sky-500/50 dark:hover:text-sky-300'}`}>
        {inExam
          ? <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        }
      </button>
    </div>
  );
}

/* ── ExamHeader (in document) ───────────────────────────────────────────── */
function ExamHeader({ data, onEdit }) {
  const hasAny = Object.values(data).some(v => v && String(v).trim());
  return (
    <div onClick={onEdit} className="cursor-pointer group"
      style={{ borderBottom: '2px solid #000', paddingBottom: '12pt', marginBottom: '20pt' }}>
      <div className="font-sans text-[9pt] text-gray-400 text-right mb-2 opacity-0 group-hover:opacity-100 transition-opacity select-none flex items-center justify-end gap-1">
        <img src={IMG.edit} alt="" width={11} height={11} style={{ objectFit: 'contain', opacity: 0.5 }} />
        Click to fill header
      </div>
      {!hasAny ? (
        <div style={{ textAlign: 'center', padding: '12pt 0' }}>
          {[1, 2, 3].map(i => <div key={i} style={{ borderBottom: '1px dashed #bbb', margin: '8pt 0', height: '18pt' }} />)}
          <p style={{ color: '#aaa', fontSize: '10pt', fontFamily: 'sans-serif', marginTop: '6pt' }}>Click to fill exam header</p>
        </div>
      ) : (
        PRIORITY_GROUPS.map(([priority, fields]) => (
          <div key={priority} style={{ display: 'flex', gap: '24pt', marginBottom: '8pt' }}>
            {fields.map(f => {
              const val = data[f.id] || '';
              return (
                <div key={f.id} style={{ flex: 1, borderBottom: val ? 'none' : '1px dashed #bbb' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '9.5pt', color: '#555' }}>{f.label}: </span>
                  <span style={{ fontSize: '11pt' }}>{val || <span style={{ color: '#ccc' }}>___________</span>}</span>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

/* ── ExamExerciseItem (in document) ─────────────────────────────────────── */
function ExamExerciseItem({ item, index, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd,
  onRemove, onEdit, onMouseEnter, onMouseLeave,
  onAddImage, onRemoveImage, onUpdateCaption,
  onAddTable, onRemoveTable, onUpdateTable, onUpdateTableCell, isFocused }) {

  const fileRef       = useRef(null);
  const insertIdxRef  = useRef(null);

  const triggerInsert = (insertIdx) => {
    insertIdxRef.current = insertIdx;
    fileRef.current?.click();
  };

  /* Helper: render images attached at a specific question index */
  const imagesAt = (insertIdx) =>
    (item.images || []).filter(img => img.insertIdx === insertIdx).map(img => (
      <div key={img.id} style={{ marginTop: '8pt', marginBottom: '6pt', pageBreakInside: 'avoid' }} className="relative group/img">
        <div style={{ border: '1.5px solid #374151', padding: '8pt', textAlign: 'center', minHeight: '50pt', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={img.dataUrl} alt={img.caption || 'figure'}
            style={{ maxWidth: '100%', maxHeight: '180pt', objectFit: 'contain' }} />
        </div>
        <div style={{ marginTop: '3pt', textAlign: 'center' }}>
          <input value={img.caption} onChange={e => onUpdateCaption(img.id, e.target.value)}
            placeholder="Caption…"
            className="text-center text-gray-500 bg-transparent border-none outline-none w-full placeholder-gray-300 print:placeholder-transparent"
            style={{ fontFamily: 'serif', fontSize: '10pt', fontStyle: 'italic' }} />
        </div>
        <button onClick={() => onRemoveImage(img.id)}
          className="absolute top-0 right-0 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity print:hidden">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/></svg>
        </button>
      </div>
    ));

  /* Inline insert-image button between questions */
  const InsertImageBtn = ({ afterIdx }) => (
    <div className="flex items-center gap-1.5 my-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
      <div className="flex-1 border-t border-dashed border-gray-200" />
      <button onClick={() => triggerInsert(afterIdx)} title="Insérer une image ici"
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-sans text-gray-400 border border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        image
      </button>
      <div className="flex-1 border-t border-dashed border-gray-200" />
    </div>
  );

  return (
    <div draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{ marginBottom: '20pt', pageBreakInside: 'avoid' }}
      className={`relative group transition-all ${isDragOver ? 'opacity-50' : ''} ${isFocused ? 'outline outline-2 outline-blue-200 outline-offset-4 rounded' : ''}`}>

      {/* Screen-only controls — right side */}
      <div className="absolute -right-24 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-sans print:hidden">
        <button onClick={onEdit} title="Edit exercise"
          className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-all">
          <img src={IMG.edit} alt="edit" width={13} height={13} style={{ objectFit: 'contain' }} />
        </button>
        <button onClick={onRemove} title="Remove from exam"
          className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center hover:bg-red-100 transition-all">
          <img src={IMG.trash} alt="remove" width={13} height={13} style={{ objectFit: 'contain' }} />
        </button>
        <div style={{ height: 4 }} />
        {/* Add image — bottom of exercise */}
        <button onClick={() => triggerInsert(null)} title="Add image"
          className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center hover:bg-sky-100 transition-all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        {/* Add table */}
        <button onClick={onAddTable} title="Add table"
          className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center hover:bg-amber-100 transition-all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { onAddImage(e.target.files[0], insertIdxRef.current); e.target.value = ''; insertIdxRef.current = null; }} />
      </div>

      {/* Drag handle */}
      <div className="absolute -left-8 top-1 opacity-0 group-hover:opacity-30 transition-opacity cursor-grab print:hidden">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="#888"><circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/></svg>
      </div>

      {/* Exercise title */}
      <div style={{ fontWeight: 'bold', fontSize: '13pt', borderBottom: '1px solid #333', paddingBottom: '4pt', marginBottom: '8pt' }}>
        Exercice {index + 1}{item.title ? ` — ${item.title}` : ''}
        {item.total_exercise_points != null && (
          <span style={{ fontSize: '10pt', fontWeight: 'normal', color: '#666', float: 'right' }}>({item.total_exercise_points} pts)</span>
        )}
      </div>

      {item.introduction_context && (
        <p style={{ fontStyle: 'italic', color: '#444', marginBottom: '8pt', fontSize: '11pt' }}>{item.introduction_context}</p>
      )}

      {/* Questions interleaved with images */}
      {imagesAt(-1)}
      {(item.questions || []).map((q, qi) => (
        <div key={qi}>
          <QuestionBlock q={q} qi={qi} />
          <InsertImageBtn afterIdx={qi} />
          {imagesAt(qi)}
        </div>
      ))}
      {/* Images without a position (appended to bottom) */}
      {imagesAt(null)}

      {/* ── Tables ── */}
      {(item.tables || []).map(tbl => {
        const rows = Math.max(1, Number(tbl.rows) || 3);
        const cols = Math.max(1, Number(tbl.cols) || 3);
        return (
          <div key={tbl.id} style={{ marginTop: '10pt', pageBreakInside: 'avoid' }} className="relative group/tbl">
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #374151' }}>
              <tbody>
                {Array.from({ length: rows }).map((_, ri) => (
                  <tr key={ri}>
                    {Array.from({ length: cols }).map((_, ci) => (
                      <td key={ci} style={{ border: '1px solid #374151', height: '22pt', width: `${100 / cols}%`, padding: 0 }}>
                        <input
                          value={(tbl.cells || {})[`${ri}-${ci}`] || ''}
                          onChange={e => onUpdateTableCell?.(tbl.id, ri, ci, e.target.value)}
                          className="w-full h-full bg-transparent border-none outline-none text-center print:placeholder-transparent"
                          style={{ fontFamily: 'serif', fontSize: '10pt', padding: '2pt 4pt', minHeight: '22pt', boxSizing: 'border-box' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '4pt', textAlign: 'center' }}>
              <input
                value={tbl.title}
                onChange={e => onUpdateTable(tbl.id, 'title', e.target.value)}
                placeholder="Table title…"
                className="text-center text-gray-600 bg-transparent border-none outline-none w-full placeholder-gray-300 print:placeholder-transparent"
                style={{ fontFamily: 'serif', fontSize: '10pt', fontStyle: 'italic' }}
              />
            </div>
            {/* Row / col adjusters */}
            <div className="absolute top-1 right-1 flex items-center gap-2 opacity-0 group-hover/tbl:opacity-100 transition-opacity print:hidden font-sans">
              {/* Rows */}
              <div className="flex items-center gap-0.5">
                <span className="text-[8px] text-gray-400">R</span>
                <button onClick={() => onUpdateTable(tbl.id, 'rows', Math.max(1, rows - 1))}
                  className="w-4 h-4 text-[10px] rounded border border-gray-300 bg-white text-gray-500 flex items-center justify-center hover:bg-gray-100">−</button>
                <span className="text-[9px] text-gray-400 font-mono w-4 text-center">{rows}</span>
                <button onClick={() => onUpdateTable(tbl.id, 'rows', Math.min(20, rows + 1))}
                  className="w-4 h-4 text-[10px] rounded border border-gray-300 bg-white text-gray-500 flex items-center justify-center hover:bg-gray-100">+</button>
              </div>
              {/* Cols */}
              <div className="flex items-center gap-0.5">
                <span className="text-[8px] text-gray-400">C</span>
                <button onClick={() => onUpdateTable(tbl.id, 'cols', Math.max(1, cols - 1))}
                  className="w-4 h-4 text-[10px] rounded border border-gray-300 bg-white text-gray-500 flex items-center justify-center hover:bg-gray-100">−</button>
                <span className="text-[9px] text-gray-400 font-mono w-4 text-center">{cols}</span>
                <button onClick={() => onUpdateTable(tbl.id, 'cols', Math.min(12, cols + 1))}
                  className="w-4 h-4 text-[10px] rounded border border-gray-300 bg-white text-gray-500 flex items-center justify-center hover:bg-gray-100">+</button>
              </div>
              <button onClick={() => onRemoveTable(tbl.id)}
                className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                <svg width="6" height="6" viewBox="0 0 6 6" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><line x1="1" y1="1" x2="5" y2="5"/><line x1="5" y1="1" x2="1" y2="5"/></svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── QuestionBlock ──────────────────────────────────────────────────────── */
function QuestionBlock({ q, qi }) {
  const data    = q.data || q;
  const stem    = data.stem || data.question || data.title || '';
  const choices = data.choices || data.options || [];
  const parts   = data.parts || [];
  return (
    <div style={{ marginBottom: '10pt', marginLeft: '12pt' }}>
      <p style={{ fontWeight: '600', fontSize: '11pt' }}>
        <span style={{ color: '#555' }}>Q{qi + 1}. </span>{stem}
      </p>
      {choices.length > 0 && (
        <div style={{ marginLeft: '20pt' }}>
          {choices.map((c, ci) => (
            <p key={ci} style={{ fontSize: '10.5pt', marginBottom: '3pt' }}>
              {String.fromCharCode(65 + ci)}. {typeof c === 'string' ? c : c.text || c.label || JSON.stringify(c)}
            </p>
          ))}
        </div>
      )}
      {parts.length > 0 && (
        <div style={{ marginLeft: '20pt' }}>
          {parts.map((p, pi) => (
            <p key={pi} style={{ fontSize: '10.5pt', marginBottom: '3pt' }}>
              {pi + 1}. {typeof p === 'string' ? p : p.text || p.question || JSON.stringify(p)}
            </p>
          ))}
        </div>
      )}
      {choices.length === 0 && parts.length === 0 && (
        <div style={{ borderBottom: '1px dashed #ccc', height: '18pt', margin: '6pt 0' }} />
      )}
    </div>
  );
}

/* ── EditExerciseModal ──────────────────────────────────────────────────── */
function EditExerciseModal({ item, onSave, onClose }) {
  const [draft, setDraft] = useState({
    title:                  item.title || '',
    introduction_context:   item.introduction_context || '',
    total_exercise_points:  item.total_exercise_points ?? '',
    questions:              JSON.parse(JSON.stringify(item.questions || [])),
  });

  const setField = (key, val) => setDraft(prev => ({ ...prev, [key]: val }));

  const updateQuestion = (qi, key, val) => {
    setDraft(prev => {
      const qs = [...prev.questions];
      const q  = { ...qs[qi] };
      if (q.data) q.data = { ...q.data, [key]: val };
      else q[key] = val;
      qs[qi] = q;
      return { ...prev, questions: qs };
    });
  };

  const updateChoice = (qi, ci, val) => {
    setDraft(prev => {
      const qs      = [...prev.questions];
      const q       = { ...qs[qi] };
      const source  = q.data || q;
      const key     = source.choices ? 'choices' : 'options';
      const choices = [...(source[key] || [])];
      choices[ci]   = typeof choices[ci] === 'string' ? val : { ...choices[ci], text: val };
      if (q.data) q.data = { ...q.data, [key]: choices };
      else q[key] = choices;
      qs[qi] = q;
      return { ...prev, questions: qs };
    });
  };

  const removeQuestion = (qi) =>
    setDraft(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== qi) }));

  const addQuestion = () =>
    setDraft(prev => ({ ...prev, questions: [...prev.questions, { data: { stem: '', choices: [] } }] }));

  const handleSave = () => onSave({
    title:                 draft.title,
    introduction_context:  draft.introduction_context,
    total_exercise_points: draft.total_exercise_points === '' ? null : Number(draft.total_exercise_points),
    questions:             draft.questions,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-[680px] max-h-[90vh] flex flex-col bg-white dark:bg-[#0f1420] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center">
              <Icon src={IMG.edit} size={18} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">Edit Exercise</p>
              <p className="text-[11px] text-gray-400 dark:text-white/40 font-mono">Changes apply to this exam only</p>
            </div>
          </div>
          <CloseBtn onClick={onClose} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Basic fields */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-white/50 mb-1.5">Title</label>
              <input value={draft.title} onChange={e => setField('title', e.target.value)}
                placeholder="Exercise title…"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[13px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-white/50 mb-1.5">Points</label>
              <input type="number" value={draft.total_exercise_points} onChange={e => setField('total_exercise_points', e.target.value)}
                placeholder="—"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[13px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-white/50 mb-1.5">Introduction / Context</label>
            <textarea value={draft.introduction_context} onChange={e => setField('introduction_context', e.target.value)}
              placeholder="Optional introduction text…" rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[13px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all resize-none" />
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[11px] font-semibold text-gray-500 dark:text-white/50">Questions ({draft.questions.length})</label>
              <button onClick={addQuestion}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 transition-all">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><line x1="5.5" y1="1" x2="5.5" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Add Question
              </button>
            </div>

            <div className="space-y-3">
              {draft.questions.map((q, qi) => {
                const data    = q.data || q;
                const stem    = data.stem || data.question || data.title || '';
                const choices = data.choices || data.options || [];
                return (
                  <div key={qi} className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 text-[10px] font-mono text-gray-400 dark:text-white/30 mt-1 w-6">Q{qi + 1}</span>
                      <div className="flex-1 space-y-2">
                        <input value={stem} onChange={e => updateQuestion(qi, q.data ? 'stem' : 'stem', e.target.value)}
                          placeholder="Question stem…"
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white text-[12px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all" />

                        {choices.length > 0 && (
                          <div className="pl-2 space-y-1.5">
                            {choices.map((c, ci) => (
                              <div key={ci} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-gray-400 dark:text-white/30 w-4">{String.fromCharCode(65 + ci)}.</span>
                                <input
                                  value={typeof c === 'string' ? c : c.text || c.label || ''}
                                  onChange={e => updateChoice(qi, ci, e.target.value)}
                                  placeholder={`Choice ${String.fromCharCode(65 + ci)}…`}
                                  className="flex-1 px-2.5 py-1.5 rounded-md bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/8 text-gray-700 dark:text-white/80 text-[11px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/40 transition-all" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeQuestion(qi)} title="Remove question"
                        className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center border border-transparent text-gray-300 hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all">
                        <img src={IMG.trash} alt="remove" width={11} height={11} style={{ objectFit: 'contain' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.02] flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 text-[13px] font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-all shadow-sm">
            <Icon src={IMG.save} size={14} className="brightness-[10]" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── HeaderFillModal ────────────────────────────────────────────────────── */
function HeaderFillModal({ data, onChange, onClose, profileHints = {}, user }) {
  const [draft, setDraft] = useState({ ...data });
  const [rowOrder, setRowOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('exam_header_row_order') || 'null') || PRIORITY_GROUPS.map(([p]) => p); }
    catch { return PRIORITY_GROUPS.map(([p]) => p); }
  });
  const [dragPriority, setDragPriority] = useState(null);
  const [dragOverPriority, setDragOverPriority] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('exam_header_row_order', JSON.stringify(rowOrder)); } catch {}
  }, [rowOrder]);

  const orderedGroups = [...PRIORITY_GROUPS].sort((a, b) => rowOrder.indexOf(a[0]) - rowOrder.indexOf(b[0]));

  const handleRowDragStart = (e, priority) => { setDragPriority(priority); e.dataTransfer.effectAllowed = 'move'; };
  const handleRowDragOver  = (e, priority) => { e.preventDefault(); setDragOverPriority(priority); };
  const handleRowDrop      = (e, toPriority) => {
    e.preventDefault();
    if (!dragPriority || dragPriority === toPriority) { setDragPriority(null); setDragOverPriority(null); return; }
    setRowOrder(prev => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(dragPriority);
      const toIdx   = arr.indexOf(toPriority);
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, dragPriority);
      return arr;
    });
    setDragPriority(null); setDragOverPriority(null);
  };

  /* Quick-fill from a single context */
  const fillFromContext = (ctx) => {
    setDraft(prev => ({
      ...prev,
      ...(ctx.institution   ? { institution: ctx.institution }   : {}),
      ...(ctx.faculty       ? { faculty: ctx.faculty }           : {}),
      ...(ctx.levels?.[0]   ? { level: ctx.levels[0] }           : {}),
      ...(ctx.session       ? { session: ctx.session }           : {}),
      ...(ctx.academic_year ? { date: ctx.academic_year }        : {}),
      ...(ctx.speciality    ? { notes: ctx.speciality }          : {}),
    }));
  };

  /* Map field id → suggestions list */
  const suggestionsFor = (fieldId, currentDraft) => {
    const h = profileHints;
    switch (fieldId) {
      case 'institution': return h.allInstitutions || [];
      case 'faculty':
        // If institution is selected, prefer contexts from that institution
        if (currentDraft.institution && h.contexts) {
          const filtered = h.contexts
            .filter(c => c.institution === currentDraft.institution && c.faculty)
            .map(c => c.faculty);
          if (filtered.length) return [...new Set(filtered)];
        }
        return h.allFaculties || [];
      case 'level':    return h.allLevels    || [];
      case 'subject':  return h.allSubjects  || [];
      case 'date':     return h.allYears     || [];
      case 'session':  return h.allSessions  || [];
      case 'notes':    return h.allSpecialities || [];
      default:         return [];
    }
  };

  const apply = () => { onChange(draft); onClose(); };

  const contexts = profileHints.contexts || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-[600px] bg-white dark:bg-[#0f1420] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center">
              <Icon src={IMG.edit} size={18} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">Exam Header</p>
              <p className="text-[11px] text-gray-400 dark:text-white/40 font-mono">Same priority = same row in document</p>
            </div>
          </div>
          <CloseBtn onClick={onClose} />
        </div>

        {/* Quick-fill context buttons */}
        {contexts.length > 0 && (
          <div className="px-6 pt-4 pb-2">
            <p className="text-[10px] font-mono text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2">
              Remplissage rapide depuis un contexte
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {contexts.map(ctx => {
                const label = [ctx.institution, ctx.levels?.[0]].filter(Boolean).join(' / ') || 'Contexte';
                return (
                  <button key={ctx.id}
                    onMouseDown={() => fillFromContext(ctx)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-500/35 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[11px] font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all whitespace-nowrap">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    {label}
                    {ctx.subjects?.[0] && <span className="opacity-60">· {ctx.subjects[0]}</span>}
                  </button>
                );
              })}
            </div>
            <div className="h-px bg-gray-100 dark:bg-white/[0.06] mt-3" />
          </div>
        )}

        {/* Fields */}
        <div className="p-6 space-y-5 max-h-[55vh] overflow-y-auto">
          {orderedGroups.map(([priority, fields]) => (
            <div key={priority} draggable
              onDragStart={e => handleRowDragStart(e, priority)}
              onDragOver={e => handleRowDragOver(e, priority)}
              onDrop={e => handleRowDrop(e, priority)}
              onDragEnd={() => { setDragPriority(null); setDragOverPriority(null); }}
              className={`transition-all ${dragOverPriority === priority && dragPriority !== priority ? 'border-t-2 border-blue-400' : 'border-t-2 border-transparent'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/50 transition-colors"
                  title="Drag to reorder">
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/></svg>
                </div>
                <span className="text-[9px] font-mono text-gray-400 dark:text-white/25 px-2 py-0.5 rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                  Row {priority}
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.06]" />
                {fields.length > 1 && <span className="text-[9px] font-mono text-gray-300 dark:text-white/20">same row</span>}
              </div>
              <div className={`grid gap-3 ${fields.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {fields.map(f => {
                  const noSuggestions = f.id === 'duration' || f.id === 'total_pts';
                  const fieldSuggestions = noSuggestions ? [] : suggestionsFor(f.id, draft);
                  return (
                    <div key={f.id}>
                      <label className="block text-[11px] font-semibold text-gray-500 dark:text-white/60 mb-1.5">
                        {f.label}
                      </label>
                      {noSuggestions ? (
                        <input type="text" value={draft[f.id] || ''}
                          onChange={e => setDraft(prev => ({ ...prev, [f.id]: e.target.value }))}
                          placeholder={`${f.label}…`}
                          className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-[13px] placeholder-gray-300 dark:placeholder-white/20 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all" />
                      ) : (
                        <SmartInput
                          value={draft[f.id] || ''}
                          onChange={val => setDraft(prev => ({ ...prev, [f.id]: val }))}
                          placeholder={`${f.label}…`}
                          suggestions={fieldSuggestions}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <button onClick={() => setDraft({})} className="text-[11px] font-mono text-gray-400 hover:text-red-500 transition-colors">Clear all</button>
            <span className="text-[10px] font-mono text-gray-300 dark:text-white/20">· Drag rows to reorder</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 text-[13px] font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-all">Cancel</button>
            <button onClick={apply} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-all shadow-sm">Appliquer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ConfirmModal ───────────────────────────────────────────────────────── */
function ConfirmModal({ title, message, confirmLabel, confirmCls, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}>
      <div className="w-full max-w-[400px] bg-white dark:bg-[#0f1420] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 flex items-center justify-center flex-shrink-0">
            <Icon src={IMG.trash} size={20} />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">{title}</p>
            <p className="text-[13px] text-gray-500 dark:text-white/50 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 text-[13px] font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all shadow-sm ${confirmCls}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Word/HTML helpers ──────────────────────────────────────────────────── */
function buildHeaderHtml(data) {
  const rows = PRIORITY_GROUPS.map(([, fields]) => {
    const cells = fields.map(f => `<td style="padding:4pt 8pt;border-bottom:1px solid #888;width:${100/fields.length}%"><span style="font-weight:bold;font-size:9pt;color:#555">${f.label}: </span><span style="font-size:11pt">${data[f.id] || '________________'}</span></td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;border:2px solid #000;margin-bottom:16pt">${rows}</table>`;
}

function buildImgHtml(images, insertIdx) {
  return (images || []).filter(img => img.insertIdx === insertIdx).map(img =>
    `<div style="margin:8pt 0;text-align:center;page-break-inside:avoid">
<img src="${img.dataUrl}" style="max-width:100%;max-height:180pt;object-fit:contain" />
${img.caption ? `<p style="font-size:9pt;color:#555;margin-top:3pt;font-style:italic">${img.caption}</p>` : ''}
</div>`).join('');
}

function buildExerciseHtml(item, index) {
  const images = item.images || [];
  const questions = item.questions || [];
  const qHtml = questions.map((q, qi) => {
    const data    = q.data || q;
    const stem    = data.stem || data.question || data.title || '';
    const choices = (data.choices || data.options || []).map((c, ci) =>
      `<p style="margin-left:24pt;font-size:10.5pt">${String.fromCharCode(65+ci)}. ${typeof c === 'string' ? c : c.text || ''}</p>`).join('');
    const parts = (data.parts || []).map((p, pi) =>
      `<p style="margin-left:24pt;font-size:10.5pt">${pi+1}. ${typeof p === 'string' ? p : p.text || p.question || ''}</p>`).join('');
    return `<div style="margin:6pt 0 6pt 16pt;page-break-inside:avoid"><p style="font-weight:600;font-size:11pt">Q${qi+1}. ${stem}</p>${choices}${parts}</div>${buildImgHtml(images, qi)}`;
  }).join('');
  const tblHtml = (item.tables || []).map(tbl => {
    const rows = Math.max(1, Number(tbl.rows) || 3);
    const cols = Math.max(1, Number(tbl.cols) || 3);
    const cellW = `${Math.floor(100 / cols)}%`;
    const bodyRows = Array.from({ length: rows }).map((_, ri) =>
      `<tr>${Array.from({ length: cols }).map((_, ci) => {
        const val = (tbl.cells || {})[`${ri}-${ci}`] || '';
        return `<td style="border:1px solid #374151;height:20pt;width:${cellW};text-align:center;font-family:serif;font-size:10pt;padding:2pt 4pt">${val}</td>`;
      }).join('')}</tr>`
    ).join('');
    const caption = tbl.title ? `<p style="text-align:center;font-style:italic;font-size:10pt;color:#444;margin-top:4pt">${tbl.title}</p>` : '';
    return `<div style="margin-top:10pt;page-break-inside:avoid"><table style="width:100%;border-collapse:collapse;border:1.5px solid #374151"><tbody>${bodyRows}</tbody></table>${caption}</div>`;
  }).join('');
  return `<div style="margin-bottom:20pt">
<div style="font-weight:bold;font-size:13pt;border-bottom:1px solid #333;padding-bottom:4pt;margin-bottom:8pt;page-break-after:avoid">
Exercice ${index+1}${item.title ? ' — ' + item.title : ''}
${item.total_exercise_points ? `<span style="float:right;font-weight:normal;font-size:10pt;color:#666">(${item.total_exercise_points} pts)</span>` : ''}
</div>
${item.introduction_context ? `<p style="font-style:italic;color:#444;margin-bottom:8pt;font-size:11pt">${item.introduction_context}</p>` : ''}
${buildImgHtml(images, -1)}${qHtml}${buildImgHtml(images, null)}${tblHtml}</div>`;
}
