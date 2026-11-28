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
  transferPraktikan,
  type LabMember,
  type TransferMembersResult,
} from '@/services/lab-members-service';
import type { Laboratory } from '@/types/laboratory';

const EMPTY_USERS_MAP: UsersLookupMap = buildUsersLookupMap([]);

function isAslabRole(rawRole: unknown): boolean {
  return typeof rawRole === 'string' && rawRole.trim().toUpperCase() === 'ASLAB';
}

function CheckboxIcon({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
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
 * Layar khusus Pindah Praktikan antar laboratorium dalam satu mata kuliah (FR-09) untuk Aslab.
 */
export default function TransferPraktikanScreen() {
  const { labId: routeLabId } = useLocalSearchParams<{ labId?: string }>();
  const initialSourceLabId =
    (Array.isArray(routeLabId) ? routeLabId[0] : routeLabId)?.trim() ?? '';

  const { profile, loading: authLoading } = useAuth();
  const isAuthorized = isAslabRole(profile?.role);

  // Daftar lab & konteks pengguna
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [usersMap, setUsersMap] = useState<UsersLookupMap>(EMPTY_USERS_MAP);

  const [sourceLabId, setSourceLabId] = useState<string>(initialSourceLabId);
  const [targetLabId, setTargetLabId] = useState<string>('');

  // Daftar praktikan aktif real-time di lab asal
  const [sourceMembers, setSourceMembers] = useState<LabMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Status proses & umpan balik
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

  // Filter ketat lab tujuan: wajib mataKuliahId SAMA persis dan bukan lab asal
  const eligibleTargetLabs = useMemo(() => {
    const sourceCourse = (sourceLab?.mataKuliahId ?? '').trim().toLowerCase();
    if (!sourceLab || !sourceCourse) {
      return [] as Laboratory[];
    }

    return laboratories.filter((lab) => {
      if (lab.id === sourceLab.id) return false;
      const candidateCourse = (lab.mataKuliahId ?? '').trim().toLowerCase();
      return candidateCourse.length > 0 && candidateCourse === sourceCourse;
    });
  }, [laboratories, sourceLab]);

  // Sinkronkan targetLabId saat lab asal atau daftar lab tujuan berubah
  useEffect(() => {
    if (eligibleTargetLabs.length === 0) {
      setTargetLabId('');
      return;
    }

    setTargetLabId((current: string) => {
      if (current && eligibleTargetLabs.some((lab) => lab.id === current)) {
        return current;
      }
      return eligibleTargetLabs[0].id;
    });
  }, [eligibleTargetLabs]);

  const targetLab = useMemo(
    () => eligibleTargetLabs.find((lab) => lab.id === targetLabId) ?? null,
    [eligibleTargetLabs, targetLabId],
  );

  // 2. Subscribe real-time praktikan aktif pada lab asal
  useEffect(() => {
    if (authLoading || !isAuthorized || !sourceLabId) {
      setSourceMembers([]);
      setSelectedUserIds([]);
      setMembersLoading(false);
      return;
    }

    let active = true;
    setMembersLoading(true);
    setSelectedUserIds([]);

    const unsubMembers = subscribeActiveLabMembers(
      sourceLabId,
      (members) => {
        if (!active) return;
        setSourceMembers(members);
        const activeIdSet = new Set(members.map((item) => item.userId));
        setSelectedUserIds((prev) => prev.filter((uid) => activeIdSet.has(uid)));
        setMembersLoading(false);
      },
      (err) => {
        if (!active) return;
        setPageError(err.message);
        setMembersLoading(false);
      },
      LAB_MEMBER_ROLES.PRAKTIKAN,
    );

    return () => {
      active = false;
      unsubMembers();
    };
  }, [authLoading, isAuthorized, sourceLabId, retryNonce]);

  const sourceLabOptions: DropdownOption[] = useMemo(
    () =>
      laboratories.map((lab) => ({
        value: lab.id,
        label: lab.nama,
        detail: lab.mataKuliahId
          ? `Mata Kuliah: ${lab.mataKuliahId}`
          : 'Belum punya mataKuliahId',
      })),
    [laboratories],
  );

  const targetLabOptions: DropdownOption[] = useMemo(
    () =>
      eligibleTargetLabs.map((lab) => ({
        value: lab.id,
        label: lab.nama,
        detail: lab.lokasi
          ? `${lab.mataKuliahId ?? ''} • ${lab.lokasi}`
          : lab.mataKuliahId ?? undefined,
      })),
    [eligibleTargetLabs],
  );

  const enrichedPraktikan = useMemo(() => {
    return sourceMembers
      .filter(
        (member) =>
          member.aktif && member.peran === LAB_MEMBER_ROLES.PRAKTIKAN,
      )
      .map((member) => {
        const user = usersMap.byUid.get(member.userId);
        return {
          member,
          userId: member.userId,
          nama: user?.nama || `UID: ${member.userId}`,
          nim: user?.nim ?? '-',
          email: user?.email ?? '-',
        };
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [sourceMembers, usersMap]);

  const filteredPraktikan = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return enrichedPraktikan;
    return enrichedPraktikan.filter(
      (item) =>
        item.nama.toLowerCase().includes(q) ||
        item.nim.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q),
    );
  }, [enrichedPraktikan, searchQuery]);

  const selectedSet = useMemo(
    () => new Set(selectedUserIds),
    [selectedUserIds],
  );

  const areAllFilteredSelected =
    filteredPraktikan.length > 0 &&
    filteredPraktikan.every((item) => selectedSet.has(item.userId));

  function handleToggleUser(userId: string) {
    setTransferFeedback(null);
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      if (prev.length >= MAX_ATOMIC_TRANSFER_USERS) {
        setPageError(
          `Maksimal ${MAX_ATOMIC_TRANSFER_USERS} praktikan per satu pemindahan atomik.`,
        );
        return prev;
      }
      return [...prev, userId];
    });
  }

  function handleToggleSelectAllFiltered() {
    setTransferFeedback(null);
    setPageError(null);

    if (areAllFilteredSelected) {
      const filteredIds = new Set(filteredPraktikan.map((item) => item.userId));
      setSelectedUserIds((prev) => prev.filter((id) => !filteredIds.has(id)));
      return;
    }

    const next = new Set(selectedUserIds);
    for (const item of filteredPraktikan) {
      if (next.size >= MAX_ATOMIC_TRANSFER_USERS) {
        setPageError(
          `Hanya ${MAX_ATOMIC_TRANSFER_USERS} praktikan pertama yang dipilih sesuai batas batch atomik.`,
        );
        break;
      }
      next.add(item.userId);
    }
    setSelectedUserIds(Array.from(next));
  }

  const selectedNamesPreview = useMemo(() => {
    const names = enrichedPraktikan
      .filter((item) => selectedSet.has(item.userId))
      .map((item) => `${item.nama} (${item.nim})`);
    if (names.length <= 5) {
      return names.join(', ');
    }
    const firstFive = names.slice(0, 5).join(', ');
    return `${firstFive}, dan ${names.length - 5} praktikan lainnya`;
  }, [enrichedPraktikan, selectedSet]);

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
      const result = await transferPraktikan(
        sourceLab.id,
        targetLab.id,
        selectedUserIds,
      );

      if (result.error || result.transferredCount === 0) {
        setTransferFeedback({
          ok: false,
          message:
            result.error ?? 'Pemindahan praktikan gagal dijalankan.',
          result,
        });
        return;
      }

      setSelectedUserIds([]);
      setTransferFeedback({
        ok: true,
        message: `${result.transferredCount} praktikan berhasil dipindahkan dari "${result.sourceLabName}" ke "${result.targetLabName}".`,
        result,
      });
    } catch (error) {
      setTransferFeedback({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan saat memindahkan praktikan.',
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
          Halaman Pindah Praktikan hanya dapat diakses oleh Asisten Lab (Aslab).
        </Text>
        <PillButton label="Kembali" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const hasSourceCourse = Boolean((sourceLab?.mataKuliahId ?? '').trim());

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
            title="Pindah Praktikan"
            subtitle="Pindahkan 1 atau banyak praktikan ke laboratorium lain dalam mata kuliah yang sama."
          />

          {/* CATATAN INFORMASI JADWAL */}
          <View style={styles.infoNoticeBox}>
            <Text style={styles.infoNoticeTitle}>Catatan Penting</Text>
            <Text style={styles.infoNoticeText}>
              Jadwal praktikum tidak ikut berpindah. Pemindahan ini hanya
              memperbarui keanggotaan praktikan secara atomik pada lab asal dan
              lab tujuan.
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

          {/* BAGIAN 1: LAB ASAL & MATA KULIAH */}
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
                  {sourceLab.mataKuliahId ? (
                    <Chip
                      label={`Mata Kuliah: ${sourceLab.mataKuliahId}`}
                      tone="accent"
                    />
                  ) : (
                    <Chip label="Mata Kuliah Belum Diatur" tone="soft" />
                  )}
                  <Chip
                    label={`${enrichedPraktikan.length} Praktikan Aktif`}
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

                {!hasSourceCourse ? (
                  <Text style={styles.warningText}>
                    Laboratorium asal belum memiliki mataKuliahId, sehingga
                    praktikan tidak dapat dipindahkan.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </SoftCard>

          {/* BAGIAN 2: LAB TUJUAN (MATA KULIAH SAMA) */}
          <SoftCard style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Chip label="LAB TUJUAN" tone="accent" />
              <Text style={styles.sectionTitle}>
                Laboratorium Tujuan (Mata Kuliah Sama)
              </Text>
            </View>

            {!sourceLab ? (
              <Text style={styles.mutedLeft}>
                Pilih laboratorium asal terlebih dahulu.
              </Text>
            ) : !hasSourceCourse ? (
              <View style={styles.emptyTargetBox}>
                <Text style={styles.emptyTargetTitle}>
                  Mata Kuliah Lab Asal Kosong
                </Text>
                <Text style={styles.mutedLeft}>
                  Atur kode mata kuliah pada lab asal dan lab tujuan terlebih
                  dahulu sebelum memindahkan praktikan.
                </Text>
              </View>
            ) : eligibleTargetLabs.length === 0 ? (
              <View style={styles.emptyTargetBox}>
                <Text style={styles.emptyTargetTitle}>
                  Belum Ada Lab Tujuan di Mata Kuliah {sourceLab.mataKuliahId}
                </Text>
                <Text style={styles.mutedLeft}>
                  Tidak ditemukan laboratorium lain dengan mata kuliah yang sama
                  ({sourceLab.mataKuliahId}). Pemindahan dinonaktifkan.
                </Text>
              </View>
            ) : (
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
            )}
          </SoftCard>

          {/* BAGIAN 3: DAFTAR PRAKTIKAN AKTIF (MULTI-SELECT) */}
          <SoftCard style={styles.sectionCard}>
            <View style={styles.listTopRow}>
              <View style={styles.listTitleCol}>
                <Text style={styles.sectionTitle}>
                  Praktikan Aktif di Lab Asal
                </Text>
                <Text style={styles.mutedSmall}>
                  {selectedUserIds.length} dipilih dari{' '}
                  {enrichedPraktikan.length} praktikan
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={filteredPraktikan.length === 0 || transferring}
                onPress={handleToggleSelectAllFiltered}
                style={({ pressed }) => [
                  styles.selectAllBtn,
                  filteredPraktikan.length === 0 && styles.disabledOpacity,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.selectAllBtnText}>
                  {areAllFilteredSelected ? 'Batal Pilih' : 'Pilih Semua'}
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari nama, NIM, atau email praktikan..."
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.searchInput}
            />

            {membersLoading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color={UI.ink} />
                <Text style={styles.mutedSmall}>
                  Memuat daftar praktikan aktif...
                </Text>
              </View>
            ) : filteredPraktikan.length === 0 ? (
              <View style={styles.emptyListBox}>
                <Text style={styles.emptyTargetTitle}>
                  {searchQuery.trim()
                    ? 'Praktikan Tidak Ditemukan'
                    : 'Belum Ada Praktikan Aktif'}
                </Text>
                <Text style={styles.mutedText}>
                  {searchQuery.trim()
                    ? 'Coba kata kunci nama atau NIM lain.'
                    : 'Tidak ada praktikan berstatus aktif di laboratorium asal ini.'}
                </Text>
              </View>
            ) : (
              <View style={styles.membersList}>
                {filteredPraktikan.map((item) => {
                  const checked = selectedSet.has(item.userId);

                  return (
                    <Pressable
                      key={item.userId}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      disabled={transferring}
                      onPress={() => handleToggleUser(item.userId)}
                      style={({ pressed }) => [
                        styles.memberRow,
                        checked && styles.memberRowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <CheckboxIcon checked={checked} />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.nama}</Text>
                        <Text style={styles.memberMeta}>
                          NIM: {item.nim} • {item.email}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </SoftCard>
        </ScrollView>

        {/* BOTTOM CTA */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomLabel}>
              {sourceLab?.nama ?? '-'} → {targetLab?.nama ?? 'Belum ada tujuan'}
            </Text>
            <Text style={styles.bottomCount}>
              {selectedUserIds.length} terpilih
            </Text>
          </View>
          <PillButton
            label={`Pindahkan Praktikan (${selectedUserIds.length} Terpilih)`}
            variant="accent"
            loading={transferring}
            disabled={!canTransfer}
            onPress={() => setConfirmVisible(true)}
          />
        </View>
      </View>

      <ConfirmModal
        visible={confirmVisible}
        title="Konfirmasi Pindah Praktikan"
        message={`Pindahkan ${selectedUserIds.length} praktikan (${selectedNamesPreview}) dari "${sourceLab?.nama ?? ''}" ke "${targetLab?.nama ?? ''}"? Jadwal praktikum tidak ikut berpindah.`}
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
  warningText: {
    color: UI.danger,
    fontFamily: FONT.semibold,
    fontSize: 12,
    lineHeight: 18,
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
