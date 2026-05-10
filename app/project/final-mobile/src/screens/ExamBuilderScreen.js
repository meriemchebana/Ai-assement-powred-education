import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Modal,
  TextInput, ScrollView, Alert, Platform, Image,
  ActivityIndicator, StyleSheet, Animated,
  useWindowDimensions, Pressable,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { archiveAPI } from '../api/client';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ── Helper Icons (emoji) ─────────────────────────────── */
const IMG = {
  bank: '📦', draft: '📝', save: '💾', accept: '✔️', trash: '🗑️',
  edit: '✏️', exam: '📄', image: '🖼️', table: '📊',
};

function Icon({ name, size = 16 }) {
  return <Text style={{ fontSize: size }}>{name}</Text>;
}

/* ── Extract items from accepted archive entries ───────── */
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
          images: [],   // will be attached later locally
          tables: [],
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
        images: [],
        tables: [],
      });
    }
  });
  return items;
}

/* ── Main Screen ──────────────────────────────────────── */
export default function ExamBuilderScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();

  // State
  const [bankItems, setBankItems] = useState([]);
  const [loadingBank, setLoadingBank] = useState(true);
  const [examItems, setExamItems] = useState([]);
  const [headerData, setHeaderData] = useState({});
  const [showHeaderModal, setShowHeaderModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [filterSubject, setFilterSubject] = useState('all');
  const [searchBank, setSearchBank] = useState('');
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimer = useRef(null);

  // Scope draft to the logged-in user so two teachers on the same device never share state
  const DRAFT_KEY = user?.id ? `exam_builder_draft_${user.id}` : null;

  /* ── Load bank & draft on mount (re-runs when user becomes available) ─────── */
  useEffect(() => {
    archiveAPI.getAll()
      .then(entries => {
        setBankItems(extractBankItems(entries));
      })
      .catch(e => addToast(e.message, 'error'))
      .finally(() => setLoadingBank(false));

    // Load draft
    if (!DRAFT_KEY) return;
    AsyncStorage.getItem(DRAFT_KEY).then(raw => {
      if (raw) {
        try {
          const { examItems: saved, headerData: hd } = JSON.parse(raw);
          if (saved?.length) setExamItems(saved);
          if (hd && Object.keys(hd).length) setHeaderData(hd);
        } catch {}
      }
      // Auto-fill header from profile/teaching context
      const autoHeader = {};
      if (user?.institution) autoHeader.institution = user.institution;
      if (user?.department) autoHeader.faculty = user.department;
      if (Object.keys(autoHeader).length) setHeaderData(prev => ({ ...prev, ...autoHeader }));
    });
  }, [DRAFT_KEY]);

  /* ── Auto-save draft every 1.5s ─────────────────────── */
  useEffect(() => {
    if (!DRAFT_KEY) return;
    if (!examItems.length && !Object.keys(headerData).length) return;
    setSaveStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ examItems, headerData }))
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'));
    }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [examItems, headerData]);

  const clearDraft = () => {
    if (DRAFT_KEY) AsyncStorage.removeItem(DRAFT_KEY);
    setExamItems([]);
    setHeaderData({});
    setSaveStatus('saved');
  };

  /* ── Bank filtering ────────────────────────────────── */
  const subjects = [...new Set(bankItems.map(i => i.ai_subject))];
  const filteredBank = bankItems.filter(item => {
    const matchSubj = filterSubject === 'all' || item.ai_subject === filterSubject;
    const matchSearch = !searchBank.trim() || item.title.toLowerCase().includes(searchBank.toLowerCase());
    return matchSubj && matchSearch;
  });

  /* ── Add / Remove / Edit ────────────────────────────── */
  const addToExam = (item) => {
    if (examItems.find(i => i._bankId === item._bankId)) {
      addToast(t('examBuilder.alreadyInExam'), 'info');
      return;
    }
    const newItem = { ...item, _examId: `${item._bankId}_${Date.now()}` };
    setExamItems(prev => [...prev, newItem]);
  };

  const removeFromExam = (examId) => {
    Alert.alert('Remove', 'Remove this exercise?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', onPress: () => setExamItems(prev => prev.filter(i => i._examId !== examId)) },
    ]);
  };

  const updateExamItem = (examId, updatedFields) => {
    setExamItems(prev => prev.map(i => i._examId === examId ? { ...i, ...updatedFields } : i));
  };

  /* ── Images ────────────────────────────────────────── */
  const pickImage = async (examId) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
      updateExamItem(examId, {
        images: [...(examItems.find(i => i._examId === examId)?.images || []), { id: Date.now(), dataUrl, caption: '' }]
      });
    }
  };

  const removeImage = (examId, imageId) => {
    updateExamItem(examId, {
      images: (examItems.find(i => i._examId === examId)?.images || []).filter(img => img.id !== imageId)
    });
  };

  /* ── Tables ────────────────────────────────────────── */
  const addTableToItem = (examId) => {
    const newTable = { id: Date.now(), title: '', rows: 3, cols: 3 };
    updateExamItem(examId, { tables: [...(examItems.find(i => i._examId === examId)?.tables || []), newTable] });
  };

  const removeTable = (examId, tableId) => {
    updateExamItem(examId, {
      tables: (examItems.find(i => i._examId === examId)?.tables || []).filter(t => t.id !== tableId)
    });
  };

  const updateTable = (examId, tableId, field, value) => {
    updateExamItem(examId, {
      tables: (examItems.find(i => i._examId === examId)?.tables || []).map(t => t.id === tableId ? { ...t, [field]: value } : t)
    });
  };

  /* ── Save & Export ─────────────────────────────────── */
  const finalizeExam = async () => {
    if (examItems.length === 0) {
      addToast(t('examBuilder.addExercisesFirst'), 'info');
      return;
    }
    try {
      await archiveAPI.save({
        ai_subject: examItems[0]?.ai_subject || 'mixed',
        title: headerData.subject || 'Final Exam',
        mode: 'full_exam',
        content: { exercises: examItems.map(({ title, introduction_context, questions, total_exercise_points }) =>
          ({ title, introduction_context, questions, total_exercise_points })) },
      });
      addToast(t('examBuilder.savedToArchive'), 'success');
    } catch (e) { addToast(e.message, 'error'); }
  };

  const exportPDF = async () => {
    const html = buildExamHTML(headerData, examItems);
    const { uri } = await Print.printToFileAsync({ html });
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }
  };

  const exportWord = async () => {
    const html = buildWordHTML(headerData, examItems);
    const fileUri = FileSystem.cacheDirectory + `exam-${Date.now()}.doc`;
    await FileSystem.writeAsStringAsync(fileUri, html, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri, { mimeType: 'application/msword' });
  };

  const totalPoints = examItems.reduce((s, i) => s + (Number(i.total_exercise_points) || 0), 0);
  const totalQs = examItems.reduce((s, i) => s + (i.questions?.length || 0), 0);

  /* ── Render ────────────────────────────────────────── */
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => setShowBankModal(true)}
          style={[styles.toolbarButton, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
        >
          <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 12 }}>{t('examBuilder.bank')} {filteredBank.length}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{t('examBuilder.title')}</Text>
          <Text style={{ fontSize: 10, color: theme.muted }}>
            {examItems.length} ex · {totalQs} q · {totalPoints} pts
          </Text>
        </View>
        <SaveIndicator status={saveStatus} theme={theme} />
        <IconButton icon="✏️" onPress={() => setShowHeaderModal(true)} theme={theme} />
        <IconButton icon="✔️" onPress={finalizeExam} theme={theme} />
        <IconButton icon="📄" onPress={exportPDF} theme={theme} />
        <IconButton icon="📝" onPress={exportWord} theme={theme} />
      </View>

      {/* Document area (DraggableFlatList) */}
      <View style={{ flex: 1, transform: [{ scale: zoom }] }}>
        {examItems.length === 0 ? (
          <View style={styles.emptyDoc}>
            <Text style={{ color: theme.muted, fontSize: 14 }}>Drag exercises here from bank</Text>
            <TouchableOpacity onPress={() => setShowBankModal(true)} style={{ marginTop: 10 }}>
              <Text style={{ color: theme.primary }}>Open Bank</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <DraggableFlatList
            data={examItems}
            keyExtractor={item => item._examId}
            onDragEnd={({ data }) => setExamItems(data)}
            renderItem={({ item, drag, isActive }) => (
              <ScaleDecorator>
                <ExerciseCard
                  item={item}
                  index={examItems.indexOf(item)}
                  drag={drag}
                  isActive={isActive}
                  theme={theme}
                  onPress={() => setSelectedExamId(item._examId === selectedExamId ? null : item._examId)}
                  onAddImage={() => pickImage(item._examId)}
                  onRemoveImage={removeImage}
                  onAddTable={() => addTableToItem(item._examId)}
                  onRemoveTable={removeTable}
                  onUpdateTable={updateTable}
                  onEdit={() => setEditingItem(item)}
                  onDelete={() => removeFromExam(item._examId)}
                  selected={selectedExamId === item._examId}
                  t={t}
                />
              </ScaleDecorator>
            )}
            contentContainerStyle={{ paddingBottom: 80 }}
            activationDistance={10}
          />
        )}
      </View>

      {/* Zoom controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity onPress={() => setZoom(z => Math.max(0.4, z - 0.1))}><Text style={{ fontSize: 18 }}>-</Text></TouchableOpacity>
        <Text style={{ marginHorizontal: 10 }}>{Math.round(zoom * 100)}%</Text>
        <TouchableOpacity onPress={() => setZoom(z => Math.min(2, z + 0.1))}><Text style={{ fontSize: 18 }}>+</Text></TouchableOpacity>
      </View>

      {/* Modals */}
      <BankModal
        visible={showBankModal}
        onClose={() => setShowBankModal(false)}
        bankItems={filteredBank}
        loading={loadingBank}
        subjects={subjects}
        filterSubject={filterSubject}
        setFilterSubject={setFilterSubject}
        searchBank={searchBank}
        setSearchBank={setSearchBank}
        onAdd={addToExam}
        theme={theme}
        t={t}
      />

      <HeaderModal
        visible={showHeaderModal}
        onClose={() => setShowHeaderModal(false)}
        headerData={headerData}
        setHeaderData={setHeaderData}
        theme={theme}
        user={user}
        t={t}
      />

      {editingItem && (
        <EditExerciseModal
          visible={!!editingItem}
          item={editingItem}
          onSave={(updated) => { updateExamItem(editingItem._examId, updated); setEditingItem(null); }}
          onClose={() => setEditingItem(null)}
          theme={theme}
          t={t}
        />
      )}
    </View>
  );
}

