import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { api, getSocket } from "./api";
import {
  colors,
  spacing,
  radius,
  shadow,
  STATUS_META,
  statusLabel,
  statusColor,
  notice,
} from "./theme";
import {
  StatCard,
  SectionCard,
  ThroughputChart,
  SimpleDonutChart,
} from "./components";
import { useBreakpoint } from "./responsive";
import Icon from "./Icon";
import UserManagementModal from "./UserManagementModal";
import { ArchiveModal } from "./ArchiveModal";
import { CalendarInput } from "./CalendarInput";

const GOJEK_FUNNEL = [
  "absen_gojek",
  "mencari_driver",
  "driver_sampai_kios",
  "done_pickup",
  "selesai",
  "retur",
];
const ACTIVITY_ACTIONS = [
  "scan_sampai",
  "input_manual",
  "generate_code",
  "diambil_customer",
  "update",
  "foto",
];
const ACTIVITY_LABEL = {
  scan_sampai: "Scan",
  input_manual: "Manual",
  generate_code: "Kode",
  diambil_customer: "Diambil",
  update: "Update",
  foto: "Foto",
};

// Data agregat untuk panel Dashboard — 3 endpoint terpisah supaya tiap
// panel bisa loading independen dan query SQL tetap sederhana.
function useDashboard(startDate, endDate) {
  const [summary, setSummary] = useState(null);
  const [throughput, setThroughput] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const refetch = useCallback(async () => {
    try {
      const dateFilter = { startDate, endDate };
      const [sum, thr, act] = await Promise.all([
        api.dashboardSummary(dateFilter),
        api.dashboardThroughput(dateFilter),
        api.dashboardActivity(dateFilter),
      ]);
      setSummary(sum);
      setThroughput(thr);
      setActivity(act);
    } catch (e) {
      notice(`Gagal memuat dashboard: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    refetch();
    const socket = getSocket();
    const onChanged = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(refetch, 500);
    };
    socket.on("packages:changed", onChanged);
    return () => {
      socket.off("packages:changed", onChanged);
      clearTimeout(timer.current);
    };
  }, [refetch]);

  return { summary, throughput, activity, loading, refetch };
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m} mnt`;
  return `${h}j ${m}m`;
}

function pivotActivity(rows) {
  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.user_name))
      byUser.set(r.user_name, {
        user_name: r.user_name,
        role: r.role,
        total: 0,
      });
    const entry = byUser.get(r.user_name);
    entry[r.action] = (entry[r.action] || 0) + r.n;
    entry.total += r.n;
  }
  return [...byUser.values()].sort((a, b) => b.total - a.total);
}

const ROLE_TINT = {
  admin: colors.primary,
  sales: "#7C3AED",
  warehouse: "#0891B2",
};

export default function DashboardScreen({ user }) {
  const { columns } = useBreakpoint();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);

  const { summary, throughput, activity, loading, refetch } = useDashboard(startDate, endDate);

  if (loading && !summary) {
    return (
      <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
    );
  }

  const byStatusMap = new Map(
    (summary?.by_status || []).map((r) => [r.status, r.n]),
  );
  const totalAll = [...byStatusMap.values()].reduce((a, b) => a + b, 0);

  const donutData = Object.keys(STATUS_META)
    .map((key) => ({
      label: statusLabel(key),
      value: byStatusMap.get(key) || 0,
      color: statusColor(key),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const funnelMax = Math.max(
    1,
    ...GOJEK_FUNNEL.map((k) => byStatusMap.get(k) || 0),
  );

  const throughputSeries = throughput.map((d) => ({
    label: new Date(d.day).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    }),
    value: d.received,
  }));
  const throughputTotal = throughputSeries.reduce((a, d) => a + d.value, 0);
  const throughputPeak = Math.max(0, ...throughputSeries.map((d) => d.value));

  const activityRows = pivotActivity(activity);
  const actMax = Math.max(
    1,
    ...activityRows.flatMap((r) => ACTIVITY_ACTIONS.map((a) => r[a] || 0)),
  );
  const heatColor = (v) => {
    if (!v) return colors.surfaceAlt;
    const alpha = Math.round((0.14 + 0.66 * (v / actMax)) * 255)
      .toString(16)
      .padStart(2, "0");
    return colors.primary + alpha;
  };

  const statCols = columns >= 4 ? 4 : columns >= 2 ? 2 : 1;
  const statWidth = `${100 / statCols}%`;

  const stats = [
    {
      label: "Paket hari ini",
      value: summary?.today ?? 0,
      icon: "box",
      accent: colors.primary,
    },
    {
      label: "Paket di rentang tanggal",
      value: summary?.week ?? 0,
      icon: "chart",
      accent: "#7C3AED",
    },
    {
      label: "Pending (belum selesai)",
      value: summary?.pending ?? 0,
      icon: "list",
      accent: colors.warn,
    },
    {
      label: "Rata-rata waktu ambil",
      value: formatDuration(summary?.avg_pickup_seconds),
      icon: "scooter",
      accent: colors.ok,
      sub: `${summary?.gojek_active ?? 0} gojek aktif`,
    },
  ];

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
    >
      <View style={s.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Dashboard</Text>
          <Text style={s.subtitle}>
            Pantau proses paket & kinerja tim secara realtime.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {user?.role === 'superadmin' && (
            <>
              <TouchableOpacity
                style={[s.dayBtn, { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 14 }]}
                onPress={() => setUserModalOpen(true)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>👥 Kelola Karyawan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.dayBtn, { backgroundColor: colors.danger, paddingVertical: 8, paddingHorizontal: 14 }]}
                onPress={() => setArchiveModalOpen(true)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>📦 Arsip Data</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Filter Tanggal Langsung & Ringkas di Header */}
          <View style={s.filterHeaderCard}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="calendar" size={16} color={colors.primary} />
            )}
            <CalendarInput value={startDate} onChange={setStartDate} />
            <Text style={s.filterDivider}>s/d</Text>
            <CalendarInput value={endDate} onChange={setEndDate} />
          </View>
        </View>
      </View>

      <UserManagementModal
        visible={userModalOpen}
        user={user}
        onClose={() => setUserModalOpen(false)}
      />

      <ArchiveModal
        visible={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        onArchived={refetch}
      />

      <View style={s.statGrid}>
        {stats.map((st) => (
          <View
            key={st.label}
            style={{ width: statWidth, padding: spacing.xs }}
          >
            <StatCard {...st} />
          </View>
        ))}
      </View>

      <View style={{ height: spacing.md }} />

      <View style={s.rowWrap}>
        <View style={s.colWide}>
          <SectionCard
            title="Throughput paket masuk"
            subtitle={`${startDate} s/d ${endDate}`}
            right={
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.bigNumber}>{throughputTotal}</Text>
                <Text style={s.bigNumberSub}>
                  total · puncak {throughputPeak}/hari
                </Text>
              </View>
            }
          >
            {throughputSeries.length > 0 ? (
              <ThroughputChart data={throughputSeries} color={colors.primary} height={200} />
            ) : (
              <Text style={s.empty}>Belum ada data.</Text>
            )}
          </SectionCard>
        </View>

        <View style={s.colNarrow}>
          <SectionCard
            title="Proporsi status"
            subtitle="Seluruh paket saat ini"
          >
            <View style={s.donutWrap}>
              <SimpleDonutChart
                data={donutData}
                size={132}
                centerLabel={totalAll}
                centerSub="paket"
              />
              <View style={{ flex: 1, minWidth: 120 }}>
                {donutData.slice(0, 6).map((d) => (
                  <View key={d.label} style={s.legendRow}>
                    <View style={[s.legendDot, { backgroundColor: d.color }]} />
                    <Text style={s.legendText} numberOfLines={1}>
                      {d.label}
                    </Text>
                    <Text style={s.legendVal}>{d.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </SectionCard>
        </View>
      </View>

      <View style={{ height: spacing.md }} />

      <SectionCard
        title="Pipeline Gojek"
        subtitle="Jumlah paket per tahap saat ini"
      >
        {GOJEK_FUNNEL.map((key) => {
          const n = byStatusMap.get(key) || 0;
          const pct = (n / funnelMax) * 100;
          const c = statusColor(key);
          return (
            <View key={key} style={s.funnelRow}>
              <Text style={s.funnelLabel} numberOfLines={1}>
                {statusLabel(key)}
              </Text>
              <View style={s.funnelTrack}>
                <View
                  style={[
                    s.funnelFill,
                    { width: `${Math.max(2, pct)}%`, backgroundColor: c },
                  ]}
                />
              </View>
              <Text
                style={[
                  s.funnelValue,
                  { color: n > 0 ? colors.ink : colors.faint },
                ]}
              >
                {n}
              </Text>
            </View>
          );
        })}
      </SectionCard>

      <View style={{ height: spacing.md }} />

      <SectionCard
        title="Aktivitas per user"
        subtitle="Rentang tanggal terpilih"
      >
        {activityRows.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={s.heatHeadRow}>
                <View style={{ width: 150 }} />
                {ACTIVITY_ACTIONS.map((a) => (
                  <Text key={a} style={s.heatHeadText}>
                    {ACTIVITY_LABEL[a]}
                  </Text>
                ))}
                <Text style={[s.heatHeadText, { fontWeight: "800" }]}>
                  Total
                </Text>
              </View>
              {activityRows.map((row) => (
                <View key={row.user_name} style={s.heatRow}>
                  <View style={s.heatUser}>
                    <View
                      style={[
                        s.roleDot,
                        {
                          backgroundColor: ROLE_TINT[row.role] || colors.faint,
                        },
                      ]}
                    />
                    <Text style={s.heatUserText} numberOfLines={1}>
                      {row.user_name}
                    </Text>
                  </View>
                  {ACTIVITY_ACTIONS.map((a) => {
                    const v = row[a] || 0;
                    return (
                      <View
                        key={a}
                        style={[s.heatCell, { backgroundColor: heatColor(v) }]}
                      >
                        <Text
                          style={[
                            s.heatCellText,
                            {
                              color:
                                v > actMax * 0.55
                                  ? "#fff"
                                  : v
                                    ? colors.ink
                                    : colors.faint,
                            },
                          ]}
                        >
                          {v || ""}
                        </Text>
                      </View>
                    );
                  })}
                  <Text style={s.heatTotal}>{row.total}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text style={s.empty}>
            Belum ada aktivitas dalam rentang tanggal terpilih.
          </Text>
        )}
      </SectionCard>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  subtitle: { color: colors.sub, fontSize: 13, marginTop: 3 },
  daySwitch: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
  },
  dayBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill - 2,
  },
  dayBtnActive: { backgroundColor: colors.primary },
  dayBtnText: { color: colors.sub, fontWeight: "700", fontSize: 12 },
  dayBtnTextActive: { color: "#fff", fontWeight: "700" },

  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },

  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  colWide: { flexGrow: 2, flexBasis: 340, minWidth: 280 },
  colNarrow: { flexGrow: 1, flexBasis: 280, minWidth: 250 },

  bigNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  bigNumberSub: { fontSize: 10.5, color: colors.faint, marginTop: 1 },

  donutWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontSize: 12.5, color: colors.sub, flex: 1 },
  legendVal: { fontSize: 12.5, color: colors.ink, fontWeight: "700" },

  funnelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 11,
    gap: 12,
  },
  funnelLabel: {
    width: 130,
    fontSize: 12.5,
    color: colors.sub,
    fontWeight: "600",
  },
  funnelTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  funnelFill: { height: "100%", borderRadius: 6 },
  funnelValue: {
    width: 34,
    textAlign: "right",
    fontWeight: "800",
    fontSize: 13,
  },

  heatHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
  },
  heatHeadText: {
    width: 62,
    fontSize: 10,
    fontWeight: "700",
    color: colors.sub,
    textTransform: "uppercase",
    textAlign: "center",
  },
  heatRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  heatUser: {
    width: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingRight: 8,
  },
  roleDot: { width: 8, height: 8, borderRadius: 4 },
  heatUserText: {
    fontSize: 12.5,
    color: colors.ink,
    fontWeight: "600",
    flex: 1,
  },
  heatCell: {
    width: 62,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  heatCellText: { fontSize: 12, fontWeight: "700" },
  heatTotal: {
    width: 44,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 13,
    color: colors.ink,
  },

  empty: { color: colors.faint, textAlign: "center", padding: 20 },
  filterHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    ...shadow.card,
  },
  filterDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.sub,
    paddingHorizontal: 2,
  },
});
