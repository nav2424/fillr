import { Pressable, Text, StyleSheet, Platform } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../constants/theme'

export function StackBackButton() {
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      style={styles.press}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="chevron-back" size={28} color={colors.text} />
      <Text style={styles.label}>Back</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  press: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingRight: 2,
    marginLeft: Platform.OS === 'ios' ? 4 : 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  label: {
    fontSize: 17,
    fontWeight: '400',
    color: colors.text,
    marginLeft: -6,
  },
})
