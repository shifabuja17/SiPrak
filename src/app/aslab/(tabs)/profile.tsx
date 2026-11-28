import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AccountInfoCard from '@/components/common/account-info-card';
import LogoutAction from '@/components/common/logout-action';
import PersonIcon from '@/components/common/person-icon';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { ScreenTitle, TAB_BAR_SPACE, UI } from '@/features/praktikan/ui/praktikan-ui';

export default function AslabProfileScreen() {
  const { user, profile, loading, profileError } = useAuth();
  const displayName = profile?.nama?.trim() || 'Nama belum tersedia';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.pageContent}>
          <ScreenTitle title="Profil Aslab" />

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <PersonIcon size={35} color="#FFFFFF" />
            </View>

            <Text style={styles.profileName} numberOfLines={2}>
              {loading ? 'Memuat profil...' : displayName}
            </Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Asisten Lab (Aslab)</Text>
            </View>
          </View>

          <AccountInfoCard
            nim={profile?.nim ?? '-'}
            email={profile?.email ?? user?.email ?? '-'}
          />

          {profileError ? (
            <Text style={styles.errorText}>{profileError}</Text>
          ) : null}

          <LogoutAction disabled={loading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: UI.page,
    flex: 1,
  },
  content: {
    paddingBottom: TAB_BAR_SPACE,
  },
  pageContent: {
    gap: 19,
    paddingHorizontal: UI.padding,
    paddingTop: 16,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: UI.page,
    borderRadius: 20,
    gap: 12,
    paddingVertical: 8,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: UI.ink,
    borderRadius: 40,
    height: 75,
    justifyContent: 'center',
    width: 75,
  },
  profileName: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 19,
    textAlign: 'center',
  },
  roleBadge: {
    backgroundColor: UI.accent,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  roleText: {
    color: UI.onColor,
    fontFamily: FONT.semibold,
    fontSize: 12,
  },
  errorText: {
    color: UI.danger,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});
