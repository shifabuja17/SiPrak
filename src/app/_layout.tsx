import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRootNavigationState,
  useRouter,
  useSegments,
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
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const isLoggedIn = status === 'authenticated';

  useEffect(() => {
    if (!navigationState?.key || status === 'loading') {
      return;
    }

    const firstSegment = segments[0];
    const inAuthScreen = firstSegment === 'login' || firstSegment === 'register';

    if (status === 'unauthenticated' && !inAuthScreen) {
      router.replace('/login');
      return;
    }

    if (status === 'authenticated' && inAuthScreen) {
      router.replace('/');
    }
  }, [navigationState?.key, router, segments, status]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Hanya untuk pengguna yang belum login */}
      <Stack.Protected guard={!isLoggedIn} redirectTo="/">
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>

      {/* Hanya untuk pengguna yang sudah login */}
      <Stack.Protected guard={isLoggedIn} redirectTo="/login">
        {/* Pintu masuk: mengarahkan ke tab Jadwal */}
        <Stack.Screen name="index" />

        {/* Navigasi utama aplikasi */}
        <Stack.Screen name="(tabs)" />

        {/* Halaman pendukung */}
        <Stack.Screen name="session/[id]" />

        {/* Navigasi khusus Asisten */}
        <Stack.Screen name="assistant" />
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