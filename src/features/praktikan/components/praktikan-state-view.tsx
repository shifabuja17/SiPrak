import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import HeaderProfileBar from '@/components/common/HeaderProfileBar';
import { useAuth } from '@/context/AuthContext';
import { FONT } from '@/constants/fonts';
import { BORDER_COLOR, PAGE_BG } from '@/constants/colors';

export interface PraktikanLoadingStateProps {
  title?: string;
  message?: string;
  fullScreen?: boolean;
}

export interface PraktikanEmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

export interface PraktikanErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  retryDisabled?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryDisabled?: boolean;
}

export interface PraktikanInlineErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  retryDisabled?: boolean;
  onDismiss?: () => void;
  dismissLabel?: string;
}

export interface PraktikanProfileErrorScreenProps {
  title?: string;
  subtitle?: string;
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  buttonStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  buttonStyle,
  textStyle,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        buttonStyle,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

/**
 * Tampilan status memuat data (FR-22) dalam mode layar penuh maupun kartu inline.
 */
export function PraktikanLoadingState({
  title,
  message = 'Memuat data...',
  fullScreen = false,
}: PraktikanLoadingStateProps) {
  const combinedLabel = title ? `${title}. ${message}` : message;

  if (fullScreen) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View
          accessible
          accessibilityLabel={combinedLabel}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          style={styles.centerContainer}
        >
          <ActivityIndicator size="large" color="#000000" />
          {title ? <Text style={styles.fullLoadingTitle}>{title}</Text> : null}
          <Text style={styles.fullLoadingText}>{message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={combinedLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.emptyCard}
    >
      <ActivityIndicator size="small" color="#000000" />
      {title ? <Text style={styles.emptyTitle}>{title}</Text> : null}
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

/**
 * Kartu kondisi daftar kosong atau tidak ada data (FR-22) dengan aksi opsional.
 */
export function PraktikanEmptyState({
  title,
  message,
  actionLabel,
  onAction,
  actionDisabled = false,
}: PraktikanEmptyStateProps) {
  return (
    <View
      accessibilityLabel={`${title}. ${message}`}
      accessibilityLiveRegion="polite"
      style={styles.emptyCard}
    >
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>

      {actionLabel && onAction ? (
        <ActionButton
          buttonStyle={styles.primaryButton}
          disabled={actionDisabled}
          label={actionLabel}
          onPress={onAction}
          textStyle={styles.primaryButtonText}
        />
      ) : null}
    </View>
  );
}

/**
 * Kartu kondisi gangguan/error (FR-22) dengan tombol ulangi dan aksi sekunder opsional.
 */
export function PraktikanErrorState({
  title = 'Terjadi Gangguan',
  message,
  onRetry,
  retryLabel = 'Coba Lagi',
  retryDisabled = false,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryDisabled = false,
}: PraktikanErrorStateProps) {
  const hasActions = Boolean(onRetry || (secondaryActionLabel && onSecondaryAction));

  return (
    <View
      accessibilityLabel={`${title}. ${message}`}
      accessibilityLiveRegion="polite"
      style={styles.errorCard}
    >
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorText}>{message}</Text>

      {hasActions ? (
        <View style={styles.errorActionsColumn}>
          {onRetry ? (
            <ActionButton
              buttonStyle={styles.retryButton}
              disabled={retryDisabled}
              label={retryLabel}
              onPress={onRetry}
              textStyle={styles.retryButtonText}
            />
          ) : null}

          {secondaryActionLabel && onSecondaryAction ? (
            <ActionButton
              buttonStyle={styles.errorSecondaryButton}
              disabled={secondaryDisabled}
              label={secondaryActionLabel}
              onPress={onSecondaryAction}
              textStyle={styles.errorSecondaryButtonText}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Banner error non-blocking untuk ditempatkan bersama konten yang sudah tampil (FR-22).
 */
export function PraktikanInlineErrorBanner({
  title,
  message,
  onRetry,
  retryLabel = 'Coba Lagi',
  retryDisabled = false,
  onDismiss,
  dismissLabel = 'Tutup',
}: PraktikanInlineErrorBannerProps) {
  const hasActions = Boolean(onRetry || onDismiss);

  return (
    <View
      accessibilityLabel={title ? `${title}. ${message}` : message}
      accessibilityLiveRegion="polite"
      style={styles.inlineBanner}
    >
      {title ? <Text style={styles.inlineBannerTitle}>{title}</Text> : null}
      <Text style={styles.inlineBannerText}>{message}</Text>

      {hasActions ? (
        <View style={styles.inlineBannerActions}>
          {onRetry ? (
            <ActionButton
              buttonStyle={styles.inlineRetryButton}
              disabled={retryDisabled}
              label={retryLabel}
              onPress={onRetry}
              textStyle={styles.inlineRetryButtonText}
            />
          ) : null}

          {onDismiss ? (
            <ActionButton
              buttonStyle={styles.inlineDismissButton}
              label={dismissLabel}
              onPress={onDismiss}
              textStyle={styles.inlineDismissButtonText}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Layar penuh saat Firebase Auth memiliki `user`, namun profil Firestore gagal dimuat
 * (`profileError || !profile`). Menyediakan panduan koneksi serta tombol `logout`.
 */
export function PraktikanProfileErrorScreen({
  title = 'SiPrak',
  subtitle = 'Status akun terdeteksi, namun data profil belum dapat dimuat.',
}: PraktikanProfileErrorScreenProps) {
  const { user, profileError, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const errorDetail =
    typeof profileError === 'string' && profileError.trim().length > 0
      ? profileError.trim()
      : 'Dokumen profil pengguna pada Firestore belum ditemukan atau gagal terbaca.';

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (err) {
      setLogoutError(
        err instanceof Error && err.message
          ? err.message
          : 'Gagal keluar dari akun. Periksa koneksi internet lalu coba lagi.',
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>{title}</Text>
          <Text style={styles.screenSubtitle}>{subtitle}</Text>
          <HeaderProfileBar />
        </View>

        <View
          accessibilityLabel={`Gagal memuat profil akun. ${errorDetail}`}
          accessibilityLiveRegion="polite"
          style={styles.errorCard}
        >
          <Text style={styles.errorTitle}>Gagal Memuat Profil Akun</Text>
          <Text style={styles.errorText}>{errorDetail}</Text>

          {user?.email ? (
            <Text style={styles.accountHint}>Akun aktif: {user.email}</Text>
          ) : null}

          <View style={styles.guidanceBox}>
            <Text style={styles.guidanceTitle}>Langkah yang dapat dicoba:</Text>
            <Text style={styles.guidanceText}>
              1. Pastikan koneksi internet perangkat stabil dan tidak terblokir.{'\n'}
              2. Tutup lalu buka kembali aplikasi untuk menyegarkan sinkronisasi profil.{'\n'}
              3. Jika kendala berlanjut, keluar dari akun lalu masuk kembali.
            </Text>
          </View>

          {logoutError ? (
            <View style={styles.logoutErrorBox}>
              <Text style={styles.logoutErrorText}>{logoutError}</Text>
            </View>
          ) : null}

          <ActionButton
            accessibilityLabel="Keluar dari akun"
            buttonStyle={styles.logoutPrimaryButton}
            disabled={loggingOut}
            label={loggingOut ? 'Sedang Keluar...' : 'Keluar dari Akun'}
            onPress={() => void handleLogout()}
            textStyle={styles.logoutPrimaryButtonText}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: PAGE_BG,
    flex: 1,
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  fullLoadingTitle: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 16,
    textAlign: 'center',
  },
  fullLoadingText: {
    fontFamily: FONT.regular,
    color: '#525252',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  screenContent: {
    gap: 16,
    padding: 20,
    paddingBottom: 40,
    paddingTop: 32,
  },
  screenHeader: {
    gap: 8,
  },
  screenTitle: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 28,
    marginTop: 5,
  },
  screenSubtitle: {
    fontFamily: FONT.regular,
    color: '#525252',
    fontSize: 14,
    lineHeight: 21,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderWidth: 1,
    borderRadius: 26,
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 15,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: FONT.regular,
    color: '#525252',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#111014',
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#E00000',
    borderColor: '#E00000',
    borderWidth: 1,
    borderRadius: 26,
    gap: 10,
    padding: 20,
  },
  errorTitle: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorActionsColumn: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 4,
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },
  errorSecondaryButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorSecondaryButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  inlineBanner: {
    backgroundColor: '#E00000',
    borderRadius: 20,
    gap: 8,
    padding: 14,
  },
  inlineBannerTitle: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  inlineBannerText: {
    fontFamily: FONT.semibold,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 19,
  },
  inlineBannerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  inlineRetryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  inlineRetryButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 12,
  },
  inlineDismissButton: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  inlineDismissButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 12,
  },
  accountHint: {
    fontFamily: FONT.semibold,
    color: '#111014',
    fontSize: 12,
    textAlign: 'center',
  },
  guidanceBox: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  guidanceTitle: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 12,
  },
  guidanceText: {
    fontFamily: FONT.regular,
    color: '#404040',
    fontSize: 12,
    lineHeight: 18,
  },
  logoutErrorBox: {
    alignSelf: 'stretch',
    backgroundColor: '#E00000',
    borderColor: '#E00000',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  logoutErrorText: {
    fontFamily: FONT.semibold,
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  logoutPrimaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#111014',
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  logoutPrimaryButtonText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.72,
  },
});
