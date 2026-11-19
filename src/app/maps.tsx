import { router } from 'expo-router';
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
  View,
} from 'react-native';
import MapView, {
  Circle,
  Marker,
  type LatLng,
  type Region,
} from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Path } from 'react-native-svg';

import { useAuth } from '@/context/AuthContext';
import {
  ensureDefaultLaboratories,
  subscribeLaboratories,
  type LaboratoryId,
  type LaboratoryLocation,
} from '@/features/assistant/services/laboratory-service';
import { useUserLocationTracking } from '@/hooks/use-user-location-tracking';
import { openAppLocationSettings } from '@/services/location-service';

const INITIAL_REGION: Region = {
  latitude: -7.04825,
  longitude: 110.4414,
  latitudeDelta: 0.004,
  longitudeDelta: 0.004,
};

const USER_FOCUS_DELTA = 0.0025;

const FIT_EDGE_PADDING = {
  top: 96,
  right: 56,
  bottom: 96,
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

function LabDetailCard({
  lab,
  onClose,
}: {
  lab: LaboratoryLocation;
  onClose: () => void;
}) {
  return (
    <View style={styles.detailCard}>
      <View style={styles.detailHandle} />

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

      {/* TODO: FR-16 Real-time Lab Activities */}
      <View style={styles.activitiesSection}>
        <Text style={styles.activitiesTitle}>Aktivitas Praktikum</Text>
        <Text style={styles.activitiesPlaceholder}>
          Jadwal dan sesi praktikum aktif di lokasi ini akan ditampilkan di sini.
        </Text>
      </View>
    </View>
  );
}

export default function MapsScreen() {
  const {
    user,
    role,
    status: authStatus,
    loading: authLoading,
  } = useAuth();

  const mapRef = useRef<MapView | null>(null);
  const hasAutoFittedRef = useRef(false);

  const [laboratories, setLaboratories] = useState<LaboratoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const [selectedLabId, setSelectedLabId] = useState<LaboratoryId | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLayoutReady, setMapLayoutReady] = useState(false);

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

  const validLaboratories = useMemo(
    () => laboratories.filter(isValidLabLocation),
    [laboratories],
  );

  const selectedLab = useMemo(
    () =>
      validLaboratories.find((lab) => lab.id === selectedLabId) ?? null,
    [validLaboratories, selectedLabId],
  );

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
    let seeding = role === 'asisten';
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

    if (role === 'asisten') {
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

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  function handleSelectLab(lab: LaboratoryLocation) {
    setSelectedLabId(lab.id);

    if (Platform.OS !== 'web' && mapRef.current && mapReady) {
      const focusDelta = getFocusDeltaForRadius(lab.radius);
      mapRef.current.animateToRegion(
        {
          latitude: lab.latitude,
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
    if (!userLocation) {
      if (locationPermissionStatus === 'denied' && !canAskPermissionAgain) {
        void handleOpenLocationSettings();
        return;
      }
      retryLocation();
      return;
    }

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>‹ Kembali</Text>
        </Pressable>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.title}>Peta Laboratorium</Text>
          <Text style={styles.subtitle}>
            {validLaboratories.length > 0
              ? `${validLaboratories.length} titik lokasi aktif`
              : '4 titik lokasi praktikum'}
          </Text>
        </View>

        {Platform.OS !== 'web' ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleResetMap}
            disabled={validLaboratories.length === 0 && !mapReady}
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.resetButtonText}>Pusatkan</Text>
          </Pressable>
        ) : null}
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

      {/* BANNER STATUS LOKASI PENGGUNA (NON-BLOCKING) */}
      {locationError ? (
        <View style={styles.locationWarningBanner}>
          <Text style={styles.locationWarningText}>{locationError}</Text>
          {locationPermissionStatus === 'denied' && !canAskPermissionAgain ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleOpenLocationSettings()}
              style={({ pressed }) => [
                styles.locationWarningButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.locationWarningButtonText}>Pengaturan</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={retryLocation}
              style={({ pressed }) => [
                styles.locationWarningButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.locationWarningButtonText}>Coba Lagi</Text>
            </Pressable>
          )}
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

              {userLocation ? (
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

            {selectedLab ? (
              <View style={styles.floatingDetailContainer}>
                <LabDetailCard lab={selectedLab} onClose={handleCloseDetail} />
              </View>
            ) : null}
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
              onLayout={() => setMapLayoutReady(true)}
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
              {!isLocationServiceEnabled ? (
                <View
                  style={[
                    styles.gpsStatusPill,
                    styles.gpsWarningPill,
                    styles.floatingChipShadow,
                  ]}
                >
                  <View style={styles.gpsOffDot} />
                  <Text style={styles.gpsStatusText}>GPS nonaktif</Text>
                </View>
              ) : isSearchingLocation && !userLocation ? (
                <View style={[styles.gpsStatusPill, styles.floatingChipShadow]}>
                  <ActivityIndicator size="small" color="#0284C7" />
                  <Text style={styles.gpsStatusText}>Mencari lokasi...</Text>
                </View>
              ) : userLocation ? (
                <View style={[styles.gpsStatusPill, styles.floatingChipShadow]}>
                  <View style={styles.gpsLiveDot} />
                  <Text style={styles.gpsStatusText}>
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
            {selectedLab ? (
              <View
                style={styles.floatingDetailContainer}
                pointerEvents="box-none"
              >
                <LabDetailCard lab={selectedLab} onClose={handleCloseDetail} />
              </View>
            ) : null}
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E5E5',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  backButton: {
    paddingRight: 4,
    paddingVertical: 4,
  },
  backText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitleGroup: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
  locationWarningText: {
    color: '#92400E',
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  locationWarningButton: {
    backgroundColor: '#92400E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationWarningButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  labChipText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '700',
  },
  labChipTextSelected: {
    color: '#FFFFFF',
  },

  // FLOATING BOTTOM DETAIL CARD
  floatingDetailContainer: {
    bottom: 16,
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
    gap: 12,
    padding: 16,
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
  detailTitleGroup: {
    flex: 1,
    gap: 3,
  },
  detailEyebrow: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  detailName: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
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
    color: '#777777',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metricValue: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  activitiesSection: {
    backgroundColor: '#F8F8FA',
    borderColor: '#E5E5EA',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  activitiesTitle: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  activitiesPlaceholder: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 17,
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
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
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
    color: '#991B1B',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorStateText: {
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
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // WEB FALLBACK
  webWrapper: {
    flex: 1,
    position: 'relative',
  },
  webContent: {
    gap: 12,
    padding: 20,
    paddingBottom: 240,
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
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  webNoticeText: {
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
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  radiusChip: {
    backgroundColor: '#000000',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  radiusChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  webLabCoords: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
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
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
    color: '#111111',
    fontSize: 11,
    fontWeight: '700',
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
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '800',
  },
  myLocationButtonTextMuted: {
    color: '#555555',
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
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '800',
  },
  webUserLocationCoords: {
    color: '#0C4A6E',
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.68,
  },
});
