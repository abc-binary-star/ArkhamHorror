{-# LANGUAGE ImplicitParams #-}

module Arkham.Helpers.GameLog where

import Arkham.Card (CardGen)
import Arkham.Card.CardCode (CardCode, unCardCode)
import Arkham.Classes.GameLogger
import Arkham.Classes.HasGame (HasGame)
import Arkham.Helpers.Name (getFormatted)
import Arkham.I18n
import Arkham.Id
import Arkham.Location.Types (Field (..))
import Arkham.Name (display)
import Arkham.Prelude
import Arkham.Projection
import Arkham.SkillType
import Data.Text qualified as T

sendI18n :: (HasI18n, HasGameLogger m) => Scope -> m ()
sendI18n s = send $ ikey' s

{- | Log a line whose text comes from the locale files rather than from the
engine: the client resolves the key and localises the references the vars
carry, so the same entry reads in whatever language the reader picked.
-}
logI18n :: HasGameLogger m => (HasI18n => Text) -> m ()
logI18n t = send (withI18n t)

-- | The @{investigator:"Name":"id"}@ reference the log renderer turns into a
-- localised, hoverable investigator name.
investigatorRef :: (HasI18n, ToGameLoggerFormat a) => a -> (HasI18n => b) -> b
investigatorRef a = withVar "investigator" (String $ format a)

-- | The @{card:"Name":"code":"id"}@ reference for anything the reader should see
-- as a card -- a played card, an act, an agenda.
cardRef :: (HasI18n, ToGameLoggerFormat a) => a -> (HasI18n => b) -> b
cardRef a = withVar "card" (String $ format a)

{- | A card reference built from a bare card code, for callers that hold only the
code (an ability names the card it belongs to, not the card itself). The client
resolves the name from the code, so the name field repeats it as a fallback.
-}
cardCodeRef :: CardCode -> Text
cardCodeRef code = "{card:\"" <> c <> "\":\"" <> c <> "\":\"" <> c <> "\"}"
 where
  c = unCardCode code

enemyRef :: (HasGame m, CardGen m) => EnemyId -> m Text
enemyRef = getFormatted

locationRef :: HasGame m => LocationId -> m Text
locationRef lid = do
  name <- field LocationName lid
  code <- field LocationCardCode lid
  pure
    $ "{location:\""
    <> escapeQuotes (display name)
    <> "\":"
    <> tshow lid
    <> ":"
    <> tshow code
    <> "}"

escapeQuotes :: Text -> Text
escapeQuotes = T.replace "\"" "\\\""

-- | Locale suffix for the per-skill skill-test keys.
skillLogKey :: SkillType -> Text
skillLogKey = \case
  SkillWillpower -> "willpower"
  SkillIntellect -> "intellect"
  SkillCombat -> "combat"
  SkillAgility -> "agility"
