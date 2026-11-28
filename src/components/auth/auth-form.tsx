import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONT } from '@/constants/fonts';
import { ROLE_OPTIONS, type Role } from '@/types/user';

/** Kerangka layar login/registrasi: logo SiPrak, judul, dan konten form. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image
              source={require('../../../assets/images/siprak-logo.png')}
              style={styles.logo}
              accessibilityRole="image"
              accessibilityLabel="Logo SiPrak"
            />
          </View>

          <View style={styles.headingContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface AuthFieldProps extends TextInputProps {
  label: string;
}

export function AuthField({ label, style, ...inputProps }: AuthFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#999999"
        style={[styles.input, style]}
        {...inputProps}
      />
    </View>
  );
}

/** Pemilih peran akun pada form registrasi (Praktikan, Asprak, Aslab). */
export function AuthRoleSelector({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  const selectedOption = ROLE_OPTIONS.find((item) => item.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.roleRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {ROLE_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.roleOption,
                selected && styles.roleOptionActive,
                disabled && styles.roleOptionDisabled,
                pressed && !disabled && !selected && styles.pressed,
              ]}
            >
              <Text style={[styles.roleOptionText, selected && styles.roleOptionTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {selectedOption ? (
        <Text style={styles.roleHint}>{selectedOption.description}</Text>
      ) : null}
    </View>
  );
}

/** Pesan galat inline (validasi input, gagal login, dll). */
export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function AuthButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        inactive && isPrimary && styles.buttonDisabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : '#000000'} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary ? styles.buttonTextPrimary : styles.buttonTextSecondary,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Tautan teks kecil, mis. "Belum punya akun? Daftar". */
export function AuthLink({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.linkRow}>
      <Text style={styles.linkPrompt}>{prompt} </Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={styles.linkAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 20,
    padding: 22,
    paddingTop: 36,
    paddingBottom: 36,
  },
  brand: {
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  logo: {
    height: 96,
    width: 96,
  },
  headingContainer: {
    gap: 7,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 25,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONT.regular,
    color: '#666666',
    fontSize: 12,
    lineHeight: 21,
    textAlign: 'center',
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: FONT.bold,
    color: '#000000',
    fontSize: 13,
  },
  input: {
    fontFamily: FONT.regular,
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 14,
    borderWidth: 1,
    color: '#000000',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  roleOptionActive: {
    backgroundColor: '#F47321',
    borderColor: '#F47321',
  },
  roleOptionDisabled: {
    opacity: 0.6,
  },
  roleOptionText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },
  roleOptionTextActive: {
    color: '#FFFFFF',
  },
  roleHint: {
    fontFamily: FONT.regular,
    color: '#666666',
    fontSize: 12,
    lineHeight: 17,
  },
  errorBox: {
    backgroundColor: '#F2F2F2',
    borderColor: '#000000',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    fontFamily: FONT.regular,
    color: '#000000',
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 50,
    padding: 16,
  },
  buttonPrimary: {
    backgroundColor: '#F47321',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderWidth: 1,
  },
  buttonDisabled: {
    backgroundColor: '#999999',
  },
  buttonText: {
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: '#000000',
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  linkPrompt: {
    fontFamily: FONT.regular,
    color: '#666666',
    fontSize: 12,
  },
  linkAction: {
    fontFamily: FONT.extrabold,
    color: '#000000',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.65,
  },
});
