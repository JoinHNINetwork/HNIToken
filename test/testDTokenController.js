const truffleAssert = require("truffle-assertions");
const HNITokenController = artifacts.require("HNITokenController");

const MOCK_TOKEN = "0x0000000000000000000000000000000000000001";
const MOCK_HNITOKEN = "0x0000000000000000000000000000000000000002";
const MOCK_HNITOKEN_NEW = "0x0000000000000000000000000000000000000003";
const UNKNOWN_TOKEN = "0x0000000000000000000000000000000000000004";

describe("HNITokenController Contract", function () {
  let HNItoken_controller;
  let owner, account1, account2, account3, account4;

  before(async function () {
    [
      owner,
      account1,
      account2,
      account3,
      account4,
    ] = await web3.eth.getAccounts();
  });

  async function resetContracts(handler_num, proportions) {
    HNItoken_controller = await HNITokenController.new();
  }

  describe("Deployment", function () {
    it("Should deployed and only initialized once", async function () {
      await resetContracts();

      await truffleAssert.reverts(
        HNItoken_controller.initialize(),
        "initialize: Already initialized!"
      );
    });
  });

  describe("setHNITokensRelation", function () {
    it("Should allow only owner to set HNITokenController relation", async function () {
      let tokens = [MOCK_TOKEN];
      let HNITokenController = [MOCK_HNITOKEN];
      await HNItoken_controller.setHNITokensRelation(tokens, HNITokenController);

      await truffleAssert.reverts(
        HNItoken_controller.setHNITokensRelation(tokens, HNITokenController, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not set HNITokenController relation with mismatched length mappings", async function () {
      let tokens = [MOCK_TOKEN];
      let HNITokenController = [];

      await truffleAssert.reverts(
        HNItoken_controller.setHNITokensRelation(tokens, HNITokenController),
        "setHNITokensRelation: Array length do not match!"
      );
    });

    it("Should not set HNITokenController relation which has been set", async function () {
      let tokens = [MOCK_TOKEN];
      let HNITokenController = [MOCK_HNITOKEN];

      await truffleAssert.reverts(
        HNItoken_controller.setHNITokensRelation(tokens, HNITokenController),
        "_setHNITokenRelation: Has set!"
      );
    });
  });

  describe("updatedTokenRelation", function () {
    it("Should allow only owner to update HNITokenController relation", async function () {
      await HNItoken_controller.updatedTokenRelation(MOCK_TOKEN, MOCK_HNITOKEN_NEW);

      await truffleAssert.reverts(
        HNItoken_controller.updatedTokenRelation(MOCK_TOKEN, MOCK_HNITOKEN_NEW, {
          from: account1,
        }),
        "ds-auth-unauthorized"
      );
    });

    it("Should not update HNITokenController relation with unknown token", async function () {
      await truffleAssert.reverts(
        HNItoken_controller.updatedTokenRelation(UNKNOWN_TOKEN, MOCK_HNITOKEN),
        "updatedTokenRelation: token does not exist!"
      );
    });
  });

  describe("getHNIToken", function () {
    it("Should get HNITokenController relation and 0 by default", async function () {
      assert.equal(
        MOCK_HNITOKEN_NEW,
        await HNItoken_controller.getHNIToken(MOCK_TOKEN)
      );
      assert.equal(0, await HNItoken_controller.getHNIToken(UNKNOWN_TOKEN));
    });
  });
});
