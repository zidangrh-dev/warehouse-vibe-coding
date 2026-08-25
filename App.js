import { useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { loadSession, logout, setUnauthorizedHandler } from './src/api';
import LoginScreen from './src/LoginScreen';
import MainTabs from './src/MainTabs';
import { colors } from './src/theme';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Scrollbar modern ramping & auto-hide ala macOS */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.35);
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(71, 85, 105, 0.75);
    }
  `;
  document.head.appendChild(styleEl);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const doLogout = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  useEffect(() => {
    loadSession()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
    setUnauthorizedHandler(() => { doLogout(); });
  }, [doLogout]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
      <Toast />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.header },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
