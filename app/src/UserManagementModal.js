import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { api } from './api';
import { colors, radius, shadow, notice, confirmAsync } from './theme';
import Icon from './Icon';

const ROLE_OPTIONS = [
  { val: 'admin', label: 'Admin Kios' },
  { val: 'sales', label: 'Sales' },
  { val: 'warehouse', label: 'Warehouse' },
  { val: 'superadmin', label: 'Super Admin' },
];

const ROLE_BADGE = {
  superadmin: { bg: '#FEF2F2', color: '#991B1B', label: 'Super Admin' },
  admin: { bg: colors.primarySoft, color: colors.primary, label: 'Admin Kios' },
  sales: { bg: '#F3E8FF', color: '#7C3AED', label: 'Sales' },
  warehouse: { bg: '#E0F2FE', color: '#0369A1', label: 'Warehouse' },
};

export default function UserManagementModal({ visible, user, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const [form, setForm] = useState({
    username: '', display_name: '', password: '', role: 'admin',
  });

  const loadUsers = async () => {
    if (!visible) return;
    setLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (e) {
      notice(`Gagal memuat user: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [visible]);

  if (!visible) return null;

  const isSuperAdmin = user?.role === 'superadmin';

  const resetForm = () => {
    setForm({ username: '', display_name: '', password: '', role: 'admin' });
    setShowAdd(false);
    setEditUser(null);
  };

  const handleCreate = async () => {
    if (!form.username.trim() || !form.display_name.trim() || !form.password.trim()) {
      return notice('Semua field wajib diisi');
    }
    if (form.password.trim().length < 6) {
      return notice('Password minimal 6 karakter');
    }
    setBusy(true);
    try {
      await api.createUser(form);
      notice('User baru berhasil ditambahkan');
      resetForm();
      await loadUsers();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    if (form.password && form.password.trim().length < 6) {
      return notice('Password minimal 6 karakter');
    }
    setBusy(true);
    try {
      await api.updateUser(editUser.id, {
        display_name: form.display_name,
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      });
      notice('User berhasil diperbarui');
      resetForm();
      await loadUsers();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (u) => {
    if (u.id === user.id) return notice('Tidak dapat menghapus akun Anda sendiri');
    if (!(await confirmAsync('Hapus User?', `Yakin ingin menghapus ${u.display_name} (${u.username})?`))) return;
    setBusy(true);
    try {
      await api.deleteUser(u.id);
      notice('User berhasil dihapus');
      await loadUsers();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (u) => {
    setEditUser(u);
    setForm({
      username: u.username,
      display_name: u.display_name,
      password: '',
      role: u.role,
    });
    setShowAdd(true);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Kelola Karyawan / User</Text>
              <Text style={s.subTitle}>Daftar pengguna sistem & peranan hak akses</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Icon name="x" size={18} color={colors.sub} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {showAdd ? (
            <ScrollView style={{ padding: 16 }}>
              <Text style={s.formTitle}>{editUser ? `Edit User: ${editUser.username}` : 'Tambah Karyawan Baru'}</Text>

              {!editUser && (
                <>
                  <Text style={s.label}>Username *</Text>
                  <TextInput
                    style={s.input}
                    placeholder="mis. admin_kios1"
                    value={form.username}
                    onChangeText={(v) => setForm((old) => ({ ...old, username: v }))}
                    autoCapitalize="none"
                  />
                </>
              )}

              <Text style={s.label}>Nama Lengkap *</Text>
              <TextInput
                style={s.input}
                placeholder="mis. Budi Santoso"
                value={form.display_name}
                onChangeText={(v) => setForm((old) => ({ ...old, display_name: v }))}
              />

              <Text style={s.label}>{editUser ? 'Password Baru (Opsional, min 6 char)' : 'Password (min 6 char) *'}</Text>
              <TextInput
                style={s.input}
                placeholder={editUser ? 'Kosongkan jika tidak diganti' : '••••••••'}
                secureTextEntry
                value={form.password}
                onChangeText={(v) => setForm((old) => ({ ...old, password: v }))}
              />

              <Text style={s.label}>Role / Peranan *</Text>
              <View style={s.roleGrid}>
                {ROLE_OPTIONS.filter((r) => r.val !== 'superadmin' || isSuperAdmin).map((r) => (
                  <TouchableOpacity
                    key={r.val}
                    style={[s.roleChip, form.role === r.val && s.roleChipActive]}
                    onPress={() => setForm((old) => ({ ...old, role: r.val }))}
                  >
                    <Text style={form.role === r.val ? s.roleTextActive : s.roleText}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={[s.btn, { flex: 1, backgroundColor: colors.primary }]}
                  onPress={editUser ? handleUpdate : handleCreate}
                  disabled={busy}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{editUser ? 'Simpan Perubahan' : 'Tambah User'}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={resetForm}>
                  <Text style={[s.btnText, { color: colors.ink }]}>Batal</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, color: colors.sub, fontWeight: '700' }}>Total User ({users.length})</Text>
                <TouchableOpacity
                  style={[s.btn, { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.primary }]}
                  onPress={() => { resetForm(); setShowAdd(true); }}
                >
                  <Text style={s.btnText}>Tambah User</Text>
                </TouchableOpacity>
              </View>

              {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
              ) : (
                <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
                  {users.map((u) => {
                    const badge = ROLE_BADGE[u.role] || { bg: colors.surfaceAlt, color: colors.sub, label: u.role };
                    const isSelf = u.id === user?.id;
                    const cannotEdit = u.role === 'superadmin' && !isSuperAdmin;

                    return (
                      <View key={u.id} style={s.userCard}>
                        <View style={s.userAvatar}>
                          <Text style={s.userAvatarText}>{u.display_name[0]?.toUpperCase() || 'U'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.userName}>{u.display_name}</Text>
                            {isSelf && <Text style={s.selfBadge}>Anda</Text>}
                          </View>
                          <Text style={s.userHandle}>@{u.username}</Text>
                        </View>
                        <View style={[s.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                        {!cannotEdit && (
                          <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
                            <TouchableOpacity style={s.iconBtn} onPress={() => startEdit(u)}>
                              <Icon name="edit" size={15} color={colors.sub} />
                            </TouchableOpacity>
                            {!isSelf && (
                              <TouchableOpacity style={[s.iconBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => handleDelete(u)}>
                                <Icon name="x" size={13} color={colors.danger} strokeWidth={2.5} />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  sheet: {
    backgroundColor: colors.surface, borderRadius: radius.sheet,
    borderWidth: 1, borderColor: colors.border, ...shadow.float,
    width: '100%', maxWidth: 540, height: 580, overflow: 'hidden',
  },
  head: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  subTitle: { fontSize: 12, color: colors.sub, marginTop: 2 },
  closeBtn: { padding: 8 },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: colors.sub, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    padding: 11, fontSize: 14, color: colors.ink, backgroundColor: colors.bg,
  },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  roleChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.bg,
  },
  roleChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  roleText: { color: colors.sub, fontWeight: '600', fontSize: 13 },
  roleTextActive: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8, backgroundColor: colors.surface,
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  userAvatarText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  userName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  userHandle: { fontSize: 12, color: colors.sub, marginTop: 1 },
  selfBadge: { fontSize: 10, color: colors.ok, fontWeight: '700', backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  iconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: radius.pill, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
