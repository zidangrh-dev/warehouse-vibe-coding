import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from './theme';

// Scan barcode via kamera (Android). Di web kamera scan belum didukung,
// jadi selalu tersedia input manual sebagai fallback.
export default function ScannerModal({ visible, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [locked, setLocked] = useState(false);
  const canUseCamera = Platform.OS !== 'web';

  const handleScan = ({ data }) => {
    if (locked || !data) return;
    setLocked(true);
    onScanned(String(data));
    onClose();
    setTimeout(() => setLocked(false), 500);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.wrap}>
        <Text style={s.title}>Scan Barcode</Text>
        {canUseCamera ? (
          permission?.granted ? (
            <CameraView
              style={s.camera}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'upc_a', 'upc_e'],
              }}
              onBarcodeScanned={handleScan}
            />
          ) : (
            <TouchableOpacity style={s.btn} onPress={requestPermission}>
              <Text style={s.btnText}>Izinkan Akses Kamera</Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={s.info}>
            Scan kamera tersedia di aplikasi Android. Di web, ketik barcode secara manual:
          </Text>
        )}
        <TextInput
          style={s.input}
          placeholder="Atau ketik barcode manual..."
          value={manual}
          onChangeText={setManual}
          onSubmitEditing={() => {
            if (manual.trim()) {
              onScanned(manual.trim());
              setManual('');
              onClose();
            }
          }}
        />
        <View style={s.row}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.ok }]}
            onPress={() => {
              if (manual.trim()) {
                onScanned(manual.trim());
                setManual('');
              }
              onClose();
            }}
          >
            <Text style={s.btnText}>Pakai</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.subtle }]} onPress={onClose}>
            <Text style={s.btnText}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#111', padding: 20, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  camera: { height: 320, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  info: { color: '#bbb', marginBottom: 12, textAlign: 'center' },
  input: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  btn: {
    backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 8, alignItems: 'center', marginBottom: 8,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
