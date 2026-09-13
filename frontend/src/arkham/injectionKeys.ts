import type { InjectionKey, Ref } from 'vue'
import type { Phase } from '@/arkham/types/Phase'
import type { ArkhamDbDecklist } from '@/arkham/types/Deck'

// Symbols shared by Game.vue's providers and the components below it; a key whose
// shape a composable owns stays with that composable (useGameChoices, useGameIndexes).

export const soloKey: InjectionKey<Ref<boolean>> = Symbol('solo')
export const spectateKey: InjectionKey<Ref<boolean>> = Symbol('spectate')
// A viewed teammate's subtree may expose cards, but never raw debug mutations.
export const debugControlsAllowedKey: InjectionKey<Ref<boolean>> = Symbol('debugControlsAllowed')
export const processingKey: InjectionKey<Ref<boolean>> = Symbol('processing')
export const uiLockKey: InjectionKey<Ref<boolean>> = Symbol('uiLock')
// Owned by Game.vue; all presentation and answer paths share this barrier.
export const announcedPhaseKey: InjectionKey<Readonly<Ref<Phase | null>>> = Symbol('announcedPhase')
export const phaseAnnouncementKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('phaseAnnouncement')
export const storyAnswerPendingKey: InjectionKey<Ref<boolean>> = Symbol('storyAnswerPending')
export const showOtherPlayersHandsKey: InjectionKey<Ref<boolean>> = Symbol('showOtherPlayersHands')
export const skipAllAvailableKey: InjectionKey<Ref<boolean>> = Symbol('skipAllAvailable')
export const skipAllInProgressKey: InjectionKey<Ref<boolean>> = Symbol('skipAllInProgress')
export const cardFlipAllKey: InjectionKey<Ref<boolean>> = Symbol('cardFlipAll')
export const isMinimizedSkillTestKey: InjectionKey<Ref<boolean>> = Symbol('isMinimized_SkillTest')

export const skipAllTriggersKey: InjectionKey<() => void> = Symbol('skipAllTriggers')
export const switchInvestigatorKey: InjectionKey<(playerId: string) => void> =
  Symbol('switchInvestigator')
export const sendKey: InjectionKey<(msg: string) => void> = Symbol('send')

export const chooseDeckKey: InjectionKey<(deckId: string, overlay: unknown) => Promise<void>> =
  Symbol('chooseDeck')
export const chooseDeckListKey: InjectionKey<(deckList: ArkhamDbDecklist) => Promise<void>> =
  Symbol('chooseDeckList')
export const choosePaymentAmountsKey: InjectionKey<
  (amounts: Record<string, number>) => Promise<void>
> = Symbol('choosePaymentAmounts')
export const chooseAmountsKey: InjectionKey<
  (amounts: Record<string, number>) => Promise<void>
> = Symbol('chooseAmounts')
export const scenarioSpecificAnswerKey: InjectionKey<
  (key: string, value: unknown) => Promise<void>
> = Symbol('scenarioSpecificAnswer')

export const undoControlsKey: InjectionKey<{
  canUndoAction: Readonly<Ref<boolean>>
  canUndoTurn: Readonly<Ref<boolean>>
  canUndoPhase: Readonly<Ref<boolean>>
  canUndoRound: Readonly<Ref<boolean>>
  canUndoScenario: Readonly<Ref<boolean>>
  undoChordArmed: Readonly<Ref<boolean>>
  confirmingUndoScenario: Ref<boolean>
  undo: () => Promise<void>
  undoActionStart: () => Promise<void>
  undoTurnStart: () => Promise<void>
  undoPhaseStart: () => Promise<void>
  undoRoundStart: () => Promise<void>
}> = Symbol('undoControls')
