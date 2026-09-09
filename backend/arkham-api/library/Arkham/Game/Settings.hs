module Arkham.Game.Settings where

import Arkham.Card.CardCode (CardCode)
import Arkham.Prelude
import Arkham.UltimatumsAndBoons.Types
import Control.Monad.Fail

data AsIfRuling
  = Chapter1AsIfRuling -- "As if" applies while checking/resolving nested windows.
  | Chapter2AsIfRuling -- "As if" applies during action resolution, not window triggers.
  deriving stock (Eq, Ord, Show, Generic, Data)

instance ToJSON AsIfRuling where
  toJSON = \case
    Chapter1AsIfRuling -> String "chapter1"
    Chapter2AsIfRuling -> String "chapter2"

instance FromJSON AsIfRuling where
  parseJSON = withText "AsIfRuling" \case
    "chapter1" -> pure Chapter1AsIfRuling
    "chapter2" -> pure Chapter2AsIfRuling
    "Chapter1AsIfRuling" -> pure Chapter1AsIfRuling
    "Chapter2AsIfRuling" -> pure Chapter2AsIfRuling
    other -> fail $ "unknown AsIfRuling: " <> unpack other

{- | How much history a game keeps, enforced by pruning @arkham_steps@ when each
step is persisted (see @retainedStepFloor@) and by the guards in
@Api.Handler.Arkham.Undo@:

* @StandardUndo@ — unlimited undo inside a scenario; crossing into the next
  scenario is a checkpoint that drops everything before it.
* @FullUndo@ — keep every step. The default, and the pre-existing behaviour.
* @LightUndo@ — keep the latest 30 steps.
* @HardcoreUndo@ — keep one step, and keep nothing at all past a step whose
  resolution involved a random outcome, so a revealed chaos token cannot be
  rerolled by rewinding.
* @ExpertUndo@ — keep nothing; undo and the debug controls are off.
-}
data UndoMode
  = StandardUndo
  | FullUndo
  | LightUndo
  | HardcoreUndo
  | ExpertUndo
  deriving stock (Eq, Ord, Show, Generic, Data)

instance ToJSON UndoMode where
  toJSON = \case
    StandardUndo -> String "standard"
    FullUndo -> String "full"
    LightUndo -> String "light"
    HardcoreUndo -> String "hardcore"
    ExpertUndo -> String "expert"

instance FromJSON UndoMode where
  parseJSON = withText "UndoMode" \case
    "standard" -> pure StandardUndo
    "full" -> pure FullUndo
    "light" -> pure LightUndo
    "hardcore" -> pure HardcoreUndo
    "expert" -> pure ExpertUndo
    "StandardUndo" -> pure StandardUndo
    "FullUndo" -> pure FullUndo
    "LightUndo" -> pure LightUndo
    "HardcoreUndo" -> pure HardcoreUndo
    "ExpertUndo" -> pure ExpertUndo
    other -> fail $ "unknown UndoMode: " <> unpack other

{- | Steps below the returned floor are deleted as soon as the new step is
persisted. This is what actually enforces 'UndoMode'; guarding the undo endpoint
alone would leave the discarded history on disk. 'Nothing' keeps everything.

Every branch that returns a floor returns one at or below @newStep@, so the new
step itself always survives -- the @enforce_step_order_per_game@ trigger raises
unless @step - 1@ exists, and dropping @newStep@ would wedge the next action.
-}
retainedStepFloor :: UndoMode -> Bool -> Bool -> Int -> Maybe Int
retainedStepFloor mode isCheckpoint hasRandomOutcome newStep = case mode of
  StandardUndo | isCheckpoint -> Just newStep
  StandardUndo -> Nothing
  FullUndo -> Nothing
  LightUndo -> Just $ max 0 (newStep - 30)
  HardcoreUndo
    | hasRandomOutcome -> Just newStep
    | otherwise -> Just $ max 0 (newStep - 1)
  ExpertUndo -> Just newStep

data Settings = Settings
  { settingsAbilitiesCannotReactToThemselves :: Bool -- Grotesque Statue FAQ (September 2023)
  , settingsAsIfRuling :: AsIfRuling
  , settingsUltimatumsAndBoons :: Set UltimatumOrBoon
  -- ^ Variant rules selected at game creation; permanent for the campaign or
  -- standalone scenario per the FAQ, so nothing mutates this after creation.
  , settingsUltimatumsAndBoonsEnabled :: Bool
  -- ^ Runtime kill switch: when False, selected entries behave as if nothing
  -- were selected. Every effect hook reads through 'activeUltimatumsAndBoons'.
  -- Deckbuilding-time entries are validated at deck construction and are NOT
  -- re-validated when this flips.
  , settingsRolledUltimatumOrBoon :: Maybe UltimatumOrBoon
  -- ^ Ultimatum of Ultimatums: the entry rolled for the CURRENT game only.
  -- Re-rolled (or cleared) at each StartScenario.
  , settingsScreamedAllies :: Set CardCode
  -- ^ Ultimatum of The Scream: allies removed from the game for the rest of
  -- the campaign.
  , settingsAchievementsEnabled :: Bool
  -- ^ Above-the-table achievement tracking for this game. Defaults on;
  -- only shown at creation for campaigns with an achievement list.
  , settingsUndoMode :: UndoMode
  -- ^ Chosen at game creation and never mutated afterwards: pruning already
  -- discarded the steps a stricter mode would have refused to keep, so
  -- loosening the mode mid-game could not bring them back.
  }
  deriving stock (Eq, Show, Generic, Data)

