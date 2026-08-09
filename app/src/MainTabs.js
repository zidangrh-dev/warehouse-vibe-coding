import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from './Icon';
import { colors, shadow, spacing, confirmAsync } from './theme';
import { useBreakpoint } from './responsive';
import { ScanPaketScreen, SelfPickupScreen, GojekScreen, CancelReturScreen, SemuaScreen, ArsipScreen } from './screens/index';
import DashboardScreen from './DashboardScreen';

// Tab yang tampil menyesuaikan role user.
const ALL_TABS = [
  { key: 'scan', icon: 'box', label: 'Scan', roles: ['superadmin', 'admin', 'warehouse'], Screen: ScanPaketScreen },
  { key: 'selfpickup', icon: 'user', label: 'Self Pick Up', roles: ['superadmin', 'admin', 'sales'], Screen: SelfPickupScreen },
  { key: 'gojek', icon: 'scooter', label: 'Gojek', roles: ['superadmin', 'admin', 'sales'], Screen: GojekScreen },
  { key: 'cancelretur', icon: 'rotate', label: 'Cancel/Retur', roles: ['superadmin', 'admin', 'sales'], Screen: CancelReturScreen },
  { key: 'semua', icon: 'list', label: 'Semua', roles: ['superadmin', 'admin', 'sales', 'warehouse'], Screen: SemuaScreen },
  { key: 'arsip', icon: 'box', label: 'Arsip Data', roles: ['superadmin'], Screen: ArsipScreen },
  { key: 'dashboard', icon: 'chart', label: 'Dashboard', roles: ['superadmin', 'admin', 'warehouse', 'sales'], Screen: DashboardScreen },
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

export default function MainTabs({ user, onLogout }) {
  const { isDesktop } = useBreakpoint();
  const tabs = ALL_TABS.filter((t) => t.roles.includes(user.role));
  const [active, setActive] = useState(tabs[0].key);
  const ActiveScreen = tabs.find((t) => t.key === active)?.Screen || SemuaScreen;
  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  // Pulihkan tab terakhir user (refresh web/Android tidak balik ke tab pertama).
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TAB_STORAGE_KEY);
        if (saved && tabs.some((t) => t.key === saved)) setActive(saved);
      } catch (e) {}
    })();
  }, []);

  const switchTab = (key) => {
    setActive(key);
    AsyncStorage.setItem(TAB_STORAGE_KEY, key).catch(() => {});
  };

  const logout = async () => {
    if (await confirmAsync('Keluar?', `Logout dari akun ${user.name}.`)) onLogout();
  };

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        <View style={s.sidebar}>
          <View style={s.brandRow}>
            <Image source={require('../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8 }} resizeMode="contain" />
            <Text style={s.brandText}>PickHub</Text>
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
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={s.userCard} onPress={logout}>
            <View style={s.avatarSm}><Text style={s.avatarSmText}>{initials}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.userName} numberOfLines={1}>{user.name}</Text>
              <Text style={s.userRole}>{ROLE_LABEL[user.role] || user.role}</Text>
            </View>
            <Icon name="logout" size={16} color={colors.faint} />
          </TouchableOpacity>
        </View>
        <View style={s.desktopBody}>
          <View style={s.desktopInner}>
            <ActiveScreen user={user} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>{greeting()},</Text>
          <Text style={s.name}>{user.name}</Text>
          <Text style={s.role}>{ROLE_LABEL[user.role] || user.role} · PickHub</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('../assets/icon.png')} style={{ width: 34, height: 34, borderRadius: 8 }} resizeMode="contain" />
          <TouchableOpacity style={s.avatar} onPress={logout}>
            <Text style={s.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <View style={s.body}>
          <ActiveScreen user={user} />
        </View>
      </View>

      <View style={s.tabBar}>
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, isActive && s.tabActive]}
              onPress={() => switchTab(t.key)}
            >
              <Icon name={t.icon} size={17} color={isActive ? colors.primary : colors.sub} />
              {isActive && <Text style={s.tabLabel}>{t.label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
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
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8, paddingHorizontal: 8, gap: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10,
  },
  tabActive: { backgroundColor: colors.primarySoft, flex: 1.6 },
  tabLabel: { color: colors.primary, fontWeight: '700', fontSize: 12 },

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
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
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
});
