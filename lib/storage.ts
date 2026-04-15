/**
 * Storage adapter that falls back to in-memory when AsyncStorage native module is unavailable
 * (e.g. web, or certain Expo Go environments)
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const memoryStore: Record<string, string> = {}

async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key)
  } catch {
    return memoryStore[key] ?? null
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value)
  } catch {
    memoryStore[key] = value
  }
}

async function safeRemoveItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key)
  } catch {
    delete memoryStore[key]
  }
}

export const storage = {
  getItem: safeGetItem,
  setItem: safeSetItem,
  removeItem: safeRemoveItem,
}
