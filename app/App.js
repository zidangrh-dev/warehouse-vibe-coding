import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { loadSession, logout, setUnauthorizedHandler } from './src/api';
import LoginScreen from './src/LoginScreen';
import MainTabs from './src/MainTabs';
import { colors } from './src/theme';

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSession().then((u) => { setUser(u); setReady(true); });
    setUnauthorizedHandler(() => { logout(); setUser(null); });
  }, []);

  const doLogout = async () => { await logout(); setUser(null); };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        {!ready ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : user ? (
          <MainTabs user={user} onLogout={doLogout} />
        ) : (
          <LoginScreen onLogin={setUser} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.header },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
