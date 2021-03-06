var FiatToken = artifacts.require("FiatTokenV1");
var TetherToken = artifacts.require("TetherToken");
var CTokenMock = artifacts.require("CTokenMock");
var aTokenMock = artifacts.require("aTokenMock");
var LendingPoolCoreMock = artifacts.require("AaveLendingPoolCoreMock");
var LendPoolMock = artifacts.require("AaveLendPoolMock");
var CompoundHandler = artifacts.require("CompoundHandler");
var AaveHandler = artifacts.require("AaveHandler");
var InternalHandler = artifacts.require("InternalHandler");
var Dispatcher = artifacts.require("Dispatcher");
var HNITokenController = artifacts.require("HNITokenController");
var HNIToken = artifacts.require("HNIToken");
var DSGuard = artifacts.require("DSGuard");
var Proxy = artifacts.require("HNITokenProxy");

const BN = require("bn.js");
const UINT256_MAX = new BN(2).pow(new BN(256)).sub(new BN(1));

var usdc, cUSDC, usdt, aUSDT, lendingPoolCore, lendingPool;
var comp;

module.exports = async function (deployer, network, accounts) {
  // Contract deployer of all the contracts, so at the same time it is also the contract owner.
  let contractDeployer = accounts[0];
  let guardOwner = accounts[1];
  let proxyAdmin = accounts[1];
  // Deploys Guard contract
  await deployer.deploy(DSGuard, {'from': guardOwner});
  let ds_guard = await DSGuard.deployed();
  // Deploys HNIToken library contract
  await deployer.deploy(HNITokenController);
  let HNIToken_contract_library = await HNITokenController.deployed();
  await HNIToken_contract_library.setAuthority(ds_guard.address);

  if (network == "kovan") {
    // Compound USDC
    usdc = await FiatToken.at("0xb7a4F3E9097C08dA09517b5aB877F7a917224ede");
    // Compound cUSDC
    cUSDC = await CTokenMock.at("0x4a92E71227D294F041BD82dd8f78591B75140d63");
    // Aave USDT
    usdt = await TetherToken.at("0x13512979ade267ab5100878e2e0f485b568328a4");
    // Aave aUSDT
    aUSDT = await aTokenMock.at("0xA01bA9fB493b851F4Ac5093A324CB081A909C34B");
    // Aave lending pool core
    lendingPoolCore = await LendingPoolCoreMock.at(
      "0x95D1189Ed88B380E319dF73fF00E479fcc4CFa45"
    );
    // Aave lending pool
    lendingPool = await LendPoolMock.at(
      "0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c"
    );
    // COMP token
    comp = await FiatToken.at("0x61460874a7196d6a22D1eE4922473664b3E95270");
  } else {
    await deployer.deploy(
      FiatToken,
      "USDC",
      "USDC",
      "USD",
      6,
      contractDeployer,
      contractDeployer,
      contractDeployer
    );
    usdc = await FiatToken.deployed();

    await deployer.deploy(CTokenMock, "cUSDC", "cUSDC", usdc.address);
    cUSDC = await CTokenMock.deployed();

    await deployer.deploy(TetherToken, "1000000000", "USDT", "USDT", 6);
    usdt = await TetherToken.deployed();

    await deployer.deploy(LendingPoolCoreMock);
    lendingPoolCore = await LendingPoolCoreMock.deployed();

    await deployer.deploy(LendPoolMock, lendingPoolCore.address);
    lendingPool = await LendPoolMock.deployed();

    await deployer.deploy(
      aTokenMock,
      "aUSDT",
      "aUSDT",
      usdt.address,
      lendingPoolCore.address
    );
    aUSDT = await aTokenMock.deployed();
    await lendingPoolCore.setReserveATokenAddress(usdt.address, aUSDT.address);

    await deployer.deploy(TetherToken, "1000000000", "COMP", "COMP", 18);
    comp = await TetherToken.deployed();;
  }

  // Deploys Internal contract
  await deployer.deploy(InternalHandler, HNIToken_contract_library.address);
  let internal_handler = await InternalHandler.deployed();
  await deployer.deploy(Proxy, internal_handler.address, {'from':proxyAdmin});
  let internal_handler_proxy = await Proxy.deployed();
  let internal_proxy = await InternalHandler.at(internal_handler_proxy.address);
  await internal_proxy.initialize(HNIToken_contract_library.address);
  await internal_proxy.enableTokens([usdc.address, usdt.address]);
  await internal_proxy.setAuthority(ds_guard.address);

  // Deploy Compound handler
  await deployer.deploy(CompoundHandler, HNIToken_contract_library.address, comp.address);
  let compound_handler = await CompoundHandler.deployed();
  await deployer.deploy(Proxy, compound_handler.address, {'from':proxyAdmin});
  let compound_handler_proxy = await Proxy.deployed();
  let compound_proxy = await CompoundHandler.at(compound_handler_proxy.address);
  await compound_proxy.initialize(HNIToken_contract_library.address, comp.address);
  await compound_proxy.enableTokens([usdc.address]);
  await compound_proxy.setAuthority(ds_guard.address);

  await compound_proxy.setcTokensRelation([usdc.address], [cUSDC.address]);

  // Deploy Aave handler
  await deployer.deploy(
    AaveHandler,
    HNIToken_contract_library.address,
    lendingPool.address,
    lendingPoolCore.address
  );
  let aave_handler = await AaveHandler.deployed();
  await deployer.deploy(Proxy, aave_handler.address, {'from':proxyAdmin});
  let aave_handler_proxy = await Proxy.deployed();
  let aave_proxy = await AaveHandler.at(aave_handler_proxy.address);
  await aave_proxy.initialize(
    HNIToken_contract_library.address,
    lendingPool.address,
    lendingPoolCore.address
  );
  await aave_proxy.enableTokens([usdt.address]);
  await aave_proxy.setAuthority(ds_guard.address);

  // Deploys usdc dispatcher
  await deployer.deploy(
    Dispatcher,
    [internal_handler_proxy.address, compound_handler_proxy.address],
    [700000, 300000]
  );
  let usdc_dispatcher = await Dispatcher.deployed();
  await usdc_dispatcher.setAuthority(ds_guard.address);

  // Deploys dUSDC
  await deployer.deploy(
    HNIToken,
    "HNIToken",
    "HNIToken",
    usdc.address,
    usdc_dispatcher.address
  );
  let dUSDC = await HNIToken.deployed();
  await deployer.deploy(Proxy, dUSDC.address, {'from':proxyAdmin});
  let dUSDC_token_proxy = await Proxy.deployed();
  let dUSDC_proxy = await HNIToken.at(dUSDC_token_proxy.address);
  await dUSDC_proxy.initialize(
    "dUSDC",
    "dUSDC",
    usdc.address,
    usdc_dispatcher.address
  );
  await dUSDC_proxy.setAuthority(ds_guard.address);
  await ds_guard.permitx(dUSDC_proxy.address, internal_handler_proxy.address, {'from': guardOwner});
  await ds_guard.permitx(dUSDC_proxy.address, compound_handler_proxy.address, {'from': guardOwner});

  // Deploys usdt dispatcher
  await deployer.deploy(
    Dispatcher,
    [internal_handler_proxy.address, aave_handler_proxy.address],
    [700000, 300000]
  );
  let usdt_dispatcher = await Dispatcher.deployed();
  await usdt_dispatcher.setAuthority(ds_guard.address);

  // Deploys dUSDT
  await deployer.deploy(Proxy, dUSDC.address, {'from':proxyAdmin});
  let dUSDT_token_proxy = await Proxy.deployed();
  let dUSDT_proxy = await HNIToken.at(dUSDT_token_proxy.address);
  await dUSDT_proxy.initialize(
    "dUSDT",
    "dUSDT",
    usdt.address,
    usdt_dispatcher.address
  );
  await dUSDT_proxy.setAuthority(ds_guard.address);
  await ds_guard.permitx(dUSDT_proxy.address, internal_handler_proxy.address, {'from': guardOwner});
  await ds_guard.permitx(dUSDT_proxy.address, aave_handler_proxy.address, {'from': guardOwner});

  await HNIToken_contract_library.setHNITokensRelation(
    [usdc.address, usdt.address],
    [dUSDC_proxy.address, dUSDT_proxy.address]
  );

  await internal_proxy.approve(usdc.address, UINT256_MAX);
  await internal_proxy.approve(usdt.address, UINT256_MAX);
  await compound_proxy.approve(usdc.address, UINT256_MAX);
  await aave_proxy.approve(usdt.address, UINT256_MAX);

  console.log("Deployer address:   ", contractDeployer);
  console.log("DS Guard owner is:  ", guardOwner);
  console.log("All proxy admin is: ", proxyAdmin);
  console.log("DS Guard contract address: ", ds_guard.address);
  console.log(
    "HNIToken Controller contract address: ",
    HNIToken_contract_library.address,
    "\n"
  );

  console.log("USDC contract address: ", usdc.address);
  console.log("cUSDC contract address: ", cUSDC.address);
  console.log("USDT contract address: ", usdt.address);
  console.log("aUSDT contract address: ", aUSDT.address);
  console.log("LendingPoolCore contract address: ", lendingPoolCore.address);
  console.log("LendingPool contract address: ", lendingPool.address);
  console.log("COMP contract address: ", comp.address, "\n");

  console.log("Internal handler contract address: ", internal_handler.address);
  console.log(
    "Internal handler proxy contract address: ",
    internal_proxy.address,
    "\n"
  );

  console.log("Compound handler contract address: ", compound_handler.address);
  console.log(
    "Compound handler proxy contract address: ",
    compound_proxy.address,
    "\n"
  );

  console.log("Aave handler contract address: ", aave_handler.address);
  console.log(
    "Aave handler proxy contract address: ",
    aave_proxy.address,
    "\n"
  );

  console.log("HNIToken implementation", dUSDC.address, "\n");

  console.log("USDC dispatcher contract address: ", usdc_dispatcher.address);
  console.log("dUSDC contract address: ", dUSDC_proxy.address, "\n");

  console.log("USDT dispatcher contract address: ", usdt_dispatcher.address);
  console.log("dUSDT contract address: ", dUSDT_proxy.address, "\n");
};
