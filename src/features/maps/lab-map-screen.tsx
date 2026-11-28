import { router, type Href } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, {
  Circle,
  Marker,
  type LatLng,
  type Region,
} from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';

import StatusBadge from '@/components/common/StatusBadge';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import {
  ensureDefaultLaboratories,
  subscribeLaboratories,
  type LaboratoryId,
  type LaboratoryLocation,
} from '@/features/assistant/services/laboratory-service';
import { TAB_BAR_SPACE } from '@/features/praktikan/ui/praktikan-ui';
import { useLabRealtimeActivities } from '@/hooks/use-lab-realtime-activities';
import { useUserLocationTracking } from '@/hooks/use-user-location-tracking';
import type {
  LabActivityItem,
  LabActivitySessionStatus,
} from '@/services/lab-activities-service';
import { openAppLocationSettings } from '@/services/location-service';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import MapsUnavailable from '@/features/maps/maps-unavailable';
import { isAssistantRole } from '@/types/user';

const INITIAL_REGION: Region = {
  latitude: -7.0486375,
  longitude: 110.441125,
  latitudeDelta: 0.004,
  longitudeDelta: 0.004,
};

const USER_FOCUS_DELTA = 0.0025;

/** Jarak tombol bulat dari bawah: tepat di atas navbar melayang. */
const FAB_BOTTOM = TAB_BAR_SPACE - 12;

const FIT_EDGE_PADDING = {
  top: 96,
  right: 56,
  // Ruang navbar melayang di bawah peta.
  bottom: 96 + TAB_BAR_SPACE,
  left: 56,
};

function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function isValidRadius(radius: unknown): radius is number {
  return typeof radius === 'number' && Number.isFinite(radius) && radius > 0;
}

function isValidLabLocation(lab: LaboratoryLocation): boolean {
  return (
    isValidCoordinate(lab.latitude, lab.longitude) && isValidRadius(lab.radius)
  );
}

function getFocusDeltaForRadius(radiusMeters: number): number {
  return Math.max(0.002, (radiusMeters * 4.5) / 111000);
}

