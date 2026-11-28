import { Stack } from 'expo-router';

import AslabRoleGuard from '@/components/auth/aslab-role-guard';

/**
 * Navigator khusus untuk peran Asisten Lab (ASLAB).
 */
export default function AslabNavigator() {
  return (
    <AslabRoleGuard featureName="Portal Aslab">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AslabRoleGuard>
  );
}
