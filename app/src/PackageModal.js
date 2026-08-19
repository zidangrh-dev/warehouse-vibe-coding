import { useCallback, useEffect, useRef, useState } from "react";
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
  Pressable,
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
import { NamePickerModal } from "./components";
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

  const [codeVal, setCodeVal] = useState("");
  const [editingCode, setEditingCode] = useState(false);

  const [driverInfo, setDriverInfo] = useState("");
  const [driverRefreshed, setDriverRefreshed] = useState(false);
  const [confirmAnteranOpen, setConfirmAnteranOpen] = useState(false);
  const [doneByOpen, setDoneByOpen] = useState(false);
  const [confirmAfterName, setConfirmAfterName] = useState(false);

  const load = async () => {
    if (!pkgId) return;
    const p = await api.getPackage(pkgId);
    setPkg(p);
    setNote(p.admin_note || "");
    setCodeVal(p.pickup_code || "");
    setDriverInfo(p.driver_info || "");
    setDriverRefreshed(!!p.driver_refreshed);
    setEditingCode(false);
  };
  useEffect(() => {
    load();
  }, [pkgId]);

  // Auto-save admin note: debounce 700ms, lalu flush saat Tutup/close.
  // WAJIB di atas early-return — hook tidak boleh conditional.
  const noteTimerRef = useRef(null);
  const noteLastSavedRef = useRef(note);
  const flushNote = useCallback(() => {
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    if (!pkg) return;
    const cur = note.trim();
    const base = (pkg.admin_note || "").trim();
    if (cur === base) return;
    if (cur === noteLastSavedRef.current) return;
    noteLastSavedRef.current = cur;
    api
      .updatePackage(pkg.id, { admin_note: cur })
      .then(onChanged)
      .catch((e) => notice(e.message));
  }, [pkg, note, onChanged]);

  const onChangeNote = (v) => {
    setNote(v);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(flushNote, 700);
  };

  // Auto-simpan draf lain (driver info, tag REFRESH, pickup code) saat modal
  // ditutup — pola sama seperti admin_note, supaya input tidak hilang.
  const flushDraft = async () => {
    if (!pkg) return;
    try {
      const isArchived = !!pkg.archived;
      const canAct = !isArchived && (user.role === 'superadmin' || user.role === 'admin' || user.role === 'warehouse');
      const isGojek = pkg.pickup_type === 'gojek';
      const lockDriver = isArchived || !!pkg.driver_locked || ['selesai', 'retur', 'cancel'].includes(pkg.status);
      if (canAct && !lockDriver && isGojek) {
        const driverChanged = driverInfo.trim() !== (pkg.driver_info || '').trim();
        const refreshChanged = driverRefreshed !== !!pkg.driver_refreshed;
        if (driverChanged || refreshChanged) {
          await api.updatePackage(pkg.id, {
            driver_info: driverInfo.trim(),
            driver_refreshed: driverRefreshed,
          });
          onChanged();
        }
      }
      const canEditCode = !lockDriver && (user.role === 'sales' || user.role === 'admin' || user.role === 'superadmin' || user.role === 'warehouse');
      if (canEditCode) {
        const codeChanged = !!codeVal.trim() && codeVal.trim() !== (pkg.pickup_code || '').trim();
        if (codeChanged) {
          await api.updatePackage(pkg.id, { pickup_code: codeVal.trim() });
          onChanged();
        }
      }
    } catch (e) {
      notice(e.message);
    }
  };

  // Flush catatan saat modal ditutup (termasuk lewat tombol Tutup tak langsung).
  const handleClose = () => {
    flushNote();
    flushDraft();
    onClose();
  };

  if (!pkgId || !pkg) return null;

  const isArchived = !!pkg.archived;
  const isPhotoLocked = isArchived || ['selesai', 'retur', 'cancel'].includes(pkg.status);
  const canAct = !isArchived && (user.role === 'superadmin' || user.role === 'admin' || user.role === 'warehouse');
  const isAdmin = user.role === 'superadmin' || user.role === 'admin';
  const lockDriver = isArchived || !!pkg.driver_locked || ['selesai', 'retur', 'cancel'].includes(pkg.status);
  const canEditCode = !lockDriver && (user.role === 'sales' || user.role === 'admin' || user.role === 'superadmin' || user.role === 'warehouse');
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
  const gatedStatus = "selesai";
  // Data driver WAJIB terisi sebelum konfirmasi (paket gojek).
  const driverReady = !!String(pkg.driver_info || "").trim();
  const driverLocked = isGojek && pkg.status === "driver_sampai_kios" && !driverReady;

  // Fallback upload: file asli tanpa resize (dipakai kalau resize gagal/gantung di web).
  const fallbackPhotoBody = (rawAsset) => ({
    file: rawAsset.file || null,
    fileName: rawAsset.fileName || "foto.jpg",
    uri: rawAsset.uri,
    mimeType: rawAsset.mimeType,
  });

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
      const isWeb = Platform.OS === "web";
      let body;
      if (isWeb) {
        // Jaring pengaman web: resize boleh gagal/gantung, jangan sampai
        // "diam saja". Batasi 8 detik, lalu upload file asli apa adanya.
        const manipulations = {
          resize: { width: 1000 },
        };
        const manipulateBody = ImageManipulator.manipulateAsync(
          rawAsset.uri,
          [manipulations],
          {
            compress: 0.65,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        )
          .catch(() => fallbackPhotoBody(rawAsset));
        const timeoutBody = new Promise((resolve) =>
          setTimeout(() => resolve(fallbackPhotoBody(rawAsset)), 8000),
        );
        body = await Promise.race([manipulateBody, timeoutBody]);
      } else {
        // Resize otomatis ke lebar maks 1000px dengan kompresi 0.65 -> ukuran file turun dari ~400KB menjadi ~60KB - 80KB!
        body = await ImageManipulator.manipulateAsync(
          rawAsset.uri,
          [{ resize: { width: 1000 } }],
          {
            compress: 0.65,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
      }
      await uploadPhoto(pkg.id, kind, body);
      onChanged();
      await load();
      if (isWeb) notice("Foto berhasil ditambahkan!", "success");
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (photo) => {
    if (isPhotoLocked) {
      return notice('Foto telah dikunci secara permanen dan tidak dapat dihapus.');
    }
    if (!(await confirmAsync('Hapus foto?'))) return;
    await api.deletePhoto(photo.id);
    onChanged();
    await load();
  };

  // Satu tombol -> pilih sumber (Kamera / File). Di web langsung buka file.
  const pickPhoto = (kind) => {
    if (isPhotoLocked) {
      return notice('Transaksi sudah dikonfirmasi / diarsip. Foto telah dikunci.');
    }
    if (Platform.OS === 'web') return addPhoto(kind, false);
    Alert.alert('Tambah Foto', 'Pilih sumber foto', [
      { text: 'Kamera', onPress: () => addPhoto(kind, true) },
      { text: 'File / Galeri', onPress: () => addPhoto(kind, false) },
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
            <Text style={s.photoAddText}>{'+\n'}Tambah</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  const setStatus = async (to) => {
    setBusy(true);
    try {
      const payload = { status: to };
      if (isGojek && !lockDriver) {
        if (driverInfo.trim() !== (pkg.driver_info || '').trim()) {
          payload.driver_info = driverInfo.trim();
        }
        if (driverRefreshed !== !!pkg.driver_refreshed) {
          payload.driver_refreshed = driverRefreshed;
        }
      }
      await api.updatePackage(pkg.id, payload);
      onChanged();
      await load();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveCode = async () => {
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, { pickup_code: codeVal.trim() });
      onChanged();
      await load();
      notice("Pickup code berhasil disimpan!");
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const changeAnteranToAmbilan = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, { pickup_type: 'customer', status: 'absen_ambil_customer' });
      notice('Jenis ambilan berhasil diubah menjadi Ambil Customer!');
      setConfirmAnteranOpen(false);
      onChanged();
      await load();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveDriver = async () => {
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, {
        driver_info: driverInfo.trim(),
        driver_refreshed: driverRefreshed,
      });
      notice("Data driver tersimpan");
      onChanged();
      await load();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUnarchive = async () => {
    setBusy(true);
    try {
      await api.unarchivePackage(pkg.id);
      notice("Berhasil mengembalikan paket dari arsip ke data aktif!");
      onChanged();
      onClose();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.modalRoot}>
        <Pressable style={s.backdropHit} onPress={handleClose} accessibilityLabel="Tutup dialog" />
        <View style={[s.sheet, isWide && { maxWidth: 640 }]}>
          <ScrollView>
            <Text style={s.invoice}>{pkg.invoice_no}</Text>
            <Text style={[s.status, { color: statusColor(pkg.status), marginTop: 2 }]}>
              ● {statusLabel(pkg.status)}
            </Text>

            {isArchived && (
              <View style={s.archivedBanner}>
                <Text style={s.archivedBannerTitle}>PAKET TELAH DIARSIP</Text>
                <Text style={s.archivedBannerText}>
                  {user.role === 'superadmin'
                    ? 'Data ini sedang dikunci. Sebagai Super Admin, Anda dapat mengembalikan paket ini ke data aktif.'
                    : 'Data ini telah dikunci secara permanen dan tidak dapat diubah oleh siapapun.'}
                </Text>
                {user.role === 'superadmin' && (
                  <TouchableOpacity
                    style={s.unarchiveBtn}
                    onPress={handleUnarchive}
                    disabled={busy}
                  >
                    <Text style={s.unarchiveBtnText}>
                      {busy ? 'Processing...' : 'Pulihkan Paket ke Data Aktif'}
                    </Text>
                  </TouchableOpacity>
                )}
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
                {pkg.courier ? ` · ${pkg.courier}` : ""}
              </Text>
            </Field>
            <Field label="Jenis Ambilan">
              {pkg.pickup_type === 'anteran' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#92400E' }}>Anteran Kurir Internal</Text>
                  </View>
                  {!isArchived && (user.role === 'warehouse' || user.role === 'superadmin') && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.primarySoft,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        borderRadius: radius.pill,
                        paddingVertical: 4,
                        paddingHorizontal: 10,
                      }}
                      onPress={() => setConfirmAnteranOpen(true)}
                      disabled={busy}
                    >
                        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>
                          Ubah ke Ambilan
                        </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={s.rowWrap}>
                  <Text style={s.value}>
                    {pkg.pickup_type === 'gojek'
                      ? `${pkg.courier || 'Driver'}`
                      : 'Ambil Customer'}
                  </Text>
                  <Text style={s.lockTag}>terkunci</Text>
                </View>
              )}
            </Field>
            <Field label="Pickup Code / PIN">
              {canEditCode ? (
                editingCode || !pkg.pickup_code ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' }}>
                    <TextInput
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.pill,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        fontSize: 14,
                        fontWeight: '700',
                        letterSpacing: 1.5,
                        color: colors.ink,
                        backgroundColor: colors.bg,
                      }}
                      value={codeVal}
                      onChangeText={setCodeVal}
                      placeholder="Isi / Ubah Pickup Code..."
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={{
                        borderRadius: radius.pill,
                        backgroundColor: colors.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={saveCode}
                      disabled={busy}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {busy ? '...' : 'Simpan'}
                      </Text>
                    </TouchableOpacity>
                    {!!pkg.pickup_code && (
                      <TouchableOpacity
                        style={{
                          borderRadius: radius.pill,
                          backgroundColor: colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={() => { setCodeVal(pkg.pickup_code); setEditingCode(false); }}
                      >
                        <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 13 }}>Batal</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={[s.value, { fontWeight: "800", letterSpacing: 2, fontSize: 15 }]}>
                      {pkg.pickup_code}
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 12 }}
                      onPress={() => setEditingCode(true)}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Edit Code</Text>
                    </TouchableOpacity>
                  </View>
                )
              ) : (
                <Text style={[s.value, { fontWeight: "800", letterSpacing: 2 }]}>
                  {pkg.pickup_code || "—"}
                </Text>
              )}
            </Field>
            {!!pkg.picker_name && (
              <Field label="Diambil oleh">
                <Text style={s.value}>{pkg.picker_name}</Text>
              </Field>
            )}

            {canAct && (
              <Field label="Nama Pemroses (Done Pickup)">
                <TouchableOpacity
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 8, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: (pkg.done_by || '').trim() ? '#EFF6FF' : colors.surfaceAlt,
                    borderWidth: 1.5,
                    borderColor: (pkg.done_by || '').trim() ? '#93C5FD' : isAdmin ? colors.danger : colors.border,
                  }}
                  onPress={() => {
                    setConfirmAfterName(false);
                    setDoneByOpen(true);
                  }}
                  disabled={!isAdmin}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: (pkg.done_by || '').trim() ? colors.primary : isAdmin ? colors.danger : colors.sub }}>
                    {(pkg.done_by || '').trim()
                      ? `✓ Diproses oleh: ${pkg.done_by}`
                      : isAdmin
                        ? '+ Pilih Nama Pemroses (wajib sebelum konfirmasi)'
                        : 'Belum ada nama pemroses'}
                  </Text>
                  {isAdmin && <Icon name="edit" size={13} color={colors.primary} strokeWidth={2} />}
                </TouchableOpacity>
                <Text style={s.hint}>
                  {isAdmin
                    ? 'Klik untuk memilih/ganti nama dari daftar staf kios.'
                    : 'Hanya admin yang dapat mengatur nama pemroses.'}
                </Text>
              </Field>
            )}

            <Field label="Admin note">
              <TextInput
                style={s.input}
                value={note}
                onChangeText={onChangeNote}
                multiline
                placeholder="Catatan opsional untuk paket ini..."
                editable={canAct}
              />
              {canAct && <Text style={s.hint}>Auto-simpan saat buka Tab lain.</Text>}
            </Field>

            {isGojek && (
              <Field label="Data driver (Gojek)">
                <TextInput
                  style={s.driverInput}
                  placeholder="Nama / No HP / dll (copy dari marketplace)"
                  placeholderTextColor={colors.faint}
                  value={driverInfo}
                  onChangeText={setDriverInfo}
                  editable={canAct && !lockDriver}
                  multiline
                />
                {canAct && !lockDriver && (
                  <TouchableOpacity
                    style={{
                      alignSelf: 'flex-start',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 8,
                      marginBottom: 4,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: radius.pill,
                      backgroundColor: driverRefreshed ? '#FEF2F2' : colors.surfaceAlt,
                      borderWidth: 1.5,
                      borderColor: driverRefreshed ? colors.danger : colors.border,
                    }}
                    onPress={() => setDriverRefreshed(!driverRefreshed)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: driverRefreshed ? colors.danger : colors.sub }}>
                      {driverRefreshed ? '✓ REFRESH (Driver Berganti)' : '+ Tag REFRESH (Driver Berganti)'}
                    </Text>
                  </TouchableOpacity>
                )}
                {canAct && !lockDriver && (
                  <TouchableOpacity style={s.saveNote} onPress={saveDriver} disabled={busy}>
                    <Text style={s.btnText}>Simpan Data Driver</Text>
                  </TouchableOpacity>
                )}
                {lockDriver && (
                  <Text style={s.hint}>Data driver terkunci setelah transaksi tuntas.</Text>
                )}
              </Field>
            )}

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
                      ? 'Bukti foto telah dikunci secara permanen (tidak dapat ditambah/dihapus).'
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
                    (a.to === gatedStatus && needsPhotos && !photosOk) ||
                    (a.to === gatedStatus && driverLocked);
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
                            driverLocked && !photosOk
                              ? "Lengkapi dulu: data driver, foto wajah driver, KTP driver, dan foto barang (masing-masing 1)."
                              : driverLocked
                              ? "Data driver masih kosong — isi dulu sebelum konfirmasi."
                              : isGojek
                              ? "Lengkapi dulu: foto wajah driver, KTP driver, dan foto barang (masing-masing 1)."
                              : "Lengkapi dulu: foto pengambil + barang dan foto barang (masing-masing 1).",
                          );
                        } else if (a.to === "retur" || a.to === "cancel") {
                          setPendingStatus(a.to);
                        } else if (a.to === "selesai") {
                          if (!(pkg.done_by || '').trim() && isAdmin) {
                            setConfirmAfterName(true);
                            setDoneByOpen(true);
                          } else if (!(pkg.done_by || '').trim()) {
                            notice("Nama staf pemroses (done pickup) wajib diisi — hubungi admin.");
                          } else {
                            setStatus(a.to);
                          }
                        } else {
                          setStatus(a.to);
                        }
                      }}
                      disabled={busy}
                    >
                      <Text
                        style={[s.btnText, locked && { color: colors.sub }]}
                      >
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

            <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
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

      <NamePickerModal
        visible={doneByOpen}
        pkg={pkg}
        userRole={user.role}
        onClose={() => {
          setDoneByOpen(false);
          setConfirmAfterName(false);
        }}
        onChanged={() => {
          onChanged();
          load();
        }}
        onPicked={() => {
          if (confirmAfterName) setStatus('selesai');
        }}
      />

      {/* Modal Konfirmasi Ubah ke Ambilan Customer */}
      {confirmAnteranOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setConfirmAnteranOpen(false)}>
          <View style={s.modalRootDark}>
            <Pressable style={s.backdropHit} onPress={() => setConfirmAnteranOpen(false)} />
            <View style={s.pvCard}>
              <View style={s.pvHead}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="box" size={24} color="#D97706" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.pvTitle, { fontSize: 17 }]}>Ubah Jenis Ambilan</Text>
                  <Text style={[s.pvSub, { fontWeight: '600' }]}>Tindakan ini memerlukan konfirmasi</Text>
                </View>
              </View>
              <Text style={{ fontSize: 13.5, color: colors.sub, lineHeight: 20, marginBottom: 16 }}>
                Apakah Anda yakin ingin mengubah paket Kurir Internal ini menjadi <Text style={{ fontWeight: '800', color: colors.ink }}>Ambilan Customer (Kios)</Text>?
              </Text>
              <View style={s.pvInfoCard}>
                <View style={s.pvInfoRow}>
                  <Text style={s.pvInfoLabel}>No Invoice:</Text>
                  <Text style={s.pvInfoValue}>{pkg.invoice_no}</Text>
                </View>
                <View style={s.pvInfoRow}>
                  <Text style={s.pvInfoLabel}>Customer:</Text>
                  <Text style={s.pvInfoValue}>{pkg.customer_name || '—'} {pkg.customer_phone ? `(${pkg.customer_phone})` : ''}</Text>
                </View>
                <View style={s.pvInfoRow}>
                  <Text style={s.pvInfoLabel}>Kurir:</Text>
                  <Text style={s.pvInfoValue}>{pkg.courier || '—'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                  onPress={() => setConfirmAnteranOpen(false)}
                  disabled={busy}
                >
                  <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 13.5 }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center' }}
                  onPress={changeAnteranToAmbilan}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13.5 }}>Ya, Ubah ke Ambilan</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {viewingPhoto && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setViewingPhoto(null)}
        >
          <View style={s.modalRootDark}>
            <Pressable style={s.backdropHit} onPress={() => setViewingPhoto(null)} />
            <View style={s.pvCard}>
              <View style={s.pvHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pvTitle}>Foto Bukti ({viewingPhoto.kind})</Text>
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
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalRootDark: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  backdropHit: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
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
    position: "relative",
    zIndex: 1,
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
  driverInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
    marginTop: 4,
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
    position: 'relative',
    zIndex: 1,
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
  unarchiveBtn: {
    backgroundColor: '#10B981',
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  unarchiveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  pvInfoCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.card,
    padding: 12,
    gap: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pvInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pvInfoLabel: {
    fontSize: 12.5,
    color: colors.sub,
    fontWeight: '600',
    width: 75,
  },
  pvInfoValue: {
    fontSize: 13.5,
    color: colors.ink,
    fontWeight: '800',
    flex: 1,
  },
});
