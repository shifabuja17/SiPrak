import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import {
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
  subscribeAllActiveLabMembers,
  subscribeAllLaboratories,
  type LabMember,
} from '@/services/lab-members-service';
import type { Laboratory } from '@/types/laboratory';

function isAslabRole(rawRole: unknown): boolean {
  return typeof rawRole === 'string' && rawRole.trim().toUpperCase() === 'ASLAB';
}

/**
 * Halaman Manajemen Laboratorium milik Aslab (`ASLAB`):
 * - Menampilkan daftar lab + ringkasan real-time Praktikan & Asprak aktif (`onSnapshot`).
 * - Menyediakan akses terpisah "Tambah Praktikan" dan "Tambah Asprak" per lab.
 * - Menyediakan tombol akses terpisah "Pindah Praktikan" (FR-09) dan "Pindah Asprak" (FR-10).
 */
export default function AslabLaboratoriesScreen() {
  const { profile, loading: authLoading } = useAuth();
  const isAuthorized = isAslabRole(profile?.role);

  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [activeMembers, setActiveMembers] = useState<LabMember[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);

  const handleRetry = useCallback(() => {
    setPageError(null);
    setRetryNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!profile || !isAuthorized) {
      setLaboratories([]);
      setActiveMembers([]);
      setLoadingLabs(false);
      return;
    }

    let active = true;
    setLoadingLabs(true);
    setPageError(null);

    const unsubLabs = subscribeAllLaboratories(
      (data) => {
        if (!active) return;
        setLaboratories(data);
        setLoadingLabs(false);
      },
      (err) => {
        if (!active) return;
        setPageError(err.message);
        setLoadingLabs(false);
      },
    );

    const unsubMembers = subscribeAllActiveLabMembers(
      (members) => {
        if (!active) return;
        setActiveMembers(members);
      },
      (err) => {
        if (!active) return;
        setPageError(err.message);
      },
    );

    return () => {
      active = false;
      unsubLabs();
      unsubMembers();
    };
  }, [authLoading, profile, isAuthorized, retryNonce]);

  const memberCountByLab = useMemo(() => {
    const counts = new Map<
      string,
      { praktikanCount: number; asprakCount: number }
    >();

    for (const member of activeMembers) {
      if (!member.aktif) continue;
      const current = counts.get(member.labId) ?? {
        praktikanCount: 0,
        asprakCount: 0,
      };
      if (member.peran === LAB_MEMBER_ROLES.PRAKTIKAN) {
        current.praktikanCount += 1;
      } else if (member.peran === LAB_MEMBER_ROLES.ASPRAK) {
        current.asprakCount += 1;
      }
      counts.set(member.labId, current);
    }

    return counts;
  }, [activeMembers]);

  const filteredLabs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return laboratories;
    return laboratories.filter(
      (lab) =>
        lab.nama.toLowerCase().includes(q) ||
        (lab.mataKuliahId ?? '').toLowerCase().includes(q) ||
        lab.lokasi.toLowerCase().includes(q),
    );
  }, [laboratories, searchQuery]);

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
        <Text style={styles.emptyTitle}>Akses Ditolak</Text>
        <Text style={styles.mutedText}>
          Halaman Manajemen Laboratorium hanya dapat diakses oleh Asisten Lab
          (Aslab).
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle
          title="Manajemen Laboratorium"
          subtitle="Pantau Praktikan dan Asprak aktif per laboratorium serta kelola keanggotaan."
        />

        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Cari nama lab, kode mata kuliah, atau lokasi..."
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          style={styles.searchInput}
        />

        {pageError ? (
          <SoftCard style={styles.errorCard}>
            <Text style={styles.errorText}>{pageError}</Text>
            <PillButton
              label="Coba Lagi"
              variant="outline"
              onPress={handleRetry}
            />
          </SoftCard>
        ) : null}

        {loadingLabs && laboratories.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={UI.ink} />
            <Text style={styles.mutedText}>Memuat daftar laboratorium...</Text>
          </View>
        ) : filteredLabs.length === 0 ? (
          <SoftCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim()
                ? 'Laboratorium Tidak Ditemukan'
                : 'Belum Ada Laboratorium'}
            </Text>
            <Text style={styles.mutedText}>
              {searchQuery.trim()
                ? 'Coba kata kunci pencarian yang berbeda.'
                : 'Tambahkan laboratorium terlebih dahulu sebelum mengelola anggota.'}
            </Text>
          </SoftCard>
        ) : (
          filteredLabs.map((lab) => {
            const counts = memberCountByLab.get(lab.id) ?? {
              praktikanCount: 0,
              asprakCount: 0,
            };

            return (
              <SoftCard key={lab.id} style={styles.labCard}>
                <View style={styles.labHeader}>
                  <Text style={styles.labName}>{lab.nama}</Text>
                  {lab.mataKuliahId ? (
                    <Chip label={lab.mataKuliahId} tone="accent" />
                  ) : (
                    <Chip label="Umum" tone="soft" />
                  )}
                </View>

                {lab.lokasi ? (
                  <MetaLine
                    icon="place"
                    color={UI.muted}
                    textStyle={styles.metaText}
                  >
                    {lab.lokasi}
                  </MetaLine>
                ) : null}

                {/* RINGKASAN REAL-TIME ANGGOTA AKTIF */}
                <View style={styles.memberSummaryRow}>
                  <Chip
                    label={`${counts.praktikanCount} Praktikan Aktif`}
                    tone="dark"
                  />
                  <Chip
                    label={`${counts.asprakCount} Asprak Aktif`}
                    tone="soft"
                  />
                </View>

                {/* TOMBOL AKSI DETAIL & INSERT TERPISAH */}
                <View style={styles.actionRow}>
                  <PillButton
                    label="Tambah Praktikan"
                    variant="accent"
                    onPress={() =>
                      router.push(
                        `/aslab/praktikan-insert?labId=${encodeURIComponent(lab.id)}` as Href,
                      )
                    }
                    style={styles.halfActionBtn}
                  />
                  <PillButton
                    label="Tambah Asprak"
                    variant="dark"
                    onPress={() =>
                      router.push(
                        `/aslab/asprak-insert?labId=${encodeURIComponent(lab.id)}` as Href,
                      )
                    }
                    style={styles.halfActionBtn}
                  />
                </View>

                <View style={styles.secondaryActionRow}>
                  <PillButton
                    label="Lihat Detail Anggota"
                    variant="outline"
                    onPress={() =>
                      router.push(
                        `/aslab/lab-detail/${encodeURIComponent(lab.id)}` as Href,
                      )
                    }
                    style={styles.detailBtn}
                  />

                  <View style={styles.actionRow}>
                    <PillButton
                      label="Pindah Praktikan"
                      variant="outline"
                      onPress={() =>
                        router.push(
                          `/aslab/transfer-praktikan?labId=${encodeURIComponent(lab.id)}` as Href,
                        )
                      }
                      style={styles.halfActionBtn}
                    />
                    <PillButton
                      label="Pindah Asprak"
                      variant="outline"
                      onPress={() =>
                        router.push(
                          `/aslab/transfer-asprak?labId=${encodeURIComponent(lab.id)}` as Href,
                        )
                      }
                      style={styles.halfActionBtn}
                    />
                  </View>
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
  scrollContent: {
    gap: 14,
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: UI.padding,
    paddingTop: 16,
  },
  searchInput: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 16,
    borderWidth: 1,
    color: UI.ink,
    fontFamily: FONT.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
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
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 17,
  },
  mutedText: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  labCard: {
    gap: 10,
    padding: 16,
  },
  labHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  labName: {
    color: UI.ink,
    flex: 1,
    fontFamily: FONT.extrabold,
    fontSize: 16,
  },
  metaText: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 13,
  },
  memberSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfActionBtn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  secondaryActionRow: {
    gap: 8,
  },
  detailBtn: {
    minHeight: 42,
  },
});
