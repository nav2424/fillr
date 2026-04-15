import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../constants/theme'
import { useUserStore } from '../store/userStore'

export function FillrHeaderLogo() {
  const isPro = useUserStore((s) => s.isPro)
  return (
    <View style={styles.wrap}>
      <Text style={styles.wordmark}>fillr</Text>
      <View style={styles.dot} />
      {isPro && (
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>PREMIUM</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.text,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 6,
    marginTop: 3,
  },
  premiumBadge: {
    marginLeft: 8,
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
})
