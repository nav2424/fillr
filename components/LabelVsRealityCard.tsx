import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { LabelVsRealityItem } from '../types'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const TEXT_PRIMARY = '#0a0a0a'

type Props = {
  items: LabelVsRealityItem[]
  isPro: boolean
}

export function LabelVsRealityCard({ items, isPro }: Props) {
  const [open, setOpen] = useState(false)

  if (!items.length) return null

  if (!isPro) {
    return (
      <View style={styles.shell}>
        <Pressable
          style={styles.headerRow}
          onPress={() =>
            Alert.alert(
              'Fillr Pro',
              'Upgrade to unlock Label vs Reality — claim-by-claim breakdowns of packaging vs ingredients.'
            )
          }
        >
          <Text style={styles.title}>Label vs Reality</Text>
          <View style={styles.proPill}>
            <Text style={styles.proPillText}>Pro</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </Pressable>
        <Text style={styles.lockedHint}>{items.length} insight{items.length === 1 ? '' : 's'} locked</Text>
      </View>
    )
  }

  return (
    <View style={styles.shell}>
      <Pressable
        style={styles.headerRow}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setOpen((v) => !v)
        }}
      >
        <Text style={styles.title}>Label vs Reality</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color="#0a0a0a" />
      </Pressable>
      {open && (
        <View style={styles.body}>
          {items.map((row, i) => (
            <View key={`${row.claim}-${i}`} style={styles.row}>
              <Text style={styles.claim} numberOfLines={4}>
                {row.claim}
              </Text>
              <Text style={styles.realityLabel}>What the list shows</Text>
              <Text style={styles.reality}>{row.reality}</Text>
              {!!row.example?.trim() && (
                <Text style={styles.example}>{row.example.trim()}</Text>
              )}
              {i < items.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  proPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: '#fef3c7',
  },
  proPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
  lockedHint: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    fontSize: 13,
    color: '#9ca3af',
  },
  body: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  row: {
    paddingTop: 4,
  },
  claim: {
    fontSize: 14,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    lineHeight: 20,
    marginBottom: 8,
  },
  realityLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  reality: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  example: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#4b5563',
    fontStyle: 'italic',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 16,
  },
})
