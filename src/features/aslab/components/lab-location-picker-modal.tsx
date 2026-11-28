import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {
  Circle,
  Marker,
  type LatLng,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT } from '@/constants/fonts';
import { getCurrentDeviceLocation } from '@/features/location/services/device-location';
import { UI } from '@/features/praktikan/ui/praktikan-ui';
import {
  DEFAULT_LABORATORIES,
  DEFAULT_LABORATORY_RADIUS_METERS,
  validateLaboratoryCoordinates,
} from '@/services/laboratory-service';

import { parseNumericString } from '../utils/laboratory-form';
import {
  FSM_UNDIP_DEFAULT_CENTER,
  RADIUS_PRESETS,
  type LabLocationPickerModalProps,
} from './lab-location-picker-types';

function isGoogleMapsUnavailable(): boolean {
  if (Platform.OS !== 'android') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return Constants.expoConfig?.extra?.googleMapsConfigured !== true;
}

function getFocusDeltaForRadius(radiusMeters: number): number {
  return Math.max(0.0022, (radiusMeters * 4.5) / 111000);
}

function isValidLat(value: number | null): value is number {
  return value !== null && value >= -90 && value <= 90;
}

function isValidLng(value: number | null): value is number {
  return value !== null && value >= -180 && value <= 180;
}

function isValidRadius(value: number | null): value is number {
  return value !== null && value > 0;
}

/**
 * Modal pemilih titik lokasi & radius berbasis peta interaktif (FR-11):
 * tersinkronisasi dua arah antara input angka manual dan gestur peta (tap/drag marker)
 * beserta pratinjau visual `<Circle>` sesuai nilai radius.
 */
