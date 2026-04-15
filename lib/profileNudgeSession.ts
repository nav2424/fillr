/** In-memory: show "no profile" nudge at once per app session. */
let profileNudgeShownThisSession = false

export function hasShownProfileNudgeThisSession(): boolean {
  return profileNudgeShownThisSession
}

export function markProfileNudgeShownThisSession(): void {
  profileNudgeShownThisSession = true
}
