module Arkham.Game.SettingsSpec (spec) where

import Arkham.Game.Settings
import Data.Aeson (decode, encode)
import Data.Aeson.Types (Value (String))
import Test.Hspec
import Prelude

spec :: Spec
spec = do
  describe "UndoMode JSON" do
    it "serializes to the short wire form" do
      encode StandardUndo `shouldBe` "\"standard\""
      encode FullUndo `shouldBe` "\"full\""
      encode LightUndo `shouldBe` "\"light\""
      encode HardcoreUndo `shouldBe` "\"hardcore\""
      encode ExpertUndo `shouldBe` "\"expert\""

    it "reads back both the short form and the constructor name" do
      -- The constructor-name branch mirrors AsIfRuling: clients and older saves
      -- have been seen to spell these either way.
      (decode "\"hardcore\"" :: Maybe UndoMode) `shouldBe` Just HardcoreUndo
      (decode "\"HardcoreUndo\"" :: Maybe UndoMode) `shouldBe` Just HardcoreUndo

    it "rejects an unknown mode rather than silently picking one" do
      (decode "\"casual\"" :: Maybe UndoMode) `shouldBe` Nothing

  describe "Settings backwards compatibility" do
    it "defaults a save with no settingsUndoMode to FullUndo" do
      -- Every game persisted before the field existed has no such key. FullUndo
      -- keeps all history, which is what those games did, so loading one must
      -- not quietly start pruning.
      let parsed = decode "{}" :: Maybe Settings
      fmap settingsUndoMode parsed `shouldBe` Just FullUndo

    it "round-trips a chosen mode" do
      let settings = defaultSettings {settingsUndoMode = ExpertUndo}
      fmap settingsUndoMode (decode $ encode settings) `shouldBe` Just ExpertUndo

  describe "retainedStepFloor" do
    it "keeps everything under FullUndo" do
      retainedStepFloor FullUndo False False 10 `shouldBe` Nothing
      retainedStepFloor FullUndo True True 10 `shouldBe` Nothing

    it "keeps everything under StandardUndo until a checkpoint" do
      retainedStepFloor StandardUndo False False 10 `shouldBe` Nothing
      retainedStepFloor StandardUndo True False 10 `shouldBe` Just 10

    it "keeps a 30-step window under LightUndo" do
      retainedStepFloor LightUndo False False 100 `shouldBe` Just 70
      -- Never a negative floor: early steps would otherwise be deleted twice
      -- over and the arithmetic would stop matching the surviving rows.
      retainedStepFloor LightUndo False False 5 `shouldBe` Just 0
      retainedStepFloor LightUndo False False 30 `shouldBe` Just 0

    it "keeps one step under HardcoreUndo, and none past a random outcome" do
      retainedStepFloor HardcoreUndo False False 10 `shouldBe` Just 9
      retainedStepFloor HardcoreUndo False True 10 `shouldBe` Just 10
      retainedStepFloor HardcoreUndo False False 1 `shouldBe` Just 0

    it "keeps nothing under ExpertUndo" do
      retainedStepFloor ExpertUndo False False 10 `shouldBe` Just 10

    it "never returns a floor above the new step" do
      -- enforce_step_order_per_game raises unless step - 1 already exists, so a
      -- floor above newStep would delete the step just written and wedge the
      -- next action. Checked across the modes and a range of step numbers,
      -- including the small ones where the max 0 clamps bite.
      let modes = [StandardUndo, FullUndo, LightUndo, HardcoreUndo, ExpertUndo]
          flags = [False, True]
          violations =
            [ (mode, checkpoint, random, step)
            | mode <- modes
            , checkpoint <- flags
            , random <- flags
            , step <- [0 .. 40]
            , case retainedStepFloor mode checkpoint random step of
                Just floor -> floor > step
                Nothing -> False
            ]
      violations `shouldBe` []
