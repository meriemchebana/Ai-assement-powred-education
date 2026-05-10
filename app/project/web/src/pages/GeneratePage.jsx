import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppSidebar from '../components/AppSidebar';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { subjectsAPI, examsAPI, coursesAPI, practicalSeriesAPI, theoreticalSeriesAPI, archiveAPI } from '../api/client';

const AI_SUBJECTS    = ['algo', 'se', 'commerce', 'Law', 'compilation'];

// Demo alias map: maps keywords in subject name → AI dataset key (case-insensitive)
// Add any name your demo subjects might have
const DEMO_ALIASES = [
  { keywords: ['algo', 'algorithm', 'structure', 'données', 'data'],     subject: 'algo'        },
  { keywords: ['se', 'système', 'systeme', 'operating', 'exploit'],      subject: 'se'          },
  { keywords: ['commerce', 'commercial', 'extérieur', 'trade'],          subject: 'commerce'    },
  { keywords: ['law', 'droit', 'juridique', 'legal'],                    subject: 'Law'         },
  { keywords: ['compil', 'langage', 'language', 'automate', 'grammaire'],subject: 'compilation' },
];
const QUESTION_TYPES = ['MCQ', 'SAQ', 'Exercise'];
const LEVELS         = ['Mixed', 'Procedural', 'Conceptual', 'Metacognitive'];
const PATTERN_OPTIONS = [
  { value: 'auto',                  label: 'Auto',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> },
  { value: 'all_QCM',               label: 'All QCM',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { value: 'all_practical',         label: 'All Practical',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
  { value: 'all_theory',            label: 'All Theory',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
  { value: 'theory_then_practical', label: 'Theory → Practical',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> },
  { value: 'mixed',                 label: 'Mixed',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg> },
];
const EXAM_FORGE_URL = '/exam-forge';

const VERDICT = {
  pass:   { bg: 'rgba(122,171,128,0.12)', border: 'rgba(122,171,128,0.3)',   color: '#6ee7b7', icon: '✓', label: 'Pass' },
  flag:   { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',    color: '#f59e0b', icon: '⚠', label: 'Needs review' },
  reject: { bg: 'rgba(224,92,53,0.12)',   border: 'rgba(224,92,53,0.3)',     color: '#f87171', icon: '✗', label: 'Rejected' },
};

export default function GeneratePage() {
  const { subjectId } = useParams();
  const navigate      = useNavigate();
  const { addToast }  = useToast();
  const { user, refreshUser } = useContext(AuthContext);
  const { t } = useTranslation();

  const [quotaBlocked, setQuotaBlocked] = useState(false);

  const [subject, setSubject]             = useState(null);
  const [exams, setExams]                 = useState([]);
  const [selectedExam, setSelectedExam]   = useState('');
  const [contentCounts, setContentCounts] = useState(null);
  const [subjectStats, setSubjectStats]   = useState([]);
  const [templates, setTemplates]         = useState({});
  const [mode, setMode]                   = useState('questions');

  const [qForm, setQForm] = useState({
    subject: 'algo', count: 5, question_type: 'MCQ',
    level: 'Mixed', topic: '', questions_per_exercise: 3,
  });
  const [eForm, setEForm] = useState({
    subject: 'algo', title: '', n_exercises: '', duration_minutes: '',
    total_points: '', target_level: 'Mixed', pattern_override: 'auto', topic: '',
  });

  const [questions, setQuestions]     = useState([]);
  const [exercises, setExercises]     = useState([]);
  const [examPlan, setExamPlan]       = useState(null);
  const [examFinal, setExamFinal]     = useState(null);
  const [evaluations, setEvaluations] = useState({});
  const [examples, setExamples]       = useState([]);
  const [status, setStatus]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [done, setDone]               = useState(false);
  const abortRef = useRef(null);

  const modeRef      = useRef(mode);
  const qFormRef     = useRef(qForm);
  const eFormRef     = useRef(eForm);
  const questionsRef = useRef([]);
  const exercisesRef = useRef([]);

  useEffect(() => {
    subjectsAPI.getOne(subjectId)
      .then(s => {
        setSubject(s);
        const name  = s.name?.toLowerCase() ?? '';
        // 1) exact/substring match (case-insensitive)
        let match = AI_SUBJECTS.find(a => name.includes(a.toLowerCase()));
        // 2) keyword alias fallback for demo subjects
        if (!match) {
          const alias = DEMO_ALIASES.find(a => a.keywords.some(kw => name.includes(kw)));
          if (alias) match = alias.subject;
        }
        if (match) { setQForm(f => ({ ...f, subject: match })); setEForm(f => ({ ...f, subject: match })); }
      })
      .catch(() => navigate('/login'));

    Promise.all([
      coursesAPI.getAll(subjectId).catch(() => []),
      practicalSeriesAPI.getAll(subjectId).catch(() => []),
      theoreticalSeriesAPI.getAll(subjectId).catch(() => []),
      examsAPI.getAll(subjectId).catch(() => []),
    ]).then(([courses, practical, theoretical, examList]) => {
      setContentCounts({ courses: courses.length, practical: practical.length, theoretical: theoretical.length, exams: examList.length });
      setExams(examList);
      if (examList.length > 0) setSelectedExam(String(examList[0].id));
    });

    const tid = user?.id ? `?teacher_id=${user.id}` : '';
    fetch(`${EXAM_FORGE_URL}/api/subjects${tid}`).then(r => r.json()).then(d => setSubjectStats(d.subjects || [])).catch(() => {});
    fetch(`${EXAM_FORGE_URL}/api/templates`).then(r => r.json())
      .then(d => { setTemplates(typeof d === 'object' && !Array.isArray(d) ? d : {}); })
      .catch(() => {});
  }, [subjectId, user?.id]);

  const activeSubject   = mode === 'questions' ? qForm.subject : eForm.subject;
  // Use teacher-specific stats if available, else fall back to mapped subject
  const teacherSubjectKey = user?.id ? `teacher_${user.id}` : null;
  const currentStats    = (teacherSubjectKey && subjectStats.find(s => s.subject === teacherSubjectKey))
                          || subjectStats.find(s => s.subject === activeSubject);
  const currentTemplate = templates[activeSubject] || templates[teacherSubjectKey];

  const handleGenerate = async () => {
    if (!selectedExam) return addToast('No exam found — create one first', 'error');
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    questionsRef.current = []; exercisesRef.current = [];
    setQuestions([]); setExercises([]); setExamPlan(null);
    setEvaluations({}); setExamples([]); setDone(false);
    setStatus('Connecting…');
    const token = localStorage.getItem('token');
    let url, body;
    if (mode === 'questions') {
      url  = `/api/v1/subjects/${subjectId}/exams/${selectedExam}/generate`;
      body = { ...qForm, count: Number(qForm.count), topic: qForm.topic.trim() || null, questions_per_exercise: Number(qForm.questions_per_exercise) };
    } else {
      url  = `/api/v1/subjects/${subjectId}/exams/${selectedExam}/generate-full-exam`;
      body = { subject: eForm.subject, title: eForm.title.trim() || null, topic: eForm.topic.trim() || null, target_level: eForm.target_level, ...(eForm.n_exercises && { n_exercises: Number(eForm.n_exercises) }), ...(eForm.duration_minutes && { duration_minutes: Number(eForm.duration_minutes) }), ...(eForm.total_points && { total_points: Number(eForm.total_points) }), ...(eForm.pattern_override !== 'auto' && { pattern_override: eForm.pattern_override }) };
    }
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body), signal: abortRef.current.signal });
      if (res.status === 401 || res.status === 403) { navigate('/login'); return; }
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Error'); }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const part of parts) {
          if (!part.trim()) continue;
          let type = '', data = '';
          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) type = line.slice(7).trim();
            else if (line.startsWith('data: ')) data = line.slice(6).trim();
          }
          if (!data || !type) continue;
          const p = JSON.parse(data);
          if (type === 'status')     setStatus(p.message);
          if (type === 'example')    setExamples(prev => [...prev, p]);
          if (type === 'question')   { const q = { type: p.type, data: p.data }; questionsRef.current = [...questionsRef.current, q]; setQuestions(prev => [...prev, q]); }
          if (type === 'evaluation') setEvaluations(prev => ({ ...prev, [p.idx]: p.result }));
          if (type === 'plan')       setExamPlan(p);
          if (type === 'exercise')   { exercisesRef.current = [...exercisesRef.current, p.exercise]; setExercises(prev => [...prev, p.exercise]); }
          if (type === 'done') {
            setDone(true);
            if (p.exam) setExamFinal(p.exam);
            addToast(`Done — ${p.total || p.total_exercises} generated`, 'success');
            saveToArchive(modeRef.current, qFormRef.current, eFormRef.current, questionsRef.current, exercisesRef.current, p.exam).catch(() => {});
          }
          if (type === 'error') throw new Error(p.message);
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') addToast(e.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { qFormRef.current = qForm; }, [qForm]);
  useEffect(() => { eFormRef.current = eForm; }, [eForm]);

  const handleAbort = () => { abortRef.current?.abort(); setLoading(false); setStatus(''); };

  async function saveToArchive(snapMode, snapQForm, snapEForm, snapQuestions, snapExercises, snapExam) {
    const isQ     = snapMode === 'questions';
    const subj    = isQ ? snapQForm.subject : snapEForm.subject;
    const title   = isQ ? `${snapQForm.question_type} · ${snapQForm.level} · ${snapQuestions.length} questions` : snapEForm.title || `Full Exam · ${snapEForm.subject}`;
    const content = isQ ? snapQuestions : (snapExam || { exercises: snapExercises });
    try {
      await archiveAPI.save({ ai_subject: subj, title, mode: isQ ? 'questions' : 'full_exam', content });
      refreshUser();
    } catch (e) {
      if (e.message?.includes('limit reached') || e.message?.includes('402')) {
        setQuotaBlocked(true);
      }
    }
  }

  const handleSave = async (q) => {
    try { await fetch(`${EXAM_FORGE_URL}/api/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: activeSubject, type: q.type, data: q.data }) }); addToast('Question saved ✓', 'success'); }
    catch { addToast('Save failed', 'error'); }
  };

  const handleFavoriteQuestion = async (q, customName) => {
    const auto = `${q.type} · ${activeSubject} · ${q.data?.level || qForm.level} · ${new Date().toLocaleDateString('fr-FR')}`;
    const title = customName?.trim() || auto;
    try {
      await archiveAPI.save({ ai_subject: activeSubject, title, mode: 'questions', content: [q], status: 'accepted' });
      refreshUser();
      addToast('Ajouté aux favoris ✓', 'success');
    } catch (e) {
      if (e.message?.includes('limit reached') || e.message?.includes('402')) setQuotaBlocked(true);
      else addToast('Erreur lors de la sauvegarde', 'error');
    }
  };

  const handleFavoriteExercise = async (ex, customName) => {
    const auto = `${ex.title || 'Exercice'} · ${activeSubject} · ${new Date().toLocaleDateString('fr-FR')}`;
    const title = customName?.trim() || auto;
    try {
      await archiveAPI.save({ ai_subject: activeSubject, title, mode: 'full_exam', content: { exercises: [ex] }, status: 'accepted' });
      refreshUser();
      addToast('Ajouté aux favoris ✓', 'success');
    } catch (e) {
      if (e.message?.includes('limit reached') || e.message?.includes('402')) setQuotaBlocked(true);
      else addToast('Erreur lors de la sauvegarde', 'error');
    }
  };

  const handleUpdateQuestion = (idx, newQ) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? newQ : q));
  };

  const handleUpdateExercise = (idx, newEx) => {
    setExercises(prev => prev.map((ex, i) => i === idx ? newEx : ex));
  };

  const handleSaveAll = async () => {
    if (mode === 'questions') {
      let ok = 0;
      for (const q of questions) {
        try { await fetch(`${EXAM_FORGE_URL}/api/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: activeSubject, type: q.type, data: q.data }) }); ok++; }
        catch { /* skip */ }
      }
      addToast(`${ok} / ${questions.length} questions saved ✓`, 'success');
    } else {
      openInBuilder();
    }
  };

  const handleRegenQuestion = async (idx) => {
    if (!selectedExam) return;
    const token = localStorage.getItem('token');
    const body  = { ...qForm, count: 1, topic: qForm.topic.trim() || null, questions_per_exercise: Number(qForm.questions_per_exercise) };
    const url   = `/api/v1/subjects/${subjectId}/exams/${selectedExam}/generate`;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) });
      if (!res.ok) { addToast('Regeneration failed', 'error'); return; }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = '';
      while (true) {
        const { done: d, value } = await reader.read(); if (d) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const part of parts) {
          let type = '', data = '';
          for (const line of part.split('\n')) { if (line.startsWith('event: ')) type = line.slice(7).trim(); else if (line.startsWith('data: ')) data = line.slice(6).trim(); }
          if (type === 'question' && data) {
            const p = JSON.parse(data);
            const newQ = { type: p.type, data: p.data };
            setQuestions(prev => prev.map((q, i) => i === idx ? newQ : q));
            setEvaluations(prev => { const n = { ...prev }; delete n[idx]; return n; });
            addToast('Question regenerated ✓', 'success');
            return;
          }
        }
      }
    } catch { addToast('Regeneration failed', 'error'); }
  };

  const handleRegenExercise = async (idx, critique) => {
    if (!selectedExam) return;
    const token = localStorage.getItem('token');
    const ex = exercises[idx];
    const body = {
      subject: eForm.subject,
      level: eForm.target_level || 'Mixed',
      count: 1,
      question_type: 'Exercise',
      questions_per_exercise: ex?.questions?.length || Number(eForm.questions_per_exercise) || 3,
      topic: eForm.topic?.trim() || null,
      critique: critique || null,
    };
    const url = `/api/v1/subjects/${subjectId}/exams/${selectedExam}/generate`;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) });
      if (!res.ok) { addToast('Regeneration failed', 'error'); return; }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = '';
      while (true) {
        const { done: d, value } = await reader.read(); if (d) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const part of parts) {
          let type = '', data = '';
          for (const line of part.split('\n')) { if (line.startsWith('event: ')) type = line.slice(7).trim(); else if (line.startsWith('data: ')) data = line.slice(6).trim(); }
          if (type === 'question' && data) {
            const p = JSON.parse(data);
            if (p.type === 'Exercise') {
              setExercises(prev => prev.map((e, i) => i === idx ? p.data : e));
              setEvaluations(prev => { const n = { ...prev }; delete n[idx]; return n; });
              addToast('Exercise regenerated ✓', 'success');
            }
          }
          if (type === 'evaluation' && data) {
            const p = JSON.parse(data);
            setEvaluations(prev => ({ ...prev, [idx]: p.result }));
          }
        }
      }
    } catch { addToast('Regeneration failed', 'error'); }
  };

  const resetGenerate = () => { setQuestions([]); setExercises([]); setExamPlan(null); setExamFinal(null); setEvaluations({}); setExamples([]); setDone(false); setStatus(''); };
  const totalResults = mode === 'questions' ? questions.length : exercises.length;

  function openInBuilder() {
    const src = examFinal?.exercises ?? exercises;
    const examItems = src.map((ex, i) => ({
      _bankId:    `gen_${i}_${Date.now()}`,
      _examId:    `gen_${i}_${Date.now()}`,
      _sourceId:  'generated',
      _sourceTitle: eForm.subject,
      ai_subject: eForm.subject,
      title:      ex.title || `Exercise ${i + 1}`,
      introduction_context: ex.introduction_context || '',
      questions:  (ex.questions || []).map(q => ({
        id:            q.id,
        type:          q.type,
        question_text: q.question_text,
        choices:       q.choices || [],
        points:        q.points ?? null,
        level:         q.level ?? null,
      })),
      total_exercise_points: ex.total_exercise_points ?? null,
      type: 'exercise',
    }));
    const draftKey = user?.id ? `exam_builder_draft_${user.id}` : 'exam_builder_draft';
    localStorage.setItem(draftKey, JSON.stringify({ examItems, headerData: {} }));
    navigate('/exam-builder');
  }

  return (
    <>
    <div className="gen-page h-screen flex bg-light-bg dark:bg-[#00053B]">

      <AppSidebar active="subjects"
        backTo={`/subjects/${subjectId}`}
        backLabel={subject?.name || 'Back to Subject'} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Page title + stop button — always visible */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 relative z-10 mx-5 mt-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, #2563eb, #0891b2)', boxShadow: '0 4px 20px rgba(37,99,235,0.35)' }}>
          <span className="text-[15px] font-bold text-white flex items-center gap-1.5">
            <img src="/image/3775742-bulb-creative-idea-light-thunder_108969.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }} />
            {t('generate.title')}
          </span>
          {loading && (
            <button onClick={handleAbort}
              className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-mono hover:bg-red-500/20 transition-colors">
              {t('generate.stop')}
            </button>
          )}
        </div>

      <div className="flex-1 min-h-0 overflow-hidden flex max-w-[1280px] mx-auto w-full gap-5">

        {/* ── LEFT: Controls — scrollable independently ── */}
        <div className="w-[320px] shrink-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3.5 p-6 pr-3">

          {/* Mode selector */}
          <div className="flex gap-1.5">
            <ModeBtn active={mode === 'questions'} onClick={() => setMode('questions')}>
              <img src="/image/3775742-bulb-creative-idea-light-thunder_108969.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain', verticalAlign: 'middle' }} /> {t('generate.questions')}
            </ModeBtn>
            <ModeBtn active={mode === 'full-exam'} onClick={() => setMode('full-exam')}>
              <img src="/image/exam_multiple_choice_document_icon_208911.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain', verticalAlign: 'middle' }} /> {t('generate.fullExam')}
            </ModeBtn>
          </div>

          {/* QUESTIONS FORM — single collapsible with internal scroll */}
          {mode === 'questions' && (
            <Panel title="Generation Settings" collapsible defaultOpen={true} scrollable>

              {/* Dataset info — flat, no sub-arrows */}
              {contentCounts && (
                <div className="grid grid-cols-4 gap-1.5 mb-1">
                  {[['Courses', contentCounts.courses], ['Practical', contentCounts.practical], ['Theoretical', contentCounts.theoretical], ['Exams', contentCounts.exams]].map(([label, val]) => (
                    <div key={label} className="flex flex-col items-center py-2 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                      <span className={`text-[15px] font-extrabold font-mono leading-none ${val > 0 ? 'text-white' : 'text-white/20'}`}>{val}</span>
                      <span className="text-[9px] text-white/35 font-mono mt-0.5">{label}</span>
                    </div>
                  ))}
                </div>
              )}
              {currentStats && (
                <div className="flex flex-wrap gap-1 mb-1">
                  <span className="text-[10px] text-white/25 font-mono w-full mb-0.5">{subject?.name || activeSubject} dataset · {currentStats.total} questions</span>
                  {Object.entries(currentStats.levels).map(([lvl, cnt]) => (
                    <span key={lvl} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.07] text-white/50 font-mono">
                      {lvl} · {cnt}
                    </span>
                  ))}
                </div>
              )}
              <div className="border-t border-white/[0.06]" />

              <FieldLabel>Question Type</FieldLabel>
              <div className="flex gap-1.5">
                {QUESTION_TYPES.map(t => (
                  <Chip key={t} active={qForm.question_type === t} onClick={() => setQForm(f => ({ ...f, question_type: t }))}>{t}</Chip>
                ))}
              </div>

              <FieldLabel>Level</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map(l => (
                  <Chip key={l} active={qForm.level === l} onClick={() => setQForm(f => ({ ...f, level: l }))}>{l}</Chip>
                ))}
              </div>

              <div>
                <FieldLabel>Count</FieldLabel>
                <input type="number" min="1" max="20" value={qForm.count}
                  onChange={e => setQForm(f => ({ ...f, count: e.target.value }))} className="gen-input w-full" />
              </div>

              {qForm.question_type === 'Exercise' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <FieldLabel>Exercises</FieldLabel>
                    <select value={qForm.count}
                      onChange={e => setQForm(f => ({ ...f, count: e.target.value }))}
                      className="gen-select w-full">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Questions / Exercise</FieldLabel>
                    <select value={qForm.questions_per_exercise}
                      onChange={e => setQForm(f => ({ ...f, questions_per_exercise: Number(e.target.value) }))}
                      className="gen-select w-full">
                      {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <FieldLabel>Topic (optional)</FieldLabel>
              <input placeholder="e.g. binary trees, semaphores…" value={qForm.topic}
                onChange={e => setQForm(f => ({ ...f, topic: e.target.value }))} className="gen-input w-full" />
            </Panel>
          )}

          {/* FULL EXAM FORM — single collapsible with internal scroll */}
          {mode === 'full-exam' && (
            <Panel title="Full Exam Settings" scrollable>

              {/* Dataset info — flat, no sub-arrows */}
              {contentCounts && (
                <div className="grid grid-cols-4 gap-1.5 mb-1">
                  {[['Courses', contentCounts.courses], ['Practical', contentCounts.practical], ['Theoretical', contentCounts.theoretical], ['Exams', contentCounts.exams]].map(([label, val]) => (
                    <div key={label} className="flex flex-col items-center py-2 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                      <span className={`text-[15px] font-extrabold font-mono leading-none ${val > 0 ? 'text-white' : 'text-white/20'}`}>{val}</span>
                      <span className="text-[9px] text-white/35 font-mono mt-0.5">{label}</span>
                    </div>
                  ))}
                </div>
              )}
              {currentStats && (
                <div className="flex flex-wrap gap-1 mb-1">
                  <span className="text-[10px] text-white/25 font-mono w-full mb-0.5">{subject?.name || activeSubject} dataset · {currentStats.total} questions</span>
                  {Object.entries(currentStats.levels).map(([lvl, cnt]) => (
                    <span key={lvl} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.07] text-white/50 font-mono">
                      {lvl} · {cnt}
                    </span>
                  ))}
                  {currentTemplate && (
                    <span className="text-[10px] text-white/25 font-mono w-full mt-0.5">
                      {currentTemplate.dominant_pattern} · {currentTemplate.n_exercises_typical} ex · {currentTemplate.total_points_typical}pts · {currentTemplate.duration_minutes_typical}min
                    </span>
                  )}
                </div>
              )}
              <div className="border-t border-white/[0.06]" />

              {/* Template type */}
              <FieldLabel>Template type</FieldLabel>
              <div className="flex flex-col gap-1">
                {PATTERN_OPTIONS.map(p => (
                  <button key={p.value} onClick={() => setEForm(f => ({ ...f, pattern_override: p.value }))}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-[12px] font-mono transition-all text-left ${
                      eForm.pattern_override === p.value
                        ? 'bg-light-secondary/15 dark:bg-violet-500/15 border-light-secondary/40 dark:border-violet-500/40 text-light-secondary dark:text-violet-300'
                        : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/65 hover:border-white/15'
                    }`}>
                    <span className={eForm.pattern_override === p.value ? 'text-light-secondary dark:text-violet-300' : 'text-white/30'}>
                      {p.icon}
                    </span>
                    {p.label}
                    {p.value === 'auto' && currentTemplate && (
                      <span className="ml-auto text-[10px] text-white/25 font-mono">
                        {currentTemplate.dominant_pattern} · {currentTemplate.n_exams_analyzed} exams
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Blueprint hint when auto */}
              {eForm.pattern_override === 'auto' && currentTemplate?.exercise_blueprints?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {currentTemplate.exercise_blueprints.map((bp, i) => (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                      bp.type === 'THEORY' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' :
                      bp.type === 'QCM'    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' :
                                            'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    }`}>
                      Ex{bp.position} {bp.type} · {bp.typical_q_count}q{bp.typical_points ? ` · ${bp.typical_points}pts` : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* Level */}
              <FieldLabel>Level</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map(l => <Chip key={l} active={eForm.target_level===l} onClick={() => setEForm(f => ({ ...f, target_level: l }))}>{l}</Chip>)}
              </div>

              {/* Exercises + Points */}
              <div className="flex flex-col gap-2">
                <div>
                  <FieldLabel>Exercises <span className="text-white/30 font-normal">(total)</span></FieldLabel>
                  <input type="number" min="1" max="8" placeholder="auto"
                    value={eForm.n_exercises} onChange={e => setEForm(f => ({ ...f, n_exercises: e.target.value }))} className="gen-input w-full" />
                </div>
                <div>
                  <FieldLabel>Points <span className="text-white/30 font-normal">(exam total)</span></FieldLabel>
                  <input type="number" min="1" placeholder="auto"
                    value={eForm.total_points} onChange={e => setEForm(f => ({ ...f, total_points: e.target.value }))} className="gen-input w-full" />
                </div>
              </div>

              {/* Topic */}
              <FieldLabel>Topic (optional)</FieldLabel>
              <input placeholder="e.g. graphs, sorting…" value={eForm.topic}
                onChange={e => setEForm(f => ({ ...f, topic: e.target.value }))} className="gen-input w-full" />

              {/* Exam title */}
              <FieldLabel>Exam title (optional)</FieldLabel>
              <input placeholder="e.g. Exam 1 — 2024" value={eForm.title}
                onChange={e => setEForm(f => ({ ...f, title: e.target.value }))} className="gen-input w-full" />
            </Panel>
          )}

          {/* Quota pill */}
          {user && (
            <QuotaPill count={user.exam_count ?? 0} limit={user.exam_limit ?? 10} />
          )}

          {/* Generate button */}
          {(() => {
            const overQuota  = user && (user.exam_count ?? 0) >= (user.exam_limit ?? 10);
            const isDisabled = loading || !selectedExam || overQuota;
            return (
          <button onClick={overQuota ? () => setQuotaBlocked(true) : handleGenerate} disabled={loading || !selectedExam}
            className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all
              ${loading
                ? 'gen-btn-loading bg-violet-600/60 dark:bg-violet-600/60 text-white cursor-default'
                : overQuota
                  ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400 cursor-pointer hover:bg-amber-500/25'
                  : isDisabled
                    ? 'bg-white/10 text-white/40 cursor-default'
                    : 'bg-light-secondary text-white hover:bg-light-primary shadow-[0_4px_20px_rgba(8,145,178,0.35)] dark:bg-violet-600 dark:hover:bg-violet-500 dark:shadow-[0_4px_20px_rgba(139,92,246,0.35)]'
              }`}>
            {loading
              ? <><GenSpin /> {mode === 'questions' ? 'Generating questions…' : 'Building exam…'}</>
              : overQuota
                ? <>⚡ Upgrade to Generate More</>
                : mode === 'questions'
                  ? <><img src="/image/3775742-bulb-creative-idea-light-thunder_108969.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain', verticalAlign: 'middle' }} /> Generate Questions</>
                  : <><img src="/image/exam_multiple_choice_document_icon_208911.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain', verticalAlign: 'middle' }} /> Generate Full Exam</>
            }
          </button>
            );
          })()}
        </div>
        </div>

        {/* ── RIGHT: Results — scrollable independently ── */}
        <div className={`flex-1 min-w-0 min-h-0 overflow-y-auto p-6 pl-3 transition-all duration-500 ${loading ? 'gen-glowing' : ''}`}>
          {!loading && totalResults === 0 && !done ? (
            <GenEmptyState mode={mode} />
          ) : (
            <div className="flex flex-col gap-4">

              {/* Status bar */}
              <div className="flex justify-between items-center flex-wrap gap-2">
                {done ? (
                  <>
                    <span className="text-sm text-emerald-400 font-semibold flex items-center gap-1.5">
                      <img src="/image/ok_accept_approve_checklist_tick_check_mark_confirm_icon_267804.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                      {totalResults} {mode === 'questions' ? 'questions' : 'exercises'} generated
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={handleSaveAll}
                        className="text-xs px-3 py-1.5 bg-transparent border border-sky-500/25 rounded-lg text-sky-400 font-mono hover:bg-sky-500/8 transition-colors">
                        ↓ Save All
                      </button>
                      <button onClick={resetGenerate} className="text-xs text-light-accent dark:text-violet-300 bg-transparent border-none cursor-pointer font-mono">
                        ← new generation
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="gen-pulse-dot" />
                    <span className="gen-pulse-dot" style={{ animationDelay: '0.2s' }} />
                    <span className="gen-pulse-dot" style={{ animationDelay: '0.4s' }} />
                    <span className="text-xs text-white/50 font-mono ml-1">{status}</span>
                  </div>
                )}
              </div>

              {/* Full exam plan */}
              {mode === 'full-exam' && examPlan && (
                <div className="bg-white/[0.06] border border-white/10 rounded-xl p-3.5">
                  <p className="text-[10px] text-white/50 font-mono uppercase tracking-[1px] mb-2">Exam Plan</p>
                  <div className="flex flex-wrap gap-2 text-xs font-mono">
                    <span className="text-white">{examPlan.subject}</span>
                    <span className="text-white/25">·</span>
                    <span className="text-white/50">{examPlan.n_exercises} exercises</span>
                    {examPlan.total_points && <><span className="text-white/25">·</span><span className="text-white/50">{examPlan.total_points}pts</span></>}
                    {examPlan.duration_minutes && <><span className="text-white/25">·</span><span className="text-white/50">{examPlan.duration_minutes}min</span></>}
                  </div>
                </div>
              )}

              {examples.length > 0 && <ActivityFeed examples={examples} />}

              {mode === 'questions' && questions.map((q, i) => (
                <QuestionCard key={i} q={q} index={i} total={questions.length}
                  evaluation={evaluations[i] ?? null}
                  onSave={() => handleSave(q)}
                  onRegen={() => handleRegenQuestion(i)}
                  onUpdate={(newQ) => handleUpdateQuestion(i, newQ)}
                  onFavorite={(name) => handleFavoriteQuestion(q, name)} />
              ))}

              {mode === 'full-exam' && exercises.map((ex, i) => (
                <ExerciseCard key={ex.id || i} ex={ex} index={i}
                  total={examPlan?.n_exercises || exercises.length}
                  subject={eForm.subject} examForgeUrl={EXAM_FORGE_URL}
                  evaluation={evaluations[i] ?? null}
                  onUpdate={(newEx) => handleUpdateExercise(i, newEx)}
                  onRegen={(critique) => handleRegenExercise(i, critique)}
                  onFavorite={(name) => handleFavoriteExercise(ex, name)} />
              ))}

              {mode === 'full-exam' && done && exercises.length > 0 && (
                <div className="mt-2">
                  <button onClick={openInBuilder}
                    className="w-full py-3 px-5 rounded-xl font-semibold text-sm transition-all"
                    style={{ background: 'var(--color-amber, #8b5cf6)', color: '#fff' }}>
                    Open in Document Builder →
                  </button>
                </div>
              )}

              {loading && totalResults === 0 && (
                <div className="text-center py-16 text-white/25 text-xs font-mono">
                  <GenSpin size={20} /><br /><br />
                  {mode === 'questions' ? 'Studying previous questions…' : 'Planning exam structure…'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* ── Dark mode (default) ── */
        .gen-select, .gen-input {
          padding: 8px 11px; background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.10);
          border-radius: 8px; font-size: 13px; color: #fff; outline: none; transition: border-color 0.15s;
        }
        .gen-select:focus, .gen-input:focus { border-color: rgba(8,145,178,0.5); }
        .gen-select option { background: #020840; }
        .gen-input::placeholder { color: rgba(255,255,255,0.2); }
        @keyframes fadeSlide { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

        /* ── Generation glow ── */
        @keyframes genGlow {
          0%, 100% { box-shadow: 0 0 0px rgba(139,92,246,0), inset 0 0 0px rgba(139,92,246,0); }
          50%       { box-shadow: 0 0 40px rgba(139,92,246,0.18), inset 0 0 20px rgba(8,145,178,0.07); }
        }
        @keyframes pulseDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
        @keyframes scanLine {
          0%   { top: -4px; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .gen-glowing {
          animation: genGlow 2s ease-in-out infinite;
          position: relative;
        }
        .gen-glowing::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: 0;
          animation: scanLine 3s linear infinite;
          background: linear-gradient(180deg, transparent, rgba(139,92,246,0.06) 50%, transparent);
          z-index: 0;
        }
        .gen-glowing > * { position: relative; z-index: 1; }
        .gen-pulse-dot {
          display: inline-block;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: rgba(139,92,246,0.8);
          animation: pulseDot 1.2s ease-in-out infinite;
        }
        html:not(.dark) .gen-glowing::before { background: linear-gradient(180deg, transparent, rgba(8,145,178,0.05) 50%, transparent); }
        html:not(.dark) .gen-pulse-dot { background: rgba(8,145,178,0.8); }
        html:not(.dark) .gen-glowing { animation: none; box-shadow: 0 0 0 2px rgba(8,145,178,0.15); }

        @keyframes btnPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.5); }
          50%       { box-shadow: 0 0 0 8px rgba(139,92,246,0); }
        }
        .gen-btn-loading { animation: btnPulse 1.5s ease-in-out infinite; }
        html:not(.dark) .gen-btn-loading {
          animation: btnPulse 1.5s ease-in-out infinite;
          --pulse-color: rgba(8,145,178,0.5);
        }

        /* ── Light mode overrides ── */
        html:not(.dark) .gen-page { background: #f0f9ff; }
        html:not(.dark) .gen-page [class*="text-white"]:not([class*="from-"]):not([class*="to-"]) { color: #164e63 !important; }
        html:not(.dark) .gen-page [class*="text-white/25"] { color: rgba(15,79,101,0.45) !important; }
        html:not(.dark) .gen-page [class*="text-white/40"] { color: rgba(15,79,101,0.60) !important; }
        html:not(.dark) .gen-page [class*="text-white/50"] { color: rgba(15,79,101,0.75) !important; }
        html:not(.dark) .gen-page [class*="text-white/20"] { color: rgba(15,79,101,0.35) !important; }
        html:not(.dark) .gen-page [class*="text-white"]:not([class*="/"]):not([class*="from-"]):not([class*="to-"]) { color: #0f4f65 !important; }
        html:not(.dark) .gen-page [class*="bg-white/"]    { background: rgba(8,145,178,0.06) !important; }
        html:not(.dark) .gen-page [class*="bg-white/\\[0.04\\]"] { background: rgba(8,145,178,0.05) !important; }
        html:not(.dark) .gen-page [class*="bg-white/\\[0.06\\]"] { background: rgba(8,145,178,0.07) !important; }
        html:not(.dark) .gen-page [class*="border-white/"]  { border-color: rgba(8,145,178,0.18) !important; }
        html:not(.dark) .gen-page [class*="border-b"]       { border-color: rgba(8,145,178,0.18) !important; }
        html:not(.dark) .gen-page [class*="border-t"]       { border-color: rgba(8,145,178,0.18) !important; }
        html:not(.dark) .gen-page [class*="border-l-white"] { border-color: rgba(8,145,178,0.35) !important; }
        html:not(.dark) .gen-page [class*="bg-black/"]      { background: rgba(8,145,178,0.05) !important; }
        html:not(.dark) .gen-page [class*="border-black/"]  { border-color: rgba(8,145,178,0.12) !important; }
        html:not(.dark) .gen-select, html:not(.dark) .gen-input {
          background: #fff; border-color: #bae6fd; color: #164e63;
        }
        html:not(.dark) .gen-select option         { background: #fff; color: #164e63; }
        html:not(.dark) .gen-input::placeholder    { color: rgba(71,85,105,0.4); }
        html:not(.dark) .gen-page .text-emerald-400  { color: #059669 !important; }
        html:not(.dark) .gen-page .text-red-400      { color: #dc2626 !important; }
        html:not(.dark) .gen-page .text-amber-400    { color: #d97706 !important; }
      `}</style>
      </div>
    </div>

    {/* Upgrade modal */}
    {quotaBlocked && <UpgradeModal onClose={() => setQuotaBlocked(false)} limit={user?.exam_limit ?? 10} userEmail={user?.email} />}
    </>
  );
}

/* ── QuotaPill ─────────────────────────────────────────────────────────── */
function QuotaPill({ count, limit }) {
  const pct      = Math.min(count / limit, 1);
  const remaining = Math.max(limit - count, 0);
  const isWarn   = pct >= 0.7;
  const isFull   = pct >= 1;

  const trackColor = isFull ? 'bg-red-500/30'   : isWarn ? 'bg-amber-500/30'   : 'bg-emerald-500/20';
  const fillColor  = isFull ? 'bg-red-400'       : isWarn ? 'bg-amber-400'      : 'bg-emerald-400';
  const textColor  = isFull ? 'text-red-400'     : isWarn ? 'text-amber-400'    : 'text-emerald-400';
  const borderCol  = isFull ? 'border-red-500/30': isWarn ? 'border-amber-500/30': 'border-emerald-500/20';

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${borderCol} bg-white/[0.03]`}>
      <div className={`flex-1 h-1.5 rounded-full ${trackColor} overflow-hidden`}>
        <div className={`h-full rounded-full transition-all duration-500 ${fillColor}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className={`text-[11px] font-mono ${textColor} flex-shrink-0`}>
        {isFull ? 'Limit reached' : `${remaining} free generation${remaining !== 1 ? 's' : ''} left`}
      </span>
    </div>
  );
}

/* ── UpgradeModal ──────────────────────────────────────────────────────── */
const CONTACT_EMAIL = 'abuhussamab@gmail.com';

function UpgradeModal({ onClose, limit, userEmail }) {
  const subject = encodeURIComponent('Upgrade Request — ExamGen');
  const body    = encodeURIComponent(
    `Hello,\n\nI have reached the free plan limit (${limit} generations) and would like to upgrade my account.\n\nAccount email: ${userEmail || '—'}\n\nThank you.`
  );
  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[420px] bg-[#0f1117] border border-amber-500/30 rounded-3xl p-8 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[32px]">
            ⚡
          </div>
        </div>

        <h2 className="text-[22px] font-extrabold text-white text-center tracking-tight mb-2">
          Free plan limit reached
        </h2>
        <p className="text-sm text-white/60 text-center leading-relaxed mb-1">
          You've used all <span className="text-amber-400 font-semibold">{limit} free generations</span>.
        </p>
        <p className="text-sm text-white/60 text-center leading-relaxed mb-6">
          Send us an email and we'll upgrade your account.
        </p>

        {/* Email preview */}
        <div className="mb-5 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[12px] font-mono text-white/50 break-all">
          <span className="text-white/30 block mb-0.5">To:</span>
          <span className="text-amber-400">{CONTACT_EMAIL}</span>
          <span className="text-white/30 block mt-2 mb-0.5">Your email:</span>
          <span className="text-white/70">{userEmail || '—'}</span>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={mailtoHref}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm text-center shadow-[0_4px_20px_rgba(245,158,11,0.4)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.55)] hover:-translate-y-0.5 transition-all"
            style={{ textDecoration: 'none' }}
          >
            ✉ Send upgrade request
          </a>
          <button
            className="w-full py-2.5 rounded-2xl border border-white/10 text-white/50 text-sm font-mono hover:border-white/20 hover:text-white/70 transition-all"
            onClick={onClose}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ExerciseCard ──────────────────────────────────────────────────────── */
function ExerciseCard({ ex, index, total, subject, examForgeUrl, evaluation, onUpdate, onRegen, onFavorite }) {
  const EX_LETTERS = ['A','B','C','D','E'];
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [open, setOpen]           = useState(true);
  const [editing, setEditing]     = useState(false);
  const [draft, setDraft]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [favOpen, setFavOpen]     = useState(false);
  const [favName, setFavName]     = useState('');
  const [favSaving, setFavSaving] = useState(false);
  const [favDone, setFavDone]     = useState(false);
  const [regening, setRegening]   = useState(false);
  const [evalOpen, setEvalOpen]   = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);

  const VERDICT = {
    pass:   { icon: '✓', cls: 'text-emerald-400', label: 'Pass' },
    flag:   { icon: '⚑', cls: 'text-amber-400',   label: 'Flag' },
    reject: { icon: '✕', cls: 'text-red-400',      label: 'Reject' },
  };
  const v = evaluation ? (VERDICT[evaluation.verdict] || VERDICT.flag) : null;
  const isRejected = evaluation?.verdict === 'reject';

  const handleRegen = async () => {
    setRegening(true);
    await onRegen?.(evaluation?.notes || null);
    setRegening(false);
  };

  const handleFavConfirm = async () => {
    setFavSaving(true);
    await onFavorite(favName);
    setFavSaving(false);
    setFavOpen(false);
    setFavName('');
    setFavDone(true);
    setTimeout(() => setFavDone(false), 3000);
  };
  const pts = ex.total_exercise_points;

  function startEdit()  { setDraft(JSON.parse(JSON.stringify(ex))); setEditing(true); setSaveError(null); setOpen(true); }
  function cancelEdit() { setEditing(false); setSaveError(null); }

  async function saveEdit() {
    if (!draft) return; setSaving(true); setSaveError(null);
    try {
      const res = await fetch(`${examForgeUrl}/api/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, type: 'Exercise', data: draft }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Validation failed'); }
      onUpdate?.(draft);
      setSaved(true); setEditing(false);
    } catch (e) { setSaveError(e.message || 'Validation failed'); }
    finally { setSaving(false); }
  }

  const setDraftField    = (f, v) => setDraft(d => ({ ...d, [f]: v }));
  const setDraftQuestion = (qi, f, v) => setDraft(d => ({ ...d, questions: d.questions.map((q,i) => i===qi ? {...q,[f]:v} : q) }));
  const setDraftChoice   = (qi, ci, v) => setDraft(d => ({ ...d, questions: d.questions.map((q,i) => i!==qi ? q : {...q, choices: q.choices.map((c,j) => j===ci ? v : c)}) }));
  const addChoice        = (qi) => setDraft(d => ({ ...d, questions: d.questions.map((q,i) => i!==qi ? q : {...q, choices: [...(q.choices||[]),'']}) }));
  const removeChoice     = (qi,ci) => setDraft(d => ({ ...d, questions: d.questions.map((q,i) => i!==qi ? q : {...q, choices: q.choices.filter((_,j)=>j!==ci)}) }));

  const displayEx = editing && draft ? draft : ex;

  return (
    <div className={`bg-white/[0.06] border rounded-2xl overflow-hidden ${
      isRejected ? 'border-red-500/30' : saved ? 'border-emerald-500/30' : evaluation?.verdict === 'flag' ? 'border-amber-500/20' : 'border-white/10'
    }`}
      style={{ animation: 'fadeSlide 0.3s ease' }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/[0.07]">
        <span className="font-mono text-xl text-light-primary dark:text-violet-400 font-bold min-w-[36px]">{String(index+1).padStart(2,'0')}</span>
        <span className="text-[10px] text-white/40 font-mono min-w-[36px]">of {total}</span>
        {editing && draft
          ? <input value={draft.title} onChange={e => setDraftField('title', e.target.value)} className="gen-input text-[13px] font-semibold flex-1" />
          : <span className="text-[13px] text-white font-semibold flex-1">{ex.title || `Exercise ${index+1}`}</span>
        }
        {pts && <span className="text-[11px] text-light-accent dark:text-violet-300 font-mono bg-light-primary/10 dark:bg-violet-500/10 px-2 py-0.5 rounded-full flex-shrink-0">{pts} pts</span>}
        {v && (
          <button onClick={() => setEvalOpen(o => !o)}
            className={`text-[11px] font-mono px-2 py-0.5 rounded-md border transition-colors flex-shrink-0 ${
              evaluation.verdict === 'pass'   ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' :
              evaluation.verdict === 'reject' ? 'border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20' :
                                               'border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
            }`}>
            {v.icon} {v.label}
          </button>
        )}
        <button onClick={() => setOpen(!open)} className="text-white/40 text-[11px] bg-transparent border-none cursor-pointer px-1">{open ? '▲' : '▼'}</button>
      </div>

      {/* Evaluation panel */}
      {evalOpen && evaluation && (
        <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.03] flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {[
              { ok: evaluation.factual_ok,          label: 'Factual' },
              { ok: evaluation.level_correct,        label: 'Level' },
              { ok: evaluation.quality === 'good',   label: evaluation.quality === 'good' ? 'Good quality' : evaluation.quality === 'needs_revision' ? 'Needs revision' : 'Poor quality' },
              { ok: evaluation.difficulty_ok,        label: 'Difficulty' },
              { ok: evaluation.points_calibration === 'fair', label: 'Points fair' },
            ].map(({ ok, label }) => (
              <span key={label} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${ok ? 'border-emerald-500/20 text-emerald-400' : 'border-red-500/20 text-red-400'}`}>
                {ok ? '✓' : '✕'} {label}
              </span>
            ))}
            {evaluation.estimated_minutes && (
              <span className="text-[10px] text-white/25 font-mono">~{evaluation.estimated_minutes}min</span>
            )}
          </div>
          {evaluation.notes && <p className="text-[11px] text-white/40 leading-relaxed">{evaluation.notes}</p>}
          {(isRejected || evaluation.verdict === 'flag') && onRegen && (
            <button onClick={handleRegen} disabled={regening}
              className={`self-start text-[11px] px-2.5 py-1 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 font-mono hover:bg-red-500/20 transition-colors ${regening ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}>
              {regening ? '…' : '↻ Regen with critique'}
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="px-4 py-3.5 flex flex-col gap-2.5">
          {/* Context */}
          {editing && draft ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/40 font-mono uppercase tracking-[0.15em]">Context</span>
              <textarea value={draft.introduction_context||''} onChange={e => setDraftField('introduction_context', e.target.value)}
                rows={3} className="gen-input resize-y leading-relaxed" />
            </div>
          ) : displayEx.introduction_context ? (
            <div className="text-[13px] text-white/50 bg-white/[0.04] px-3.5 py-2.5 rounded-xl border border-white/[0.07] border-l-2 border-l-violet-500/40 leading-relaxed">
              <span className="font-mono text-light-accent dark:text-violet-300 text-[10px] uppercase tracking-[0.5px] mr-2">Context</span>
              {displayEx.introduction_context}
            </div>
          ) : null}

          {/* Reasoning (thinking out loud) */}
          {ex.reasoning && !editing && (
            <div>
              <button onClick={() => setReasonOpen(o => !o)}
                className="text-[10px] text-white/30 hover:text-white/50 font-mono flex items-center gap-1 transition-colors">
                <span>{reasonOpen ? '▲' : '▼'}</span> AI self-check
              </button>
              {reasonOpen && (
                <p className="text-[11px] text-white/30 bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2 mt-1 leading-relaxed italic">
                  {ex.reasoning}
                </p>
              )}
            </div>
          )}

          {/* Questions */}
          <div className="flex flex-col gap-2">
            {(displayEx.questions||[]).map((q,qi) => (
              <div key={qi} className="bg-white/[0.04] px-3.5 py-2.5 rounded-xl border border-white/[0.07]">
                {editing && draft ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-light-accent dark:text-violet-300 text-[11px] flex-shrink-0">Q{qi+1}</span>
                      <span className="text-[10px] bg-black/20 text-white/40 px-1.5 py-0.5 rounded-full font-mono">{q.type}</span>
                      {q.points !== undefined && (
                        <input type="number" min="1" max="20" value={q.points}
                          onChange={e => setDraftQuestion(qi,'points',Number(e.target.value))}
                          className="gen-input w-14 ml-auto text-center" placeholder="pts" />
                      )}
                    </div>
                    <textarea value={q.question_text||''} onChange={e => setDraftQuestion(qi,'question_text',e.target.value)}
                      rows={2} className="gen-input resize-y leading-relaxed" />
                    {q.choices && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] text-white/25 font-mono">Choices <span className="normal-case text-white/20">(click ○ to mark correct)</span></span>
                        {q.choices.map((c,ci) => (
                          <div key={ci} className="flex items-center gap-1.5">
                            <button onClick={() => setDraftQuestion(qi,'correct_index',ci)}
                              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${ci===q.correct_index ? 'border-emerald-400 bg-emerald-400/20' : 'border-white/20 hover:border-white/40'}`}>
                              {ci===q.correct_index && <span className="block w-2 h-2 rounded-full bg-emerald-400 m-auto" />}
                            </button>
                            <span className="font-mono text-light-accent dark:text-violet-300 text-[11px] w-4 flex-shrink-0">{EX_LETTERS[ci]}.</span>
                            <input value={c} onChange={e => setDraftChoice(qi,ci,e.target.value)} className="gen-input flex-1" />
                            <button onClick={() => removeChoice(qi,ci)} disabled={(q.choices?.length??0)<=2}
                              className={`text-[11px] bg-transparent border-none text-white/25 cursor-pointer ${(q.choices?.length??0)<=2 ? 'opacity-30 cursor-default' : ''}`}>✕</button>
                          </div>
                        ))}
                        {(q.choices?.length??0)<5 && (
                          <button onClick={() => addChoice(qi)} className="self-start text-[11px] px-2.5 py-1 bg-transparent border border-white/10 rounded-lg text-white/40 font-mono cursor-pointer hover:text-white/60 transition-colors">+ choice</button>
                        )}
                      </div>
                    )}
                    {!q.choices && (
                      <div>
                        <span className="text-[10px] text-white/25 font-mono uppercase tracking-[0.12em]">Model Answer</span>
                        <textarea value={q.model_answer||''} rows={2}
                          onChange={e => setDraftQuestion(qi,'model_answer',e.target.value)}
                          className="gen-input resize-y w-full mt-1 leading-relaxed" />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2.5 items-start">
                      <span className="font-mono text-light-accent dark:text-violet-300 text-[11px] flex-shrink-0 pt-0.5">Q{qi+1}</span>
                      <p className="text-[13px] text-white leading-relaxed flex-1">{q.question_text||q.stem}</p>
                      {q.points && <span className="text-[10px] text-white/25 font-mono flex-shrink-0">{q.points}pt</span>}
                    </div>
                    {q.choices?.length>0 && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        {q.choices.map((c,ci) => (
                          <div key={ci} className="text-xs flex gap-2 px-3 py-1.5 rounded-lg"
                            style={{
                              background: ci===q.correct_index ? 'rgba(122,171,128,0.12)' : 'transparent',
                              color:      ci===q.correct_index ? (dark ? '#6ee7b7' : '#15803d') : dark ? 'rgba(255,255,255,0.5)' : 'rgba(15,79,101,0.7)',
                              border:     `1px solid ${ci===q.correct_index ? 'rgba(122,171,128,0.25)' : dark ? 'rgba(255,255,255,0.06)' : 'rgba(8,145,178,0.12)'}`,
                            }}>
                            <span className="font-mono opacity-50">{EX_LETTERS[ci]}.</span>{c}
                          </div>
                        ))}
                      </div>
                    )}
                    {(q.model_answer||q.solution) && (
                      <p className="text-xs text-white/40 mt-1.5 leading-snug">
                        <span className="font-mono text-white/20 text-[10px] mr-1.5">answer</span>
                        {q.model_answer||(typeof q.solution==='string'?q.solution:'')}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-white/[0.07] flex-wrap">
        {editing ? (
          <>
            {saveError && <p className="text-[11px] text-red-400 w-full">{saveError}</p>}
            <button onClick={saveEdit} disabled={saving}
              className={`text-xs px-3.5 py-1.5 bg-sky-500 rounded-lg text-white font-semibold font-mono ${saving ? 'opacity-60 cursor-default' : 'cursor-pointer hover:bg-sky-400'} transition-colors`}>
              {saving ? 'Saving…' : 'Validate ✓'}
            </button>
            <button onClick={cancelEdit} disabled={saving}
              className="text-xs px-3 py-1.5 bg-transparent border border-white/10 rounded-lg text-white/40 font-mono cursor-pointer hover:text-white/60 transition-colors">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={startEdit}
              className="text-xs px-3 py-1.5 bg-transparent border border-white/10 rounded-lg text-white/40 font-mono cursor-pointer hover:text-white/60 hover:border-white/20 transition-all">
              Edit all questions
            </button>
            {saved && <span className="text-xs text-emerald-400 font-mono">✓ Validated</span>}
            {favDone ? (
              <span className="text-xs text-amber-400 font-mono">★ Saved to favorites!</span>
            ) : (
              <button onClick={() => { setFavOpen(v => !v); setFavName(''); }}
                className={`text-xs px-3 py-1.5 rounded-lg border font-mono cursor-pointer transition-colors ${favOpen ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-amber-400 hover:border-amber-500/30'}`}>
                ★ Favorite
              </button>
            )}
          </>
        )}
      </div>

      {/* Favorite name input */}
      {!editing && favOpen && (
        <div className="px-4 pb-4 flex gap-2 items-center" style={{ animation: 'fadeSlide 0.15s ease' }}>
          <input
            type="text"
            value={favName}
            onChange={e => setFavName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFavConfirm()}
            placeholder={`${ex.title || 'Exercise'} · ${subject} (auto)`}
            className="gen-input flex-1 text-[12px]"
            autoFocus
          />
          <button onClick={handleFavConfirm} disabled={favSaving}
            className="text-[11px] px-3 py-1.5 rounded-lg font-mono font-semibold flex-shrink-0 transition-colors"
            style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }}>
            {favSaving ? '…' : '★ Save'}
          </button>
          <button onClick={() => { setFavOpen(false); setFavName(''); }}
            className="text-[11px] px-2 py-1.5 rounded-lg text-white/30 hover:text-white/60 font-mono flex-shrink-0 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/* ── ActivityFeed ──────────────────────────────────────────────────────── */
function ActivityFeed({ examples }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/[0.06] border border-white/10 rounded-xl px-3.5 py-2.5">
      <div className="flex justify-between items-center">
        <p className="text-[11px] text-white/50 font-mono">Agent studying {examples.length} reference questions</p>
        <button onClick={() => setOpen(!open)} className="text-[11px] text-white/25 bg-transparent border-none cursor-pointer font-mono hover:text-white/50 transition-colors">
          {open ? 'hide' : 'show'}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto mt-2">
          {examples.map((ex,i) => (
            <div key={i} className="text-[11px] text-white/50 px-2.5 py-1.5 bg-white/[0.04] rounded-lg border border-white/[0.07] leading-snug">
              <span className="font-mono text-light-accent dark:text-violet-300 text-[10px] mr-1.5">{ex.level||'?'}</span>
              {ex.stem?.slice(0,100)}{ex.stem?.length>100?'…':''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── QuestionCard ──────────────────────────────────────────────────────── */
function QuestionCard({ q, index, total, evaluation, onSave, onRegen, onUpdate, onFavorite }) {
  const [open, setOpen]               = useState(true);
  const [evalOpen, setEvalOpen]       = useState(false);
  const [showSol, setShowSol]         = useState(false);
  const [regening, setRegening]       = useState(false);
  const [editing, setEditing]         = useState(false);
  const [draft, setDraft]             = useState(null);
  const [favOpen, setFavOpen]         = useState(false);
  const [favName, setFavName]         = useState('');
  const [favSaving, setFavSaving]     = useState(false);
  const [favDone, setFavDone]         = useState(false);
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const v = evaluation ? (VERDICT[evaluation.verdict] || VERDICT.flag) : null;
  const isRejected = evaluation?.verdict === 'reject';

  const handleFavConfirm = async () => {
    setFavSaving(true);
    await onFavorite(favName);
    setFavSaving(false);
    setFavOpen(false);
    setFavName('');
    setFavDone(true);
    setTimeout(() => setFavDone(false), 3000);
  };

  const handleRegen = async () => { setRegening(true); await onRegen(); setRegening(false); setShowSol(false); };

  function startEdit() { setDraft(JSON.parse(JSON.stringify(q.data))); setEditing(true); setOpen(true); }
  function cancelEdit() { setEditing(false); setDraft(null); }
  function saveEdit() { onUpdate({ type: q.type, data: draft }); setEditing(false); setDraft(null); setShowSol(false); }

  const setDStr  = (f, v) => setDraft(d => ({ ...d, [f]: v }));
  const setDChoice = (ci, v) => setDraft(d => ({ ...d, choices: d.choices.map((c,i) => i===ci ? v : c) }));
  const addChoice  = () => setDraft(d => ({ ...d, choices: [...(d.choices||[]), ''] }));
  const rmChoice   = (ci) => setDraft(d => {
    const nc = d.choices.filter((_,i) => i!==ci);
    return { ...d, choices: nc, correct_index: d.correct_index >= nc.length ? nc.length-1 : d.correct_index };
  });

  return (
    <div className={`bg-white/[0.06] border rounded-2xl overflow-hidden transition-all ${editing ? 'border-violet-500/40' : 'border-white/10'}`}
      style={{ animation: 'fadeSlide 0.3s ease' }}>

      {/* Header */}
      <div className="w-full flex items-center gap-2.5 px-4 py-3.5 border-b border-white/[0.05]">
        <button onClick={() => !editing && setOpen(!open)}
          className="flex items-center gap-2.5 flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left">
          <span className="font-mono text-2xl text-light-primary dark:text-violet-400 font-bold min-w-[36px]">{String(index+1).padStart(2,'0')}</span>
          <span className="text-[10px] text-white/40 font-mono min-w-[36px]">of {total}</span>
          <span className="text-[10px] bg-light-primary/10 dark:bg-violet-500/10 text-light-accent dark:text-violet-300 px-2 py-0.5 rounded-full font-mono">{q.type}</span>
          {q.data.level && <span className="text-[10px] text-white/40 font-mono bg-white/[0.06] px-2 py-0.5 rounded-full">{q.data.level}</span>}
          {q.data.topic && <span className="text-[11px] text-white/25 flex-1 truncate">{q.data.topic}</span>}
        </button>
        {!editing && (
          <button onClick={startEdit}
            className="text-[11px] px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white/40 font-mono hover:text-violet-300 hover:border-violet-500/40 transition-all flex-shrink-0">
            ✎ Edit
          </button>
        )}
        <button onClick={() => setOpen(!open)} className="text-white/40 text-[11px] bg-transparent border-none cursor-pointer px-1 flex-shrink-0">
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-3">

          {/* ── EDIT MODE ── */}
          {editing && draft ? (
            <div className="flex flex-col gap-3">
              {/* Stem */}
              <div>
                <p className="text-[10px] text-white/35 font-mono uppercase tracking-[0.15em] mb-1">Question</p>
                <textarea value={draft.stem||draft.title||''} rows={3}
                  onChange={e => setDStr(draft.stem !== undefined ? 'stem' : 'title', e.target.value)}
                  className="gen-input resize-y w-full leading-relaxed" />
              </div>

              {/* MCQ choices */}
              {q.type==='MCQ' && draft.choices && (
                <div>
                  <p className="text-[10px] text-white/35 font-mono uppercase tracking-[0.15em] mb-1.5">Choices <span className="normal-case text-white/20">(click ○ to mark correct)</span></p>
                  <div className="flex flex-col gap-1.5">
                    {draft.choices.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-2">
                        <button onClick={() => setDStr('correct_index', ci)}
                          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${ci===draft.correct_index ? 'border-emerald-400 bg-emerald-400/20' : 'border-white/20 hover:border-white/40'}`}
                          title="Mark as correct">
                          {ci===draft.correct_index && <span className="block w-2 h-2 rounded-full bg-emerald-400 m-auto" />}
                        </button>
                        <span className="font-mono text-white/30 text-[11px] w-4 flex-shrink-0">{String.fromCharCode(65+ci)}.</span>
                        <input value={c} onChange={e => setDChoice(ci, e.target.value)} className="gen-input flex-1" />
                        <button onClick={() => rmChoice(ci)} disabled={draft.choices.length<=2}
                          className={`text-[11px] bg-transparent border-none text-white/25 cursor-pointer ${draft.choices.length<=2 ? 'opacity-30 cursor-default' : 'hover:text-red-400'}`}>✕</button>
                      </div>
                    ))}
                    {draft.choices.length < 6 && (
                      <button onClick={addChoice} className="self-start text-[11px] px-2.5 py-1 bg-transparent border border-white/10 rounded-lg text-white/40 font-mono cursor-pointer hover:text-white/60 mt-1">+ choice</button>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] text-white/35 font-mono uppercase tracking-[0.15em] mb-1">Explanation (optional)</p>
                    <textarea value={draft.explanation||''} rows={2} placeholder="Explain why the correct answer is correct…"
                      onChange={e => setDStr('explanation', e.target.value)} className="gen-input resize-y w-full" />
                  </div>
                </div>
              )}

              {/* SAQ answer + rubric */}
              {q.type==='SAQ' && (
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-[10px] text-white/35 font-mono uppercase tracking-[0.15em] mb-1">Model Answer</p>
                    <textarea value={draft.model_answer||''} rows={3}
                      onChange={e => setDStr('model_answer', e.target.value)} className="gen-input resize-y w-full leading-relaxed" />
                  </div>
                  {draft.grading_rubric?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-white/35 font-mono uppercase tracking-[0.15em] mb-1">Rubric points</p>
                      {draft.grading_rubric.map((r,ri) => (
                        <div key={ri} className="flex items-center gap-2 mb-1">
                          <span className="text-emerald-400 text-[11px] flex-shrink-0">✓</span>
                          <input value={r} onChange={e => setDraft(d => ({ ...d, grading_rubric: d.grading_rubric.map((x,i) => i===ri ? e.target.value : x) }))} className="gen-input flex-1" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Exercise sub-questions */}
              {q.type==='Exercise' && draft.questions?.map((sq,si) => (
                <div key={si} className="bg-white/[0.04] rounded-xl border border-white/[0.07] px-3 py-2.5 flex flex-col gap-2">
                  <p className="text-[10px] text-white/35 font-mono">Q{si+1}</p>
                  <textarea value={sq.stem||''} rows={2} onChange={e => setDraft(d => ({ ...d, questions: d.questions.map((q,i) => i===si ? {...q, stem: e.target.value} : q) }))} className="gen-input resize-y w-full" />
                  <input value={sq.model_answer||''} placeholder="Model answer…"
                    onChange={e => setDraft(d => ({ ...d, questions: d.questions.map((q,i) => i===si ? {...q, model_answer: e.target.value} : q) }))} className="gen-input w-full" />
                </div>
              ))}

              {/* Save / Cancel */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                <button onClick={saveEdit}
                  className="text-xs px-3.5 py-1.5 bg-violet-600 rounded-lg text-white font-semibold font-mono cursor-pointer hover:bg-violet-500 transition-colors">
                  ✓ Save changes
                </button>
                <button onClick={cancelEdit}
                  className="text-xs px-3 py-1.5 bg-transparent border border-white/10 rounded-lg text-white/40 font-mono cursor-pointer hover:text-white/60 transition-colors">
                  Cancel
                </button>
              </div>
            </div>

          ) : (
            /* ── DISPLAY MODE ── */
            <>
              <p className="text-sm text-white leading-[1.7] my-2.5">{q.data.stem||q.data.title}</p>

              {q.type==='MCQ' && q.data.choices && (
                <div className="flex flex-col gap-1.5 mb-3">
                  {q.data.choices.map((c,ci) => (
                    <div key={ci} className="text-[13px] flex gap-2.5 items-start px-3.5 py-2 rounded-xl"
                      style={{
                        background: showSol && ci===q.data.correct_index ? 'rgba(122,171,128,0.12)' : dark ? 'rgba(255,255,255,0.04)' : 'rgba(8,145,178,0.05)',
                        color:      showSol && ci===q.data.correct_index ? (dark ? '#6ee7b7' : '#15803d') : dark ? 'rgba(255,255,255,0.55)' : 'rgba(15,79,101,0.75)',
                        border:     `1px solid ${showSol && ci===q.data.correct_index ? 'rgba(122,171,128,0.25)' : dark ? 'rgba(255,255,255,0.07)' : 'rgba(8,145,178,0.12)'}`,
                        fontWeight: showSol && ci===q.data.correct_index ? 600 : 400,
                      }}>
                      <span className="font-mono opacity-50 flex-shrink-0">{String.fromCharCode(65+ci)}.</span>{c}
                    </div>
                  ))}
                  {showSol && q.data.explanation && (
                    <div className="text-xs text-white/40 mt-1 px-3 py-2.5 bg-white/[0.04] rounded-xl border border-white/[0.07] leading-relaxed italic">
                      <img src="/image/3775742-bulb-creative-idea-light-thunder_108969.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain', display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{q.data.explanation}
                    </div>
                  )}
                </div>
              )}

              {q.type==='SAQ' && showSol && (
                <div className="flex flex-col gap-2 mb-3">
                  {q.data.model_answer && (
                    <div className="text-[13px] text-white/50 bg-white/[0.04] px-3.5 py-2.5 rounded-xl border border-white/[0.07] leading-relaxed">
                      <span className="font-mono text-light-accent dark:text-violet-300 text-[10px] uppercase tracking-[0.5px] mr-2">Answer</span>
                      {q.data.model_answer}
                    </div>
                  )}
                  {q.data.grading_rubric?.length>0 && (
                    <div className="px-3.5 py-2.5 bg-white/[0.04] rounded-xl border border-white/[0.07]">
                      <p className="text-[10px] text-light-accent dark:text-violet-300 font-mono uppercase tracking-[0.5px] mb-2">Rubric ({q.data.points} pts)</p>
                      {q.data.grading_rubric.map((r,i) => (
                        <p key={i} className="text-xs text-white/40 leading-relaxed flex gap-2"><span className="text-emerald-400 flex-shrink-0">✓</span>{r}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {q.type==='Exercise' && (
                <div className="flex flex-col gap-2 mb-3">
                  {q.data.context && (
                    <div className="text-[13px] text-white/50 bg-white/[0.04] px-3.5 py-2.5 rounded-xl border border-white/[0.07] leading-relaxed">
                      <span className="font-mono text-light-accent dark:text-violet-300 text-[10px] uppercase tracking-[0.5px] mr-2">Context</span>{q.data.context}
                    </div>
                  )}
                  {q.data.questions?.map((sq,si) => (
                    <div key={si} className="bg-white/[0.04] px-3.5 py-2.5 rounded-xl border border-white/[0.07]">
                      <p className="text-[13px] text-white leading-relaxed flex gap-2">
                        <span className="font-mono text-light-accent dark:text-violet-300 text-[11px] flex-shrink-0">Q{si+1}</span>{sq.stem}
                      </p>
                      {showSol && sq.model_answer && (
                        <p className="text-xs text-white/40 mt-1.5 leading-snug">
                          <span className="font-mono text-white/20 text-[10px] mr-1.5">answer</span>{sq.model_answer}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {(q.data.model_answer || q.data.correct_index !== undefined || q.data.explanation || q.data.grading_rubric?.length > 0 || q.data.questions?.some(sq => sq.model_answer)) && (
                  <button onClick={() => setShowSol(s => !s)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition-colors ${showSol ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'}`}>
                    {showSol ? '▲ Hide Solution' : '▼ Show Solution'}
                  </button>
                )}
              </div>

              {/* Evaluation row */}
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {v ? (
                    <>
                      <button onClick={() => setEvalOpen(!evalOpen)}
                        className="text-[11px] px-2.5 py-1 rounded-lg border cursor-pointer font-mono font-semibold transition-colors"
                        style={{ background: v.bg, borderColor: v.border, color: v.color }}>
                        {v.icon} {v.label}
                      </button>
                      {!evaluation.factual_ok && <EvalBadge type="error">⚑ Factual error</EvalBadge>}
                      {!evaluation.level_correct && evaluation.corrected_level && <EvalBadge type="warn">Level → {evaluation.corrected_level}</EvalBadge>}
                      {evaluation.points_calibration!=='fair' && <EvalBadge type="warn">⚖ {evaluation.points_calibration==='too_low'?'Points too low':'Points too high'}</EvalBadge>}
                      {!evaluation.difficulty_ok && <EvalBadge type="warn">⚡ Difficulty mismatch</EvalBadge>}
                      {evaluation.estimated_minutes && <span className="text-[11px] text-white/25 font-mono">~{evaluation.estimated_minutes}min</span>}
                    </>
                  ) : (
                    <span className="text-[11px] text-white/25 font-mono flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-spin" />
                      Evaluating…
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {isRejected && (
                    <button onClick={handleRegen} disabled={regening}
                      className={`text-[11px] px-2.5 py-1 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 font-mono cursor-pointer hover:bg-red-500/20 transition-colors ${regening ? 'opacity-50 cursor-default' : ''}`}>
                      {regening ? '…' : '↻ Regen'}
                    </button>
                  )}
                  <button onClick={onSave}
                    className="text-[11px] px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white/40 font-mono cursor-pointer flex-shrink-0 hover:text-white/60 transition-colors">
                    ↓ Save
                  </button>
                  {favDone ? (
                    <span className="text-[11px] text-amber-400 font-mono flex-shrink-0">★ Saved!</span>
                  ) : (
                    <button onClick={() => { setFavOpen(v => !v); setFavName(''); }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono cursor-pointer flex-shrink-0 transition-colors ${favOpen ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-amber-400 hover:border-amber-500/30'}`}>
                      ★ Favorite
                    </button>
                  )}
                </div>
              </div>

              {/* Favorite name input */}
              {favOpen && (
                <div className="mt-2 flex gap-2 items-center" style={{ animation: 'fadeSlide 0.15s ease' }}>
                  <input
                    type="text"
                    value={favName}
                    onChange={e => setFavName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFavConfirm()}
                    placeholder={`${q.type} · ${q.data?.level || ''} · ${q.data?.topic || ''} (auto)`}
                    className="gen-input flex-1 text-[12px]"
                    autoFocus
                  />
                  <button onClick={handleFavConfirm} disabled={favSaving}
                    className="text-[11px] px-3 py-1.5 rounded-lg font-mono font-semibold transition-colors flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }}>
                    {favSaving ? '…' : '★ Save'}
                  </button>
                  <button onClick={() => { setFavOpen(false); setFavName(''); }}
                    className="text-[11px] px-2 py-1.5 rounded-lg text-white/30 hover:text-white/60 transition-colors flex-shrink-0 font-mono"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    ✕
                  </button>
                </div>
              )}
            </>
          )}

          {evalOpen && !editing && evaluation && (
            <div className="mt-2.5 px-3.5 py-3 bg-white/[0.04] rounded-xl border border-white/[0.07]">
              <p className="text-[10px] text-white/25 font-mono uppercase tracking-[0.5px] mb-2">Evaluator report</p>
              <div className="flex flex-wrap gap-2.5 text-xs mb-2">
                <EvalItem ok={evaluation.factual_ok} label="Factual accuracy" />
                <EvalItem ok={evaluation.level_correct} label="Cognitive level" />
                <EvalItem ok={evaluation.quality==='good'} label={evaluation.quality==='good'?'Good quality':evaluation.quality==='needs_revision'?'Needs revision':'Poor quality'} />
                <EvalItem ok={evaluation.difficulty_ok} label="Difficulty" />
                <EvalItem ok={evaluation.points_calibration==='fair'} label="Points fair" />
              </div>
              {evaluation.notes && <p className="text-xs text-white/40 leading-relaxed">{evaluation.notes}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Utility components ────────────────────────────────────────────────── */
function EvalItem({ ok, label }) {
  return <span className={ok ? 'text-emerald-400' : 'text-red-400'}>{ok?'✓':'✗'} {label}</span>;
}

function EvalBadge({ type, children }) {
  const cls = type==='error'
    ? 'bg-red-500/10 border-red-500/25 text-red-400'
    : 'bg-amber-500/10 border-amber-500/25 text-amber-400';
  return <span className={`text-[11px] px-2 py-0.5 rounded-lg border font-mono ${cls}`}>{children}</span>;
}

function Panel({ title, children, collapsible = false, defaultOpen = true, scrollable = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white/[0.06] border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3.5 ${collapsible ? 'cursor-pointer hover:bg-white/[0.04] transition-colors' : 'cursor-default'}`}
      >
        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-[1px] font-mono">{title}</p>
        {collapsible && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`text-white/30 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}>
            <polyline points="2,4 6,8 10,4" />
          </svg>
        )}
      </button>
      {/* CSS grid rows trick — smooth animation with no max-h clipping */}
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.3s ease-out, opacity 0.25s ease-out',
        opacity: open ? 1 : 0,
      }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div
            className="flex flex-col gap-2.5 px-4 pb-4"
            style={scrollable ? { overflowY: 'auto', maxHeight: '420px' } : undefined}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <p className="text-[11px] text-white/50 font-mono -mb-1">{children}</p>;
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] cursor-pointer font-mono transition-all
        ${active ? 'bg-light-primary/10 border-light-primary/40 text-light-accent dark:bg-violet-500/10 dark:border-violet-500/40 dark:text-violet-300' : 'bg-transparent border-white/10 text-white/40 hover:text-white/60'}`}>
      {children}
    </button>
  );
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-2.5 rounded-xl border text-[13px] cursor-pointer font-bold transition-all
        ${active ? 'bg-light-primary/10 border-light-primary/40 text-light-accent dark:bg-violet-500/10 dark:border-violet-500/40 dark:text-violet-300' : 'bg-white/[0.04] border-white/10 text-white/40 font-normal hover:text-white/60'}`}>
      {children}
    </button>
  );
}

function GenEmptyState({ mode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 opacity-40">
      <div className="flex items-center justify-center w-16 h-16">
        <img src={mode==='questions' ? '/image/3775742-bulb-creative-idea-light-thunder_108969.png' : '/image/exam_multiple_choice_document_icon_208911.png'} alt="" style={{ width: 72, height: 72, objectFit: 'contain', opacity: 0.4 }} />
      </div>
      <p className="text-[17px] text-white font-bold">{mode==='questions'?'Generate Questions':'Generate Full Exam'}</p>
      <p className="text-xs text-white/50 text-center max-w-[240px] leading-relaxed font-mono">
        {mode==='questions'
          ? 'Choose subject, type and level, then click Generate'
          : 'Choose subject and click Generate — everything else is optional'}
      </p>
    </div>
  );
}

function GenSpin({ size = 14 }) {
  return <span style={{ width: size, height: size }} className="border-2 border-white/20 border-t-white/60 rounded-full inline-block animate-spin flex-shrink-0" />;
}
