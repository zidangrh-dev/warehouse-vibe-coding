import { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from './Icon';
import { shadow, spacing, radius, confirmAsync, notice, useTheme } from './theme';
import { api, getSocket, MARKETPLACE_NOTICE } from './api';
import MarketplaceScreen, { healthLevel } from './MarketplaceScreen';
import { useBreakpoint } from './responsive';
import { ScanPaketScreen, SelfPickupScreen, GojekScreen, CancelReturScreen, SemuaScreen, KanbanScreen, BuybackScreen } from './screens/index';
import DashboardScreen from './DashboardScreen';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ThemeToggle } from './ThemeToggle';

// Tab yang tampil menyesuaikan role user.
const ALL_TABS = [
  { key: 'scan', icon: 'box', label: 'Scan', roles: ['superadmin', 'admin', 'warehouse'], Screen: ScanPaketScreen },
  { key: 'selfpickup', icon: 'user', label: 'Self Pick Up', roles: ['superadmin', 'admin', 'sales'], Screen: SelfPickupScreen },
  { key: 'gojek', icon: 'scooter', label: 'Gojek', roles: ['superadmin', 'admin', 'sales'], Screen: GojekScreen },
  { key: 'buyback', icon: 'archive', label: 'Buyback', roles: ['superadmin', 'admin'], Screen: BuybackScreen },
  { key: 'cancelretur', icon: 'rotate', label: 'Cancel/Retur', roles: ['superadmin', 'admin', 'sales', 'warehouse'], Screen: CancelReturScreen },
  { key: 'semua', icon: 'list', label: 'Semua', roles: ['superadmin', 'admin', 'sales', 'warehouse'], Screen: SemuaScreen },
  { key: 'kanban', icon: 'columns', label: 'Kanban', roles: ['superadmin', 'admin'], Screen: KanbanScreen },
  { key: 'dashboard', icon: 'chart', label: 'Dashboard', roles: ['superadmin', 'admin', 'warehouse', 'sales'], Screen: DashboardScreen },
  { key: 'marketplace', icon: 'store', label: 'Marketplace', roles: ['superadmin', 'sales'], Screen: MarketplaceScreen },
];

const ROLE_LABEL = { superadmin: 'Super Admin', admin: 'Admin Kios', sales: 'Sales', warehouse: 'Warehouse' };

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

const TAB_STORAGE_KEY = 'gudang_active_tab';

// Jumlah toko marketplace yang perlu dicek, diperbarui realtime. Toast saat jumlahnya naik.
function useMarketplaceIssues(enabled) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const load = async () => {
      try {
        const { shops } = await api.marketplaceShops();
        const n = shops.filter((sh) => healthLevel(sh) !== 'ok').length;
        if (n > prev.current) notice(`${n} toko marketplace perlu dicek`, 'error');
        prev.current = n;
        setCount(n);
      } catch (e) {}
    };
    load();
    const socket = getSocket();
    socket.on('marketplace:changed', load);
    socket.on('connect', load);
    // Interval: mendeteksi status basi kalau pengecekan server berhenti (tidak ada event).
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      socket.off('marketplace:changed', load);
      socket.off('connect', load);
      clearInterval(timer);
    };
  }, [enabled]);
  return count;
}

