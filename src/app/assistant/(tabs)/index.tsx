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
        stroke="#000000"
        strokeWidth={2.5}
      />

      <Circle
        cx="32"
        cy="17"
        r="5"
        stroke="#000000"
        strokeWidth={2.5}
      />

      <Path
        d="M5 38c0-7 5-12 12-12s12 5 12 12"
        stroke="#000000"
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      <Path
        d="M29 28c7 0 12 4 13 10"
        stroke="#000000"
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
        stroke="#000000"
        strokeWidth={2.5}
      />

      <Path
        d="M6 19h36M16 6v9M32 6v9"
        stroke="#000000"
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      <Path
        d="M15 27h4M27 27h4M15 35h4M27 35h4"
        stroke="#000000"
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
        stroke="#000000"
        strokeWidth={2.5}
      />

      <Path
        d="M17 5h14v8H17z"
        stroke="#000000"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      <Path
        d="m15 25 4 4 7-8M15 35h17"
        stroke="#000000"
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
        stroke="#000000"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="M17 21h15M17 27h10"
        stroke="#000000"
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      <Circle
        cx="33"
        cy="34"
        r="10"
        stroke="#000000"
        strokeWidth={2.5}
      />

      <Path
        d="M33 28v6l4 2"
        stroke="#000000"
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
        stroke="#000000"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="24"
        cy="20"
        r="5.5"
        stroke="#000000"
        strokeWidth={2.5}
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
      <StatusBar barStyle="light-content" />

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
            {/* HEADER SIPRAK */}
            <View style={styles.topBar}>
              <Text style={styles.brand}>
                SiPrak
              </Text>
            </View>

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
    paddingBottom: 25,
  },

  // HEADER
  topBar: {
    alignItems: 'center',
    backgroundColor: '#000000',
    justifyContent: 'center',
    minHeight: 95,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },

  brand: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 28,
  },

  // KONTEN DASHBOARD
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // PROFIL ASISTEN
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 15,
    padding: 19,
  },

  avatar: {
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 40,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },

  avatarText: {
    color: '#000000',
    fontSize: 23,
    fontWeight: '800',
  },

  profileInfo: {
    flex: 1,
    gap: 6,
  },

  profileName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },

  profileRole: {
    color: '#D0D0D0',
    fontSize: 13,
  },

  // MENU FITUR
  menuCard: {
    backgroundColor: '#F5F5F7',
    borderRadius: 22,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 20,
    gap: 20,
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
    backgroundColor: '#E0E2E9',
    borderRadius: 19,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },

  menuLabel: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: '#E0E2E9',
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
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },

  menuBannerSubtitle: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 17,
  },

  menuBannerArrow: {
    color: '#000000',
    fontSize: 22,
    fontWeight: '700',
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
    color: '#000000',
    fontSize: 21,
    fontWeight: '800',
  },

  sectionSubtitle: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  sessionCountBadge: {
    backgroundColor: '#F0F0F3',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  sessionCount: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: '#F5F5F7',
    borderRadius: 18,
    gap: 8,
    marginHorizontal: 20,
    padding: 24,
  },

  emptyTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },

  emptyText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});