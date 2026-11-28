import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRootNavigationState,
  useRouter,
  useSegments,
  type Href,
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
import {
  getHomeRouteForRole,
  isAslabRole,
  isAsprakRole,
  isPraktikanRole,
} from '@/types/user';

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
  const isAslab = isLoggedIn && isAslabRole(role);
  const isAsprak = isLoggedIn && isAsprakRole(role);
  const isPraktikan = isLoggedIn && isPraktikanRole(role);
  const roleHomeRoute = (isLoggedIn ? getHomeRouteForRole(role) : '/login') as Href;

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

      {/* Pintu masuk & detail sesi bersama untuk pengguna yang sudah login */}
      <Stack.Protected guard={isLoggedIn} redirectTo="/login">
        <Stack.Screen name="index" />
        <Stack.Screen name="session/[id]" />
      </Stack.Protected>

      {/* Navigasi khusus Praktikan */}
      <Stack.Protected guard={isPraktikan} redirectTo={roleHomeRoute}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="attendance/[sessionId]" />
      </Stack.Protected>

      {/* Navigasi khusus Asprak (termasuk akun legacy ASISTEN) */}
      <Stack.Protected guard={isAsprak} redirectTo={roleHomeRoute}>
        <Stack.Screen name="assistant" />
      </Stack.Protected>

      {/* Navigasi khusus Aslab */}
      <Stack.Protected guard={isAslab} redirectTo={roleHomeRoute}>
        <Stack.Screen name="aslab" />
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