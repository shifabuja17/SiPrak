import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PracticumProvider } from '@/context/PracticumContext';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <PracticumProvider>
        <AnimatedSplashOverlay />

        <Stack screenOptions={{ headerShown: false }}>
          {/* Layar awal: pilih peran dan identitas */}
          <Stack.Screen name="index" />

          {/* Navigasi utama aplikasi */}
          <Stack.Screen name="(tabs)" />

          {/* Halaman pendukung */}
          <Stack.Screen
            name="role-switcher"
            options={{ presentation: 'modal' }}
          />

          <Stack.Screen name="session/[id]" />
        </Stack>
      </PracticumProvider>
    </ThemeProvider>
  );
}