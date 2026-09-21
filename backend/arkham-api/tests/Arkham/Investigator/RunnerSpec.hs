module Arkham.Investigator.RunnerSpec (spec) where

import Arkham.Agenda.CardDefs.TheDunwichLegacy.LostInTimeAndSpace qualified as Agendas
import Arkham.Asset.Cards qualified as Assets
import Arkham.Attack qualified as Attack
import Arkham.Classes.HasGame (getGame)
import Arkham.Entities qualified as Entities
import Arkham.Investigator.Cards qualified as Investigators
import Arkham.Movement
import Arkham.Token
import Arkham.Window qualified as Window
import TestImport.New

realAgenda :: CardDef -> TestAppT ()
realAgenda def = do
  card <- genCard def
  let agenda' = lookupAgenda (AgendaId (toCardCode card)) 1 (toCardId card)
  overTest $ entitiesL . Entities.agendasL %~ insertEntity agenda'

spec :: Spec
spec = describe "Investigator.Runner" do
  describe "enemy attack assignment" do
    it "automatically assigns both damage and horror when only the investigator can take them" . gameTest $ \self -> do
      enemy <- testEnemy
      run $ InvestigatorAssignDamage self.id (EnemyAttackSource $ toId enemy) DamageAny 2 1
      self.damage `shouldReturn` 2
      self.horror `shouldReturn` 1
      (length . gameQuestion <$> getGame) `shouldReturn` (0 :: Int)

    it "keeps the choice to absorb damage on an asset" . gameTest $ \self -> do
      enemy <- testEnemy
      beatCop <- self `putAssetIntoPlay` Assets.beatCop
      run $ InvestigatorAssignDamage self.id (EnemyAttackSource $ toId enemy) DamageAny 1 0
      self.damage `shouldReturn` 0
      chooseOptionMatching "assign damage to asset" \case
        AssetDamageLabel aid _ -> aid == beatCop
        _ -> False
      self.damage `shouldReturn` 0
      (length . gameQuestion <$> getGame) `shouldReturn` (0 :: Int)

    it "does not auto-assign damage from non-attack sources" . gameTest $ \self -> do
      run $ InvestigatorAssignDamage self.id (TestSource mempty) DamageAny 1 0
      self.damage `shouldReturn` 0
      applyAllDamage
      self.damage `shouldReturn` 1

    it "automatically starts the only pending enemy attack" . gameTest $ \self -> do
      enemy <- testEnemy & prop @"healthDamage" 1 & prop @"sanityDamage" 1
      location <- testLocation
      enemy `spawnAt` location
      self `moveTo` location
      run $ EnemyAttacks [EnemyAttack $ Attack.enemyAttack (toId enemy) (toId enemy) self.id]
      self.damage `shouldReturn` 1
      self.horror `shouldReturn` 1
      (length . gameQuestion <$> getGame) `shouldReturn` (0 :: Int)

  it "moves one clue between investigators without duplicating it" . gameTest $ \self -> do
    other <- addInvestigator Investigators.rolandBanks
    run $ PlaceTokens (TestSource mempty) (toTarget self) Clue 1

    run $ MoveTokens (TestSource mempty) (toSource self) (toTarget other) Clue 1

    self.clues `shouldReturn` 0
    other.clues `shouldReturn` 1

  -- \| Regression for #5412.
  --
  --  An investigator's in-flight movement lives in a single slot on
  --  'InvestigatorAttrs'. When a move parks on an additional-cost skill test --
  --  Arcane Barrier's "as an additional cost to move out of attached location" --
  --  the rest of the move waits in the queue as
  --  @MoveWithSkillTest (WhenCanMove iid msgs)@.
  --
  --  In the reported game a Wormhole-sourced move parked that way, the leave-cost
  --  test failed on the {elderThing} token, Lost in Time and Space discarded the
  --  Extradimensional location, and Another Dimension's forced ability moved
  --  everyone off it. That nested move resolves and 'handleDoResolveMovement'
  --  clears the slot. The parked batch then ran anyway -- firing
  --  MoveFrom/Entering/Moves windows for a move that could no longer happen -- so
  --  the agenda's @Forced - After you are moved to a location by an encounter card
  --  effect@ triggered a second time and Roland took 2 horror for one move.
  --
  --  These two cases pin the boundary directly: the parked batch is dropped when
  --  its movement is gone, and still runs when it is not.
  --
  it "drops a parked move batch whose movement a nested move already consumed" . gameTest $ \self -> do
    realAgenda Agendas.allIsOne
    (from, dest) <- testConnectedLocations id id
    self `moveTo` from
    movement <- move (LocationSource $ toId from) self (toId dest)

    -- No SetMovement: the slot is empty, exactly as the nested move leaves it.
    run $ WhenCanMove (toId self) [ResolveMovement (toId self), afterMoves self from dest movement]

    -- Nothing should be asked -- All is One's Forced must not have been offered.
    (length . gameQuestion <$> getGame) `shouldReturn` (0 :: Int)
    self.location `shouldReturn` Just (toId from)
    self.horror `shouldReturn` 0

  it "still runs a parked move batch whose movement is still in flight" . gameTest $ \self -> do
    realAgenda Agendas.allIsOne
    (from, dest) <- testConnectedLocations id id
    self `moveTo` from
    movement <- move (LocationSource $ toId from) self (toId dest)
    run $ SetMovement (toId self) movement

    run $ WhenCanMove (toId self) [ResolveMovement (toId self), afterMoves self from dest movement]

    -- The exact mirror of the case above: the move resolves and All is One's
    -- Forced is offered. Asserted on the raised prompt rather than on horror so
    -- the test does not depend on how assignHorror is answered.
    self.location `shouldReturn` Just (toId dest)
    shownQuestion <- show . gameQuestion <$> getGame
    shownQuestion `shouldContain` "02312"
 where
  afterMoves self from dest movement =
    CheckWindows
      [ Window.mkAfter
          $ Window.Moves
            (toId self)
            (LocationSource $ toId from)
            (Just $ toId from)
            (toId dest)
            movement.id
      ]
