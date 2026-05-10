import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Animated, Modal, Alert, Platform, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';
import {
  subjectsAPI, examsAPI, coursesAPI,
  practicalSeriesAPI, theoreticalSeriesAPI, archiveAPI,
} from '../api/client';

// ── SSE client (custom, handles POST) ──────────────────────────────────
function postSSE(url, body, onEvent, signal) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  const token = global.token; // Pass token globally, or get from AsyncStorage
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.responseType = 'text';
  let lastIndex = 0;
  let buffer = '';

  xhr.onprogress = () => {
    const newData = xhr.responseText.substring(lastIndex);
    lastIndex = xhr.responseText.length;
    buffer += newData;
    const parts = buffer.split('\n\n');
    buffer = parts.pop();
    parts.forEach(part => {
      if (!part.trim()) return;
      let type = '', data = '';
      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) type = line.slice(7).trim();
        else if (line.startsWith('data: ')) data = line.slice(6).trim();
      }
      if (type && data) {
        try {
          const parsed = JSON.parse(data);
          onEvent(type, parsed);
        } catch (e) {}
      }
    });
  };

  xhr.onloadend = () => { if (signal?.aborted) return; /* done */ };
  xhr.send(JSON.stringify(body));
  return xhr;
}

// ── Constants ───────────────────────────────────────────────────────────
const AI_SUBJECTS = ['algo', 'se', 'commerce', 'Law', 'compilation'];
const DEMO_ALIASES = [
  { keywords: ['algo', 'algorithm', 'structure', 'données', 'data'], subject: 'algo' },
  { keywords: ['se', 'système', 'systeme', 'operating', 'exploit'], subject: 'se' },
  { keywords: ['commerce', 'commercial', 'extérieur', 'trade'], subject: 'commerce' },
  { keywords: ['law', 'droit', 'juridique', 'legal'], subject: 'Law' },
  { keywords: ['compil', 'langage', 'language', 'automate', 'grammaire'], subject: 'compilation' },
];
const QUESTION_TYPES = ['MCQ', 'SAQ', 'Exercise'];
const LEVELS = ['Mixed', 'Procedural', 'Conceptual', 'Metacognitive'];
const PATTERN_OPTIONS = ['auto', 'all_QCM', 'all_practical', 'all_theory', 'theory_then_practical', 'mixed'];

