import { Share } from 'react-native'
import * as Linking from 'expo-linking'
import { REFERRAL_INVITEE_BONUS } from '../constants/subscription'
import { IOS_APP_STORE_URL } from './appStoreLinks'

export const REFERRAL_CODE_RE = /^FLR-[A-Z2-9]{4}$/

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export function looksLikeReferralCode(raw: string): boolean {
  return REFERRAL_CODE_RE.test(normalizeReferralCode(raw))
}

export function getReferralHttpLink(referralCode: string): string {
  void referralCode
  return IOS_APP_STORE_URL
}

export function getReferralDeepLink(referralCode: string): string {
  return Linking.createURL('join', {
    queryParams: { ref: normalizeReferralCode(referralCode) },
  })
}

export async function copyReferralLink(referralCode: string): Promise<string> {
  const link = getReferralHttpLink(referralCode)
  const Clipboard = await import('expo-clipboard')
  await Clipboard.setStringAsync(link)
  return link
}

export async function shareReferralLink(referralCode: string): Promise<void> {
  const link = getReferralHttpLink(referralCode)
  const normalizedCode = normalizeReferralCode(referralCode)
  const message = `I've been using Fillr to decode food labels 🌿

It tells you what every ingredient actually is, what it does to your body, and flags anything concerning.

Some of what it found in my snacks was wild.

Get ${REFERRAL_INVITEE_BONUS} free bonus scans when you sign up with my code ${normalizedCode}:
${link}`
  await Share.share({
    title: "I've been using this app to decode food labels",
    message,
  })
}

export function getRefFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const parsed = Linking.parse(url)
  const ref = parsed.queryParams?.ref
  if (!ref) return null
  const normalized = normalizeReferralCode(String(ref))
  return looksLikeReferralCode(normalized) ? normalized : null
}

