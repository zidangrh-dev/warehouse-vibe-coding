import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, confirmAsync } from './theme';
import { ScanPaketScreen, CustomerScreen, GojekScreen, SemuaScreen } from './screens';

// Tab yang tampil menyesuaikan role user.
const ALL_TABS = [
  { key: 'scan', label: '📥 Scan Paket', roles: ['admin', 'warehouse'], Screen: ScanPaketScreen },
  { key: 'customer', label: '🧍 Ambil Customer', roles: ['admin', 'sales'], Screen: CustomerScreen },
  { key: 'gojek', label: '🛵 Gojek', roles: ['admin', 'sales'], Screen: GojekScreen },
  { key: 'semua', label: '📋 Semua', roles: ['admin', 'sales', 'warehouse'], Screen: SemuaScreen },
];

export default function MainTabs({ user, onLogout }) {
  const tabs = ALL_TABS.filter((t) => t.roles.includes(user.role));
  const [active, setActive] = useState(tabs[0].key);
  const ActiveScreen = tabs.find((t) => t.key === active)?.Screen || SemuaScreen;

  const logout = async () => {
    if (await confirmAsync('Keluar?', `Logout dari akun ${user.name}.`)) onLogout();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.title}>📦 Gudang Board</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={s.user}>{user.name} ({user.role}) ⏻</Text>
        </TouchableOpacity>
      </View>
      <ActiveScreen user={user} />
      <View style={s.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.key} style={s.tab} onPress={() => setActive(t.key)}>
            <Text style={[s.tabText, active === t.key && s.tabActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.header, paddingHorizontal: 14, paddingVertical: 12,
  },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  user: { color: '#9fc3e8', fontWeight: '600', fontSize: 13 },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { color: colors.subtle, fontWeight: '600', fontSize: 12 },
  tabActive: { color: colors.accent, fontWeight: '800' },
});
