import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { FONT_SOURCES } from '@/constants/fonts';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PracticumProvider } from '@/context/PracticumContext';
import { AssistantSessionsProvider } from '@/features/assistant/state/assistant-sessions-context';
import { PushNotificationProvider } from '@/features/notifications/state/push-notification-context';

// Tahan splash screen sampai status login selesai dipulihkan.
// Dipanggil di global scope, tanpa await (sesuai dokumentasi Expo SDK 58).
SplashScreen.preventAutoHideAsync();

function SplashScreenController({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useAuth();

  // Splash ditutup setelah status login pulih dan font Inter selesai dimuat.
  useEffect(() => {
    if (status !== 'loading' && fontsReady) {
      SplashScreen.hide();
    }
  }, [status, fontsReady]);

  return null;
}

function RootNavigator() {
  const { status, role } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const isLoggedIn = status === 'authenticated';
  const isAslab =
    isLoggedIn &&
    typeof role === 'string' &&
    role.trim().toUpperCase() === 'ASLAB';
  const isAssistant = isLoggedIn && role === 'asisten';

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
        <Stack.Screen name="attendance/[sessionId]" />
      </Stack.Protected>

      {/* Navigasi khusus Aslab (FR-01, FR-03) */}
      <Stack.Protected
        guard={isAslab}
        redirectTo={isLoggedIn ? '/(tabs)/schedule' : '/login'}
      >
        <Stack.Screen name="aslab" />
      </Stack.Protected>

      {/* Navigasi khusus Asisten (Praktikan diarahkan kembali ke Jadwal) */}
      <Stack.Protected
        guard={isAssistant}
        redirectTo={isLoggedIn ? '/(tabs)/schedule' : '/login'}
      >
        <Stack.Screen name="assistant" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  // Bila font gagal dimuat, aplikasi tetap jalan dengan font bawaan.
  const fontsReady = fontsLoaded || fontError != null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <SplashScreenController fontsReady={fontsReady} />
        <PushNotificationProvider>
          <PracticumProvider>
            <AssistantSessionsProvider>
              {fontsReady ? <RootNavigator /> : null}
            </AssistantSessionsProvider>
          </PracticumProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}