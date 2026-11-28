import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AccountInfoCard from '@/components/common/account-info-card';
import LogoutAction from '@/components/common/logout-action';
import PersonIcon from '@/components/common/person-icon';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { ScreenTitle, TAB_BAR_SPACE } from '@/features/praktikan/ui/praktikan-ui';
import { getRoleLabel } from '@/types/user';

// ==========================================
// HALAMAN PROFIL ASISTEN
// ==========================================

export default function AssistantProfileScreen() {
  const { user, profile, loading, profileError } = useAuth();

  const displayName = profile?.nama?.trim() || 'Nama belum tersedia';

  const roleLabel = profile?.role ? getRoleLabel(profile.role) : 'Tidak diketahui';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.pageContent}>
          <ScreenTitle title="Profil" />

          {/* KARTU IDENTITAS */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <PersonIcon size={35} color="#FFFFFF" />
            </View>

            <Text style={styles.profileName} numberOfLines={2}>
              {loading ? 'Memuat profil...' : displayName}
            </Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          </View>

          {/* INFO AKUN (sama dengan profil Praktikan) */}
          <AccountInfoCard
            nim={profile?.nim ?? '-'}
            email={profile?.email ?? user?.email ?? '-'}
          />

          {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

          <LogoutAction disabled={loading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// STYLE PROFIL
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },

  content: {
    // Ruang untuk navbar melayang.
    paddingBottom: TAB_BAR_SPACE,
  },

  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 19,
  },

  profileCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 12,
    paddingVertical: 8,
  },

  avatar: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 40,
    height: 75,
    justifyContent: 'center',
    width: 75,
  },

  profileName: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 19,
    textAlign: 'center',
  },

  roleBadge: {
    backgroundColor: '#F47321',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },

  roleText: {
    fontFamily: FONT.semibold,
    color: '#FFFFFF',
    fontSize: 12,
  },

  errorText: {
    fontFamily: FONT.regular,
    color: '#E00000',
    fontSize: 12,
    lineHeight: 18,
  },
});
