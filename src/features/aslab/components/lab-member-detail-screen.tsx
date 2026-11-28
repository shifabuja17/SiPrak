import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SegmentedTabs from '@/components/common/SegmentedTabs';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { buildUsersLookupMap, type UsersLookupMap } from '@/features/bulk';
import {
  BackLink,
  Chip,
  MetaLine,
  PillButton,
  ScreenTitle,
  SoftCard,
  TAB_BAR_SPACE,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';
import {
  LAB_MEMBER_ROLES,
  loadUsersLookupMap,
  subscribeActiveLabMembers,
  subscribeAllLaboratories,
  type LabMember,
  type LabMemberRole,
} from '@/services/lab-members-service';
import type { Laboratory } from '@/types/laboratory';

const ROLE_TABS: { key: LabMemberRole; label: string }[] = [
  { key: LAB_MEMBER_ROLES.PRAKTIKAN, label: 'Praktikan Aktif' },
  { key: LAB_MEMBER_ROLES.ASPRAK, label: 'Asprak Aktif' },
];

const EMPTY_USERS_MAP: UsersLookupMap = buildUsersLookupMap([]);

function isAslabRole(rawRole: unknown): boolean {
  return typeof rawRole === 'string' && rawRole.trim().toUpperCase() === 'ASLAB';
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.max(0, Math.round(amount)).toLocaleString('id-ID')}`;
}

/**
 * Halaman Detail Anggota Laboratorium (Aslab): menampilkan ringkasan & daftar real-time
 * Praktikan aktif dan Asprak aktif dari `labMembers`, serta tombol akses terpisah untuk
 * Tambah Praktikan (FR-05), Tambah Asprak (FR-06), dan placeholder Transfer (FR-09/FR-10).
 */
export default function LabMemberDetailScreen() {
  const { labId: routeLabId } = useLocalSearchParams<{ labId: string }>();
  const trimmedLabId =
    (Array.isArray(routeLabId) ? routeLabId[0] : routeLabId)?.trim() ?? '';

  const { profile, loading: authLoading } = useAuth();
  const isAuthorized = isAslabRole(profile?.role);

  const [lab, setLab] = useState<Laboratory | null>(null);
  const [labLoading, setLabLoading] = useState(true);
  const [members, setMembers] = useState<LabMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [usersMap, setUsersMap] = useState<UsersLookupMap>(EMPTY_USERS_MAP);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LabMemberRole>(
    LAB_MEMBER_ROLES.PRAKTIKAN,
  );
  const [retryNonce, setRetryNonce] = useState(0);

  const handleRetry = useCallback(() => {
    setPageError(null);
    setRetryNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthorized) return;

    if (!trimmedLabId) {
      setLab(null);
      setLabLoading(false);
      setMembers([]);
      setMembersLoading(false);
      setPageError('ID laboratorium tidak valid.');
      return;
    }

    let active = true;
    setLabLoading(true);
    setMembersLoading(true);
    setPageError(null);

    const unsubLabs = subscribeAllLaboratories(
      (labs) => {
        if (!active) return;
        const found = labs.find((item) => item.id === trimmedLabId) ?? null;
        setLab(found);
        setLabLoading(false);
      },
      (err) => {
        if (!active) return;
        setPageError(err.message);
        setLabLoading(false);
      },
    );

    const unsubMembers = subscribeActiveLabMembers(
      trimmedLabId,
      (nextMembers) => {
        if (!active) return;
        setMembers(nextMembers);
        setMembersLoading(false);
      },
      (err) => {
        if (!active) return;
        setPageError(err.message);
        setMembersLoading(false);
      },
    );

    loadUsersLookupMap()
      .then((map) => {
        if (!active) return;
        setUsersMap(map);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setPageError(
          err instanceof Error
            ? err.message
            : 'Gagal memuat detail profil anggota.',
        );
      });

    return () => {
      active = false;
      unsubLabs();
      unsubMembers();
    };
  }, [authLoading, isAuthorized, trimmedLabId, retryNonce]);

  const praktikanMembers = useMemo(
    () =>
      members.filter(
        (member) => member.aktif && member.peran === LAB_MEMBER_ROLES.PRAKTIKAN,
      ),
    [members],
  );

  const asprakMembers = useMemo(
    () =>
      members.filter(
        (member) => member.aktif && member.peran === LAB_MEMBER_ROLES.ASPRAK,
      ),
    [members],
  );

  const visibleMembers =
    activeTab === LAB_MEMBER_ROLES.PRAKTIKAN
      ? praktikanMembers
      : asprakMembers;

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={UI.ink} />
        <Text style={styles.mutedText}>Memeriksa akses akun...</Text>
      </SafeAreaView>
    );
  }

  if (!profile || !isAuthorized) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.deniedTitle}>Akses Ditolak</Text>
        <Text style={styles.mutedText}>
          Halaman Detail Anggota Laboratorium hanya dapat diakses oleh Asisten Lab
          (Aslab).
        </Text>
        <PillButton label="Kembali" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BackLink label="Kembali" onPress={() => router.back()} />

        <ScreenTitle
          title={lab?.nama ?? (labLoading ? 'Memuat Lab...' : 'Detail Laboratorium')}
          subtitle="Pantau Praktikan dan Asprak aktif secara real-time lalu kelola penugasan anggota."
        />

        {pageError ? (
          <SoftCard style={styles.errorCard}>
            <Text style={styles.errorText}>{pageError}</Text>
            <PillButton
              label="Muat Ulang"
              variant="outline"
              onPress={handleRetry}
            />
          </SoftCard>
        ) : null}

        {lab ? (
          <SoftCard style={styles.infoCard}>
            <View style={styles.badgeRow}>
              {lab.mataKuliahId ? (
                <Chip label={lab.mataKuliahId} tone="accent" />
              ) : (
                <Chip label="Umum" tone="soft" />
              )}
              <Chip
                label={`${praktikanMembers.length} Praktikan`}
                tone="dark"
              />
              <Chip label={`${asprakMembers.length} Asprak`} tone="soft" />
            </View>

            {lab.lokasi ? (
              <MetaLine icon="place" color={UI.muted} textStyle={styles.metaText}>
                {lab.lokasi}
              </MetaLine>
            ) : null}

            <Text style={styles.metaSubtext}>
              Radius: {lab.radius} m • Grace Period: {lab.gracePeriodMenit} mnt •
              Denda: {formatRupiah(lab.nominalDenda)}
            </Text>
          </SoftCard>
        ) : !labLoading ? (
          <SoftCard style={styles.errorCard}>
            <Text style={styles.errorText}>
              Laboratorium dengan ID &quot;{trimmedLabId}&quot; tidak ditemukan.
            </Text>
          </SoftCard>
        ) : null}

        {/* DUA TOMBOL AKSI TERPISAH: TAMBAH PRAKTIKAN & TAMBAH ASPRAK */}
        <SoftCard style={styles.actionsCard}>
          <Text style={styles.sectionHeading}>Tambah Anggota Laboratorium</Text>
          <View style={styles.actionRow}>
            <PillButton
              label="Tambah Praktikan"
              variant="accent"
              disabled={!lab}
              onPress={() =>
                router.push(
                  `/aslab/praktikan-insert?labId=${encodeURIComponent(trimmedLabId)}` as Href,
                )
              }
              style={styles.actionButton}
            />
            <PillButton
              label="Tambah Asprak"
              variant="dark"
              disabled={!lab}
              onPress={() =>
                router.push(
                  `/aslab/asprak-insert?labId=${encodeURIComponent(trimmedLabId)}` as Href,
                )
              }
              style={styles.actionButton}
            />
          </View>

          {/* TODO: FR-09 & FR-10 Transfer Praktikan/Asprak */}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(
                'Segera Tersedia',
                'Fitur Transfer Praktikan & Asprak (FR-09 & FR-10) akan dihubungkan pada tahap berikutnya.',
              )
            }
            style={({ pressed }) => [
              styles.transferPlaceholderBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.transferPlaceholderText}>
              Pindahkan Praktikan / Asprak (FR-09 & FR-10 — Segera Hadir)
            </Text>
          </Pressable>
        </SoftCard>

        <SegmentedTabs
          options={ROLE_TABS}
          value={activeTab}
          onChange={setActiveTab}
        />

        {membersLoading && visibleMembers.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={UI.ink} />
            <Text style={styles.mutedText}>Memuat daftar anggota aktif...</Text>
          </View>
        ) : visibleMembers.length === 0 ? (
          <SoftCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Belum Ada{' '}
              {activeTab === LAB_MEMBER_ROLES.PRAKTIKAN ? 'Praktikan' : 'Asprak'}{' '}
              Aktif
            </Text>
            <Text style={styles.mutedText}>
              Gunakan tombol &quot;
              {activeTab === LAB_MEMBER_ROLES.PRAKTIKAN
                ? 'Tambah Praktikan'
                : 'Tambah Asprak'}
              &quot; di atas untuk mendaftarkan anggota ke laboratorium ini.
            </Text>
          </SoftCard>
        ) : (
          visibleMembers.map((member) => {
            const userInfo = usersMap.byUid.get(member.userId);
            return (
              <SoftCard key={member.id} style={styles.memberCard}>
                <View style={styles.memberTop}>
                  <View style={styles.memberIdentity}>
                    <Text style={styles.memberName}>
                      {userInfo?.nama || `UID: ${member.userId}`}
                    </Text>
                    <Text style={styles.memberMeta}>
                      {userInfo?.email ?? 'Memuat email...'}
                      {userInfo?.nim ? ` • NIM: ${userInfo.nim}` : ''}
                    </Text>
                  </View>
                  <Chip
                    label={
                      member.peran === LAB_MEMBER_ROLES.ASPRAK
                        ? 'ASPRAK AKTIF'
                        : 'PRAKTIKAN AKTIF'
                    }
                    tone={
                      member.peran === LAB_MEMBER_ROLES.ASPRAK
                        ? 'dark'
                        : 'accent'
                    }
                  />
                </View>
              </SoftCard>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: UI.page,
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: UI.page,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  deniedTitle: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 20,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  infoCard: {
    gap: 8,
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaText: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 13,
  },
  metaSubtext: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  actionsCard: {
    gap: 10,
    padding: 16,
  },
  sectionHeading: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  transferPlaceholderBtn: {
    alignItems: 'center',
    borderColor: UI.border,
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  transferPlaceholderText: {
    color: UI.muted,
    fontFamily: FONT.semibold,
    fontSize: 12,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
  },
  emptyTitle: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 15,
  },
  mutedText: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorCard: {
    borderColor: UI.danger,
    gap: 10,
  },
  errorText: {
    color: UI.danger,
    fontFamily: FONT.semibold,
    fontSize: 13,
  },
  memberCard: {
    gap: 6,
    padding: 16,
  },
  memberTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  memberIdentity: {
    flex: 1,
    gap: 3,
  },
  memberName: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 15,
  },
  memberMeta: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
});