-- | The single gate every Ultimatum/Boon hook must go through.
activeUltimatumsAndBoons :: Settings -> Set UltimatumOrBoon
activeUltimatumsAndBoons settings
  | settingsUltimatumsAndBoonsEnabled settings =
      settingsUltimatumsAndBoons settings
        <> maybe mempty singletonSet (settingsRolledUltimatumOrBoon settings)
  | otherwise = mempty

settingsStrictAsIfAt :: Settings -> Bool
settingsStrictAsIfAt = (== Chapter2AsIfRuling) . settingsAsIfRuling

asIfRulingFromStrictAsIfAt :: Bool -> AsIfRuling
asIfRulingFromStrictAsIfAt = \case
  False -> Chapter1AsIfRuling
  True -> Chapter2AsIfRuling

{- | Fallback when the client doesn't send an explicit ruling. Official
campaigns from @11@ on are Chapter 2. Homebrew campaigns (@:@-prefixed ids,
which don't order against official ones) declare their chapter in their
@campaign.json@ and the client sends it; without one they are Chapter 1.
-}
defaultAsIfRulingForCampaign :: Maybe Text -> AsIfRuling
defaultAsIfRulingForCampaign = \case
  Just cid | not (":" `isPrefixOf` cid), cid >= "11" -> Chapter2AsIfRuling
  _ -> Chapter1AsIfRuling

defaultSettings :: Settings
defaultSettings =
  Settings
    { settingsAbilitiesCannotReactToThemselves = True
    , settingsAsIfRuling = Chapter1AsIfRuling
    , settingsUltimatumsAndBoons = mempty
    , settingsUltimatumsAndBoonsEnabled = True
    , settingsRolledUltimatumOrBoon = Nothing
    , settingsScreamedAllies = mempty
    , settingsAchievementsEnabled = True
    , settingsUndoMode = FullUndo
    }

instance ToJSON Settings where
  toJSON settings = object
    [ "settingsAbilitiesCannotReactToThemselves" .= settingsAbilitiesCannotReactToThemselves settings
    , "settingsAsIfRuling" .= settingsAsIfRuling settings
    , "settingsStrictAsIfAt" .= settingsStrictAsIfAt settings -- legacy/client compatibility
    , "settingsUltimatumsAndBoons" .= settingsUltimatumsAndBoons settings
    , "settingsUltimatumsAndBoonsEnabled" .= settingsUltimatumsAndBoonsEnabled settings
    , "settingsRolledUltimatumOrBoon" .= settingsRolledUltimatumOrBoon settings
    , "settingsScreamedAllies" .= settingsScreamedAllies settings
    , "settingsAchievementsEnabled" .= settingsAchievementsEnabled settings
    , "settingsUndoMode" .= settingsUndoMode settings
    ]

instance FromJSON Settings where
  parseJSON = withObject "Settings" \o -> do
    abilitiesCannotReactToThemselves <-
      o .:? "settingsAbilitiesCannotReactToThemselves" .!= defaultSettings.settingsAbilitiesCannotReactToThemselves
    legacyStrictAsIfAt <- o .:? "settingsStrictAsIfAt"
    asIfRuling <-
      o .:? "settingsAsIfRuling" .!= maybe defaultSettings.settingsAsIfRuling asIfRulingFromStrictAsIfAt legacyStrictAsIfAt
    ultimatumsAndBoons <- o .:? "settingsUltimatumsAndBoons" .!= mempty
    ultimatumsAndBoonsEnabled <- o .:? "settingsUltimatumsAndBoonsEnabled" .!= True
    rolledUltimatumOrBoon <- o .:? "settingsRolledUltimatumOrBoon" .!= Nothing
    screamedAllies <- o .:? "settingsScreamedAllies" .!= mempty
    achievementsEnabled <- o .:? "settingsAchievementsEnabled" .!= True
    undoMode <- o .:? "settingsUndoMode" .!= FullUndo
    pure
      Settings
        { settingsAbilitiesCannotReactToThemselves = abilitiesCannotReactToThemselves
        , settingsAsIfRuling = asIfRuling
        , settingsUltimatumsAndBoons = ultimatumsAndBoons
        , settingsUltimatumsAndBoonsEnabled = ultimatumsAndBoonsEnabled
        , settingsRolledUltimatumOrBoon = rolledUltimatumOrBoon
        , settingsScreamedAllies = screamedAllies
        , settingsAchievementsEnabled = achievementsEnabled
        , settingsUndoMode = undoMode
        }
