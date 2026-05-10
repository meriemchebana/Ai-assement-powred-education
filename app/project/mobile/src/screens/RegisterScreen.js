import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, ScrollView
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();

  const handleRegister = async () => {
    const { first_name, last_name, email, password } = formData;
    if (!first_name || !last_name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(formData);
      navigation.navigate('Login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => setFormData({ ...formData, [field]: value });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>B</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start building your school content</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>FIRST NAME</Text>
                <TextInput style={styles.input} value={formData.first_name} onChangeText={(v) => updateField('first_name', v)} placeholder="John" placeholderTextColor="#AEAEB2" />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>LAST NAME</Text>
                <TextInput style={styles.input} value={formData.last_name} onChangeText={(v) => updateField('last_name', v)} placeholder="Doe" placeholderTextColor="#AEAEB2" />
              </View>
            </View>

            <Text style={styles.label}>EMAIL</Text>
            <TextInput style={styles.input} value={formData.email} onChangeText={(v) => updateField('email', v)} placeholder="teacher@school.com" placeholderTextColor="#AEAEB2" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>PASSWORD</Text>
            <TextInput style={styles.input} value={formData.password} onChangeText={(v) => updateField('password', v)} placeholder="At least 6 characters" placeholderTextColor="#AEAEB2" secureTextEntry />

            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Create Account</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkBtn}>
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  header: { alignItems: 'center', marginBottom: 32, marginTop: 40 },
  iconCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0F0F5', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  iconText: { fontSize: 18, fontWeight: '700', color: '#5E5CE6' },
  title: { fontSize: 24, fontWeight: '700', color: '#1D1D1F', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#86868B', marginTop: 4 },
  errorBox: { backgroundColor: '#FFF0F0', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FFD1D1' },
  errorText: { color: '#FF3B30', fontSize: 14, textAlign: 'center' },
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#86868B', letterSpacing: 0.5, marginBottom: -6 },
  input: { backgroundColor: '#F9F9FB', borderWidth: 1.5, borderColor: '#E5E5EA', borderRadius: 10, padding: 13, fontSize: 16, color: '#1D1D1F' },
  button: { backgroundColor: '#5E5CE6', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  linkText: { color: '#5E5CE6', fontSize: 15, fontWeight: '500' },
});


