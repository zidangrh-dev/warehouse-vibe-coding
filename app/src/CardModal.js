import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Platform, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, uploadPhoto, photoUrl } from './api';
import { colors, PRIORITIES, confirmAsync } from './theme';
import ScannerModal from './ScannerModal';

export default function CardModal({ card, onClose, onChanged }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [barcode, setBarcode] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
      setPriority(card.priority || 'normal');
      setBarcode(card.barcode || '');
      setDueDate(card.due_date ? String(card.due_date).slice(0, 10) : '');
    }
  }, [card]);

  if (!card) return null;

  const save = async () => {
    setBusy(true);
    try {
      await api.updateCard(card.id, {
        title: title.trim() || card.title,
        description,
        priority,
        barcode: barcode.trim() || null,
        due_date: dueDate.trim() || null,
      });
      onChanged();
      onClose();
    } catch (e) {
      alert(`Gagal menyimpan: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAsync('Hapus kartu?', `"${card.title}" akan dihapus permanen.`))) return;
    await api.deleteCard(card.id);
    onChanged();
    onClose();
  };

  const addPhoto = async (fromCamera) => {
    const opts = { quality: 0.7 };
    const result = fromCamera
      ? await (async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return { canceled: true };
          return ImagePicker.launchCameraAsync(opts);
        })()
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets?.length) return;
    setBusy(true);
    try {
      await uploadPhoto(card.id, result.assets[0]);
      onChanged();
    } catch (e) {
      alert(`Upload gagal: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (photo) => {
    if (!(await confirmAsync('Hapus foto?'))) return;
    await api.deletePhoto(photo.id);
    onChanged();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView>
            <Text style={s.label}>Judul</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} />

            <Text style={s.label}>Deskripsi</Text>
            <TextInput
              style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Catatan, lokasi rak, jumlah, dsb."
            />

            <Text style={s.label}>Prioritas</Text>
            <View style={s.row}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    s.chip,
                    { borderColor: p.color },
                    priority === p.key && { backgroundColor: p.color },
                  ]}
                  onPress={() => setPriority(p.key)}
                >
                  <Text style={[s.chipText, priority === p.key ? { color: '#fff' } : { color: p.color }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Barcode</Text>
            <View style={s.row}>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Belum ada barcode"
              />
              <TouchableOpacity style={s.scanBtn} onPress={() => setScanOpen(true)}>
                <Text style={s.btnText}>📷 Scan</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Tenggat (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="2026-07-20"
            />

            <Text style={s.label}>Foto ({card.photos?.length || 0})</Text>
            <ScrollView horizontal style={{ marginBottom: 8 }}>
              {(card.photos || []).map((p) => (
                <TouchableOpacity key={p.id} onLongPress={() => removePhoto(p)}>
                  <Image source={{ uri: photoUrl(p) }} style={s.photo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.row}>
              <TouchableOpacity style={s.smallBtn} onPress={() => addPhoto(false)}>
                <Text style={s.btnText}>🖼 Galeri</Text>
              </TouchableOpacity>
              {Platform.OS !== 'web' && (
                <TouchableOpacity style={s.smallBtn} onPress={() => addPhoto(true)}>
                  <Text style={s.btnText}>📸 Kamera</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={s.hint}>Tekan lama sebuah foto untuk menghapusnya.</Text>

            {busy && <ActivityIndicator style={{ marginVertical: 8 }} />}

            <View style={[s.row, { marginTop: 16 }]}>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.ok }]} onPress={save} disabled={busy}>
                <Text style={s.btnText}>Simpan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.subtle }]} onPress={onClose}>
                <Text style={s.btnText}>Tutup</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.danger }]} onPress={remove}>
                <Text style={s.btnText}>Hapus</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
      <ScannerModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={(code) => setBarcode(code)}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  sheet: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    width: '100%', maxWidth: 520, maxHeight: '90%',
  },
  label: { fontWeight: '700', color: colors.text, marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#dfe1e6', borderRadius: 8,
    padding: 10, fontSize: 15, marginBottom: 4, color: colors.text,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  chip: {
    borderWidth: 2, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14,
  },
  chipText: { fontWeight: '700' },
  scanBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    paddingVertical: 11, paddingHorizontal: 14,
  },
  smallBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  photo: { width: 90, height: 90, borderRadius: 8, marginRight: 8, backgroundColor: '#eee' },
  hint: { color: colors.subtle, fontSize: 12 },
});
