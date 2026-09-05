import { useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Pressable } from 'react-native';
import { colors, radius, font } from './theme';

export default function ImportProgressModal({ visible, progress, error, onClose }) {
  const barWidth = useRef(new Animated.Value(0)).current;

  const {
    processed = 0,
    total = 0,
    percent = 0,
    inserted = 0,
    updated = 0,
    skipped = 0,
    done = false,
  } = progress || {};

  useEffect(() => {
    Animated.timing(barWidth, { toValue: percent, duration: 400, useNativeDriver: false }).start();
  }, [percent]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={done ? onClose : undefined}>
      <Pressable style={s.backdrop} onPress={done ? onClose : undefined}>
        <Pressable style={s.card} onPress={(e) => e?.stopPropagation?.()}>
          <View style={s.header}>
            <Text style={s.title}>Import Data CSV</Text>
            <Text style={s.subtitle}>
              {done
                ? 'Proses import selesai sepenuhnya!'
                : error
                ? 'Terjadi kesalahan saat import'
                : 'Sedang memproses data dari file CSV ke database...'}
            </Text>
          </View>

          {/* Progress Bar & Status Counter */}
          <View style={s.progressSection}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressText}>
                {done
                  ? 'Total Selesai'
                  : `Memproses ${processed} / ${total} data`}
              </Text>
              <Text style={s.percentText}>{percent}%</Text>
            </View>

            <View style={s.track}>
              <Animated.View style={[s.bar, { width: barWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
            </View>
          </View>

          {/* Realtime Stats Counter Grid */}
          <View style={s.statsGrid}>
            <View style={[s.statBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={[s.statVal, { color: '#15803D' }]}>{inserted}</Text>
              <Text style={[s.statLabel, { color: '#166534' }]}>Baru</Text>
            </View>

            <View style={[s.statBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <Text style={[s.statVal, { color: '#1D4ED8' }]}>{updated}</Text>
              <Text style={[s.statLabel, { color: '#1E40AF' }]}>Diperbarui</Text>
            </View>

            <View style={[s.statBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
              <Text style={[s.statVal, { color: '#64748B' }]}>{skipped}</Text>
              <Text style={[s.statLabel, { color: '#475569' }]}>Dilewati</Text>
            </View>
          </View>

          {/* Error Message display */}
          {!!error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Action / Footer Button */}
          <View style={s.footer}>
            {!done && !error ? (
              <View style={s.loadingRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={s.loadingText}>Menyimpan ke database...</Text>
              </View>
            ) : (
              <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={s.closeBtnText}>Tutup & Lihat Data Paket</Text>
              </TouchableOpacity>
            )}
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
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  percentText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    fontFamily: font.mono,
  },
  track: {
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.sub,
  },
  closeBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
