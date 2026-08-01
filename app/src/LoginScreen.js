import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from './Icon';
import { login } from './api';
import { colors, radius, shadow, spacing } from './theme';
import { useBreakpoint } from './responsive';

export default function LoginScreen({ onLogin }) {
  const { isDesktop } = useBreakpoint();
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

  const form = (
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
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Masuk</Text>}
      </TouchableOpacity>
      <Text style={s.footer}>Warehouse · Admin Kios · Sales</Text>
    </View>
  );

  if (isDesktop) {
    return (
      <View style={s.wrapDesktop}>
        <View style={s.brandPanel}>
          <View style={s.logoBox}><Icon name="box" size={30} color="#fff" /></View>
          <Text style={s.titleDark}>PickHub</Text>
          <Text style={s.subtitleDark}>Kelola paket retail pickup — cepat, rapi, realtime.</Text>
        </View>
        <View style={s.formPanel}>{form}</View>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.brand}>
        <View style={[s.logoBox, { backgroundColor: colors.primary }]}><Icon name="box" size={28} color="#fff" /></View>
        <Text style={s.title}>PickHub</Text>
        <Text style={s.subtitle}>Kelola paket retail pickup — cepat, rapi, realtime</Text>
      </View>
      {form}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.bg },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 64, height: 64, borderRadius: radius.card, marginBottom: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: 0.2 },
  subtitle: { color: colors.sub, marginTop: 6, textAlign: 'center' },

  wrapDesktop: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  brandPanel: {
    flex: 1, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xxl,
  },
  titleDark: { fontSize: 28, fontWeight: '800', color: '#fff' },
  subtitleDark: { color: 'rgba(255,255,255,0.75)', marginTop: 8, textAlign: 'center', maxWidth: 320 },
  formPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },

  box: {
    backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 24,
    borderWidth: 1, borderColor: colors.border,
    width: '100%', maxWidth: 380, ...shadow.card,
  },
  label: { fontWeight: '700', color: colors.sub, fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    padding: 13, fontSize: 15, marginBottom: 16, color: colors.ink,
    backgroundColor: colors.bg,
  },
  error: { color: colors.danger, marginBottom: 12, textAlign: 'center', fontWeight: '600' },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.pill, padding: 14,
    alignItems: 'center', marginTop: 2,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footer: { color: colors.faint, marginTop: 18, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
