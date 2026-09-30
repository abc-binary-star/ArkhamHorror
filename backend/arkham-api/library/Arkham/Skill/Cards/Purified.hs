module Arkham.Skill.Cards.Purified (purified) where

import Arkham.Helpers.ChaosBag (getRemainingBlessTokens)
import Arkham.Matcher
import Arkham.Skill.Cards qualified as Cards
import Arkham.Skill.Import.Lifted

newtype Purified = Purified SkillAttrs
  deriving anyclass (IsSkill, HasModifiersFor, HasAbilities)
  deriving newtype (Show, Eq, ToJSON, FromJSON, Entity)

purified :: SkillCard Purified
purified = skill Purified Cards.purified

instance RunMessage Purified where
  runMessage msg s@(Purified attrs) = runQueueT $ case msg of
    PassedSkillTest _ _ _ (isTarget attrs -> True) _ (min 5 -> n) | n > 0 -> do
      skillTestCardOption attrs $ doStep n msg
      pure s
    DoStep n (PassedSkillTest iid _ _ (isTarget attrs -> True) _ _) -> do
      curse <- selectCount $ ChaosTokenFaceIs #curse
      bless <- getRemainingBlessTokens

      if
        | bless == 0 && curse == 0 -> pure ()
        | bless == 0 && curse /= 0 -> repeated (min curse n) $ removeChaosToken #curse
        | curse == 0 && bless /= 0 -> repeated (min bless n) $ addChaosToken #bless
        | bless + curse == n -> do
            repeated curse $ removeChaosToken #curse
            repeated bless $ addChaosToken #bless
        | otherwise -> skillTestCardOption attrs do
            chooseAmounts
              iid
              "$label.addBlessOrRemoveCurseTokens"
              (TotalAmountTarget $ min n (bless + curse))
              [("$addBlessTokens", (0, bless)), ("$removeCurseTokens", (0, curse))]
              attrs
      pure s
    ResolveAmounts _iid choices (isTarget attrs -> True) -> do
      let
        bless = getChoiceAmount "$addBlessTokens" choices
        curse = getChoiceAmount "$removeCurseTokens" choices

      repeated curse $ removeChaosToken #curse
      repeated bless $ addChaosToken #bless
      pure s
    _ -> Purified <$> liftRunMessage msg attrs
