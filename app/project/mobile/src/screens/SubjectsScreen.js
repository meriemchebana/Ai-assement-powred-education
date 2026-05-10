import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  RefreshControl, Image,
} from 'react-native';
import { subjectsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#94a3b8',
  border: '#e2e8f0',
  danger: '#ef4444',
};

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?w=800';

export default function SubjectsScreen({ navigation, onNavigateToDetail }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const { logout, user } = useAuth();

  const loadSubjects = useCallback(async () => {
    try {
      const data = await subjectsAPI.getAll();
      setSubjects(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  const onRefresh = () => { setRefreshing(true); loadSubjects(); };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await subjectsAPI.create({ name, description });
      setName('');
      setDescription('');
      setShowForm(false);
      loadSubjects();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (id, subjectName) => {
    Alert.alert(
      'Delete Subject',
      `Delete "${subjectName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await subjectsAPI.delete(id);
              loadSubjects();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleNavigate = (item) => {
    if (onNavigateToDetail) {
      onNavigateToDetail(item.id, item.name);
    } else if (navigation) {
      navigation.navigate('SubjectDetail', { subjectId: item.id, subjectName: item.name });
    }
  };

  const filtered = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderSubject = ({ item }) => (
    <View style={styles.card}>
      {/* Cover image */}
      <View style={styles.cardImageContainer}>
        <Image
          source={{ uri: DEFAULT_COVER }}
          style={styles.cardImage}
          resizeMode="cover"
        />
        {/* Gradient-like overlay using stacked views */}
        <View style={styles.imageOverlay} />
        <Text style={styles.cardImageTitle} numberOfLines={2}>{item.name}</Text>
        {/* Exams badge */}
        {item.exams_count !== undefined && (
          <View style={styles.examsBadge}>
            <Text style={styles.examsBadgeText}>{item.exams_count} Exams</Text>
          </View>
        )}
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        <View style={styles.cardBodyRow}>
          <View style={styles.subjectIcon}>
            <Text style={styles.subjectIconText}>
              {item.name?.charAt(0)?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardMeta}>
            {item.courses_count !== undefined ? (
              <Text style={styles.cardMetaText}>
                {item.courses_count} Course{item.courses_count !== 1 ? 's' : ''}
              </Text>
            ) : (
              <Text style={styles.cardMetaText}>{item.description || 'No description'}</Text>
            )}
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => handleNavigate(item)}
              style={styles.openBtn}
            >
              <Text style={styles.openBtnText}>Open →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id, item.name)}>
              <Text style={styles.deleteText}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const ListHeader = () => (
    <View>
      {/* Hero card */}
      <View style={styles.heroCard}>
        {/* Background gradient simulation */}
        <View style={styles.heroGradientTop} />
        <View style={styles.heroGradientBot} />
        <View style={styles.heroContent}>
          <View style={styles.heroIconCircle}>
            <Text style={styles.heroIcon}>🎓</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Your Subjects</Text>
            <Text style={styles.heroSubtitle}>Manage materials & generate exams</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.heroLogout}>
            <Text style={styles.heroLogoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search subjects..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Subjects</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={styles.newBtnText}>{showForm ? '✕ Cancel' : '+ New'}</Text>
        </TouchableOpacity>
      </View>

      {/* Create form */}
      {showForm && (
        <View style={styles.createForm}>
          <Text style={styles.createFormTitle}>New Subject</Text>
          <View style={styles.createInputWrapper}>
            <Text style={styles.createInputIcon}>📝</Text>
            <TextInput
              style={styles.createInput}
              placeholder="Subject name"
              placeholderTextColor={COLORS.muted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>
          <View style={styles.createInputWrapper}>
            <Text style={styles.createInputIcon}>💬</Text>
            <TextInput
              style={styles.createInput}
              placeholder="Description (optional)"
              placeholderTextColor={COLORS.muted}
              value={description}
              onChangeText={setDescription}
            />
          </View>
          <TouchableOpacity style={styles.createSubmitBtn} onPress={handleCreate}>
            <Text style={styles.createSubmitText}>Create Subject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSubject}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<ListHeader />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>No subjects yet</Text>
            <Text style={styles.emptyText}>
              Create your first subject to get started
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowForm(true)}
            >
              <Text style={styles.emptyBtnText}>+ Create Subject</Text>
            </TouchableOpacity>
          </View>
        }
        showsVerticalScrollIndicator={false}
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

  // Hero card
  heroCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
  },
  heroGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
  },
  heroGradientBot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.primaryDark,
    transform: [{ translateX: 60 }, { translateY: 60 }],
    opacity: 0.6,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIcon: {
    fontSize: 22,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  heroLogout: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroLogoutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#ffffff',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  newBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Create form
  createForm: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 12,
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
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  createInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  createInputIcon: {
    fontSize: 14,
  },
  createInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
  },
  createSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  createSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  // List
  list: {
    paddingBottom: 24,
  },

  // Subject card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImageContainer: {
    height: 130,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cardImageTitle: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 50,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  examsBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  examsBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    padding: 12,
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subjectIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectIconText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  cardMeta: {
    flex: 1,
  },
  cardMetaText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  openBtn: {},
  openBtnText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  deleteText: {
    fontSize: 16,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
