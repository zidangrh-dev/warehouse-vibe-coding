import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { login } from './api';
import { colors, radius, shadow } from './theme';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await login(username.trim(), password);
      onLogin(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={['#4F46E5', '#7C3AED', '#2E1065']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1.2 }}
      style={s.wrap}
    >
      <View style={s.brand}>
        <View style={s.logoBox}><Text style={{ fontSize: 34 }}>📦</Text></View>
        <Text style={s.title}>Gudang Board</Text>
        <Text style={s.subtitle}>Kelola paket retail pickup — cepat, rapi, realtime</Text>
      </View>
      <View style={s.box}>
        <Text style={s.label}>Username</Text>
        <TextInput
          style={s.input}
          placeholder="mis. admin"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <Text style={s.label}>Password</Text>
        <TextInput
          style={s.input}
          placeholder="••••••••"
          placeholderTextColor={colors.faint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />
        {error && <Text style={s.error}>{error}</Text>}
        <TouchableOpacity style={s.btn} onPress={submit} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Masuk →</Text>}
        </TouchableOpacity>
      </View>
      <Text style={s.footer}>Warehouse · Admin Kios · Sales</Text>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 72, height: 72, borderRadius: 24, marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  subtitle: { color: '#C7D2FE', marginTop: 6, textAlign: 'center' },
  box: {
    backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 24,
    width: '100%', maxWidth: 380, ...shadow.float,
  },
  label: { fontWeight: '700', color: colors.sub, fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    padding: 13, fontSize: 16, marginBottom: 16, color: colors.ink,
    backgroundColor: colors.bg,
  },
  error: { color: colors.danger, marginBottom: 12, textAlign: 'center', fontWeight: '600' },
  btn: {
    backgroundColor: colors.primary, borderRadius: 999, padding: 15,
    alignItems: 'center', marginTop: 2,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  footer: { color: 'rgba(255,255,255,0.55)', marginTop: 22, fontSize: 12, fontWeight: '600' },
});
