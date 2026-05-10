import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ScrollView,
  ActivityIndicator, Alert, Modal, Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';
import { archiveAPI } from '../api/client';

// Reusable Icon component using theme colours
const Icon = ({ name, size = 16, color }) => {
  const { theme } = useTheme();
  const clr = color || theme.muted;
  // (You can replace with react-native-vector-icons or custom SVGs)
  return (
    <Text style={{ fontSize: size, color: clr }}>
      {name === 'archive' ? '📦' : name === 'draft' ? '📝' : name === 'trash' ? '🗑️' : '✔️'}
    </Text>
  );
};

// Constants mapped from web
const MODE = {
  questions: { icon: 'draft', accent: 'blue' },
  full_exam: { icon: 'archive', accent: 'sky' },
};

const SUBJECT_META = {
  algo:        { label: 'Algorithmics',    color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
  se:          { label: 'Software Eng.',   color: '#2563EB', bg: '#DBEAFE', border: '#BFDBFE' },
  commerce:    { label: 'Commerce',        color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  Law:         { label: 'Law',             color: '#BE123C', bg: '#FFE4E6', border: '#FECDD3' },
  compilation: { label: 'Compilation',     color: '#0284C7', bg: '#E0F2FE', border: '#BAE6FD' },
};

const TAB_IDS = ['all', 'accepted', 'rejected'];
const TAB_STATUS = { all: 'pending', accepted: 'accepted', rejected: 'rejected' };

// ArchiveHeader component – same as web
const Header = ({ entries, loading, user, t }) => {
  const { theme } = useTheme();
  const counts = {
    all: entries.length,
    accepted: entries.filter(e => e.status === 'accepted').length,
    rejected: entries.filter(e => e.status === 'rejected').length,
  };
  return (
    <View style={{ padding: 20, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16 }}>📦</Text>
        </View>
        <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1 }}>{t('archive.subtitle')}</Text>
      </View>
      <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 4 }}>{t('archive.title')}</Text>
      <Text style={{ fontSize: 12, color: theme.muted }}>
        {loading ? '…' : `${entries.length} ${t('archive.generation')}${entries.length !== 1 ? 's' : ''} · ${[...new Set(entries.map(e => e.ai_subject))].length} ${t('archive.subject')}${[...new Set(entries.map(e => e.ai_subject))].length !== 1 ? 's' : ''}`}
      </Text>
      {user && (
        <View style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 }}>
          <Text style={{ fontSize: 11, color: theme.muted }}>
            {t('archive.usedQuota', { count: user.exam_count ?? 0, limit: user.exam_limit ?? 10 })}
          </Text>
        </View>
      )}
    </View>
  );
};

