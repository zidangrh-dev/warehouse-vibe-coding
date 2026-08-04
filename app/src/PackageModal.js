import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api, uploadPhoto, photoUrl } from "./api";
import {
  colors,
  radius,
  shadow,
  statusLabel,
  statusColor,
  NEXT_ACTIONS,
  notice,
  confirmAsync,
} from "./theme";
import { useBreakpoint } from "./responsive";
import { ConfirmActionModal } from "./ConfirmActionModal";
import Icon from "./Icon";

const Field = ({ label, children }) => (
  <View style={{ marginTop: 10 }}>
    <Text style={s.label}>{label}</Text>
    {children}
  </View>
);

export default function PackageModal({ pkgId, user, onClose, onChanged }) {
  const { isWide } = useBreakpoint();
  const [pkg, setPkg] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [viewingPhoto, setViewingPhoto] = useState(null);

  const load = async () => {
    if (!pkgId) return;
    const p = await api.getPackage(pkgId);
    setPkg(p);
    setNote(p.admin_note || "");
  };
  useEffect(() => {
    load();
  }, [pkgId]);

  if (!pkgId || !pkg) return null;

  const isArchived = !!pkg.archived;
  const isPhotoLocked = isArchived || ['done_pickup', 'selesai', 'retur', 'cancel'].includes(pkg.status);
  const canAct = !isArchived && (user.role === 'superadmin' || user.role === 'admin' || user.role === 'warehouse');
  const canEditPhotos = canAct && !isPhotoLocked;

  const actions = NEXT_ACTIONS[pkg.status] || [];

  const photos = pkg.photos || [];
  const isGojek = pkg.pickup_type === "gojek";
  const wajahPhotos = photos.filter((p) => p.kind === "wajah");
  const ktpPhotos = photos.filter((p) => p.kind === "ktp");
  const barangPhotos = photos.filter((p) => p.kind === "barang");
  // Konfirmasi butuh bukti foto:
  //   Gojek        : 1 foto wajah driver + 1 foto KTP driver + 1 foto barang (3 foto)
  //   Self Pick Up : 1 foto pengambil + barang + 1 foto barang (2 foto)
  const needsPhotos =
    (isGojek && pkg.status === "driver_sampai_kios") ||
    (!isGojek && pkg.status === "absen_ambil_customer");
  const photosOk = isGojek
    ? wajahPhotos.length >= 1 &&
      ktpPhotos.length >= 1 &&
      barangPhotos.length >= 1
    : wajahPhotos.length >= 1 && barangPhotos.length >= 1;
  const gatedStatus = "done_pickup";

  const addPhoto = async (kind, fromCamera) => {
    const opts = { quality: 0.8 };
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
      const rawAsset = result.assets[0];
      // Resize otomatis ke lebar maks 1000px dengan kompresi 0.65 -> ukuran file turun dari ~400KB menjadi ~60KB - 80KB!
      const resized = await ImageManipulator.manipulateAsync(
        rawAsset.uri,
        [{ resize: { width: 1000 } }],
        {
          compress: 0.65,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      await uploadPhoto(pkg.id, kind, resized);
      onChanged();
      await load();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (photo) => {
    if (isPhotoLocked) {
      return notice('🔒 Foto telah dikunci secara permanen dan tidak dapat dihapus.');
    }
    if (!(await confirmAsync('Hapus foto?'))) return;
    await api.deletePhoto(photo.id);
    onChanged();
    await load();
  };

  // Satu tombol -> pilih sumber (Kamera / File). Di web langsung buka file.
  const pickPhoto = (kind) => {
    if (isPhotoLocked) {
      return notice('🔒 Transaksi sudah dikonfirmasi / diarsip. Foto telah dikunci.');
    }
    if (Platform.OS === 'web') return addPhoto(kind, false);
    Alert.alert('Tambah Foto', 'Pilih sumber foto', [
      { text: '📸 Kamera', onPress: () => addPhoto(kind, true) },
      { text: '🗂 File / Galeri', onPress: () => addPhoto(kind, false) },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const downloadPhotoDirect = async (photo) => {
    if (!photo) return;
    const url = photoUrl(photo);
    const filename = photo.filename || `foto-${Date.now()}.jpg`;

    try {
      if (Platform.OS === 'web') {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        notice('Foto berhasil diunduh ke komputer');
        return;
      }

      // Mobile Native (Android / iOS)
      const FileSystem = await import('expo-file-system/legacy');
      const Sharing = await import('expo-sharing');
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const targetUri = baseDir + filename;

      // Strategi 1: Coba downloadAsync
      let downloadRes;
      try {
        downloadRes = await FileSystem.downloadAsync(url, targetUri);
      } catch (e) {
        // Fallback jika downloadAsync diblokir oleh OS / HTTP cleartext
      }

      if (downloadRes && downloadRes.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadRes.uri);
        } else {
          notice('Foto berhasil disimpan di HP');
        }
        return;
      }

      // Strategi 2: Fallback via JS fetch + FileReader -> Base64 -> FileSystem -> Sharing
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const reader = new FileReader();

      const base64Data = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const resStr = (reader.result || '').toString();
          const base64 = resStr.includes(',') ? resStr.split(',')[1] : resStr;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Gagal membaca gambar'));
        reader.readAsDataURL(blob);
      });

      await FileSystem.writeAsStringAsync(targetUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri);
      } else {
        notice('Foto berhasil disimpan di HP');
      }
    } catch (e) {
      notice(`Gagal mengunduh foto: ${e.message || 'Error'}`);
    }
  };

  const PhotoStrip = ({ title, kind, list, need }) => (
    <View style={{ marginTop: 8 }}>
      <Text style={s.photoTitle}>
        {title}{' '}
        {need > 0 && (
          <Text
            style={{ color: list.length >= need ? colors.ok : colors.danger }}
          >
            ({list.length}/{need})
          </Text>
        )}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {list.map((p) => (
          <View key={p.id} style={{ position: 'relative', marginRight: 8 }}>
            <TouchableOpacity
              onPress={() => setViewingPhoto(p)}
              onLongPress={() => canEditPhotos && removePhoto(p)}
            >
              <Image source={{ uri: photoUrl(p) }} style={s.photo} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.photoDlBadge}
              onPress={() => downloadPhotoDirect(p)}
              activeOpacity={0.7}
            >
              <Icon name="download" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
        {canEditPhotos && (
          <TouchableOpacity
            style={s.photoAdd}
            onPress={() => pickPhoto(kind)}
            disabled={busy}
          >
            <Text style={s.photoAddText}>＋{'\n'}Tambah</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  const setStatus = async (to) => {
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, { status: to });
      onChanged();
      await load();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, { admin_note: note });
      onChanged();
      notice("Catatan tersimpan");
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, isWide && { maxWidth: 640 }]}>
          <ScrollView>
            <Text style={s.invoice}>{pkg.invoice_no}</Text>
            <Text style={[s.status, { color: statusColor(pkg.status) }]}>
              ● {statusLabel(pkg.status)}
            </Text>

            {isArchived && (
              <View style={s.archivedBanner}>
                <Text style={s.archivedBannerTitle}>📦 PAKET TELAH DIARSIP</Text>
                <Text style={s.archivedBannerText}>
                  Data ini telah dikunci secara permanen dan tidak dapat diubah oleh siapapun.
                </Text>
              </View>
            )}

            <Field label="Customer">
              <Text style={s.value}>
                {pkg.customer_name || "-"}{" "}
                {pkg.customer_phone ? `· ${pkg.customer_phone}` : ""}
              </Text>
            </Field>
            {!!pkg.awb_no && (
              <Field label="AWB / Resi">
                <Text style={[s.value, { fontWeight: "700" }]}>
                  {pkg.awb_no}
                </Text>
              </Field>
            )}
            <Field label="Barang / Toko">
              <Text style={s.value}>
                {pkg.item_desc || "-"}
                {pkg.platform ? ` · ${pkg.platform}` : ""}
                {pkg.courier ? ` · ${pkg.courier}` : ""}
              </Text>
            </Field>
            <Field label="Jenis ambilan">
              {/* Dikunci: ditentukan oleh data dari admin gudang, tidak bisa diganti. */}
              <View style={s.rowWrap}>
                <Text style={s.value}>
                  {pkg.pickup_type === "gojek"
                    ? `🛵 ${pkg.courier || "Driver"}`
                    : "🧍 Ambil Customer"}
                </Text>
                <Text style={s.lockTag}>🔒 terkunci</Text>
              </View>
            </Field>
            {!!pkg.pickup_code && (
              <Field label="Pickup code">
                <Text
                  style={[s.value, { fontWeight: "800", letterSpacing: 2 }]}
                >
                  {pkg.pickup_code}
                </Text>
              </Field>
            )}
            {!!pkg.picker_name && (
              <Field label="Diambil oleh">
                <Text style={s.value}>{pkg.picker_name}</Text>
              </Field>
            )}

            <Field label="Admin note (data driver, dsb.)">
              <TextInput
                style={s.input}
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="Nama driver, plat nomor, catatan..."
                editable={canAct}
              />
              {canAct && (
                <TouchableOpacity
                  style={s.saveNote}
                  onPress={saveNote}
                  disabled={busy}
                >
                  <Text style={s.btnText}>Simpan Catatan</Text>
                </TouchableOpacity>
              )}
            </Field>

            {(needsPhotos || photos.length > 0) && (
              <Field label="Bukti foto konfirmasi">
                {isGojek ? (
                  <>
                    <PhotoStrip
                      title="Foto wajah driver"
                      kind="wajah"
                      list={wajahPhotos}
                      need={1}
                    />
                    <PhotoStrip
                      title="Foto KTP driver"
                      kind="ktp"
                      list={ktpPhotos}
                      need={1}
                    />
                    <PhotoStrip
                      title="Foto barang"
                      kind="barang"
                      list={barangPhotos}
                      need={1}
                    />
                  </>
                ) : (
                  <>
                    <PhotoStrip
                      title="Foto pengambil + barang"
                      kind="wajah"
                      list={wajahPhotos}
                      need={1}
                    />
                    {ktpPhotos.length > 0 && (
                      <PhotoStrip
                        title="Foto KTP (opsional)"
                        kind="ktp"
                        list={ktpPhotos}
                        need={0}
                      />
                    )}
                    <PhotoStrip
                      title="Foto barang saja"
                      kind="barang"
                      list={barangPhotos}
                      need={1}
                    />
                  </>
                )}
                {canAct && (
                  <Text style={s.hint}>
                    {isPhotoLocked
                      ? '🔒 Bukti foto telah dikunci secara permanen (tidak dapat ditambah/dihapus).'
                      : 'Tekan lama foto untuk menghapus.'}
                  </Text>
                )}
              </Field>
            )}

            {busy && <ActivityIndicator style={{ marginTop: 8 }} />}

            {canAct && actions.length > 0 && (
              <Field label="Aksi">
                {actions.map((a) => {
                  const locked =
                    a.to === gatedStatus && needsPhotos && !photosOk;
                  return (
                    <TouchableOpacity
                      key={a.to}
                      style={[
                        s.actionBtn,
                        {
                          backgroundColor: locked
                            ? colors.border
                            : statusColor(a.to),
                        },
                      ]}
                      onPress={() => {
                        if (locked) {
                          notice(
                            isGojek
                              ? "Lengkapi dulu: foto wajah driver, KTP driver, dan foto barang (masing-masing 1)."
                              : "Lengkapi dulu: foto pengambil + barang dan foto barang (masing-masing 1).",
                          );
                        } else if (a.to === "retur" || a.to === "cancel") {
                          setPendingStatus(a.to);
                        } else {
                          setStatus(a.to);
                        }
                      }}
                      disabled={busy}
                    >
                      <Text
                        style={[s.btnText, locked && { color: colors.sub }]}
                      >
                        {locked ? "🔒 " : ""}
                        {a.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </Field>
            )}

            <Field label="Riwayat">
              {(pkg.events || []).map((ev) => (
                <Text key={ev.id} style={s.event}>
                  • {new Date(ev.created_at).toLocaleString("id-ID")} —{" "}
                  {ev.user_name}: {ev.action}
                  {ev.detail ? ` (${ev.detail})` : ""}
                </Text>
              ))}
            </Field>

            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={[s.btnText, { color: colors.ink }]}>Tutup</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <ConfirmActionModal
        visible={!!pendingStatus}
        targetStatus={pendingStatus}
        pkg={pkg}
        busy={busy}
        onClose={() => setPendingStatus(null)}
        onConfirm={async () => {
          const st = pendingStatus;
          setPendingStatus(null);
          await setStatus(st);
        }}
      />

      {viewingPhoto && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setViewingPhoto(null)}
        >
          <View style={s.pvBackdrop}>
            <View style={s.pvCard}>
              <View style={s.pvHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pvTitle}>📷 Foto Bukti ({viewingPhoto.kind})</Text>
                  <Text style={s.pvSub}>{viewingPhoto.filename}</Text>
                </View>
                <TouchableOpacity
                  style={s.pvDlBtn}
                  onPress={() => downloadPhotoDirect(viewingPhoto)}
                  activeOpacity={0.7}
                >
                  <Icon name="download" size={14} color={colors.primary} />
                  <Text style={s.pvDlBtnText}>Unduh</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.pvClose} onPress={() => setViewingPhoto(null)}>
                  <Text style={{ fontSize: 18, color: colors.sub }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Image
                source={{ uri: photoUrl(viewingPhoto) }}
                style={s.pvImage}
                resizeMode="contain"
              />

              <TouchableOpacity
                style={[s.btn, s.btnGhost, { marginTop: 14 }]}
                onPress={() => setViewingPhoto(null)}
              >
                <Text style={[s.btnText, { color: colors.ink }]}>Tutup Pratinjau</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
  },
  invoice: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    fontFamily: undefined,
  },
  status: { fontWeight: "600", marginTop: 2 },
  label: {
    fontWeight: "700",
    color: colors.sub,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: { color: colors.ink, fontSize: 15, marginTop: 2 },
  rowWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  lockTag: { color: colors.faint, fontWeight: "700", fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 10,
    minHeight: 60,
    textAlignVertical: "top",
    color: colors.ink,
    marginTop: 4,
    backgroundColor: colors.bg,
  },
  saveNote: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 10,
    alignItems: "center",
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
  },
  actionBtn: {
    borderRadius: radius.input,
    padding: 12,
    alignItems: "center",
    marginTop: 6,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  event: { color: colors.sub, fontSize: 12, marginTop: 4 },
  photoTitle: {
    fontWeight: "700",
    color: colors.ink,
    fontSize: 13,
    marginBottom: 6,
  },
  photo: {
    width: 84,
    height: 84,
    borderRadius: radius.input,
    marginRight: 8,
    backgroundColor: colors.border,
  },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: radius.input,
    marginRight: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  hint: { color: colors.faint, fontSize: 11, marginTop: 6 },
  closeBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 12,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pvBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  pvCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  pvHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pvTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  pvSub: {
    fontSize: 12,
    color: colors.sub,
    marginTop: 2,
  },
  photoDlBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    ...shadow.card,
  },
  pvDlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    marginRight: 8,
  },
  pvDlBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
  },
  pvImage: {
    width: '100%',
    height: 340,
    borderRadius: radius.card,
    backgroundColor: '#0F172A',
  },
  archivedBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.card,
    padding: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  archivedBannerTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.danger,
  },
  archivedBannerText: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 2,
  },
});
