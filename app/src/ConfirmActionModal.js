import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable,
} from 'react-native';
import { colors, radius, shadow } from './theme';
import Icon from './Icon';

export function ConfirmActionModal({ visible, targetStatus, pkg, onConfirm, onClose, busy }) {
  if (!visible || !targetStatus || !pkg) return null;

  const isRetur = targetStatus === 'retur';
  const isCancel = targetStatus === 'cancel';

  const badgeBg = isRetur ? '#FEF2F2' : '#F1F5F9';
  const badgeBorder = isRetur ? '#FCA5A5' : '#CBD5E1';
  const actionColor = isRetur ? colors.danger : '#475569';
  const iconEmoji = isRetur ? 'rotate' : 'x_circle';

  const title = isRetur ? 'Konfirmasi Retur Paket' : 'Konfirmasi Batalkan Paket';
  const description = isRetur
    ? 'Apakah Anda yakin ingin memproses RETUR untuk paket ini? Status paket akan diperbarui menjadi Retur dan tercatat di riwayat audit.'
    : 'Apakah Anda yakin ingin MEMBATALKAN (Cancel) paket ini? Tindakan ini akan membatalkan alur pengiriman paket ini.';

  const confirmText = isRetur ? 'Ya, Proses Retur' : 'Ya, Batalkan Paket';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={(e) => e?.stopPropagation?.()}>
          {/* Header Badge & Title */}
          <View style={s.head}>
            <View style={[s.badgeIcon, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Icon name={iconEmoji} size={24} color={actionColor} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.subTitle}>Tindakan ini memerlukan konfirmasi</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={s.desc}>{description}</Text>

          {/* Package Info Card */}
          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>No Invoice:</Text>
              <Text style={s.infoValue}>{pkg.invoice_no}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Customer:</Text>
              <Text style={s.infoSub}>{pkg.customer_name || '—'} {pkg.customer_phone ? `(${pkg.customer_phone})` : ''}</Text>
            </View>
            {pkg.item_desc ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Barang:</Text>
                <Text style={s.infoSub}>{pkg.item_desc}</Text>
              </View>
            ) : null}
          </View>

          {/* Action Buttons */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.btn, s.btnCancel]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={s.btnCancelText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btn, { backgroundColor: actionColor }]}
              onPress={onConfirm}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnConfirmText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    padding: 20,
    ...shadow.float,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  subTitle: {
    fontSize: 12,
    color: colors.sub,
    fontWeight: '600',
    marginTop: 2,
  },
  desc: {
    fontSize: 13.5,
    color: colors.sub,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.card,
    padding: 12,
    gap: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12.5,
    color: colors.sub,
    fontWeight: '600',
    width: 75,
  },
  infoValue: {
    fontSize: 13.5,
    color: colors.ink,
    fontWeight: '800',
    flex: 1,
  },
  infoSub: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnCancelText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 13.5,
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
  },
});
