import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from './api';
import { colors, radius, shadow, notice } from './theme';
import Icon from './Icon';

export function ChangePasswordModal({ visible, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    if (busy) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!currentPassword.trim()) {
      return notice('Masukkan password saat ini');
    }
    if (!newPassword.trim()) {
      return notice('Masukkan password baru');
    }
    if (newPassword.length < 6) {
      return notice('Password baru minimal 6 karakter');
    }
    if (newPassword !== confirmPassword) {
      return notice('Konfirmasi password tidak cocok dengan password baru');
    }

    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      notice('Password berhasil diubah!', 'success');
      resetForm();
      onClose();
    } catch (e) {
      notice(e.message || 'Gagal mengubah password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.head}>
            <View style={s.iconBadge}>
              <Icon name="user" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Ganti Password</Text>
              <Text style={s.sub}>Perbarui password akun Anda secara mandiri</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose} disabled={busy}>
              <Icon name="x" size={18} color={colors.sub} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 14, gap: 10 }}>
            <View>
              <Text style={s.label}>Password Saat Ini</Text>
              <TextInput
                style={s.input}
                placeholder="Masukkan password saat ini"
                placeholderTextColor={colors.faint}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
            </View>

            <View>
              <Text style={s.label}>Password Baru</Text>
              <TextInput
                style={s.input}
                placeholder="Minimal 6 karakter"
                placeholderTextColor={colors.faint}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>

            <View>
              <Text style={s.label}>Konfirmasi Password Baru</Text>
              <TextInput
                style={s.input}
                placeholder="Ulangi password baru"
                placeholderTextColor={colors.faint}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[s.btn, { flex: 1, backgroundColor: colors.primary }]}
                onPress={handleSubmit}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.btnText}>Simpan Password Baru</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.btnGhost]}
                onPress={handleClose}
                disabled={busy}
              >
                <Text style={[s.btnText, { color: colors.ink }]}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  sub: {
    fontSize: 12,
    color: colors.sub,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.sub,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  btn: {
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnGhost: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});