/* ── Main Screen ───────────────────────────────────────────────────────── */
export default function GenerateScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { subjectId } = route.params;
  const { theme } = useTheme();
  const { addToast } = useToast();
  const { user, refreshUser } = useContext(AuthContext);

  const [subject, setSubject] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [contentCounts, setContentCounts] = useState(null);
  const [templates, setTemplates] = useState({});
  const [mode, setMode] = useState('questions');
  const [quotaBlocked, setQuotaBlocked] = useState(false);

  // Forms
  const [qForm, setQForm] = useState({
    subject: 'algo', count: '5', question_type: 'MCQ', level: 'Mixed', topic: '', questions_per_exercise: '3',
  });
  const [eForm, setEForm] = useState({
    subject: 'algo', title: '', n_exercises: '', duration_minutes: '', total_points: '', target_level: 'Mixed', pattern_override: 'auto', topic: '',
  });

  // Generation state
  const [questions, setQuestions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [examPlan, setExamPlan] = useState(null);
  const [examFinal, setExamFinal] = useState(null);
  const [evaluations, setEvaluations] = useState({});
  const [examples, setExamples] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const xhrRef = useRef(null);
  const [exerciseOptsOpen, setExerciseOptsOpen] = useState(false);

  // Fetch subject and its data
  useEffect(() => {
    (async () => {
      try {
        const s = await subjectsAPI.getOne(subjectId);
        setSubject(s);
        const name = s.name?.toLowerCase() ?? '';
        let match = AI_SUBJECTS.find(a => name.includes(a.toLowerCase()));
        if (!match) match = DEMO_ALIASES.find(a => a.keywords.some(kw => name.includes(kw)))?.subject;
        if (match) {
          setQForm(prev => ({ ...prev, subject: match }));
          setEForm(prev => ({ ...prev, subject: match }));
        }
      } catch (e) { navigation.goBack(); }

      const [courses, practical, theoretical, examList] = await Promise.all([
        coursesAPI.getAll(subjectId).catch(() => []),
        practicalSeriesAPI.getAll(subjectId).catch(() => []),
        theoreticalSeriesAPI.getAll(subjectId).catch(() => []),
        examsAPI.getAll(subjectId).catch(() => []),
      ]);
      setContentCounts({ courses: courses.length, practical: practical.length, theoretical: theoretical.length, exams: examList.length });
      setExams(examList);
      if (examList.length) setSelectedExam(String(examList[0].id));
    })();
  }, [subjectId]);

  // Load templates (if you have that endpoint, same as web)
  useEffect(() => {
    fetch('https://your-server.com/exam-forge/api/templates')
      .then(r => r.json())
      .then(d => { const map = {}; (d.templates || []).forEach(t => { map[t.subject] = t; }); setTemplates(map); })
      .catch(() => {});
  }, []);

  const activeSubject = mode === 'questions' ? qForm.subject : eForm.subject;
  const currentTemplate = templates[activeSubject];

  const handleGenerate = async () => {
    if (!selectedExam) return addToast('No exam found', 'error');
    if (xhrRef.current) xhrRef.current.abort();
    setLoading(true);
    setQuestions([]); setExercises([]); setExamPlan(null); setExamFinal(null);
    setEvaluations({}); setExamples([]); setDone(false);
    setStatus('Connecting…');

    const token = await AsyncStorage.getItem('token');
    global.token = token;

    let url, body;
    if (mode === 'questions') {
      url = `${API_BASE_URL}/subjects/${subjectId}/exams/${selectedExam}/generate`;
      body = { ...qForm, count: Number(qForm.count), topic: qForm.topic.trim() || null, questions_per_exercise: Number(qForm.questions_per_exercise) };
    } else {
      url = `${API_BASE_URL}/subjects/${subjectId}/exams/${selectedExam}/generate-full-exam`;
      body = {
        subject: eForm.subject,
        title: eForm.title.trim() || null,
        topic: eForm.topic.trim() || null,
        target_level: eForm.target_level,
        ...(eForm.n_exercises ? { n_exercises: Number(eForm.n_exercises) } : {}),
        ...(eForm.duration_minutes ? { duration_minutes: Number(eForm.duration_minutes) } : {}),
        ...(eForm.total_points ? { total_points: Number(eForm.total_points) } : {}),
        ...(eForm.pattern_override !== 'auto' ? { pattern_override: eForm.pattern_override } : {}),
      };
    }

    xhrRef.current = postSSE(url, body, (type, data) => {
      switch (type) {
        case 'status':    setStatus(data.message); break;
        case 'example':   setExamples(prev => [...prev, data]); break;
        case 'question':
          setQuestions(prev => [...prev, { type: data.type, data: data.data }]);
          break;
        case 'evaluation':
          setEvaluations(prev => ({ ...prev, [data.idx]: data.result }));
          break;
        case 'plan':      setExamPlan(data); break;
        case 'exercise':
          setExercises(prev => [...prev, data.exercise]);
          break;
        case 'done':
          setDone(true);
          if (data.exam) setExamFinal(data.exam);
          addToast(`Done – ${data.total || data.total_exercises} generated`, 'success');
          saveToArchive(mode, data.exam);
          break;
        case 'error':     addToast(data.message, 'error'); abort();
      }
    });
  };

  const abort = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      setLoading(false);
      setStatus('');
    }
  };

  const saveToArchive = async (modeSnap, examSnap) => {
    const isQ = modeSnap === 'questions';
    const subj = isQ ? qForm.subject : eForm.subject;
    const title = isQ
      ? `${qForm.question_type} · ${qForm.level} · ${questions.length} questions`
      : eForm.title || `Full Exam · ${eForm.subject}`;
    const content = isQ ? questions : (examSnap || { exercises });
    try {
      await archiveAPI.save({ ai_subject: subj, title, mode: isQ ? 'questions' : 'full_exam', content });
      refreshUser();
    } catch (e) {
      if (e.message?.includes('limit reached') || e.message?.includes('402')) {
        setQuotaBlocked(true);
      }
    }
  };

  const handleSaveAll = () => {
    if (mode === 'questions') {
      Alert.alert(t('generate.saveAllTitle'), t('generate.saveAllMessage'), [
        { text: 'OK', onPress: () => addToast('Saving...', 'info') },
      ]);
    } else {
      openInBuilder();
    }
  };

  const openInBuilder = () => {
    const src = examFinal?.exercises ?? exercises;
    const examItems = src.map((ex, i) => ({
      _bankId: `gen_${i}_${Date.now()}`,
      _examId: `gen_${i}_${Date.now()}`,
      _sourceId: 'generated',
      _sourceTitle: eForm.subject,
      ai_subject: eForm.subject,
      title: ex.title || `Exercise ${i + 1}`,
      introduction_context: ex.introduction_context || '',
      questions: ex.questions || [],
      total_exercise_points: ex.total_exercise_points ?? null,
      type: 'exercise',
    }));
    // Navigate to ExamBuilder with draft
    navigation.navigate('ExamBuilder', { draftItems: examItems });
  };

  // Auto-select AI subject from subject name (already handled)
  const totalResults = mode === 'questions' ? questions.length : exercises.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={[styles.headerBanner, { backgroundColor: theme.primary }]}>
          <Text style={styles.headerText}>{t('generate.title')}</Text>
          {loading && (
            <TouchableOpacity onPress={abort} style={styles.abortBtn}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t('generate.stop')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Subject overview */}
        {subject && contentCounts && (
          <View style={[styles.card, { backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#F8FAFC', borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontWeight: '600' }}>{subject.name}</Text>
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              {Object.entries(contentCounts).map(([k, v]) => (
                <View key={k} style={{ marginRight: 16 }}>
                  <Text style={{ color: theme.muted, fontSize: 10 }}>{k}</Text>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Mode selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'questions' && { borderColor: theme.primary }]}
            onPress={() => setMode('questions')}>
            <Text style={{ color: mode === 'questions' ? theme.primary : theme.muted }}>{t('generate.questions')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'full-exam' && { borderColor: theme.primary }]}
            onPress={() => setMode('full-exam')}>
            <Text style={{ color: mode === 'full-exam' ? theme.primary : theme.muted }}>{t('generate.fullExam')}</Text>
          </TouchableOpacity>
        </View>

        {/* Template stats (optional) */}
        {currentTemplate && (
          <View style={[styles.card, { borderColor: theme.border }]}>
            <Text style={{ color: theme.muted, fontSize: 12 }}>
              {activeSubject} · {currentTemplate.dominant_pattern} · {currentTemplate.n_exercises_typical} ex · {currentTemplate.total_points_typical}pts
            </Text>
          </View>
        )}

        {/* Form – Questions */}
        {mode === 'questions' && (
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('generate.settings')}</Text>
            {/* Type */}
            <Text style={styles.label}>{t('generate.questionType')}</Text>
            <View style={styles.chipRow}>
              {QUESTION_TYPES.map(t => (
                <TouchableOpacity key={t} onPress={() => setQForm(prev => ({ ...prev, question_type: t }))}
                  style={[styles.chip, qForm.question_type === t && { borderColor: theme.primary, backgroundColor: theme.primary + '20' }]}>
                  <Text style={{ color: qForm.question_type === t ? theme.primary : theme.muted, fontSize: 12 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Level */}
            <Text style={styles.label}>{t('generate.level')}</Text>
            <View style={styles.chipRow}>
              {LEVELS.map(l => (
                <TouchableOpacity key={l} onPress={() => setQForm(prev => ({ ...prev, level: l }))}
                  style={[styles.chip, qForm.level === l && { borderColor: theme.primary, backgroundColor: theme.primary + '20' }]}>
                  <Text style={{ color: qForm.level === l ? theme.primary : theme.muted }}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Count */}
            <Text style={styles.label}>{t('generate.count')}</Text>
            <TextInput
              keyboardType="numeric"
              value={qForm.count}
              onChangeText={v => setQForm(prev => ({ ...prev, count: v }))}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#fff' }]}
            />
            {qForm.question_type === 'Exercise' && (
              <TouchableOpacity onPress={() => setExerciseOptsOpen(!exerciseOptsOpen)}
                style={[styles.optionToggle, { borderColor: theme.border }]}>
                <Text style={{ color: theme.muted }}>⚙ Options</Text>
              </TouchableOpacity>
            )}
            {exerciseOptsOpen && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.label}>Exercises</Text>
                <TextInput
                  keyboardType="numeric"
                  value={qForm.questions_per_exercise}
                  onChangeText={v => setQForm(prev => ({ ...prev, questions_per_exercise: v }))}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#fff' }]}
                />
              </View>
            )}
            {/* Topic */}
            <Text style={styles.label}>{t('generate.topic')}</Text>
            <TextInput
              value={qForm.topic}
              onChangeText={v => setQForm(prev => ({ ...prev, topic: v }))}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.mode === 'dark' ? '#1E293B' : '#fff' }]}
              placeholder="e.g. binary trees"
              placeholderTextColor={theme.muted}
            />
          </View>
        )}

        {/* Form – Full Exam */}
        {mode === 'full-exam' && (
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('generate.fullExamSettings')}</Text>
            {/* Pattern */}
            <Text style={styles.label}>{t('generate.pattern')}</Text>
            <View style={styles.chipRow}>
              {PATTERN_OPTIONS.map(p => (
                <TouchableOpacity key={p} onPress={() => setEForm(prev => ({ ...prev, pattern_override: p }))}
                  style={[styles.chip, eForm.pattern_override === p && { borderColor: theme.primary, backgroundColor: theme.primary + '20' }]}>
                  <Text style={{ color: eForm.pattern_override === p ? theme.primary : theme.muted }}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Level */}
            <Text style={styles.label}>{t('generate.level')}</Text>
            <View style={styles.chipRow}>
              {LEVELS.map(l => (
                <TouchableOpacity key={l} onPress={() => setEForm(prev => ({ ...prev, target_level: l }))}
                  style={[styles.chip, eForm.target_level === l && { borderColor: theme.primary, backgroundColor: theme.primary + '20' }]}>
                  <Text style={{ color: eForm.target_level === l ? theme.primary : theme.muted }}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Numeric */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Exercises</Text>
                <TextInput keyboardType="numeric" value={eForm.n_exercises} onChangeText={v => setEForm(prev => ({ ...prev, n_exercises: v }))} style={styles.inputSmall} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Points</Text>
                <TextInput keyboardType="numeric" value={eForm.total_points} onChangeText={v => setEForm(prev => ({ ...prev, total_points: v }))} style={styles.inputSmall} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Minutes</Text>
                <TextInput keyboardType="numeric" value={eForm.duration_minutes} onChangeText={v => setEForm(prev => ({ ...prev, duration_minutes: v }))} style={styles.inputSmall} />
              </View>
            </View>
            <Text style={styles.label}>Topic</Text>
            <TextInput value={eForm.topic} onChangeText={v => setEForm(prev => ({ ...prev, topic: v }))} style={styles.input} placeholderTextColor={theme.muted} />
            <Text style={styles.label}>Title</Text>
            <TextInput value={eForm.title} onChangeText={v => setEForm(prev => ({ ...prev, title: v }))} style={styles.input} placeholderTextColor={theme.muted} />
          </View>
        )}

        {/* Quota pill */}
        {user && (
          <View style={styles.quota}>
            <Text style={{ color: user.exam_count >= user.exam_limit ? '#EF4444' : theme.muted }}>
              {user.exam_count}/{user.exam_limit} generations used
            </Text>
          </View>
        )}

        {/* Generate button */}
        <TouchableOpacity
          onPress={loading ? null : handleGenerate}
          disabled={!selectedExam || loading}
          style={[styles.generateBtn, { backgroundColor: loading ? '#6D28D9' : theme.primary }]}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {mode === 'questions' ? t('generate.generateQuestions') : t('generate.generateExam')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Results */}
        {loading || done || totalResults > 0 ? (
          <View style={{ marginTop: 20 }}>
            {/* Status */}
            <Text style={{ color: theme.muted, fontSize: 12 }}>{status}</Text>

            {/* Plan (full exam) */}
            {examPlan && (
              <View style={[styles.card, { borderColor: theme.border }]}>
                <Text style={{ color: theme.text }}>{examPlan.subject} - {examPlan.n_exercises} ex, {examPlan.total_points} pts</Text>
              </View>
            )}

            {/* Examples feed */}
            {examples.length > 0 && (
              <View style={[styles.card, { borderColor: theme.border }]}>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Agent studying {examples.length} references</Text>
              </View>
            )}

            {/* Question cards */}
            {mode === 'questions' && questions.map((q, i) => (
              <QuestionCard
                key={i}
                question={q}
                index={i}
                total={questions.length}
                evaluation={evaluations[i]}
                onSave={() => addToast('Saved', 'success')}
                onRegen={() => {}}
                onFavorite={() => {}}
                theme={theme}
              />
            ))}

            {/* Exercise cards */}
            {mode === 'full-exam' && exercises.map((ex, i) => (
              <ExerciseCard
                key={ex.id || i}
                exercise={ex}
                index={i}
                total={exercises.length}
                subject={eForm.subject}
                onUpdate={() => {}}
                onFavorite={() => {}}
                theme={theme}
              />
            ))}

            {/* Open in Builder */}
            {mode === 'full-exam' && done && exercises.length > 0 && (
              <TouchableOpacity onPress={openInBuilder} style={[styles.button, { backgroundColor: '#F59E0B' }]}>
                <Text style={{ color: '#fff' }}>Open in Document Builder →</Text>
              </TouchableOpacity>
            )}

            {/* Save All button */}
            {done && totalResults > 0 && (
              <TouchableOpacity onPress={handleSaveAll} style={[styles.button, { backgroundColor: theme.primary }]}>
                <Text style={{ color: '#fff' }}>Save All</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={{ color: theme.muted, fontSize: 24 }}>📝</Text>
            <Text style={{ color: theme.muted, fontSize: 14 }}>No results yet</Text>
          </View>
        )}
      </ScrollView>

      {/* Upgrade Modal */}
      <Modal visible={quotaBlocked} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Upgrade Required</Text>
            <Text style={{ color: theme.muted }}>Free plan limit reached. Contact support to upgrade.</Text>
            <TouchableOpacity onPress={() => setQuotaBlocked(false)} style={[styles.button, { backgroundColor: theme.primary }]}>
              <Text style={{ color: '#fff' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── QuestionCard (simplified – editing/fav not fully implemented here for brevity, but you can expand) ──
function QuestionCard({ question, index, total, evaluation, onSave, onRegen, onFavorite, theme }) {
  const [expanded, setExpanded] = useState(false);
  const q = question;
  const verdict = evaluation?.verdict === 'pass' ? '✅' : evaluation?.verdict === 'flag' ? '⚠️' : '❌';

  return (
    <TouchableOpacity style={[styles.card, { borderColor: theme.border }]} onPress={() => setExpanded(!expanded)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.text, fontWeight: '600' }}>Q{index + 1}/{total} — {q.type}</Text>
        <Text style={{ color: theme.muted }}>{verdict}</Text>
      </View>
      {expanded && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: theme.text }}>{q.data?.stem || q.data?.title}</Text>
          {q.data?.choices && q.data.choices.map((c, ci) => (
            <Text key={ci} style={{ color: theme.muted }}>{String.fromCharCode(65 + ci)}. {c}</Text>
          ))}
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
            <TouchableOpacity onPress={onSave}><Text style={{ color: theme.primary }}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={onRegen}><Text style={{ color: '#EF4444' }}>Regen</Text></TouchableOpacity>
            <TouchableOpacity onPress={onFavorite}><Text style={{ color: '#F59E0B' }}>★ Fav</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ExerciseCard({ exercise, index, total, subject, onUpdate, onFavorite, theme }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity style={[styles.card, { borderColor: theme.border }]} onPress={() => setExpanded(!expanded)}>
      <Text style={{ color: theme.text, fontWeight: '600' }}>Ex {index + 1}/{total} — {exercise.title || 'Untitled'}</Text>
      {expanded && (
        <View style={{ marginTop: 8 }}>
          {exercise.questions?.map((q, qi) => (
            <Text key={qi} style={{ color: theme.muted }}>Q{qi + 1}: {q.question_text || q.stem}</Text>
          ))}
          <TouchableOpacity onPress={() => {}}><Text style={{ color: theme.primary, marginTop: 8 }}>Edit</Text></TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerBanner: {
    padding: 16, borderRadius: 12, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  headerText: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
  abortBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)',
  },
  card: {
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  modeSelector: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  modeBtn: {
    flex: 1, padding: 12, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', borderColor: '#ccc',
  },
  formSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { marginTop: 8, marginBottom: 4, fontSize: 12, color: '#888' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1,
    borderRadius: 20, borderColor: '#ddd',
  },
  input: {
    borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14,
  },
  inputSmall: { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14, marginBottom: 8 },
  optionToggle: { padding: 10, borderWidth: 1, borderRadius: 8, marginTop: 8 },
  quota: { alignItems: 'center', marginVertical: 12 },
  generateBtn: {
    padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  emptyState: { alignItems: 'center', marginTop: 40, opacity: 0.5 },
  button: {
    padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8,
  },
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 20,
  },
  modalContent: {
    width: '100%', borderRadius: 16, padding: 20,
  },
});