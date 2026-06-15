import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ProfileReasoningModel } from '../lib/buildProfileReasoning'
import type { ScoreContributor } from '../lib/buildScoreExplainability'
import type { FillrScoringDataSnapshot } from '../types'
import { ProfileReasoningCard } from './ProfileReasoningCard'
import { ScanResultCard } from './ScanResultCard'
import { theme } from '../constants/theme'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export type ProductForYouSectionProps = {
  profileTone: 'bad' | 'warn' | 'ok'
  profileReasoning: ProfileReasoningModel
  profileCollapsedTitle: string
  profileCollapsedSubtitle: string
  scoringData?: FillrScoringDataSnapshot
  contributors?: ScoreContributor[]
}

function toneMeta(tone: 'bad' | 'warn' | 'ok'): { dot: string; icon: keyof typeof Ionicons.glyphMap } {
  if (tone === 'bad') return { dot: theme.flagged.accent, icon: 'alert-circle' }
  if (tone === 'warn') return { dot: theme.processed.accent, icon: 'remove-circle' }
  return { dot: theme.green500, icon: 'checkmark-circle' }
}

export function ProductForYouSection({
  profileTone,
  profileReasoning,
  profileCollapsedTitle,
  profileCollapsedSubtitle,
  scoringData,
  contributors = [],
}: ProductForYouSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const meta = toneMeta(profileTone)

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded((v) => !v)
  }

  return (
    <ScanResultCard accentColor={meta.dot} flush bodyStyle={styles.body}>
      <Pressable
        onPress={toggleExpanded}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse for you section' : 'Expand for you section'}
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerMain}>
          <View style={[styles.statusOrb, { backgroundColor: `${meta.dot}18` }]}>
            <Ionicons name={meta.icon} size={18} color={meta.dot} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>For you</Text>
            <Text style={styles.title} numberOfLines={1}>
              {profileCollapsedTitle}
            </Text>
            {!expanded ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {profileCollapsedSubtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.chevronWrap}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textFaint} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.expanded}>
          <ProfileReasoningCard
            model={profileReasoning}
            contributors={contributors}
            scoringData={scoringData}
            hideScoreBadge
          />
        </View>
      ) : null}
    </ScanResultCard>
  )
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 28,
    paddingRight: 16,
    paddingVertical: 16,
    gap: 8,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minWidth: 0,
  },
  statusOrb: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textFaint,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: theme.textMuted,
    marginTop: 3,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f4f6f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expanded: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingLeft: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.05)',
  },
})
