import { StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'

/** Shared surfaces for upgrade / limit prompts — clean, minimal. */
export const conversionUi = StyleSheet.create({
  lightCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
  },
  darkCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: spacing.lg,
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  captionOnDark: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  title: {
    ...typography.label,
    color: colors.text,
  },
  titleOnDark: {
    ...typography.label,
    color: colors.backgroundElevated,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bodyOnDark: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.78)',
    lineHeight: 20,
  },
  textLink: {
    ...typography.labelSmall,
    color: colors.accent,
  },
  textLinkOnDark: {
    ...typography.labelSmall,
    color: colors.accentLight,
  },
})
