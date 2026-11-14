import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PracticumProvider } from '@/context/PracticumContext';
import { AssistantSessionsProvider } from '@/features/assistant/state/assistant-sessions-context';

// Tahan splash screen sampai status login selesai dipulihkan.
// Dipanggil di global scope, tanpa await (sesuai dokumentasi Expo SDK 58).
SplashScreen.preventAutoHideAsync();

function SplashScreenController() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hide();
    }
  }, [status]);

  return null;
}

function RootNavigator() {
  const { status } = useAuth();
  const isLoggedIn = status === 'authenticated';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Hanya untuk pengguna yang belum login */}
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>

      {/* Hanya untuk pengguna yang sudah login */}
      <Stack.Protected guard={isLoggedIn}>
        {/* Pintu masuk: mengarahkan ke tab Jadwal */}
        <Stack.Screen name="index" />

        {/* Navigasi utama aplikasi */}
        <Stack.Screen name="(tabs)" />

        {/* Halaman pendukung */}
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="assistant/index" />
        <Stack.Screen name="assistant/session/[sessionId]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <SplashScreenController />
        <PracticumProvider>
          <AssistantSessionsProvider>
            <RootNavigator />
          </AssistantSessionsProvider>
        </PracticumProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}