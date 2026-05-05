let audioModeConfigured = false

/**
 * Short “ka-ching” style success chime when a scan is SAFE.
 * Asset: Mixkit “Gold coin prize” (https://mixkit.co/license/#sfxFree).
 *
 * Loads `expo-av` only when called so screens that import this module do not
 * crash if the native binary was built without AV (rebuild with `expo run:ios`
 * / a new dev client after adding expo-av).
 */
export async function playSafeScanSound(): Promise<void> {
  try {
    const { Audio } = await import('expo-av')
    if (!audioModeConfigured) {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
      })
      audioModeConfigured = true
    }
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/safe-scan-ka-ching.mp3'),
      { shouldPlay: true, volume: 0.9 },
    )
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return
      if (status.didJustFinish) {
        void sound.unloadAsync().catch(() => {})
      }
    })
  } catch {
    /* Simulator / missing native module / web quirks — ignore */
  }
}
