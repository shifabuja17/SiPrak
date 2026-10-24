import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AssistantSessionsProvider } from '@/features/assistant/state/assistant-sessions-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AssistantSessionsProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AssistantSessionsProvider>
    </ThemeProvider>
  );
}
