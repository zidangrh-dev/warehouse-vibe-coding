import { useEffect, useState, useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, View, Platform, PanResponder } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { loadSession, logout, setUnauthorizedHandler } from './src/api';
import LoginScreen from './src/LoginScreen';
import MainTabs from './src/MainTabs';
import { colors, notice } from './src/theme';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 Menit idle timeout (Auto Logout saat tidak ada aktivitas)

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const idleTimerRef = useRef(null);

  const doLogout = useCallback(async (isIdle = false) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    await logout();
    setUser(null);
    if (isIdle) {
      notice('Sesi Anda telah berakhir karena tidak ada aktivitas (Auto Logout).');
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!user) return;
    idleTimerRef.current = setTimeout(() => {
      doLogout(true);
    }, IDLE_TIMEOUT_MS);
  }, [user, doLogout]);

  useEffect(() => {
    loadSession()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
    setUnauthorizedHandler(() => { doLogout(false); });
  }, [doLogout]);

  useEffect(() => {
    if (!user) return;
    resetIdleTimer();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
      const handleActivity = () => resetIdleTimer();
      events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
      return () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        events.forEach((ev) => window.removeEventListener(ev, handleActivity));
      };
    }
  }, [user, resetIdleTimer]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        resetIdleTimer();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        resetIdleTimer();
        return false;
      },
    })
  ).current;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} {...(user ? panResponder.panHandlers : {})}>
        <StatusBar style="dark" />
        {!ready ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : user ? (
          <MainTabs user={user} onLogout={() => doLogout(false)} />
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
