// Tab 4: Cancel / Retur — paket yang dibatalkan atau dikembalikan
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../api';
import { notice, colors, radius, statusColor, NEXT_ACTIONS } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import PackageModal from '../PackageModal';
import ScannerModal from '../ScannerModal';

export default function CancelReturScreen({ user }) {
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('cancelretur', q, colFilters);
  const [openId, setOpenId] = useState(null);
  const [scanMode, setScanMode] = useState(null); // 'ship' | 'receive' | null

  const canShip = user.role === 'admin' || user.role === 'superadmin';
  const canReceive = user.role === 'warehouse' || user.role === 'superadmin';
  const isWarehouse = user.role === 'warehouse';

  // Hardware Scanner State & Refs (pilihan A pintar per role)
  const scanInputRef = useRef(null);
  const scanLockRef = useRef(false);
  const resultTimer = useRef(null);
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState(null); // { ok, text }

  // Auto-focus ke input hardware scanner saat tab dibuka
  useEffect(() => {
    const t = setTimeout(() => scanInputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  // Hilangkan pill visual feedback setelah ~2.5s
  useEffect(() => {
    if (!scanResult) return;
    resultTimer.current = setTimeout(() => setScanResult(null), 2500);
    return () => clearTimeout(resultTimer.current);
  }, [scanResult]);

  const processHardwareScan = useCallback(async (code) => {
    try {
      if (isWarehouse) {
        // Tim Warehouse: Otomatis Diterima Gudang
        const p = await api.receiveAtWarehouse(code);
        setScanResult({
          ok: true,
          text: `${p.invoice_no} → Diterima Gudang Utama`,
        });
      } else {
        // Admin Kios / Super Admin: Otomatis Dikirim ke Gudang
        const p = await api.shipToWarehouse(code);
        setScanResult({
          ok: true,
          text: `${p.invoice_no} → Dikirim ke Gudang (Kurir)`,
        });
      }
      refetch();
    } catch (e) {
      setScanResult({ ok: false, text: `${code}: ${e.message}` });
    }
  }, [isWarehouse, refetch]);

  const submitHardwareScan = async () => {
    const code = scanInput.trim();
    if (!code || scanLockRef.current) return;
    scanLockRef.current = true;
    try {
      await processHardwareScan(code);
    } finally {
      setScanInput('');
      setTimeout(() => {
        scanLockRef.current = false;
        scanInputRef.current?.focus();
      }, 0);
    }
  };

  const onScanned = async (code) => {
    try {
      if (scanMode === 'ship') {
        const p = await api.shipToWarehouse(code);
        notice(`${p.invoice_no} diserahkan ke Kurir untuk dikirim ke Gudang Utama!`);
      } else if (scanMode === 'receive') {
        const p = await api.receiveAtWarehouse(code);
        notice(`${p.invoice_no} berhasil diterima fisik di Gudang Utama!`);
      }
      refetch();
    } catch (e) {
      notice(e.message);
    }
  };

  const rowAction = (pkg) => {
    const actions = NEXT_ACTIONS[pkg.status] || [];
    const next = actions[0];
    if (!next) return null;

    // Pengecekan hak akses per status transisi:
    if (next.to === 'dikirim_ke_gudang' && !canShip) return null;
    if (next.to === 'diterima_gudang' && !canReceive) return null;
    if ((next.to === 'mencari_driver' || next.to === 'absen_ambil_customer') && !canShip) return null;

    return (
      <TouchableOpacity
        style={[s.rowBtn, { backgroundColor: statusColor(next.to) }]}
        onPress={async () => {
          try {
            await api.updatePackage(pkg.id, { status: next.to, baseUpdatedAt: pkg.updated_at });
            refetch();
          } catch (e) {
            if (e && e.status === 409) { notice("Data diubah pengguna lain — memuat ulang..."); refetch(); }
            else notice(e.message);
          }
        }}
      >
        <Text style={s.rowBtnText}>{next.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Cari invoice / nama / kode..."
          placeholderTextColor={colors.faint}
          value={q}
          onChangeText={setQ}
        />
        {canShip && (
          <TouchableOpacity
            style={[s.bigBtn, { backgroundColor: '#D97706' }]}
            onPress={() => setScanMode('ship')}
          >
            <Text style={s.btnText}>Scan Dikirim ke Gudang</Text>
          </TouchableOpacity>
        )}
        {canReceive && (
          <TouchableOpacity
            style={[s.bigBtn, { backgroundColor: '#059669' }]}
            onPress={() => setScanMode('receive')}
          >
            <Text style={s.btnText}>Scan Diterima Gudang</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hardware Barcode Scanner Bar (Pilihan A: Pintar per role) */}
      {(canShip || canReceive) && (
        <View style={scanBarStyle.wrap}>
          <View style={scanBarStyle.row}>
            <TextInput
              ref={scanInputRef}
              style={[s.input, scanBarStyle.input]}
              placeholder={
                isWarehouse
                  ? "Scan barcode / AWB untuk Diterima Gudang lalu Enter..."
                  : "Scan barcode / AWB me Dikirim ke Gudang lalu Enter..."
              }
              placeholderTextColor={colors.faint}
              value={scanInput}
              onChangeText={setScanInput}
              onSubmitEditing={submitHardwareScan}
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
            Scanner hardware: cukup arahkan & tekan trigger berulang — otomatis memproses {isWarehouse ? 'Diterima Gudang' : 'Dikirim ke Gudang'}.
          </Text>
        </View>
      )}
      <Text style={s.sectionTitle}>
        {searching ? `Hasil pencarian "${q.trim()}" (${total})` : `Cancel / Retur (${total})`}
      </Text>
      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={{ page, total, onPage: setPage }}
        rowAction={rowAction}
        onSearchQuery={setQ}
        onColumnFilterChange={setColFilters}
        tab="cancelretur"
      />
      <ScannerModal
        visible={!!scanMode}
        onClose={() => setScanMode(null)}
        onScanned={onScanned}
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
