import { useI18n } from 'vue-i18n'
import { assignmentPreview } from '../visualFeedback'
type DamageEntity = {
  tokens: { Damage?: number; Horror?: number }
  remainingHealth?: number | null; remainingSanity?: number | null
  assignedHealthDamage: number; assignedHealthHeal: number
  assignedSanityDamage: number; assignedSanityHeal: number
}
export function useDamagePreview() {
  const { t } = useI18n()
  return (entity: DamageEntity, kind: 'Damage' | 'Horror') => {
    const damage = kind === 'Damage'
    const taken = entity.tokens[kind] ?? 0
    const assigned = damage ? entity.assignedHealthDamage : entity.assignedSanityDamage
    const healing = damage ? entity.assignedHealthHeal : entity.assignedSanityHeal
    const remaining = damage ? entity.remainingHealth : entity.remainingSanity
    const preview = assignmentPreview(remaining, taken, assigned, healing)
    const lines = [t('visualFeedback.takenDetail', { kind: t(`visualFeedback.${kind}`), count: taken })]
    if (assigned || healing) lines.push(t('visualFeedback.assignmentDetail', { assigned, healing }))
    if (preview) {
      lines.push(t(damage ? 'visualFeedback.healthRemaining' : 'visualFeedback.sanityRemaining', { count: preview.remaining }))
      if (assigned || healing) lines.push(t('visualFeedback.afterAssignment', { count: preview.after ?? t('visualFeedback.unknown') }))
    }
    return lines.join(' · ')
  }
}
