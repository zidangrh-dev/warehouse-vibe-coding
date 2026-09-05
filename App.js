import { useEffect, useState, useCallback, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, View, Platform, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { loadSession, logout, setUnauthorizedHandler } from './src/api';
import LoginScreen from './src/LoginScreen';
import MainTabs from './src/MainTabs';
import { ThemeProvider, useTheme } from './src/theme';

function scrollbarCss(isDark) {
  return `
    /* Scrollbar modern ramping & auto-hide ala macOS */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.35)'};
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: ${isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(71, 85, 105, 0.75)'};
    }
  `;
}

function ToastCard({ text1, accent, bg, fg }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: bg, borderWidth: 1, borderColor: accent, borderLeftWidth: 4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 12, marginTop: 6, maxWidth: 420, alignSelf: 'center', width: '100%' }}>
      <Text style={{ color: fg, fontSize: 13, fontWeight: '700', flex: 1 }}>{text1}</Text>
    </View>
  );
}

function ThemedApp() {
  const { colors: c, isDark } = useTheme();
  const styleElRef = useRef(null);
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

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!styleElRef.current) {
      styleElRef.current = document.createElement('style');
      document.head.appendChild(styleElRef.current);
    }
    styleElRef.current.textContent = scrollbarCss(isDark);
    document.body.style.background = isDark ? c.bg : '#F7F8FA';
  }, [isDark, c]);

  const toastConfig = {
    success: ({ text1 }) => <ToastCard text1={text1} accent={c.ok} bg={c.okBg} fg={c.okText} />,
    error: ({ text1 }) => <ToastCard text1={text1} accent={c.danger} bg={c.dangerBg} fg={c.dangerText} />,
    info: ({ text1 }) => <ToastCard text1={text1} accent={c.primary} bg={c.blueBg} fg={c.ink} />,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.header }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!ready ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : user ? (
        <MainTabs user={user} onLogout={doLogout} />
      ) : (
        <LoginScreen onLogin={setUser} />
      )}
      <Toast config={toastConfig} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});