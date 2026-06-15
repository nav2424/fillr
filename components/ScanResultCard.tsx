import type { ReactNode } from 'react'
import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../constants/theme'

type Props = {
  children: ReactNode
  title?: string
  subtitle?: string
  icon?: keyof typeof Ionicons.glyphMap
  accentColor?: string
  style?: ViewStyle
  bodyStyle?: ViewStyle
  flush?: boolean
}

/** Shared surface for scan-result sections. */
export function ScanResultCard({
  children,
  title,
  subtitle,
  icon,
  accentColor,
  style,
  bodyStyle,
  flush,
}: Props) {
  const hasHeader = Boolean(title || subtitle || icon)

  return (
    <View style={[styles.wrap, flush && styles.wrapFlush, style]}>
      <View style={styles.card}>
        {accentColor ? <View style={[styles.accentDot, { backgroundColor: accentColor }]} /> : null}
        {hasHeader ? (
          <View style={styles.header}>
            {icon ? (
              <View style={styles.iconOrb}>
                <Ionicons name={icon} size={16} color={theme.textSecondary} />
              </View>
            ) : null}
            <View style={styles.headerText}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>
        ) : null}
        <View style={[styles.body, bodyStyle]}>{children}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
  },
  wrapFlush: {
    marginTop: 0,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  accentDot: {
    position: 'absolute',
    top: 18,
    left: 16,
    width: 6,
    height: 6,
    borderRadius: 3,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 2,
  },
  iconOrb: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f4f6f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textFaint,
  },
  body: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 6,
  },
})