export default function LabLocationPickerModal({
  visible,
  initialLat,
  initialLng,
  initialRadius,
  onClose,
  onConfirm,
}: LabLocationPickerModalProps) {
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [pinCoords, setPinCoords] = useState<LatLng>({
    latitude: FSM_UNDIP_DEFAULT_CENTER.latitude,
    longitude: FSM_UNDIP_DEFAULT_CENTER.longitude,
  });
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [radiusMeters, setRadiusMeters] = useState<number>(DEFAULT_LABORATORY_RADIUS_METERS);
  const [radiusText, setRadiusText] = useState(String(DEFAULT_LABORATORY_RADIUS_METERS));

  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [validationError, setValidationError] = useState('');

  const animateMapTo = useCallback(
    (coords: LatLng, radius: number, animated = true) => {
      if (!mapRef.current || !mapReady) return;
      const delta = getFocusDeltaForRadius(radius);
      mapRef.current.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        animated ? 300 : 0,
      );
    },
    [mapReady],
  );

  useEffect(() => {
    if (!visible) {
      setMapReady(false);
      return;
    }

    const startLat = isValidLat(initialLat)
      ? initialLat
      : FSM_UNDIP_DEFAULT_CENTER.latitude;
    const startLng = isValidLng(initialLng)
      ? initialLng
      : FSM_UNDIP_DEFAULT_CENTER.longitude;
    const startRadius = isValidRadius(initialRadius)
      ? initialRadius
      : DEFAULT_LABORATORY_RADIUS_METERS;

    const initialPoint = { latitude: startLat, longitude: startLng };
    setPinCoords(initialPoint);
    setLatText(startLat.toFixed(6));
    setLngText(startLng.toFixed(6));
    setRadiusMeters(startRadius);
    setRadiusText(String(startRadius));
    setGpsError('');
    setValidationError('');
  }, [visible, initialLat, initialLng, initialRadius]);

  function applyCoordinatesFromMap(coordinate: LatLng, shouldCenter = false) {
    setPinCoords(coordinate);
    setLatText(coordinate.latitude.toFixed(6));
    setLngText(coordinate.longitude.toFixed(6));
    setValidationError('');
    setGpsError('');
    if (shouldCenter) {
      animateMapTo(coordinate, radiusMeters);
    }
  }

  function handleMapPress(event: MapPressEvent) {
    applyCoordinatesFromMap(event.nativeEvent.coordinate, false);
  }

  function handleMarkerDragEnd(event: MarkerDragStartEndEvent) {
    applyCoordinatesFromMap(event.nativeEvent.coordinate, false);
  }

  function handleLatChange(nextLatText: string) {
    setLatText(nextLatText);
    setValidationError('');
    const parsedLat = parseNumericString(nextLatText);
    if (isValidLat(parsedLat)) {
      const nextPoint = { latitude: parsedLat, longitude: pinCoords.longitude };
      setPinCoords(nextPoint);
      animateMapTo(nextPoint, radiusMeters);
    }
  }

  function handleLngChange(nextLngText: string) {
    setLngText(nextLngText);
    setValidationError('');
    const parsedLng = parseNumericString(nextLngText);
    if (isValidLng(parsedLng)) {
      const nextPoint = { latitude: pinCoords.latitude, longitude: parsedLng };
      setPinCoords(nextPoint);
      animateMapTo(nextPoint, radiusMeters);
    }
  }

  function handleRadiusChange(nextRadiusText: string) {
    setRadiusText(nextRadiusText);
    setValidationError('');
    const parsedRadius = parseNumericString(nextRadiusText);
    if (isValidRadius(parsedRadius)) {
      setRadiusMeters(parsedRadius);
    }
  }

  function handleSelectRadiusPreset(presetRadius: number) {
    setRadiusMeters(presetRadius);
    setRadiusText(String(presetRadius));
    setValidationError('');
    animateMapTo(pinCoords, presetRadius);
  }

  async function handleUseCurrentLocation() {
    if (locating) return;
    setLocating(true);
    setGpsError('');
    setValidationError('');

    try {
      const coords = await getCurrentDeviceLocation();
      applyCoordinatesFromMap(
        { latitude: coords.latitude, longitude: coords.longitude },
        true,
      );
    } catch (err) {
      setGpsError(
        err instanceof Error
          ? err.message
          : 'Gagal mengambil lokasi perangkat saat ini.',
      );
    } finally {
      setLocating(false);
    }
  }

  function handleConfirm() {
    const parsedLat = parseNumericString(latText);
    const parsedLng = parseNumericString(lngText);
    const parsedRadius = parseNumericString(radiusText);

    try {
      const valid = validateLaboratoryCoordinates(
        parsedLat as number,
        parsedLng as number,
        parsedRadius as number,
      );
      onConfirm({ lat: valid.lat, lng: valid.lng, radius: valid.radius });
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : 'Koordinat atau radius belum valid.',
      );
    }
  }

  const mapsUnavailable = isGoogleMapsUnavailable();
  const numericKeyboard =
    Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';
  const decimalKeyboard = Platform.OS === 'ios' ? 'decimal-pad' : 'numeric';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {/* HEADER MODAL */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Pilih Lokasi &amp; Radius</Text>
              <Text style={styles.subtitle}>
                Ketuk peta, geser pin, atau isi koordinat dan radius secara manual.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Text style={styles.closeBtnText}>Tutup</Text>
            </Pressable>
          </View>

          {/* AREA PETA */}
          <View style={styles.mapContainer}>
            {mapsUnavailable ? (
              <View style={styles.mapFallbackBox}>
                <Text style={styles.mapFallbackTitle}>Peta Belum Tersedia di Build Ini</Text>
                <Text style={styles.mapFallbackText}>
                  Build Android ini belum memiliki API key Google Maps. Gunakan preset
                  laboratorium, GPS perangkat, atau masukkan koordinat manual di bawah.
                </Text>
              </View>
            ) : (
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                initialRegion={{
                  latitude: pinCoords.latitude,
                  longitude: pinCoords.longitude,
                  latitudeDelta: getFocusDeltaForRadius(radiusMeters),
                  longitudeDelta: getFocusDeltaForRadius(radiusMeters),
                }}
                onMapReady={() => setMapReady(true)}
                onPress={handleMapPress}
                showsUserLocation
                showsMyLocationButton={false}
              >
                <Marker
                  coordinate={pinCoords}
                  draggable
                  onDragEnd={handleMarkerDragEnd}
                  title="Titik Lokasi Lab"
                  description={`Radius presensi: ${radiusMeters} m`}
                />
                <Circle
                  center={pinCoords}
                  radius={radiusMeters}
                  strokeWidth={2}
                  strokeColor="rgba(244, 115, 33, 0.92)"
                  fillColor="rgba(244, 115, 33, 0.22)"
                />
              </MapView>
            )}
          </View>

          {/* KONTROL PRESET, GPS & INPUT SINKRON */}
          <ScrollView
            style={styles.controlsScroll}
            contentContainerStyle={styles.controlsContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.utilityRow}>
              <Pressable
                accessibilityRole="button"
                disabled={locating}
                onPress={() => void handleUseCurrentLocation()}
                style={({ pressed }) => [
                  styles.gpsButton,
                  pressed && !locating && styles.pressed,
                  locating && styles.disabled,
                ]}
              >
                {locating ? (
                  <View style={styles.inlineRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.gpsButtonText}>Mengambil GPS...</Text>
                  </View>
                ) : (
                  <Text style={styles.gpsButtonText}>Gunakan Lokasi Saat Ini</Text>
                )}
              </Pressable>
            </View>

            {gpsError ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>{gpsError}</Text>
              </View>
            ) : null}

            {/* PRESET LOKASI KAMPUS */}
            <Text style={styles.sectionLabel}>Preset Titik Awal FSM UNDIP</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {DEFAULT_LABORATORIES.map((preset) => (
                <Pressable
                  key={preset.id}
                  onPress={() =>
                    applyCoordinatesFromMap(
                      { latitude: preset.latitude, longitude: preset.longitude },
                      true,
                    )
                  }
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                >
                  <Text style={styles.chipText}>{preset.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* INPUT KOORDINAT & RADIUS DUA ARAH */}
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.inputLabel}>Latitude</Text>
                <TextInput
                  value={latText}
                  onChangeText={handleLatChange}
                  placeholder="-7.048238"
                  placeholderTextColor={UI.border}
                  keyboardType={numericKeyboard}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              <View style={styles.col}>
                <Text style={styles.inputLabel}>Longitude</Text>
                <TextInput
                  value={lngText}
                  onChangeText={handleLngChange}
                  placeholder="110.440766"
                  placeholderTextColor={UI.border}
                  keyboardType={numericKeyboard}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.radiusSection}>
              <View style={styles.radiusHeader}>
                <Text style={styles.inputLabel}>Radius Presensi (meter)</Text>
                <View style={styles.radiusPresetRow}>
                  {RADIUS_PRESETS.map((preset) => {
                    const active = radiusMeters === preset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => handleSelectRadiusPreset(preset)}
                        style={[styles.radiusChip, active && styles.radiusChipActive]}
                      >
                        <Text
                          style={[
                            styles.radiusChipText,
                            active && styles.radiusChipTextActive,
                          ]}
                        >
                          {preset}m
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <TextInput
                value={radiusText}
                onChangeText={handleRadiusChange}
                placeholder="50"
                placeholderTextColor={UI.border}
                keyboardType={decimalKeyboard}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            {validationError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            ) : null}

            <View style={styles.footerActions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
              >
                <Text style={styles.confirmBtnText}>Konfirmasi Lokasi</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    backgroundColor: UI.page,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: UI.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  closeBtn: {
    backgroundColor: UI.soft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 12,
  },
  mapContainer: {
    backgroundColor: UI.soft,
    height: 270,
    width: '100%',
  },
  mapFallbackBox: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 24,
  },
  mapFallbackTitle: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 15,
    textAlign: 'center',
  },
  mapFallbackText: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  controlsScroll: {
    flex: 1,
  },
  controlsContent: {
    gap: 10,
    padding: 20,
    paddingBottom: 28,
  },
  utilityRow: {
    flexDirection: 'row',
  },
  gpsButton: {
    alignItems: 'center',
    backgroundColor: UI.ink,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  gpsButtonText: {
    fontFamily: FONT.bold,
    color: UI.onColor,
    fontSize: 13,
  },
  warningBox: {
    backgroundColor: UI.soft,
    borderColor: UI.danger,
    borderRadius: 11,
    borderWidth: 1,
    padding: 10,
  },
  warningText: {
    fontFamily: FONT.regular,
    color: UI.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionLabel: {
    fontFamily: FONT.bold,
    color: UI.muted,
    fontSize: 11,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  chipRow: {
    gap: 8,
  },
  chip: {
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontFamily: FONT.semibold,
    color: UI.ink,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
    gap: 4,
  },
  inputLabel: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 12,
  },
  input: {
    fontFamily: FONT.regular,
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 11,
    borderWidth: 1,
    color: UI.ink,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  radiusSection: {
    gap: 6,
  },
  radiusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  radiusPresetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  radiusChip: {
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  radiusChipActive: {
    backgroundColor: UI.accent,
    borderColor: UI.accent,
  },
  radiusChipText: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 11,
  },
  radiusChipTextActive: {
    color: UI.onColor,
  },
  errorBox: {
    backgroundColor: UI.danger,
    borderRadius: 11,
    padding: 11,
  },
  errorText: {
    fontFamily: FONT.regular,
    color: UI.onColor,
    fontSize: 12,
    lineHeight: 17,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    alignItems: 'center',
    borderColor: UI.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    padding: 12,
  },
  cancelBtnText: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 14,
  },
  confirmBtn: {
    alignItems: 'center',
    backgroundColor: UI.accent,
    borderRadius: 12,
    flex: 1.5,
    justifyContent: 'center',
    minHeight: 46,
    padding: 12,
  },
  confirmBtnText: {
    fontFamily: FONT.bold,
    color: UI.onColor,
    fontSize: 14,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
