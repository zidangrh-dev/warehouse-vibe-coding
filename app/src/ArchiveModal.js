import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from './api';
import { colors, radius, shadow, notice, confirmAsync } from './theme';
import Icon from './Icon';

export function ArchiveModal({ visible, onClose, onArchived }) {
  const [beforeDate, setBeforeDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const setPreset = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setBeforeDate(d.toISOString().split('T')[0]);
  };

  const handleArchive = async () => {
    if (!beforeDate || !beforeDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return notice('Format tanggal tidak valid. Gunakan format YYYY-MM-DD (contoh: 2026-07-01)');
    }

    const ok = await confirmAsync(
      'Konfirmasi Pengarsipan Data',
      `Apakah Anda yakin ingin mengarsip semua paket selesai/selesai pickup yang dibuat SEBELUM ${beforeDate}?\n\n🔒 CATATAN: Data yang sudah diarsip akan TERKUNCI PERMANEN dan tidak dapat diubah oleh siapapun.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await api.archivePackages(beforeDate);
      notice(`✅ Berhasil mengarsip ${res.count} paket!`);
      if (onArchived) onArchived();
      onClose();
    } catch (e) {
      notice(`Gagal pengarsipan: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.head}>
            <View style={s.iconBadge}>
              <Icon name="box" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>📦 Arsip Data Paket</Text>
              <Text style={s.sub}>Pengaturan Arsip Otomatis (Super Admin)</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={{ fontSize: 18, color: colors.sub }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.alertBox}>
            <Text style={s.alertTitle}>🔒 Proteksi Kunci Permanen</Text>
            <Text style={s.alertText}>
              Paket yang diarsip tidak akan lagi dapat diubah statusnya, ditambah/dihapus fotonya oleh siapapun.
            </Text>
          </View>

          <Text style={s.label}>Pilih Batas Waktu Tanggal (Cutoff Date):</Text>
          <View style={s.presetRow}>
            {[
              [30, '30 Hari Lalu'],
              [60, '60 Hari Lalu'],
              [90, '90 Hari Lalu'],
            ].map(([days, label]) => (
              <TouchableOpacity
                key={days}
                style={s.presetChip}
                onPress={() => setPreset(days)}
              >
                <Text style={s.presetText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Atau Masukkan Tanggal Manual (YYYY-MM-DD):</Text>
          <TextInput
            style={s.input}
            value={beforeDate}
            onChangeText={setBeforeDate}
            placeholder="YYYY-MM-DD (Contoh: 2026-07-01)"
            maxLength={10}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity
              style={[s.btn, { flex: 1, backgroundColor: colors.danger }]}
              onPress={handleArchive}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>📦 Eksekusi Pengarsipan</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnGhost]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={[s.btnText, { color: colors.ink }]}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 500,
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
    marginBottom: 14,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
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
  alertBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.card,
    padding: 12,
    marginBottom: 14,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger,
    marginBottom: 4,
  },
  alertText: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 10,
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  presetChip: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFF',
  },
});
