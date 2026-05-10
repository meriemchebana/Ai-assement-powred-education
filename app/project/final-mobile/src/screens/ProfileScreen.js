import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  Modal, Alert, ActivityIndicator, StyleSheet, Platform,
  KeyboardAvoidingView, Animated, FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { profileAPI, subjectsAPI } from '../api/client';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Constants ──────────────────────────────────────────────────────────────
const TEACHING_LEVELS = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'BTS', 'Prépa', 'Terminale'];
const POSITIONS = [
  'Professor', 'Associate Professor', 'Assistant Professor',
  'Lecturer', 'Teaching Assistant', 'Researcher', 'Department Head', 'Other',
];
const generateId = () => Math.random().toString(36).slice(2);

/* ── LocalStorage helper for contexts (scoped per user) ──────────────────── */
const loadContexts = async (userId) => {
  try {
    const key = userId ? `exam_teaching_profile_${userId}` : null;
    if (!key) return [];
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw).contexts || [] : [];
  } catch { return []; }
};

const saveContexts = async (contexts, userId) => {
  const key = userId ? `exam_teaching_profile_${userId}` : null;
  if (!key) return;
  await AsyncStorage.setItem(key, JSON.stringify({ contexts }));
};

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

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const [stats, setStats] = useState({ subjects: 0, exams: 0 });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', avatar: null,
    institution: '', department: '', position: '', phone: '', bio: '',
  });

  // Teaching contexts state
  const [contexts, setContexts] = useState([]);
  const [editingCtxId, setEditingCtxId] = useState(null);
  const [ctxDraft, setCtxDraft] = useState(null);
  const [ctxTagInput, setCtxTagInput] = useState('');

  // Change password
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const pwHeight = useRef(new Animated.Value(0)).current;

  // Load user data into form
  useEffect(() => {
    if (!user) return;
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      avatar: user.avatar || null,
      institution: user.institution || '',
      department: user.department || '',
      position: user.position || '',
      phone: user.phone || '',
      bio: user.bio || '',
    });
  }, [user]);

  // Load contexts (user-scoped)
  useEffect(() => {
    if (!user?.id) return;
    loadContexts(user.id).then(setContexts);
  }, [user?.id]);

  // Save contexts whenever they change (user-scoped)
  useEffect(() => {
    if (!user?.id) return;
    saveContexts(contexts, user.id);
  }, [contexts, user?.id]);

  // Load stats
  useEffect(() => {
    subjectsAPI.getAll().then(subjects => {
      const totalExams = subjects.reduce((a, s) => a + (s.exam_count || 0), 0);
      setStats({ subjects: subjects.length, exams: totalExams });
    }).catch(() => {});
  }, []);

  // ── Avatar ─────────────────────────────────────────────────────────────
  const pickAvatar = async () => {
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
      const base64 = result.assets[0].base64;
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      setForm(prev => ({ ...prev, avatar: dataUrl }));
    }
  };

  // ── Save profile ───────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await profileAPI.update({
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        avatar: form.avatar || null,
        institution: form.institution || null,
        department: form.department || null,
        position: form.position || null,
        phone: form.phone || null,
        bio: form.bio || null,
      });
      await refreshUser();
      addToast(t('profile.profileUpdated'), 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Context editing helpers ────────────────────────────────────────────
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
      setContexts(prev => prev.map(c => (c.id === editingCtxId ? ctxDraft : c)));
    }
    setEditingCtxId(null);
    setCtxDraft(null);
    setCtxTagInput('');
  };

  const deleteCtx = (id) => setContexts(prev => prev.filter(c => c.id !== id));

  const setDraftField = (key, val) => setCtxDraft(d => ({ ...d, [key]: val }));

  const toggleDraftLevel = (level) =>
    setCtxDraft(d => ({
      ...d,
      levels: d.levels.includes(level)
        ? d.levels.filter(l => l !== level)
        : [...d.levels, level],
    }));

  const addDraftSubject = (val) => {
    const tag = val.trim().replace(/,$/, '');
    if (tag && !ctxDraft.subjects.includes(tag)) {
      setDraftField('subjects', [...ctxDraft.subjects, tag]);
    }
    setCtxTagInput('');
  };

  const removeDraftSubject = (tag) =>
    setDraftField('subjects', ctxDraft.subjects.filter(s => s !== tag));

  // ── Change password ────────────────────────────────────────────────────
  const togglePasswordSection = () => {
    Animated.timing(pwHeight, {
      toValue: pwOpen ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setPwOpen(!pwOpen);
  };

  const handleChangePassword = async () => {
    if (pwForm.next !== pwForm.confirm)
      return addToast('Passwords don’t match', 'error');
    if (pwForm.next.length < 6)
      return addToast('Password must be at least 6 characters', 'error');
    setPwSaving(true);
    try {
      await profileAPI.changePassword(pwForm.current, pwForm.next);
      addToast(t('profile.passwordUpdated'), 'success');
      setPwForm({ current: '', next: '', confirm: '' });
      togglePasswordSection(); // collapse
    } catch (err) {
      addToast(err.message || t('profile.wrongPassword'), 'error');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Helper ─────────────────────────────────────────────────────────────
  const initials = `${form.first_name?.[0] || ''}${form.last_name?.[0] || ''}`.toUpperCase() || '?';
  const isDark = theme.mode === 'dark';

  const fieldStyle = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    color: isDark ? '#fff' : '#0f172a',
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.bg }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HERO CARD ──────────────────────────────────────────────────── */}
        <View style={[styles.heroCard, { backgroundColor: theme.primary }]}>
          <View style={styles.heroRow}>
            {/* Avatar */}
            <TouchableOpacity onPress={pickAvatar} style={styles.avatarBtn}>
              {form.avatar ? (
                <Image source={{ uri: form.avatar }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 28 }}>{initials}</Text>
                </View>
              )}
              <View style={styles.avatarOverlay}>
                <Text style={{ color: '#fff', fontSize: 14 }}>📷</Text>
              </View>
            </TouchableOpacity>

            {/* Name & badges */}
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                {form.first_name || user?.first_name} {form.last_name || user?.last_name}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {form.position ? <Badge label={form.position} /> : null}
                {form.department ? <Badge label={form.department} /> : null}
                {form.institution ? <Badge label={`🏛 ${form.institution}`} /> : null}
              </View>
            </View>

            {/* Stats */}
            <View style={{ alignItems: 'center', marginLeft: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 24 }}>{stats.subjects}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Subjects</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 24, marginTop: 8 }}>{stats.exams}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Exams</Text>
            </View>
          </View>
        </View>

        {/* ── FORM ────────────────────────────────────────────────────────── */}
        {/* Personal Info */}
        <Section title={t('profile.personalInfo')} icon="👤">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Field label={t('profile.firstName')} value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} style={fieldStyle} />
            <Field label={t('profile.lastName')} value={form.last_name} onChange={v => setForm(f => ({ ...f, last_name: v }))} style={fieldStyle} />
            <Field label={t('profile.email')} value={user?.email || ''} editable={false} style={fieldStyle} />
            <Field label={t('profile.phone')} value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} style={fieldStyle} keyboardType="phone-pad" />
          </View>
        </Section>

        {/* Professional Info */}
        <Section title={t('profile.professionalInfo')} icon="🏛">
          <Field label={t('profile.institution')} value={form.institution} onChange={v => setForm(f => ({ ...f, institution: v }))} style={fieldStyle} />
          <Field label={t('profile.department')} value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))} style={fieldStyle} />
          <Field label={t('profile.position')} value={form.position} onChange={v => setForm(f => ({ ...f, position: v }))} style={fieldStyle} isSelect options={POSITIONS} />
        </Section>

        {/* Bio */}
        <Section title={t('profile.aboutMe')} icon="✏️">
          <TextInput
            value={form.bio}
            onChangeText={v => setForm(f => ({ ...f, bio: v }))}
            placeholder="Describe your teaching experience..."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)'}
            multiline
            numberOfLines={6}
            style={[fieldStyle, { height: 100, textAlignVertical: 'top' }]}
          />
        </Section>

        {/* Teaching Contexts */}
        <Section title="Teaching Contexts" icon="📚">
          {/* List of contexts */}
          {contexts.map(ctx => (
            <View key={ctx.id}>
              {editingCtxId === ctx.id && ctxDraft ? (
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
                  theme={theme}
                />
              ) : (
                <ContextRow
                  ctx={ctx}
                  onEdit={() => openEditCtx(ctx)}
                  onDelete={() => deleteCtx(ctx.id)}
                  theme={theme}
                />
              )}
            </View>
          ))}

          {/* New context form */}
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
              theme={theme}
            />
          )}

          {contexts.length === 0 && editingCtxId !== 'new' && (
            <Text style={{ color: theme.muted, textAlign: 'center', paddingVertical: 20 }}>
              No teaching contexts. Tap "Add" to create one.
            </Text>
          )}

          {editingCtxId !== 'new' && (
            <TouchableOpacity onPress={openAddCtx} style={styles.addBtn}>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>+ Add Context</Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* Save button */}
        <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('profile.save')}</Text>}
        </TouchableOpacity>

        {/* Change Password */}
        <TouchableOpacity onPress={togglePasswordSection} style={styles.pwHeader}>
          <Text style={{ color: theme.text, fontWeight: '600' }}>{t('profile.changePassword')}</Text>
          <Text style={{ color: theme.muted }}>{pwOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        <Animated.View style={{ height: pwHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }), overflow: 'hidden' }}>
          <View style={{ padding: 16 }}>
            <Field
              label={t('profile.currentPassword')}
              value={pwForm.current}
              onChange={v => setPwForm(p => ({ ...p, current: v }))}
              secureTextEntry={!showCurrent}
              rightIcon={
                <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                  <Text>{showCurrent ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              }
              style={fieldStyle}
            />
            <Field
              label={t('profile.newPassword')}
              value={pwForm.next}
              onChange={v => setPwForm(p => ({ ...p, next: v }))}
              secureTextEntry={!showNew}
              rightIcon={
                <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                  <Text>{showNew ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              }
              style={fieldStyle}
            />
            <Field
              label="Confirm New"
              value={pwForm.confirm}
              onChange={v => setPwForm(p => ({ ...p, confirm: v }))}
              secureTextEntry={!showConfirm}
              rightIcon={
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Text>{showConfirm ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              }
              style={fieldStyle}
            />
            <TouchableOpacity onPress={handleChangePassword} disabled={pwSaving} style={[styles.saveBtn, { backgroundColor: '#F59E0B' }]}>
              {pwSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Update Password</Text>}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */
function Badge({ label }) {
  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginRight: 4,
      marginBottom: 4,
    }}>
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

function Section({ title, icon, children }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.section, {
      backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
      borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>{icon}</Text>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, onChange, editable = true, secureTextEntry, rightIcon, style, isSelect, options, ...rest }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const inputStyle = [style, {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    color: isDark ? '#fff' : '#0f172a',
  }];

  return (
    <View style={{ flex: 1, minWidth: '45%', marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', marginBottom: 4 }}>
        {label}
      </Text>
      {isSelect ? (
        <View style={[inputStyle, { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1 }]}>
          <Picker
            selectedValue={value}
            onValueChange={onChange}
            style={{ color: isDark ? '#fff' : '#0f172a' }}
          >
            <Picker.Item label="Select..." value="" />
            {options.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
          </Picker>
        </View>
      ) : (
        <View style={{ position: 'relative' }}>
          <TextInput
            value={value}
            onChangeText={onChange}
            editable={editable}
            secureTextEntry={secureTextEntry}
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)'}
            style={[inputStyle, { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 }]}
            {...rest}
          />
          {rightIcon && (
            <View style={{ position: 'absolute', right: 12, top: '50%', transform: [{ translateY: -10 }] }}>
              {rightIcon}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ContextRow({ ctx, onEdit, onDelete, theme }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start',
      padding: 12, borderRadius: 12, borderWidth: 1,
      borderColor: theme.border, marginBottom: 8,
      backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: '600' }}>
          {ctx.institution || <Text style={{ color: theme.muted, fontStyle: 'italic' }}>No institution</Text>}
        </Text>
        {ctx.faculty ? <Text style={{ color: theme.muted, fontSize: 13 }}>{ctx.faculty}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
          {ctx.levels.map(l => (
            <View key={l} style={styles.tag}>
              <Text style={{ fontSize: 10, color: theme.text }}>{l}</Text>
            </View>
          ))}
          {ctx.subjects.map(s => (
            <View key={s} style={styles.tag}>
              <Text style={{ fontSize: 10, color: theme.text }}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity onPress={onEdit} style={{ padding: 8 }}>
          <Text style={{ color: theme.primary }}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={{ padding: 8 }}>
          <Text style={{ color: '#EF4444' }}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ContextForm({ draft, tagInput, setTagInput, onFieldChange, onToggleLevel, onAddSubject, onRemoveSubject, onSave, onCancel, isNew, theme }) {
  return (
    <View style={{
      padding: 14, borderRadius: 12, borderWidth: 1,
      borderColor: theme.primary, backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.2)' : '#EFF6FF',
      marginBottom: 12,
    }}>
      <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 8 }}>
        {isNew ? 'New Context' : 'Edit Context'}
      </Text>

      {/* Fields */}
      <InputRow label="Institution" value={draft.institution} onChange={v => onFieldChange('institution', v)} theme={theme} />
      <InputRow label="Faculty" value={draft.faculty} onChange={v => onFieldChange('faculty', v)} theme={theme} />
      <InputRow label="Speciality" value={draft.speciality} onChange={v => onFieldChange('speciality', v)} theme={theme} />
      <InputRow label="Academic Year" value={draft.academic_year} onChange={v => onFieldChange('academic_year', v)} theme={theme} />
      <InputRow label="Default Session" value={draft.session} onChange={v => onFieldChange('session', v)} theme={theme} />

      {/* Levels */}
      <Text style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>Levels</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 4 }}>
        {TEACHING_LEVELS.map(lev => (
          <TouchableOpacity key={lev} onPress={() => onToggleLevel(lev)} style={[
            styles.chip,
            draft.levels.includes(lev) ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.border },
          ]}>
            <Text style={{ color: draft.levels.includes(lev) ? '#fff' : theme.text, fontSize: 11 }}>{lev}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subjects tag input */}
      <Text style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>Subjects</Text>
      <View style={{
        flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
        borderWidth: 1, borderColor: theme.border, borderRadius: 8,
        padding: 6, marginBottom: 10, minHeight: 40,
      }}>
        {draft.subjects.map(tag => (
          <View key={tag} style={styles.tag}>
            <Text style={{ fontSize: 10, color: theme.text }}>{tag}</Text>
            <TouchableOpacity onPress={() => onRemoveSubject(tag)}>
              <Text style={{ marginLeft: 4, color: theme.muted }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TextInput
          value={tagInput}
          onChangeText={setTagInput}
          onSubmitEditing={() => { if (tagInput.trim()) onAddSubject(tagInput); }}
          blurOnSubmit={false}
          placeholder="Add subject..."
          placeholderTextColor={theme.muted}
          style={{ flex: 1, minWidth: 80, color: theme.text, fontSize: 12, padding: 4 }}
        />
      </View>

      {/* Buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={{ color: theme.muted }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSave}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InputRow({ label, value, onChange, theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <Text style={{ width: 100, fontSize: 12, color: theme.muted }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={{
          flex: 1, backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#fff',
          borderRadius: 6, borderWidth: 1, borderColor: theme.border,
          padding: 8, color: theme.text, fontSize: 13,
        }}
        placeholderTextColor={theme.muted}
      />
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBtn: {
    width: 70,
    height: 70,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 12,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  saveBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  pwHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.1)',
    marginBottom: 8,
  },
  addBtn: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
});

