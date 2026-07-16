import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadow, confirmAsync } from './theme';
import { ScanPaketScreen, CustomerScreen, GojekScreen, SemuaScreen } from './screens';

// Tab yang tampil menyesuaikan role user.
const ALL_TABS = [
  { key: 'scan', icon: '📥', label: 'Scan', roles: ['admin', 'warehouse'], Screen: ScanPaketScreen },
  { key: 'customer', icon: '🧍', label: 'Customer', roles: ['admin', 'sales'], Screen: CustomerScreen },
  { key: 'gojek', icon: '🛵', label: 'Gojek', roles: ['admin', 'sales'], Screen: GojekScreen },
  { key: 'semua', icon: '📋', label: 'Semua', roles: ['admin', 'sales', 'warehouse'], Screen: SemuaScreen },
];

const ROLE_LABEL = { admin: 'Admin Kios', sales: 'Sales', warehouse: 'Warehouse' };

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export default function MainTabs({ user, onLogout }) {
  const tabs = ALL_TABS.filter((t) => t.roles.includes(user.role));
  const [active, setActive] = useState(tabs[0].key);
  const ActiveScreen = tabs.find((t) => t.key === active)?.Screen || SemuaScreen;
  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const logout = async () => {
    if (await confirmAsync('Keluar?', `Logout dari akun ${user.name}.`)) onLogout();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>{greeting()},</Text>
          <Text style={s.name}>{user.name}</Text>
          <Text style={s.role}>{ROLE_LABEL[user.role] || user.role} · Gudang Board</Text>
        </View>
        <TouchableOpacity style={s.avatar} onPress={logout}>
          <Text style={s.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={{ flex: 1, marginTop: -18 }}>
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
              onPress={() => setActive(t.key)}
            >
              <Text style={{ fontSize: 17 }}>{t.icon}</Text>
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
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34,
  },
  hello: { color: '#C7D2FE', fontSize: 13, fontWeight: '600' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 1 },
  role: { color: '#C7D2FE', fontSize: 12, marginTop: 3, fontWeight: '600' },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  body: {
    flex: 1, backgroundColor: colors.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
  },
  tabBar: {
    position: 'absolute', left: 16, right: 16, bottom: 14,
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: 999, padding: 6, gap: 4, ...shadow.float,
  },
  tab: {
    flex: 1, flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, borderRadius: 999,
  },
  tabActive: { backgroundColor: colors.primarySoft, flex: 1.6 },
  tabLabel: { color: colors.primary, fontWeight: '800', fontSize: 13 },
});
