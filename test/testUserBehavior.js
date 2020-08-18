const truffleAssert = require("truffle-assertions");
const FiatToken = artifacts.require("FiatTokenV1");
const TetherToken = artifacts.require("TetherToken");
const CTokenMock = artifacts.require("CTokenMock");
const CompoundHandler = artifacts.require("CompoundHandler");
const InternalHandler = artifacts.require("InternalHandler");
const Dispatcher = artifacts.require("Dispatcher");
const HNITokenController = artifacts.require("HNITokenController");
const HNIToken = artifacts.require("HNIToken");
const DSGuard = artifacts.require("DSGuard");
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const BN = require("bn.js");

const LendingPoolCore = artifacts.require("AaveLendingPoolCoreMock");
const LendPool = artifacts.require("AaveLendPoolMock");
const aTokenMock = artifacts.require("aTokenMock");
const AaveHandler = artifacts.require("AaveHandler");

const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));
const BASE = new BN(10).pow(new BN(18));
const FEE = new BN(10).pow(new BN(14));
const FEE_MAX = BASE.div(new BN(10)).sub(new BN(1));
const TOTAL_PROPORTION = new BN(1000000);

const MINT_SELECTOR = "0x40c10f19";
const REDEEM_SELECTOR = "0x1e9a6950";
const FEE_HASHES_LIST = [MINT_SELECTOR, REDEEM_SELECTOR];
describe("HNIToken Contract Integration", function () {
  let owner, account1, account2, account3, account4;
  let USDC, USDT, HNI, COMP;
  let ds_guard;
  let dispatcher;
  let HNItoken_controller;
  let internal_handler, compound_handler, aave_handler, other_handler;
  let dUSDC, dUSDT;
  let cUSDT, cUSDC;
  let aUSDC, aUSDT;
  let lending_pool_core;
  let lending_pool;

  let accounts = [];

  let tokens = [];
  let HNItokens = [];
  let atokens = [];
  let ctokens = [];

  let handlers = {};

  let user_behavior = [];
  let user_behavior_name = [];
  let HNItoken_admin_behavior = [];
  let dispatcher_admin_behavior = [];

  before(async function () {
    [
      owner,
      account1,
      account2,
      account3,
      account4,
      account5,
    ] = await web3.eth.getAccounts();
  });

  async function resetContracts() {
    USDC = await FiatToken.new("USDC", "USDC", "USD", 6, owner, owner, owner);

    USDT = await TetherToken.new("0", "USDT", "USDT", 6);
    HNI = await TetherToken.new("0", "HNI", "HNI", 18);
    COMP = await TetherToken.new("0", "COMP", "COMP", 18);

    HNItoken_controller = await HNITokenController.new();
    ds_guard = await DSGuard.new();

    internal_handler = await InternalHandler.new(HNItoken_controller.address);
    other_handler = await InternalHandler.new(HNItoken_controller.address);

    cUSDT = await CTokenMock.new("cUSDT", "cUSDT", USDT.address);
    cUSDC = await CTokenMock.new("cUSDC", "cUSDC", USDC.address);

    compound_handler = await CompoundHandler.new(
      HNItoken_controller.address,
      COMP.address
    );
    await compound_handler.setcTokensRelation(
      [USDT.address, USDC.address],
      [cUSDT.address, cUSDC.address]
    );

    // Deploys Aave system
    lending_pool_core = await LendingPoolCore.new();
    aUSDC = await aTokenMock.new(
      "aUSDC",
      "aUSDC",
      USDC.address,
      lending_pool_core.address
    );
    aUSDT = await aTokenMock.new(
      "aUSDT",
      "aUSDT",
      USDT.address,
      lending_pool_core.address
    );
    await lending_pool_core.setReserveATokenAddress(
      USDC.address,
      aUSDC.address
    );
    await lending_pool_core.setReserveATokenAddress(
      USDT.address,
      aUSDT.address
    );
    lending_pool = await LendPool.new(lending_pool_core.address);

    aave_handler = await AaveHandler.new(
      HNItoken_controller.address,
      lending_pool.address,
      lending_pool_core.address
    );

    // Use internal handler by default
    dispatcher = await Dispatcher.new([internal_handler.address], [1000000]);
    dUSDC = await HNIToken.new(
      "dUSDC",
      "dUSDC",
      USDC.address,
      dispatcher.address
    );
    dUSDT = await HNIToken.new(
      "dUSDT",
      "dUSDT",
      USDT.address,
      dispatcher.address
    );

    await HNItoken_controller.setHNITokensRelation(
      [USDC.address, USDT.address],
      [dUSDC.address, dUSDT.address]
    );

    await dUSDC.setAuthority(ds_guard.address);
    await dUSDT.setAuthority(ds_guard.address);
    await dUSDC.setFeeRecipient(account5);
    await dUSDT.setFeeRecipient(account5);
    await dispatcher.setAuthority(ds_guard.address);

    // Initialize all handlers
    handlers[internal_handler.address] = internal_handler;
    handlers[compound_handler.address] = compound_handler;
    handlers[aave_handler.address] = aave_handler;
    handlers[other_handler.address] = other_handler;
    for (const key in handlers) {
      await handlers[key].setAuthority(ds_guard.address);
      await handlers[key].approve(USDC.address, UINT256_MAX);
      await handlers[key].approve(USDT.address, UINT256_MAX);
      await ds_guard.permitx(dUSDC.address, handlers[key].address);
      await ds_guard.permitx(dUSDT.address, handlers[key].address);

      await handlers[key].enableTokens([USDC.address, USDT.address]);
    }

    // Allocate some token to all accounts
    accounts = [account1, account2, account3, account4];
    for (const account of accounts) {
      await USDC.allocateTo(account, 1000000e6);
      await USDT.allocateTo(account, 1000000e6);
      USDC.approve(dUSDC.address, UINT256_MAX, {from: account});
      USDT.approve(dUSDT.address, UINT256_MAX, {from: account});
    }

    tokens = [USDC, USDT];
    HNItokens = [dUSDC, dUSDT];
    atokens = [aUSDC, aUSDT];
    ctokens = [cUSDC, cUSDT];
    user_behavior = [
      dUSDC.mint,
      dUSDC.redeem,
      dUSDC.redeemUnderlying,
      dUSDT.mint,
      dUSDT.redeem,
      dUSDT.redeemUnderlying,
    ];
    user_behavior_name = ["mint", "redeem", "redeemUnderlying"];
    HNItoken_admin_behavior = [
      dUSDC.rebalance,
      dUSDC.updateOriginationFee,
      dUSDT.rebalance,
      dUSDT.updateOriginationFee,
    ];
    dispatcher_admin_behavior = [
      dispatcher.resetHandlers,
      dispatcher.updateProportions,
    ];
  }

  function rmul(x, y) {
    return x.mul(y).div(BASE);
  }

  function rdiv(x, y) {
    return x.mul(BASE).div(y);
  }

  function rdivup(x, y) {
    return x
      .mul(BASE)
      .add(y.sub(new BN("1")))
      .div(y);
  }

  function randomNum(minNum, maxNum) {
    switch (arguments.length) {
      case 1:
        return parseInt(Math.random() * minNum + 1, 10);
        break;
      case 2:
        return parseInt(Math.random() * (maxNum - minNum + 1) + minNum, 10);
        break;
      default:
        return 0;
        break;
    }
  }

  function createRandomData(
    sourceData,
    lengthMin = 0,
    lengthMax = sourceData.length
  ) {
    let dataList = [];

    lengthMax = sourceData.length > lengthMax ? lengthMax : sourceData.length;
    lengthMax = lengthMin < lengthMax ? lengthMax : lengthMin;
    lengthMin = lengthMin < lengthMax ? lengthMin : lengthMax;

    if (lengthMax <= 0) return dataList;

    var indexList = [];
    var randomIndex = 0;
    for (let index = 0; index < lengthMax; index++) {
      if (index == randomNum(lengthMin, lengthMax - 1)) break;
      randomIndex = randomNum(0, sourceData.length - 1);
      if (indexList.indexOf(randomIndex) >= 0) {
        index--;
        continue;
      }
      dataList[dataList.length] = sourceData[randomIndex];
      indexList[indexList.length] = randomIndex;
    }
    return dataList;
  }

  async function checkUserBehavior(asyncFn, args, HNIToken, account) {
    let token = await HNIToken.token();
    let fee_recipient = await HNIToken.feeRecipient();
    let token_contract = token == USDC.address ? USDC : USDT;

    let balances = {};
    balances.account = await token_contract.balanceOf(account);
    balances.fee_recipient = await token_contract.balanceOf(fee_recipient);
    balances.getTotalBalance = await HNIToken.getTotalBalance();

    let HNItoken_balance = await HNIToken.balanceOf(account);
    let exchange_rate = await HNIToken.getExchangeRate();
    // let exchange_rate_stored = (await HNIToken.data())['0'];
    // console.log((await HNIToken.getExchangeRate()).toLocaleString().replace(/,/g, ""));
    // console.log(exchange_rate.toLocaleString().replace(/,/g, ""));
    // console.log(exchange_rate_stored.toLocaleString().replace(/,/g, ""));
    console.log(
      "totalSupply : " +
        (await HNIToken.totalSupply()).toLocaleString().replace(/,/g, "")
    );
    console.log(
      "totalBalance :" +
        balances.getTotalBalance.toLocaleString().replace(/,/g, "")
    );

    if (exchange_rate.eq(new BN(0))) {
      await truffleAssert.reverts(
        asyncFn(...args),
        "Exchange rate should not be 0!"
      );
      console.log("Exchange rate should not be 0!");
      return;
    }

    if (asyncFn == HNIToken.mint && rdiv(args[1], exchange_rate).eq(new BN(0))) {
      await truffleAssert.reverts(
        asyncFn(...args),
        "mint: can not mint the smallest unit with the given amount"
      );
      console.log("mint: can not mint the smallest unit with the given amount");
      return;
    }

    await asyncFn(...args);

    let new_balances = {};
    new_balances.account = await token_contract.balanceOf(account);
    new_balances.fee_recipient = await token_contract.balanceOf(fee_recipient);
    new_balances.getTotalBalance = await HNIToken.getTotalBalance();

    let new_HNItoken_balance = await HNIToken.balanceOf(account);
    let new_exchange_rate = await HNIToken.getExchangeRate();
    let exchange_rate_stored = (await HNIToken.data())["0"];

    // console.log((await HNIToken.totalSupply()).toLocaleString().replace(/,/g, ""));
    console.log(
      (await token_contract.symbol()) +
        " balanceOf : " +
        (await token_contract.balanceOf(HNIToken.address))
          .toLocaleString()
          .replace(/,/g, "")
    );
    console.log(exchange_rate.toLocaleString().replace(/,/g, ""));
    console.log(exchange_rate_stored.toLocaleString().replace(/,/g, ""));
    console.log(new_exchange_rate.toLocaleString().replace(/,/g, "") + "\n");

    assert.equal(
      exchange_rate.toLocaleString().replace(/,/g, ""),
      exchange_rate_stored.toLocaleString().replace(/,/g, "")
    );

    let account_HNItoken_change = HNItoken_balance.sub(new_HNItoken_balance).abs();
    let account_token_change = balances.account.sub(new_balances.account).abs();
    let fee_recipient_change = new_balances.fee_recipient
      .sub(balances.fee_recipient)
      .abs();
    let underlying_change = balances.getTotalBalance
      .sub(new_balances.getTotalBalance)
      .abs();
    switch (asyncFn) {
      case HNIToken.mint:
        assert.equal(
          account_token_change.toLocaleString().replace(/,/g, ""),
          args[1].toLocaleString().replace(/,/g, "")
        );
        assert.equal(
          underlying_change.toLocaleString().replace(/,/g, ""),
          account_token_change
            .sub(fee_recipient_change)
            .toLocaleString()
            .replace(/,/g, "")
        );
        assert.equal(
          rdiv(underlying_change, exchange_rate_stored)
            .toLocaleString()
            .replace(/,/g, ""),
          account_HNItoken_change.toLocaleString().replace(/,/g, "")
        );
        break;
      case HNIToken.redeem:
        assert.equal(
          account_HNItoken_change.toLocaleString().replace(/,/g, ""),
          args[1].toLocaleString().replace(/,/g, "")
        );
        assert.equal(
          account_token_change
            .add(fee_recipient_change)
            .toLocaleString()
            .replace(/,/g, ""),
          rmul(account_HNItoken_change, exchange_rate_stored)
            .toLocaleString()
            .replace(/,/g, "")
        );
        assert.equal(
          underlying_change.toLocaleString().replace(/,/g, ""),
          account_token_change
            .add(fee_recipient_change)
            .toLocaleString()
            .replace(/,/g, "")
        );
        assert.equal(
          underlying_change.toLocaleString().replace(/,/g, ""),
          rmul(account_HNItoken_change, exchange_rate_stored)
            .toLocaleString()
            .replace(/,/g, "")
        );
        break;
      case HNIToken.redeemUnderlying:
        assert.equal(
          account_token_change.toLocaleString().replace(/,/g, ""),
          args[1].toLocaleString().replace(/,/g, "")
        );
        assert.equal(
          account_HNItoken_change.toLocaleString().replace(/,/g, ""),
          rdivup(underlying_change, exchange_rate_stored)
            .toLocaleString()
            .replace(/,/g, "")
        );
        assert.equal(
          underlying_change.toLocaleString().replace(/,/g, ""),
          account_token_change
            .add(fee_recipient_change)
            .toLocaleString()
            .replace(/,/g, "")
        );
        // assert.equal(underlying_change.toLocaleString().replace(/,/g, ""), rmul(account_HNItoken_change, exchange_rate_stored).toLocaleString().replace(/,/g, ""));
        break;
      default:
        break;
    }
  }

  describe("HNIToken Integration: Random comprehensive test", function () {
    before(async function () {
      await resetContracts();
      dispatcher.resetHandlers(
        [
          internal_handler.address,
          compound_handler.address,
          aave_handler.address,
        ],
        // [700000, 300000]
        [700000, 200000, 100000]
      );

      await dUSDC.updateOriginationFee(REDEEM_SELECTOR, FEE);
      await dUSDC.updateOriginationFee(MINT_SELECTOR, FEE);
      await dUSDT.updateOriginationFee(REDEEM_SELECTOR, FEE);
      await dUSDT.updateOriginationFee(MINT_SELECTOR, FEE);
    });

    var run_number = 300;
    condition = 0;
    while (condition < run_number) {
      condition++;

      it(`Case Simulated user behavior test case ${condition} (Skipped in coverage)`, async function () {
        var account;
        var balance;
        var amount;
        for (let index = 0; index < HNItokens.length; index++) {
          if ((await HNItokens[index].getExchangeRate()).gt(new BN(0))) {
            account = accounts[randomNum(0, accounts.length - 1)];
            balance = (await HNItokens[index].balanceOf(account))
              .toLocaleString()
              .replace(/,/g, "");
            amount = new BN(
              randomNum(0, balance).toLocaleString().replace(/,/g, "")
            );
            await HNItokens[index].transfer(
              accounts[randomNum(0, accounts.length - 1)],
              amount,
              {from: account}
            );
          }
          await atokens[index].updateBalance(
            new BN(
              randomNum(
                0,
                BASE.div(new BN("1000")).toLocaleString().replace(/,/g, "")
              )
                .toLocaleString()
                .replace(/,/g, "")
            )
          );
          await ctokens[index].updateExchangeRate(
            new BN(
              randomNum(
                0,
                BASE.div(new BN("1000")).toLocaleString().replace(/,/g, "")
              )
                .toLocaleString()
                .replace(/,/g, "")
            )
          );

          if (randomNum(0, 12) == 2) {
            console.log("\n");
            var args = [];
            var HNItoken_admin_index = randomNum(0, 1);
            switch (HNItoken_admin_index) {
              case 0:
                var handler_list = await HNItokens[index].getHandlers();
                var withdraw_handlers = createRandomData(handler_list);
                var liquidity;
                var amount;
                var total_amount = await handlers[handler_list[0]].getBalance(
                  tokens[index].address
                );
                var withdraw_amounts = [];
                for (const handler of withdraw_handlers) {
                  liquidity = await handlers[handler].getLiquidity(
                    tokens[index].address
                  );
                  amount = new BN(
                    randomNum(0, liquidity.toLocaleString().replace(/,/g, ""))
                      .toLocaleString()
                      .replace(/,/g, "")
                  );
                  total_amount =
                    handler == handler_list[0]
                      ? total_amount
                      : total_amount.add(amount);
                  withdraw_amounts.push(
                    amount.eq(
                      await handlers[handler].getBalance(tokens[index].address)
                    )
                      ? UINT256_MAX
                      : amount
                  );
                }
                var deposit_handlers = createRandomData(handler_list);
                var deposit_amounts = [];
                for (const handler of deposit_handlers) {
                  amount = new BN(
                    randomNum(
                      0,
                      total_amount.toLocaleString().replace(/,/g, "")
                    )
                      .toLocaleString()
                      .replace(/,/g, "")
                  );
                  total_amount = total_amount.sub(amount);
                  deposit_amounts.push(amount);
                }
                console.log([
                  internal_handler.address,
                  compound_handler.address,
                  aave_handler.address,
                  other_handler.address,
                ]);
                console.log(handler_list);
                console.log(
                  (
                    await handlers[handler_list[0]].getBalance(
                      tokens[index].address
                    )
                  )
                    .toLocaleString()
                    .replace(/,/g, "")
                );
                console.log((await HNItokens[index].symbol()) + ":rebalance");
                console.log("withdraw_handlers:" + withdraw_handlers);
                console.log("withdraw_amounts:" + withdraw_amounts);
                console.log("deposit_handlers:" + deposit_handlers);
                console.log("deposit_amounts:" + deposit_amounts);
                await HNItoken_admin_behavior[index * 2 + HNItoken_admin_index](
                  withdraw_handlers,
                  withdraw_amounts,
                  deposit_handlers,
                  deposit_amounts
                );
                break;
              case 1:
                var fee_index =
                  FEE_HASHES_LIST[randomNum(0, FEE_HASHES_LIST.length - 1)];
                var fee = randomNum(
                  0,
                  FEE_MAX.toLocaleString().replace(/,/g, "")
                )
                  .toLocaleString()
                  .replace(/,/g, "");
                var old_fee = (await HNItokens[index].originationFee(fee_index))
                  .toLocaleString()
                  .replace(/,/g, "");
                if (fee != old_fee) {
                  await HNItoken_admin_behavior[index * 2 + HNItoken_admin_index](
                    fee_index,
                    new BN(fee)
                  );
                  console.log(
                    (await HNItokens[index].symbol()) +
                      ":updateOriginationFee old fee : " +
                      old_fee +
                      " fee : " +
                      fee
                  );
                }
                break;
            }
          }

          if (randomNum(0, 50) == 1) {
            console.log("\n");
            var handler_list = [];
            var args = [];
            var dispatcher_admin_index = randomNum(0, 1);
            switch (dispatcher_admin_index) {
              case 0:
                handler_list = createRandomData([
                  compound_handler.address,
                  aave_handler.address,
                ]);
                handler_list.unshift(
                  ...createRandomData(
                    [internal_handler.address, other_handler.address],
                    1,
                    2
                  )
                );
                console.log("resetHandlers:");
                break;
              case 1:
                handler_list = await HNItokens[index].getHandlers();
                handler_list = createRandomData(
                  handler_list,
                  handler_list.length,
                  handler_list.length
                );
                console.log("updateProportion:");
                break;
            }
            var proportions = [];
            var proportional_quota = TOTAL_PROPORTION;
            var proportion;
            for (let index = 0; index < handler_list.length; index++) {
              proportion =
                index == handler_list.length - 1
                  ? proportional_quota
                  : new BN(
                      randomNum(
                        0,
                        proportional_quota.toLocaleString().replace(/,/g, "")
                      )
                        .toLocaleString()
                        .replace(/,/g, "")
                    );
              proportions.push(proportion);
              proportional_quota = proportional_quota.sub(proportion);
            }
            args.push(handler_list);
            args.push(proportions);
            // console.log([internal_handler.address, compound_handler.address, aave_handler.address, other_handler.address]);
            console.log("handlers:" + args[0]);
            console.log("proportions:" + args[1]);
            await dispatcher_admin_behavior[dispatcher_admin_index](...args);
          }
        }

        account = accounts[randomNum(0, accounts.length - 1)];
        var user_behavior_index = randomNum(0, user_behavior.length - 1);
        var HNItoken_index = Math.floor(user_behavior_index / 3);

        switch (user_behavior_index % 3) {
          case 0:
            balance = (await tokens[HNItoken_index].balanceOf(account))
              .toLocaleString()
              .replace(/,/g, "");
            break;
          case 1:
            balance = (await HNItokens[HNItoken_index].balanceOf(account))
              .toLocaleString()
              .replace(/,/g, "");
            break;
          case 2:
            balance = rmul(
              await HNItokens[HNItoken_index].getTokenBalance(account),
              BASE.sub(
                await HNItokens[HNItoken_index].originationFee(REDEEM_SELECTOR)
              )
            )
              .toLocaleString()
              .replace(/,/g, "");
            break;
        }
        amount = new BN(
          randomNum(0, balance).toLocaleString().replace(/,/g, "")
        );
        console.log(
          `${await HNItokens[HNItoken_index].symbol()} ${
            user_behavior_name[user_behavior_index % 3]
          } :: balance : ${balance}   amount : ${amount}`
        );
        if (amount.lte(new BN("0"))) return;

        await checkUserBehavior(
          user_behavior[user_behavior_index],
          [account, amount, {from: account}],
          HNItokens[HNItoken_index],
          account
        );
      });
    }

    it("Empty the end test", async function () {
      for (let i = 0; i < HNItokens.length; i++) {
        for (let j = 0; j < accounts.length; j++) {
          var amount = await HNItokens[i].balanceOf(accounts[j]);
          if (amount.lte(new BN("0"))) continue;
          if ((await HNItokens[i].getTotalBalance()).eq(new BN(0))) continue;
          await HNItokens[i].redeem(accounts[j], amount, {
            from: accounts[j],
          });

          assert.equal(
            (await HNItokens[i].balanceOf(accounts[j]))
              .toLocaleString()
              .replace(/,/g, ""),
            new BN(0).toLocaleString().replace(/,/g, "")
          );
        }
        // if ((await HNItokens[i].getTotalBalance()).eq(new BN(0)) && (await HNItokens[i].totalSupply()).gt(new BN(0)));
        // assert.equal((await HNItokens[i].totalSupply()).toLocaleString().replace(/,/g, ""), new BN(0).toLocaleString().replace(/,/g, ""));
        console.log(
          (await HNItokens[i].symbol()) +
            " totalSupply: " +
            (await HNItokens[i].totalSupply()).toLocaleString().replace(/,/g, "")
        );
        console.log(
          (await HNItokens[i].symbol()) +
            " underlying balance: " +
            (await HNItokens[i].getTotalBalance())
              .toLocaleString()
              .replace(/,/g, "")
        );
      }
    });
  });
});
