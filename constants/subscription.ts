/** Free-tier base scans (referrals add bonus scans on top). */
export const FREE_SCAN_LIMIT = 3

/** Bonus scans granted to a new user who signs up with a referral code. */
export const REFERRAL_INVITEE_BONUS = 3

/** Bonus scans granted to the referrer when a referred user converts. */
export const REFERRAL_REFERRER_BONUS = 3

/** Starting scans for a referred user: base + invitee bonus. */
export const REFERRAL_INVITEE_STARTING_SCANS = FREE_SCAN_LIMIT + REFERRAL_INVITEE_BONUS