/* ── Sub-Components ───────────────────────────────────── */

function IconButton({ icon, onPress, theme }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 6 }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </TouchableOpacity>
  );
}

function SaveIndicator({ status, theme }) {
  const color =
    status === 'saved' ? '#10B981' :
    status === 'saving' ? '#F59E0B' : '#EF4444';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 4 }} />
      <Text style={{ fontSize: 10, color: theme.muted }}>{status}</Text>
    </View>
  );
}

function ExerciseCard({ item, index, drag, isActive, theme, onPress, onAddImage, onRemoveImage, onAddTable, onRemoveTable, onUpdateTable, onEdit, onDelete, selected, t }) {
  return (
    <Pressable
      onLongPress={drag}
      onPress={onPress}
      style={[styles.exerciseCard, {
        backgroundColor: theme.mode === 'dark' ? '#1e293b' : '#fff',
        borderColor: selected ? theme.primary : theme.border,
        elevation: isActive ? 5 : 2,
        opacity: isActive ? 0.8 : 1,
      }]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', color: theme.text, fontSize: 16 }}>
          {t('examBuilder.exercise')} {index + 1} {item.title ? `– ${item.title}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity onPress={onEdit}><Text>✏️</Text></TouchableOpacity>
          <TouchableOpacity onPress={onDelete}><Text>🗑️</Text></TouchableOpacity>
          <TouchableOpacity onPress={onAddImage}><Text>🖼️</Text></TouchableOpacity>
          <TouchableOpacity onPress={onAddTable}><Text>📊</Text></TouchableOpacity>
        </View>
      </View>
      {selected && (
        <View style={{ marginTop: 8 }}>
          {item.introduction_context ? (
            <Text style={{ fontStyle: 'italic', color: theme.muted, marginBottom: 6 }}>{item.introduction_context}</Text>
          ) : null}
          {(item.questions || []).map((q, qi) => (
            <View key={qi} style={{ marginLeft: 12, marginBottom: 6 }}>
              <Text style={{ fontWeight: '600' }}>
                Q{qi + 1}. {q.data?.stem || q.data?.question || q.data?.title || ''}
              </Text>
            </View>
          ))}
          {(item.images || []).map(img => (
            <View key={img.id} style={{ marginTop: 6, alignItems: 'center' }}>
              <Image source={{ uri: img.dataUrl }} style={{ width: '100%', height: 150, resizeMode: 'contain' }} />
              <TextInput value={img.caption} onChangeText={(val) => onUpdateImageCaption(item._examId, img.id, val)} placeholder="Caption..." style={{ textAlign: 'center', color: theme.muted }} />
              <TouchableOpacity onPress={() => onRemoveImage(item._examId, img.id)}><Text style={{ color: '#EF4444', fontSize: 12 }}>Remove image</Text></TouchableOpacity>
            </View>
          ))}
          {(item.tables || []).map(tbl => (
            <View key={tbl.id} style={{ marginTop: 10, borderWidth: 1, borderColor: '#374151', borderRadius: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 4 }}>
                <TouchableOpacity onPress={() => onUpdateTable(item._examId, tbl.id, 'rows', (tbl.rows || 3) + 1)}><Text>+Row</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onUpdateTable(item._examId, tbl.id, 'rows', Math.max(1, (tbl.rows || 3) - 1))}><Text>-Row</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onUpdateTable(item._examId, tbl.id, 'cols', (tbl.cols || 3) + 1)}><Text>+Col</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onUpdateTable(item._examId, tbl.id, 'cols', Math.max(1, (tbl.cols || 3) - 1))}><Text>-Col</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onRemoveTable(item._examId, tbl.id)}><Text style={{ color: '#EF4444' }}>✕</Text></TouchableOpacity>
              </View>
              <TextInput value={tbl.title} onChangeText={(val) => onUpdateTable(item._examId, tbl.id, 'title', val)} placeholder="Table title..." style={{ textAlign: 'center', padding: 4 }} />
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

/* ── Bank Modal ──────────────────────────────────────── */
function BankModal({ visible, onClose, bankItems, loading, subjects, filterSubject, setFilterSubject, searchBank, setSearchBank, onAdd, theme, t }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
        <View style={styles.modalHeader}>
          <Text style={{ fontWeight: '700', fontSize: 18, color: theme.text }}>{t('examBuilder.exerciseBank')}</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 20 }}>✕</Text></TouchableOpacity>
        </View>
        <TextInput
          value={searchBank}
          onChangeText={setSearchBank}
          placeholder="Search..."
          placeholderTextColor={theme.muted}
          style={[styles.searchInput, { backgroundColor: theme.mode === 'dark' ? '#1e293b' : '#f1f5f9', color: theme.text, borderColor: theme.border }]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          {['all', ...subjects].map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setFilterSubject(s)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1,
                marginRight: 8,
                backgroundColor: filterSubject === s ? theme.primary + '20' : 'transparent',
                borderColor: filterSubject === s ? theme.primary : theme.border,
              }}>
              <Text style={{ color: filterSubject === s ? theme.primary : theme.muted }}>{s === 'all' ? 'All' : s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filteredBank}
            keyExtractor={item => item._bankId}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.bankItem, { backgroundColor: theme.mode === 'dark' ? '#1e293b' : '#fff', borderColor: theme.border }]}
                onPress={() => onAdd(item)}
              >
                <Text style={{ fontWeight: '600', color: theme.text }}>{item.title}</Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>{item.ai_subject} · {item.questions?.length || 0} q</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

/* ── Header Modal ─────────────────────────────────────── */
function HeaderModal({ visible, onClose, headerData, setHeaderData, theme, user, t }) {
  const [draft, setDraft] = useState({ ...headerData });
  const fields = ['institution', 'faculty', 'subject', 'duration', 'level', 'session', 'date', 'total_pts', 'notes'];

  const apply = () => {
    setHeaderData(draft);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16, color: theme.text }}>{t('examBuilder.header')}</Text>
          <ScrollView style={{ maxHeight: 400 }}>
            {fields.map(f => (
              <View key={f} style={{ marginBottom: 12 }}>
                <Text style={{ color: theme.muted, marginBottom: 4 }}>{f}</Text>
                <TextInput
                  value={draft[f] || ''}
                  onChangeText={val => setDraft(prev => ({ ...prev, [f]: val }))}
                  style={[styles.textInput, { backgroundColor: theme.mode === 'dark' ? '#1e293b' : '#f1f5f9', color: theme.text, borderColor: theme.border }]}
                  placeholder={`Enter ${f}`}
                  placeholderTextColor={theme.muted}
                />
              </View>
            ))}
            {/* Quick fill from profile */}
            <TouchableOpacity
              onPress={() => {
                setDraft(prev => ({
                  ...prev,
                  institution: user?.institution || '',
                  faculty: user?.department || '',
                }));
              }}
            >
              <Text style={{ color: theme.primary, marginBottom: 12 }}>Auto-fill from profile</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <TouchableOpacity onPress={onClose}><Text style={{ color: theme.muted }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={apply}><Text style={{ color: theme.primary, fontWeight: '700' }}>Apply</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Edit Exercise Modal ─────────────────────────────── */
function EditExerciseModal({ visible, item, onSave, onClose, theme, t }) {
  const [draft, setDraft] = useState({
    title: item.title,
    introduction_context: item.introduction_context,
    total_exercise_points: item.total_exercise_points?.toString() || '',
    questions: JSON.parse(JSON.stringify(item.questions || [])),
  });

  const save = () => {
    onSave({
      title: draft.title,
      introduction_context: draft.introduction_context,
      total_exercise_points: draft.total_exercise_points === '' ? null : Number(draft.total_exercise_points),
      questions: draft.questions,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <ScrollView>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12, color: theme.text }}>Edit Exercise</Text>
            <TextInput
              value={draft.title}
              onChangeText={val => setDraft(prev => ({ ...prev, title: val }))}
              placeholder="Title"
              style={styles.textInput}
              placeholderTextColor={theme.muted}
            />
            <TextInput
              value={draft.introduction_context}
              onChangeText={val => setDraft(prev => ({ ...prev, introduction_context: val }))}
              placeholder="Context"
              multiline
              style={[styles.textInput, { height: 60 }]}
              placeholderTextColor={theme.muted}
            />
            <TextInput
              value={draft.total_exercise_points}
              onChangeText={val => setDraft(prev => ({ ...prev, total_exercise_points: val }))}
              placeholder="Points"
              keyboardType="numeric"
              style={styles.textInput}
              placeholderTextColor={theme.muted}
            />
            <Text style={{ color: theme.muted, marginTop: 10 }}>Questions ({draft.questions.length})</Text>
            {draft.questions.map((q, qi) => (
              <View key={qi} style={{ marginLeft: 10, marginTop: 8 }}>
                <TextInput
                  value={q.data?.stem || q.data?.question || q.data?.title || ''}
                  onChangeText={val => {
                    const newQ = [...draft.questions];
                    newQ[qi] = { ...newQ[qi], data: { ...newQ[qi].data, stem: val } };
                    setDraft(prev => ({ ...prev, questions: newQ }));
                  }}
                  placeholder={`Q${qi + 1}`}
                  style={styles.textInput}
                />
                <TouchableOpacity onPress={() => {
                  setDraft(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== qi) }));
                }}>
                  <Text style={{ color: '#EF4444' }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setDraft(prev => ({ ...prev, questions: [...prev.questions, { data: { stem: '' } }] }))}
            >
              <Text style={{ color: theme.primary, marginTop: 10 }}>+ Add question</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 }}>
            <TouchableOpacity onPress={onClose}><Text style={{ color: theme.muted }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={save}><Text style={{ color: theme.primary, fontWeight: '700' }}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── HTML helpers for export ─────────────────────────── */
function buildExamHTML(header, items) {
  // (same as web version – simplified)
  let body = `<h1>Exam</h1>`;
  items.forEach((item, idx) => {
    body += `<div><h3>Exercise ${idx + 1}: ${item.title || ''}</h3>`;
    (item.questions || []).forEach((q, qi) => {
      body += `<p>Q${qi + 1}. ${q.data?.stem || q.data?.question || ''}</p>`;
    });
    body += `</div>`;
  });
  return `<html><body>${body}</body></html>`;
}
function buildWordHTML(header, items) {
  return buildExamHTML(header, items); // same for simplicity
}

/* ── Styles ───────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  toolbarButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  emptyDoc: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exerciseCard: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  zoomControls: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 10,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  bankItem: {
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
});