function LabChipStrip({
  laboratories,
  selectedLabId,
  onSelect,
  elevated = false,
}: {
  laboratories: LaboratoryLocation[];
  selectedLabId: LaboratoryId | null;
  onSelect: (lab: LaboratoryLocation) => void;
  elevated?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.topChipList}
    >
      {laboratories.map((lab) => {
        const isSelected = selectedLabId === lab.id;

        return (
          <Pressable
            key={lab.id}
            accessibilityRole="button"
            onPress={() => onSelect(lab)}
            style={({ pressed }) => [
              styles.labChip,
              elevated && styles.floatingChipShadow,
              isSelected && styles.labChipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.labChipText,
                isSelected && styles.labChipTextSelected,
              ]}
            >
              {lab.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CloseIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6L18 18M18 6L6 18"
        stroke="#444444"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Ikon roda gigi untuk tombol "Atur Lokasi". */
function SettingsIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx={12} cy={12} r={3} stroke="#111014" strokeWidth={1.8} />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="#111014"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Ikon pin lokasi merah untuk tombol "Pusatkan". */
function PinIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21C12 21 19 14.9 19 9.5C19 5.4 15.9 2.5 12 2.5C8.1 2.5 5 5.4 5 9.5C5 14.9 12 21 12 21Z"
        stroke="#E00000"
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <SvgCircle cx={12} cy={9.5} r={2.6} stroke="#E00000" strokeWidth={1.9} />
    </Svg>
  );
}

function MyLocationIcon({ color = '#0284C7' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <SvgCircle
        cx={12}
        cy={12}
        r={7}
        stroke={color}
        strokeWidth={2}
      />
      <SvgCircle cx={12} cy={12} r={2.5} fill={color} />
      <Path
        d="M12 2V5M12 19V22M2 12H5M19 12H22"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ActivityStatusBadge({
  status,
}: {
  status: LabActivitySessionStatus;
}) {
  if (status === 'jadwal_rutin') {
    return (
      <View style={styles.routineBadge}>
        <Text style={styles.routineBadgeText}>TERJADWAL</Text>
      </View>
    );
  }

  return <StatusBadge status={status} />;
}

function LabActivityBox({
  sectionTitle,
  item,
  emptyMessage,
  extraCount = 0,
  isOngoing = false,
}: {
  sectionTitle: string;
  item: LabActivityItem | null;
  emptyMessage: string;
  extraCount?: number;
  isOngoing?: boolean;
}) {
  return (
    <View style={styles.activityGroup}>
      <View style={styles.activityGroupHeader}>
        <Text style={styles.activityGroupTitle}>{sectionTitle}</Text>
        {extraCount > 0 ? (
          <Text style={styles.activityExtraCount}>+{extraCount} lainnya</Text>
        ) : null}
      </View>

      {item ? (
        <View
          style={[
            styles.activityItemCard,
            isOngoing && styles.activityItemCardOngoing,
          ]}
        >
          <View style={styles.activityItemHeader}>
            <Text style={styles.activityPracticumName}>
              {item.practicumName}
            </Text>
            <ActivityStatusBadge status={item.status} />
          </View>

          <View style={styles.activityMetaList}>
            <View style={styles.activityMetaRow}>
              <Text style={styles.activityMetaLabel}>Kelas</Text>
              <Text style={styles.activityMetaValue}>{item.className}</Text>
            </View>

            <View style={styles.activityMetaRow}>
              <Text style={styles.activityMetaLabel}>Waktu</Text>
              <Text style={styles.activityMetaValue}>{item.scheduleTime}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.activityEmptyCard}>
          <Text style={styles.activityEmptyText}>{emptyMessage}</Text>
        </View>
      )}
    </View>
  );
}

function LabDetailCard({
  lab,
  onClose,
  ongoingActivity,
  nextActivity,
  ongoingCount,
  upcomingCount,
  activitiesLoading,
  activitiesError,
  onRetryActivities,
}: {
  lab: LaboratoryLocation;
  onClose: () => void;
  ongoingActivity: LabActivityItem | null;
  nextActivity: LabActivityItem | null;
  ongoingCount: number;
  upcomingCount: number;
  activitiesLoading: boolean;
  activitiesError: string | null;
  onRetryActivities: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const cardMaxHeight = Math.max(
    260,
    Math.min(440, Math.round(windowHeight * 0.54)),
  );

  return (
    <View style={[styles.detailCard, { maxHeight: cardMaxHeight }]}>
      <View style={styles.detailHandle} />

      {/* HEADER PANEL TETAP DI ATAS AGAR TOMBOL TUTUP TIDAK PERNAH TERTUTUP SCROLL */}
      <View style={styles.detailHeader}>
        <View style={styles.detailTitleGroup}>
          <Text style={styles.detailEyebrow}>DETAIL LABORATORIUM</Text>
          <Text style={styles.detailName}>{lab.name}</Text>
        </View>

        <Pressable
          accessibilityLabel="Tutup detail laboratorium"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <CloseIcon />
        </Pressable>
      </View>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <View style={styles.metricBox}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>LATITUDE</Text>
            <Text style={styles.metricValue}>{lab.latitude.toFixed(6)}</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>LONGITUDE</Text>
            <Text style={styles.metricValue}>{lab.longitude.toFixed(6)}</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>RADIUS PRESENSI</Text>
            <Text style={styles.metricValue}>{lab.radius} meter</Text>
          </View>
        </View>

        <View style={styles.activitiesContainer}>
          <Text style={styles.activitiesSectionHeading}>
            Aktivitas Praktikum
          </Text>

          {activitiesLoading ? (
            <View style={styles.activitiesLoadingBox}>
              <View style={styles.activitiesLoadingHeader}>
                <ActivityIndicator size="small" color="#000000" />
                <Text style={styles.activitiesStateText}>
                  Memuat aktivitas praktikum...
                </Text>
              </View>
              <View style={styles.activitySkeletonRow}>
                <View style={styles.activitySkeletonLineWide} />
                <View style={styles.activitySkeletonLineShort} />
              </View>
            </View>
          ) : activitiesError ? (
            <View style={styles.activitiesErrorBox}>
              <View style={styles.activitiesErrorTextGroup}>
                <Text style={styles.activitiesErrorTitle}>
                  Gagal Memuat Aktivitas
                </Text>
                <Text style={styles.activitiesErrorText}>
                  {activitiesError}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onRetryActivities}
                style={({ pressed }) => [
                  styles.activitiesRetryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.activitiesRetryText}>Coba Lagi</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.activitiesListGap}>
              <LabActivityBox
                sectionTitle="Sedang Berlangsung"
                item={ongoingActivity}
                emptyMessage="Tidak ada praktikum yang sedang berlangsung saat ini."
                extraCount={Math.max(0, ongoingCount - 1)}
                isOngoing
              />

              <LabActivityBox
                sectionTitle="Praktikum Berikutnya"
                item={nextActivity}
                emptyMessage="Belum ada jadwal praktikum berikutnya di laboratorium ini."
                extraCount={Math.max(0, upcomingCount - 1)}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Google Maps di Android butuh API key yang ditanam saat build. Tanpa key, MapView
 * langsung crash di sisi native (tidak bisa ditangkap error boundary JS), jadi key
 * dicek dulu sebelum peta dirender. Expo Go sudah membawa key sendiri, dan iOS
 * memakai Apple Maps, jadi keduanya tidak perlu dicek.
 */
function isGoogleMapsUnavailable(): boolean {
  if (Platform.OS !== 'android') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return Constants.expoConfig?.extra?.googleMapsConfigured !== true;
}

export default function MapsScreen() {
  if (isGoogleMapsUnavailable()) {
    return (
      <MapsUnavailable
        title="Peta Belum Dapat Dimuat"
        message="Aplikasi ini belum dikonfigurasi dengan API key Google Maps, jadi peta laboratorium belum bisa ditampilkan."
      />
    );
  }

  return <LabMap />;
}

function LabMap() {
  const {
    user,
    role,
    status: authStatus,
    loading: authLoading,
  } = useAuth();

  const mapRef = useRef<MapView | null>(null);
  // Tinggi kartu detail lab, supaya tombol bulat di kanan bawah tetap di atasnya.
  const [detailHeight, setDetailHeight] = useState(0);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const hasAutoFittedRef = useRef(false);

  const [laboratories, setLaboratories] = useState<LaboratoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const [selectedLabId, setSelectedLabId] = useState<LaboratoryId | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLayoutReady, setMapLayoutReady] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);

  const isUserLocationTrackingEnabled =
    !authLoading && authStatus === 'authenticated' && Boolean(user);

  const {
    userLocation,
    permissionStatus: locationPermissionStatus,
    isLocationServiceEnabled,
    isSearchingLocation,
    errorMessage: locationError,
    canAskPermissionAgain,
    retryLocation,
  } = useUserLocationTracking({
    enabled: isUserLocationTrackingEnabled,
  });

  useEffect(() => {
    if (userLocation && isLocationServiceEnabled) {
      setLocationFeedback(null);
    }
  }, [userLocation, isLocationServiceEnabled]);

  useEffect(() => {
    if (!locationFeedback) {
      return;
    }

    const timer = setTimeout(() => {
      setLocationFeedback(null);
    }, 3200);

    return () => {
      clearTimeout(timer);
    };
  }, [locationFeedback]);

  const validLaboratories = useMemo(
    () => laboratories.filter(isValidLabLocation),
    [laboratories],
  );

  const selectedLab = useMemo(
    () =>
      validLaboratories.find((lab) => lab.id === selectedLabId) ?? null,
    [validLaboratories, selectedLabId],
  );

  const {
    ongoingActivity,
    nextActivity,
    ongoingActivities,
    upcomingActivities,
    loading: activitiesLoading,
    error: activitiesError,
    retry: retryActivities,
  } = useLabRealtimeActivities(selectedLab?.id ?? null);

  const handleRetry = useCallback(() => {
    setError(null);
    setRetryNonce((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (authLoading || authStatus === 'loading') {
      setLoading(true);
      setError(null);
      return;
    }

    if (authStatus !== 'authenticated' || !user) {
      setLaboratories([]);
      setLoading(false);
      setError('Silakan login terlebih dahulu untuk melihat peta laboratorium.');
      return;
    }

    let active = true;
    let seeding = isAssistantRole(role);
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeLaboratories(
      (data) => {
        if (!active) return;
        setLaboratories(data);
        setError(null);
        if (!seeding || data.length > 0) {
          setLoading(false);
        }
      },
      (firebaseError) => {
        if (!active) return;
        setError(firebaseError.message);
        setLoading(false);
      },
    );

    if (isAssistantRole(role)) {
      ensureDefaultLaboratories()
        .then(() => {
          if (!active) return;
          seeding = false;
          setLoading(false);
        })
        .catch((seedError: unknown) => {
          if (!active) return;
          seeding = false;
          setLoading(false);
          setError(
            seedError instanceof Error
              ? seedError.message
              : 'Gagal menginisialisasi data laboratorium.',
          );
        });
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, authStatus, user, role, retryNonce]);

  const centerMapOnLaboratories = useCallback(
    (labs: LaboratoryLocation[], animated: boolean) => {
      if (Platform.OS === 'web' || !mapRef.current || labs.length === 0) {
        return;
      }

      if (labs.length === 1) {
        const onlyLab = labs[0];
        mapRef.current.animateToRegion(
          {
            latitude: onlyLab.latitude,
            longitude: onlyLab.longitude,
            latitudeDelta: 0.0025,
            longitudeDelta: 0.0025,
          },
          animated ? 350 : 0,
        );
        return;
      }

      const coordinates: LatLng[] = labs.map((lab) => ({
        latitude: lab.latitude,
        longitude: lab.longitude,
      }));

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: FIT_EDGE_PADDING,
        animated,
      });
    },
    [],
  );

  useEffect(() => {
    if (
      Platform.OS === 'web' ||
      !mapReady ||
      !mapLayoutReady ||
      validLaboratories.length === 0 ||
      hasAutoFittedRef.current
    ) {
      return;
    }

    hasAutoFittedRef.current = true;
    centerMapOnLaboratories(validLaboratories, false);
  }, [mapReady, mapLayoutReady, validLaboratories, centerMapOnLaboratories]);

  /**
   * Selisih lintang agar titik lab berada di tengah ruang antara chip lab di atas
   * dan kartu detail di bawah, bukan di tengah layar.
   */
  function labFocusLatitudeOffset(delta: number): number {
    const { width, height } = mapSize;
    if (width === 0 || height === 0) return delta * 0.2;

    // Region persegi pada layar tegak: lebar peta = delta, tinggi = delta * h/w.
    const visibleLatSpan = delta * Math.max(1, height / width);
    // Kartu belum terukur saat pertama dipilih: pakai perkiraan tingginya.
    const cardHeight = detailHeight > 0 ? detailHeight : 280;
    const topCovered = 60; // baris chip lab
    const bottomCovered = FAB_BOTTOM + cardHeight;
    const targetY = (topCovered + Math.max(topCovered, height - bottomCovered)) / 2;
    const shiftPx = height / 2 - targetY;
    return (shiftPx / height) * visibleLatSpan;
  }

  function handleSelectLab(lab: LaboratoryLocation) {
    setSelectedLabId(lab.id);

    if (Platform.OS !== 'web' && mapRef.current && mapReady) {
      const focusDelta = getFocusDeltaForRadius(lab.radius);
      mapRef.current.animateToRegion(
        {
          // Geser pusat ke selatan supaya titik lab tampil di tengah area peta
          // yang tidak tertutup kartu detail (kartu muncul di bagian bawah).
          latitude: lab.latitude - labFocusLatitudeOffset(focusDelta),
          longitude: lab.longitude,
          latitudeDelta: focusDelta,
          longitudeDelta: focusDelta,
        },
        350,
      );
    }
  }

  function handleCloseDetail() {
    setSelectedLabId(null);
  }

  function handleResetMap() {
    setSelectedLabId(null);
    if (validLaboratories.length > 0) {
      centerMapOnLaboratories(validLaboratories, true);
      return;
    }

    if (Platform.OS !== 'web' && mapRef.current && mapReady) {
      mapRef.current.animateToRegion(INITIAL_REGION, 350);
    }
  }

  async function handleOpenLocationSettings() {
    try {
      await openAppLocationSettings();
    } catch {
      Alert.alert(
        'Gagal Membuka Pengaturan',
        'Buka pengaturan perangkat secara manual untuk mengaktifkan izin lokasi SiPrak.',
      );
    }
  }

  function handleFocusUserLocation() {
    if (locationPermissionStatus === 'denied') {
      const deniedMessage = canAskPermissionAgain
        ? 'Izin lokasi ditolak. Izinkan akses lokasi agar kamera dapat diarahkan ke posisi Anda.'
        : 'Izin lokasi ditolak permanen. Buka Pengaturan perangkat untuk mengaktifkan izin lokasi SiPrak.';

      setLocationFeedback(deniedMessage);
      Alert.alert('Izin Lokasi Diperlukan', deniedMessage, [
        { text: 'Tutup', style: 'cancel' },
        { text: 'Izinkan / Coba Lagi', onPress: retryLocation },
        {
          text: 'Buka Pengaturan',
          onPress: () => {
            void handleOpenLocationSettings();
          },
        },
      ]);
      return;
    }

    if (!isLocationServiceEnabled) {
      const gpsMessage =
        'Layanan lokasi (GPS) perangkat sedang tidak aktif. Aktifkan GPS terlebih dahulu lalu tekan Muat Ulang.';

      setLocationFeedback(gpsMessage);
      Alert.alert('Layanan GPS Nonaktif', gpsMessage, [
        { text: 'Tutup', style: 'cancel' },
        { text: 'Muat Ulang', onPress: retryLocation },
      ]);
      return;
    }

    if (!userLocation) {
      if (!isSearchingLocation) {
        retryLocation();
      }
      setLocationFeedback(
        'Sedang mencari lokasi Anda... Coba tekan lagi setelah sinyal GPS ditemukan.',
      );
      return;
    }

    if (Platform.OS !== 'web' && (!mapRef.current || !mapReady)) {
      setLocationFeedback('Peta masih dimuat, silakan coba sesaat lagi.');
      return;
    }

    setLocationFeedback(null);

    if (Platform.OS !== 'web' && mapRef.current && mapReady) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: USER_FOCUS_DELTA,
          longitudeDelta: USER_FOCUS_DELTA,
        },
        400,
      );
    }
  }

  const showInitialLoading = loading && validLaboratories.length === 0;
  const showFatalError =
    Boolean(error) && validLaboratories.length === 0 && !loading;

  const selectedLabDetailCard = selectedLab ? (
    <View
      style={styles.floatingDetailContainer}
      pointerEvents="box-none"
      onLayout={(event) => setDetailHeight(event.nativeEvent.layout.height)}
    >
      <LabDetailCard
        lab={selectedLab}
        onClose={handleCloseDetail}
        ongoingActivity={ongoingActivity}
        nextActivity={nextActivity}
        ongoingCount={ongoingActivities.length}
        upcomingCount={upcomingActivities.length}
        activitiesLoading={activitiesLoading}
        activitiesError={activitiesError}
        onRetryActivities={retryActivities}
      />
    </View>
  ) : null;

  // Tombol bulat di kanan bawah, di atas navbar (dan di atas kartu detail bila terbuka).
  const mapFabs = (
    <View
      pointerEvents="box-none"
      style={[
        styles.fabColumn,
        { bottom: FAB_BOTTOM + (selectedLab ? detailHeight + 10 : 0) },
      ]}
    >
      {/* Asisten mengatur koordinat & radius 4 titik lokasi (FR-10, FR-11) dari peta. */}
      {isAssistantRole(role) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atur lokasi laboratorium"
          onPress={() => router.push('/assistant/laboratories' as Href)}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <SettingsIcon />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pusatkan peta ke semua laboratorium"
        onPress={handleResetMap}
        disabled={validLaboratories.length === 0 && !mapReady}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <PinIcon />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER (sama dengan tab lain: judul besar, tanpa tombol kembali) */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.title}>Peta Laboratorium</Text>
        </View>
      </View>

      {/* BANNER ERROR PARSIAL */}
      {error && validLaboratories.length > 0 ? (
        <View style={styles.inlineErrorBanner}>
          <Text style={styles.inlineErrorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleRetry}
            style={({ pressed }) => [
              styles.inlineRetryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.inlineRetryText}>Coba Lagi</Text>
          </Pressable>
        </View>
      ) : null}

      {/* BANNER STATUS IZIN & GPS PENGGUNA (NON-BLOCKING) */}
      {locationPermissionStatus === 'denied' ? (
        <View style={styles.locationWarningBannerStacked}>
          <Text style={styles.locationWarningText}>
            {locationError ??
              (canAskPermissionAgain
                ? 'Izin akses lokasi ditolak. Izinkan akses lokasi agar posisi Anda dapat ditampilkan di peta.'
                : 'Izin akses lokasi ditolak permanen. Buka Pengaturan perangkat untuk mengaktifkan izin lokasi.')}
            {!isLocationServiceEnabled
              ? ' Pastikan juga layanan GPS perangkat aktif.'
              : ''}
          </Text>
          <View style={styles.locationBannerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={retryLocation}
              style={({ pressed }) => [
                styles.locationWarningButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.locationWarningButtonText}>
                Izinkan / Coba Lagi
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => void handleOpenLocationSettings()}
              style={({ pressed }) => [
                styles.locationSecondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.locationSecondaryButtonText}>
                Buka Pengaturan
              </Text>
            </Pressable>
          </View>
        </View>
      ) : locationPermissionStatus === 'granted' &&
        !isLocationServiceEnabled ? (
        <View style={styles.locationWarningBanner}>
          <Text
            style={[styles.locationWarningText, styles.locationWarningTextInline]}
          >
            {locationError ??
              'Layanan lokasi (GPS) perangkat tidak aktif. Aktifkan GPS di perangkat Anda lalu tekan Muat Ulang.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={retryLocation}
            style={({ pressed }) => [
              styles.locationWarningButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.locationWarningButtonText}>Muat Ulang</Text>
          </Pressable>
        </View>
      ) : locationError ? (
        <View style={styles.locationWarningBanner}>
          <Text
            style={[styles.locationWarningText, styles.locationWarningTextInline]}
          >
            {locationError}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={retryLocation}
            style={({ pressed }) => [
              styles.locationWarningButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.locationWarningButtonText}>Muat Ulang</Text>
          </Pressable>
        </View>
      ) : null}

      {/* AREA PETA */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={styles.webWrapper}>
            <ScrollView contentContainerStyle={styles.webContent}>
              <View style={styles.webNoticeCard}>
                <Text style={styles.webNoticeTitle}>
                  Peta Interaktif Android & iOS
                </Text>
                <Text style={styles.webNoticeText}>
                  Komponen MapView aktif pada perangkat Android dan iOS. Pilih
                  salah satu laboratorium di bawah untuk melihat detailnya:
                </Text>
              </View>

              {locationPermissionStatus === 'granted' &&
              isLocationServiceEnabled &&
              isSearchingLocation &&
              !userLocation ? (
                <View style={styles.webUserLocationCard}>
                  <View style={styles.webUserLocationHeader}>
                    <ActivityIndicator size="small" color="#0284C7" />
                    <Text style={styles.webUserLocationTitle}>
                      Mencari lokasi Anda...
                    </Text>
                  </View>
                </View>
              ) : userLocation ? (
                <View style={styles.webUserLocationCard}>
                  <View style={styles.webUserLocationHeader}>
                    <View style={styles.gpsLiveDot} />
                    <Text style={styles.webUserLocationTitle}>
                      Lokasi Anda (Real-time)
                    </Text>
                  </View>
                  <Text style={styles.webUserLocationCoords}>
                    {userLocation.latitude.toFixed(6)},{' '}
                    {userLocation.longitude.toFixed(6)}
                    {userLocation.accuracy !== null
                      ? ` · Akurasi ±${Math.round(userLocation.accuracy)} m`
                      : ''}
                  </Text>
                </View>
              ) : null}

              {validLaboratories.length > 0 ? (
                <View style={styles.webChipStripWrapper}>
                  <LabChipStrip
                    laboratories={validLaboratories}
                    selectedLabId={selectedLabId}
                    onSelect={handleSelectLab}
                  />
                </View>
              ) : null}

              {showInitialLoading ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="large" color="#000000" />
                  <Text style={styles.stateText}>
                    Memuat titik lokasi laboratorium...
                  </Text>
                </View>
              ) : showFatalError && error ? (
                <View style={styles.errorStateCard}>
                  <Text style={styles.errorStateTitle}>
                    Gagal Memuat Data Laboratorium
                  </Text>
                  <Text style={styles.errorStateText}>{error}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleRetry}
                    style={({ pressed }) => [
                      styles.retryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.retryButtonText}>Coba Lagi</Text>
                  </Pressable>
                </View>
              ) : validLaboratories.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={styles.stateTitle}>Lokasi Belum Tersedia</Text>
                  <Text style={styles.stateText}>
                    Data titik laboratorium di Firestore belum tersedia.
                  </Text>
                </View>
              ) : (
                validLaboratories.map((lab) => (
                  <Pressable
                    key={lab.id}
                    onPress={() => handleSelectLab(lab)}
                    style={({ pressed }) => [
                      styles.webLabCard,
                      selectedLabId === lab.id && styles.webLabCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.webLabHeader}>
                      <Text style={styles.webLabName}>{lab.name}</Text>
                      <View style={styles.radiusChip}>
                        <Text style={styles.radiusChipText}>
                          {lab.radius} m
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.webLabCoords}>
                      {lab.latitude.toFixed(6)}, {lab.longitude.toFixed(6)}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>

            {selectedLabDetailCard}
          </View>
        ) : (
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={INITIAL_REGION}
              showsUserLocation={false}
              showsMyLocationButton={false}
              onMapReady={() => setMapReady(true)}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setMapSize({ width, height });
                setMapLayoutReady(true);
              }}
              onPress={(event) => {
                if (event.nativeEvent.action !== 'marker-press') {
                  handleCloseDetail();
                }
              }}
            >
              {validLaboratories.map((lab) => {
                const isSelected = selectedLabId === lab.id;
                const coordinate = {
                  latitude: lab.latitude,
                  longitude: lab.longitude,
                };

                return (
                  <Circle
                    key={`circle-${lab.id}`}
                    center={coordinate}
                    radius={lab.radius}
                    strokeWidth={isSelected ? 2 : 1.5}
                    strokeColor={
                      isSelected
                        ? 'rgba(37, 99, 235, 0.9)'
                        : 'rgba(220, 38, 38, 0.55)'
                    }
                    fillColor={
                      isSelected
                        ? 'rgba(37, 99, 235, 0.18)'
                        : 'rgba(220, 38, 38, 0.10)'
                    }
                    zIndex={isSelected ? 2 : 1}
                  />
                );
              })}

              {validLaboratories.map((lab) => {
                const isSelected = selectedLabId === lab.id;

                return (
                  <Marker
                    key={lab.id}
                    identifier={lab.id}
                    coordinate={{
                      latitude: lab.latitude,
                      longitude: lab.longitude,
                    }}
                    title={lab.name}
                    description={`Radius presensi: ${lab.radius} meter`}
                    pinColor={isSelected ? 'blue' : 'red'}
                    stopPropagation
                    zIndex={isSelected ? 5 : 4}
                    onPress={() => handleSelectLab(lab)}
                  />
                );
              })}

              {/* LINGKARAN AKURASI & MARKER POSISI PENGGUNA (FR-14) */}
              {userLocation &&
              userLocation.accuracy !== null &&
              userLocation.accuracy > 0 ? (
                <Circle
                  key="user-accuracy-circle"
                  center={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  }}
                  radius={userLocation.accuracy}
                  strokeWidth={1}
                  strokeColor="rgba(14, 165, 233, 0.55)"
                  fillColor="rgba(14, 165, 233, 0.14)"
                  zIndex={3}
                />
              ) : null}

              {userLocation ? (
                <Marker
                  key="user-location-marker"
                  identifier="user-location"
                  coordinate={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.73 }}
                  title="Lokasi Anda"
                  description={
                    userLocation.accuracy !== null
                      ? `Akurasi GPS ±${Math.round(userLocation.accuracy)} meter`
                      : 'Posisi GPS perangkat saat ini'
                  }
                  stopPropagation
                  tracksViewChanges
                  zIndex={10}
                >
                  <View style={styles.userMarkerWrapper} collapsable={false}>
                    <View style={styles.userMarkerLabelPill}>
                      <Text
                        allowFontScaling={false}
                        style={styles.userMarkerLabelText}
                      >
                        Lokasi Anda
                      </Text>
                    </View>
                    <View style={styles.userMarkerPulse}>
                      <View style={styles.userMarkerCore} />
                    </View>
                  </View>
                </Marker>
              ) : null}
            </MapView>

            {/* BARISAN CHIP CEPAT DI BAGIAN ATAS PETA */}
            {validLaboratories.length > 0 ? (
              <View style={styles.topChipsOverlay} pointerEvents="box-none">
                <LabChipStrip
                  laboratories={validLaboratories}
                  selectedLabId={selectedLabId}
                  onSelect={handleSelectLab}
                  elevated
                />
              </View>
            ) : null}

            {/* STATUS GPS & TOMBOL AKSI "LOKASI SAYA" (FR-14) */}
            <View
              style={[
                styles.mapActionsOverlay,
                validLaboratories.length === 0 &&
                  styles.mapActionsOverlayNoChips,
              ]}
              pointerEvents="box-none"
            >
              {locationPermissionStatus === 'denied' ? (
                <View
                  style={[
                    styles.gpsStatusPill,
                    styles.gpsWarningPill,
                    styles.floatingChipShadow,
                  ]}
                >
                  <View style={styles.gpsOffDot} />
                  <Text numberOfLines={1} style={styles.gpsStatusText}>
                    Izin lokasi ditolak
                  </Text>
                </View>
              ) : !isLocationServiceEnabled ? (
                <View
                  style={[
                    styles.gpsStatusPill,
                    styles.gpsWarningPill,
                    styles.floatingChipShadow,
                  ]}
                >
                  <View style={styles.gpsOffDot} />
                  <Text numberOfLines={1} style={styles.gpsStatusText}>
                    GPS nonaktif
                  </Text>
                </View>
              ) : locationPermissionStatus === 'granted' &&
                isSearchingLocation &&
                !userLocation ? (
                <View style={[styles.gpsStatusPill, styles.floatingChipShadow]}>
                  <ActivityIndicator size="small" color="#0284C7" />
                  <Text numberOfLines={1} style={styles.gpsStatusText}>
                    Mencari lokasi Anda...
                  </Text>
                </View>
              ) : userLocation ? (
                <View style={[styles.gpsStatusPill, styles.floatingChipShadow]}>
                  <View style={styles.gpsLiveDot} />
                  <Text numberOfLines={1} style={styles.gpsStatusText}>
                    {userLocation.accuracy !== null
                      ? `GPS ±${Math.round(userLocation.accuracy)} m`
                      : 'GPS aktif'}
                  </Text>
                </View>
              ) : (
                <View />
              )}

              <Pressable
                accessibilityLabel="Arahkan peta ke lokasi saya"
                accessibilityRole="button"
                onPress={handleFocusUserLocation}
                style={({ pressed }) => [
                  styles.myLocationButton,
                  styles.floatingChipShadow,
                  (!userLocation || !isLocationServiceEnabled) &&
                    styles.myLocationButtonMuted,
                  pressed && styles.pressed,
                ]}
              >
                <MyLocationIcon
                  color={
                    userLocation && isLocationServiceEnabled
                      ? '#0284C7'
                      : '#555555'
                  }
                />
                <Text
                  style={[
                    styles.myLocationButtonText,
                    (!userLocation || !isLocationServiceEnabled) &&
                      styles.myLocationButtonTextMuted,
                  ]}
                >
                  Lokasi Saya
                </Text>
              </Pressable>
            </View>

            {/* FEEDBACK RINGAN SAAT TOMBOL LOKASI SAYA DITEKAN */}
            {locationFeedback ? (
              <View
                pointerEvents="none"
                style={[
                  styles.locationFeedbackToast,
                  validLaboratories.length === 0 &&
                    styles.locationFeedbackToastNoChips,
                  styles.floatingChipShadow,
                ]}
              >
                <Text style={styles.locationFeedbackToastText}>
                  {locationFeedback}
                </Text>
              </View>
            ) : null}

            {/* OVERLAY LOADING */}
            {showInitialLoading ? (
              <View style={styles.overlayCenter}>
                <View style={styles.overlayCard}>
                  <ActivityIndicator size="large" color="#000000" />
                  <Text style={styles.stateText}>
                    Memuat titik lokasi laboratorium...
                  </Text>
                </View>
              </View>
            ) : null}

            {/* OVERLAY ERROR FATAL */}
            {showFatalError && error ? (
              <View style={styles.overlayCenter}>
                <View style={styles.overlayCard}>
                  <Text style={styles.errorStateTitle}>
                    Gagal Memuat Data Laboratorium
                  </Text>
                  <Text style={styles.errorStateText}>{error}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleRetry}
                    style={({ pressed }) => [
                      styles.retryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.retryButtonText}>Coba Lagi</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* OVERLAY KOSONG */}
            {!loading && !error && validLaboratories.length === 0 ? (
              <View style={styles.overlayCenter}>
                <View style={styles.overlayCard}>
                  <Text style={styles.stateTitle}>Lokasi Belum Tersedia</Text>
                  <Text style={styles.stateText}>
                    Belum ada koordinat laboratorium yang valid di Firestore.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleRetry}
                    style={({ pressed }) => [
                      styles.retryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.retryButtonText}>Muat Ulang</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* FLOATING DETAIL CARD / BOTTOM SHEET DI BAGIAN BAWAH PETA */}
            {mapFabs}
            {selectedLabDetailCard}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  header: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 14,
    lineHeight: 20,
  },
  fabColumn: {
    gap: 10,
    position: 'absolute',
    right: 14,
    zIndex: 5,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 26,
    borderWidth: 1,
    elevation: 6,
    height: 52,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    width: 52,
  },
  inlineErrorBanner: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderBottomColor: '#FCA5A5',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inlineErrorText: {
    fontFamily: FONT.regular,
    color: '#991B1B',
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  inlineRetryButton: {
    backgroundColor: '#991B1B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineRetryText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  locationWarningBanner: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderBottomColor: '#FCD34D',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  locationWarningBannerStacked: {
    backgroundColor: '#FEF3C7',
    borderBottomColor: '#FCD34D',
    borderBottomWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  locationWarningText: {
    fontFamily: FONT.regular,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 17,
  },
  locationWarningTextInline: {
    flex: 1,
  },
  locationBannerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationWarningButton: {
    backgroundColor: '#92400E',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  locationWarningButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  locationSecondaryButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D97706',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  locationSecondaryButtonText: {
    fontFamily: FONT.bold,
    color: '#92400E',
    fontSize: 11,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    height: '100%',
    width: '100%',
  },

  // CHIP CEPAT DI ATAS PETA
  topChipsOverlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 12,
    zIndex: 3,
  },
  topChipList: {
    gap: 8,
    paddingHorizontal: 16,
  },
  labChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCDCE0',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  floatingChipShadow: {
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  labChipSelected: {
    backgroundColor: '#F47321',
    borderColor: '#F47321',
  },
  labChipText: {
    fontFamily: FONT.bold,
    color: '#111111',
    fontSize: 12,
  },
  labChipTextSelected: {
    color: '#FFFFFF',
  },

  // FLOATING BOTTOM DETAIL CARD
  floatingDetailContainer: {
    // Di atas navbar melayang (TAB_BAR_SPACE dikurangi sedikit napas).
    bottom: TAB_BAR_SPACE - 12,
    left: 14,
    position: 'absolute',
    right: 14,
    zIndex: 4,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 8,
    gap: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  detailHandle: {
    alignSelf: 'center',
    backgroundColor: '#DDDDDD',
    borderRadius: 3,
    height: 4,
    width: 38,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  detailScroll: {
    flexShrink: 1,
  },
  detailScrollContent: {
    gap: 12,
    paddingBottom: 2,
  },
  detailTitleGroup: {
    flex: 1,
    gap: 3,
  },
  detailEyebrow: {
    fontFamily: FONT.bold,
    color: '#777777',
    fontSize: 10,
    letterSpacing: 1,
  },
  detailName: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 18,
    lineHeight: 24,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#F1F1F3',
    borderRadius: 18,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  metricBox: {
    backgroundColor: '#F1F1F3',
    borderRadius: 12,
    flexDirection: 'row',
    padding: 12,
  },
  metricItem: {
    flex: 1,
    gap: 4,
  },
  metricDivider: {
    backgroundColor: '#DCDCE0',
    marginHorizontal: 8,
    width: 1,
  },
  metricLabel: {
    fontFamily: FONT.extrabold,
    color: '#777777',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  metricValue: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 12,
  },
  activitiesContainer: {
    gap: 8,
  },
  activitiesSectionHeading: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 13,
  },
  activitiesListGap: {
    gap: 10,
  },
  activitiesLoadingBox: {
    backgroundColor: '#F8F8FA',
    borderColor: '#E5E5EA',
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  activitiesLoadingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  activitySkeletonRow: {
    gap: 6,
  },
  activitySkeletonLineWide: {
    backgroundColor: '#E5E5EA',
    borderRadius: 6,
    height: 11,
    width: '78%',
  },
  activitySkeletonLineShort: {
    backgroundColor: '#ECECF0',
    borderRadius: 6,
    height: 10,
    width: '48%',
  },
  activitiesStateText: {
    fontFamily: FONT.semibold,
    color: '#555555',
    flex: 1,
    fontSize: 12,
  },
  activitiesErrorBox: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  activitiesErrorTextGroup: {
    flex: 1,
    gap: 2,
  },
  activitiesErrorTitle: {
    fontFamily: FONT.extrabold,
    color: '#991B1B',
    fontSize: 12,
  },
  activitiesErrorText: {
    fontFamily: FONT.regular,
    color: '#991B1B',
    fontSize: 12,
    lineHeight: 17,
  },
  activitiesRetryButton: {
    backgroundColor: '#991B1B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activitiesRetryText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  activityGroup: {
    gap: 5,
  },
  activityGroupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityGroupTitle: {
    fontFamily: FONT.extrabold,
    color: '#444444',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  activityExtraCount: {
    fontFamily: FONT.semibold,
    color: '#666666',
    fontSize: 11,
  },
  activityItemCard: {
    backgroundColor: '#F8F8FA',
    borderColor: '#E5E5EA',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 11,
  },
  activityItemCardOngoing: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  activityItemHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  activityPracticumName: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  activityMetaList: {
    gap: 4,
  },
  activityMetaRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  activityMetaLabel: {
    fontFamily: FONT.semibold,
    color: '#666666',
    fontSize: 12,
  },
  activityMetaValue: {
    fontFamily: FONT.bold,
    color: '#111111',
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
  },
  activityEmptyCard: {
    backgroundColor: '#F8F8FA',
    borderColor: '#E5E5EA',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  activityEmptyText: {
    fontFamily: FONT.regular,
    color: '#666666',
    fontSize: 12,
    lineHeight: 17,
  },
  routineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  routineBadgeText: {
    fontFamily: FONT.bold,
    color: '#0369A1',
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // OVERLAY STATES
  overlayCenter: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: 24,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 5,
  },
  overlayCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    borderRadius: 18,
    borderWidth: 1,
    elevation: 4,
    gap: 10,
    maxWidth: 340,
    padding: 20,
    width: '100%',
  },
  stateTitle: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 16,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: FONT.regular,
    color: '#555555',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorStateCard: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    gap: 8,
    padding: 18,
  },
  errorStateTitle: {
    fontFamily: FONT.extrabold,
    color: '#991B1B',
    fontSize: 15,
    textAlign: 'center',
  },
  errorStateText: {
    fontFamily: FONT.regular,
    color: '#7F1D1D',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#000000',
    borderRadius: 10,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },

  // WEB FALLBACK
  webWrapper: {
    flex: 1,
    position: 'relative',
  },
  webContent: {
    gap: 12,
    padding: 20,
    paddingBottom: 340,
  },
  webChipStripWrapper: {
    marginHorizontal: -16,
  },
  webNoticeCard: {
    backgroundColor: '#F2F2F5',
    borderRadius: 14,
    gap: 6,
    padding: 16,
  },
  webNoticeTitle: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 15,
  },
  webNoticeText: {
    fontFamily: FONT.regular,
    color: '#555555',
    fontSize: 13,
    lineHeight: 19,
  },
  centerBox: {
    alignItems: 'center',
    gap: 10,
    padding: 28,
  },
  webLabCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: 15,
  },
  webLabCardSelected: {
    borderColor: '#000000',
    borderWidth: 1.5,
  },
  webLabHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  webLabName: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 15,
  },
  radiusChip: {
    backgroundColor: '#000000',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  radiusChipText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  webLabCoords: {
    fontFamily: FONT.semibold,
    color: '#666666',
    fontSize: 12,
  },
  // MARKER LOKASI PENGGUNA & TOMBOL AKSI PETA (FR-14)
  userMarkerWrapper: {
    alignItems: 'center',
    padding: 2,
  },
  userMarkerLabelPill: {
    backgroundColor: '#0F172A',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    elevation: 3,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  userMarkerLabelText: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 13,
  },
  userMarkerPulse: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.24)',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  userMarkerCore: {
    backgroundColor: '#0284C7',
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2.5,
    elevation: 3,
    height: 16,
    width: 16,
  },
  mapActionsOverlay: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    left: 16,
    position: 'absolute',
    right: 14,
    top: 58,
    zIndex: 3,
  },
  mapActionsOverlayNoChips: {
    top: 12,
  },
  gpsStatusPill: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCDCE0',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  gpsWarningPill: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  gpsLiveDot: {
    backgroundColor: '#0284C7',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  gpsOffDot: {
    backgroundColor: '#D97706',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  gpsStatusText: {
    fontFamily: FONT.bold,
    color: '#111111',
    fontSize: 11,
  },
  myLocationButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#0284C7',
    borderRadius: 999,
    borderWidth: 1.2,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  myLocationButtonMuted: {
    borderColor: '#DCDCE0',
  },
  myLocationButtonText: {
    fontFamily: FONT.extrabold,
    color: '#0369A1',
    fontSize: 12,
  },
  myLocationButtonTextMuted: {
    color: '#555555',
  },
  locationFeedbackToast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 12,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    position: 'absolute',
    right: 16,
    top: 102,
    zIndex: 3,
  },
  locationFeedbackToastNoChips: {
    top: 56,
  },
  locationFeedbackToastText: {
    fontFamily: FONT.semibold,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  webUserLocationCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  webUserLocationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  webUserLocationTitle: {
    fontFamily: FONT.extrabold,
    color: '#0369A1',
    fontSize: 13,
  },
  webUserLocationCoords: {
    fontFamily: FONT.semibold,
    color: '#0C4A6E',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.68,
  },
});