// Tabs component – handles drag-to-tab via long press
const Tabs = ({ activeTab, setActiveTab, counts, dragOverTab, setDragOverTab, draggingIds, onDropToTab }) => {
  const { theme } = useTheme();
  const tabs = [
    { id: 'all', label: t('archive.all'), icon: 'archive' },
    { id: 'accepted', label: t('archive.favorites'), icon: 'draft' },
    { id: 'rejected', label: t('archive.trash'), icon: 'trash' },
  ];
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const isDropOver = dragOverTab === tab.id;
        const dropStyle = tab.id === 'accepted' ? { borderColor: '#0EA5E9', backgroundColor: 'rgba(14,165,233,0.1)' }
                        : tab.id === 'rejected' ? { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' }
                        : {};
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => { setActiveTab(tab.id); setDragOverTab(null); }}
            onLongPress={() => {}}
            style={[
              {
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1.5,
                marginHorizontal: 4,
              },
              isDropOver
                ? [{ borderStyle: 'dashed', borderWidth: 2, ...dropStyle }]
                : isActive
                  ? [{ backgroundColor: '#2563EB', borderColor: '#2563EB' }]
                  : [{ backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderColor: theme.border }],
            ]}
          >
            <Text style={{ fontSize: 14, marginRight: 6, color: isActive ? '#fff' : theme.text }}>{t.emoji || '📄'}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#fff' : theme.text }}>{tab.label}</Text>
            <Text style={{ fontSize: 11, marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : (theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#E2E8F0'), color: isActive ? '#fff' : theme.muted }}>
              {counts[tab.id]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Subject filter chips – horizontal scroll
const SubjectChips = ({ subjects, filterSubject, setFilterSubject, groupedEntries }) => {
  const { theme } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
      <TouchableOpacity
        onPress={() => setFilterSubject('all')}
        style={{
          paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
          marginRight: 8,
          backgroundColor: filterSubject === 'all' ? (theme.mode === 'dark' ? '#1E293B' : '#2563EB') : 'transparent',
          borderColor: filterSubject === 'all' ? '#2563EB' : theme.border,
        }}>
        <Text style={{ fontSize: 12, color: filterSubject === 'all' ? '#fff' : theme.text }}>All</Text>
      </TouchableOpacity>
      {subjects.map(s => {
        const meta = SUBJECT_META[s] || { color: theme.text };
        return (
          <TouchableOpacity
            key={s}
            onPress={() => setFilterSubject(s)}
            style={{
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, marginRight: 8,
              backgroundColor: filterSubject === s ? meta.color + '20' : 'transparent',
              borderColor: filterSubject === s ? meta.color : theme.border,
            }}>
            <Text style={{ fontSize: 12, color: filterSubject === s ? meta.color : theme.muted }}>{meta.label || s}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// Archive card – simplified but same functionality
const ArchiveCard = ({ entry, index, onPress, onStatus, onDelete, isSelected, onSelect }) => {
  const { theme } = useTheme();
  const isQ = entry.mode === 'questions';
  const meta = MODE[entry.mode] || MODE.questions;
  const date = new Date(entry.created_at).toLocaleDateString('fr-DZ', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const count = isQ ? (Array.isArray(entry.content) ? entry.content.length : 0) : (entry.content?.exercises?.length || 0);
  return (
    <TouchableOpacity
      onPress={() => onPress(entry.id)}
      onLongPress={() => onSelect(entry.id)}
      style={{
        marginHorizontal: 16, marginBottom: 10,
        borderRadius: 16, borderWidth: 1,
        backgroundColor: isSelected ? `${theme.primary}10` : (entry.status === 'rejected' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.72)'),
        borderColor: isSelected ? theme.primary : (entry.status === 'rejected' ? '#E5E7EB' : theme.border),
        ...(isSelected && { borderWidth: 2 }),
      }}
    >
      <View style={{ flexDirection: 'row', padding: 12, alignItems: 'center' }}>
        {/* Checkbox */}
        <TouchableOpacity onPress={() => onSelect(entry.id)} style={{ marginRight: 10 }}>
          <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, justifyContent: 'center', alignItems: 'center', borderColor: isSelected ? theme.primary : theme.muted }}>
            {isSelected && <Text style={{ color: theme.primary, fontWeight: 'bold' }}>✓</Text>}
          </View>
        </TouchableOpacity>
        {/* Mode icon */}
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: meta.accent === 'blue' ? '#DBEAFE' : '#F0F9FF', justifyContent: 'center', alignItems: 'center' }}>
          <Text>{meta.icon === 'draft' ? '📝' : '📄'}</Text>
        </View>
        {/* Info */}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontWeight: '600', fontSize: 15, color: theme.text }} numberOfLines={1}>
            {entry.title || (isQ ? t('archive.questionsBank') : t('archive.fullExam'))}
          </Text>
          <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
            {entry.ai_subject} · {count} {isQ ? 'q' : 'ex'} · {date}
          </Text>
        </View>
        {/* Status badge */}
        <View style={{
          paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
          borderWidth: 1,
          backgroundColor: entry.status === 'accepted' ? '#E0F2FE' : entry.status === 'rejected' ? '#FFE4E6' : '#F1F5F9',
          borderColor: entry.status === 'accepted' ? '#7DD3FC' : entry.status === 'rejected' ? '#FECDD3' : '#E2E8F0',
        }}>
          <Text style={{ fontSize: 10, color: entry.status === 'accepted' ? '#0369A1' : entry.status === 'rejected' ? '#BE123C' : '#475569' }}>
            {entry.status === 'accepted' ? t('archive.favorite') : entry.status === 'rejected' ? t('archive.trash') : t('archive.pending')}
          </Text>
        </View>
        {/* Actions (condensed) */}
        <TouchableOpacity onPress={() => onStatus(entry.id, 'accepted')} style={{ marginLeft: 8 }}>
          <Text style={{ color: '#0284C7' }}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onStatus(entry.id, 'rejected')} style={{ marginLeft: 8 }}>
          <Text style={{ color: '#EF4444' }}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(entry.id)} style={{ marginLeft: 8 }}>
          <Text style={{ color: '#94A3B8' }}>🗑</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// Main Archive Screen
export default function ArchiveScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const { user } = useContext(AuthContext);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    archiveAPI.getAll()
      .then(setEntries)
      .catch(e => addToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Tab-filtered entries
  const tabFiltered = activeTab === 'all'
    ? entries
    : entries.filter(e => e.status === (activeTab === 'accepted' ? 'accepted' : 'rejected'));

  const subjects = [...new Set(tabFiltered.map(e => e.ai_subject))];
  const filtered = filterSubject === 'all'
    ? tabFiltered
    : tabFiltered.filter(e => e.ai_subject === filterSubject);

  const handleStatus = async (id, status) => {
    try {
      const updated = await archiveAPI.update(id, { status });
      setEntries(prev => prev.map(e => (e.id === id ? { ...e, status: updated.status } : e)));
      addToast(t('archive.updated'), 'success');
    } catch (e) {
      addToast(e.message, 'error');
    }
  };

  const handleDelete = (id) => {
    Alert.alert(t('archive.confirmDeleteTitle'), t('archive.confirmDeleteMsg'), [
      { text: t('archive.cancel'), style: 'cancel' },
      {
        text: t('archive.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await archiveAPI.delete(id);
            setEntries(prev => prev.filter(e => e.id !== id));
            addToast(t('archive.deleted'), 'success');
          } catch (e) { addToast(e.message, 'error'); }
        },
      },
    ]);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkAction = (status) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Alert.alert(
      t('archive.bulkConfirm'),
      t('archive.bulkConfirmMsg', { count: ids.length, status }),
      [
        { text: t('archive.cancel'), style: 'cancel' },
        {
          text: t('archive.confirm'),
          onPress: async () => {
            try {
              await Promise.all(ids.map(id => archiveAPI.update(id, { status })));
              setEntries(prev => prev.map(e => (ids.includes(e.id) ? { ...e, status } : e)));
              setSelectedIds(new Set());
              addToast(t('archive.bulkSuccess'), 'success');
            } catch (e) { addToast(e.message, 'error'); }
          },
        },
      ]
    );
  };

  // Counts for tabs
  const counts = {
    all: entries.length,
    accepted: entries.filter(e => e.status === 'accepted').length,
    rejected: entries.filter(e => e.status === 'rejected').length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={() => (
          <>
            <Header entries={entries} loading={loading} user={user} t={t} />
            <Tabs activeTab={activeTab} setActiveTab={setActiveTab} counts={counts} dragOverTab={null} setDragOverTab={() => {}} draggingIds={[]} onDropToTab={() => {}} />
            {subjects.length > 1 && (
              <SubjectChips subjects={subjects} filterSubject={filterSubject} setFilterSubject={setFilterSubject} groupedEntries={{}} />
            )}
            {selectedIds.size > 0 && (
              <View style={{ flexDirection: 'row', padding: 16, gap: 8 }}>
                <TouchableOpacity onPress={() => bulkAction('accepted')} style={{ flex: 1, padding: 10, backgroundColor: '#DBEAFE', borderRadius: 8 }}>
                  <Text style={{ textAlign: 'center', color: '#1E40AF' }}>{t('archive.favorites')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => bulkAction('rejected')} style={{ flex: 1, padding: 10, backgroundColor: '#FFE4E6', borderRadius: 8 }}>
                  <Text style={{ textAlign: 'center', color: '#BE123C' }}>{t('archive.trash')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={{ padding: 10 }}>
                  <Text style={{ color: theme.muted }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        renderItem={({ item, index }) => (
          <ArchiveCard
            entry={item}
            index={index}
            onPress={(id) => setExpandedId(id === expandedId ? null : id)}
            onStatus={handleStatus}
            onDelete={handleDelete}
            isSelected={selectedIds.has(item.id)}
            onSelect={toggleSelect}
          />
        )}
        ListFooterComponent={() => loading ? <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} /> : null}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
      {/* Expanded modal for card detail – you can implement similar to web expand */}
    </View>
  );
}

