// src/navigation/RootNavigator.js
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen'; // or redirect
import SubjectsScreen from '../screens/SubjectsScreen';
import SubjectDetailScreen from '../screens/SubjectDetailScreen';
import GenerateScreen from '../screens/GenerateScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import ExamBuilderScreen from '../screens/ExamBuilderScreen';
import ProfileScreen from '../screens/ProfileScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, booting } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020840' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Subjects" component={SubjectsScreen} />
          <Stack.Screen name="SubjectDetail" component={SubjectDetailScreen} />
          <Stack.Screen name="Generate" component={GenerateScreen} />
          <Stack.Screen name="Archive" component={ArchiveScreen} />
          <Stack.Screen name="ExamBuilder" component={ExamBuilderScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

