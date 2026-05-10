import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  TextInput, Modal, Alert, ActivityIndicator, Image,
  StyleSheet, Platform, Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { subjectsAPI } from '../api/client';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = width - 32;

// ── Subject image map ──────────────────────────────────────────────────────
function subjectImg(name = '') {
  const n = name.toLowerCase();
  if (n.includes('algo')) return 'https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?auto=format&fit=crop&w=800&q=80';
  if (n.includes('law') || n.includes('droit')) return 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80';
  if (n.includes('commerce') || n.includes('busi')) return 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80';
  if (n.includes('se') || n.includes('software')) return 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80';
  if (n.includes('compil')) return 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=800&q=80';
  if (n.includes('data') || n.includes('base')) return 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80';
  if (n.includes('math')) return 'https://images.unsplash.com/photo-1596496050827-8299e0220de1?auto=format&fit=crop&w=800&q=80';
  if (n.includes('ml') || n.includes('ai')) return 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?auto=format&fit=crop&w=800&q=80';
  return 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80';
}

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1596496050827-8299e0220de1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1564325724739-bae0bd08762c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80',
];

const ICONS = [
  '📚', '📖', '🔬', '🧪', '📐', '📊', '🏗️', '🎨', '📝', '💻', '🔢', '🌍',
];

// ── Main Component ─────────────────────────────────────────────────────────
export default function SubjectsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { addToast } = useToast();

  const [subjects, setSubjects] = useState([]);
  const [images, setImages] = useState({});
  const [icons, setIcons] = useState({});
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isDark = theme.mode === 'dark';

  const filteredSubjects = searchQuery.trim()
    ? subjects.filter(s => {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q)
        );
      })
    : subjects;

  // ── Load subjects ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await subjectsAPI.getAll();
        if (!cancelled) {
          setSubjects(data);
          const imgs = {};
          const icns = {};
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

  // ── CRUD handlers ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.name.trim()) return addToast('Name is required', 'error');
    try {
      await subjectsAPI.create(form);
      setForm({ name: '', description: '' });
      setShowForm(false);
      const data = await subjectsAPI.getAll();
      setSubjects(data);
      const imgs = {}, icns = {};
      data.forEach((s, i) => {
        imgs[s.id] = s.cover_image || images[s.id] || subjectImg(s.name);
        icns[s.id] = s.icon || icons[s.id] || ICONS[i % ICONS.length];
      });
      setImages(imgs);
      setIcons(icns);
      addToast('Subject created', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = (id, name) => {
    Alert.alert(`Delete "${name}"?`, '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          try {
            await subjectsAPI.delete(id);
            setSubjects(prev => prev.filter(s => s.id !== id));
            addToast(`"${name}" deleted`, 'success');
          } catch (err) {
            addToast(err.message, 'error');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleRename = async (id, newName) => {
    if (!newName.trim()) return;
    try {
      await subjectsAPI.update(id, { name: newName.trim() });
      setSubjects(prev =>
        prev.map(s => (s.id === id ? { ...s, name: newName.trim() } : s))
      );
      addToast('Subject renamed', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setEditingId(null);
    }
  };

  // ── Image picker ───────────────────────────────────────────────────────
  const handleImageSelect = async (id, url) => {
    const prevUrl = images[id];
    setImages(prev => ({ ...prev, [id]: url }));
    setPickerOpen(null);
    try {
      await subjectsAPI.update(id, { cover_image: url });
    } catch {
      setImages(prev => ({ ...prev, [id]: prevUrl }));
      addToast('Failed to save image', 'error');
    }
  };

  const pickFromGallery = async (id) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
      handleImageSelect(id, dataUrl);
    }
  };

  // ── Icon cycling ───────────────────────────────────────────────────────
  const changeIcon = async (id) => {
    const prevIcon = icons[id];
    const idx = ICONS.indexOf(icons[id]);
    const next = ICONS[(idx + 1) % ICONS.length];
    setIcons(prev => ({ ...prev, [id]: next }));
    try {
      await subjectsAPI.update(id, { icon: next });
    } catch {
      setIcons(prev => ({ ...prev, [id]: prevIcon }));
      addToast('Failed to save icon', 'error');
    }
  };

  // ── Highlight text helper ──────────────────────────────────────────────
  const highlightText = (text, query) => {
    if (!query || !text) return <Text>{text}</Text>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <Text>{text}</Text>;
    return (
      <Text>
        {text.slice(0, idx)}
        <Text style={{ backgroundColor: isDark ? 'rgba(251,191,36,0.3)' : 'rgba(251,191,36,0.6)', borderRadius: 4 }}>
          {text.slice(idx, idx + query.length)}
        </Text>
        {text.slice(idx + query.length)}
      </Text>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.muted, marginTop: 12 }}>{t('subjects.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <FlatList
        data={filteredSubjects}
        keyExtractor={item => item.id.toString()}
        numColumns={1}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={() => (
          <>
            {/* Hero */}
            <View style={[styles.hero, { backgroundColor: isDark ? '#1E3A5F' : '#0891b2' }]}>
              <Text style={styles.heroTitle}>
                Your lectures, turned into{'\n'}smart exams instantly
              </Text>
              <Text style={styles.heroSubtitle}>
                Upload your course materials, structure your subjects, and let AI generate professional exams tailored to your content — in minutes.
              </Text>

              {/* Search bar */}
              <View style={[styles.searchBar, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('subjects.searchPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  style={[styles.searchInput, { color: '#fff' }]}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Section header */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {searchQuery.trim() ? t('subjects.subtitle') : t('subjects.title')}
                </Text>
                {searchQuery.trim() ? (
                  <Text style={{ color: theme.muted, fontSize: 12 }}>
                    {filteredSubjects.length} of {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
                  </Text>
                ) : null}
              </View>
              {subjects.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowForm(!showForm)}
                  style={[styles.addBtn, { backgroundColor: theme.primary }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {showForm ? t('subjects.cancel') : t('subjects.newSubject')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Create form */}
            {showForm && (
              <View style={[styles.formCard, { borderColor: theme.primary + '40', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
                <TextInput
                  value={form.name}
                  onChangeText={v => setForm(p => ({ ...p, name: v }))}
                  placeholder="Subject name"
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}
                />
                <TextInput
                  value={form.description}
                  onChangeText={v => setForm(p => ({ ...p, description: v }))}
                  placeholder="Description (optional)"
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}
                />
                <TouchableOpacity onPress={handleCreate} style={[styles.createBtn, { backgroundColor: theme.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Create Subject</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        renderItem={({ item, index }) => (
          <SubjectCard
            subject={item}
            image={images[item.id] || subjectImg(item.name)}
            icon={icons[item.id] || ICONS[index % ICONS.length]}
            deleting={deletingId === item.id}
            onDelete={() => handleDelete(item.id, item.name)}
            onChangeImage={() => setPickerOpen(item.id)}
            onChangeIcon={() => changeIcon(item.id)}
            editingName={editingId === item.id}
            editNameValue={editName}
            onStartRename={() => { setEditingId(item.id); setEditName(item.name); }}
            onEditNameChange={setEditName}
            onConfirmRename={() => handleRename(item.id, editName)}
            onCancelRename={() => setEditingId(null)}
            highlight={searchQuery.trim()}
            highlightText={highlightText}
            onPress={() => navigation.navigate('SubjectDetail', { subjectId: item.id })}
            theme={theme}
            t={t}
          />
        )}
        ListFooterComponent={() => <View style={{ height: 40 }} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📚</Text>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18 }}>
              {t('subjects.noSubjects')}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4 }}>
              {t('subjects.noSubjectsDesc')}
            </Text>
            <TouchableOpacity onPress={() => setShowForm(true)} style={[styles.createBtn, { backgroundColor: theme.primary, marginTop: 16 }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ {t('subjects.newSubject')}</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Image Picker Modal */}
      <Modal visible={pickerOpen !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Choose Image</Text>
              <TouchableOpacity onPress={() => setPickerOpen(null)}>
                <Text style={{ color: theme.muted, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Upload from device */}
            <TouchableOpacity
              onPress={() => pickFromGallery(pickerOpen)}
              style={[styles.uploadBtn, { borderColor: theme.border }]}
            >
              <Text style={{ color: theme.text }}>📁 Upload from device</Text>
            </TouchableOpacity>

            {/* Sample images grid */}
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 16, marginBottom: 8 }}>Or choose from library</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SAMPLE_IMAGES.map((src, i) => {
                const isSelected = images[pickerOpen] === src;
                return (
                  <TouchableOpacity key={i} onPress={() => handleImageSelect(pickerOpen, src)}>
                    <Image
                      source={{ uri: src }}
                      style={[styles.sampleImg, isSelected && { borderColor: theme.primary, borderWidth: 3 }]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── SubjectCard ────────────────────────────────────────────────────────────
function SubjectCard({
  subject, image, icon, deleting, onDelete, onChangeImage, onChangeIcon,
  editingName, editNameValue, onStartRename, onEditNameChange,
  onConfirmRename, onCancelRename, highlight, highlightText, onPress, theme, t,
}) {
  const isDark = theme.mode === 'dark';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, {
        backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : '#fff',
        borderColor: theme.border,
        shadowColor: isDark ? '#000' : '#000',
      }]}
      activeOpacity={0.95}
    >
      {/* Image header */}
      <View style={styles.cardImageContainer}>
        <Image source={{ uri: image }} style={styles.cardImage} />
        <View style={styles.cardImageOverlay}>
          <TouchableOpacity onPress={onChangeImage} style={styles.changeImageBtn}>
            <Text style={{ color: '#fff', fontSize: 14 }}>📁</Text>
          </TouchableOpacity>
          <View style={styles.cardBadges}>
            <View style={styles.badge}>
              <Text style={{ color: '#fff', fontSize: 11 }}>▶ {subject.course_count || 0} Courses</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text style={{ color: '#fff', fontSize: 11 }}>{subject.exam_count || 0} Exams</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          {/* Icon */}
          <TouchableOpacity onPress={onChangeIcon} style={styles.iconContainer}>
            <Text style={{ fontSize: 24 }}>{icon}</Text>
            <View style={styles.editIconBadge}>
              <Text style={{ fontSize: 8 }}>✏️</Text>
            </View>
          </TouchableOpacity>

          {/* Name */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            {editingName ? (
              <TextInput
                value={editNameValue}
                onChangeText={onEditNameChange}
                onSubmitEditing={onConfirmRename}
                onBlur={onConfirmRename}
                style={{
                  fontWeight: '800', fontSize: 16, color: theme.text,
                  borderBottomWidth: 2, borderBottomColor: theme.primary,
                  flex: 1, paddingVertical: 0,
                }}
                autoFocus
              />
            ) : (
              <TouchableOpacity onLongPress={onStartRename} style={{ flex: 1 }}>
                {highlightText(subject.name, highlight)}
              </TouchableOpacity>
            )}
          </View>

          {/* Delete */}
          <TouchableOpacity onPress={onDelete} disabled={deleting}>
            <Text style={{ color: '#EF4444', fontSize: 18, opacity: deleting ? 0.3 : 1 }}>🗑</Text>
          </TouchableOpacity>
        </View>

        {subject.description ? (
          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 8 }} numberOfLines={2}>
            {highlightText(subject.description, highlight)}
          </Text>
        ) : null}

        {/* Navigate to detail */}
        <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8 }}>
          <TouchableOpacity onPress={onPress} style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>
              {t('subjects.generate')} →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  hero: {
    borderRadius: 20, padding: 20, marginBottom: 20,
  },
  heroTitle: {
    color: '#fff', fontSize: 28, fontWeight: '800',
    marginBottom: 8, lineHeight: 36,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)', fontSize: 14,
    marginBottom: 16, lineHeight: 20,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 16,
    marginTop: 8,
  },
  searchInput: {
    flex: 1, fontSize: 14, paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20, fontWeight: '800',
  },
  addBtn: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12,
  },
  formCard: {
    borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16,
  },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, marginBottom: 10,
  },
  createBtn: {
    padding: 14, borderRadius: 10, alignItems: 'center',
  },
  card: {
    borderRadius: 16, borderWidth: 1, marginBottom: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardImageContainer: { height: 140, position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'space-between',
    padding: 10,
  },
  changeImageBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 6,
  },
  cardBadges: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardBody: { padding: 14 },
  iconContainer: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12, position: 'relative',
  },
  editIconBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#ccc',
  },
  emptyState: {
    alignItems: 'center', paddingVertical: 40,
  },
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 16,
  },
  modalContent: {
    width: '100%', borderRadius: 20, padding: 20,
    borderWidth: 1, maxHeight: '80%',
  },
  uploadBtn: {
    borderWidth: 2, borderStyle: 'dashed',
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  sampleImg: {
    width: (width - 80) / 3 - 6,
    height: (width - 80) / 3 * 0.6,
    borderRadius: 10, resizeMode: 'cover',
  },
});

