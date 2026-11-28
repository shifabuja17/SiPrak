export interface LabLocationPickerResult {
  lat: number;
  lng: number;
  radius: number;
}

export interface LabLocationPickerModalProps {
  visible: boolean;
  initialLat: number | null;
  initialLng: number | null;
  initialRadius: number | null;
  onClose: () => void;
  onConfirm: (result: LabLocationPickerResult) => void;
}

export const FSM_UNDIP_DEFAULT_CENTER = {
  latitude: -7.0486375,
  longitude: 110.441125,
} as const;

export const RADIUS_PRESETS = [25, 50, 100, 150] as const;
