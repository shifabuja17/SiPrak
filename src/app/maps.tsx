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

import { useAuth } from '@/context/AuthContext';
import {
  ensureDefaultLaboratories,
  subscribeLaboratories,
  type LaboratoryId,
  type LaboratoryLocation,
} from '@/features/assistant/services/laboratory-service';

const INITIAL_REGION: Region = {
  latitude: -7.04825,
  longitude: 110.4414,
  latitudeDelta: 0.004,
  longitudeDelta: 0.004,
};

const FIT_EDGE_PADDING = {
  top: 72,
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
      mapRef.current.animateToRegion(
        {
          latitude: lab.latitude,
          longitude: lab.longitude,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        },
        350,
      );
    }
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

  const showInitialLoading = loading && validLaboratories.length === 0;
  const showFatalError = Boolean(error) && validLaboratories.length === 0 && !loading;

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

      {/* AREA PETA */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <ScrollView contentContainerStyle={styles.webContent}>
            <View style={styles.webNoticeCard}>
              <Text style={styles.webNoticeTitle}>
                Peta Interaktif Android & iOS
              </Text>
              <Text style={styles.webNoticeText}>
                Komponen MapView aktif pada perangkat Android dan iOS. Berikut
                data lokasi laboratorium real-time dari Firestore:
              </Text>
            </View>

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
                <View key={lab.id} style={styles.webLabCard}>
                  <View style={styles.webLabHeader}>
                    <Text style={styles.webLabName}>{lab.name}</Text>
                    <View style={styles.radiusChip}>
                      <Text style={styles.radiusChipText}>{lab.radius} m</Text>
                    </View>
                  </View>
                  <Text style={styles.webLabCoords}>
                    {lab.latitude.toFixed(6)}, {lab.longitude.toFixed(6)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
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
                  setSelectedLabId(null);
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
                    onPress={() => handleSelectLab(lab)}
                  />
                );
              })}
            </MapView>

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

            {/* PANEL BAWAH: PILIH LAB & DETAIL RADIUS */}
            {validLaboratories.length > 0 ? (
              <View style={styles.bottomPanel}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.labChipList}
                >
                  {validLaboratories.map((lab) => {
                    const isSelected = selectedLabId === lab.id;

                    return (
                      <Pressable
                        key={lab.id}
                        accessibilityRole="button"
                        onPress={() => handleSelectLab(lab)}
                        style={({ pressed }) => [
                          styles.labChip,
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

                {selectedLab ? (
                  <View style={styles.selectedCard}>
                    <View style={styles.selectedHeader}>
                      <Text style={styles.selectedName}>{selectedLab.name}</Text>
                      <View style={styles.radiusChip}>
                        <Text style={styles.radiusChipText}>
                          Radius {selectedLab.radius} m
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.selectedCoords}>
                      Koordinat: {selectedLab.latitude.toFixed(6)},{' '}
                      {selectedLab.longitude.toFixed(6)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.hintText}>
                    Ketuk marker atau pilih laboratorium di atas untuk melihat
                    detail area radius.
                  </Text>
                )}
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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    height: '100%',
    width: '100%',
  },
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
  bottomPanel: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E5E5',
    borderTopWidth: 1,
    gap: 10,
    paddingBottom: 14,
    paddingTop: 12,
  },
  labChipList: {
    gap: 8,
    paddingHorizontal: 16,
  },
  labChip: {
    backgroundColor: '#F2F2F5',
    borderColor: '#DDDDDD',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  labChipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  labChipText: {
    color: '#222222',
    fontSize: 12,
    fontWeight: '700',
  },
  labChipTextSelected: {
    color: '#FFFFFF',
  },
  selectedCard: {
    backgroundColor: '#F7F7F9',
    borderColor: '#E5E5E5',
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    marginHorizontal: 16,
    padding: 12,
  },
  selectedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  selectedName: {
    color: '#000000',
    flex: 1,
    fontSize: 14,
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
  selectedCoords: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '600',
  },
  hintText: {
    color: '#666666',
    fontSize: 12,
    paddingHorizontal: 16,
  },
  webContent: {
    gap: 12,
    padding: 20,
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
  webLabHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  webLabName: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  webLabCoords: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.68,
  },
});
