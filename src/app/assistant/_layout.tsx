import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { AssistantSessionsProvider } from '@/features/assistant/state/assistant-sessions-context';

export default function AssistantLayout() {
  const { loading, status, role } = useAuth();

  if (!loading && status === 'authenticated' && role !== 'asisten') {
    return <Redirect href="/(tabs)/schedule" />;
  }

  return (
    <AssistantSessionsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="classes" />
        <Stack.Screen name="schedules" />
        <Stack.Screen name="sessions" />
        <Stack.Screen name="leave-requests" />
        <Stack.Screen name="laboratories" />

        <Stack.Screen name="class-members/[classId]" />
        <Stack.Screen name="session/[sessionId]" />
      </Stack>
    </AssistantSessionsProvider>
  );
}