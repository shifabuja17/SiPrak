import { Redirect, Stack, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { AssistantSessionsProvider } from '@/features/assistant/state/assistant-sessions-context';
import { getHomeRouteForRole, isAsprakRole } from '@/types/user';

export default function AssistantLayout() {
  const { loading, status, role } = useAuth();

  if (!loading && status === 'authenticated' && !isAsprakRole(role)) {
    return <Redirect href={getHomeRouteForRole(role) as Href} />;
  }

  return (
    <AssistantSessionsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="classes" />
        <Stack.Screen name="sessions" />
        <Stack.Screen name="leave-requests" />
        <Stack.Screen name="laboratories" />

        <Stack.Screen name="class-members/[classId]" />
        <Stack.Screen name="session/[sessionId]" />
      </Stack>
    </AssistantSessionsProvider>
  );
}