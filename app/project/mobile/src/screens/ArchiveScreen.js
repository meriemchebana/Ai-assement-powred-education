import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView,
} from 'react-native';

const COLORS = {
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#94a3b8',
  border: '#e2e8f0',
};

const ARCHIVE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'trash', label: 'Trash' },
];

export default function ArchiveScreen() {
  const [activeTab, setActiveTab] = useState('all');
  // Archive items would be loaded from archiveAPI if available
  const archiveItems = [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>My Archive</Text>
          <View style={styles.quotaBadge}>
            <Text style={styles.quotaText}>0 / 10 used</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.storageIcon}>
            <Text style={styles.storageIconText}>🗂️</Text>
          </View>
        </View>
      </View>

      {/* Tab row */}
      <View style={styles.tabRow}>
        {ARCHIVE_TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {archiveItems.length === 0 ? (
          <View style={styles.emptyState}>
            {/* Folder illustration */}
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>🗂️</Text>
            </View>
            <Text style={styles.emptyTitle}>No generations yet</Text>
            <Text style={styles.emptyDesc}>
              {activeTab === 'favorites'
                ? 'Mark exams as favorite to see them here'
                : activeTab === 'trash'
                ? 'Deleted items will appear here'
                : 'Your generated exams and documents will appear here once created'}
            </Text>
            {activeTab === 'all' && (
              <TouchableOpacity style={styles.goToSubjectsBtn}>
                <Text style={styles.goToSubjectsBtnText}>Go to Subjects</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Future: render archive items
          archiveItems.map(item => (
            <View key={item.id} style={styles.archiveCard}>
              <Text>{item.title}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  quotaBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  quotaText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  headerRight: {},
  storageIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageIconText: {
    fontSize: 18,
  },

  // Tab row
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  tabBtnTextActive: {
    color: '#ffffff',
  },

  // Scroll
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#bfdbfe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  emptyIcon: {
    fontSize: 42,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  goToSubjectsBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  goToSubjectsBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Archive card (for future use)
  archiveCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
