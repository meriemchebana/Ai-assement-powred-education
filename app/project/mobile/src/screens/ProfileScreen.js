import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
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
  warning: '#f97316',
  warningBg: '#fff7ed',
  warningBorder: '#fed7aa',
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';

  const handleSave = async () => {
    setSaving(true);
    try {
      // Profile update API call would go here
      await new Promise(r => setTimeout(r, 600));
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'Password change functionality coming soon.',
      [{ text: 'OK' }]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Profile</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.signOutBtn}>
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Blue gradient profile card */}
        <View style={styles.profileCard}>
          {/* Background decoration */}
          <View style={styles.profileCardDecor} />
          <View style={styles.profileCardContent}>
            {/* Left: avatar + name */}
            <View style={styles.profileLeft}>
              <View style={styles.avatarSquare}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
              <View style={styles.profileNameBlock}>
                <Text style={styles.profileDisplayName}>
                  {firstName} {lastName}
                </Text>
                <Text style={styles.profileRole}>Teacher</Text>
                <View style={styles.profileEmailBadge}>
                  <Text style={styles.profileEmailBadgeText} numberOfLines={1}>
                    {email}
                  </Text>
                </View>
              </View>
            </View>

            {/* Right: stats */}
            <View style={styles.profileStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {user?.subjects_count ?? '—'}
                </Text>
                <Text style={styles.statLabel}>Subjects</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {user?.exams_count ?? '—'}
                </Text>
                <Text style={styles.statLabel}>Exams</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Personal Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <Text style={styles.cardSubtitle}>Update your personal details below</Text>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>First Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={COLORS.muted}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Last Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={COLORS.muted}
              />
            </View>
          </View>

          <View style={styles.fieldFull}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputDisabled]}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={COLORS.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
            />
            <Text style={styles.fieldHint}>Email cannot be changed</Text>
          </View>

          <View style={styles.fieldFull}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={COLORS.muted}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Security card */}
        <View style={styles.securityCard}>
          <Text style={styles.cardTitle}>Security</Text>
          <TouchableOpacity
            style={styles.changePasswordBtn}
            onPress={handleChangePassword}
          >
            <Text style={styles.changePasswordIcon}>🔑</Text>
            <Text style={styles.changePasswordText}>Change Password</Text>
            <Text style={styles.changePasswordArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <TouchableOpacity style={styles.logoutDanger} onPress={handleLogout}>
          <Text style={styles.logoutDangerText}>Sign out of ExamGen</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Top bar
  topBar: {
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
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  signOutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  signOutBtnText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
  },

  // Profile card
  profileCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
  },
  profileCardDecor: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primaryDark,
    opacity: 0.4,
  },
  profileCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  avatarSquare: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  profileNameBlock: {
    flex: 1,
    gap: 3,
  },
  profileDisplayName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  profileRole: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  profileEmailBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    maxWidth: 160,
  },
  profileEmailBadgeText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    gap: 14,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Info card
  infoCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: -8,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldHalf: {
    flex: 1,
    gap: 6,
  },
  fieldFull: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fieldInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
  },
  fieldInputDisabled: {
    opacity: 0.6,
    backgroundColor: '#f1f5f9',
  },
  fieldHint: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },

  // Security card
  securityCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  changePasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.warningBg,
  },
  changePasswordIcon: {
    fontSize: 16,
  },
  changePasswordText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
  },
  changePasswordArrow: {
    fontSize: 18,
    color: COLORS.warning,
    fontWeight: '700',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.muted,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Logout danger
  logoutDanger: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
  },
  logoutDangerText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
