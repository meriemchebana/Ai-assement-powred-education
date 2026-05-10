import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  TextInput, Modal, Alert, ActivityIndicator, Image,
  StyleSheet, Platform, Animated, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  subjectsAPI, coursesAPI, practicalSeriesAPI,
  theoreticalSeriesAPI, examsAPI,
} from '../api/client';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

// ── Tab metadata ──────────────────────────────────────────────────────────
const TAB_META = [
  {
    key: 'courses', tKey: 'courses',
    icon: '📚',
    api: coursesAPI,
    color: '#0891b2',
  },
  {
    key: 'practical-series', tKey: 'practical',
    icon: '🧪',
    api: practicalSeriesAPI,
    color: '#0284c7',
  },
  {
    key: 'theoretical-series', tKey: 'theoretical',
    icon: '📖',
    api: theoreticalSeriesAPI,
    color: '#06b6d4',
  },
  {
    key: 'exams', tKey: 'exams',
    icon: '📄',
    api: examsAPI,
    color: '#0e7490',
  },
];

// ── Main Component ─────────────────────────────────────────────────────────
export default function SubjectDetailScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { subjectId } = route.params;
  const { theme } = useTheme();
  const { addToast } = useToast();

  const [subject, setSubject] = useState(null);
  const [activeTab, setActiveTab] = useState('courses');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    courses: [],
    'practical-series': [],
    'theoretical-series': [],
    exams: [],
  });

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [uploadingFor, setUploadingFor] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [parseStatuses, setParseStatuses] = useState({});
  const [generateModal, setGenerateModal] = useState(false);
  const pollRef = useRef(null);

  const TABS = TAB_META.map(tab => ({
    ...tab,
    label: t(`subjectDetail.${tab.tKey}`),
  }));

  const getTabMeta = (tab = activeTab) => TABS.find(t => t.key === tab);

  // ── Load all data ──────────────────────────────────────────────────────
  const loadAll = async () => {
    const [c, ps, ts, ex] = await Promise.all([
      coursesAPI.getAll(subjectId),
      practicalSeriesAPI.getAll(subjectId),
      theoreticalSeriesAPI.getAll(subjectId),
      examsAPI.getAll(subjectId),
    ]);
    setData({
      courses: c,
      'practical-series': ps,
      'theoretical-series': ts,
      exams: ex,
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await subjectsAPI.getOne(subjectId);
        if (!cancelled) {
          setSubject(s);
          await loadAll();
        }
      } catch (err) {
        if (!cancelled) addToast(err.message, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subjectId]);

  // ── CRUD handlers ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formData.title.trim()) return addToast('Title is required', 'error');
    try {
      await getTabMeta().api.create(subjectId, formData);
      setFormData({ title: '', description: '' });
      setShowForm(false);
      await loadAll();
      addToast(t('subjectDetail.createdOk'), 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = (id, title) => {
    Alert.alert(
      t('subjectDetail.confirmDelete', { title }),
      '',
      [
        { text: t('subjectDetail.cancel'), style: 'cancel' },
        {
          text: t('subjectDetail.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await getTabMeta().api.delete(subjectId, id);
              await loadAll();
              addToast(t('subjectDetail.deleted'), 'success');
            } catch (err) {
              addToast(err.message, 'error');
            }
          },
        },
      ]
    );
  };

  // ── PDF handlers ────────────────────────────────────────────────────────
  const pickPDF = async (itemId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setUploadFile(file);
      setUploadingFor(itemId);
    } catch (err) {
      addToast('Failed to pick file', 'error');
    }
  };

  const handleUpload = async (itemId) => {
    if (!uploadFile) return;
    try {
      // React Native doesn't have native File, so we create a blob-compatible object
      const fileUri = uploadFile.uri;
      const fileName = uploadFile.name || 'upload.pdf';
      const mimeType = uploadFile.mimeType || 'application/pdf';

      // For fetch-based upload, we'll use FormData with uri
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      });

      await getTabMeta().api.uploadPDF(subjectId, itemId, formData);
      setUploadFile(null);
      setUploadingFor(null);
      await loadAll();
      addToast(t('subjectDetail.pdfUploaded'), 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeletePDF = (itemId, pdfId, filename) => {
    Alert.alert(
      t('subjectDetail.confirmDeletePDF', { filename }),
      '',
      [
        { text: t('subjectDetail.cancel'), style: 'cancel' },
        {
          text: t('subjectDetail.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await getTabMeta().api.deletePDF(subjectId, itemId, pdfId);
              await loadAll();
              addToast(t('subjectDetail.pdfDeleted'), 'success');
            } catch (err) {
              addToast(err.message, 'error');
            }
          },
        },
      ]
    );
  };

  const getPDFUrl = (pdf) => {
    const base = 'https://your-production-api.com'; // Replace with your API base
    if (pdf.filepath) {
      const rel = pdf.filepath.replace(/^\.?\/?(uploads\/)?/, '');
      return `${base}/uploads/${rel}`;
    }
    return `${base}/uploads/${activeTab}/${pdf.id}/${pdf.filename}`;
  };

  const openPDF = (url) => {
    Linking.openURL(url).catch(() => addToast('Failed to open PDF', 'error'));
  };

  // ── Extraction ─────────────────────────────────────────────────────────
  const detectAISubject = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('algo')) return 'algo';
    if (n.includes('law') || n.includes('droit')) return 'Law';
    if (n.includes('commerce') || n.includes('busi')) return 'commerce';
    if (n.includes('se') || n.includes('software')) return 'se';
    if (n.includes('compil')) return 'compilation';
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
          loadAll(); // Refresh data
        } else if (st === 'error') {
          setParseStatuses(prev => ({ ...prev, [pdfId]: 'error' }));
          clearInterval(pollRef.current);
          addToast(res.detail || 'Extraction failed', 'error');
        }
      } catch { /* keep polling */ }
    }, 3000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  const tabMeta = getTabMeta();
  const items = data[activeTab] || [];
  const isDark = theme.mode === 'dark';

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.muted, marginTop: 12 }}>{t('subjectDetail.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Subject header */}
        <View style={styles.header}>
          <Text style={[styles.badge, { color: theme.muted }]}>{t('subjectDetail.badge')}</Text>
          <Text style={[styles.subjectName, { color: theme.text }]}>{subject?.name}</Text>
          {subject?.description ? (
            <Text style={[styles.description, { color: theme.muted }]}>{subject.description}</Text>
          ) : null}
        </View>

        {/* AI Generator button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Generate', { subjectId })}
          style={[styles.aiBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
        >
          <Text style={{ fontSize: 20, marginRight: 8 }}>💡</Text>
          <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 14 }}>
            {t('subjectDetail.aiGenerator')}
          </Text>
        </TouchableOpacity>

        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            const count = (data[tab.key] || []).length;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => { setActiveTab(tab.key); setShowForm(false); setUploadingFor(null); }}
                style={[
                  styles.tab,
                  active && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff' },
                ]}
              >
                <Text style={{ fontSize: 18 }}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, { color: active ? tab.color : theme.muted }]}>{tab.label}</Text>
                <View style={[styles.tabCount, { backgroundColor: active ? (tab.color + '20') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'), borderColor: active ? (tab.color + '40') : 'transparent' }]}>
                  <Text style={{ fontSize: 10, color: active ? tab.color : theme.muted }}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Add new button */}
        <TouchableOpacity
          onPress={() => setShowForm(!showForm)}
          style={[styles.addBtn, { backgroundColor: showForm ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : tabMeta.color + '15', borderColor: showForm ? theme.border : tabMeta.color + '30' }]}
        >
          <Text style={{ color: showForm ? theme.muted : tabMeta.color, fontWeight: '600' }}>
            {showForm ? t('subjectDetail.cancel') : `+ ${t('subjectDetail.new')} ${tabMeta?.label}`}
          </Text>
        </TouchableOpacity>

        {/* Create form */}
        {showForm && (
          <View style={[styles.formCard, { borderColor: tabMeta.color + '40' }]}>
            <TextInput
              value={formData.title}
              onChangeText={v => setFormData(p => ({ ...p, title: v }))}
              placeholder={t('subjectDetail.titlePlaceholder')}
              placeholderTextColor={theme.muted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#1E293B' : '#fff' }]}
            />
            <TextInput
              value={formData.description}
              onChangeText={v => setFormData(p => ({ ...p, description: v }))}
              placeholder={t('subjectDetail.descPlaceholder')}
              placeholderTextColor={theme.muted}
              multiline
              numberOfLines={3}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#1E293B' : '#fff', height: 80 }]}
            />
            <TouchableOpacity onPress={handleCreate} style={[styles.createBtn, { backgroundColor: tabMeta.color }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('subjectDetail.create')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Items list */}
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40 }}>{tabMeta.icon}</Text>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, marginTop: 12 }}>
              {t('subjectDetail.noItemsYet', { label: tabMeta?.label?.toLowerCase() })}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
              {t('subjectDetail.addHint', { label: tabMeta?.label })}
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {items.map((item, index) => (
              <TimelineCard
                key={item.id}
                item={item}
                index={index}
                tabMeta={tabMeta}
                activeTab={activeTab}
                onDelete={() => handleDelete(item.id, item.title)}
                onUpload={() => pickPDF(item.id)}
                onGenerateAI={() => {
                  if (activeTab === 'exams') setGenerateModal(true);
                  else addToast('AI generation available for exams only', 'info');
                }}
                uploadingFor={uploadingFor}
                uploadFile={uploadFile}
                onFileSave={() => handleUpload(item.id)}
                onFileCancel={() => { setUploadingFor(null); setUploadFile(null); }}
                onDeletePDF={(pdfId, filename) => handleDeletePDF(item.id, pdfId, filename)}
                onExtract={(pdfId) => handleExtract(item.id, pdfId)}
                parseStatuses={parseStatuses}
                onOpenPDF={openPDF}
                getPDFUrl={getPDFUrl}
                theme={theme}
                isDark={isDark}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Generate Modal */}
      <Modal visible={generateModal} animationType="slide" presentationStyle="fullScreen">
        <View style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>💡</Text>
              <View>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>
                  {t('subjectDetail.aiQuestionGenerator')}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  {t('subjectDetail.engineInfo')}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setGenerateModal(false)}>
              <Text style={{ color: theme.muted, fontSize: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* WebView for the iframe content */}
          <WebView
            source={{ uri: 'https://longitude-pharmacies-luis-demo.trycloudflare.com' }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
          />
        </View>
      </Modal>
    </View>
  );
}

// ── TimelineCard ──────────────────────────────────────────────────────────
function TimelineCard({
  item, index, tabMeta, activeTab, onDelete, onUpload, onGenerateAI,
  uploadingFor, uploadFile, onFileSave, onFileCancel, onDeletePDF,
  onExtract, parseStatuses, onOpenPDF, getPDFUrl, theme, isDark,
}) {
  const [expanded, setExpanded] = useState(activeTab === 'exams');
  const { t } = useTranslation();
  const num = String(index + 1).padStart(2, '0');
  const hasPDFs = item.pdfs?.length > 0;

  return (
    <View style={styles.cardRow}>
      {/* Timeline node */}
      <View style={styles.node}>
        <View style={[styles.nodeCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.muted }}>{num}</Text>
        </View>
      </View>

      {/* Card body */}
      <View style={[styles.cardBody, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: theme.border }]}>
        {/* Title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ fontSize: 18, marginRight: 6 }}>{tabMeta.icon}</Text>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{item.title}</Text>
        </View>
        {item.description ? (
          <Text style={{ color: theme.muted, fontSize: 13, marginLeft: 24, marginBottom: 8 }}>{item.description}</Text>
        ) : null}

        {/* PDF section */}
        {hasPDFs && (
          <View style={{ marginLeft: 24 }}>
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={[styles.pdfToggle, { backgroundColor: tabMeta.color + '15', borderColor: tabMeta.color + '30' }]}>
              <Text style={{ fontSize: 11, color: tabMeta.color }}>📎 {item.pdfs.length} PDF{item.pdfs.length !== 1 ? 's' : ''}</Text>
              <Text style={{ fontSize: 10, color: tabMeta.color, opacity: 0.6 }}>{expanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {expanded && (
              <View style={{ gap: 6, marginTop: 6 }}>
                {item.pdfs.map(pdf => {
                  const ps = parseStatuses?.[pdf.id] || 'idle';
                  return (
                    <View key={pdf.id} style={[styles.pdfItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
                      <Text style={{ color: theme.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>
                        <Text style={{ color: tabMeta.color, fontWeight: '600' }}>PDF</Text> {pdf.filename}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {activeTab === 'exams' && ps !== 'pending' && (
                          <TouchableOpacity onPress={() => onExtract(pdf.id)} style={[styles.smallBtn, { borderColor: tabMeta.color + '50' }]}>
                            <Text style={{ fontSize: 10, color: tabMeta.color }}>
                              {ps === 'done' ? 'Re-extract' : ps === 'error' ? 'Retry' : 'Extract'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {ps === 'pending' && <Text style={{ color: '#F59E0B', fontSize: 10 }}>⏳ Extracting...</Text>}
                        {ps === 'done' && <Text style={{ color: '#10B981', fontSize: 10 }}>✅ Done</Text>}
                        <TouchableOpacity onPress={() => onOpenPDF(getPDFUrl(pdf))} style={[styles.smallBtn, { borderColor: tabMeta.color + '50' }]}>
                          <Text style={{ fontSize: 10, color: tabMeta.color }}>View</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onDeletePDF(pdf.id, pdf.filename)}>
                          <Text style={{ color: '#EF4444', fontSize: 14 }}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Upload inline */}
        {uploadingFor === item.id && (
          <View style={{ marginLeft: 24, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: theme.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>
              {uploadFile ? uploadFile.name : 'No file selected'}
            </Text>
            <TouchableOpacity onPress={onFileSave} disabled={!uploadFile} style={[styles.smallBtn, { backgroundColor: uploadFile ? '#0891b2' : 'transparent' }]}>
              <Text style={{ color: uploadFile ? '#fff' : theme.muted }}>Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onFileCancel}>
              <Text style={{ color: theme.muted }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 6 }}>
          {uploadingFor !== item.id && (
            <TouchableOpacity onPress={onUpload} style={[styles.smallBtn, { borderColor: theme.border }]}>
              <Text style={{ color: theme.muted, fontSize: 11 }}>📎 Upload</Text>
            </TouchableOpacity>
          )}
          {activeTab === 'exams' && (
            <TouchableOpacity onPress={onGenerateAI} style={[styles.smallBtn, { borderColor: tabMeta.color + '50' }]}>
              <Text style={{ color: tabMeta.color, fontSize: 11 }}>💡 AI</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onDelete}>
            <Text style={{ color: '#EF4444', fontSize: 16 }}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  badge: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: 8,
  },
  subjectName: {
    fontSize: 32, fontWeight: '800', letterSpacing: -0.8,
    marginBottom: 6,
  },
  description: { fontSize: 14, lineHeight: 20 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderRadius: 16, borderWidth: 1, padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1, minWidth: 80,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 12, gap: 6,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  tabCount: {
    marginLeft: 'auto', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 10, borderWidth: 1,
  },
  addBtn: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
    alignItems: 'center', marginBottom: 16,
  },
  formCard: {
    borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16,
  },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, marginBottom: 10,
  },
  createBtn: {
    padding: 14, borderRadius: 10, alignItems: 'center',
  },
  emptyState: { alignItems: 'center', paddingVertical: 40, opacity: 0.6 },
  timeline: { gap: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  node: {
    width: 40, alignItems: 'center', paddingTop: 14,
  },
  nodeCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, justifyContent: 'center', alignItems: 'center',
  },
  cardBody: {
    flex: 1, borderRadius: 14, borderWidth: 1, padding: 12,
  },
  pdfToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pdfItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, borderRadius: 10, borderWidth: 1, gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, borderBottomWidth: 1,
  },
});

