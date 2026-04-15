/**
 * AsyncStorage-backed dietary profile for personalization (analysis + UI).
 */

const RNAsync = require('@react-native-async-storage/async-storage')
const AsyncStorage = RNAsync.default ?? RNAsync

const STORAGE_KEY = 'fillr-user-profile-v1'
const DEPRECATED_AVOIDING_KEYS = new Set([
  'hormone-treated dairy',
  'factory farmed meat',
  'non-organic produce',
])

const DEFAULT_PROFILE = {
  allergies: [],
  sensitivities: [],
  avoiding: [],
  preferences: [],
  goal: '',
  celiacStrictGluten: false,
}

function sanitizeProfile(profile) {
  const avoiding = Array.isArray(profile?.avoiding)
    ? profile.avoiding.filter((k) => !DEPRECATED_AVOIDING_KEYS.has(normItem(k)))
    : []
  return {
    allergies: Array.isArray(profile?.allergies) ? [...profile.allergies] : [],
    sensitivities: Array.isArray(profile?.sensitivities) ? [...profile.sensitivities] : [],
    avoiding,
    preferences: Array.isArray(profile?.preferences) ? [...profile.preferences] : [],
    goal: typeof profile?.goal === 'string' ? profile.goal : '',
    celiacStrictGluten: profile?.celiacStrictGluten === true,
  }
}

/** @returns {Promise<null | { allergies: string[], sensitivities: string[], avoiding: string[], preferences: string[] }>} */
async function getUserProfileOrNull() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const o = JSON.parse(raw)
    const next = sanitizeProfile(o)
    // Migration: rewrite local profile once so deprecated avoiding keys are stripped.
    if (JSON.stringify(next.avoiding) !== JSON.stringify(Array.isArray(o.avoiding) ? o.avoiding : [])) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
    return next
  } catch {
    return null
  }
}

async function getUserProfile() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE }
    const o = JSON.parse(raw)
    const next = sanitizeProfile(o)
    // Migration: rewrite local profile once so deprecated avoiding keys are stripped.
    if (JSON.stringify(next.avoiding) !== JSON.stringify(Array.isArray(o.avoiding) ? o.avoiding : [])) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
    return next
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

async function saveUserProfile(profile) {
  let prevCeliac = false
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const o = JSON.parse(raw)
      prevCeliac = o.celiacStrictGluten === true
    }
  } catch {
    prevCeliac = false
  }

  const next = {
    ...sanitizeProfile(profile),
    celiacStrictGluten: typeof profile.celiacStrictGluten === 'boolean' ? profile.celiacStrictGluten : prevCeliac,
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

function normItem(item) {
  return String(item || '')
    .toLowerCase()
    .trim()
}

async function addAllergy(item) {
  const p = await getUserProfile()
  const n = normItem(item)
  if (!n) return p
  if (!p.allergies.some((a) => normItem(a) === n)) p.allergies.push(n)
  await saveUserProfile(p)
  return p
}

async function removeAllergy(item) {
  const p = await getUserProfile()
  const n = normItem(item)
  p.allergies = p.allergies.filter((a) => normItem(a) !== n)
  await saveUserProfile(p)
  return p
}

async function addSensitivity(item) {
  const p = await getUserProfile()
  const n = normItem(item)
  if (!n) return p
  if (!p.sensitivities.some((a) => normItem(a) === n)) p.sensitivities.push(n)
  await saveUserProfile(p)
  return p
}

async function removeSensitivity(item) {
  const p = await getUserProfile()
  const n = normItem(item)
  p.sensitivities = p.sensitivities.filter((a) => normItem(a) !== n)
  await saveUserProfile(p)
  return p
}

async function addAvoiding(item) {
  const p = await getUserProfile()
  const n = normItem(item)
  if (!n) return p
  if (!p.avoiding.some((a) => normItem(a) === n)) p.avoiding.push(n)
  await saveUserProfile(p)
  return p
}

async function removeAvoiding(item) {
  const p = await getUserProfile()
  const n = normItem(item)
  p.avoiding = p.avoiding.filter((a) => normItem(a) !== n)
  await saveUserProfile(p)
  return p
}

module.exports = {
  getUserProfile,
  getUserProfileOrNull,
  saveUserProfile,
  addAllergy,
  removeAllergy,
  addSensitivity,
  removeSensitivity,
  addAvoiding,
  removeAvoiding,
}
