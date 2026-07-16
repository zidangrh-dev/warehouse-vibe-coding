import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { login } from './api';
import { colors } from './theme';

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
    <View style={s.wrap}>
      <View style={s.box}>
        <Text style={s.logo}>📦</Text>
        <Text style={s.title}>Gudang Board</Text>
        <Text style={s.subtitle}>Manajemen Paket Retail Pickup</Text>
        <TextInput
          style={s.input}
          placeholder="Username"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />
        {error && <Text style={s.error}>{error}</Text>}
        <TouchableOpacity style={s.btn} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Masuk</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.header, justifyContent: 'center', alignItems: 'center', padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380 },
  logo: { fontSize: 44, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: colors.text },
  subtitle: { textAlign: 'center', color: colors.subtle, marginBottom: 20 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 12, color: colors.text,
  },
  error: { color: colors.danger, marginBottom: 10, textAlign: 'center' },
  btn: { backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
