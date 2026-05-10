import { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import SubjectsScreen from '../screens/SubjectsScreen';
import SubjectDetailScreen from '../screens/SubjectDetailScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

const COLORS = {
  primary: '#3b82f6',
  bg: '#f8fafc',
  text: '#0f172a',
  muted: '#94a3b8',
  border: '#e2e8f0',
  surface: '#ffffff',
};

const TABS = [
  { key: 'Subjects', label: 'Subjects', icon: '📚' },
  { key: 'Archive', label: 'Archive', icon: '🗂️' },
  { key: 'Profile', label: 'Profile', icon: '👤' },
];

function BottomNav({ activeTab, onTabPress }) {
  return (
    <View style={navStyles.bar}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={navStyles.tabItem}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[navStyles.tabIcon, isActive && navStyles.tabIconActive]}>
              {tab.icon}
            </Text>
            <Text style={[navStyles.tabLabel, isActive && navStyles.tabLabelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={navStyles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs({ navigation }) {
  const [activeTab, setActiveTab] = useState('Subjects');

  const handleTabPress = (tab) => {
    setActiveTab(tab);
  };

  const renderScreen = () => {
    switch (activeTab) {
      case 'Subjects':
        return <SubjectsScreen navigation={navigation} onNavigateToDetail={(subjectId, subjectName) => {
          navigation.navigate('SubjectDetail', { subjectId, subjectName });
        }} />;
      case 'Archive':
        return <ArchiveScreen />;
      case 'Profile':
        return <ProfileScreen />;
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>
      <BottomNav activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="SubjectDetail" component={SubjectDetailScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingLogo}>
          <Text style={styles.loadingLogoText}>E</Text>
        </View>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainStack} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  loadingLogo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogoText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
  },
});

const navStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 8,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.muted,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
});
