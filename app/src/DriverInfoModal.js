// Modal input data driver (alur Gojek): admin mengisi info driver (nama / no
// HP / dll digabung dalam SATU field, di-copy sekaligus dari marketplace) dan
// pickup code sebelum paket dijemput driver.
//  - "Tutup & Simpan": simpan data + lanjutkan ke status 'data_driver_ready'
//    (hanya jika info driver terisi; pickup code opsional / jika belum ada).
//  - Klik di luar modal: simpan draft yang sedang diketik, tanpa lanjut status.
import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { api } from "./api";
import { colors, radius, shadow, notice } from "./theme";

export default function DriverInfoModal({ visible, pkg, onClose, onSaved }) {
  const [driverInfo, setDriverInfo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible && pkg) {
      setDriverInfo(pkg.driver_info || "");
      setCode(pkg.pickup_code || "");
    }
  }, [visible, pkg]);

  if (!visible || !pkg) return null;

  const valid = !!driverInfo.trim();
  // Hanya kirim field yang BENAR-BENAR berubah dari nilai tersimpan. Jika tidak
  // ada perubahan, PATCH di-skip sehingga updated_at / last update TIDAK berubah.
  const changed = () => {
    const b = {};
    const n = driverInfo.trim();
    const c = code.trim();
    if (n !== (pkg.driver_info || "").trim()) b.driver_info = n;
    if (c !== (pkg.pickup_code || "").trim()) b.pickup_code = c;
    return b;
  };

  const saveAndAdvance = async () => {
    if (busy) return;
    const b = changed();
    if (!valid && Object.keys(b).length === 0) {
      // Kosong & tidak ada input: jangan ubah apa pun, jangan sentuh last update.
      notice("Data driver wajib diisi agar bisa lanjut ke step berikutnya.");
      onClose();
      return;
    }
    setBusy(true);
    try {
      if (valid) b.status = "data_driver_ready";
      await api.updatePackage(pkg.id, b);
      if (valid) {
        notice('✅ Data driver tersimpan — lanjut ke "Driver Sampai Kios".');
      } else {
        notice("Data driver wajib diisi agar bisa lanjut ke step berikutnya.");
      }
      onSaved?.();
      onClose();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (busy) return;
    const b = changed();
    if (Object.keys(b).length === 0) {
      // Tidak ada yang diubah — tutup tanpa menyentuh data / last update.
      onClose();
      return;
    }
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, b);
      onSaved?.();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={saveDraft}>
      <TouchableOpacity
        style={s.backdrop}
        activeOpacity={1}
        onPress={saveDraft}
      >
        <TouchableOpacity
          style={s.sheet}
          activeOpacity={1}
          onPress={(e) => e?.stopPropagation?.()}
        >
          <View style={s.grabber} />
          <Text style={s.title}>🛵 Data Driver</Text>
          <Text style={s.sub}>
            {pkg.invoice_no}
            {pkg.customer_name ? ` · ${pkg.customer_name}` : ""}
          </Text>
          <Text style={s.label}>Data driver</Text>
          <TextInput
            style={s.input}
            placeholder="Nama / No HP / dll (copy dari marketplace)"
            placeholderTextColor={colors.faint}
            value={driverInfo}
            onChangeText={setDriverInfo}
            autoFocus
            multiline
          />
          <Text style={s.label}>Pickup code (jika belum ada)</Text>
          <TextInput
            style={s.input}
            placeholder="Opsional — bisa diisi/diubah admin"
            placeholderTextColor={colors.faint}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
          />
          {busy && (
            <ActivityIndicator
              style={{ marginTop: 8 }}
              color={colors.primary}
            />
          )}
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.primary }]}
            onPress={saveAndAdvance}
            disabled={busy}
          >
            <Text style={s.btnText}>
              {busy ? "Menyimpan..." : "Tutup & Simpan"}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
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
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
    maxWidth: 400,
    ...shadow.float,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.ink },
  sub: { color: colors.sub, fontSize: 12.5, marginTop: 2, marginBottom: 6 },
  label: {
    fontWeight: "700",
    color: colors.sub,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
    marginTop: 4,
  },
  btn: {
    borderRadius: radius.pill,
    padding: 13,
    alignItems: "center",
    marginTop: 14,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  hint: {
    color: colors.faint,
    fontSize: 11,
    marginTop: 8,
    textAlign: "center",
  },
});
