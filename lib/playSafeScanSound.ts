/**
 * Short “ka-ching” style success chime when a scan is SAFE.
 *
 * Disabled while the app is on Expo SDK 55 because `expo-av` still imports
 * removed ExpoModulesCore Objective-C headers and breaks iOS release builds.
 */
export async function playSafeScanSound(): Promise<void> {
  return Promise.resolve()
}
