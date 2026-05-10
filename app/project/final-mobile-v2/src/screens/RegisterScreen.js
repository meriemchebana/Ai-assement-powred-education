// src/screens/RegisterScreen.js
import { useEffect } from 'react';
import { View } from 'react-native';

export default function RegisterScreen({ navigation }) {
  useEffect(() => {
    // Navigate to login and pass params to switch to register mode
    navigation.replace('Login', { mode: 'register' });
  }, [navigation]);

  return <View />; // Empty view while redirecting
}