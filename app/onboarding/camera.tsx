import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Camera } from 'expo-camera'
import {
  OnboardingLayout,
  ProgressHeader,
  PrimaryButton,
  PermissionCameraVisual,
  SectionCard,
  FooterActionBar,
} from '../../components/onboarding'
import { ONBOARDING_STEP } from '../../constants/onboardingFlow'
import { ob, obType } from '../../constants/onboardingTheme'

export default function OnboardingCamera() {
  const [requesting, setRequesting] = useState(false)

  const handleAllow = async () => {
    setRequesting(true)
    try {
      await Camera.requestCameraPermissionsAsync()
    } finally {
      setRequesting(false)
      router.push('/onboarding/summary')
    }
  }

  return (
    <OnboardingLayout>
      <ProgressHeader
        stepIndex={ONBOARDING_STEP.camera}
        onBack={() => router.push('/onboarding/goal')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        <PermissionCameraVisual />
        <Text style={styles.title}>Ready to scan your first product?</Text>
        <Text style={styles.lead}>
          Allow camera access so Fillr can scan barcodes and break down ingredients instantly.
        </Text>
        <View style={styles.noteWrap}>
          <SectionCard title="Why we ask">
            <Text style={obType.body}>
              The camera is only used when you tap scan. You stay in control — no background video.
            </Text>
          </SectionCard>
        </View>
      </ScrollView>
      <FooterActionBar>
        <PrimaryButton
          title={requesting ? 'Requesting…' : 'Allow camera & continue'}
          onPress={() => void handleAllow()}
          loading={requesting}
        />
      </FooterActionBar>
    </OnboardingLayout>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  inner: { paddingBottom: 24 },
  title: { ...obType.title, marginBottom: 10, textAlign: 'center' },
  lead: {
    ...obType.subtitle,
    textAlign: 'center',
    marginBottom: 8,
    alignSelf: 'center',
    maxWidth: 340,
  },
  noteWrap: {
    marginTop: 20,
  },
})
