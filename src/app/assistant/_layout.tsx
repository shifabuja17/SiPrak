import { Stack } from 'expo-router';

export default function AssistantLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="classes" />
      <Stack.Screen name="schedules" />
      <Stack.Screen name="sessions" />
      <Stack.Screen name="leave-requests" />
      <Stack.Screen name="class-members/[classId]" />
      <Stack.Screen name="session/[sessionId]" />
    </Stack>
  );
}