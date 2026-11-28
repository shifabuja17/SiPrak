import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

/**
 * Fallback web untuk `LabLocationPickerModal`: `react-native-maps` tidak tersedia
 * di web, jadi pengguna tetap dapat memakai preset, GPS browser, dan input manual.
 */
export default function LabLocationPickerModal({
  visible,
  initialLat,
  initialLng,
  initialRadius,
  onClose,
  onConfirm,
}: LabLocationPickerModalProps) {
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [radiusText, setRadiusText] = useState(String(DEFAULT_LABORATORY_RADIUS_METERS));
  const [radiusMeters, setRadiusMeters] = useState<number>(DEFAULT_LABORATORY_RADIUS_METERS);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!visible) return;
    const startLat =
      initialLat !== null && initialLat >= -90 && initialLat <= 90
        ? initialLat
        : FSM_UNDIP_DEFAULT_CENTER.latitude;
    const startLng =
      initialLng !== null && initialLng >= -180 && initialLng <= 180
        ? initialLng
        : FSM_UNDIP_DEFAULT_CENTER.longitude;
    const startRadius =
      initialRadius !== null && initialRadius > 0
        ? initialRadius
        : DEFAULT_LABORATORY_RADIUS_METERS;

    setLatText(startLat.toFixed(6));
    setLngText(startLng.toFixed(6));
    setRadiusMeters(startRadius);
    setRadiusText(String(startRadius));
    setGpsError('');
    setValidationError('');
  }, [visible, initialLat, initialLng, initialRadius]);

  async function handleUseCurrentLocation() {
    if (locating) return;
    setLocating(true);
    setGpsError('');
    setValidationError('');
    try {
      const coords = await getCurrentDeviceLocation();
      setLatText(coords.latitude.toFixed(6));
      setLngText(coords.longitude.toFixed(6));
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
        err instanceof Error ? err.message : 'Koordinat atau radius belum valid.',
      );
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <View style={styles.header}>
            <Text style={styles.title}>Pilih Lokasi &amp; Radius</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Tutup</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                Peta interaktif hanya tersedia di aplikasi Android / iOS. Di versi web,
                gunakan preset titik awal, lokasi browser, atau input manual.
              </Text>
            </View>

            <Pressable
              disabled={locating}
              onPress={() => void handleUseCurrentLocation()}
              style={[styles.gpsBtn, locating && styles.disabled]}
            >
              {locating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.gpsBtnText}>Gunakan Lokasi Saat Ini</Text>
              )}
            </Pressable>

            {gpsError ? <Text style={styles.errorInline}>{gpsError}</Text> : null}

            <Text style={styles.label}>Preset Titik Awal FSM UNDIP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {DEFAULT_LABORATORIES.map((preset) => (
                <Pressable
                  key={preset.id}
                  onPress={() => {
                    setLatText(preset.latitude.toFixed(6));
                    setLngText(preset.longitude.toFixed(6));
                    setValidationError('');
                  }}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{preset.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Latitude</Text>
            <TextInput value={latText} onChangeText={setLatText} style={styles.input} />

            <Text style={styles.label}>Longitude</Text>
            <TextInput value={lngText} onChangeText={setLngText} style={styles.input} />

            <Text style={styles.label}>Radius Presensi (meter)</Text>
            <View style={styles.chipRow}>
              {RADIUS_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => {
                    setRadiusMeters(preset);
                    setRadiusText(String(preset));
                  }}
                  style={[styles.chip, radiusMeters === preset && styles.chipActive]}
                >
                  <Text style={[styles.chipText, radiusMeters === preset && styles.chipTextActive]}>
                    {preset}m
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={radiusText}
              onChangeText={(text) => {
                setRadiusText(text);
                const parsed = parseNumericString(text);
                if (parsed !== null && parsed > 0) setRadiusMeters(parsed);
              }}
              style={styles.input}
            />

            {validationError ? <Text style={styles.errorInline}>{validationError}</Text> : null}

            <View style={styles.actions}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Batal</Text>
              </Pressable>
              <Pressable onPress={handleConfirm} style={styles.confirmBtn}>
                <Text style={styles.confirmText}>Konfirmasi Lokasi</Text>
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
  safeArea: { backgroundColor: UI.page, flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: UI.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontFamily: FONT.extrabold, color: UI.ink, fontSize: 18 },
  closeBtn: { backgroundColor: UI.soft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  closeBtnText: { fontFamily: FONT.bold, color: UI.ink, fontSize: 12 },
  content: { gap: 10, padding: 20 },
  noticeBox: { backgroundColor: UI.soft, borderRadius: 12, padding: 12 },
  noticeText: { fontFamily: FONT.regular, color: UI.muted, fontSize: 12, lineHeight: 18 },
  gpsBtn: {
    alignItems: 'center',
    backgroundColor: UI.ink,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    padding: 12,
  },
  gpsBtnText: { fontFamily: FONT.bold, color: UI.onColor, fontSize: 13 },
  label: { fontFamily: FONT.bold, color: UI.ink, fontSize: 13, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: UI.accent, borderColor: UI.accent },
  chipText: { fontFamily: FONT.semibold, color: UI.ink, fontSize: 12 },
  chipTextActive: { color: UI.onColor },
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
  errorInline: { fontFamily: FONT.regular, color: UI.danger, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: {
    alignItems: 'center',
    borderColor: UI.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    padding: 13,
  },
  cancelText: { fontFamily: FONT.bold, color: UI.ink, fontSize: 14 },
  confirmBtn: {
    alignItems: 'center',
    backgroundColor: UI.accent,
    borderRadius: 12,
    flex: 1.5,
    padding: 13,
  },
  confirmText: { fontFamily: FONT.bold, color: UI.onColor, fontSize: 14 },
  disabled: { opacity: 0.55 },
});
