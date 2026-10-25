import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import { useColorScheme } from 'react-native';

import { PracticumProvider } from '@/context/PracticumContext';
import { AssistantSessionsProvider } from '@/features/assistant/state/assistant-sessions-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <PracticumProvider>
        <AssistantSessionsProvider>
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
            <Stack.Screen name="assistant/index" />
            <Stack.Screen name="assistant/session/[sessionId]" />
          </Stack>
        </AssistantSessionsProvider>
      </PracticumProvider>
    </ThemeProvider>
  );
}
