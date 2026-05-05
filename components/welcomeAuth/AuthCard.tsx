import { View, Text, Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useFonts, DMSans_800ExtraBold, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans'
import { Ionicons } from '@expo/vector-icons'
import { wa, waCardEdgeGradient } from '../../constants/welcomeAuthTheme'
import { InputField, PasswordToggle } from './InputField'
import { PrimaryButton } from './PrimaryButton'

type Props = {
  email: string
  password: string
  onChangeEmail: (t: string) => void
  onChangePassword: (t: string) => void
  showPassword: boolean
  onTogglePassword: () => void
  rememberMe: boolean
  onToggleRememberMe: () => void
  onContinue: () => void
  onForgotPassword: () => void
  loading: boolean
  formError: string | null
  emailInvalid: boolean
}

export function AuthCard({
  email,
  password,
  onChangeEmail,
  onChangePassword,
  showPassword,
  onTogglePassword,
  rememberMe,
  onToggleRememberMe,
  onContinue,
  onForgotPassword,
  loading,
  formError,
  emailInvalid,
}: Props) {
  const [fontsLoaded] = useFonts({
    DMSans_800ExtraBold,
    DMSans_500Medium,
    DMSans_600SemiBold,
  })
  const hFont = fontsLoaded ? { fontFamily: 'DMSans_800ExtraBold' as const } : { fontWeight: '800' as const }
  const subFont = fontsLoaded ? { fontFamily: 'DMSans_500Medium' as const } : { fontWeight: '500' as const }
  const linkFont = fontsLoaded ? { fontFamily: 'DMSans_600SemiBold' as const } : { fontWeight: '600' as const }

  return (
    <View style={[styles.elevate, wa.shadowCard]}>
      <LinearGradient
        colors={[...waCardEdgeGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.edge}
      >
        <View style={styles.card}>
          <Text style={[styles.headline, hFont]}>Welcome back 👋</Text>
          <Text style={[styles.subhead, subFont]}>Sign in to continue your health journey.</Text>

          <InputField
            icon="mail-outline"
            placeholder="Email address"
            value={email}
            onChangeText={onChangeEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            error={emailInvalid}
          />
          <InputField
            icon="lock-closed-outline"
            placeholder="Password"
            value={password}
            onChangeText={onChangePassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={onContinue}
            rightSlot={<PasswordToggle visible={showPassword} onToggle={onTogglePassword} />}
          />

          <View style={styles.rowBetween}>
            <Pressable
              onPress={onToggleRememberMe}
              style={({ pressed }) => [styles.remember, pressed && { opacity: 0.8 }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
            >
              <Ionicons
                name={rememberMe ? 'checkbox' : 'square-outline'}
                size={22}
                color={rememberMe ? wa.accentDeep : wa.muted}
              />
              <Text style={[styles.rememberText, linkFont]}>Remember me</Text>
            </Pressable>
            <Pressable
              onPress={onForgotPassword}
              style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.75 }]}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
            >
              <Text style={[styles.forgotText, linkFont]}>Forgot password?</Text>
            </Pressable>
          </View>

          {(formError || emailInvalid) && (
            <Text style={styles.errorText}>{formError ?? 'Please enter a valid email address.'}</Text>
          )}

          <PrimaryButton
            title={loading ? 'Signing in…' : 'Sign in'}
            onPress={onContinue}
            loading={loading}
            showArrow={!loading}
          />
        </View>
      </LinearGradient>
    </View>
  )
}

const R = 26

const styles = StyleSheet.create({
  elevate: {
    borderRadius: R + 1,
    overflow: 'visible',
  },
  edge: {
    borderRadius: R + 1,
    padding: 1,
  },
  card: {
    borderRadius: R,
    backgroundColor: wa.card,
    padding: 22,
    gap: 14,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: wa.ink,
    letterSpacing: -0.5,
  },
  subhead: {
    fontSize: 14,
    fontWeight: '500',
    color: wa.slate,
    lineHeight: 20,
    marginTop: -6,
    marginBottom: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: -2,
  },
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  rememberText: {
    fontSize: 14,
    fontWeight: '600',
    color: wa.ink,
  },
  forgot: {
    flexShrink: 0,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: wa.accentDeep,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: wa.danger,
    textAlign: 'left',
    marginTop: -6,
    lineHeight: 18,
  },
})
