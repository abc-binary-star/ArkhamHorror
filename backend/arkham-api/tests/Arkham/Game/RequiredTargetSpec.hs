module Arkham.Game.RequiredTargetSpec (spec) where

import Arkham.Card (lookupCard)
import Arkham.Card.CardCode (CardCode)
import Arkham.Card.Id (nullCardId)
import Arkham.Game (soleRequiredTarget)
import Arkham.Id (InvestigatorId)
import Arkham.Message
import Arkham.Prelude
import Arkham.Source (Source (..))
import Arkham.Target (Target (..))
import Test.Hspec

spec :: Spec
spec = describe "sole required target" do
  let
    iid = "02001" :: InvestigatorId
    cid = nullCardId
    card = lookupCard ("01093" :: CardCode) cid
    commit = TargetLabel (CardIdTarget cid) [SkillTestCommitCard iid card]
    uncommit = TargetLabel (CardIdTarget cid) [SkillTestUncommitCard iid card]

  it "leaves a teammate's only committable card optional" do
    soleRequiredTarget (ChooseOne [commit]) `shouldBe` Nothing

  it "does not automatically cancel a teammate's only committed card" do
    soleRequiredTarget (ChooseOne [uncommit]) `shouldBe` Nothing

  it "preserves the choice through question and message wrappers" do
    let choice = TargetLabel (CardIdTarget cid) [Do (Run [SkillTestCommitCard iid card])]
    soleRequiredTarget (QuestionLabel "commit" Nothing (ChooseOne [choice])) `shouldBe` Nothing

  it "still resolves an ordinary mandatory single target" do
    let choice = TargetLabel (InvestigatorTarget iid) [TakeResources iid 1 (InvestigatorSource iid) False]
    soleRequiredTarget (ChooseOne [choice]) `shouldBe` Just choice
