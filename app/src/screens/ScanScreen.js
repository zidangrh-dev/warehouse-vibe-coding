// Tab 1: Scan Paket — paket baru datang dari kurir
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../api';
import { notice, colors, radius } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import ScannerModal from '../ScannerModal';
import PackageModal from '../PackageModal';
import ManualInputModal from './ManualInputModal';

// Scan kontinu untuk scanner hardware (web/PC): scanner bertingkah seperti
// keyboard (ketik barcode + Enter). Input selalu terfokus, auto-commit saat
// Enter, auto-clear + refocus sesudahnya sehingga bisa scan berturut-turut
// tanpa sentuh apa pun. Feedback cukup pill visual yang tidak menutup layar.
export default function ScanScreen({ user }) {
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('scan', q, colFilters);
  const [scanOpen, setScanOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualInvoice, setManualInvoice] = useState('');
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  const scanInputRef = useRef(null);
  const scanLockRef = useRef(false);
  const resultTimer = useRef(null);
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState(null); // { ok, text }

  // Fokus otomatis ke kolom scan saat layar terbuka (untuk scanner hardware).
  useEffect(() => {
    const t = setTimeout(() => scanInputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  // Hilangkan feedback visual setelah ~2.5s agar tidak mengganggu scan berikut.
  useEffect(() => {
    if (!scanResult) return;
    resultTimer.current = setTimeout(() => setScanResult(null), 2500);
    return () => clearTimeout(resultTimer.current);
  }, [scanResult]);

  const processScan = useCallback(async (code) => {
    try {
      const p = await api.arrive(code);
      setScanResult({
        ok: true,
        text: `✅ ${p.invoice_no} → ${p.pickup_type === 'gojek' ? 'Absen Gojek' : 'Ambil Customer'}`,
      });
    } catch (e) {
      if (e.status === 404) {
        setScanResult({ ok: false, text: `⚠ ${code} tidak ditemukan` });
        setManualInvoice(code);
        setManualOpen(true);
      } else {
        setScanResult({ ok: false, text: e.message });
      }
    }
  }, []);

  const submitScan = async () => {
    const code = scanInput.trim();
    if (!code || scanLockRef.current) return;
    scanLockRef.current = true; // cegah double-enter dari scanner
    try {
      await processScan(code);
    } finally {
      setScanInput('');
      // clear + refocus agar bisa lanjut scan berikutnya tanpa klik.
      setTimeout(() => {
        scanLockRef.current = false;
        scanInputRef.current?.focus();
      }, 0);
    }
  };

  const onScanned = async (code) => {
    try {
      const p = await api.arrive(code);
      notice(`✅ ${p.invoice_no} sampai kios → ${p.pickup_type === 'gojek' ? 'Absen Gojek' : 'Absen Ambil Customer'}`);
    } catch (e) {
      if (e.status === 404) {
        setManualInvoice(code);
        setManualOpen(true);
        notice('Data paket tidak ditemukan — tanya Sales, lalu isi manual.');
      } else {
        notice(e.message);
      }
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="🔍 Cari invoice / nama / kode..."
          value={q}
          onChangeText={setQ}
        />
        {isAdmin && (
          <>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: colors.primary }]}
              onPress={() => setScanOpen(true)}
            >
              <Text style={s.btnText}>📷 Scan Paket Sampai</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: colors.sub }]}
              onPress={() => { setManualInvoice(''); setManualOpen(true); }}
            >
              <Text style={s.btnText}>＋ Manual</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Kolom scan permanen untuk scanner hardware (web/PC) — loop kontinu */}
      {isAdmin && (
        <View style={scanBarStyle.wrap}>
          <View style={scanBarStyle.row}>
            <TextInput
              ref={scanInputRef}
              style={[s.input, scanBarStyle.input]}
              placeholder="🖥 Scan barcode / AWB paket sampai lalu Enter..."
              value={scanInput}
              onChangeText={setScanInput}
              onSubmitEditing={submitScan}
              enterKeyHint="enter"
            />
            {scanResult && (
              <View style={[scanBarStyle.pill, {
                backgroundColor: scanResult.ok ? '#DCFCE7' : '#FEE2E2',
                borderColor: scanResult.ok ? '#86EFAC' : '#FCA5A5',
              }]}>
                <Text style={[scanBarStyle.pillText, { color: scanResult.ok ? '#15803D' : '#B91C1C' }]} numberOfLines={1}>
                  {scanResult.text}
                </Text>
              </View>
            )}
          </View>
          <Text style={scanBarStyle.hint}>
            Scanner hardware: cukup arahkan & tekan trigger berulang — kode otomatis diproses. Tidak ditemukan → form manual terbuka.
          </Text>
        </View>
      )}

      <Text style={s.sectionTitle}>
        {searching
          ? `Hasil pencarian "${q.trim()}" (${total})`
          : `Data pickup dari VEF — belum sampai kios (${total})`}
      </Text>
      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={{ page, total, onPage: setPage }}
        onSearchQuery={setQ}
        onColumnFilterChange={setColFilters}
        tab="scan"
      />
      <ScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onScanned={onScanned} />
      <ManualInputModal
        visible={manualOpen}
        initialInvoice={manualInvoice}
        onClose={() => setManualOpen(false)}
        onSaved={refetch}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

const scanBarStyle = {
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    marginBottom: 0,
    fontSize: 15,
  },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '55%',
  },
  pillText: {
    fontWeight: '700',
    fontSize: 12.5,
  },
  hint: {
    fontSize: 11,
    color: colors.faint,
    marginTop: 4,
  },
};
