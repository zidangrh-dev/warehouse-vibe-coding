import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from './api';
import { colors, radius, shadow, notice } from './theme';
import Icon from './Icon';
import { CalendarInput } from './CalendarInput';

export function ArchiveModal({ visible, onClose, onArchived }) {
  const [beforeDate, setBeforeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState('before'); // 'before' (sebelum), 'exact' (tepat), 'on_or_before' (sampai)
  const [onlyCompleted, setOnlyCompleted] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const setPreset = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setBeforeDate(d.toISOString().split('T')[0]);
  };

  const handleStartArchive = () => {
    if (!beforeDate || !beforeDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return notice('Format tanggal tidak valid. Gunakan format YYYY-MM-DD');
    }
    setConfirming(true);
  };

  const handleExecuteArchive = async () => {
    setBusy(true);
    try {
      const res = await api.archivePackages(beforeDate, mode, onlyCompleted);
      notice(`Berhasil mengarsip ${res.count} paket!`);
      if (onArchived) onArchived();
      setConfirming(false);
      onClose();
    } catch (e) {
      notice(`Gagal pengarsipan: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setConfirming(false);
    onClose();
  };

  const modeLabels = {
    before: 'Sebelum Tanggal (Strictly Before)',
    exact: 'Tepat Pada Tanggal (Single Date)',
    on_or_before: 'Sampai Dengan Tanggal (Up to Date)',
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          {/* Header */}
          <View style={s.head}>
            <View style={[s.iconBadge, confirming && { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
              <Icon name="box" size={20} color={confirming ? colors.danger : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>
                {confirming ? 'Konfirmasi Pengarsipan Paket' : 'Arsip Data Paket'}
              </Text>
              <Text style={s.sub}>
                {confirming ? 'Paket dipindah dari kanban; masih bisa dipulihkan kapan saja' : 'Pengaturan Arsip Otomatis (Super Admin)'}
              </Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose} disabled={busy}>
              <Icon name="x" size={18} color={colors.sub} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {confirming ? (
            /* Step 2: Custom Professional Confirmation Card */
            <View style={{ marginTop: 14 }}>
              <View style={s.confirmWarningBox}>
                <Text style={s.confirmWarningTitle}>KONFIRMASI PENGARSIPAN</Text>
                <Text style={s.confirmWarningText}>
                  Apakah Anda yakin ingin mengarsip paket sesuai kriteria di bawah ini?
                  Paket akan hilang dari kanban (tetap ada di tab Semua) dan dapat dipulihkan lagi.
                </Text>
              </View>

              <View style={s.summaryCard}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Mode Pengarsipan:</Text>
                  <Text style={s.summaryValHighlight}>{modeLabels[mode]}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Tanggal Patokan:</Text>
                  <Text style={s.summaryValHighlight}>{beforeDate}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Filter Status:</Text>
                  <Text style={s.summaryVal}>
                    {onlyCompleted ? 'Hanya Selesai / Retur / Cancel' : 'Semua Status Paket'}
                  </Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Efek:</Text>
                  <Text style={s.summaryVal}>
                    Hilang dari kanban · tetap di Semua · bisa dipulihkan
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={[s.btn, { flex: 1, backgroundColor: colors.danger }]}
                  onPress={handleExecuteArchive}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.btnText}>Ya, Eksekusi Pengarsipan</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.btnGhost]}
                  onPress={() => setConfirming(false)}
                  disabled={busy}
                >
                  <Text style={[s.btnText, { color: colors.ink }]}>Kembali</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Step 1: Date & Mode Selection Form */
            <View style={{ marginTop: 14 }}>
              <View style={s.alertBox}>
                <Text style={s.alertTitle}>Arsip = Keluar dari Kanban</Text>
                <Text style={s.alertText}>
                  Paket diarsip tidak tampil di kanban, tapi tetap ada di tab Semua dan bisa dipulihkan lagi dari tab Arsip kapan saja.
                </Text>
              </View>

              <Text style={s.label}>Pilih Target Kriteria Tanggal:</Text>
              <View style={s.modeRow}>
                {[
                  ['before', 'Sebelum Tanggal'],
                  ['exact', 'Tepat Tanggal Ini'],
                  ['on_or_before', 'Sampai Tanggal Ini'],
                ].map(([mKey, mLabel]) => (
                  <TouchableOpacity
                    key={mKey}
                    style={[s.modeBtn, mode === mKey && s.modeBtnActive]}
                    onPress={() => setMode(mKey)}
                  >
                    <Text style={[s.modeText, mode === mKey && s.modeTextActive]}>{mLabel}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Pilih Tanggal Patokan:</Text>
              <View style={{ marginTop: 4 }}>
                <CalendarInput value={beforeDate} onChange={setBeforeDate} />
              </View>

              <Text style={s.label}>Pilihan Cepat Tanggal:</Text>
              <View style={s.presetRow}>
                {[
                  [0, 'Hari Ini'],
                  [7, '7 Hari Lalu'],
                  [30, '30 Hari Lalu'],
                  [60, '60 Hari Lalu'],
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

              <TouchableOpacity
                style={s.toggleRow}
                onPress={() => setOnlyCompleted(!onlyCompleted)}
              >
                <View style={[s.checkbox, onlyCompleted && s.checkboxActive]}>
                  {onlyCompleted && <Icon name="check" size={10} color="#fff" strokeWidth={3} />}
                </View>
                <Text style={s.toggleText}>Hanya arsip paket yang sudah Selesai / Retur / Cancel</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={[s.btn, { flex: 1, backgroundColor: colors.danger }]}
                  onPress={handleStartArchive}
                >
                  <Text style={s.btnText}>Eksekusi Pengarsipan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.btnGhost]}
                  onPress={handleClose}
                >
                  <Text style={[s.btnText, { color: colors.ink }]}>Batal</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
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
  alertBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.card,
    padding: 12,
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.danger,
    marginBottom: 3,
  },
  alertText: {
    fontSize: 11.5,
    color: '#991B1B',
    lineHeight: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 10,
    marginBottom: 6,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.sub,
    textAlign: 'center',
  },
  modeTextActive: {
    color: '#fff',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  presetChip: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: 11.5,
    color: colors.ink,
    fontWeight: '600',
  },
  btn: {
    height: 42,
    borderRadius: radius.input,
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
  confirmWarningBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 12,
  },
  confirmWarningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger,
    marginBottom: 4,
  },
  confirmWarningText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 17,
  },
  summaryCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 14,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.sub,
    fontWeight: '600',
  },
  summaryVal: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '600',
  },
  summaryValHighlight: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '800',
  },
});
