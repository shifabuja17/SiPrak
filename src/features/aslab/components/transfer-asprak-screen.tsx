import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import ConfirmModal from '@/components/common/ConfirmModal';
import Dropdown, { type DropdownOption } from '@/components/common/Dropdown';
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
  UI,
} from '@/features/praktikan/ui/praktikan-ui';
import {
  LAB_MEMBER_ROLES,
  MAX_ATOMIC_TRANSFER_USERS,
  loadUsersLookupMap,
  subscribeActiveLabMembers,
  subscribeAllLaboratories,
  transferAsprak,
  type LabMember,
  type TransferMembersResult,
} from '@/services/lab-members-service';
import type { Laboratory } from '@/types/laboratory';

const EMPTY_USERS_MAP: UsersLookupMap = buildUsersLookupMap([]);

function isAslabRole(rawRole: unknown): boolean {
  return typeof rawRole === 'string' && rawRole.trim().toUpperCase() === 'ASLAB';
}

function formatLabTitleWithCourse(lab: Laboratory): string {
  return lab.mataKuliahId
    ? `${lab.nama} (${lab.mataKuliahId})`
    : `${lab.nama} (Umum)`;
}

function CheckboxIcon({
  checked,
  disabled = false,
}: {
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      style={[
        styles.checkboxBox,
        checked && styles.checkboxBoxChecked,
        disabled && styles.checkboxBoxDisabled,
      ]}
    >
      {checked ? (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12.5L10 17.5L19 7"
            stroke="#FFFFFF"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Layar khusus Pindah Asprak antar laboratorium (FR-10) untuk Aslab.
 * Hanya memindahkan keanggotaan di koleksi `labMembers` tanpa mengubah
 * jadwal (`schedules`) maupun `asprakId`/`createdBy` sesi lama (`sessions`).
 */
export default function TransferAsprakScreen() {
  const { labId: routeLabId } = useLocalSearchParams<{ labId?: string }>();
  const initialSourceLabId =
    (Array.isArray(routeLabId) ? routeLabId[0] : routeLabId)?.trim() ?? '';

  const { profile, loading: authLoading } = useAuth();
  const isAuthorized = isAslabRole(profile?.role);

  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [usersMap, setUsersMap] = useState<UsersLookupMap>(EMPTY_USERS_MAP);

  const [sourceLabId, setSourceLabId] = useState<string>(initialSourceLabId);
  const [targetLabId, setTargetLabId] = useState<string>('');

  // Asprak aktif real-time di lab asal & lab tujuan
  const [sourceMembers, setSourceMembers] = useState<LabMember[]>([]);
  const [sourceMembersLoading, setSourceMembersLoading] = useState(false);
  const [targetMembers, setTargetMembers] = useState<LabMember[]>([]);
  const [targetMembersLoading, setTargetMembersLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [pageError, setPageError] = useState<string | null>(null);
  const [transferFeedback, setTransferFeedback] = useState<{
    ok: boolean;
    message: string;
    result?: TransferMembersResult;
  } | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const handleRetry = useCallback(() => {
    setPageError(null);
    setRetryNonce((prev) => prev + 1);
  }, []);

  // 1. Subscribe seluruh laboratorium + muat lookup users
  useEffect(() => {
    if (authLoading || !isAuthorized) return;

    let active = true;
    setLabsLoading(true);
    setPageError(null);

    const unsubLabs = subscribeAllLaboratories(
      (labs) => {
        if (!active) return;
        setLaboratories(labs);
        setSourceLabId((current: string) => {
          if (current && labs.some((lab) => lab.id === current)) {
            return current;
          }
          return labs[0]?.id ?? '';
        });
        setLabsLoading(false);
      },
      (err) => {
        if (!active) return;
        setPageError(err.message);
        setLabsLoading(false);
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
            : 'Gagal memuat data akun pengguna.',
        );
      });

    return () => {
      active = false;
      unsubLabs();
    };
  }, [authLoading, isAuthorized, retryNonce]);

  const sourceLab = useMemo(
    () => laboratories.find((lab) => lab.id === sourceLabId) ?? null,
    [laboratories, sourceLabId],
  );

  // Semua lab lain yang tersedia sebagai tujuan (lintas mata kuliah diperbolehkan untuk Asprak)
  const availableTargetLabs = useMemo(
    () => laboratories.filter((lab) => lab.id !== sourceLabId),
    [laboratories, sourceLabId],
  );

  useEffect(() => {
    if (availableTargetLabs.length === 0) {
      setTargetLabId('');
      return;
    }

    setTargetLabId((current: string) => {
      if (current && availableTargetLabs.some((lab) => lab.id === current)) {
        return current;
      }
      return availableTargetLabs[0].id;
    });
  }, [availableTargetLabs]);

  const targetLab = useMemo(
    () => availableTargetLabs.find((lab) => lab.id === targetLabId) ?? null,
    [availableTargetLabs, targetLabId],
  );

  // 2. Subscribe real-time Asprak aktif di lab asal
  useEffect(() => {
    if (authLoading || !isAuthorized || !sourceLabId) {
      setSourceMembers([]);
      setSelectedUserIds([]);
      setSourceMembersLoading(false);
      return;
    }

    let active = true;
    setSourceMembersLoading(true);
    setSelectedUserIds([]);

    const unsubSourceMembers = subscribeActiveLabMembers(
      sourceLabId,
      (members) => {
        if (!active) return;
        setSourceMembers(members);
        const activeIds = new Set(members.map((item) => item.userId));
        setSelectedUserIds((prev) => prev.filter((uid) => activeIds.has(uid)));
        setSourceMembersLoading(false);
      },
      (err) => {
        if (!active) return;
        setPageError(err.message);
        setSourceMembersLoading(false);
      },
      LAB_MEMBER_ROLES.ASPRAK,
    );

    return () => {
      active = false;
      unsubSourceMembers();
    };
  }, [authLoading, isAuthorized, sourceLabId, retryNonce]);

  // 3. Subscribe real-time Asprak aktif di lab tujuan
  useEffect(() => {
    if (authLoading || !isAuthorized || !targetLabId) {
      setTargetMembers([]);
      setTargetMembersLoading(false);
      return;
    }

    let active = true;
    setTargetMembersLoading(true);

    const unsubTargetMembers = subscribeActiveLabMembers(
      targetLabId,
      (members) => {
        if (!active) return;
        setTargetMembers(members);
        const alreadyInTarget = new Set(members.map((item) => item.userId));
        setSelectedUserIds((prev) =>
          prev.filter((uid) => !alreadyInTarget.has(uid)),
        );
        setTargetMembersLoading(false);
      },
      (err) => {
        if (!active) return;
        setPageError(err.message);
        setTargetMembersLoading(false);
      },
      LAB_MEMBER_ROLES.ASPRAK,
    );

    return () => {
      active = false;
      unsubTargetMembers();
    };
  }, [authLoading, isAuthorized, targetLabId, retryNonce]);

  const sourceLabOptions: DropdownOption[] = useMemo(
    () =>
      laboratories.map((lab) => ({
        value: lab.id,
        label: formatLabTitleWithCourse(lab),
        detail: lab.lokasi || undefined,
      })),
    [laboratories],
  );

  const targetLabOptions: DropdownOption[] = useMemo(
    () =>
      availableTargetLabs.map((lab) => ({
        value: lab.id,
        label: formatLabTitleWithCourse(lab),
        detail: lab.lokasi || undefined,
      })),
    [availableTargetLabs],
  );

  const targetActiveUserIds = useMemo(() => {
    const set = new Set<string>();
    for (const member of targetMembers) {
      if (member.aktif) set.add(member.userId);
    }
    return set;
  }, [targetMembers]);

  const enrichMembers = useCallback(
    (list: LabMember[]) => {
      return list
        .filter(
          (member) => member.aktif && member.peran === LAB_MEMBER_ROLES.ASPRAK,
        )
        .map((member) => {
          const user = usersMap.byUid.get(member.userId);
          return {
            member,
            userId: member.userId,
            nama: user?.nama || `UID: ${member.userId}`,
            nim: user?.nim ?? null,
            email: user?.email ?? '-',
          };
        })
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
    },
    [usersMap],
  );

  const enrichedSourceAsprak = useMemo(
    () => enrichMembers(sourceMembers),
    [sourceMembers, enrichMembers],
  );

  const enrichedTargetAsprak = useMemo(
    () => enrichMembers(targetMembers),
    [targetMembers, enrichMembers],
  );

  const filteredSourceAsprak = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return enrichedSourceAsprak;
    return enrichedSourceAsprak.filter(
      (item) =>
        item.nama.toLowerCase().includes(q) ||
        (item.nim ?? '').toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q),
    );
  }, [enrichedSourceAsprak, searchQuery]);

  const eligibleFilteredAsprak = useMemo(
    () =>
      filteredSourceAsprak.filter(
        (item) => !targetActiveUserIds.has(item.userId),
      ),
    [filteredSourceAsprak, targetActiveUserIds],
  );

  const selectedSet = useMemo(
    () => new Set(selectedUserIds),
    [selectedUserIds],
  );

  const areAllEligibleSelected =
    eligibleFilteredAsprak.length > 0 &&
    eligibleFilteredAsprak.every((item) => selectedSet.has(item.userId));

  function handleToggleUser(userId: string) {
    if (targetActiveUserIds.has(userId)) {
      return;
    }

    setTransferFeedback(null);
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      if (prev.length >= MAX_ATOMIC_TRANSFER_USERS) {
        setPageError(
          `Maksimal ${MAX_ATOMIC_TRANSFER_USERS} Asprak per satu pemindahan atomik.`,
        );
        return prev;
      }
      return [...prev, userId];
    });
  }

  function handleToggleSelectAllEligible() {
    setTransferFeedback(null);
    setPageError(null);

    if (areAllEligibleSelected) {
      const eligibleIds = new Set(
        eligibleFilteredAsprak.map((item) => item.userId),
      );
      setSelectedUserIds((prev) => prev.filter((id) => !eligibleIds.has(id)));
      return;
    }

    const next = new Set(selectedUserIds);
    for (const item of eligibleFilteredAsprak) {
      if (next.size >= MAX_ATOMIC_TRANSFER_USERS) {
        setPageError(
          `Hanya ${MAX_ATOMIC_TRANSFER_USERS} Asprak pertama yang dipilih sesuai batas batch atomik.`,
        );
        break;
      }
      next.add(item.userId);
    }
    setSelectedUserIds(Array.from(next));
  }

  const selectedNamesPreview = useMemo(() => {
    const names = enrichedSourceAsprak
      .filter((item) => selectedSet.has(item.userId))
      .map((item) => item.nama);
    if (names.length <= 5) {
      return names.join(', ');
    }
    return `${names.slice(0, 5).join(', ')}, dan ${names.length - 5} Asprak lainnya`;
  }, [enrichedSourceAsprak, selectedSet]);

  const canTransfer =
    Boolean(sourceLab) &&
    Boolean(targetLab) &&
    selectedUserIds.length > 0 &&
    !transferring;

  async function handleConfirmTransfer() {
    if (!sourceLab || !targetLab || selectedUserIds.length === 0) {
      setConfirmVisible(false);
      return;
    }

    setConfirmVisible(false);
    setTransferring(true);
    setPageError(null);
    setTransferFeedback(null);

    try {
      const result = await transferAsprak(
        sourceLab.id,
        targetLab.id,
        selectedUserIds,
      );

      if (result.error || result.transferredCount === 0) {
        setTransferFeedback({
          ok: false,
          message: result.error ?? 'Pemindahan Asprak gagal dijalankan.',
          result,
        });
        return;
      }

      setSelectedUserIds([]);
      setTransferFeedback({
        ok: true,
        message: `${result.transferredCount} Asprak berhasil dipindahkan dari "${result.sourceLabName}" ke "${result.targetLabName}". Daftar Asprak asal dan tujuan langsung diperbarui.`,
        result,
      });
    } catch (error) {
      setTransferFeedback({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan saat memindahkan Asprak.',
      });
    } finally {
      setTransferring(false);
    }
  }

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
          Halaman Pindah Asprak hanya dapat diakses oleh Asisten Lab (Aslab).
        </Text>
        <PillButton label="Kembali" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BackLink label="Kembali" onPress={() => router.back()} />

          <ScreenTitle
            title="Pindah Asprak"
            subtitle="Pindahkan penugasan Asprak antar laboratorium secara real-time dan atomik."
          />

          {/* CATATAN JADWAL & RIWAYAT SESI LAMA */}
          <View style={styles.infoNoticeBox}>
            <Text style={styles.infoNoticeTitle}>Catatan Penting</Text>
            <Text style={styles.infoNoticeText}>
              Jadwal praktikum tidak berpindah dan riwayat sesi sebelumnya tetap
              tercatat atas Asprak yang lama. Hak kelola laboratorium berpindah
              langsung melalui koleksi labMembers.
            </Text>
          </View>

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

          {transferFeedback ? (
            <View
              style={
                transferFeedback.ok
                  ? styles.successBanner
                  : styles.errorBanner
              }
            >
              <Text
                style={
                  transferFeedback.ok
                    ? styles.successBannerText
                    : styles.errorBannerText
                }
              >
                {transferFeedback.message}
              </Text>
            </View>
          ) : null}

          {/* BAGIAN 1: LAB ASAL */}
          <SoftCard style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Chip label="LAB ASAL" tone="dark" />
              <Text style={styles.sectionTitle}>Laboratorium Asal</Text>
            </View>

            {labsLoading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color={UI.ink} />
                <Text style={styles.mutedSmall}>
                  Memuat daftar laboratorium...
                </Text>
              </View>
            ) : (
              <Dropdown
                value={sourceLabId}
                options={sourceLabOptions}
                onChange={(nextId) => {
                  setSourceLabId(nextId);
                  setTransferFeedback(null);
                  setPageError(null);
                }}
                placeholder="Pilih laboratorium asal"
                accessibilityLabel="Pilih laboratorium asal"
              />
            )}

            {sourceLab ? (
              <View style={styles.labMetaBox}>
                <View style={styles.badgeRow}>
                  <Chip
                    label={sourceLab.mataKuliahId || 'Umum'}
                    tone={sourceLab.mataKuliahId ? 'accent' : 'soft'}
                  />
                  <Chip
                    label={`${enrichedSourceAsprak.length} Asprak Aktif`}
                    tone="dark"
                  />
                </View>

                {sourceLab.lokasi ? (
                  <MetaLine
                    icon="place"
                    color={UI.muted}
                    textStyle={styles.metaText}
                  >
                    {sourceLab.lokasi}
                  </MetaLine>
                ) : null}
              </View>
            ) : null}
          </SoftCard>

          {/* BAGIAN 2: LAB TUJUAN (SEMUA LAB LAIN + MATA KULIAH) */}
          <SoftCard style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Chip label="LAB TUJUAN" tone="accent" />
              <Text style={styles.sectionTitle}>Laboratorium Tujuan</Text>
            </View>

            {availableTargetLabs.length === 0 ? (
              <View style={styles.emptyTargetBox}>
                <Text style={styles.emptyTargetTitle}>
                  Belum Ada Laboratorium Lain
                </Text>
                <Text style={styles.mutedLeft}>
                  Minimal harus tersedia 2 laboratorium agar Asprak dapat
                  dipindahkan.
                </Text>
              </View>
            ) : (
              <>
                <Dropdown
                  value={targetLabId}
                  options={targetLabOptions}
                  onChange={(nextId) => {
                    setTargetLabId(nextId);
                    setTransferFeedback(null);
                  }}
                  placeholder="Pilih laboratorium tujuan"
                  accessibilityLabel="Pilih laboratorium tujuan"
                />

                {targetLab ? (
                  <View style={styles.targetPreviewBox}>
                    <View style={styles.badgeRow}>
                      <Chip
                        label={targetLab.mataKuliahId || 'Umum'}
                        tone={targetLab.mataKuliahId ? 'accent' : 'soft'}
                      />
                      <Chip
                        label={
                          targetMembersLoading
                            ? 'Memuat Asprak...'
                            : `${enrichedTargetAsprak.length} Asprak Aktif di Tujuan`
                        }
                        tone="dark"
                      />
                    </View>
                    {enrichedTargetAsprak.length > 0 ? (
                      <Text style={styles.targetMembersSummary}>
                        Saat ini di tujuan:{' '}
                        {enrichedTargetAsprak.map((a) => a.nama).join(', ')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
          </SoftCard>

          {/* BAGIAN 3: DAFTAR ASPRAK AKTIF DI LAB ASAL (MULTI-SELECT REAL-TIME) */}
          <SoftCard style={styles.sectionCard}>
            <View style={styles.listTopRow}>
              <View style={styles.listTitleCol}>
                <Text style={styles.sectionTitle}>
                  Asprak Aktif di Lab Asal
                </Text>
                <Text style={styles.mutedSmall}>
                  {selectedUserIds.length} dipilih dari{' '}
                  {enrichedSourceAsprak.length} Asprak aktif
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={eligibleFilteredAsprak.length === 0 || transferring}
                onPress={handleToggleSelectAllEligible}
                style={({ pressed }) => [
                  styles.selectAllBtn,
                  eligibleFilteredAsprak.length === 0 && styles.disabledOpacity,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.selectAllBtnText}>
                  {areAllEligibleSelected ? 'Batal Pilih' : 'Pilih Semua'}
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari nama, NIM, atau email Asprak..."
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.searchInput}
            />

            {sourceMembersLoading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color={UI.ink} />
                <Text style={styles.mutedSmall}>
                  Memuat daftar Asprak aktif...
                </Text>
              </View>
            ) : filteredSourceAsprak.length === 0 ? (
              <View style={styles.emptyListBox}>
                <Text style={styles.emptyTargetTitle}>
                  {searchQuery.trim()
                    ? 'Asprak Tidak Ditemukan'
                    : 'Belum Ada Asprak Aktif'}
                </Text>
                <Text style={styles.mutedText}>
                  {searchQuery.trim()
                    ? 'Coba kata kunci nama atau email lain.'
                    : 'Tidak ada Asprak berstatus aktif di laboratorium asal ini.'}
                </Text>
              </View>
            ) : (
              <View style={styles.membersList}>
                {filteredSourceAsprak.map((item) => {
                  const isAlreadyAtTarget = targetActiveUserIds.has(
                    item.userId,
                  );
                  const checked =
                    !isAlreadyAtTarget && selectedSet.has(item.userId);

                  return (
                    <Pressable
                      key={item.userId}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked,
                        disabled: isAlreadyAtTarget || transferring,
                      }}
                      disabled={isAlreadyAtTarget || transferring}
                      onPress={() => handleToggleUser(item.userId)}
                      style={({ pressed }) => [
                        styles.memberRow,
                        checked && styles.memberRowSelected,
                        isAlreadyAtTarget && styles.memberRowBlocked,
                        pressed && !isAlreadyAtTarget && styles.pressed,
                      ]}
                    >
                      <CheckboxIcon
                        checked={checked}
                        disabled={isAlreadyAtTarget}
                      />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.nama}</Text>
                        <Text style={styles.memberMeta}>
                          {item.email}
                          {item.nim ? ` • NIM: ${item.nim}` : ''}
                        </Text>
                        {isAlreadyAtTarget ? (
                          <Text style={styles.alreadyTargetText}>
                            Sudah aktif di laboratorium tujuan
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </SoftCard>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomLabel} numberOfLines={1}>
              {sourceLab?.nama ?? '-'} → {targetLab?.nama ?? 'Belum ada tujuan'}
            </Text>
            <Text style={styles.bottomCount}>
              {selectedUserIds.length} terpilih
            </Text>
          </View>
          <PillButton
            label={`Pindahkan Asprak (${selectedUserIds.length} Terpilih)`}
            variant="dark"
            loading={transferring}
            disabled={!canTransfer}
            onPress={() => setConfirmVisible(true)}
          />
        </View>
      </View>

      <ConfirmModal
        visible={confirmVisible}
        title="Konfirmasi Pindah Asprak"
        message={`Pindahkan ${selectedUserIds.length} Asprak (${selectedNamesPreview}) dari "${sourceLab ? formatLabTitleWithCourse(sourceLab) : ''}" ke "${targetLab ? formatLabTitleWithCourse(targetLab) : ''}"? Jadwal praktikum tidak berpindah dan riwayat sesi lama tetap tercatat atas Asprak sebelumnya.`}
        confirmText="Ya, Pindahkan"
        cancelText="Batal"
        onConfirm={handleConfirmTransfer}
        onCancel={() => setConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: UI.page,
    flex: 1,
  },
  container: {
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
  mutedText: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  mutedLeft: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  mutedSmall: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 24,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  infoNoticeBox: {
    backgroundColor: '#FFF7ED',
    borderColor: UI.accent,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  infoNoticeTitle: {
    color: '#9A3412',
    fontFamily: FONT.extrabold,
    fontSize: 13,
  },
  infoNoticeText: {
    color: '#9A3412',
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
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
  successBanner: {
    backgroundColor: '#FFF7ED',
    borderColor: UI.accent,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  successBannerText: {
    color: '#9A3412',
    fontFamily: FONT.semibold,
    fontSize: 13,
    lineHeight: 19,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  errorBannerText: {
    color: '#991B1B',
    fontFamily: FONT.semibold,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionCard: {
    gap: 10,
    padding: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: UI.ink,
    flex: 1,
    fontFamily: FONT.extrabold,
    fontSize: 15,
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  labMetaBox: {
    gap: 8,
  },
  targetPreviewBox: {
    backgroundColor: UI.soft,
    borderRadius: 12,
    gap: 6,
    padding: 10,
  },
  targetMembersSummary: {
    color: UI.ink,
    fontFamily: FONT.medium,
    fontSize: 12,
    lineHeight: 17,
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
  emptyTargetBox: {
    backgroundColor: UI.soft,
    borderRadius: 14,
    gap: 4,
    padding: 12,
  },
  emptyTargetTitle: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  listTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  listTitleCol: {
    flex: 1,
    gap: 2,
  },
  selectAllBtn: {
    backgroundColor: UI.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectAllBtnText: {
    color: UI.onColor,
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  disabledOpacity: {
    opacity: 0.4,
  },
  searchInput: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 14,
    borderWidth: 1,
    color: UI.ink,
    fontFamily: FONT.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  emptyListBox: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 18,
  },
  membersList: {
    gap: 8,
  },
  memberRow: {
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderColor: UI.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  memberRowSelected: {
    backgroundColor: '#FFF7ED',
    borderColor: UI.accent,
    borderWidth: 1.5,
  },
  memberRowBlocked: {
    backgroundColor: UI.soft,
    opacity: 0.65,
  },
  checkboxBox: {
    alignItems: 'center',
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 7,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxBoxChecked: {
    backgroundColor: UI.accent,
    borderColor: UI.accent,
  },
  checkboxBoxDisabled: {
    backgroundColor: UI.line,
    borderColor: UI.line,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  memberMeta: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  alreadyTargetText: {
    color: '#9A3412',
    fontFamily: FONT.semibold,
    fontSize: 11,
  },
  pressed: {
    opacity: 0.72,
  },
  bottomBar: {
    backgroundColor: UI.page,
    borderTopColor: UI.line,
    borderTopWidth: 1,
    gap: 8,
    paddingBottom: 16,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  bottomInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  bottomLabel: {
    color: UI.ink,
    flex: 1,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
  bottomCount: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 12,
  },
});
