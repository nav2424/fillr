import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, radius, typography } from '../constants/theme'
import type { SafetyStatus } from '../types'

interface SafetyBannerProps {
  status: SafetyStatus
  celiacSeverity?: 'SAFE' | 'CAUTION' | 'AVOID'
  celiacReason?: string
  hasAllergyMatch?: boolean
  hasSensitivityMatch?: boolean
  hasAvoidingMatch?: boolean
}

const STATUS_CONFIG: Record<
  SafetyStatus,
  { label: string; bg: string; text: string }
> = {
  SAFE: {
    label: 'SAFE FOR YOU',
    bg: colors.safeMuted,
    text: colors.safe,
  },
  CAUTION: {
    label: 'CAUTION',
    bg: colors.cautionMuted,
    text: colors.caution,
  },
  UNSAFE: {
    label: 'NOT SAFE FOR YOU',
    bg: colors.dangerMuted,
    text: colors.danger,
  },
  UNKNOWN: {
    label: 'REVIEW LABEL',
    bg: colors.unknownMuted,
    text: colors.unknown,
  },
}

export function SafetyBanner({
  status,
  celiacSeverity,
  celiacReason,
  hasAllergyMatch,
  hasSensitivityMatch,
  hasAvoidingMatch,
}: SafetyBannerProps) {
  if (celiacSeverity === 'AVOID') {
    return (
      <View style={styles.celiacAvoid}>
        <Text style={styles.celiacAvoidTitle}>🌾 Celiac Mode: Avoid</Text>
        <Text style={styles.celiacAvoidBody}>
          Contains gluten source — {celiacReason || 'unsafe for celiac disease.'}
        </Text>
      </View>
    )
  }
  if (celiacSeverity === 'CAUTION') {
    return (
      <View style={styles.celiacCaution}>
        <Text style={styles.celiacCautionTitle}>⚠️ Celiac Mode: Possible Gluten Risk</Text>
        <Text style={styles.celiacCautionBody}>
          {celiacReason || 'Gluten risk unclear; verify certified gluten-free labeling.'}
        </Text>
      </View>
    )
  }
  if (!hasAllergyMatch && !hasSensitivityMatch && !hasAvoidingMatch && status === 'SAFE') return null
  const config = STATUS_CONFIG[status]
  return (
    <View style={[styles.banner, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    ...typography.label,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  celiacAvoid: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  celiacAvoidTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991b1b',
  },
  celiacAvoidBody: {
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 18.2,
  },
  celiacCaution: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  celiacCautionTitle: {
    color: '#92400e',
    fontSize: 15,
    fontWeight: '800',
  },
  celiacCautionBody: {
    color: '#92400e',
    fontSize: 13,
    lineHeight: 18.2,
  },
})
