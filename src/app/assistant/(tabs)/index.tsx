import {
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Svg, {
  Circle,
  Path,
  Rect,
} from 'react-native-svg';

import { router, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

import { SessionCard } from '@/features/assistant/components/session-card';
import { useAssistantSessions } from '@/features/assistant/state/assistant-sessions-context';
import { TAB_BAR_SPACE } from '@/features/praktikan/ui/praktikan-ui';
import { FONT } from '@/constants/fonts';

// ==========================================
// ICON SVG
// ==========================================

function UsersIcon() {
  return (
    <Svg
      width={42}
      height={42}
      viewBox="0 0 48 48"
      fill="none"
    >
      <Circle
        cx="17"
        cy="15"
        r="6"
        stroke="#111014"
        strokeWidth={2.5}
      />

      <Circle
        cx="32"
        cy="17"
        r="5"
        stroke="#111014"
        strokeWidth={2.5}
      />

      <Path
        d="M5 38c0-7 5-12 12-12s12 5 12 12"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      <Path
        d="M29 28c7 0 12 4 13 10"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg
      width={42}
      height={42}
      viewBox="0 0 48 48"
      fill="none"
    >
      <Rect
        x="6"
        y="10"
        width="36"
        height="33"
        rx="4"
        stroke="#111014"
        strokeWidth={2.5}
      />

      <Path
        d="M6 19h36M16 6v9M32 6v9"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      <Path
        d="M15 27h4M27 27h4M15 35h4M27 35h4"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function AttendanceIcon() {
  return (
    <Svg
      width={42}
      height={42}
      viewBox="0 0 48 48"
      fill="none"
    >
      <Rect
        x="8"
        y="8"
        width="32"
        height="35"
        rx="4"
        stroke="#111014"
        strokeWidth={2.5}
      />

      <Path
        d="M17 5h14v8H17z"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      <Path
        d="m15 25 4 4 7-8M15 35h17"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LeaveIcon() {
  return (
    <Svg
      width={42}
      height={42}
      viewBox="0 0 48 48"
      fill="none"
    >
      <Path
        d="M11 5h19l9 9v12M30 5v10h9M11 5v38h12"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="M17 21h15M17 27h10"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      <Circle
        cx="33"
        cy="34"
        r="10"
        stroke="#111014"
        strokeWidth={2.5}
      />

      <Path
        d="M33 28v6l4 2"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LocationIcon() {
  return (
    <Svg
      width={34}
      height={34}
      viewBox="0 0 48 48"
      fill="none"
    >
      <Path
        d="M38 20c0 10-14 22-14 22S10 30 10 20a14 14 0 1 1 28 0Z"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="24"
        cy="20"
        r="5.5"
        stroke="#111014"
        strokeWidth={2.5}
      />
    </Svg>
  );
}

function MapViewIcon() {
  return (
    <Svg
      width={34}
      height={34}
      viewBox="0 0 48 48"
      fill="none"
    >
      <Path
        d="M6 12L18 7L30 13L42 8V36L30 41L18 35L6 40V12Z"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 7V35M30 13V41"
        stroke="#111014"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ==========================================
// DASHBOARD ASISTEN
// ==========================================

export default function AssistantScheduleScreen() {
  const { sessions } = useAssistantSessions();

  const {
    user,
    profile,
    loading,
  } = useAuth();

  // ========================================
  // NAMA ASISTEN
  // ========================================

  // Prioritas:
  // 1. Nama dari Firestore.
  // 2. Display name dari Firebase Authentication.
  // 3. Bagian depan email.
  // 4. Pesan fallback jika semuanya kosong.

  const authDisplayName =
    user?.displayName?.trim() ||
    user?.email?.split('@')[0]?.trim() ||
    '';

  const displayName =
    profile?.nama?.trim() ||
    authDisplayName ||
    'Nama belum tersedia';

  const visibleName = loading
    ? 'Memuat profil...'
    : displayName;

  // ========================================
  // INISIAL AVATAR
  // ========================================

  const initials =
    displayName === 'Nama belum tersedia'
      ? '?'
      : displayName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join('');

  // ========================================
  // TAMPILAN DASHBOARD
  // ========================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        contentContainerStyle={styles.content}
        data={sessions}
        keyExtractor={(item) => item.id}

        // ==================================
        // KARTU SESI
        // ==================================

        renderItem={({ item }) => (
          <View style={styles.sessionItem}>
            <SessionCard
              session={item}
              onPress={() =>
                router.push({
                  pathname: '/assistant/session/[sessionId]',
                  params: {
                    sessionId: item.id,
                  },
                })
              }
            />
          </View>
        )}

        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}

        // ==================================
        // HEADER DASHBOARD
        // ==================================

        ListHeaderComponent={
          <View>
            <View style={styles.headerContent}>
              {/* KARTU PROFIL ASISTEN */}
              <View style={styles.profileCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {loading ? '...' : initials}
                  </Text>
                </View>

                <View style={styles.profileInfo}>
                  <Text
                    style={styles.profileName}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {visibleName}
                  </Text>

                  <Text style={styles.profileRole}>
                    Asisten Praktikum
                  </Text>
                </View>
              </View>

              {/* MENU FITUR */}
              <View style={styles.menuCard}>
                <View style={styles.menuRow}>
                  {/* KELAS DAN PESERTA */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuTile,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      router.push('/assistant/classes')
                    }
                  >
                    <View style={styles.menuIcon}>
                      <UsersIcon />
                    </View>

                    <Text style={styles.menuLabel}>
                      Kelas & Peserta
                    </Text>
                  </Pressable>

                  {/* JADWAL */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuTile,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      router.push('/assistant/schedules')
                    }
                  >
                    <View style={styles.menuIcon}>
                      <CalendarIcon />
                    </View>

                    <Text style={styles.menuLabel}>
                      Jadwal
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.menuRow}>
                  {/* SESI DAN PRESENSI */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuTile,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      router.push('/assistant/sessions')
                    }
                  >
                    <View style={styles.menuIcon}>
                      <AttendanceIcon />
                    </View>

                    <Text style={styles.menuLabel}>
                      Sesi & Presensi
                    </Text>
                  </Pressable>

                  {/* PENGAJUAN IZIN */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuTile,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      router.push('/assistant/leave-requests')
                    }
                  >
                    <View style={styles.menuIcon}>
                      <LeaveIcon />
                    </View>

                    <Text style={styles.menuLabel}>
                      Pengajuan Izin
                    </Text>
                  </Pressable>
                </View>

                {/* LOKASI LABORATORIUM */}
                <Pressable
                  style={({ pressed }) => [
                    styles.menuBannerTile,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    router.push('/assistant/laboratories' as Href)
                  }
                >
                  <View style={styles.menuBannerIcon}>
                    <LocationIcon />
                  </View>

                  <View style={styles.menuBannerContent}>
                    <Text style={styles.menuBannerTitle}>
                      Lokasi Laboratorium
                    </Text>
                    <Text style={styles.menuBannerSubtitle}>
                      Atur koordinat & radius 4 lokasi praktikum
                    </Text>
                  </View>

                  <Text style={styles.menuBannerArrow}>›</Text>
                </Pressable>

                {/* PETA LABORATORIUM */}
                <Pressable
                  style={({ pressed }) => [
                    styles.menuBannerTile,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => router.navigate('/assistant/maps' as Href)}
                >
                  <View style={styles.menuBannerIcon}>
                    <MapViewIcon />
                  </View>

                  <View style={styles.menuBannerContent}>
                    <Text style={styles.menuBannerTitle}>
                      Peta Laboratorium
                    </Text>
                    <Text style={styles.menuBannerSubtitle}>
                      Lihat marker & area radius 4 lab di peta
                    </Text>
                  </View>

                  <Text style={styles.menuBannerArrow}>›</Text>
                </Pressable>
              </View>

              {/* JUDUL DAFTAR SESI */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionInfo}>
                  <Text style={styles.sectionTitle}>
                    Sesi Praktikum
                  </Text>

                  <Text style={styles.sectionSubtitle}>
                    Pantau sesi dan kehadiran praktikan.
                  </Text>
                </View>

                <View style={styles.sessionCountBadge}>
                  <Text style={styles.sessionCount}>
                    {sessions.length} sesi
                  </Text>
                </View>
              </View>
            </View>
          </View>
        }

        // ==================================
        // JIKA BELUM ADA SESI
        // ==================================

        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Belum Ada Sesi
            </Text>

            <Text style={styles.emptyText}>
              Sesi praktikum yang sudah dibuat akan muncul di sini.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ==========================================
// STYLE DASHBOARD
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

  // HEADER


  // KONTEN DASHBOARD
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // PROFIL ASISTEN
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#F47321',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 15,
    padding: 19,
  },

  avatar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    height: 72,
    justifyContent: 'center',
    width: 72,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  avatarText: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 23,
  },

  profileInfo: {
    flex: 1,
    gap: 6,
  },

  profileName: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 23,
  },

  profileRole: {
    fontFamily: FONT.regular,
    color: '#D0D0D0',
    fontSize: 13,
  },

  // MENU FITUR
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 20,
    gap: 20,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },

  menuTile: {
    alignItems: 'center',
    flex: 1,
    gap: 9,
    paddingVertical: 3,
  },

  menuIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderWidth: 1,
    borderRadius: 19,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },

  menuLabel: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
    textAlign: 'center',
  },

  menuBannerTile: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    flexDirection: 'row',
    gap: 13,
    padding: 12,
  },

  menuBannerIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderWidth: 1,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },

  menuBannerContent: {
    flex: 1,
    gap: 3,
  },

  menuBannerTitle: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 14,
  },

  menuBannerSubtitle: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
    lineHeight: 17,
  },

  menuBannerArrow: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 22,
    paddingHorizontal: 4,
  },

  pressed: {
    opacity: 0.65,
  },

  // SESI PRAKTIKUM
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 25,
    marginBottom: 15,
  },

  sectionInfo: {
    flex: 1,
  },

  sectionTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 21,
  },

  sectionSubtitle: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  sessionCountBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  sessionCount: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 12,
  },

  sessionItem: {
    paddingHorizontal: 20,
  },

  separator: {
    height: 12,
  },

  // KONDISI KOSONG
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    gap: 8,
    marginHorizontal: 20,
    padding: 24,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },

  emptyTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 16,
  },

  emptyText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});