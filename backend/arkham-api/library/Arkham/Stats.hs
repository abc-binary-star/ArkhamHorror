module Arkham.Stats (Stats (..), statsSkillValue, InvestigatorStats (..)) where

import Arkham.Prelude
import Arkham.SkillType

data Stats = Stats
  { health :: Int
  , sanity :: Int
  , willpower :: Int
  , intellect :: Int
  , combat :: Int
  , agility :: Int
  }
  deriving stock (Show)

statsSkillValue :: Stats -> SkillType -> Int
statsSkillValue Stats {..} = \case
  SkillWillpower -> willpower
  SkillIntellect -> intellect
  SkillCombat -> combat
  SkillAgility -> agility

instance Semigroup Stats where
  Stats a1 b1 c1 d1 e1 f1 <> Stats a2 b2 c2 d2 e2 f2 =
    Stats (a1 + a2) (b1 + b2) (c1 + c2) (d1 + d2) (e1 + e2) (f1 + f2)

instance Monoid Stats where
  mempty = Stats 0 0 0 0 0 0

data InvestigatorStats = InvestigatorStats
  { investigatorStatsDamageDealt :: Int
  , investigatorStatsDamageTaken :: Int
  , investigatorStatsHorrorTaken :: Int
  , investigatorStatsCluesGained :: Int
  }
  deriving stock (Eq, Ord, Show, Data)

instance Semigroup InvestigatorStats where
  InvestigatorStats a1 b1 c1 d1 <> InvestigatorStats a2 b2 c2 d2 =
    InvestigatorStats (a1 + a2) (b1 + b2) (c1 + c2) (d1 + d2)

instance Monoid InvestigatorStats where
  mempty = InvestigatorStats 0 0 0 0

instance ToJSON InvestigatorStats where
  toJSON InvestigatorStats {..} =
    object
      [ "damageDealt" .= investigatorStatsDamageDealt
      , "damageTaken" .= investigatorStatsDamageTaken
      , "horrorTaken" .= investigatorStatsHorrorTaken
      , "cluesGained" .= investigatorStatsCluesGained
      ]
  toEncoding InvestigatorStats {..} =
    pairs
      ( "damageDealt" .= investigatorStatsDamageDealt
          <> "damageTaken" .= investigatorStatsDamageTaken
          <> "horrorTaken" .= investigatorStatsHorrorTaken
          <> "cluesGained" .= investigatorStatsCluesGained
      )

instance FromJSON InvestigatorStats where
  parseJSON = withObject "InvestigatorStats" $ \o ->
    InvestigatorStats
      <$> o .:? "damageDealt" .!= 0
      <*> o .:? "damageTaken" .!= 0
      <*> o .:? "horrorTaken" .!= 0
      <*> o .:? "cluesGained" .!= 0
