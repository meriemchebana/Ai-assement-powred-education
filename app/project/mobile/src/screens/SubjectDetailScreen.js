import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import {
  subjectsAPI, coursesAPI, practicalSeriesAPI,
  theoreticalSeriesAPI, examsAPI,
} from '../api/client';
import { API_BASE_URL } from '../api/config';

const UPLOADS_URL = API_BASE_URL.replace('/api/v1', '/uploads');

const COLORS = {
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#94a3b8',
  border: '#e2e8f0',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
  success: '#10b981',
  successBg: '#ecfdf5',
};

const TABS = [
  { key: 'courses', label: 'Courses', icon: '📖' },
  { key: 'practical-series', label: 'Practical', icon: '🔬' },
  { key: 'theoretical-series', label: 'Theoretical', icon: '📐' },
  { key: 'exams', label: 'Exams', icon: '📝' },
];

const getPDFViewUrl = (pdf) => {
  if (pdf.filepath) {
    const relativePath = pdf.filepath.replace('./uploads/', '');
    return `${UPLOADS_URL}/${relativePath}`;
  }
  return null;
};

export default function SubjectDetailScreen({ route, navigation }) {
  const { subjectId } = route.params;
  const [subject, setSubject] = useState(null);
  const [activeTab, setActiveTab] = useState('courses');
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [practicalSeries, setPracticalSeries] = useState([]);
  const [theoreticalSeries, setTheoreticalSeries] = useState([]);
  const [exams, setExams] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '' });

  const loadAll = async () => {
    try {
      const [c, ps, ts, e] = await Promise.all([
        coursesAPI.getAll(subjectId),
        practicalSeriesAPI.getAll(subjectId),
        theoreticalSeriesAPI.getAll(subjectId),
        examsAPI.getAll(subjectId),
      ]);
      setCourses(c);
      setPracticalSeries(ps);
      setTheoreticalSeries(ts);
      setExams(e);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const s = await subjectsAPI.getOne(subjectId);
        setSubject(s);
        await loadAll();
      } catch (err) {
        Alert.alert('Error', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [subjectId]);

  const getData = () => {
    switch (activeTab) {
      case 'courses': return courses;
      case 'practical-series': return practicalSeries;
      case 'theoretical-series': return theoreticalSeries;
      case 'exams': return exams;
      default: return [];
    }
  };

  const getAPI = () => {
    switch (activeTab) {
      case 'courses': return coursesAPI;
      case 'practical-series': return practicalSeriesAPI;
      case 'theoretical-series': return theoreticalSeriesAPI;
      case 'exams': return examsAPI;
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) return;
    try {
      await getAPI().create(subjectId, formData);
      setFormData({ title: '', description: '' });
      setShowForm(false);
      await loadAll();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (id, title) => {
    Alert.alert('Delete', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await getAPI().delete(subjectId, id);
            loadAll();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handlePickPDF = async (itemId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (!result.canceled && result.assets?.length > 0) {
        const file = result.assets[0];
        await getAPI().uploadPDF(subjectId, itemId, file);
        Alert.alert('Success', 'PDF uploaded');
        loadAll();
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleViewPDF = async (pdf) => {
    const url = getPDFViewUrl(pdf);
    if (url) {
      await WebBrowser.openBrowserAsync(url);
    } else {
      Alert.alert('Error', 'Cannot open PDF');
    }
  };

  const handleDeletePDF = (itemId, pdfId, filename) => {
    Alert.alert('Delete PDF', `Delete "${filename}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await getAPI().deletePDF(subjectId, itemId, pdfId);
            loadAll();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleGenerateAI = async (itemId) => {
    if (activeTab === 'exams') {
      try {
        await examsAPI.generateExam(subjectId, itemId);
        Alert.alert('Success', 'Exam generated');
        loadAll();
      } catch (err) {
        Alert.alert('Error', err.message);
      }
    } else {
      Alert.alert('Coming Soon', 'AI generation will be available soon');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const data = getData();
  const activeTabObj = TABS.find(t => t.key === activeTab);
  const tabCounts = {
    courses: courses.length,
    'practical-series': practicalSeries.length,
    'theoretical-series': theoreticalSeries.length,
    exams: exams.length,
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.timelineRow}>
      {/* Timeline line + node */}
      <View style={styles.timelineLeft}>
        <View style={styles.timelineNode}>
          <Text style={styles.timelineNum}>{index + 1}</Text>
        </View>
        {index < data.length - 1 && <View style={styles.timelineLine} />}
      </View>

      {/* Card content */}
      <View style={styles.itemCard}>
        <View style={styles.itemCardHeader}>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
          <TouchableOpacity
            onPress={() => handleDelete(item.id, item.title)}
            style={styles.deleteBtnSmall}
          >
            <Text style={styles.deleteBtnSmallText}>✕</Text>
          </TouchableOpacity>
        </View>

        {item.description ? (
          <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        {/* PDF badges */}
        {item.pdfs?.length > 0 && (
          <View style={styles.pdfList}>
            {item.pdfs.map(pdf => (
              <View key={pdf.id} style={styles.pdfBadge}>
                <Text style={styles.pdfBadgeText} numberOfLines={1}>
                  📄 {pdf.filename}
                </Text>
                <View style={styles.pdfBadgeActions}>
                  <TouchableOpacity onPress={() => handleViewPDF(pdf)}>
                    <Text style={styles.pdfView}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeletePDF(item.id, pdf.id, pdf.filename)}
                  >
                    <Text style={styles.pdfDel}>Del</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.uploadPdfBtn}
            onPress={() => handlePickPDF(item.id)}
          >
            <Text style={styles.uploadPdfBtnText}>+ Upload PDF</Text>
          </TouchableOpacity>
          {activeTab === 'exams' && (
            <TouchableOpacity
              style={styles.aiGenBtn}
              onPress={() => handleGenerateAI(item.id)}
            >
              <Text style={styles.aiGenBtnText}>✨ AI Generate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {subject?.name}
        </Text>
        <View style={styles.aiHeaderBtn}>
          <Text style={styles.aiHeaderBtnText}>✨ AI</Text>
        </View>
      </View>

      {/* Stats / Tab pills */}
      <View style={styles.tabsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => { setActiveTab(tab.key); setShowForm(false); }}
                activeOpacity={0.7}
              >
                <Text style={styles.tabPillIcon}>{tab.icon}</Text>
                <Text style={[styles.tabPillLabel, isActive && styles.tabPillLabelActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabPillBadge, isActive && styles.tabPillBadgeActive]}>
                  <Text style={[styles.tabPillBadgeText, isActive && styles.tabPillBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* New item button */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.newItemBtn, showForm && styles.newItemBtnCancel]}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={[styles.newItemBtnText, showForm && styles.newItemBtnTextCancel]}>
            {showForm
              ? '✕ Cancel'
              : `+ New ${activeTabObj?.label}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inline create form */}
      {showForm && (
        <View style={styles.createForm}>
          <Text style={styles.createFormTitle}>
            New {activeTabObj?.label}
          </Text>
          <View style={styles.createInputWrapper}>
            <TextInput
              style={styles.createInput}
              placeholder="Title *"
              placeholderTextColor={COLORS.muted}
              value={formData.title}
              onChangeText={v => setFormData({ ...formData, title: v })}
              autoFocus
            />
          </View>
          <View style={styles.createInputWrapper}>
            <TextInput
              style={[styles.createInput, { height: 70, textAlignVertical: 'top' }]}
              placeholder="Description (optional)"
              placeholderTextColor={COLORS.muted}
              multiline
              value={formData.description}
              onChangeText={v => setFormData({ ...formData, description: v })}
            />
          </View>
          <View style={styles.createFormActions}>
            <TouchableOpacity
              style={styles.cancelFormBtn}
              onPress={() => setShowForm(false)}
            >
              <Text style={styles.cancelFormBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitFormBtn} onPress={handleCreate}>
              <Text style={styles.submitFormBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Timeline list */}
      <FlatList
        data={data}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{activeTabObj?.icon}</Text>
            <Text style={styles.emptyTitle}>
              No {activeTabObj?.label.toLowerCase()} yet
            </Text>
            <Text style={styles.emptyText}>
              Tap "+ New {activeTabObj?.label}" to add one
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
  },
  navTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginHorizontal: 8,
  },
  aiHeaderBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  aiHeaderBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Tabs bar
  tabsBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  tabPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabPillIcon: {
    fontSize: 13,
  },
  tabPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  tabPillLabelActive: {
    color: '#ffffff',
  },
  tabPillBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabPillBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabPillBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  tabPillBadgeTextActive: {
    color: '#ffffff',
  },

  // Action row
  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  newItemBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  newItemBtnCancel: {
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  newItemBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  newItemBtnTextCancel: {
    color: COLORS.text,
  },

  // Create form
  createForm: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  createFormTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  createInputWrapper: {
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  createInput: {
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
  },
  createFormActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },
  submitFormBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  submitFormBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Timeline
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLeft: {
    width: 36,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineNum: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.border,
    marginTop: 4,
  },
  itemCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginRight: 8,
    lineHeight: 20,
  },
  deleteBtnSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.dangerBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnSmallText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
    marginBottom: 8,
  },
  pdfList: {
    gap: 6,
    marginBottom: 8,
  },
  pdfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  pdfBadgeText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
  pdfBadgeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  pdfView: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  pdfDel: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '600',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  uploadPdfBtn: {
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  uploadPdfBtnText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  aiGenBtn: {
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  aiGenBtnText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
