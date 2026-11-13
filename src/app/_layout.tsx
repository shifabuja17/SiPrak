import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import { useColorScheme } from 'react-native';

import { PracticumProvider } from '@/context/PracticumContext';
import { AssistantSessionsProvider } from '@/features/assistant/state/assistant-sessions-context';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <PracticumProvider>
          <AssistantSessionsProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="role-switcher"
                options={{ presentation: 'modal' }}
              />
              <Stack.Screen name="session/[id]" />

              {/* Navigasi khusus Asisten */}
              <Stack.Screen name="assistant" />
            </Stack>
          </AssistantSessionsProvider>
        </PracticumProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}