export default function MainTabs({ user, onLogout }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { isDesktop, isUltraWide } = useBreakpoint();
  const tabs = ALL_TABS.filter((t) => t.roles?.includes(user?.role));
  const [active, setActive] = useState(() => (tabs[0]?.key || 'semua'));
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const ActiveScreen = tabs.find((t) => t.key === active)?.Screen || SemuaScreen;
  const mpIssues = useMarketplaceIssues(['superadmin', 'sales'].includes(user?.role));

  // Hasil permintaan driver yang diulang server setelah sempat terputus.
  useEffect(() => {
    if (!['superadmin', 'admin'].includes(user?.role)) return undefined;
    const socket = getSocket();
    const onDriver = ({ mode, message }) => notice(message, MARKETPLACE_NOTICE[mode] || 'info');
    socket.on('marketplace:driver', onDriver);
    return () => socket.off('marketplace:driver', onDriver);
  }, [user?.role]);

  const userName = user?.name || user?.display_name || user?.username || 'User';
  const initials = userName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  // Pulihkan tab terakhir user (refresh web/Android tidak balik ke tab pertama).
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TAB_STORAGE_KEY);
        if (saved && tabs.some((t) => t.key === saved)) setActive(saved);
      } catch (e) {}
    })();
  }, []);

  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateY = useRef(new Animated.Value(0)).current;
  const prevTabRef = useRef(active);

  useEffect(() => {
    if (prevTabRef.current !== active) {
      screenOpacity.setValue(0);
      screenTranslateY.setValue(6);
      Animated.parallel([
        Animated.timing(screenOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(screenTranslateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      prevTabRef.current = active;
    }
  }, [active]);

  const switchTab = (key) => {
    setActive(key);
    AsyncStorage.setItem(TAB_STORAGE_KEY, key).catch(() => {});
  };

  const logout = async () => {
    if (await confirmAsync('Keluar?', `Logout dari akun ${userName}.`)) onLogout();
  };

  const mpBanner = mpIssues > 0 && active !== 'marketplace' && (
    <TouchableOpacity style={s.alertBanner} onPress={() => switchTab('marketplace')} accessibilityRole="button">
      <Icon name="alert" size={16} color={colors.dangerText} />
      <Text style={s.alertText}>{mpIssues} toko marketplace perlu dicek. Cari Driver bisa gagal untuk toko ini.</Text>
      <Text style={s.alertLink}>Lihat</Text>
    </TouchableOpacity>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        <View style={s.sidebar}>
          <View style={s.brandRow}>
            <Image source={require('../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8 }} resizeMode="contain" />
            <Text style={s.brandText}>PickHub</Text>
            <View style={{ flex: 1 }} />
            <ThemeToggle style={s.themeBtn} />
          </View>
          <View style={{ flex: 1, marginTop: spacing.lg }}>
            {tabs.map((t) => {
              const isActive = active === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[s.navItem, isActive && s.navItemActive]}
                  onPress={() => switchTab(t.key)}
                >
                  <Icon name={t.icon} size={18} color={isActive ? colors.primary : colors.sub} />
                  <Text style={[s.navLabel, isActive && s.navLabelActive]}>{t.label}</Text>
                  {t.key === 'marketplace' && mpIssues > 0 && (
                    <View style={s.navCount}><Text style={s.navCountText}>{mpIssues}</Text></View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.userCardCol}>
            <View style={s.userCardHead}>
              <View style={s.avatarSm}><Text style={s.avatarSmText}>{initials}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.userName} numberOfLines={1}>{userName}</Text>
                <Text style={s.userRole}>{ROLE_LABEL[user?.role] || user?.role}</Text>
              </View>
            </View>
            <View style={s.userCardActions}>
              <TouchableOpacity style={s.userActionBtn} onPress={() => setPwdModalOpen(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="key" size={11} color={colors.ink} strokeWidth={2.5} />
                  <Text style={s.userActionBtnText}>Ganti Password</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[s.userActionBtn, { backgroundColor: colors.dangerBg }]} onPress={logout}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="logout" size={11} color={colors.danger} strokeWidth={2.5} />
                  <Text style={[s.userActionBtnText, { color: colors.danger }]}>Log Out</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={s.desktopBody}>
          <View style={[s.desktopInner, isUltraWide && s.desktopInnerUltraWide]}>
            {mpBanner}
            <ActiveScreen user={user} />
          </View>
        </View>

        <ChangePasswordModal visible={pwdModalOpen} onClose={() => setPwdModalOpen(false)} />
      </View>
    );
  }

  const handleMobileAvatarPress = async () => {
    if (await confirmAsync('Pengaturan Akun', 'Pilih tindakan untuk akun Anda: OK = Ganti Password, Batal = Logout')) {
      setPwdModalOpen(true);
    } else {
      logout();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>{greeting()},</Text>
          <Text style={s.name}>{userName}</Text>
          <Text style={s.role}>{ROLE_LABEL[user?.role] || user?.role} · PickHub</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ThemeToggle style={s.themeBtn} />
          <Image source={require('../assets/icon.png')} style={{ width: 34, height: 34, borderRadius: 8 }} resizeMode="contain" />
          <TouchableOpacity style={s.avatar} onPress={handleMobileAvatarPress}>
            <Text style={s.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {mpBanner}
      <View style={s.body}>
        <Animated.View style={{ flex: 1, opacity: screenOpacity, transform: [{ translateY: screenTranslateY }] }}>
          <ActiveScreen user={user} />
        </Animated.View>
      </View>

      <View style={s.floatWrap} pointerEvents="box-none">
        <View style={s.floatBar}>
          {tabs.map((t) => {
            const isActive = active === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[s.tab, isActive && s.tabActive]}
                onPress={() => switchTab(t.key)}
                accessibilityLabel={t.label}
              >
                <Icon name={t.icon} size={isActive ? 22 : 19} color={isActive ? colors.primary : colors.sub} strokeWidth={isActive ? 2.4 : 2} />
                {t.key === 'marketplace' && mpIssues > 0 && <View style={s.tabDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ChangePasswordModal visible={pwdModalOpen} onClose={() => setPwdModalOpen(false)} />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  themeBtn: { backgroundColor: colors.surfaceAlt, borderRadius: 18 },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.lg, paddingVertical: 10,
    backgroundColor: colors.dangerBg, borderBottomWidth: 1, borderBottomColor: colors.dangerBorder,
  },
  alertText: { flex: 1, color: colors.dangerText, fontSize: 13, fontWeight: '600' },
  alertLink: { color: colors.dangerText, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  navCount: {
    marginLeft: 'auto', minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger,
  },
  navCountText: { color: colors.onDanger, fontSize: 11, fontWeight: '800' },
  tabDot: { position: 'absolute', top: 6, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  hello: { color: colors.sub, fontSize: 12, fontWeight: '600' },
  name: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 1 },
  role: { color: colors.sub, fontSize: 12, marginTop: 3, fontWeight: '600' },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  body: { flex: 1, backgroundColor: colors.bg },
  floatWrap: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
    alignItems: 'center', justifyContent: 'center', paddingBottom: 12,
  },
  floatBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 30,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 6, paddingHorizontal: 6, gap: 2,
    ...shadow.float,
  },
  tab: {
    flex: 1, minWidth: 38, maxWidth: 56,
    height: 42, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.primarySoft },

  // Sidebar desktop
  sidebar: {
    width: 232, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.sm },
  brandMark: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  brandText: { fontSize: 15, fontWeight: '800', color: colors.ink },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: 8, marginBottom: 2,
  },
  navItemActive: { backgroundColor: colors.primarySoft },
  navLabel: { color: colors.sub, fontWeight: '600', fontSize: 13.5 },
  navLabelActive: { color: colors.primary, fontWeight: '700' },
  userCardCol: {
    padding: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  userCardHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  userCardActions: {
    gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border,
  },
  userActionBtn: {
    paddingVertical: 5, paddingHorizontal: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt, alignItems: 'center',
  },
  userActionBtnText: {
    fontSize: 11, fontWeight: '700', color: colors.ink,
  },
  avatarSm: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  userName: { color: colors.ink, fontWeight: '700', fontSize: 12.5 },
  userRole: { color: colors.faint, fontSize: 11 },
  desktopBody: { flex: 1, ...shadow.card },
  desktopInner: { flex: 1, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  desktopInnerUltraWide: { maxWidth: '100%', paddingHorizontal: spacing.xxl },
});