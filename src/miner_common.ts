

import * as fs from 'fs';
import Decimal from 'decimal.js';
import BN from 'bn.js';
import * as util from "util";


import { CetusClmmSDK, d, SdkOptions, TickMath, toDecimalsAmount, ClmmPoolUtil, Percentage, 
          adjustForSlippage, adjustForCoinSlippage, RpcModule, Position, Pool, AddLiquidityFixTokenParams,
          BigNumber, CoinAmounts, CalculateRatesResult, AddLiquidityParams, 
          RewarderAmountOwed, PosRewarderResult, FetchPosFeeParams, CollectFeesQuote, CoinBalance,
          PositionUtil} from '@cetusprotocol/cetus-sui-clmm-sdk';

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {FetchPosRewardParams} from '@cetusprotocol/cetus-sui-clmm-sdk';



const SDKConfig = {
  clmmConfig: {
    pools_id: '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
    global_config_id: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
    global_vault_id: '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
    admin_cap_id: '0x89c1a321291d15ddae5a086c9abc533dff697fde3d89e0ca836c41af73e36a75',
  },
  cetusConfig: {
    coin_list_id: '0x8cbc11d9e10140db3d230f50b4d30e9b721201c0083615441707ffec1ef77b23',
    launchpad_pools_id: '0x1098fac992eab3a0ab7acf15bb654fc1cf29b5a6142c4ef1058e6c408dd15115',
    clmm_pools_id: '0x15b6a27dd9ae03eb455aba03b39e29aad74abd3757b8e18c0755651b2ae5b71e',
    admin_cap_id: '0x39d78781750e193ce35c45ff32c6c0c3f2941fa3ddaf8595c90c555589ddb113',
    global_config_id: '0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f',
    coin_list_handle: '0x49136005e90e28c4695419ed4194cc240603f1ea8eb84e62275eaff088a71063',
    launchpad_pools_handle: '0x5e194a8efcf653830daf85a85b52e3ae8f65dc39481d54b2382acda25068375c',
    clmm_pools_handle: '0x37f60eb2d9d227949b95da8fea810db3c32d1e1fa8ed87434fc51664f87d83cb',
  },
}

// mainnet
export const clmmMainnet: SdkOptions = {
  fullRpcUrl: 'https://fullnode.mainnet.sui.io:443',//'https://sui-mainnet.blockvision.org/v1/2n6eLEh3EaMuVD4fezoFm2bd8hF', //'https://sui-mainnet-endpoint.blockvision.org/',  
  simulationAccount: {
    address: '',// your wallet address
  },
  cetus_config: {
    package_id: '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
    published_at: '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
    config: SDKConfig.cetusConfig,
  },
  clmm_pool: {
    package_id: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
    published_at: '0x70968826ad1b4ba895753f634b0aea68d0672908ca1075a2abdf0fc9e0b2fc6a',
    config: SDKConfig.clmmConfig,
  },
  integrate: {
    package_id: '0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3',
    published_at: '0x6f5e582ede61fe5395b50c4a449ec11479a54d7ff8e0158247adfda60d98970b',
  },
  deepbook: {
    package_id: '0x000000000000000000000000000000000000000000000000000000000000dee9',
    published_at: '0x000000000000000000000000000000000000000000000000000000000000dee9',
  },
  deepbook_endpoint_v2: {
    package_id: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
    published_at: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
  },
  aggregatorUrl: 'https://api-sui.cetus.zone/router',
  swapCountUrl: 'https://api-sui.cetus.zone/v2/sui/swap/count',
}

const SDK = new CetusClmmSDK(clmmMainnet)




// log config
const date = new Date();
var fileName: string = 'console-' + date.toISOString() + '.log';
var fileNameBrief: string = 'console-brief-' + date.toISOString() + '.log';
var fileNameStatisticsInfo: string = 'console-stat-' + date.toISOString() + '.log';
var fileNamePosChangeEvent: string = 'console-poschange-' + date.toISOString() + '.log';

var fileNamePositionInfo: string = 'position_info_adapter.json';




// wallet config
const mnemonics = ''  // your mnemonics

// Account 1, Account 2 .... of your wallet
const path = 'm\/44\'\/784\'\/0\'\/0\'\/0\'' 
// const path = 'm\/44\'\/784\'\/1\'\/0\'\/0\''
// const path = 'm\/44\'\/784\'\/2\'\/0\'\/0\''


// slippage config
var closeLiquiditySlippagePercent = 15 // for quick config
var openLiquiditySlippagePercent = 5
var swapSlippagePercent = 1





// 60 ticks base range for 0.25% fee rate
const BASE_TICK_RANGE: number = 60


// position param
const POSITION_TICK_ROUND_SEED:number = 33300 // you can set any x for x % BASE_TICK_RANGE == 0
const MAX_POSITION_ADDED: number = 1
const BASE_TICK_RANGE_COUNT: number = 9
const POSITION_TICK_RANGE: number = BASE_TICK_RANGE * BASE_TICK_RANGE_COUNT


// liquidity
// you can use ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts and ClmmPoolUtil.getCoinAmountFromLiquidity
// to calculate constant liquidity from coin for a position
var position_liquidity = new BN(9600000000000) // e.g. 1400 sui in 9 base range, 9679344626697
var wallet_balance_buffer_in_coin_a = new BN(10 * 1000000) // 10 DEEP
var wallet_balance_buffer_in_coin_b = new BN(10 * 1000000000) // 10 SUI


// main pool config
var main_pool_address = '0xe01243f37f712ef87e556afb9b1d03d0fae13f96d324ec912daffc339dfdcbd2' // DEEP - SUI 0.25%









enum COIN_TYPE {  
  WUSDC = 0,
  SUI,
  CETUS,
  DEEP,
  COIN_TYPE_MAX
}


// main pool coin a and coin b info config
var coin_a_type: COIN_TYPE = COIN_TYPE.DEEP
var coin_a_name: string = 'DEEP'
var coin_a_decimals = 6

var coin_b_type: COIN_TYPE = COIN_TYPE.SUI
var coin_b_name: string = 'SUI'
var coin_b_decimals = 9

var is_coin_a_base = true // ture if calc coin a price, vice versa





type CoinSwapPath = {
  pool_address: string;
  a2b: boolean;
  decimals_a: number;
  decimals_b: number;
}

type CoinInfo = {
  coin_name: string;
  coin_decimals: number;
  coin_swap_path_to_u: CoinSwapPath[];  // the swap path to ustc/usdt
}



// all relative coin range info config
var relative_coin_info = new Map<COIN_TYPE, CoinInfo>(
[
  [
    COIN_TYPE.DEEP, 
    {
      coin_name: 'DEEP', 
      coin_decimals: 6, 
      coin_swap_path_to_u:
      [
        {
          pool_address: '0xe01243f37f712ef87e556afb9b1d03d0fae13f96d324ec912daffc339dfdcbd2',  // DEEP - SUI 0.25
          a2b: true,
          decimals_a: 6,
          decimals_b: 9
        },
        {
          pool_address: '0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630', // wUSDC - SUI, 0.25
          a2b: false,
          decimals_a: 6,
          decimals_b: 9
        }
      ]
    }
  ],
  [
    COIN_TYPE.SUI, 
    {
      coin_name: 'SUI', 
      coin_decimals: 9,
      coin_swap_path_to_u:
      [
        {
          pool_address: '0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630', // wUSDC - SUI, 0.25
          a2b: false,
          decimals_a: 6,
          decimals_b: 9
        }
      ]
    }
  ],
  [
    COIN_TYPE.WUSDC, 
    {
      coin_name: 'WUSDC', 
      coin_decimals: 6,
      coin_swap_path_to_u:[]     
    }
  ]
]);






// deprecated
var COIN_TYPE_STRING_TO_VALUE = new Map([
  ['0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN', COIN_TYPE.WUSDC],
  ['5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN', COIN_TYPE.WUSDC],
  ['0x2::sui::SUI', COIN_TYPE.SUI],
  ['0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI', COIN_TYPE.SUI],
  ['0000000000000000000000000000000000000000000000000000000000000002::sui::SUI', COIN_TYPE.SUI],
  ['0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS', COIN_TYPE.CETUS],
  ['06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS', COIN_TYPE.CETUS],
  ['0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS', COIN_TYPE.CETUS],
  ['0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP', COIN_TYPE.DEEP]
]);


function getCoinTypeEnum(coinType: string): COIN_TYPE{
  if (coinType.endsWith('::coin::COIN')) {
    return COIN_TYPE.WUSDC
  } else if (coinType.endsWith('::sui::SUI')) {
    return COIN_TYPE.SUI
  } else if (coinType.endsWith('::cetus::CETUS')) {
    return COIN_TYPE.CETUS
  } else if (coinType.endsWith('::deep::DEEP')) {
    return COIN_TYPE.DEEP
  }
  return COIN_TYPE.COIN_TYPE_MAX
}



type RewarderAmountOwedMod = {
  amount_owed: BN;
  coin_type: COIN_TYPE;
};

type PositionInfo = {
  tick_lower_index: number;
  tick_upper_index: number;
  coin_type_a: string;
  coin_type_b: string;
  pos_object_id: string;
  liquidity: BN; 
  lower_bounder_coin_a_amount: BN; //  = LiquidityBaselineInfo.liquidity_in_coin_a
  upper_bounder_coin_b_amount: BN; //  = LiquidityBaselineInfo.liquidity_in_coin_b
  tick_lower_coin_a_price: number;
  tick_upper_coin_a_price: number;
  tick_lower_coin_b_price: number;
  tick_upper_coin_b_price: number;
  fee_coin_a_claimed_total: BN;
  fee_coin_b_claimed_total: BN;
  fee_value_in_u_claimed_total: number;
  reward_amount_claimed_total: RewarderAmountOwedMod[];
  reward_value_in_u_claimed_total: number;
  init_tick: number;
  position_opened: boolean;
  on_position_times: number;
  short_times_on_base_coin: number;
};


type RewarderAmountOwedModAdapter = {
  amount_owed: number;
  coin_type: number;
};

type PositionInfoAdapter = {
  tick_lower_index: number;
  tick_upper_index: number;
  coin_type_a: string;
  coin_type_b: string;
  pos_object_id: string;
  liquidity: number;  
  lower_bounder_coin_a_amount: number;
  upper_bounder_coin_b_amount: number;
  tick_lower_coin_a_price: number;
  tick_upper_coin_a_price: number;
  tick_lower_coin_b_price: number;
  tick_upper_coin_b_price: number;  
  fee_coin_a_claimed_total: number;
  fee_coin_b_claimed_total: number;
  fee_value_in_u_claimed_total: number;
  reward_amount_claimed_total: RewarderAmountOwedModAdapter[];
  reward_value_in_u_claimed_total: number;
  init_tick: number;
  position_opened: boolean;
  on_position_times: number;
  short_times_on_base_coin: number;
};


function transferFromPositionInfoAdapter(position_info_adapter: PositionInfoAdapter): PositionInfo {
  var position_info: PositionInfo = {
    tick_lower_index: position_info_adapter.tick_lower_index,
    tick_upper_index: position_info_adapter.tick_upper_index,
    coin_type_a: position_info_adapter.coin_type_a,
    coin_type_b: position_info_adapter.coin_type_b,
    pos_object_id: position_info_adapter.pos_object_id,    
    liquidity: new BN(position_info_adapter.liquidity),
    lower_bounder_coin_a_amount: new BN(position_info_adapter.lower_bounder_coin_a_amount),
    upper_bounder_coin_b_amount: new BN(position_info_adapter.upper_bounder_coin_b_amount),
    tick_lower_coin_a_price: position_info_adapter.tick_lower_coin_a_price,
    tick_upper_coin_a_price: position_info_adapter.tick_upper_coin_a_price,
    tick_lower_coin_b_price: position_info_adapter.tick_lower_coin_b_price,
    tick_upper_coin_b_price: position_info_adapter.tick_upper_coin_b_price,
    fee_coin_a_claimed_total: new BN(position_info_adapter.fee_coin_a_claimed_total),
    fee_coin_b_claimed_total: new BN(position_info_adapter.fee_coin_b_claimed_total),
    fee_value_in_u_claimed_total:position_info_adapter.fee_value_in_u_claimed_total,
    reward_amount_claimed_total:[],
    reward_value_in_u_claimed_total: position_info_adapter.reward_value_in_u_claimed_total, 
    init_tick: position_info_adapter.init_tick,
    position_opened: position_info_adapter.position_opened, 
    on_position_times: position_info_adapter.on_position_times,
    short_times_on_base_coin: position_info_adapter.short_times_on_base_coin
  }
  for(const reward_amount of position_info_adapter.reward_amount_claimed_total) {
    position_info.reward_amount_claimed_total.push({amount_owed: new BN(reward_amount.amount_owed), coin_type: reward_amount.coin_type})
  }
  return position_info
}

function transferToPositionInfoAdapter(position_info: PositionInfo): PositionInfoAdapter {
  var position_info_adapter: PositionInfoAdapter = {
    tick_lower_index: position_info.tick_lower_index,
    tick_upper_index: position_info.tick_upper_index,
    coin_type_a: position_info.coin_type_a,
    coin_type_b: position_info.coin_type_b,
    pos_object_id: position_info.pos_object_id,    
    liquidity: position_info.liquidity.toNumber(),
    lower_bounder_coin_a_amount: position_info.lower_bounder_coin_a_amount.toNumber(),
    upper_bounder_coin_b_amount: position_info.upper_bounder_coin_b_amount.toNumber(),
    tick_lower_coin_a_price: position_info.tick_lower_coin_a_price,
    tick_upper_coin_a_price: position_info.tick_upper_coin_a_price,
    tick_lower_coin_b_price: position_info.tick_lower_coin_b_price,
    tick_upper_coin_b_price: position_info.tick_upper_coin_b_price,
    fee_coin_a_claimed_total: position_info.fee_coin_a_claimed_total.toNumber(),
    fee_coin_b_claimed_total: position_info.fee_coin_b_claimed_total.toNumber(),
    fee_value_in_u_claimed_total: position_info.fee_value_in_u_claimed_total,
    reward_amount_claimed_total: [],
    reward_value_in_u_claimed_total: position_info.reward_value_in_u_claimed_total,    
    init_tick: position_info.init_tick,
    position_opened: position_info.position_opened,
    on_position_times: position_info.on_position_times,
    short_times_on_base_coin: position_info.short_times_on_base_coin
  }
  for(const reward_amount of position_info.reward_amount_claimed_total) {
    position_info_adapter.reward_amount_claimed_total.push({amount_owed: reward_amount.amount_owed.toNumber(), coin_type: reward_amount.coin_type})
  }
  return position_info_adapter
}





















type LiquidityBaselineInfo = {
  liquidity: BN;
  coin_a: BN;
  coin_b: BN;
  liquidity_in_coin_a: BN
  liquidity_in_coin_b: BN
};

function getLiquidityAndCoinAmountFromPosQuota(pool: Pool, liquidityInCoin: BN, isliquidityInCoinA: boolean, curPositionRangeLower: number, curPositionRangeHigher: number, 
            liquidityBaselineInfo: LiquidityBaselineInfo): boolean {

  var roundUp: boolean = true;
  var slippage: number = 0 // no need token b max value
  
  // get liquidity basis from coin 
  const liquidityInput = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
    curPositionRangeLower,
    curPositionRangeHigher,
    liquidityInCoin,
    isliquidityInCoinA,
    roundUp,
    slippage,
    TickMath.tickIndexToSqrtPriceX64(isliquidityInCoinA ? curPositionRangeLower: curPositionRangeHigher)
  )

  // get position liquidity of other coin
  const coinAmountsOther = ClmmPoolUtil.getCoinAmountFromLiquidity(liquidityInput.liquidityAmount, 
          TickMath.tickIndexToSqrtPriceX64(isliquidityInCoinA ? curPositionRangeHigher: curPositionRangeLower), 
          TickMath.tickIndexToSqrtPriceX64(curPositionRangeLower), 
          TickMath.tickIndexToSqrtPriceX64(curPositionRangeHigher), roundUp)

  // get coin amount from liquidity basis at current tick
  const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(liquidityInput.liquidityAmount, TickMath.tickIndexToSqrtPriceX64(pool.current_tick_index), 
          TickMath.tickIndexToSqrtPriceX64(curPositionRangeLower), 
          TickMath.tickIndexToSqrtPriceX64(curPositionRangeHigher), roundUp)

  liquidityBaselineInfo.coin_a = coinAmounts.coinA.clone() // new BN(coinAmounts.coinA)
  liquidityBaselineInfo.coin_b = coinAmounts.coinB.clone() // new BN(coinAmounts.coinB)
  liquidityBaselineInfo.liquidity = liquidityInput.liquidityAmount.clone() // new BN(liquidityInput.liquidityAmount)
  liquidityBaselineInfo.liquidity_in_coin_a = isliquidityInCoinA ? liquidityInCoin.clone() : coinAmountsOther.coinA.clone() // new BN(liquidityInCoin) : new BN(coinAmountsOther.coinA)
  liquidityBaselineInfo.liquidity_in_coin_b = isliquidityInCoinA ? coinAmountsOther.coinB.clone() : liquidityInCoin.clone() // new BN(coinAmountsOther.coinB) : new BN(liquidityInCoin)
  
  return true;
}

function getCurAndBounderCoinAmountFromLiquidity(pool: Pool, liquidity: BN, curPositionRangeLower: number, curPositionRangeHigher: number, 
    liquidityBaselineInfo: LiquidityBaselineInfo): boolean {

  var roundUp: boolean = true;
  var slippage: number = 0 // no need token b max value


  // get position liquidity of other coin
  const coinAmountsLow = ClmmPoolUtil.getCoinAmountFromLiquidity(liquidity, 
    TickMath.tickIndexToSqrtPriceX64(curPositionRangeLower), 
    TickMath.tickIndexToSqrtPriceX64(curPositionRangeLower), 
    TickMath.tickIndexToSqrtPriceX64(curPositionRangeHigher), roundUp)

  // get position liquidity of other coin
  const coinAmountsHigh = ClmmPoolUtil.getCoinAmountFromLiquidity(liquidity, 
    TickMath.tickIndexToSqrtPriceX64(curPositionRangeHigher), 
    TickMath.tickIndexToSqrtPriceX64(curPositionRangeLower), 
    TickMath.tickIndexToSqrtPriceX64(curPositionRangeHigher), roundUp)

  // get coin amount from liquidity basis at current tick
  const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(liquidity, TickMath.tickIndexToSqrtPriceX64(pool.current_tick_index), 
    TickMath.tickIndexToSqrtPriceX64(curPositionRangeLower), 
    TickMath.tickIndexToSqrtPriceX64(curPositionRangeHigher), roundUp)

  liquidityBaselineInfo.coin_a = coinAmounts.coinA.clone() // new BN(coinAmounts.coinA)
  liquidityBaselineInfo.coin_b = coinAmounts.coinB.clone() // new BN(coinAmounts.coinB)
  liquidityBaselineInfo.liquidity = liquidity.clone() // new BN(liquidityInput.liquidityAmount)
  liquidityBaselineInfo.liquidity_in_coin_a = coinAmountsLow.coinA.clone() // new BN(liquidityInCoin) : new BN(coinAmountsOther.coinA)
  liquidityBaselineInfo.liquidity_in_coin_b = coinAmountsHigh.coinB.clone() // new BN(coinAmountsOther.coinB) : new BN(liquidityInCoin)

  return true;
}








type CheckBalanceInfo = {
  situation: number; // 0 - no swap; 1 - b to a; 2 - a to b; 3 - not enough to swap
  estimatedAmountOut: BN;
  estimatedAmountIn: BN;
  estimatedFeeAmount: BN;
  amount: BN;
  byAmountIn: boolean; // indicate amount
  amountLimit: BN;
};

async function rebalanceCoinAAndCoinBByMinimumBoth(pool: Pool, coinAmounts: CoinAmounts, coinWalletAmounts: CoinAmounts, coinBufferAmounts: CoinAmounts,
  sendKeypair: Ed25519Keypair, checkBalanceInfo: CheckBalanceInfo): Promise<boolean> {

  var wallet_balance_of_coin_a = coinWalletAmounts.coinA.clone() // new BN(coinWalletAmounts.coinA)
  var wallet_balance_of_coin_b = coinWalletAmounts.coinB.clone() // new BN(coinWalletAmounts.coinB)

  var wallet_balance_buffer_of_coin_a = coinBufferAmounts.coinA.clone()
  var wallet_balance_buffer_of_coin_b = coinBufferAmounts.coinB.clone()

  var deviation_in_coin_b = wallet_balance_buffer_of_coin_b.divn(5) // + - 20%
  var deviation_in_coin_a = wallet_balance_buffer_of_coin_a.divn(5) // + - 20%

  if (wallet_balance_of_coin_a.gte(coinAmounts.coinA.add(wallet_balance_buffer_of_coin_a.sub(deviation_in_coin_a)))
            && wallet_balance_of_coin_b.gte(coinAmounts.coinB.add(wallet_balance_buffer_of_coin_b.sub(deviation_in_coin_b)))) {
    date.setTime(Date.now())
    console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: Wallet balance coin a and coin b is enough.', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: Wallet balance coin a and coin b is enough.\n', date.toLocaleString()))
    fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: Wallet balance coin a and coin b is enough.\n', date.toLocaleString()))

    checkBalanceInfo.situation = 0
    return true
  } else if (wallet_balance_of_coin_a.lt(coinAmounts.coinA.add(wallet_balance_buffer_of_coin_a.sub(deviation_in_coin_a)))
            && wallet_balance_of_coin_b.gte(coinAmounts.coinB.add(wallet_balance_buffer_of_coin_b.sub(deviation_in_coin_b)))) {
    // coinA insufficient, coinB -> coinA

    date.setTime(Date.now())
    console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA insufficient, coinB -> coinA calc by minimum coinA', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA insufficient, coinB -> coinA calc by minimum coinA\n', date.toLocaleString()))
    fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA insufficient, coinB -> coinA calc by minimum coinA\n', date.toLocaleString()))

    const a2b = false
    const amount = coinAmounts.coinA.sub(wallet_balance_of_coin_a.sub(wallet_balance_buffer_of_coin_a))
    const byAmountIn = false
    const swapTicks = await SDK.Pool.fetchTicksByRpc(pool.ticks_handle)

    const res = SDK.Swap.calculateRates({
      decimalsA: coin_a_decimals,
      decimalsB: coin_b_decimals,
      a2b,
      byAmountIn,
      amount,
      swapTicks,
      currentPool: pool
    })

    const slippage = Percentage.fromDecimal(d(swapSlippagePercent)) // by denominator of swap amount
    const otherSideAmount = byAmountIn ? res.estimatedAmountOut : res.estimatedAmountIn
    const otherSideAmountLimit = adjustForSlippage(otherSideAmount.clone(), slippage, !byAmountIn)

    checkBalanceInfo.situation = 1    
    checkBalanceInfo.estimatedAmountOut = res.estimatedAmountOut
    checkBalanceInfo.estimatedAmountIn = res.estimatedAmountIn
    checkBalanceInfo.estimatedFeeAmount = res.estimatedFeeAmount
    checkBalanceInfo.amount = amount
    checkBalanceInfo.byAmountIn = byAmountIn
    checkBalanceInfo.amountLimit = otherSideAmountLimit

    date.setTime(Date.now())
    console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA to receive: %s(%d)', date.toLocaleString(), amount.toString(), 
            d(amount.toString()).div(Decimal.pow(10, coin_a_decimals)).toNumber())
    console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB est to send: %s(%d)', date.toLocaleString(), res.estimatedAmountIn.toString(), 
            d(res.estimatedAmountIn.toString()).div(Decimal.pow(10, coin_b_decimals)).toNumber())
    console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB limit to send: %s(%d)(+ %d%% slippage)', date.toLocaleString(), otherSideAmountLimit.toString(), 
            d(otherSideAmountLimit.toString()).div(Decimal.pow(10, coin_b_decimals)).toNumber(),
            d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100))

    fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA to receive: %s(%d)\n', date.toLocaleString(), amount.toString(), 
            d(amount.toString()).div(Decimal.pow(10, coin_a_decimals)).toNumber()))
    fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB est to send: %s(%d)\n', date.toLocaleString(), res.estimatedAmountIn.toString(), 
            d(res.estimatedAmountIn.toString()).div(Decimal.pow(10, coin_b_decimals)).toNumber()))
    fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB limit to send: %s(%d)(+ %d%% slippage)\n', date.toLocaleString(), otherSideAmountLimit.toString(),
            d(otherSideAmountLimit.toString()).div(Decimal.pow(10, coin_b_decimals)).toNumber(),
            d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100)))

    fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA to receive: %s(%d)\n', date.toLocaleString(), amount.toString(), 
            d(amount.toString()).div(Decimal.pow(10, coin_a_decimals)).toNumber()))
    fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB est to send: %s(%d)\n', date.toLocaleString(), res.estimatedAmountIn.toString(), 
            d(res.estimatedAmountIn.toString()).div(Decimal.pow(10, coin_b_decimals)).toNumber()))
    fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB limit to send: %s(%d)(+ %d%% slippage)\n', date.toLocaleString(), otherSideAmountLimit.toString(),
            d(otherSideAmountLimit.toString()).div(Decimal.pow(10, coin_b_decimals)).toNumber(),
            d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100)))

    // var coin_b_price = d(amount.toNumber() / res.estimatedAmountIn.toNumber()).mul(Decimal.pow(10, coin_b_decimals - coin_a_decimals))
    // var coin_b_price_in_pool = d(1).div(TickMath.sqrtPriceX64ToPrice(new BN(pool.current_sqrt_price), coin_a_decimals, coin_b_decimals))
    // var amt = d(res.estimatedAmountIn.toString()).div(Decimal.pow(10, coin_b_decimals))
    // console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price : \$%d', date.toLocaleString(), coin_b_price)
    // console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price_in_pool : \$%d', date.toLocaleString(), coin_b_price_in_pool)
    // console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: sold est value benifit : \$%d', date.toLocaleString(), coin_b_price.sub(coin_b_price_in_pool).mul(amt))

    // fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price : \$%d\n', date.toLocaleString(), coin_b_price))
    // fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price_in_pool : \$%d\n', date.toLocaleString(), coin_b_price_in_pool))
    // fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: sold est value benifit : \$%d\n', date.toLocaleString(), coin_b_price.sub(coin_b_price_in_pool).mul(amt)))

    // fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price : \$%d\n', date.toLocaleString(), coin_b_price))
    // fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price_in_pool : \$%d\n', date.toLocaleString(), coin_b_price_in_pool))
    // fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: sold est value benifit : \$%d\n', date.toLocaleString(), coin_b_price.sub(coin_b_price_in_pool).mul(amt)))

    if (wallet_balance_of_coin_b.sub(coinAmounts.coinB).gte(otherSideAmountLimit.add(wallet_balance_buffer_of_coin_b.sub(deviation_in_coin_b)))) {
      const swapPayload = await SDK.Swap.createSwapTransactionPayload(
        {
          pool_id: pool.poolAddress,
          coinTypeA: pool.coinTypeA,
          coinTypeB: pool.coinTypeB,
          a2b: a2b,
          by_amount_in: byAmountIn,
          amount: res.amount.toString(),
          amount_limit: otherSideAmountLimit.toString()
        }
      )
      date.setTime(Date.now())
      console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: createSwapTransactionPayload:\n%s',  date.toLocaleString(), swapPayload.toJSON())
      fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: createSwapTransactionPayload:\n%s\n',  date.toLocaleString(), swapPayload.toJSON()))

      // console.log('%s [test] rebalanceCoinAAndCoinBByMinimumBoth: createSwapTransactionPayload:\n%s',  date.toLocaleString(), util.inspect(swapPayload, true))

      const transferTxn = await SDK.fullClient.sendTransaction(sendKeypair, swapPayload)

      var json_str = JSON.stringify(transferTxn, null, '\t')
      date.setTime(Date.now())
      console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: swap transferTxn:\n%s',  date.toLocaleString(), json_str)
      fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: swap transferTxn:\n%s\n',  date.toLocaleString(), json_str))
      if (transferTxn?.effects?.status.status == 'success') {
        return true
      } else {
        date.setTime(Date.now())
        console.log('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: txn rsp indicate fail', date.toLocaleString())
        fs.appendFileSync(fileName, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: txn rsp indicate fail\n', date.toLocaleString()))
        fs.appendFileSync(fileNameBrief, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: txn rsp indicate fail\n', date.toLocaleString()))
        return false
      }
    } else {
      var coin_b_surplus = wallet_balance_of_coin_b.sub(coinAmounts.coinB)
      var coin_b_swap_need = otherSideAmountLimit.add(wallet_balance_buffer_of_coin_b.sub(deviation_in_coin_b))
      date.setTime(Date.now())
      console.log('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: Insufficient coin B balance to swap:', date.toLocaleString())
      console.log('\t\t coin_b_surplus : %s < coin_b_swap_need : %s (coinB limit : %s + minBuffer : %s)', coin_b_surplus.toString(), coin_b_swap_need.toString(), 
      otherSideAmountLimit.toString(), wallet_balance_buffer_of_coin_b.sub(deviation_in_coin_b).toString())

      fs.appendFileSync(fileName, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: Insufficient coin b balance to swap:\n', date.toLocaleString()))
      fs.appendFileSync(fileName, util.format('\t\t coin_b_surplus : %s < coin_b_swap_need : %s (coinB limit : %s + minBuffer : %s)\n', coin_b_surplus.toString(), coin_b_swap_need.toString(), 
      otherSideAmountLimit.toString(), wallet_balance_buffer_of_coin_b.sub(deviation_in_coin_b).toString()))

      fs.appendFileSync(fileNameBrief, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: Insufficient coin b balance to swap:\n', date.toLocaleString()))
      fs.appendFileSync(fileNameBrief, util.format('\t\t coin_b_surplus : %s < coin_b_swap_need : %s (coinB limit : %s + minBuffer : %s)\n', coin_b_surplus.toString(), coin_b_swap_need.toString(), 
      otherSideAmountLimit.toString(), wallet_balance_buffer_of_coin_b.sub(deviation_in_coin_b).toString()))
      return false
    }
  } else if (wallet_balance_of_coin_a.gte(coinAmounts.coinA.add(wallet_balance_buffer_of_coin_a.sub(deviation_in_coin_a))) 
        && wallet_balance_of_coin_b.lt(coinAmounts.coinB.add(wallet_balance_buffer_of_coin_b.sub(deviation_in_coin_b))) ) {
      // coinB insufficient, coinA -> coinB

      date.setTime(Date.now())
      console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB insufficient, coinA -> coinB by minimum coinB', date.toLocaleString())
      fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB insufficient, coinA -> coinB by minimum coinB\n', date.toLocaleString()))
      fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB insufficient, coinA -> coinB by minimum coinB\n', date.toLocaleString()))

      const a2b = true
      const amount = coinAmounts.coinB.sub(wallet_balance_of_coin_b.sub(wallet_balance_buffer_of_coin_b))
      const byAmountIn = false
      const swapTicks = await SDK.Pool.fetchTicksByRpc(pool.ticks_handle)

      const res = SDK.Swap.calculateRates({
        decimalsA: coin_a_decimals,
        decimalsB: coin_b_decimals,
        a2b,
        byAmountIn,
        amount,
        swapTicks,
        currentPool: pool
      })

      const slippage = Percentage.fromDecimal(d(swapSlippagePercent))
      const otherSideAmount = byAmountIn ? res.estimatedAmountOut : res.estimatedAmountIn
      const otherSideAmountLimit =  adjustForSlippage(otherSideAmount.clone(), slippage, !byAmountIn)


      date.setTime(Date.now())
      console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB to receive: %s(%d)', date.toLocaleString(), amount.toString(), 
              d(amount.toString()).div(Decimal.pow(10, coin_b_decimals)).toNumber())
      console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA est to send: %s(%d)', date.toLocaleString(), res.estimatedAmountIn.toString(), 
              d(res.estimatedAmountIn.toString()).div(Decimal.pow(10, coin_a_decimals)).toNumber())
      console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA limit to send: %s(%d)(+ %d%% slippage)', date.toLocaleString(), otherSideAmountLimit.toString(),
              d(otherSideAmountLimit.toString()).div(Decimal.pow(10, coin_a_decimals)).toNumber(),
              d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100))

      fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB to receive: %s(%d)\n', date.toLocaleString(), amount.toString(), 
              d(amount.toString()).div(Decimal.pow(10, coin_b_decimals)).toNumber()))
      fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA est to send: %s(%d)\n', date.toLocaleString(), res.estimatedAmountIn.toString(), 
              d(res.estimatedAmountIn.toString()).div(Decimal.pow(10, coin_a_decimals)).toNumber()))
      fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA limit to send: %s(%d)(+ %d%% slippage)\n', date.toLocaleString(), otherSideAmountLimit.toString(),
              d(otherSideAmountLimit.toString()).div(Decimal.pow(10, coin_a_decimals)).toNumber(),
              d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100)))

      fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinB to receive: %s(%d)\n', date.toLocaleString(), amount.toString(), 
              d(amount.toString()).div(Decimal.pow(10, coin_b_decimals)).toNumber()))
      fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA est to send: %s(%d)\n', date.toLocaleString(), res.estimatedAmountIn.toString(), 
              d(res.estimatedAmountIn.toString()).div(Decimal.pow(10, coin_a_decimals)).toNumber()))
      fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coinA limit to send: %s(%d)(+ %d%% slippage)\n', date.toLocaleString(), otherSideAmountLimit.toString(),
              d(otherSideAmountLimit.toString()).div(Decimal.pow(10, coin_a_decimals)).toNumber(),
              d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100)))                        

      // var coin_b_price = d(res.estimatedAmountIn.toNumber() / amount.toNumber()).mul(Decimal.pow(10, coin_b_decimals - coin_a_decimals))
      // var coin_b_price_in_pool = d(1).div(TickMath.sqrtPriceX64ToPrice(new BN(pool.current_sqrt_price), coin_a_decimals, coin_b_decimals))
      // var amt = d(amount.toString()).div(Decimal.pow(10, coin_b_decimals))
      // console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price : \$%d', date.toLocaleString(), coin_b_price)
      // console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price_in_pool : \$%d', date.toLocaleString(), coin_b_price_in_pool)
      // console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: buy est value benifit : \$%d', date.toLocaleString(), coin_b_price_in_pool.sub(coin_b_price).mul(amt))

      // fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price : \$%d\n', date.toLocaleString(), coin_b_price))
      // fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price_in_pool : \$%d\n', date.toLocaleString(), coin_b_price_in_pool))
      // fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: buy est value benifit : \$%d\n', date.toLocaleString(), coin_b_price_in_pool.sub(coin_b_price).mul(amt)))

      // fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price : \$%d\n', date.toLocaleString(), coin_b_price))
      // fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: coin_b_price_in_pool : \$%d\n', date.toLocaleString(), coin_b_price_in_pool))
      // fs.appendFileSync(fileNameBrief, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: buy est value benifit : \$%d\n', date.toLocaleString(), coin_b_price_in_pool.sub(coin_b_price).mul(amt)))

      checkBalanceInfo.situation = 2    
      checkBalanceInfo.estimatedAmountOut = res.estimatedAmountOut
      checkBalanceInfo.estimatedAmountIn = res.estimatedAmountIn
      checkBalanceInfo.estimatedFeeAmount = res.estimatedFeeAmount
      checkBalanceInfo.amount = amount
      checkBalanceInfo.byAmountIn = byAmountIn
      checkBalanceInfo.amountLimit = otherSideAmountLimit


    if (wallet_balance_of_coin_a.sub(coinAmounts.coinA).gte(otherSideAmountLimit.add(wallet_balance_buffer_of_coin_a.sub(deviation_in_coin_a)))) {
      const swapPayload = await SDK.Swap.createSwapTransactionPayload(
        {
          pool_id: pool.poolAddress,
          coinTypeA: pool.coinTypeA,
          coinTypeB: pool.coinTypeB,
          a2b: a2b,
          by_amount_in: byAmountIn,
          amount: res.amount.toString(),
          amount_limit: otherSideAmountLimit.toString()
        }
      )
      date.setTime(Date.now())
      console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: createSwapTransactionPayload:\n%s',  date.toLocaleString(), swapPayload.toJSON())
      fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: createSwapTransactionPayload:\n%s\n',  date.toLocaleString(), swapPayload.toJSON()))

      // console.log('%s [test] rebalanceCoinAAndCoinBByMinimumBoth: createSwapTransactionPayload:\n%s',  date.toLocaleString(), util.inspect(swapPayload, true))

      const transferTxn = await SDK.fullClient.sendTransaction(sendKeypair, swapPayload)

      var json_str = JSON.stringify(transferTxn, null, '\t')
      date.setTime(Date.now())
      console.log('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: swap transferTxn:\n%s',  date.toLocaleString(), json_str)
      fs.appendFileSync(fileName, util.format('%s [info] rebalanceCoinAAndCoinBByMinimumBoth: swap transferTxn:\n%s\n',  date.toLocaleString(), json_str))

      if (transferTxn?.effects?.status.status == 'success') {
        return true
      } else {
        date.setTime(Date.now())
        console.log('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: txn rsp indicate fail', date.toLocaleString())
        fs.appendFileSync(fileName, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: txn rsp indicate fail\n', date.toLocaleString()))
        fs.appendFileSync(fileNameBrief, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: txn rsp indicate fail\n', date.toLocaleString()))
        return false
      }
    } else {
      var coin_a_surplus = wallet_balance_of_coin_a.sub(coinAmounts.coinA)
      var coin_a_swap_need = otherSideAmountLimit.add(wallet_balance_buffer_of_coin_a.sub(deviation_in_coin_a))
      date.setTime(Date.now())
      console.log('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: Insufficient coin a balance to swap:', date.toLocaleString())
      console.log('\t\t coin_a_surplus : %s < coin_a_swap_need : %s (coinA limit : %s + minBuffer : %s)', coin_a_surplus.toString(), coin_a_swap_need.toString(), 
        otherSideAmountLimit.toString(), wallet_balance_buffer_of_coin_a.sub(deviation_in_coin_a).toString())

      fs.appendFileSync(fileName, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: Insufficient coin a balance to swap:\n', date.toLocaleString()))
      fs.appendFileSync(fileName, util.format('\t\t coin_a_surplus : %s < coin_a_swap_need : %s (coinA limit : %s + minBuffer : %s)\n', coin_a_surplus.toString(), coin_a_swap_need.toString(), 
        otherSideAmountLimit.toString(), wallet_balance_buffer_of_coin_a.sub(deviation_in_coin_a).toString()))

      fs.appendFileSync(fileNameBrief, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: Insufficient coin a balance to swap:\n', date.toLocaleString()))
      fs.appendFileSync(fileNameBrief, util.format('\t\t coin_a_surplus : %s < coin_a_swap_need : %s (coinA limit : %s + minBuffer : %s)\n', coin_a_surplus.toString(), coin_a_swap_need.toString(), 
        otherSideAmountLimit.toString(), wallet_balance_buffer_of_coin_a.sub(deviation_in_coin_a).toString()))
      return false
    }
  } else {
    checkBalanceInfo.situation = 3
    date.setTime(Date.now())
    console.log('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: Insufficient coin a and coin b balance to swap',  date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: Insufficient coin a and coin b balance to swap\n',  date.toLocaleString()))
    fs.appendFileSync(fileNameBrief, util.format('%s [error] rebalanceCoinAAndCoinBByMinimumBoth: Insufficient coin a and coin b balance to swap\n',  date.toLocaleString()))
    return false
  }
  return false
}

































function dumpCurPoolInfo(main_pool: Pool, cur_position_tick_index: number, cur_position_tick_index_high_bounder:number) {
  var coin_a_price_from_tick = TickMath.tickIndexToPrice(main_pool.current_tick_index, coin_a_decimals, coin_b_decimals).toFixed(10)
  var coin_a_price_from_sqrt = TickMath.sqrtPriceX64ToPrice(new BN(main_pool.current_sqrt_price), coin_a_decimals, coin_b_decimals).toFixed(10)
  var coin_b_price_from_tick = d(1).div(TickMath.tickIndexToPrice(main_pool.current_tick_index, coin_a_decimals, coin_b_decimals)).toFixed(10)
  var coin_b_price_from_sqrt = d(1).div(TickMath.sqrtPriceX64ToPrice(new BN(main_pool.current_sqrt_price), coin_a_decimals, coin_b_decimals)).toFixed(10)

  date.setTime(Date.now())
  console.log(' - ')
  console.log('%s [info] -- cur pool info --', date.toLocaleString())
  console.log('pos in pool : %d - (%d) - %d', cur_position_tick_index, 
    main_pool.current_tick_index, cur_position_tick_index_high_bounder)
  console.log('current_tick_index : %d, coin_a_price_from_tick : %s, coin_b_price_from_tick: %s', main_pool.current_tick_index, 
    coin_a_price_from_tick, coin_b_price_from_tick)
  console.log('current_sqrt_price : %s, coin_a_price_from_sqrt : %s, coin_b_price_from_sqrt: %s', main_pool.current_sqrt_price.toString(), 
    coin_a_price_from_sqrt, coin_b_price_from_sqrt)
  console.log('%s [info] -- cur pool info end -- ', date.toLocaleString())
  console.log(' - ')
}

function dumpCurPoolInfoToFile(main_pool: Pool, cur_position_tick_index: number, cur_position_tick_index_high_bounder:number) {
  var coin_a_price_from_tick = TickMath.tickIndexToPrice(main_pool.current_tick_index, coin_a_decimals, coin_b_decimals).toFixed(10)
  var coin_a_price_from_sqrt = TickMath.sqrtPriceX64ToPrice(new BN(main_pool.current_sqrt_price), coin_a_decimals, coin_b_decimals).toFixed(10)
  var coin_b_price_from_tick = d(1).div(TickMath.tickIndexToPrice(main_pool.current_tick_index, coin_a_decimals, coin_b_decimals)).toFixed(10)
  var coin_b_price_from_sqrt = d(1).div(TickMath.sqrtPriceX64ToPrice(new BN(main_pool.current_sqrt_price), coin_a_decimals, coin_b_decimals)).toFixed(10)

  date.setTime(Date.now())
  fs.appendFileSync(fileName,' - \n')
  fs.appendFileSync(fileName, util.format('%s [info] -- cur pool info --\n', date.toLocaleString()))
  fs.appendFileSync(fileName, util.format('pos in pool : %d - (%d) - %d\n', cur_position_tick_index, 
    main_pool.current_tick_index, cur_position_tick_index_high_bounder))
  fs.appendFileSync(fileName, util.format('current_tick_index : %d, coin_a_price_from_tick : %s, coin_b_price_from_tick: %s\n', main_pool.current_tick_index, 
    coin_a_price_from_tick, coin_b_price_from_tick))
  fs.appendFileSync(fileName, util.format('current_sqrt_price : %s, coin_a_price_from_sqrt : %s, coin_b_price_from_sqrt: %s\n', main_pool.current_sqrt_price.toString(), 
    coin_a_price_from_sqrt, coin_b_price_from_sqrt))
  fs.appendFileSync(fileName, util.format('%s [info] -- cur pool info end -- \n', date.toLocaleString()))
  fs.appendFileSync(fileName,' - \n')
}




function dumpOpenedPositionInfo (cur_position_tick_index: number, opened_position_lower_tick_array: Array<number>, position_info_map:Map<number, PositionInfo>) {
  date.setTime(Date.now())
  console.log(' - ')
  console.log('%s [info] -- opened position info -- ', date.toLocaleString())
  for (var i = 0; i < opened_position_lower_tick_array.length; i++) {
    if (position_info_map.has(opened_position_lower_tick_array[i])) {
      var pos = position_info_map.get(opened_position_lower_tick_array[i])!
      console.log('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d), liquidity : %s, position_opened : %d %s', 
                      pos.tick_lower_index, pos.tick_upper_index, 
                      pos.tick_lower_coin_a_price.toFixed(4), pos.tick_upper_coin_a_price.toFixed(4),
                      pos.tick_upper_coin_b_price.toFixed(4), pos.tick_lower_coin_b_price.toFixed(4),
                      pos.liquidity.toString(), pos.position_opened, (pos.tick_lower_index == cur_position_tick_index)? '(- active -)': '')

    } else {
      console.log('tick_lower_index %d entry not exist in position_info_map.', opened_position_lower_tick_array[i])
    }
  }
  console.log('%s [info] -- opened position info end -- ', date.toLocaleString())
  console.log(' - ')
}

function dumpOpenedPositionInfoToFile (cur_position_tick_index: number, opened_position_lower_tick_array:Array<number>, position_info_map:Map<number, PositionInfo>) {
  date.setTime(Date.now())
  fs.appendFileSync(fileName,' - \n')
  fs.appendFileSync(fileName, util.format('%s [info] -- opened position info -- \n', date.toLocaleString()))    
  for (var i = 0; i < opened_position_lower_tick_array.length; i++) {
    if (position_info_map.has(opened_position_lower_tick_array[i])) {
      var pos = position_info_map.get(opened_position_lower_tick_array[i])!
      fs.appendFileSync(fileName, util.format('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d), liquidity : %s, position_opened : %d %s\n', 
                      pos.tick_lower_index, pos.tick_upper_index, 
                      pos.tick_lower_coin_a_price.toFixed(4), pos.tick_upper_coin_a_price.toFixed(4),
                      pos.tick_upper_coin_b_price.toFixed(4), pos.tick_lower_coin_b_price.toFixed(4),
                      pos.liquidity.toString(), pos.position_opened, (pos.tick_lower_index == cur_position_tick_index)? '(- active -)': ''))

    } else {
      fs.appendFileSync(fileName, util.format('tick_lower_index %d entry not exist in position_info_map.\n', opened_position_lower_tick_array[i]))  
    }
  }
  fs.appendFileSync(fileName, util.format('%s [info] -- opened position info end -- \n', date.toLocaleString()))
  fs.appendFileSync(fileName,' - \n')
}



function dumpAllPositionShortInfo (cur_position_tick_index: number, position_info_map:Map<number, PositionInfo>) {
  date.setTime(Date.now())
  console.log(' - ')
  console.log('%s [info] -- all position short info -- ', date.toLocaleString())
  var position_info_map_index: number[] = []
  // var opened_idx = 0
  for (const [key, value] of position_info_map.entries()) {
    position_info_map_index.push(key)
    // if (value.position_opened) {
    //   opened_idx = key
    // }
  }
  position_info_map_index.sort()
  // var opened_idx_in_array = position_info_map_index.indexOf(opened_idx)
  // var upper_bound_idx = opened_idx_in_array + 3
  // var lower_bound_idx = opened_idx_in_array - 3
  // var position_info_map_index_rst: number[] = []
  // if (opened_idx_in_array != -1 && position_info_map_index.length > 7) {
  //   while ((upper_bound_idx > position_info_map_index.length - 1) || (lower_bound_idx < 0)) {
  //     if (upper_bound_idx > position_info_map_index.length - 1) {
  //       upper_bound_idx--
  //       lower_bound_idx--
  //     }
  //     if (lower_bound_idx < 0) {
  //       upper_bound_idx++
  //       lower_bound_idx++
  //     }
  //   }
  //   position_info_map_index_rst = position_info_map_index.slice(lower_bound_idx, upper_bound_idx)
  // } else {
  //   position_info_map_index_rst = [...position_info_map_index]
  // }

  for(var i = 0; i < position_info_map_index.length; i++) {
    var pos = position_info_map.get(position_info_map_index[i])!
    console.log('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d), liquidity : %s, position_opened : %d %s', 
                      pos.tick_lower_index, pos.tick_upper_index, 
                      pos.tick_lower_coin_a_price.toFixed(4), pos.tick_upper_coin_a_price.toFixed(4),
                      pos.tick_upper_coin_b_price.toFixed(4), pos.tick_lower_coin_b_price.toFixed(4),
                      pos.liquidity.toString(), pos.position_opened, (pos.tick_lower_index == cur_position_tick_index)? '(- active -)': '')
  }
  console.log('%s [info] -- all position short info end -- ', date.toLocaleString())
  console.log(' - ')
}

function dumpAllPositionShortInfoToFile (cur_position_tick_index: number, position_info_map:Map<number, PositionInfo>) {
  date.setTime(Date.now())
  fs.appendFileSync(fileName,' - \n')
  fs.appendFileSync(fileName, util.format('%s [info] -- all position short info -- \n', date.toLocaleString()))  
  var position_info_map_index: number[] = []
  // var opened_idx = 0
  for (const [key, value] of position_info_map.entries()) {
    position_info_map_index.push(key)
    // if (value.position_opened) {
    //   opened_idx = key
    // }
  }
  position_info_map_index.sort()
  // var opened_idx_in_array = position_info_map_index.indexOf(opened_idx)
  // var upper_bound_idx = opened_idx_in_array + 3
  // var lower_bound_idx = opened_idx_in_array - 3
  // var position_info_map_index_rst: number[] = []
  // if (opened_idx_in_array != -1 && position_info_map_index.length > 7) {
  //   while ((upper_bound_idx > position_info_map_index.length - 1) || (lower_bound_idx < 0)) {
  //     if (upper_bound_idx > position_info_map_index.length - 1) {
  //       upper_bound_idx--
  //       lower_bound_idx--
  //     }
  //     if (lower_bound_idx < 0) {
  //       upper_bound_idx++
  //       lower_bound_idx++
  //     }
  //   }
  //   position_info_map_index_rst = position_info_map_index.slice(lower_bound_idx, upper_bound_idx)
  // } else {
  //   position_info_map_index_rst = [...position_info_map_index]
  // }
  for(var i = 0; i < position_info_map_index.length; i++) {
    var pos = position_info_map.get(position_info_map_index[i])!
    fs.appendFileSync(fileName, util.format('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d), liquidity : %s, position_opened : %d %s\n', 
                      pos.tick_lower_index, pos.tick_upper_index, 
                      pos.tick_lower_coin_a_price.toFixed(4), pos.tick_upper_coin_a_price.toFixed(4),
                      pos.tick_upper_coin_b_price.toFixed(4), pos.tick_lower_coin_b_price.toFixed(4),
                      pos.liquidity.toString(), pos.position_opened, (pos.tick_lower_index == cur_position_tick_index)? '(- active -)': ''))
  }
  fs.appendFileSync(fileName, util.format('%s [info] -- all position short info end -- \n', date.toLocaleString()))
  fs.appendFileSync(fileName,' - \n')
}


function dumpAllPositionInfo (cur_position_tick_index: number, position_info_map:Map<number, PositionInfo>) {
  date.setTime(Date.now())
  console.log(' - ')
  console.log('%s [info]\n -- all position info -- ', date.toLocaleString())
  var position_info_map_index: number[] = []
  for (const [key, value] of position_info_map.entries()) {
    position_info_map_index.push(key)
  }
  position_info_map_index.sort()

  for(var i = 0; i < position_info_map_index.length; i++) {
    var pos = position_info_map.get(position_info_map_index[i])!

    console.log('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d), liquidity : %s %s', 
            pos.tick_lower_index, pos.tick_upper_index,
            pos.tick_lower_coin_a_price.toFixed(4), pos.tick_upper_coin_a_price.toFixed(4),
            pos.tick_upper_coin_b_price.toFixed(4), pos.tick_lower_coin_b_price.toFixed(4),
            pos.liquidity.toString(), (pos.tick_lower_index == cur_position_tick_index)? '(- active -)': '')
    console.log('\t pos_object_id : %s', pos.pos_object_id)
    console.log('\t coin_type_a : %s', pos.coin_type_a)
    console.log('\t coin_type_b : %s', pos.coin_type_b)
    console.log('\t lower_bounder_coin_a_amount : %s', pos.lower_bounder_coin_a_amount.toString())
    console.log('\t upper_bounder_coin_b_amount : %s', pos.upper_bounder_coin_b_amount.toString())
    console.log('\t tick_lower_coin_a_price : %d', pos.tick_lower_coin_a_price)
    console.log('\t tick_upper_coin_a_price : %d', pos.tick_upper_coin_a_price)
    console.log('\t tick_lower_coin_b_price : %d', pos.tick_lower_coin_b_price)
    console.log('\t tick_upper_coin_b_price : %d', pos.tick_upper_coin_b_price)
    console.log('\t fee_coin_a_claimed_total: %s',  pos.fee_coin_a_claimed_total.toString())
    console.log('\t fee_coin_b_claimed_total: %s',  pos.fee_coin_b_claimed_total.toString())
    console.log('\t fee_value_in_u_claimed_total: %d',  pos.fee_value_in_u_claimed_total)
    for (const val of pos.reward_amount_claimed_total) {
      if (relative_coin_info.has(val.coin_type)) {
        var rwd_info = relative_coin_info.get(val.coin_type)!
        console.log('\t reward coin: %s, amount: %s', rwd_info.coin_name, val.amount_owed.toString())
      } else {
        console.log('\t reward coin: %s, amount: %s', val.coin_type, val.amount_owed.toString())
      }
    }
    console.log('\t reward_value_in_u_claimed_total: %d',  pos.reward_value_in_u_claimed_total)
    console.log('\t init_tick : %d', pos.init_tick)
    console.log('\t position_opened : %d', pos.position_opened)
    console.log('\t on_position_times : %d', pos.on_position_times)
    console.log('\t short_times_on_base_coin : %d', pos.short_times_on_base_coin)
  }
  console.log('%s [info]\n -- all position info end -- ', date.toLocaleString())
  console.log(' - ')
}

function dumpAllPositionInfoToFile (cur_position_tick_index: number, position_info_map:Map<number, PositionInfo>) {
  date.setTime(Date.now())
  fs.appendFileSync(fileName, ' - \n')
  fs.appendFileSync(fileName, util.format('%s [info]\n -- all position info -- \n', date.toLocaleString()))  
  var position_info_map_index: number[] = []
  for (const [key, value] of position_info_map.entries()) {
    position_info_map_index.push(key)
  }
  position_info_map_index.sort()
  for(var i = 0; i < position_info_map_index.length; i++) {
    var pos = position_info_map.get(position_info_map_index[i])!
    fs.appendFileSync(fileName, util.format('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d), liquidity : %s %s\n', 
            pos.tick_lower_index, pos.tick_upper_index,
            pos.tick_lower_coin_a_price.toFixed(4), pos.tick_upper_coin_a_price.toFixed(4),
            pos.tick_upper_coin_b_price.toFixed(4), pos.tick_lower_coin_b_price.toFixed(4),
            pos.liquidity.toString(), (pos.tick_lower_index == cur_position_tick_index)? '(- active -)': ''))
    fs.appendFileSync(fileName, util.format('\t pos_object_id : %s\n', pos.pos_object_id))
    fs.appendFileSync(fileName, util.format('\t coin_type_a : %s\n', pos.coin_type_a))
    fs.appendFileSync(fileName, util.format('\t coin_type_b : %s\n', pos.coin_type_b))
    fs.appendFileSync(fileName, util.format('\t lower_bounder_coin_a_amount : %d\n', pos.lower_bounder_coin_a_amount.toString()))
    fs.appendFileSync(fileName, util.format('\t upper_bounder_coin_b_amount : %d\n', pos.upper_bounder_coin_b_amount.toString()))
    fs.appendFileSync(fileName, util.format('\t tick_lower_coin_a_price : %d\n', pos.tick_lower_coin_a_price))
    fs.appendFileSync(fileName, util.format('\t tick_upper_coin_a_price : %d\n', pos.tick_upper_coin_a_price))
    fs.appendFileSync(fileName, util.format('\t tick_lower_coin_b_price : %d\n', pos.tick_lower_coin_b_price))
    fs.appendFileSync(fileName, util.format('\t tick_upper_coin_b_price : %d\n', pos.tick_upper_coin_b_price))
    fs.appendFileSync(fileName, util.format('\t fee_coin_a_claimed_total: %s\n',  pos.fee_coin_a_claimed_total.toString()))
    fs.appendFileSync(fileName, util.format('\t fee_coin_b_claimed_total: %s\n',  pos.fee_coin_b_claimed_total.toString()))
    fs.appendFileSync(fileName, util.format('\t fee_value_in_u_claimed_total: %d\n',  pos.fee_value_in_u_claimed_total))
    for (const val of pos.reward_amount_claimed_total) {
      if (relative_coin_info.has(val.coin_type)) {
        var rwd_info = relative_coin_info.get(val.coin_type)!
        fs.appendFileSync(fileName, util.format('\t reward coin: %s, amount: %s\n', rwd_info.coin_name, val.amount_owed.toString()))
      } else {
        fs.appendFileSync(fileName, util.format('\t reward coin: %s, amount: %s\n', val.coin_type, val.amount_owed.toString()))
      }
    }
    fs.appendFileSync(fileName, util.format('\t reward_value_in_u_claimed_total: %d\n',  pos.reward_value_in_u_claimed_total))

    fs.appendFileSync(fileName, util.format('\t init_tick : %d\n', pos.init_tick))
    fs.appendFileSync(fileName, util.format('\t position_opened : %d\n', pos.position_opened))
    fs.appendFileSync(fileName, util.format('\t on_position_times : %d\n', pos.on_position_times))
    fs.appendFileSync(fileName, util.format('\t short_times_on_base_coin : %d\n', pos.short_times_on_base_coin))
  }
  fs.appendFileSync(fileName, util.format('%s [info]\n -- all position info end -- \n', date.toLocaleString()))
  fs.appendFileSync(fileName,' - \n')
}


















type PositionCoinAmountAndValueInU = {
  coin_a_amount: BN;
  coin_b_amount: BN;
  total_coin_value_in_u: number;
  fee_coin_a_amount: BN;
  fee_coin_b_amount: BN;
  total_fee_value_in_u: number;
  reward_amount: Map<COIN_TYPE, BN>;
  total_reward_value_in_u: number;
};

type CoinValueCalc = {
  amount_owed: BN;
  price_in_u: number;
  value_in_u: number;
}

function calcValueInU(coin_list_for_u_value: Map<COIN_TYPE, CoinValueCalc>, pool_map: Map<string, Pool>, tag: string): number {
  var total_value_in_u: Decimal = d(0)
  for (const [coin_type, coin_to_calc] of coin_list_for_u_value) {
    if (relative_coin_info.has(coin_type)) {
      var coin_to_calc_info = relative_coin_info.get(coin_type)!

      var value_final: Decimal = d(coin_to_calc.amount_owed.toNumber()).div(Decimal.pow(10, coin_to_calc_info.coin_decimals)) // src coin amount
      var price_final: Decimal = d(1)
      var calc_success = true
      // calc value in u via chain of pools
      for (const pool_info of coin_to_calc_info.coin_swap_path_to_u) {
        if (pool_map.has(pool_info.pool_address)) {
          var pool_handle = pool_map.get(pool_info.pool_address)!
          if (pool_info.a2b) {
            var price = TickMath.sqrtPriceX64ToPrice(new BN(pool_handle.current_sqrt_price), pool_info.decimals_a, pool_info.decimals_b)
            value_final = price.mul(value_final)
            price_final = price.mul(price_final)
          } else {
            var price = d(1).div(TickMath.sqrtPriceX64ToPrice(new BN(pool_handle.current_sqrt_price), pool_info.decimals_a, pool_info.decimals_b))
            value_final = price.mul(value_final)
            price_final = price.mul(price_final)
          }
        } else {
          console.log('%s [warning] calcValueInU %s: coin: %s has no pool handle.', date.toLocaleString(), tag, coin_to_calc_info.coin_name)
          fs.appendFileSync(fileName, util.format('%s [warning] calcValueInU %s: coin: %s has no pool handle.\n', date.toLocaleString(), tag, coin_to_calc_info.coin_name))
          fs.appendFileSync(fileNameBrief, util.format('%s [warning] calcValueInU %s: coin: %s has no pool handle.\n', date.toLocaleString(), tag, coin_to_calc_info.coin_name))
          calc_success = false
          break
        }
      }
      if (calc_success) {
        coin_to_calc.value_in_u = value_final.toNumber()
        total_value_in_u = total_value_in_u.add(value_final)
      }
    } else {
      console.log('%s [warning] calcValueInU %s: unrecognized coin: %d, do not calc value', date.toLocaleString(), tag, coin_type)
      fs.appendFileSync(fileName, util.format('%s [warning] calcValueInU %s: unrecognized coin: %d, do not calc value\n', date.toLocaleString(), tag, coin_type))
      fs.appendFileSync(fileNameBrief, util.format('%s [warning] calcValueInU %s: unrecognized coin: %d, do not calc value\n', date.toLocaleString(), tag, coin_type))
    }
  }
  return total_value_in_u.toNumber()
}





// TODO: order by index if need
async function statisticValuesInWUSDCPeriodicity(main_pool: Pool, position_list: Position[], cur_position_tick_index: number, 
                                      position_info_map: Map<number, PositionInfo>, wallet_coin_balance: CoinBalance[]) {

  var calc_cur_price_value_for_claimed_fee_rwd = true

  var pos_map = new Map<number, Position>()

  // retrieve fee and reward info in position
  const posRewardParamsList: FetchPosRewardParams[] = []
  const posFeeParamsList: FetchPosFeeParams[] = []
  for (const pos of position_list) {
    posRewardParamsList.push({
      poolAddress: main_pool.poolAddress,
      positionId: pos.pos_object_id,
      coinTypeA: main_pool.coinTypeA,
      coinTypeB: main_pool.coinTypeB,
      rewarderInfo: main_pool.rewarder_infos,
    })

    posFeeParamsList.push({
      poolAddress: main_pool.poolAddress,
      positionId: pos.pos_object_id,
      coinTypeA: main_pool.coinTypeA,
      coinTypeB: main_pool.coinTypeB,
    })

    pos_map.set(pos.tick_lower_index, pos)
  }


  const positionRewardMap = new Map<string, RewarderAmountOwed[]>()
  if (posRewardParamsList.length > 0) {
    const result: PosRewarderResult[] = await SDK.Rewarder.fetchPosRewardersAmount(posRewardParamsList)
    for (const posRewarderInfo of result) {
      positionRewardMap.set(posRewarderInfo.positionId, posRewarderInfo.rewarderAmountOwed)
    }
  }

  const positionFeeMap = new Map<string, CollectFeesQuote>()
  if (posFeeParamsList.length > 0) {
    const result: CollectFeesQuote[] = await SDK.Rewarder.fetchPosFeeAmount(posFeeParamsList)
    for (const posRewarderInfo of result) {
      positionFeeMap.set(posRewarderInfo.position_id, posRewarderInfo)
    }
  }



  // get all pool may need in relative coin info
  var pool_map = new Map<string, Pool>()
  pool_map.set(main_pool_address, main_pool)

  for (const [key, value] of relative_coin_info) {
    for(const pool_info of value.coin_swap_path_to_u) {
      if (!pool_map.has(pool_info.pool_address)) {
        var pool = await SDK.Pool.getPool(pool_info.pool_address);
        pool_map.set(pool_info.pool_address, pool)
      }
    }
  }







  // calc coin amount and value_in_u of the position, and total amount and value of all position
  var coins_amount_and_value_in_u_in_position = new Map<number, PositionCoinAmountAndValueInU>()

  var coins_amount_and_value_in_u_in_all_position_total: PositionCoinAmountAndValueInU = {
    coin_a_amount: new BN(0),
    coin_b_amount: new BN(0),
    total_coin_value_in_u: 0,
    fee_coin_a_amount: new BN(0),
    fee_coin_b_amount: new BN(0),
    total_fee_value_in_u: 0,
    reward_amount: new Map<COIN_TYPE, BN>(),
    total_reward_value_in_u: 0
  }

  for (const [key, value] of pos_map.entries()) {
    var position_fee = positionFeeMap.get(value.pos_object_id)!
    var position_reward = positionRewardMap.get(value.pos_object_id)!

    var fee_coin_map = new Map<COIN_TYPE, CoinValueCalc>()
    fee_coin_map.set(coin_a_type, {amount_owed: position_fee.feeOwedA.clone(), price_in_u: 1, value_in_u: 0})
    fee_coin_map.set(coin_b_type, {amount_owed: position_fee.feeOwedB.clone(), price_in_u: 1, value_in_u: 0})
    var fee_value_in_u_total = calcValueInU(fee_coin_map, pool_map, 'fee')


    var reward_coin_map = new Map<COIN_TYPE, CoinValueCalc>()
    for (const rwd of position_reward) {
      var coin_type = getCoinTypeEnum(rwd.coin_address)
      if (relative_coin_info.has(coin_type)) {
        reward_coin_map.set(coin_type, {amount_owed: rwd.amount_owed.clone(), price_in_u: 1, value_in_u: 0})
      } else {
        console.log('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in reward: %s', date.toLocaleString(), rwd.coin_address)
        fs.appendFileSync(fileName, util.format('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in reward: %s', date.toLocaleString(), rwd.coin_address))
        fs.appendFileSync(fileNameBrief, util.format('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in reward: %s', date.toLocaleString(), rwd.coin_address))
      }      
    }
    var reward_value_in_u_total = calcValueInU(reward_coin_map, pool_map, 'reward')


    const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(new BN(value.liquidity), new BN(main_pool.current_sqrt_price), 
                                          TickMath.tickIndexToSqrtPriceX64(value.tick_lower_index), 
                                          TickMath.tickIndexToSqrtPriceX64(value.tick_upper_index), true)
    var position_coin_map = new Map<COIN_TYPE, CoinValueCalc>()
    position_coin_map.set(coin_a_type, {amount_owed: coinAmounts.coinA.clone(), price_in_u: 1, value_in_u: 0})
    position_coin_map.set(coin_b_type, {amount_owed: coinAmounts.coinB.clone(), price_in_u: 1, value_in_u: 0})
    var position_value_in_u_total = calcValueInU(position_coin_map, pool_map, 'pos')


    coins_amount_and_value_in_u_in_position.set(key, {
      coin_a_amount: new BN(coinAmounts.coinA),
      coin_b_amount: new BN(coinAmounts.coinB),
      total_coin_value_in_u: position_value_in_u_total,
      fee_coin_a_amount: new BN(position_fee.feeOwedA),
      fee_coin_b_amount: new BN(position_fee.feeOwedB),
      total_fee_value_in_u: fee_value_in_u_total,
      reward_amount: new Map<COIN_TYPE, BN>(),
      total_reward_value_in_u: reward_value_in_u_total
    })

    var pos_coin_amt_ref = coins_amount_and_value_in_u_in_position.get(key)!
    for (const [key, value] of reward_coin_map.entries()) {
      pos_coin_amt_ref.reward_amount.set(key, value.amount_owed.clone())
    }    


    coins_amount_and_value_in_u_in_all_position_total.coin_a_amount.iadd(coinAmounts.coinA)
    coins_amount_and_value_in_u_in_all_position_total.coin_b_amount.iadd(coinAmounts.coinB)
    coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u += position_value_in_u_total
    coins_amount_and_value_in_u_in_all_position_total.fee_coin_a_amount.iadd(position_fee.feeOwedA)
    coins_amount_and_value_in_u_in_all_position_total.fee_coin_b_amount.iadd(position_fee.feeOwedB)    
    coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u += fee_value_in_u_total
    var rwd_handle = coins_amount_and_value_in_u_in_all_position_total.reward_amount
    for(const [key, value] of reward_coin_map.entries()) {
      if (rwd_handle.has(key)) {
        rwd_handle.get(key)!.iadd(value.amount_owed)
      } else {
        rwd_handle.set(key, value.amount_owed.clone())
      }
    }
    coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u += reward_value_in_u_total
  }
  


  // calc wallet relative coin amount and value in u
  var wallet_balance_map = new Map<COIN_TYPE, BN>()
  for (const [key, value] of relative_coin_info) {
    wallet_balance_map.set(key, new BN(0))
  }

  for (const coin_balance of wallet_coin_balance) {
    var coin_type = getCoinTypeEnum(coin_balance.coinType)
    if (relative_coin_info.has(coin_type)) {
      wallet_balance_map.get(coin_type)!.iadd(new BN(coin_balance.totalBalance))
    }
  }

  var wallet_coin_map = new Map<COIN_TYPE, CoinValueCalc>()
  for (const [key, value] of wallet_balance_map) {
    wallet_coin_map.set(key, {amount_owed: value.clone(), price_in_u: 1, value_in_u: 0})
  }
  var wallet_value_in_u_total = calcValueInU(wallet_coin_map, pool_map, 'wallet')






  // calc extra info: all claimed fee and reward
  var fee_rwd_amount_and_value_in_u_claimed_total: PositionCoinAmountAndValueInU = {
    coin_a_amount: new BN(0),
    coin_b_amount: new BN(0),
    total_coin_value_in_u: 0,
    fee_coin_a_amount: new BN(0),
    fee_coin_b_amount: new BN(0),
    total_fee_value_in_u: 0,
    reward_amount: new Map<COIN_TYPE, BN>(),
    total_reward_value_in_u: 0
  }

  for (const [key, value] of position_info_map.entries()) {
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_a_amount.iadd(value.fee_coin_a_claimed_total)
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_b_amount.iadd(value.fee_coin_b_claimed_total)
    fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u += value.fee_value_in_u_claimed_total
    var rwd_handle = fee_rwd_amount_and_value_in_u_claimed_total.reward_amount
    for(const rwd of value.reward_amount_claimed_total) {
      if (rwd_handle.has(rwd.coin_type)) {
        rwd_handle.get(rwd.coin_type)!.iadd(rwd.amount_owed)
      } else {
        rwd_handle.set(rwd.coin_type, rwd.amount_owed.clone())
      }
    }
    fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u += value.reward_value_in_u_claimed_total
  }
  if (calc_cur_price_value_for_claimed_fee_rwd) {
    // get cur price of claimed coin
    var fee_coin_map_claimed = new Map<COIN_TYPE, CoinValueCalc>()
    fee_coin_map_claimed.set(coin_a_type, {amount_owed: fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_a_amount.clone(), price_in_u: 1, value_in_u: 0})
    fee_coin_map_claimed.set(coin_b_type, {amount_owed: fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_b_amount.clone(), price_in_u: 1, value_in_u: 0})
    fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u = calcValueInU(fee_coin_map_claimed, pool_map, 'fee')

    var reward_coin_map_claimed = new Map<COIN_TYPE, CoinValueCalc>()
    for (const [key, value] of fee_rwd_amount_and_value_in_u_claimed_total.reward_amount) {
      if (relative_coin_info.has(key)) {
        reward_coin_map_claimed.set(key, {amount_owed: value.clone(), price_in_u: 1, value_in_u: 0})
      } else {
        console.log('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in reward: %d', date.toLocaleString(), key)
        fs.appendFileSync(fileName, util.format('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in reward: %d', date.toLocaleString(),key))
        fs.appendFileSync(fileNameBrief, util.format('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in reward: %d', date.toLocaleString(), key))
      }      
    }
    fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u = calcValueInU(reward_coin_map_claimed, pool_map, 'reward')
  }


  // calc extra info: all claimed + opened pos fee and reward
  var fee_rwd_amount_and_value_in_u_claimed_and_opened_total: PositionCoinAmountAndValueInU = {
    coin_a_amount: new BN(0),
    coin_b_amount: new BN(0),
    total_coin_value_in_u: 0,
    fee_coin_a_amount: new BN(0),
    fee_coin_b_amount: new BN(0),
    total_fee_value_in_u: 0,
    reward_amount: new Map<COIN_TYPE, BN>(),
    total_reward_value_in_u: 0
  }

  fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_a_amount = 
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_a_amount.add(coins_amount_and_value_in_u_in_all_position_total.fee_coin_a_amount)
  fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_b_amount = 
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_b_amount.add(coins_amount_and_value_in_u_in_all_position_total.fee_coin_b_amount)
  fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u = 
    fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u + coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u

  var rwd_handle = fee_rwd_amount_and_value_in_u_claimed_and_opened_total.reward_amount
  for (const [key, value] of fee_rwd_amount_and_value_in_u_claimed_total.reward_amount) {
    if (rwd_handle.has(key)) {
      rwd_handle.get(key)!.iadd(value)
    } else {
      rwd_handle.set(key, value.clone())
    }
  }
  for (const [key, value] of coins_amount_and_value_in_u_in_all_position_total.reward_amount) {
    if (rwd_handle.has(key)) {
      rwd_handle.get(key)!.iadd(value)
    } else {
      rwd_handle.set(key, value.clone())
    }
  }
  fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u = 
    fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u + coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u


  // begin dump  
  date.setTime(Date.now())
  console.log(' - ')
  fs.appendFileSync(fileName, ' - \n')
  fs.appendFileSync(fileNameStatisticsInfo, ' - \n')

  console.log('%s [info] -- statisticValuesInWUSDCPeriodicity: dump --', date.toLocaleString())
  fs.appendFileSync(fileName, util.format('%s [info] -- statisticValuesInWUSDCPeriodicity: dump --\n', date.toLocaleString()))
  fs.appendFileSync(fileNameStatisticsInfo, util.format('%s [info] -- statisticValuesInWUSDCPeriodicity: dump --\n', date.toLocaleString()))



  // dump opened position value
  console.log(' - opened position value - ')
  fs.appendFileSync(fileName, ' - opened position value - \n')
  fs.appendFileSync(fileNameStatisticsInfo, ' - opened position value - \n')

  var position_info_map_index: number[] = []
  for (const [tick, value] of pos_map.entries()) {
    position_info_map_index.push(tick)
  }
  position_info_map_index.sort()

  for (const tick of position_info_map_index) {
    if (pos_map.has(tick)) {
      var val = coins_amount_and_value_in_u_in_position.get(tick)!
      var pos = pos_map.get(tick)!
      var pos_map_val = position_info_map.get(tick)!
      var reward_print: string = ''
      for (const [key, value] of val.reward_amount) {
        reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
      }
      console.log('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d) %s:', pos.tick_lower_index, pos.tick_upper_index, 
        pos_map_val.tick_lower_coin_a_price.toFixed(4), pos_map_val.tick_upper_coin_a_price.toFixed(4),
        pos_map_val.tick_upper_coin_b_price.toFixed(4), pos_map_val.tick_lower_coin_b_price.toFixed(4),
        (pos.tick_lower_index == cur_position_tick_index)? '(- active -)': '')
      console.log('    Liquidity value : \$%d, coin_a_amount : %s, coin_b_amount : %s', 
              val.total_coin_value_in_u, val.coin_a_amount.toString(), val.coin_b_amount.toString())
      console.log('    Fee value : \$%d, fee_coin_a : %s, fee_coin_b_amount : %s', 
              val.total_fee_value_in_u, val.fee_coin_a_amount.toString(), val.fee_coin_b_amount.toString())
      console.log('    Reward value : \$%d, %s', val.total_reward_value_in_u, reward_print)
      console.log('    Total : \$%d',
              val.total_coin_value_in_u + val.total_fee_value_in_u + val.total_reward_value_in_u)

      fs.appendFileSync(fileName, util.format('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d) %s:\n', pos.tick_lower_index, pos.tick_upper_index, 
        pos_map_val.tick_lower_coin_a_price.toFixed(4), pos_map_val.tick_upper_coin_a_price.toFixed(4),
        pos_map_val.tick_upper_coin_b_price.toFixed(4), pos_map_val.tick_lower_coin_b_price.toFixed(4),
        (pos.tick_lower_index == cur_position_tick_index)? '- active -': ''))
      fs.appendFileSync(fileName, util.format('    Liquidity value : \$%d, coin_a_amount : %s, coin_b_amount : %s\n', 
              val.total_coin_value_in_u, val.coin_a_amount.toString(), val.coin_b_amount.toString()))
      fs.appendFileSync(fileName, util.format('    Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
              val.total_fee_value_in_u, val.fee_coin_a_amount.toString(), val.fee_coin_b_amount.toString()))
      fs.appendFileSync(fileName, util.format('    Reward value : \$%d, %s\n', val.total_reward_value_in_u, reward_print))
      fs.appendFileSync(fileName, util.format('    Total : \$%d\n', 
              val.total_coin_value_in_u + val.total_fee_value_in_u + val.total_reward_value_in_u))

      fs.appendFileSync(fileNameStatisticsInfo, util.format('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d) %s:\n', pos.tick_lower_index, pos.tick_upper_index, 
        pos_map_val.tick_lower_coin_a_price.toFixed(4), pos_map_val.tick_upper_coin_a_price.toFixed(4),
        pos_map_val.tick_upper_coin_b_price.toFixed(4), pos_map_val.tick_lower_coin_b_price.toFixed(4),
        (pos.tick_lower_index == cur_position_tick_index)? '- active -': ''))
      fs.appendFileSync(fileNameStatisticsInfo, util.format('    Liquidity value : \$%d, coin_a_amount : %s, coin_b_amount : %s\n', 
              val.total_coin_value_in_u, val.coin_a_amount.toString(), val.coin_b_amount.toString()))
      fs.appendFileSync(fileNameStatisticsInfo, util.format('    Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
              val.total_fee_value_in_u, val.fee_coin_a_amount.toString(), val.fee_coin_b_amount.toString()))
      fs.appendFileSync(fileNameStatisticsInfo, util.format('    Reward value : \$%d, %s\n', val.total_reward_value_in_u, reward_print))
      fs.appendFileSync(fileNameStatisticsInfo, util.format('    Total : \$%d\n', 
              val.total_coin_value_in_u + val.total_fee_value_in_u + val.total_reward_value_in_u))

    }
  }
  // new line
  console.log(' ')
  fs.appendFileSync(fileName, ' \n') 
  fs.appendFileSync(fileNameStatisticsInfo, ' \n') 







  // dump opened position total value
  if (pos_map.size) {
    var reward_print: string = ''
    for (const [key, value] of coins_amount_and_value_in_u_in_all_position_total.reward_amount) {
      reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
    }
    console.log(' - opened position total value - ')
    console.log('All Opened Position Liquidity value : \$%d, coin_a_amount : %s, coin_b_amount : %s', 
      coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u, 
      coins_amount_and_value_in_u_in_all_position_total.coin_a_amount.toString(), 
      coins_amount_and_value_in_u_in_all_position_total.coin_b_amount.toString())
    console.log('All Opened Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s', 
      coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u, 
      coins_amount_and_value_in_u_in_all_position_total.fee_coin_a_amount.toString(), 
      coins_amount_and_value_in_u_in_all_position_total.fee_coin_b_amount.toString())
    console.log('All Opened Position Reward value : \$%d, %s', 
      coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u, reward_print)
    console.log('All Opened Position Total : \$%d',
      coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u + 
      coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u + 
      coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u)
    console.log(' ')

    fs.appendFileSync(fileName, ' - opened position total value - \n')
    fs.appendFileSync(fileName, util.format('All Opened Position Liquidity value : \$%d, coin_a_amount : %s, coin_b_amount : %s\n', 
      coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u, 
      coins_amount_and_value_in_u_in_all_position_total.coin_a_amount.toString(), 
      coins_amount_and_value_in_u_in_all_position_total.coin_b_amount.toString()))
    fs.appendFileSync(fileName, util.format('All Opened Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
      coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u, 
      coins_amount_and_value_in_u_in_all_position_total.fee_coin_a_amount.toString(), 
      coins_amount_and_value_in_u_in_all_position_total.fee_coin_b_amount.toString()))
    fs.appendFileSync(fileName, util.format('All Opened Position Reward value : \$%d, %s\n', 
      coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u, reward_print))
    fs.appendFileSync(fileName, util.format('All Opened Position Total : \$%d\n',
      coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u + 
      coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u + 
      coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u))
    fs.appendFileSync(fileName, ' \n')


    fs.appendFileSync(fileNameStatisticsInfo, ' - opened position total value - \n')
    fs.appendFileSync(fileNameStatisticsInfo, util.format('All Opened Position Liquidity value : \$%d, coin_a_amount : %s, coin_b_amount : %s\n', 
      coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u, 
      coins_amount_and_value_in_u_in_all_position_total.coin_a_amount.toString(), 
      coins_amount_and_value_in_u_in_all_position_total.coin_b_amount.toString()))
    fs.appendFileSync(fileNameStatisticsInfo, util.format('All Opened Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
      coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u, 
      coins_amount_and_value_in_u_in_all_position_total.fee_coin_a_amount.toString(), 
      coins_amount_and_value_in_u_in_all_position_total.fee_coin_b_amount.toString()))
    fs.appendFileSync(fileNameStatisticsInfo, util.format('All Opened Position Reward value : \$%d, %s\n', 
      coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u, reward_print))
    fs.appendFileSync(fileNameStatisticsInfo, util.format('All Opened Position Total : \$%d\n',
      coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u + 
      coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u + 
      coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u))
    fs.appendFileSync(fileNameStatisticsInfo, ' \n')
  }


  // dump current wallet value  
  console.log(' - wallet value - ')
  for (const [key, value] of wallet_coin_map) {
    console.log('Wallet %s : \$%d, amount : %s', 
      relative_coin_info.get(key)?.coin_name,  
      wallet_coin_map.get(key)?.value_in_u, 
      wallet_coin_map.get(key)?.amount_owed.toString())
  }
  console.log('Wallet Total : \$%d', wallet_value_in_u_total)
  console.log(' ')
  

  fs.appendFileSync(fileName, ' - wallet value - \n')
  for (const [key, value] of wallet_coin_map) {
    fs.appendFileSync(fileName, util.format('Wallet %s : \$%d, amount : %s\n', 
      relative_coin_info.get(key)?.coin_name,  
      wallet_coin_map.get(key)?.value_in_u, 
      wallet_coin_map.get(key)?.amount_owed.toString()))
  }
  fs.appendFileSync(fileName, util.format('Wallet Total : \$%d\n', wallet_value_in_u_total))
  fs.appendFileSync(fileName, ' \n')

  fs.appendFileSync(fileNameStatisticsInfo, ' - wallet value - \n')
  for (const [key, value] of wallet_coin_map) {
    fs.appendFileSync(fileNameStatisticsInfo, util.format('Wallet %s : \$%d, amount : %s\n', 
      relative_coin_info.get(key)?.coin_name,  
      wallet_coin_map.get(key)?.value_in_u, 
      wallet_coin_map.get(key)?.amount_owed.toString()))
  }
  fs.appendFileSync(fileNameStatisticsInfo, util.format('Wallet Total : \$%d\n', wallet_value_in_u_total))
  fs.appendFileSync(fileNameStatisticsInfo, ' \n')





  // dump current total value (except history reward and fee)

  var wallet_coin_a_amount: BN = new BN(0)
  var wallet_coin_b_amount: BN = new BN(0)
  for (const [key, value] of wallet_coin_map) {
    if (key == coin_a_type) {
      wallet_coin_a_amount = value.amount_owed.clone()
    } else if (key == coin_b_type) {
      wallet_coin_b_amount = value.amount_owed.clone()
    }
  }
  console.log(' - total value from all source - ')
  console.log('Total : value_in_u: \$%d, coin_a_amount: %s, coin_b_amount: %d', 
      wallet_value_in_u_total
      + coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u
      + coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u 
      + coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u,
      wallet_coin_a_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_a_amount).toString(),
      wallet_coin_b_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_b_amount).toString())
  console.log(' ')

  fs.appendFileSync(fileName, ' - total value from all source - \n')
  fs.appendFileSync(fileName, util.format('Total : \$%d, coin_a_amount: %s, coin_b_amount: %d\n', 
      wallet_value_in_u_total
      + coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u
      + coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u 
      + coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u,
      wallet_coin_a_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_a_amount).toString(),
      wallet_coin_b_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_b_amount).toString()))
  fs.appendFileSync(fileName, ' \n')

  fs.appendFileSync(fileNameStatisticsInfo, ' - total value from all source - \n')
  fs.appendFileSync(fileNameStatisticsInfo, util.format('Total : \$%d, coin_a_amount: %s, coin_b_amount: %d\n', 
      wallet_value_in_u_total
      + coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u
      + coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u 
      + coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u,
      wallet_coin_a_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_a_amount).toString(),
      wallet_coin_b_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_b_amount).toString()))
  fs.appendFileSync(fileNameStatisticsInfo, ' \n')





  // dump position histiry reward and fee value
  var reward_print: string = ''
  for (const [key, value] of fee_rwd_amount_and_value_in_u_claimed_total.reward_amount) {
    reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
  }
  console.log(' - extra info - ')
  console.log('All History Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s', 
    fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u, 
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_a_amount.toString(), 
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_b_amount.toString())
  console.log('All History Position Reward value : \$%d, %s', 
    fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u, reward_print)
  console.log('All History Position Total : \$%d',
    fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u)
  console.log(' ')

  fs.appendFileSync(fileName, ' - extra info - \n')
  fs.appendFileSync(fileName, util.format('All History Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
    fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u,
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_a_amount.toString(), 
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_b_amount.toString()))
  fs.appendFileSync(fileName, util.format('All History Position Reward value : \$%d, %s\n', 
    fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u, reward_print))
  fs.appendFileSync(fileName, util.format('All History Position Total : \$%d\n',
    fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u))
  fs.appendFileSync(fileName, ' \n')

  fs.appendFileSync(fileNameStatisticsInfo, ' - extra info - \n')
  fs.appendFileSync(fileNameStatisticsInfo, util.format('All History Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
    fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u,
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_a_amount.toString(), 
    fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_b_amount.toString()))
  fs.appendFileSync(fileNameStatisticsInfo, util.format('All History Position Reward value : \$%d, %s\n', 
    fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u, reward_print))
  fs.appendFileSync(fileNameStatisticsInfo, util.format('All History Position Total : \$%d\n',
    fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u))
  fs.appendFileSync(fileNameStatisticsInfo, ' \n')

  
  
  
  // dump position histiry + opened reward and fee value
  reward_print = ''
  for (const [key, value] of fee_rwd_amount_and_value_in_u_claimed_and_opened_total.reward_amount) {
    reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
  }
  console.log(' - extra info - ')
  console.log('All History + Opened Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s', 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u, 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_a_amount.toString(), 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_b_amount.toString())
  console.log('All History + Opened Position Reward value : \$%d, %s', 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u, reward_print)
  console.log('All History + Opened Position Total : \$%d',
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u)
  console.log(' ')

  fs.appendFileSync(fileName, ' - extra info - \n')
  fs.appendFileSync(fileName, util.format('All History + Opened Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u, 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_a_amount.toString(),
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_b_amount.toString()))
  fs.appendFileSync(fileName, util.format('All History + Opened Position Reward value : \$%d, %s\n', 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u, reward_print))
  fs.appendFileSync(fileName, util.format('All History + Opened Position Total : \$%d\n',
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u))
  fs.appendFileSync(fileName, ' \n')

  fs.appendFileSync(fileNameStatisticsInfo, ' - extra info - \n')
  fs.appendFileSync(fileNameStatisticsInfo, util.format('All History + Opened Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u, 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_a_amount.toString(),
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_b_amount.toString()))
  fs.appendFileSync(fileNameStatisticsInfo, util.format('All History + Opened Position Reward value : \$%d, %s\n', 
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u, reward_print))
  fs.appendFileSync(fileNameStatisticsInfo, util.format('All History + Opened Position Total : \$%d\n',
    fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u))
  fs.appendFileSync(fileNameStatisticsInfo, ' \n')



    

  console.log('%s [info] -- statisticValuesInWUSDCPeriodicity: dump end -- ', date.toLocaleString())
  fs.appendFileSync(fileName, util.format('%s [info] -- statisticValuesInWUSDCPeriodicity: dump end -- \n', date.toLocaleString()))
  fs.appendFileSync(fileNameStatisticsInfo, util.format('%s [info] -- statisticValuesInWUSDCPeriodicity: dump end -- \n', date.toLocaleString()))

  console.log(' - ')
  fs.appendFileSync(fileName, ' - \n')
  fs.appendFileSync(fileNameStatisticsInfo, ' - \n')
}




















































type PositionCoinAmountAndValueInU2 = {
  coin_a_amount: BN;
  coin_b_amount: BN;
  coin_sum_value_in_u: number;
  coin_sum_value_in_coin_a: number;
  coin_sum_value_in_coin_b: number;
  fee_coin_a_amount: BN;
  fee_coin_b_amount: BN;
  fee_sum_value_in_u: number;
  fee_sum_value_in_coin_a: number;
  fee_sum_value_in_coin_b: number;
  reward_amount: Map<COIN_TYPE, BN>;
  reward_sum_value_in_u: number;
  reward_sum_value_in_coin_a: number;
  reward_sum_value_in_coin_b: number;
  total_coin_amount: Map<COIN_TYPE, BN>;
  total_coin_sum_value_in_u: number;
  total_coin_sum_value_in_coin_a: number;
  total_coin_sum_value_in_coin_b: number;
};

type WalletCoinAmountndValue = {
  coin_amount: BN;
  value_in_u: number;
  value_in_coin_a: number;
  value_in_coin_b: number;
}


type CoinValueCalc2 = {
  amount_owed: BN;
  price_in_u: number;
  value_in_u: number;
}



function calcPriceInU(coin_price_in_u: Map<COIN_TYPE, number>, pool_map: Map<string, Pool>) {
  coin_price_in_u.clear()
  for(const [key, value] of relative_coin_info) {
    var price_final: Decimal = d(1)
    var calc_success = true
    for (const pool_info of value.coin_swap_path_to_u) {
      if (pool_map.has(pool_info.pool_address)) {
        var pool_handle = pool_map.get(pool_info.pool_address)!
        if (pool_info.a2b) {
          var price = TickMath.sqrtPriceX64ToPrice(new BN(pool_handle.current_sqrt_price), pool_info.decimals_a, pool_info.decimals_b)
          price_final = price.mul(price_final)
        } else {
          var price = d(1).div(TickMath.sqrtPriceX64ToPrice(new BN(pool_handle.current_sqrt_price), pool_info.decimals_a, pool_info.decimals_b))
          price_final = price.mul(price_final)
        }
      } else {
        console.log('%s [warning] calcPriceInU: coin: %s has no pool handle.', date.toLocaleString(), value.coin_name)
        fs.appendFileSync(fileName, util.format('%s [warning] calcPriceInU: coin: %s has no pool handle.\n', date.toLocaleString(), value.coin_name))
        fs.appendFileSync(fileNameBrief, util.format('%s [warning] calcPriceInU: coin: %s has no pool handle.\n', date.toLocaleString(), value.coin_name))
        calc_success = false
        break
      }
    }
    if (calc_success) {
      coin_price_in_u.set(key, price_final.toNumber())
    } else {
      coin_price_in_u.set(key, 0)
      console.log('%s [warning] calcPriceInU: coin: %s calc u price failed.', date.toLocaleString(), value.coin_name)
      fs.appendFileSync(fileName, util.format('%s [warning] calcPriceInU: coin: %s calc u price failed.\n', date.toLocaleString(), value.coin_name))
      fs.appendFileSync(fileNameBrief, util.format('%s [warning] calcPriceInU: coin: %s calc u price failed.\n', date.toLocaleString(), value.coin_name))
    }
  }
}





// TODO: order by index if need
async function statisticValuesInWUSDCPeriodicity2(main_pool: Pool, position_list: Position[], cur_position_tick_index: number, 
                                      position_info_map: Map<number, PositionInfo>, wallet_coin_balance: CoinBalance[]) {

  var calc_cur_price_value_for_claimed_fee_rwd = true

  var pos_map = new Map<number, Position>()

  // retrieve fee and reward info in position
  const posRewardParamsList: FetchPosRewardParams[] = []
  const posFeeParamsList: FetchPosFeeParams[] = []
  for (const pos of position_list) {
    posRewardParamsList.push({
      poolAddress: main_pool.poolAddress,
      positionId: pos.pos_object_id,
      coinTypeA: main_pool.coinTypeA,
      coinTypeB: main_pool.coinTypeB,
      rewarderInfo: main_pool.rewarder_infos,
    })

    posFeeParamsList.push({
      poolAddress: main_pool.poolAddress,
      positionId: pos.pos_object_id,
      coinTypeA: main_pool.coinTypeA,
      coinTypeB: main_pool.coinTypeB,
    })

    pos_map.set(pos.tick_lower_index, pos)
  }


  const positionRewardMap = new Map<string, RewarderAmountOwed[]>()
  if (posRewardParamsList.length > 0) {
    const result: PosRewarderResult[] = await SDK.Rewarder.fetchPosRewardersAmount(posRewardParamsList)
    for (const posRewarderInfo of result) {
      positionRewardMap.set(posRewarderInfo.positionId, posRewarderInfo.rewarderAmountOwed)
    }
  }

  const positionFeeMap = new Map<string, CollectFeesQuote>()
  if (posFeeParamsList.length > 0) {
    const result: CollectFeesQuote[] = await SDK.Rewarder.fetchPosFeeAmount(posFeeParamsList)
    for (const posRewarderInfo of result) {
      positionFeeMap.set(posRewarderInfo.position_id, posRewarderInfo)
    }
  }



  // get all pool may need in relative coin info
  var pool_map = new Map<string, Pool>()
  pool_map.set(main_pool_address, main_pool)

  for (const [key, value] of relative_coin_info) {
    for(const pool_info of value.coin_swap_path_to_u) {
      if (!pool_map.has(pool_info.pool_address)) {
        var pool = await SDK.Pool.getPool(pool_info.pool_address);
        pool_map.set(pool_info.pool_address, pool)
      }
    }
  }

  var coin_price_in_u = new Map<COIN_TYPE, number>()
  calcPriceInU(coin_price_in_u, pool_map)
  // TODO: print all price include main pool


  var total_coin_amount_init = new Map<COIN_TYPE, BN>()
  for (const [key, value] of relative_coin_info) {
    total_coin_amount_init.set(key, new BN(0))
  }

  var position_amount_value_info = new Map<number, PositionCoinAmountAndValueInU2>()
  var all_position_amount_value_info: PositionCoinAmountAndValueInU2 = {
    coin_a_amount: new BN(0),
    coin_b_amount: new BN(0),
    coin_sum_value_in_u: 0,
    coin_sum_value_in_coin_a: 0,
    coin_sum_value_in_coin_b: 0,
    fee_coin_a_amount: new BN(0),
    fee_coin_b_amount: new BN(0),
    fee_sum_value_in_u: 0,
    fee_sum_value_in_coin_a: 0,
    fee_sum_value_in_coin_b: 0,
    reward_amount: new Map<COIN_TYPE, BN>(),
    reward_sum_value_in_u: 0,
    reward_sum_value_in_coin_a: 0,
    reward_sum_value_in_coin_b: 0,
    total_coin_amount: new Map<COIN_TYPE, BN>(),
    total_coin_sum_value_in_u: 0,
    total_coin_sum_value_in_coin_a: 0,
    total_coin_sum_value_in_coin_b: 0
  }

  for(const [key, value] of relative_coin_info.entries()) {
    all_position_amount_value_info.reward_amount.set(key, new BN(0))
    all_position_amount_value_info.total_coin_amount.set(key, new BN(0))
  }

  for (const [key, value] of pos_map.entries()) {
    var position_fee = positionFeeMap.get(value.pos_object_id)!
    var position_reward = positionRewardMap.get(value.pos_object_id)!





    const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(new BN(value.liquidity), new BN(main_pool.current_sqrt_price), 
                                          TickMath.tickIndexToSqrtPriceX64(value.tick_lower_index), 
                                          TickMath.tickIndexToSqrtPriceX64(value.tick_upper_index), true)

    var total_coin_amount = new Map<COIN_TYPE, BN>()
    var reward_amount = new Map<COIN_TYPE, BN>()
    for(const [key, value] of relative_coin_info.entries()) {
      total_coin_amount.set(key, new BN(0))
      reward_amount.set(key, new BN(0))
    }
    

    var coin_a_value_in_u = d(coinAmounts.coinA.toString()).div(Decimal.pow(10, coin_a_decimals)).mul(coin_price_in_u.get(coin_a_type)!).toNumber()
    var coin_b_value_in_u = d(coinAmounts.coinB.toString()).div(Decimal.pow(10, coin_b_decimals)).mul(coin_price_in_u.get(coin_b_type)!).toNumber()
    var coin_sum_value_in_u = coin_a_value_in_u + coin_b_value_in_u

    var fee_coin_a_value_in_u = d(position_fee.feeOwedA.toString()).div(Decimal.pow(10, coin_a_decimals)).mul(coin_price_in_u.get(coin_a_type)!).toNumber()
    var fee_coin_b_value_in_u = d(position_fee.feeOwedB.toString()).div(Decimal.pow(10, coin_b_decimals)).mul(coin_price_in_u.get(coin_b_type)!).toNumber()
    var fee_sum_value_in_u = fee_coin_a_value_in_u + fee_coin_b_value_in_u

    total_coin_amount.get(coin_a_type)!.iadd(coinAmounts.coinA.add(position_fee.feeOwedA))
    total_coin_amount.get(coin_b_type)!.iadd(coinAmounts.coinB.add(position_fee.feeOwedB))
     
    var reward_sum_value_in_u = 0 
    for (const rwd of position_reward) {
      var coin_type = getCoinTypeEnum(rwd.coin_address)
      if (relative_coin_info.has(coin_type)) {
        reward_amount.set(coin_type, rwd.amount_owed.clone())

        var rwd_value_in_u = d(rwd.amount_owed.toString()).div(Decimal.pow(10, relative_coin_info.get(coin_type)!.coin_decimals)).mul(coin_price_in_u.get(coin_type)!).toNumber()
        reward_sum_value_in_u += rwd_value_in_u

        total_coin_amount.get(coin_type)!.iadd(rwd.amount_owed)
      } else {
        console.log('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in reward: %s', date.toLocaleString(), rwd.coin_address)
        fs.appendFileSync(fileName, util.format('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in reward: %s', date.toLocaleString(), rwd.coin_address))
        fs.appendFileSync(fileNameBrief, util.format('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in reward: %s', date.toLocaleString(), rwd.coin_address))
      }      
    }

    var total_coin_sum_value_in_u = coin_sum_value_in_u + fee_sum_value_in_u + reward_sum_value_in_u

    position_amount_value_info.set(key, {
      coin_a_amount: coinAmounts.coinA.clone(),
      coin_b_amount: coinAmounts.coinB.clone(),
      coin_sum_value_in_u: coin_sum_value_in_u,
      coin_sum_value_in_coin_a: coin_sum_value_in_u / coin_price_in_u.get(coin_a_type)!,
      coin_sum_value_in_coin_b: coin_sum_value_in_u / coin_price_in_u.get(coin_b_type)!,
      fee_coin_a_amount: position_fee.feeOwedA.clone(),
      fee_coin_b_amount: position_fee.feeOwedB.clone(),
      fee_sum_value_in_u: fee_sum_value_in_u,
      fee_sum_value_in_coin_a: fee_sum_value_in_u / coin_price_in_u.get(coin_a_type)!,
      fee_sum_value_in_coin_b: fee_sum_value_in_u / coin_price_in_u.get(coin_b_type)!,
      reward_amount: reward_amount,
      reward_sum_value_in_u: reward_sum_value_in_u,
      reward_sum_value_in_coin_a: reward_sum_value_in_u / coin_price_in_u.get(coin_a_type)!,
      reward_sum_value_in_coin_b: reward_sum_value_in_u / coin_price_in_u.get(coin_b_type)!,
      total_coin_amount: total_coin_amount,
      total_coin_sum_value_in_u: total_coin_sum_value_in_u,
      total_coin_sum_value_in_coin_a: total_coin_sum_value_in_u / coin_price_in_u.get(coin_a_type)!,
      total_coin_sum_value_in_coin_b: total_coin_sum_value_in_u / coin_price_in_u.get(coin_b_type)!
    })

    all_position_amount_value_info.coin_a_amount.iadd(coinAmounts.coinA)
    all_position_amount_value_info.coin_b_amount.iadd(coinAmounts.coinB)
    all_position_amount_value_info.coin_sum_value_in_u += coin_sum_value_in_u
    all_position_amount_value_info.coin_sum_value_in_coin_a += coin_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
    all_position_amount_value_info.coin_sum_value_in_coin_b += coin_sum_value_in_u / coin_price_in_u.get(coin_b_type)!
    all_position_amount_value_info.fee_coin_a_amount.iadd(position_fee.feeOwedA)
    all_position_amount_value_info.fee_coin_b_amount.iadd(position_fee.feeOwedB)
    all_position_amount_value_info.fee_sum_value_in_u += fee_sum_value_in_u
    all_position_amount_value_info.fee_sum_value_in_coin_a += fee_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
    all_position_amount_value_info.fee_sum_value_in_coin_b += fee_sum_value_in_u / coin_price_in_u.get(coin_b_type)!
    for(const [key, value] of relative_coin_info.entries()) {
      all_position_amount_value_info.reward_amount.get(key)!.iadd(reward_amount.get(key)!)
      all_position_amount_value_info.total_coin_amount.get(key)!.iadd(total_coin_amount.get(key)!)
    }
    all_position_amount_value_info.reward_sum_value_in_u += reward_sum_value_in_u
    all_position_amount_value_info.reward_sum_value_in_coin_a += reward_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
    all_position_amount_value_info.reward_sum_value_in_coin_b += reward_sum_value_in_u / coin_price_in_u.get(coin_b_type)!
    all_position_amount_value_info.total_coin_sum_value_in_u += total_coin_sum_value_in_u
    all_position_amount_value_info.total_coin_sum_value_in_coin_a += total_coin_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
    all_position_amount_value_info.total_coin_sum_value_in_coin_b += total_coin_sum_value_in_u / coin_price_in_u.get(coin_b_type)!
  }



  // calc wallet relative coin amount and value in u
  var wallet_balance_map = new Map<COIN_TYPE, WalletCoinAmountndValue>()
  for (const [key, value] of relative_coin_info) {
    wallet_balance_map.set(key, {coin_amount: new BN(0), value_in_u: 0, value_in_coin_a: 0, value_in_coin_b: 0})
  }

  var wallet_sum_value_in_u = 0
  for (const coin_balance of wallet_coin_balance) {
    var coin_type = getCoinTypeEnum(coin_balance.coinType)
    if (relative_coin_info.has(coin_type)) {
      let balance = wallet_balance_map.get(coin_type)!
      balance.coin_amount.iadd(new BN(coin_balance.totalBalance))
      balance.value_in_u = d(coin_balance.totalBalance).div(Decimal.pow(10, relative_coin_info.get(coin_type)!.coin_decimals)).mul(coin_price_in_u.get(coin_type)!).toNumber()
      balance.value_in_coin_a = balance.value_in_u / coin_price_in_u.get(coin_a_type)!
      balance.value_in_coin_b = balance.value_in_u / coin_price_in_u.get(coin_b_type)!

      wallet_sum_value_in_u += balance.value_in_u
    }
  }

  // var wallet_coin_map = new Map<COIN_TYPE, CoinValueCalc>()
  // for (const [key, value] of wallet_balance_map) {
  //   wallet_coin_map.set(key, {amount_owed: value.clone(), price_in_u: 1, value_in_u: 0})
  // }
  var wallet_sum_value_in_coin_a = wallet_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
  var wallet_sum_value_in_coin_b = wallet_sum_value_in_u / coin_price_in_u.get(coin_b_type)!





  var all_balance_map = new Map<COIN_TYPE, BN>()
  for (const [key, value] of relative_coin_info) {
    all_balance_map.set(key, new BN(0))
  }

  for (const [key, value] of wallet_balance_map) {
    all_balance_map.get(key)!.iadd(value.coin_amount)
  }

  for (const [key, value] of all_position_amount_value_info.total_coin_amount) {
    all_balance_map.get(key)!.iadd(value)
  }

  var all_sum_value_in_u = wallet_sum_value_in_u + all_position_amount_value_info.total_coin_sum_value_in_u
  var all_sum_value_in_coin_a = all_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
  var all_sum_value_in_coin_b = all_sum_value_in_u / coin_price_in_u.get(coin_b_type)!





  var fee_rwd_amount_value_claimed: PositionCoinAmountAndValueInU2 = {
    coin_a_amount: new BN(0),
    coin_b_amount: new BN(0),
    coin_sum_value_in_u: 0,
    coin_sum_value_in_coin_a: 0,
    coin_sum_value_in_coin_b: 0,
    fee_coin_a_amount: new BN(0),
    fee_coin_b_amount: new BN(0),
    fee_sum_value_in_u: 0,
    fee_sum_value_in_coin_a: 0,
    fee_sum_value_in_coin_b: 0,
    reward_amount: new Map<COIN_TYPE, BN>(),
    reward_sum_value_in_u: 0,
    reward_sum_value_in_coin_a: 0,
    reward_sum_value_in_coin_b: 0,
    total_coin_amount: new Map<COIN_TYPE, BN>(),
    total_coin_sum_value_in_u: 0,
    total_coin_sum_value_in_coin_a: 0,
    total_coin_sum_value_in_coin_b: 0
  }

  for (const [key, value] of relative_coin_info) {
    fee_rwd_amount_value_claimed.reward_amount.set(key, new BN(0))
    fee_rwd_amount_value_claimed.total_coin_amount.set(key, new BN(0))
  }

  for (const [key, value] of position_info_map.entries()) {
    fee_rwd_amount_value_claimed.fee_coin_a_amount.iadd(value.fee_coin_a_claimed_total)
    fee_rwd_amount_value_claimed.fee_coin_b_amount.iadd(value.fee_coin_b_claimed_total)
    fee_rwd_amount_value_claimed.fee_sum_value_in_u += value.fee_value_in_u_claimed_total

    fee_rwd_amount_value_claimed.total_coin_amount.get(coin_a_type)!.iadd(value.fee_coin_a_claimed_total)
    fee_rwd_amount_value_claimed.total_coin_amount.get(coin_b_type)!.iadd(value.fee_coin_b_claimed_total)
    fee_rwd_amount_value_claimed.total_coin_sum_value_in_u += value.fee_value_in_u_claimed_total

    var rwd_handle = fee_rwd_amount_value_claimed.reward_amount
    for(const rwd of value.reward_amount_claimed_total) {
      if (rwd_handle.has(rwd.coin_type)) {
        rwd_handle.get(rwd.coin_type)!.iadd(rwd.amount_owed)
        fee_rwd_amount_value_claimed.total_coin_amount.get(rwd.coin_type)!.iadd(rwd.amount_owed)
      } else {
        console.log('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in claimed reward: %s', date.toLocaleString(), rwd.coin_type)
        fs.appendFileSync(fileName, util.format('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in claimed reward: %s', date.toLocaleString(), rwd.coin_type))
        fs.appendFileSync(fileNameBrief, util.format('%s [warning] statisticValuesInWUSDCPeriodicity: unrecognized/unconfigured coin in claimed reward: %s', date.toLocaleString(), rwd.coin_type))
      }
    }
    fee_rwd_amount_value_claimed.reward_sum_value_in_u += value.reward_value_in_u_claimed_total
    fee_rwd_amount_value_claimed.total_coin_sum_value_in_u += value.reward_value_in_u_claimed_total
  }
  if (calc_cur_price_value_for_claimed_fee_rwd) {
    var claimed_fee_coin_a_value_in_u = d(fee_rwd_amount_value_claimed.fee_coin_a_amount.toString())
              .div(Decimal.pow(10, relative_coin_info.get(coin_a_type)!.coin_decimals))
              .mul(coin_price_in_u.get(coin_a_type)!).toNumber()
    var claimed_fee_coin_b_value_in_u = d(fee_rwd_amount_value_claimed.fee_coin_b_amount.toString())
              .div(Decimal.pow(10, relative_coin_info.get(coin_b_type)!.coin_decimals))
              .mul(coin_price_in_u.get(coin_b_type)!).toNumber()
    fee_rwd_amount_value_claimed.fee_sum_value_in_u = claimed_fee_coin_a_value_in_u + claimed_fee_coin_b_value_in_u
    fee_rwd_amount_value_claimed.fee_sum_value_in_coin_a = fee_rwd_amount_value_claimed.fee_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
    fee_rwd_amount_value_claimed.fee_sum_value_in_coin_b = fee_rwd_amount_value_claimed.fee_sum_value_in_u / coin_price_in_u.get(coin_b_type)!

    for (const [key, value] of fee_rwd_amount_value_claimed.reward_amount) {
      fee_rwd_amount_value_claimed.total_coin_sum_value_in_u +=
        d(value.toString())
        .div(Decimal.pow(10, relative_coin_info.get(key)!.coin_decimals))
        .mul(coin_price_in_u.get(key)!).toNumber()
    }
    fee_rwd_amount_value_claimed.reward_sum_value_in_coin_a = fee_rwd_amount_value_claimed.total_coin_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
    fee_rwd_amount_value_claimed.reward_sum_value_in_coin_b = fee_rwd_amount_value_claimed.total_coin_sum_value_in_u / coin_price_in_u.get(coin_b_type)!

    fee_rwd_amount_value_claimed.total_coin_sum_value_in_u = fee_rwd_amount_value_claimed.fee_sum_value_in_u + fee_rwd_amount_value_claimed.total_coin_sum_value_in_u
    fee_rwd_amount_value_claimed.total_coin_sum_value_in_coin_a = fee_rwd_amount_value_claimed.total_coin_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
    fee_rwd_amount_value_claimed.total_coin_sum_value_in_coin_b = fee_rwd_amount_value_claimed.total_coin_sum_value_in_u / coin_price_in_u.get(coin_b_type)!
  }


  var fee_rwd_amount_value_all: PositionCoinAmountAndValueInU2 = {
    coin_a_amount: new BN(0),
    coin_b_amount: new BN(0),
    coin_sum_value_in_u: 0,
    coin_sum_value_in_coin_a: 0,
    coin_sum_value_in_coin_b: 0,
    fee_coin_a_amount: new BN(0),
    fee_coin_b_amount: new BN(0),
    fee_sum_value_in_u: 0,
    fee_sum_value_in_coin_a: 0,
    fee_sum_value_in_coin_b: 0,
    reward_amount: new Map<COIN_TYPE, BN>(),
    reward_sum_value_in_u: 0,
    reward_sum_value_in_coin_a: 0,
    reward_sum_value_in_coin_b: 0,
    total_coin_amount: new Map<COIN_TYPE, BN>(),
    total_coin_sum_value_in_u: 0,
    total_coin_sum_value_in_coin_a: 0,
    total_coin_sum_value_in_coin_b: 0
  }

  for (const [key, value] of relative_coin_info) {
    fee_rwd_amount_value_all.reward_amount.set(key, new BN(0))
    fee_rwd_amount_value_all.total_coin_amount.set(key, new BN(0))
  }

  fee_rwd_amount_value_all.fee_coin_a_amount = fee_rwd_amount_value_claimed.fee_coin_a_amount.add(all_position_amount_value_info.fee_coin_a_amount)
  fee_rwd_amount_value_all.fee_coin_b_amount = fee_rwd_amount_value_claimed.fee_coin_b_amount.add(all_position_amount_value_info.fee_coin_b_amount)
  fee_rwd_amount_value_all.fee_sum_value_in_u = fee_rwd_amount_value_claimed.fee_sum_value_in_u + all_position_amount_value_info.fee_sum_value_in_u
  fee_rwd_amount_value_all.fee_sum_value_in_coin_a = fee_rwd_amount_value_claimed.fee_sum_value_in_coin_a + all_position_amount_value_info.fee_sum_value_in_coin_a
  fee_rwd_amount_value_all.fee_sum_value_in_coin_b = fee_rwd_amount_value_claimed.fee_sum_value_in_coin_b + all_position_amount_value_info.fee_sum_value_in_coin_b

  for (const [key, value] of fee_rwd_amount_value_claimed.reward_amount) {
    fee_rwd_amount_value_all.reward_amount.get(key)!.iadd(value)
  }
  for (const [key, value] of all_position_amount_value_info.reward_amount) {
    fee_rwd_amount_value_all.reward_amount.get(key)!.iadd(value)
  }
  fee_rwd_amount_value_all.reward_sum_value_in_u = fee_rwd_amount_value_claimed.reward_sum_value_in_u + all_position_amount_value_info.reward_sum_value_in_u
  fee_rwd_amount_value_all.fee_sum_value_in_coin_a = fee_rwd_amount_value_claimed.fee_sum_value_in_coin_a + all_position_amount_value_info.fee_sum_value_in_coin_a
  fee_rwd_amount_value_all.fee_sum_value_in_coin_b = fee_rwd_amount_value_claimed.fee_sum_value_in_coin_b + all_position_amount_value_info.fee_sum_value_in_coin_b

  fee_rwd_amount_value_all.total_coin_amount.get(coin_a_type)!.iadd(fee_rwd_amount_value_all.fee_coin_a_amount)
  fee_rwd_amount_value_all.total_coin_amount.get(coin_b_type)!.iadd(fee_rwd_amount_value_all.fee_coin_b_amount)
  for (const [key, value] of fee_rwd_amount_value_all.reward_amount) {
    fee_rwd_amount_value_all.total_coin_amount.get(key)!.iadd(value)
  }

  fee_rwd_amount_value_all.total_coin_sum_value_in_u = fee_rwd_amount_value_all.fee_sum_value_in_u + fee_rwd_amount_value_all.reward_sum_value_in_u
  fee_rwd_amount_value_all.total_coin_sum_value_in_coin_a = fee_rwd_amount_value_all.total_coin_sum_value_in_u / coin_price_in_u.get(coin_a_type)!
  fee_rwd_amount_value_all.total_coin_sum_value_in_coin_b = fee_rwd_amount_value_all.total_coin_sum_value_in_u / coin_price_in_u.get(coin_b_type)!






  // begin dump  
  date.setTime(Date.now())
  console.log(' - ')
  fs.appendFileSync(fileName, ' - \n')
  fs.appendFileSync(fileNameStatisticsInfo, ' - \n')

  console.log('%s [info] -- statisticValuesInWUSDCPeriodicity: dump --', date.toLocaleString())
  fs.appendFileSync(fileName, util.format('%s [info] -- statisticValuesInWUSDCPeriodicity: dump --\n', date.toLocaleString()))
  fs.appendFileSync(fileNameStatisticsInfo, util.format('%s [info] -- statisticValuesInWUSDCPeriodicity: dump --\n', date.toLocaleString()))



  // dump opened position value
  console.log(' - opened position value - ')
  fs.appendFileSync(fileName, ' - opened position value - \n')
  fs.appendFileSync(fileNameStatisticsInfo, ' - opened position value - \n')

  var position_info_map_index: number[] = []
  for (const [tick, value] of pos_map.entries()) {
    position_info_map_index.push(tick)
  }
  position_info_map_index.sort()

  for (const tick of position_info_map_index) {
    if (pos_map.has(tick)) {
      var val = position_amount_value_info.get(tick)!
      var pos = pos_map.get(tick)!
      var pos_map_val = position_info_map.get(tick)!
      var reward_print: string = ''      
      for (const [key, value] of val.reward_amount) {
        reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
      }
      var total_print: string = ''
      for (const [key, value] of val.total_coin_amount) {
        reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
      }
      console.log('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d) %s:', pos.tick_lower_index, pos.tick_upper_index, 
        pos_map_val.tick_lower_coin_a_price.toFixed(4), pos_map_val.tick_upper_coin_a_price.toFixed(4),
        pos_map_val.tick_upper_coin_b_price.toFixed(4), pos_map_val.tick_lower_coin_b_price.toFixed(4),
        (pos.tick_lower_index == cur_position_tick_index)? '(- active -)': '')
      console.log('    Liquidity value : (u:\$%s, coin_a: %s, coin_b: %s), coin_a_amount : %s, coin_b_amount : %s', 
              val.coin_sum_value_in_u.toFixed(6), val.coin_sum_value_in_coin_a.toFixed(6), val.coin_sum_value_in_coin_b.toFixed(6), 
              val.coin_a_amount.toString(), val.coin_b_amount.toString())
      console.log('    Fee value : (u:\$%s, coin_a: %s, coin_b: %s), fee_coin_a : %s, fee_coin_b_amount : %s', 
              val.fee_sum_value_in_u.toFixed(6), val.fee_sum_value_in_coin_a.toFixed(6), val.fee_sum_value_in_coin_b.toFixed(6), 
              val.fee_coin_a_amount.toString(), val.fee_coin_b_amount.toString())
      console.log('    Reward value : (u:\$%s, coin_a: %s, coin_b: %s), %s', 
              val.reward_sum_value_in_u.toFixed(6), val.reward_sum_value_in_coin_a.toFixed(6), val.reward_sum_value_in_coin_b.toFixed(6), reward_print)
      console.log('    Total : (u:\$%s, coin_a: %s, coin_b: %s), %s',
              val.total_coin_sum_value_in_u.toFixed(6), val.total_coin_sum_value_in_coin_a.toFixed(6), val.total_coin_sum_value_in_coin_b.toFixed(6), total_print)

      fs.appendFileSync(fileName, util.format('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d) %s:\n', pos.tick_lower_index, pos.tick_upper_index, 
              pos_map_val.tick_lower_coin_a_price.toFixed(4), pos_map_val.tick_upper_coin_a_price.toFixed(4),
              pos_map_val.tick_upper_coin_b_price.toFixed(4), pos_map_val.tick_lower_coin_b_price.toFixed(4),
              (pos.tick_lower_index == cur_position_tick_index)? '- active -': ''))
      fs.appendFileSync(fileName, util.format('    Liquidity value : (u:\$%s, coin_a: %s, coin_b: %s), coin_a_amount : %s, coin_b_amount : %s\n', 
              val.coin_sum_value_in_u.toFixed(6), val.coin_sum_value_in_coin_a.toFixed(6), val.coin_sum_value_in_coin_b.toFixed(6), 
              val.coin_a_amount.toString(), val.coin_b_amount.toString()))
      fs.appendFileSync(fileName, util.format('    Fee value : (u:\$%s, coin_a: %s, coin_b: %s), fee_coin_a : %s, fee_coin_b_amount : %s\n', 
              val.fee_sum_value_in_u.toFixed(6), val.fee_sum_value_in_coin_a.toFixed(6), val.fee_sum_value_in_coin_b.toFixed(6), 
              val.fee_coin_a_amount.toString(), val.fee_coin_b_amount.toString()))
      fs.appendFileSync(fileName, util.format('    Reward value : (u:\$%s, coin_a: %s, coin_b: %s), %s\n', 
              val.reward_sum_value_in_u.toFixed(6), val.reward_sum_value_in_coin_a.toFixed(6), val.reward_sum_value_in_coin_b.toFixed(6), reward_print))
      fs.appendFileSync(fileName, util.format('    Total : (u:\$%s, coin_a: %s, coin_b: %s), %s\n',
              val.total_coin_sum_value_in_u.toFixed(6), val.total_coin_sum_value_in_coin_a.toFixed(6), val.total_coin_sum_value_in_coin_b.toFixed(6), total_print))

      fs.appendFileSync(fileNameStatisticsInfo, util.format('%d - %d(coin_a_price: %d - %d, coin_b_price: %d - %d) %s:\n', pos.tick_lower_index, pos.tick_upper_index, 
              pos_map_val.tick_lower_coin_a_price.toFixed(4), pos_map_val.tick_upper_coin_a_price.toFixed(4),
              pos_map_val.tick_upper_coin_b_price.toFixed(4), pos_map_val.tick_lower_coin_b_price.toFixed(4),
              (pos.tick_lower_index == cur_position_tick_index)? '- active -': ''))
      fs.appendFileSync(fileNameStatisticsInfo, util.format('    Liquidity value : (u:\$%s, coin_a: %s, coin_b: %s), coin_a_amount : %s, coin_b_amount : %s\n', 
              val.coin_sum_value_in_u.toFixed(6), val.coin_sum_value_in_coin_a.toFixed(6), val.coin_sum_value_in_coin_b.toFixed(6), 
              val.coin_a_amount.toString(), val.coin_b_amount.toString()))
      fs.appendFileSync(fileNameStatisticsInfo, util.format('    Fee value : (u:\$%s, coin_a: %s, coin_b: %s), fee_coin_a : %s, fee_coin_b_amount : %s\n', 
              val.fee_sum_value_in_u.toFixed(6), val.fee_sum_value_in_coin_a.toFixed(6), val.fee_sum_value_in_coin_b.toFixed(6), 
              val.fee_coin_a_amount.toString(), val.fee_coin_b_amount.toString()))
      fs.appendFileSync(fileNameStatisticsInfo, util.format('    Reward value : (u:\$%s, coin_a: %s, coin_b: %s), %s\n', 
              val.reward_sum_value_in_u.toFixed(6), val.reward_sum_value_in_coin_a.toFixed(6), val.reward_sum_value_in_coin_b.toFixed(6), reward_print))
      fs.appendFileSync(fileNameStatisticsInfo, util.format('    Total : (u:\$%s, coin_a: %s, coin_b: %s), %s\n',
              val.total_coin_sum_value_in_u.toFixed(6), val.total_coin_sum_value_in_coin_a.toFixed(6), val.total_coin_sum_value_in_coin_b.toFixed(6), total_print))

    }
  }
  // new line
  console.log(' ')
  fs.appendFileSync(fileName, ' \n') 
  fs.appendFileSync(fileNameStatisticsInfo, ' \n') 







  // dump opened position total value
  if (pos_map.size) {
    var reward_print: string = ''
    for (const [key, value] of all_position_amount_value_info.reward_amount) {
      reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
    }

    var total_print: string = ''
    for (const [key, value] of all_position_amount_value_info.total_coin_amount) {
      reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
    }
    console.log(' - opened position total value - ')
    console.log('All Opened Position: ')
    console.log('    Liquidity value : (u:\$%s, coin_a: %s, coin_b: %s), coin_a_amount : %s, coin_b_amount : %s', 
      all_position_amount_value_info.total_coin_sum_value_in_u.toFixed(6), 
      all_position_amount_value_info.total_coin_sum_value_in_coin_a.toFixed(6), 
      all_position_amount_value_info.total_coin_sum_value_in_coin_b.toFixed(6),
      all_position_amount_value_info.coin_a_amount.toString(), 
      all_position_amount_value_info.coin_b_amount.toString()
    )
    console.log('    Fee value : (u:\$%s, coin_a: %s, coin_b: %s), fee_coin_a_amount : %s, fee_coin_b_amount : %s', 
      all_position_amount_value_info.fee_sum_value_in_u.toFixed(6),
      all_position_amount_value_info.fee_sum_value_in_coin_a.toFixed(6),
      all_position_amount_value_info.fee_sum_value_in_coin_b.toFixed(6),
      all_position_amount_value_info.fee_coin_a_amount.toString(), 
      all_position_amount_value_info.fee_coin_b_amount.toString()
    )
    console.log('    Reward value : (u:\$%s, coin_a: %s, coin_b: %s), %s', 
      all_position_amount_value_info.reward_sum_value_in_u.toFixed(6),
      all_position_amount_value_info.reward_sum_value_in_coin_a.toFixed(6),
      all_position_amount_value_info.reward_sum_value_in_coin_b.toFixed(6),
      reward_print
    )
    console.log('    Total : (u:\$%s, coin_a: %s, coin_b: %s), %s',
      all_position_amount_value_info.total_coin_sum_value_in_u.toFixed(6),
      all_position_amount_value_info.total_coin_sum_value_in_coin_a.toFixed(6),
      all_position_amount_value_info.total_coin_sum_value_in_coin_b.toFixed(6),
      total_print
    )
    console.log(' ')

    fs.appendFileSync(fileName, ' - opened position total value - \n')
    fs.appendFileSync(fileName, 'All Opened Position: \n')
    fs.appendFileSync(fileName, util.format('    Liquidity value : (u:\$%s, coin_a: %s, coin_b: %s), coin_a_amount : %s, coin_b_amount : %s\n', 
      all_position_amount_value_info.total_coin_sum_value_in_u.toFixed(6), 
      all_position_amount_value_info.total_coin_sum_value_in_coin_a.toFixed(6), 
      all_position_amount_value_info.total_coin_sum_value_in_coin_b.toFixed(6),
      all_position_amount_value_info.coin_a_amount.toString(), 
      all_position_amount_value_info.coin_b_amount.toString())
    )
    fs.appendFileSync(fileName, util.format('    Fee value : (u:\$%s, coin_a: %s, coin_b: %s), fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
      all_position_amount_value_info.fee_sum_value_in_u.toFixed(6),
      all_position_amount_value_info.fee_sum_value_in_coin_a.toFixed(6),
      all_position_amount_value_info.fee_sum_value_in_coin_b.toFixed(6),
      all_position_amount_value_info.fee_coin_a_amount.toString(), 
      all_position_amount_value_info.fee_coin_b_amount.toString())
    )
    fs.appendFileSync(fileName, util.format('    Reward value : (u:\$%s, coin_a: %s, coin_b: %s), %s\n', 
      all_position_amount_value_info.reward_sum_value_in_u.toFixed(6),
      all_position_amount_value_info.reward_sum_value_in_coin_a.toFixed(6),
      all_position_amount_value_info.reward_sum_value_in_coin_b.toFixed(6),
      reward_print)
    )
    fs.appendFileSync(fileName, util.format('    Total : (u:\$%s, coin_a: %s, coin_b: %s), %s\n',
      all_position_amount_value_info.total_coin_sum_value_in_u.toFixed(6),
      all_position_amount_value_info.total_coin_sum_value_in_coin_a.toFixed(6),
      all_position_amount_value_info.total_coin_sum_value_in_coin_b.toFixed(6),
      total_print)
    )
    fs.appendFileSync(fileName, ' \n')


    fs.appendFileSync(fileNameStatisticsInfo, ' - opened position total value - \n')
    fs.appendFileSync(fileNameStatisticsInfo, 'All Opened Position: \n')
    fs.appendFileSync(fileNameStatisticsInfo, util.format('    Liquidity value : (u:\$%s, coin_a: %s, coin_b: %s), coin_a_amount : %s, coin_b_amount : %s\n', 
      all_position_amount_value_info.total_coin_sum_value_in_u.toFixed(6), 
      all_position_amount_value_info.total_coin_sum_value_in_coin_a.toFixed(6), 
      all_position_amount_value_info.total_coin_sum_value_in_coin_b.toFixed(6),
      all_position_amount_value_info.coin_a_amount.toString(), 
      all_position_amount_value_info.coin_b_amount.toString())
    )
    fs.appendFileSync(fileNameStatisticsInfo, util.format('    Fee value : (u:\$%s, coin_a: %s, coin_b: %s), fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
      all_position_amount_value_info.fee_sum_value_in_u.toFixed(6),
      all_position_amount_value_info.fee_sum_value_in_coin_a.toFixed(6),
      all_position_amount_value_info.fee_sum_value_in_coin_b.toFixed(6),
      all_position_amount_value_info.fee_coin_a_amount.toString(), 
      all_position_amount_value_info.fee_coin_b_amount.toString())
    )
    fs.appendFileSync(fileNameStatisticsInfo, util.format('    Reward value : (u:\$%s, coin_a: %s, coin_b: %s), %s\n', 
      all_position_amount_value_info.reward_sum_value_in_u.toFixed(6),
      all_position_amount_value_info.reward_sum_value_in_coin_a.toFixed(6),
      all_position_amount_value_info.reward_sum_value_in_coin_b.toFixed(6),
      reward_print)
    )
    fs.appendFileSync(fileNameStatisticsInfo, util.format('    Total : (u:\$%s, coin_a: %s, coin_b: %s), %s\n',
      all_position_amount_value_info.total_coin_sum_value_in_u.toFixed(6),
      all_position_amount_value_info.total_coin_sum_value_in_coin_a.toFixed(6),
      all_position_amount_value_info.total_coin_sum_value_in_coin_b.toFixed(6),
      total_print)
    )
    fs.appendFileSync(fileNameStatisticsInfo, ' \n')
  }

  // TODO: 
  // // dump current wallet value  
  // console.log(' - wallet value - ')
  // for (const [key, value] of wallet_balance_map) {
  //   console.log('Wallet %s : \$%d, amount : %s', 
  //     relative_coin_info.get(key)!.coin_name,  
  //     wallet_balance_map.get(key)!.value_in_u, 
  //     wallet_balance_map.get(key)!.amount_owed.toString())
  // }
  // console.log('Wallet Total : \$%d', wallet_value_in_u_total)
  // console.log(' ')
  

  // fs.appendFileSync(fileName, ' - wallet value - \n')
  // for (const [key, value] of wallet_coin_map) {
  //   fs.appendFileSync(fileName, util.format('Wallet %s : \$%d, amount : %s\n', 
  //     relative_coin_info.get(key)?.coin_name,  
  //     wallet_coin_map.get(key)?.value_in_u, 
  //     wallet_coin_map.get(key)?.amount_owed.toString()))
  // }
  // fs.appendFileSync(fileName, util.format('Wallet Total : \$%d\n', wallet_value_in_u_total))
  // fs.appendFileSync(fileName, ' \n')

  // fs.appendFileSync(fileNameStatisticsInfo, ' - wallet value - \n')
  // for (const [key, value] of wallet_coin_map) {
  //   fs.appendFileSync(fileNameStatisticsInfo, util.format('Wallet %s : \$%d, amount : %s\n', 
  //     relative_coin_info.get(key)?.coin_name,  
  //     wallet_coin_map.get(key)?.value_in_u, 
  //     wallet_coin_map.get(key)?.amount_owed.toString()))
  // }
  // fs.appendFileSync(fileNameStatisticsInfo, util.format('Wallet Total : \$%d\n', wallet_value_in_u_total))
  // fs.appendFileSync(fileNameStatisticsInfo, ' \n')





  // // dump current total value (except history reward and fee)

  // var wallet_coin_a_amount: BN = new BN(0)
  // var wallet_coin_b_amount: BN = new BN(0)
  // for (const [key, value] of wallet_coin_map) {
  //   if (key == coin_a_type) {
  //     wallet_coin_a_amount = value.amount_owed.clone()
  //   } else if (key == coin_b_type) {
  //     wallet_coin_b_amount = value.amount_owed.clone()
  //   }
  // }
  // console.log(' - total value from all source - ')
  // console.log('Total : value_in_u: \$%d, coin_a_amount: %s, coin_b_amount: %d', 
  //     wallet_value_in_u_total
  //     + coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u
  //     + coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u 
  //     + coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u,
  //     wallet_coin_a_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_a_amount).toString(),
  //     wallet_coin_b_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_b_amount).toString())
  // console.log(' ')

  // fs.appendFileSync(fileName, ' - total value from all source - \n')
  // fs.appendFileSync(fileName, util.format('Total : \$%d, coin_a_amount: %s, coin_b_amount: %d\n', 
  //     wallet_value_in_u_total
  //     + coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u
  //     + coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u 
  //     + coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u,
  //     wallet_coin_a_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_a_amount).toString(),
  //     wallet_coin_b_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_b_amount).toString()))
  // fs.appendFileSync(fileName, ' \n')

  // fs.appendFileSync(fileNameStatisticsInfo, ' - total value from all source - \n')
  // fs.appendFileSync(fileNameStatisticsInfo, util.format('Total : \$%d, coin_a_amount: %s, coin_b_amount: %d\n', 
  //     wallet_value_in_u_total
  //     + coins_amount_and_value_in_u_in_all_position_total.total_coin_value_in_u
  //     + coins_amount_and_value_in_u_in_all_position_total.total_fee_value_in_u 
  //     + coins_amount_and_value_in_u_in_all_position_total.total_reward_value_in_u,
  //     wallet_coin_a_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_a_amount).toString(),
  //     wallet_coin_b_amount.add(coins_amount_and_value_in_u_in_all_position_total.coin_b_amount).toString()))
  // fs.appendFileSync(fileNameStatisticsInfo, ' \n')





  // // dump position histiry reward and fee value
  // var reward_print: string = ''
  // for (const [key, value] of fee_rwd_amount_and_value_in_u_claimed_total.reward_amount) {
  //   reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
  // }
  // console.log(' - extra info - ')
  // console.log('All History Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s', 
  //   fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u, 
  //   fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_a_amount.toString(), 
  //   fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_b_amount.toString())
  // console.log('All History Position Reward value : \$%d, %s', 
  //   fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u, reward_print)
  // console.log('All History Position Total : \$%d',
  //   fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u)
  // console.log(' ')

  // fs.appendFileSync(fileName, ' - extra info - \n')
  // fs.appendFileSync(fileName, util.format('All History Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
  //   fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u,
  //   fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_a_amount.toString(), 
  //   fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_b_amount.toString()))
  // fs.appendFileSync(fileName, util.format('All History Position Reward value : \$%d, %s\n', 
  //   fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u, reward_print))
  // fs.appendFileSync(fileName, util.format('All History Position Total : \$%d\n',
  //   fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u))
  // fs.appendFileSync(fileName, ' \n')

  // fs.appendFileSync(fileNameStatisticsInfo, ' - extra info - \n')
  // fs.appendFileSync(fileNameStatisticsInfo, util.format('All History Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
  //   fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u,
  //   fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_a_amount.toString(), 
  //   fee_rwd_amount_and_value_in_u_claimed_total.fee_coin_b_amount.toString()))
  // fs.appendFileSync(fileNameStatisticsInfo, util.format('All History Position Reward value : \$%d, %s\n', 
  //   fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u, reward_print))
  // fs.appendFileSync(fileNameStatisticsInfo, util.format('All History Position Total : \$%d\n',
  //   fee_rwd_amount_and_value_in_u_claimed_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_total.total_reward_value_in_u))
  // fs.appendFileSync(fileNameStatisticsInfo, ' \n')

  
  
  
  // // dump position histiry + opened reward and fee value
  // reward_print = ''
  // for (const [key, value] of fee_rwd_amount_and_value_in_u_claimed_and_opened_total.reward_amount) {
  //   reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.toString() + '; ')
  // }
  // console.log(' - extra info - ')
  // console.log('All History + Opened Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s', 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u, 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_a_amount.toString(), 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_b_amount.toString())
  // console.log('All History + Opened Position Reward value : \$%d, %s', 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u, reward_print)
  // console.log('All History + Opened Position Total : \$%d',
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u)
  // console.log(' ')

  // fs.appendFileSync(fileName, ' - extra info - \n')
  // fs.appendFileSync(fileName, util.format('All History + Opened Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u, 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_a_amount.toString(),
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_b_amount.toString()))
  // fs.appendFileSync(fileName, util.format('All History + Opened Position Reward value : \$%d, %s\n', 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u, reward_print))
  // fs.appendFileSync(fileName, util.format('All History + Opened Position Total : \$%d\n',
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u))
  // fs.appendFileSync(fileName, ' \n')

  // fs.appendFileSync(fileNameStatisticsInfo, ' - extra info - \n')
  // fs.appendFileSync(fileNameStatisticsInfo, util.format('All History + Opened Position Fee value : \$%d, fee_coin_a_amount : %s, fee_coin_b_amount : %s\n', 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u, 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_a_amount.toString(),
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.fee_coin_b_amount.toString()))
  // fs.appendFileSync(fileNameStatisticsInfo, util.format('All History + Opened Position Reward value : \$%d, %s\n', 
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u, reward_print))
  // fs.appendFileSync(fileNameStatisticsInfo, util.format('All History + Opened Position Total : \$%d\n',
  //   fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_fee_value_in_u + fee_rwd_amount_and_value_in_u_claimed_and_opened_total.total_reward_value_in_u))
  // fs.appendFileSync(fileNameStatisticsInfo, ' \n')



    

  console.log('%s [info] -- statisticValuesInWUSDCPeriodicity: dump end -- ', date.toLocaleString())
  fs.appendFileSync(fileName, util.format('%s [info] -- statisticValuesInWUSDCPeriodicity: dump end -- \n', date.toLocaleString()))
  fs.appendFileSync(fileNameStatisticsInfo, util.format('%s [info] -- statisticValuesInWUSDCPeriodicity: dump end -- \n', date.toLocaleString()))

  console.log(' - ')
  fs.appendFileSync(fileName, ' - \n')
  fs.appendFileSync(fileNameStatisticsInfo, ' - \n')
}
























































async function closePosition(pool: Pool, pos_object_id: string, rewardCoinTypes: string[], sendKeypair: Ed25519Keypair): Promise<boolean> {

  const closePositionTransaction = await SDK.Position.closePositionTransactionPayload({
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        min_amount_a: '0',
        min_amount_b: '0',
        rewarder_coin_types: [...rewardCoinTypes],
        pool_id: pool.poolAddress,
        pos_id: pos_object_id,
        collect_fee: true
      })

  date.setTime(Date.now())
  console.log('%s [info] closePosition: closePositionTransaction:\n%s',  date.toLocaleString(), closePositionTransaction.toJSON())
  fs.appendFileSync(fileName, util.format('%s [info] closePosition: closePositionTransaction:\n%s\n',  date.toLocaleString(), closePositionTransaction.toJSON()))

  //test
  // console.log('%s [test] closePosition: closePositionTransaction:\n%s', util.inspect(closePositionTransaction, true))

  const transferTxn = await SDK.fullClient.sendTransaction(sendKeypair, closePositionTransaction)

  var json_str = JSON.stringify(transferTxn, null, '\t')
  date.setTime(Date.now())
  console.log('%s [info] closePosition: sendTransaction:\n%s',  date.toLocaleString(), json_str)
  fs.appendFileSync(fileName, util.format('%s [info] closePosition: sendTransaction:\n%s\n',  date.toLocaleString(), json_str))

  if (transferTxn?.effects?.status.status == 'success') {
    return true
  } else {
    date.setTime(Date.now())
    console.log('%s [error] closePosition: txn rsp indicate fail', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [error] closePosition: txn rsp indicate fail\n', date.toLocaleString()))
    fs.appendFileSync(fileNameBrief, util.format('%s [error] closePosition: txn rsp indicate fail\n', date.toLocaleString()))
    return false
  }
}


async function addLiquidityWithFixedLiquidity(pool: Pool, liquidity: BN, tokenAmounts: CoinAmounts, curPositionRangeLower: number, 
                    curPositionRangeHigher: number, sendKeypair: Ed25519Keypair ): Promise<boolean> {
 
  const addLiquidityPayloadParams: AddLiquidityParams = {
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
    pool_id: pool.poolAddress,
    tick_lower: curPositionRangeLower.toString(),
    tick_upper: curPositionRangeHigher.toString(),
    delta_liquidity: liquidity.toString(),
    max_amount_a: tokenAmounts.coinA.toString(),
    max_amount_b: tokenAmounts.coinB.toString(),
    pos_id: '',  // open position
    rewarder_coin_types: [],
    collect_fee: false,
  }
  
  
  const payload = await SDK.Position.createAddLiquidityPayload(addLiquidityPayloadParams)
  
  date.setTime(Date.now())
  console.log('%s [info] addLiquidityWithFixedLiquidity: createAddLiquidityPayload:\n%s',  date.toLocaleString(), payload.toJSON())
  fs.appendFileSync(fileName, util.format('%s [info] addLiquidityWithFixedLiquidity: createAddLiquidityPayload:\n%s\n',  date.toLocaleString(), payload.toJSON()))

  // console.log('%s [test] addLiquidityWithFixedLiquidity: createAddLiquidityPayload:\n%s',  date.toLocaleString(), util.inspect(payload, true))

  const transferTxn = await SDK.fullClient.sendTransaction(sendKeypair, payload)

  var json_str = JSON.stringify(transferTxn, null, '\t')
  date.setTime(Date.now())
  console.log('%s [info] addLiquidityWithFixedLiquidity: sendTransaction:\n%s',  date.toLocaleString(), json_str)
  fs.appendFileSync(fileName, util.format('%s [info] addLiquidityWithFixedLiquidity: sendTransaction:\n%s\n',  date.toLocaleString(), json_str))

  if (transferTxn?.effects?.status.status == 'success') {
    return true
  } else {
    date.setTime(Date.now())
    console.log('%s [error] addLiquidityWithFixedLiquidity: txn rsp indicate fail', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [error] addLiquidityWithFixedLiquidity: txn rsp indicate fail\n', date.toLocaleString()))
    fs.appendFileSync(fileNameBrief, util.format('%s [error] addLiquidityWithFixedLiquidity: txn rsp indicate fail\n', date.toLocaleString()))
    return false
  }
}














function syncOpenedPosition(main_pool: Pool, position_list: Position[], position_info_map:Map<number, PositionInfo>) {
  date.setTime(Date.now())
  if (position_list.length == 0) {
    console.log('%s [info] syncOpenedPosition: no opened position retrieved', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [info] syncOpenedPosition: no opened position retrieved\n', date.toLocaleString()))
  }

  var openedPosition = new Map<number, Position>()
  for (let i in position_list) {
    openedPosition.set(position_list[i].tick_lower_index, position_list[i])
  }

  for (const [key, value] of position_info_map.entries()) {
    if (value.position_opened && !openedPosition.has(key)) {
      // sync position_opened flag
      console.log('%s [warning] syncOpenedPosition: tick index %d in position_info_map is opened status, but can not be retrieved. Update position_opened to false.',date.toLocaleString(), key)
      fs.appendFileSync(fileName, util.format('%s [warning] syncOpenedPosition: tick index %d in position_info_map is opened status, but can not be retrieved. Update position_opened to false.\n', 
                                            date.toLocaleString(), key))
      fs.appendFileSync(fileNameBrief, util.format('%s [warning] syncOpenedPosition: tick index %d in position_info_map is opened status, but can not be retrieved. Update position_opened to false.\n', 
                                            date.toLocaleString(), key))
      value.position_opened = false
      if (is_coin_a_base) {
        if (main_pool.current_tick_index < value.tick_lower_index) {
          value.short_times_on_base_coin++
        }
      } else {
        if (main_pool.current_tick_index >= value.tick_upper_index) {
          value.short_times_on_base_coin++
        }
      }
    }
  }

  for (const [key, value] of openedPosition.entries()) {
    if (position_info_map.has(key)) {
      // sync position_opened flag
      var posinfo = position_info_map.get(key)!
      if (posinfo.position_opened == false) {
        console.log('%s [warning] syncOpenedPosition: tick index %d is opened status, but position_info_map indicate it as closed. Update position_opened to true.', date.toLocaleString(), key)
        fs.appendFileSync(fileName, util.format('%s [warning] syncOpenedPosition: tick index %d is opened status, but position_info_map indicate it as closed. Update position_opened to true.\n', 
                                                date.toLocaleString(), key))
        fs.appendFileSync(fileNameBrief, util.format('%s [warning] syncOpenedPosition: tick index %d is opened status, but position_info_map indicate it as closed. Update position_opened to true.\n', 
                                                date.toLocaleString(), key))
        posinfo.position_opened = true
        posinfo.on_position_times++
      }
    } else {
      // sync new position info element
      console.log('%s [warning] syncOpenedPosition: tick index %d is opened status, but can not be retrieved in position_info_map. Add position_info element.', date.toLocaleString(), key)
      fs.appendFileSync(fileName, util.format('%s [warning] syncOpenedPosition: tick index %d is opened status, but can not be retrieved in position_info_map. Add position_info element.\n', 
                                        date.toLocaleString(), key))
      fs.appendFileSync(fileNameBrief, util.format('%s [warning] syncOpenedPosition: tick index %d is opened status, but can not be retrieved in position_info_map. Add position_info element.\n', 
                                        date.toLocaleString(), key))
      var position_info_init_value: PositionInfo = {
        tick_lower_index: value.tick_lower_index,
        tick_upper_index: value.tick_upper_index,
        coin_type_a: value.coin_type_a,
        coin_type_b: value.coin_type_b,
        pos_object_id: value.pos_object_id,
        liquidity: new BN(value.liquidity),
        lower_bounder_coin_a_amount: new BN(0),
        upper_bounder_coin_b_amount: new BN(0),
        tick_lower_coin_a_price: TickMath.tickIndexToPrice(value.tick_lower_index, coin_a_decimals, coin_b_decimals).toNumber(),
        tick_upper_coin_a_price: TickMath.tickIndexToPrice(value.tick_upper_index, coin_a_decimals, coin_b_decimals).toNumber(),
        tick_lower_coin_b_price: d(1).div(TickMath.tickIndexToPrice(value.tick_lower_index, coin_a_decimals, coin_b_decimals)).toNumber(),
        tick_upper_coin_b_price: d(1).div(TickMath.tickIndexToPrice(value.tick_upper_index, coin_a_decimals, coin_b_decimals)).toNumber(),        
        fee_coin_a_claimed_total: new BN(0),
        fee_coin_b_claimed_total: new BN(0),
        fee_value_in_u_claimed_total:0,
        reward_amount_claimed_total: [],
        reward_value_in_u_claimed_total: 0,   
        init_tick: main_pool.current_tick_index,
        position_opened: true,
        on_position_times: 1,
        short_times_on_base_coin: 0
      }

      // calc lower_bounder_coin_a_amount and upper_bounder_coin_b_amount
      var  coinAmountsAtBounder =  ClmmPoolUtil.getCoinAmountFromLiquidity(position_info_init_value.liquidity, TickMath.tickIndexToSqrtPriceX64(value.tick_lower_index), 
        TickMath.tickIndexToSqrtPriceX64(value.tick_lower_index), 
        TickMath.tickIndexToSqrtPriceX64(value.tick_upper_index), true)
      position_info_init_value.lower_bounder_coin_a_amount = coinAmountsAtBounder.coinA.clone()

      coinAmountsAtBounder =  ClmmPoolUtil.getCoinAmountFromLiquidity(position_info_init_value.liquidity, TickMath.tickIndexToSqrtPriceX64(value.tick_upper_index), 
        TickMath.tickIndexToSqrtPriceX64(value.tick_lower_index), 
        TickMath.tickIndexToSqrtPriceX64(value.tick_upper_index), true)
      position_info_init_value.upper_bounder_coin_b_amount = coinAmountsAtBounder.coinB.clone()
      
      position_info_map.set(key, position_info_init_value)      
    }


    // update other field
    var posinfo = position_info_map.get(key)!
    if (value.pos_object_id != posinfo.pos_object_id) {
      console.log('%s [warning] syncOpenedPosition: tick index %d, pos_object_id retrieved: %s, pos_object_id in map:%s. update performed.', 
                  date.toLocaleString(), key, value.pos_object_id, posinfo.pos_object_id)
      fs.appendFileSync(fileName, util.format('%s [warning] syncOpenedPosition: tick index %d, pos_object_id retrieved: %s, pos_object_id in map:%s. update performed.\n', 
                  date.toLocaleString(), key, value.pos_object_id, posinfo.pos_object_id))
      fs.appendFileSync(fileNameBrief, util.format('%s [warning] syncOpenedPosition: tick index %d, pos_object_id retrieved: %s, pos_object_id in map:%s. update performed.\n', 
                  date.toLocaleString(), key, value.pos_object_id, posinfo.pos_object_id))
      posinfo.pos_object_id = value.pos_object_id
    } else if (value.liquidity != posinfo.liquidity.toString()) {
      console.log('%s [warning] syncOpenedPosition: tick index %d, liquidity retrieved: %s, liquidity in map:%s. update performed.', 
        date.toLocaleString(), key, value.liquidity, posinfo.liquidity.toString())
      fs.appendFileSync(fileName, util.format('%s [warning] syncOpenedPosition: tick index %d, liquidity retrieved: %s, liquidity in map:%s. update performed.\n', 
        date.toLocaleString(), key, value.liquidity, posinfo.liquidity.toString()))
      fs.appendFileSync(fileNameBrief, util.format('%s [warning] syncOpenedPosition: tick index %d, liquidity retrieved: %s, liquidity in map:%s. update performed.\n', 
        date.toLocaleString(), key, value.liquidity, posinfo.liquidity.toString()))
      posinfo.liquidity = new BN(value.liquidity)
    }
  }
}



// slippage by denominator of swap amount, not total position liquidity
function isChangeFinished(coinWalletAmountsEst: CoinAmounts, coinWalletAmountsNew: CoinAmounts, coinDenominator: CoinAmounts, { numerator, denominator }: Percentage) : boolean {
  
  var coinA: BN = new BN(0)
  var coinB: BN = new BN(0)
  var slippageA: Decimal
  var slippageB: Decimal
  var slippage: Decimal = d(numerator.toString()).div(d(denominator.toString()))

  if (coinDenominator.coinA.eqn(0)) {
    slippageA = d(0.0)
  } else {
    if (coinWalletAmountsEst.coinA.gte(coinWalletAmountsNew.coinA)) {
      coinA = coinWalletAmountsEst.coinA.sub(coinWalletAmountsNew.coinA)
    } else {
      coinA = coinWalletAmountsNew.coinA.sub(coinWalletAmountsEst.coinA)
    }
    slippageA = d(coinA.toString()).div(d(coinDenominator.coinA.toString()))
  }

  if (coinDenominator.coinB.eqn(0)) {
    slippageB = d(0.0)
  } else {
    if (coinWalletAmountsEst.coinB.gte(coinWalletAmountsNew.coinB)) {
      coinB = coinWalletAmountsEst.coinB.sub(coinWalletAmountsNew.coinB)
    } else {
      coinB = coinWalletAmountsNew.coinB.sub(coinWalletAmountsEst.coinB)
    }
    slippageB = d(coinB.toString()).div(d(coinDenominator.coinB.toString()))
  }

  date.setTime(Date.now())
  console.log('%s [info] isChangeFinished: slippageA : %d%%', date.toLocaleString(), slippageA.toNumber() * 100)
  console.log('%s [info] isChangeFinished: slippageB : %d%%', date.toLocaleString(), slippageB.toNumber() * 100)
  fs.appendFileSync(fileName, util.format('%s [info] isChangeFinished: slippageA : %d%%\n', date.toLocaleString(), slippageA.toNumber() * 100))
  fs.appendFileSync(fileName, util.format('%s [info] isChangeFinished: slippageB : %d%%\n', date.toLocaleString(), slippageB.toNumber() * 100))

  if (slippageA.lte(slippage) && slippageB.lte(slippage)) {
    return true
  }
  
  return false;
}


async function waitOperationFinish(account_address:string, coinWalletAmountEst: CoinAmounts, coinDenominator: CoinAmounts, slippage: Percentage):Promise<CoinAmounts> { 
  // get cur wallet balance
  const CoinBalance = await SDK.fullClient.getAllBalances({owner: account_address})
  var coinWalletAmountNew: CoinAmounts = {coinA: new BN(0), coinB: new BN(0)}
  for (const coin of CoinBalance) {
    switch(getCoinTypeEnum(coin.coinType)) {
      case coin_a_type:
        coinWalletAmountNew.coinA = new BN(coin.totalBalance)
        break;
      case coin_b_type:
        coinWalletAmountNew.coinB = new BN(coin.totalBalance)
        break;
      default:
        break;
    }
  }

  date.setTime(Date.now())
  console.log('%s [info] waitOperationFinish: wallet est: coin a : %s, coin b : %s', date.toLocaleString(), 
                coinWalletAmountEst.coinA.toString(), coinWalletAmountEst.coinB.toString())
  console.log('%s [info] waitOperationFinish: wallet new: coin a : %s, coin b : %s', date.toLocaleString(), 
                coinWalletAmountNew.coinA.toString(), coinWalletAmountNew.coinB.toString())
  console.log('%s [info] waitOperationFinish: denominator: coin a : %s, coin b : %s', date.toLocaleString(), 
                coinDenominator.coinA.toString(), coinDenominator.coinB.toString())
  console.log('%s [info] waitOperationFinish: slippage : %d%%', date.toLocaleString(), 
                d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100))

  fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish: wallet est: coin a : %s, coin b : %s\n', date.toLocaleString(), 
                coinWalletAmountEst.coinA.toString(), coinWalletAmountEst.coinB.toString()))
  fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish: wallet new: coin a : %s, coin b : %s\n', date.toLocaleString(), 
                coinWalletAmountNew.coinA.toString(), coinWalletAmountNew.coinB.toString()))
  fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish: denominator: coin a : %s, coin b : %s\n', date.toLocaleString(), 
                coinDenominator.coinA.toString(), coinDenominator.coinB.toString()))
  fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish: slippage : %d%%\n', date.toLocaleString(), 
                d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100)))

  var cycle_count = 0
  var RETRY_COUNT_MAX = 15
  // if swap not finished, wait and continue; try 15 times
  while(!isChangeFinished(coinWalletAmountEst, coinWalletAmountNew, coinDenominator, slippage) && cycle_count < RETRY_COUNT_MAX) {
    date.setTime(Date.now())
    console.log('%s [info] waitOperationFinish: wallet balance change is processing. check later...', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish: wallet balance change is processing. check later...\n', date.toLocaleString()))

    await new Promise(f => setTimeout(f, 1000));

    const CoinBalance = await SDK.fullClient.getAllBalances({owner: account_address})
    // console.log(CoinBalance)
    for (const coin of CoinBalance) {
      switch(getCoinTypeEnum(coin.coinType)) {
        case coin_a_type:
          coinWalletAmountNew.coinA = new BN(coin.totalBalance)
          break;
        case coin_b_type:
          coinWalletAmountNew.coinB = new BN(coin.totalBalance)
          break;
        default:
          break;
      }
    }
    date.setTime(Date.now())
    console.log('%s [info] waitOperationFinish: wallet est: coin a : %s, coin b : %s', date.toLocaleString(), 
        coinWalletAmountEst.coinA.toString(), coinWalletAmountEst.coinB.toString())
    console.log('%s [info] waitOperationFinish: wallet new: coin a:%s, coin b:%s', date.toLocaleString(), 
        coinWalletAmountNew.coinA.toString(), coinWalletAmountNew.coinB.toString())
    console.log('%s [info] waitOperationFinish: denominator: coin a : %s, coin b : %s', date.toLocaleString(), 
            coinDenominator.coinA.toString(), coinDenominator.coinB.toString())
    console.log('%s [info] waitOperationFinish: slippage : %d%%', date.toLocaleString(), 
            d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100))

    fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish: wallet est: coin a:%s, coin b:%s\n', date.toLocaleString(), 
        coinWalletAmountEst.coinA.toString(), coinWalletAmountEst.coinB.toString()))
    fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish: wallet new: coin a:%s, coin b:%s\n', date.toLocaleString(), 
        coinWalletAmountNew.coinA.toString(), coinWalletAmountNew.coinB.toString()))
    fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish: denominator: coin a : %s, coin b : %s\n', date.toLocaleString(), 
            coinDenominator.coinA.toString(), coinDenominator.coinB.toString()))
    fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish: slippage : %d%%\n', date.toLocaleString(), 
            d(slippage.numerator.toString()).div(slippage.denominator.toString()).mul(100)))

    cycle_count ++
  }

  date.setTime(Date.now())  
  if (cycle_count >= RETRY_COUNT_MAX) {
    console.log('%s [warning] waitOperationFinish: wallet balance change check timeout', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [warning] waitOperationFinish:  wallet balance change check timeout\n', date.toLocaleString()))
    fs.appendFileSync(fileNameBrief, util.format('%s [warning] waitOperationFinish:  wallet balance change check timeout\n', date.toLocaleString()))
  } else {
    console.log('%s [info] waitOperationFinish: wallet balance change is finished', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [info] waitOperationFinish:  wallet balance change is finished\n', date.toLocaleString()))
  }

  return coinWalletAmountNew
}





















































type LastPosChangeInfo = {
  direction: boolean;
  from: number;
  to: number;
  cycle_count: number;
}



// enum POS_CHANGE_STATUS {  
//   IN_POS = 0,
//   UP_IN_WINDOW,
//   DOWN_IN_WINDOW,
//   POS_CHANGE_STATUS_MAX
// }







async function main() {
  const sendKeypair = Ed25519Keypair.deriveKeypair(mnemonics, path)
  SDK.senderAddress = sendKeypair.getPublicKey().toSuiAddress()
  console.log(SDK.senderAddress)

  var account_address = sendKeypair.getPublicKey().toSuiAddress()

  var main_pool = await SDK.Pool.getPool(main_pool_address)
  const position_list = await SDK.Position.getPositionList(account_address, [main_pool_address,], false)



  // var cur_base_tick_range_count = BASE_TICK_RANGE_COUNT
  // var cur_position_tick_round_seed = POSITION_TICK_ROUND_SEED
  // var cur_position_tick_range = BASE_TICK_RANGE * cur_base_tick_range_count

  // var last_base_pos_change_info: LastPosChangeInfo = { direction: true, from: 0, to: 0, cycle_count: 999999999}  
  // var max_cycle_count = 180 // 30min * 6



  var cur_position_tick_index: number = POSITION_TICK_ROUND_SEED + Math.floor((main_pool.current_tick_index - POSITION_TICK_ROUND_SEED) / POSITION_TICK_RANGE) * POSITION_TICK_RANGE
  var cur_position_tick_index_high_bounder = cur_position_tick_index + POSITION_TICK_RANGE

  var cur_base_tick_index: number = POSITION_TICK_ROUND_SEED + Math.floor((main_pool.current_tick_index - POSITION_TICK_ROUND_SEED) / BASE_TICK_RANGE) * BASE_TICK_RANGE
  var cur_base_tick_index_high_bounder: number = cur_base_tick_index + BASE_TICK_RANGE




  var position_info_map = new Map<number, PositionInfo>();
  if (fs.existsSync(fileNamePositionInfo)) {
    try {
      var raw_file: string = fs.readFileSync(fileNamePositionInfo).toString()
      
      var position_info_adapter = new Map<number, PositionInfoAdapter>(JSON.parse(raw_file));
      for (const [key, value] of position_info_adapter) {
        position_info_map.set(key, transferFromPositionInfoAdapter(value))
      }
    } catch(e) {
      date.setTime(Date.now())
      if (e instanceof Error) {
        console.error('%s [error] load %s get an exception:\n%s \n%s \n%s', date.toLocaleString(), fileNamePositionInfo, e.message, e.name, e.stack)
        fs.appendFileSync(fileName, util.format('%s [error] load %s get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), fileNamePositionInfo, e.message, e.name, e.stack))
        fs.appendFileSync(fileNameBrief, util.format('%s [error] load %s get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), fileNamePositionInfo, e.message, e.name, e.stack))
      } else {
        console.error('load position_info_adapter.json get an exception'); console.error(e);
        fs.appendFileSync(fileName,'load position_info_adapter.json get an exception\n')
        fs.appendFileSync(fileNameBrief,'load position_info_adapter.json get an exception\n')
      }
      position_info_map.clear()
    }

    var raw: string = JSON.stringify(Array.from(position_info_map.entries()), null, '\t')
    date.setTime(Date.now())
    console.log('%s [info] Init: loaded position_info_map info\n%s.', date.toLocaleString(), raw)
    fs.appendFileSync(fileName, util.format('%s [info] Init: loaded position_info_map info\n%s.\n', date.toLocaleString(), raw))    
  }

  syncOpenedPosition(main_pool, position_list, position_info_map)





  // init opened position array
  var opened_position_lower_tick_array = new Array<number>();
  for (let i = 0; i < position_list.length; i ++) {
    opened_position_lower_tick_array.push(position_list[i].tick_lower_index)
  }
  opened_position_lower_tick_array.sort()


  // opened pos amount check
  if (opened_position_lower_tick_array.length > MAX_POSITION_ADDED) {    
    dumpOpenedPositionInfo(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)
    dumpOpenedPositionInfoToFile(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)

    date.setTime(Date.now())
    console.log('%s [warning] Init: Current pos amount is greater than %d.', date.toLocaleString(), MAX_POSITION_ADDED)
    fs.appendFileSync(fileName, util.format('%s [warning] Init: Current pos amount is greater than %d\n', date.toLocaleString(), MAX_POSITION_ADDED))    
    fs.appendFileSync(fileNameBrief, util.format('%s [warning] Init: Current pos amount is greater than %d\n', date.toLocaleString(), MAX_POSITION_ADDED))   
    // return
  }


  // is opened pos discrete check
  var discrete_opened_position = false
  if (opened_position_lower_tick_array.length > 1) {
    for (let i = 0; i < opened_position_lower_tick_array.length - 1; i++) {
      if (opened_position_lower_tick_array[i] + POSITION_TICK_RANGE < opened_position_lower_tick_array[i + 1]) {
        discrete_opened_position = true
        break
        // return
      }  
    }
  }
  if (discrete_opened_position) {
    dumpOpenedPositionInfo(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)
    dumpOpenedPositionInfoToFile(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)

    date.setTime(Date.now())
    console.log('%s [warning] Init: existing position group is not continuous.', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [warning] Init: existing position group is not continuous.\n', date.toLocaleString()))
    fs.appendFileSync(fileNameBrief, util.format('%s [warning] Init: existing position group is not continuous.\n', date.toLocaleString()))
  }


  // is cur in opened pos check
  var cur_pos_in_opened_pos = false
  for (let i = 0; i < opened_position_lower_tick_array.length; i++) {
    if (cur_position_tick_index == opened_position_lower_tick_array[i]) {
      cur_pos_in_opened_pos = true
      break;
    }
  }
  if (cur_pos_in_opened_pos == false) {
    dumpOpenedPositionInfo(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)
    dumpOpenedPositionInfoToFile(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)

    date.setTime(Date.now())
    console.log('%s [warning] Init: Current tick is out of position group range.', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('%s [warning] Init: Current tick is out of position group range.\n', date.toLocaleString()))
    fs.appendFileSync(fileNameBrief, util.format('%s [warning] Init: Current tick is out of position group range.\n', date.toLocaleString()))
    // return
  }

  var cur_position_tick_index_old: number = cur_position_tick_index
  var cur_base_tick_index_old: number = cur_base_tick_index
  

  var counter: number = 0

  process.on('SIGINT', function () {
    date.setTime(Date.now())
    console.info('%s [info] SIGINT received. Dump all position info and exit...', date.toLocaleString())
    fs.appendFileSync(fileName,util.format('%s [info] SIGINT received. Dump all position info and exit...\n', date.toLocaleString()))

    dumpAllPositionInfo(cur_position_tick_index, position_info_map)
    dumpAllPositionInfoToFile(cur_position_tick_index, position_info_map)

    // dump position_info_map to json file
    var position_info_adapter_map = new Map<number, PositionInfoAdapter>();
    for (const [key, value] of position_info_map) {
      position_info_adapter_map.set(key, transferToPositionInfoAdapter(value))
    }  
    var raw: string = JSON.stringify(Array.from(position_info_adapter_map.entries()), null, '\t')

    var fileNamePositionInfoBackup: string = 'position_info_adapter_' + date.toISOString().substring(0, 10) + '.json'
    if (!fs.existsSync(fileNamePositionInfoBackup)) {
      fs.writeFileSync(fileNamePositionInfoBackup, raw)
    }

    if (fs.existsSync(fileNamePositionInfo)) {
      fs.truncateSync(fileNamePositionInfo)
    }    
    fs.writeFileSync(fileNamePositionInfo, raw)

    process.exit();
  });



  var POS_CHANGE_STATUS_IN_POS: number = 0
  var POS_CHANGE_STATUS_UP_IN_WINDOW: number = 1
  var POS_CHANGE_STATUS_DOWN_IN_WINDOW: number = 2
  var POS_CHANGE_STATUS_POS_CHANGE_STATUS_MAX: number = 3

  var pos_change_status: number = POS_CHANGE_STATUS_IN_POS
  // var pos_change_status = POS_CHANGE_STATUS_IN_POS
  var pos_change_status_old = POS_CHANGE_STATUS_IN_POS
  var pos_change_tick_index_old: number = cur_position_tick_index




   

  for (;;) {
    await new Promise(f => setTimeout(f, 10000)); // 10s

    date.setTime(Date.now())
    console.log('\n\n\n%s [info]  ========= New Cycle ======== ', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('\n\n\n%s [info]  ========= New Cycle ======== \n', date.toLocaleString()))

    try {
      counter++
      if (counter > 100000 && counter % 5 == 0) {
        counter = 0
      }

      if (counter % 5 == 0) {
        const main_pool_temp = await SDK.Pool.getPool(main_pool_address)
        const position_list = await SDK.Position.getPositionList(account_address, [main_pool_address], false)
        syncOpenedPosition(main_pool_temp, position_list, position_info_map)
        
        cur_position_tick_index = POSITION_TICK_ROUND_SEED + Math.floor((main_pool.current_tick_index - POSITION_TICK_ROUND_SEED) / POSITION_TICK_RANGE) * POSITION_TICK_RANGE
        const CoinBalance = await SDK.fullClient.getAllBalances({owner: account_address})
        await statisticValuesInWUSDCPeriodicity(main_pool_temp, position_list, cur_position_tick_index, position_info_map, CoinBalance)

      }

      if (counter % 20 == 0) {
        dumpAllPositionInfo(cur_position_tick_index, position_info_map)
        dumpAllPositionInfoToFile(cur_position_tick_index, position_info_map)

        // dump position_info_map to json file
        var position_info_adapter_map = new Map<number, PositionInfoAdapter>();
        for (const [key, value] of position_info_map) {
          position_info_adapter_map.set(key, transferToPositionInfoAdapter(value))
        }
        var raw: string = JSON.stringify(Array.from(position_info_adapter_map.entries()), null, '\t')
        var fileNamePositionInfoBackup: string = 'position_info_adapter_' + date.toISOString().substring(0, 10) + '.json'
        if (!fs.existsSync(fileNamePositionInfoBackup)) {
          fs.writeFileSync(fileNamePositionInfoBackup, raw)
        }
        if (fs.existsSync(fileNamePositionInfo)) {
          fs.truncateSync(fileNamePositionInfo)
        }    
        fs.writeFileSync(fileNamePositionInfo, raw)
      }

      // max log file size 50M
      if (counter % 20 == 0) {
        if (fs.statSync(fileName).size >= 50 * 1024 * 1024) {
          date.setTime(Date.now())
          fileName = 'console-' + date.toISOString() + '.log';
          fileNameBrief = 'console-brief-' + date.toISOString() + '.log';
        }
      }
      
    } catch(e) {
      date.setTime(Date.now())
      if (e instanceof Error) {
        console.error('%s [error] periodically pre process get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack)
        fs.appendFileSync(fileName, util.format('%s [error] periodically pre process get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
        fs.appendFileSync(fileNameBrief, util.format('%s [error] periodically pre process get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
      } else {
        console.error('periodically pre process get an exception'); console.error(e);
        fs.appendFileSync(fileName,'periodically pre process get an exception\n')
        fs.appendFileSync(fileNameBrief,'periodically pre process get an exception\n')
      }
      continue
    }





    try {
      main_pool = await SDK.Pool.getPool(main_pool_address);
    } catch(e) {
      date.setTime(Date.now())
      if (e instanceof Error) {
        console.error('%s [error] New cycle getpool get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack)
        fs.appendFileSync(fileName, util.format('%s [error] New cycle getpool get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
        fs.appendFileSync(fileNameBrief, util.format('%s [error] New cycle getpool get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
      } else {
        console.error('New cycle getpool get an exception'); console.error(e);
        fs.appendFileSync(fileName,'New cycle getpool get an exception\n')
        fs.appendFileSync(fileNameBrief,'New cycle getpool get an exception\n')
      }
      continue
    }

    cur_position_tick_index = POSITION_TICK_ROUND_SEED + Math.floor((main_pool.current_tick_index - POSITION_TICK_ROUND_SEED) / POSITION_TICK_RANGE) * POSITION_TICK_RANGE
    cur_position_tick_index_high_bounder = cur_position_tick_index + POSITION_TICK_RANGE

    cur_base_tick_index = POSITION_TICK_ROUND_SEED + Math.floor((main_pool.current_tick_index - POSITION_TICK_ROUND_SEED) / BASE_TICK_RANGE) * BASE_TICK_RANGE
    cur_base_tick_index_high_bounder = cur_base_tick_index + BASE_TICK_RANGE





    // pos change event dump
    if (cur_base_tick_index != cur_base_tick_index_old) {      
      var base_updown = 'up'
      if (cur_base_tick_index < cur_base_tick_index_old) {
        base_updown = 'down'
      }
      var base_print_string = util.format('base: %s to %d, from %d', base_updown, cur_base_tick_index, cur_base_tick_index_old)

      var position_print_string = ''
      if (cur_position_tick_index != cur_position_tick_index_old) {
        var pos_updown = 'up'
        if (cur_position_tick_index < cur_position_tick_index_old) {
          pos_updown = 'down'
        }
        position_print_string = util.format('pos: %s to %d, from %d', pos_updown, cur_position_tick_index, cur_position_tick_index_old)
      }

      console.log('%s [info] position change event happen. %s\t  %s', date.toLocaleString(), base_print_string, position_print_string)
      fs.appendFileSync(fileName, util.format('%s [info] position change event happen. %s\t  %s\n', date.toLocaleString(), base_print_string, position_print_string))
      fs.appendFileSync(fileNamePosChangeEvent, util.format('%s [info] position change event happen. %s\t  %s\n', date.toLocaleString(), base_print_string, position_print_string))      
    }


    
    // last_base_pos_change_info.cycle_count ++
    // if (cur_base_tick_index != cur_base_tick_index_old) {
    //   var direction = cur_position_tick_index > cur_position_tick_index_old
    //   var base_range_count = (cur_position_tick_index > cur_position_tick_index_old) ? 
    //     (cur_position_tick_index - cur_position_tick_index_old) / BASE_TICK_RANGE : 
    //     (cur_position_tick_index_old - cur_position_tick_index) / BASE_TICK_RANGE
        

    //   if (last_base_pos_change_info.direction == direction) {
    //     cur_base_tick_range_count = d(max_cycle_count * base_range_count / last_base_pos_change_info.cycle_count).floor().add(1).toNumber()
    //     if (cur_base_tick_range_count < 1) {
    //       cur_base_tick_range_count = 1
    //     }
    //     if (cur_base_tick_range_count > 9) {
    //       cur_base_tick_range_count = 9
    //     }
    //     cur_position_tick_range = BASE_TICK_RANGE * cur_base_tick_range_count
    //   }
    //   last_base_pos_change_info.direction = direction
    //   last_base_pos_change_info.cycle_count = 0
    // }


    // pos change boundary protect
    if (cur_position_tick_index != cur_position_tick_index_old) {
      pos_change_status_old = pos_change_status
      switch (pos_change_status) {
        case POS_CHANGE_STATUS_IN_POS:
          pos_change_tick_index_old = cur_position_tick_index_old
          if (cur_position_tick_index > cur_position_tick_index_old) {
            pos_change_status = POS_CHANGE_STATUS_UP_IN_WINDOW            
          } else {
            pos_change_status = POS_CHANGE_STATUS_DOWN_IN_WINDOW
          }   
          break;
        case POS_CHANGE_STATUS_UP_IN_WINDOW:
          if (cur_position_tick_index > cur_position_tick_index_old) {
            pos_change_status = POS_CHANGE_STATUS_UP_IN_WINDOW
          } else { // cur_position_tick_index < cur_position_tick_index_old
            if (cur_position_tick_index == pos_change_tick_index_old) {
              pos_change_status = POS_CHANGE_STATUS_IN_POS
            } else {
              pos_change_status = POS_CHANGE_STATUS_DOWN_IN_WINDOW
            }
          }
          break;
        case POS_CHANGE_STATUS_DOWN_IN_WINDOW:
          if (cur_position_tick_index < cur_position_tick_index_old) {
            pos_change_status = POS_CHANGE_STATUS_DOWN_IN_WINDOW
          } else { // cur_position_tick_index > cur_position_tick_index_old
            if (cur_position_tick_index == pos_change_tick_index_old) {
              pos_change_status = POS_CHANGE_STATUS_IN_POS
            } else {
              pos_change_status = POS_CHANGE_STATUS_UP_IN_WINDOW
            }
          }
          break;
        default:
          pos_change_status = POS_CHANGE_STATUS_IN_POS
          break;
      }
      console.log('%s [info] pos_change_status update from %d to %d', date.toLocaleString(), pos_change_status_old, pos_change_status)
      fs.appendFileSync(fileName, util.format('%s [info] pos_change_status update from %d to %d\n', date.toLocaleString(), pos_change_status_old, pos_change_status))
      fs.appendFileSync(fileNameBrief, util.format('%s [info] pos_change_status update from %d to %d\n', date.toLocaleString(), pos_change_status_old, pos_change_status))
      pos_change_status_old = pos_change_status
    }

    if (pos_change_status == POS_CHANGE_STATUS_UP_IN_WINDOW) {
      if (main_pool.current_tick_index - cur_position_tick_index > 10) {
        pos_change_status = POS_CHANGE_STATUS_IN_POS
        pos_change_tick_index_old = cur_position_tick_index

        console.log('%s [info] pos_change_status update from %d to %d', date.toLocaleString(), pos_change_status_old, pos_change_status)
        fs.appendFileSync(fileName, util.format('%s [info] pos_change_status update from %d to %d\n', date.toLocaleString(), pos_change_status_old, pos_change_status))
        fs.appendFileSync(fileNameBrief, util.format('%s [info] pos_change_status update from %d to %d\n', date.toLocaleString(), pos_change_status_old, pos_change_status))
        pos_change_status_old = pos_change_status
      }
    }

    if (pos_change_status == POS_CHANGE_STATUS_DOWN_IN_WINDOW) {
      if (cur_position_tick_index + POSITION_TICK_RANGE - main_pool.current_tick_index > 10) {
        pos_change_status = POS_CHANGE_STATUS_IN_POS
        pos_change_tick_index_old = cur_position_tick_index

        console.log('%s [info] pos_change_status update from %d to %d', date.toLocaleString(), pos_change_status_old, pos_change_status)
        fs.appendFileSync(fileName, util.format('%s [info] pos_change_status update from %d to %d\n', date.toLocaleString(), pos_change_status_old, pos_change_status))
        fs.appendFileSync(fileNameBrief, util.format('%s [info] pos_change_status update from %d to %d\n', date.toLocaleString(), pos_change_status_old, pos_change_status))
        pos_change_status_old = pos_change_status
      }
    }




    // dump pool cur info
    dumpCurPoolInfo(main_pool, cur_position_tick_index, cur_position_tick_index_high_bounder)
    dumpCurPoolInfoToFile(main_pool, cur_position_tick_index, cur_position_tick_index_high_bounder)


    // dump opened position info
    dumpOpenedPositionInfo(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)
    dumpOpenedPositionInfoToFile(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)


    // huge price change, maybe cross 1 pos in 10s
    if (Math.abs(cur_position_tick_index - cur_position_tick_index_old) > POSITION_TICK_RANGE) {
      date.setTime(Date.now())
      console.log('%s [warning] Huge price change. old tick low boundary %d, new tick low boundray %d, cur tick %d', 
                date.toLocaleString(), cur_position_tick_index_old, cur_position_tick_index, main_pool.current_tick_index)
      fs.appendFileSync(fileName, util.format('%s [warning] Huge price change. old tick low boundary %d, new tick low boundray %d, cur tick %d\n', 
                date.toLocaleString(), cur_position_tick_index_old, cur_position_tick_index, main_pool.current_tick_index))
      fs.appendFileSync(fileNameBrief, util.format('%s [warning] Huge price change. old tick low boundary %d, new tick low boundray %d, cur tick %d\n', 
                date.toLocaleString(), cur_position_tick_index_old, cur_position_tick_index, main_pool.current_tick_index))
      // continue
    }






    // TODO: pos tick change in close -> open -> swap process

    date.setTime(Date.now())
    console.log('\n%s [info] == check open or close position == ', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('\n%s [info] == check open or close position == \n', date.toLocaleString()))

    var need_open_position = false;
    var position_index_to_open: number = 0;

    var need_close_position = false;
    var position_index_to_close: number[] = []; // huge price change and course discrete, will close all 2 pos



    var position_index_to_open_for_print: number[] = []
    var opened_position_lower_tick_array_new: number[] = [cur_position_tick_index]

    if (pos_change_status == POS_CHANGE_STATUS_IN_POS) {
      // check if need open or close position
      // open
      need_open_position = true
      position_index_to_open = cur_position_tick_index
      position_index_to_open_for_print = [cur_position_tick_index]
      for (const idx of opened_position_lower_tick_array) {
        if (cur_position_tick_index == idx) {
          need_open_position = false
          position_index_to_open = 0
          position_index_to_open_for_print.splice(0, 1)
          break;
        }
      }

      // close
      position_index_to_close = [...opened_position_lower_tick_array]
      var opened_position_lower_tick_array_new: number[] = [cur_position_tick_index]

      var found_index = position_index_to_close.indexOf(cur_position_tick_index)
      if (found_index != -1) {
        position_index_to_close.splice(found_index, 1)
      }

      var pos_index_to_check = 0
      var pos_index_exist = false
      while(true) {
        // no need to close, or exist pos is enough
        if (position_index_to_close.length <= 0 || opened_position_lower_tick_array_new.length >= MAX_POSITION_ADDED) {
          break
        }

        pos_index_exist = false
        // upper pos first     
        pos_index_to_check = opened_position_lower_tick_array_new[opened_position_lower_tick_array_new.length - 1] + POSITION_TICK_RANGE      
        found_index = position_index_to_close.indexOf(pos_index_to_check)
        if (found_index != -1) {
          position_index_to_close.splice(found_index, 1)
          opened_position_lower_tick_array_new.push(pos_index_to_check)
          opened_position_lower_tick_array_new.sort()
          pos_index_exist = true
        }
        if (!pos_index_exist) {
          pos_index_to_check = opened_position_lower_tick_array_new[0] - POSITION_TICK_RANGE
          found_index = position_index_to_close.indexOf(pos_index_to_check)
          if (found_index != -1) {
            position_index_to_close.splice(found_index, 1)
            opened_position_lower_tick_array_new.push(pos_index_to_check)
            opened_position_lower_tick_array_new.sort()
            pos_index_exist = true
          }
        }
        // remain pos is discrete
        if (!pos_index_exist) {
          break
        }
      }
      if (position_index_to_close.length) {
        need_close_position = true
      }
    }

    console.log('%s [info] existing_position_before: %s', date.toLocaleString(), opened_position_lower_tick_array.toString())
    console.log('%s [info] position_to_open: %s', date.toLocaleString(), position_index_to_open_for_print.toString())
    console.log('%s [info] position_to_close: %s', date.toLocaleString(), position_index_to_close.toString())
    console.log('%s [info] existing_position_after: %s', date.toLocaleString(), opened_position_lower_tick_array_new.toString())

    fs.appendFileSync(fileName, util.format('%s [info] existing_position_before: %s\n', date.toLocaleString(), opened_position_lower_tick_array.toString()))
    fs.appendFileSync(fileName, util.format('%s [info] position_to_open: %s\n', date.toLocaleString(), position_index_to_open_for_print.toString()))
    fs.appendFileSync(fileName, util.format('%s [info] position_to_close: %s\n', date.toLocaleString(), position_index_to_close.toString()))
    fs.appendFileSync(fileName, util.format('%s [info] existing_position_after: %s\n', date.toLocaleString(), opened_position_lower_tick_array_new.toString()))

    if (position_index_to_open_for_print.length || position_index_to_close.length) {
      fs.appendFileSync(fileNameBrief, util.format('\n%s [info] == check open or close position == \n', date.toLocaleString()))
      fs.appendFileSync(fileNameBrief, util.format('%s [info] existing_position_before: %s\n', date.toLocaleString(), opened_position_lower_tick_array.toString()))
      fs.appendFileSync(fileNameBrief, util.format('%s [info] position_to_open: %s\n', date.toLocaleString(), position_index_to_open_for_print.toString()))
      fs.appendFileSync(fileNameBrief, util.format('%s [info] position_to_close: %s\n', date.toLocaleString(), position_index_to_close.toString()))
      fs.appendFileSync(fileNameBrief, util.format('%s [info] existing_position_after: %s\n', date.toLocaleString(), opened_position_lower_tick_array_new.toString()))
    }




















    date.setTime(Date.now())
    console.log('\n%s [info] == close position process == ', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('\n%s [info] == close position process == \n', date.toLocaleString()))

    // close position process
    if (need_close_position) {
      fs.appendFileSync(fileNameBrief, util.format('\n%s [info] == close position process == \n', date.toLocaleString()))
      var exception_catched = false
      for (var i = 0; i < position_index_to_close.length; i++) {
        try {
          date.setTime(Date.now())
          console.log('%s [info] need_close_position: %d', date.toLocaleString(), position_index_to_close[i])
          fs.appendFileSync(fileName, util.format('%s [info] need_close_position: %d\n', date.toLocaleString(), position_index_to_close[i]))
          fs.appendFileSync(fileNameBrief, util.format('%s [info] need_close_position: %d\n', date.toLocaleString(), position_index_to_close[i]))

          // pre check and fetch pos_object_id to close
          var pos_obj_id_fetched: boolean = false
          if (position_info_map.has(position_index_to_close[i])) {
            var pos = position_info_map.get(position_index_to_close[i])!
            if (pos.pos_object_id == '') {
              date.setTime(Date.now())
              console.log('%s [warning] close position: missing pos_object_id, try to fetch by getPositionList', date.toLocaleString())
              fs.appendFileSync(fileName, util.format('%s [warning] close position: missing pos_object_id, try to fetch by getPositionList\n', date.toLocaleString()))
              fs.appendFileSync(fileNameBrief, util.format('%s [warning] close position: missing pos_object_id, try to fetch by getPositionList\n', date.toLocaleString()))
              const position_list = await SDK.Position.getPositionList(account_address, [main_pool_address,], false); 
              for (var pos_idx = 0; pos_idx < position_list.length; pos_idx++) {
                if (position_list[pos_idx].tick_lower_index == position_index_to_close[i]) {
                  pos.pos_object_id = position_list[pos_idx].pos_object_id
                  pos_obj_id_fetched = true
                  break
                }
              }
            } else {
              pos_obj_id_fetched = true
            }
          } else {
            // can not be happen
            date.setTime(Date.now())
            console.log('%s [error] close position fail: pos entry is not exist', date.toLocaleString())
            fs.appendFileSync(fileName, util.format('%s [error] close position fail: pos entry is not exist\n', date.toLocaleString()))
            fs.appendFileSync(fileNameBrief, util.format('%s [error] close position fail: pos entry is not exist\n', date.toLocaleString()))
          }

          if (pos_obj_id_fetched) {
            var pos = position_info_map.get(position_index_to_close[i])!

            // add past reward and fee info into position_info_map
            const posRewardParamsList: FetchPosRewardParams[] = []
            const posFeeParamsList: FetchPosFeeParams[] = []
            posRewardParamsList.push({
              poolAddress: main_pool.poolAddress,
              positionId: pos.pos_object_id,
              rewarderInfo: main_pool.rewarder_infos,
              coinTypeA: main_pool.coinTypeA,
              coinTypeB: main_pool.coinTypeB,
            })
            posFeeParamsList.push({
              poolAddress: main_pool.poolAddress,
              positionId: pos.pos_object_id,
              coinTypeA: main_pool.coinTypeA,
              coinTypeB: main_pool.coinTypeB,
            })
            const collectFeesQuote: CollectFeesQuote[] = await SDK.Rewarder.fetchPosFeeAmount(posFeeParamsList)
            const posRewarderResult: PosRewarderResult[] = await SDK.Rewarder.fetchPosRewardersAmount(posRewardParamsList)            



              // get all pool may need
            var pool_map = new Map<string, Pool>()
            pool_map.set(main_pool_address, main_pool)

            for (const [key, value] of relative_coin_info) {
              for(const pool_info of value.coin_swap_path_to_u) {
                if (!pool_map.has(pool_info.pool_address)) {
                  var pool = await SDK.Pool.getPool(pool_info.pool_address);
                  pool_map.set(pool_info.pool_address, pool)
                }
              }
            }


            var fee_coin_map = new Map<COIN_TYPE, CoinValueCalc>()
            fee_coin_map.set(coin_a_type, {amount_owed: collectFeesQuote[0].feeOwedA.clone(), price_in_u: 1, value_in_u: 0})
            fee_coin_map.set(coin_b_type, {amount_owed: collectFeesQuote[0].feeOwedB.clone(), price_in_u: 1, value_in_u: 0})
            var fee_value = calcValueInU(fee_coin_map, pool_map, 'fee')        
        
            var reward_coin_map = new Map<COIN_TYPE, CoinValueCalc>()
            for (const rwd_coin of posRewarderResult[0].rewarderAmountOwed) {
              var coin_type = getCoinTypeEnum(rwd_coin.coin_address)
              if (coin_type != COIN_TYPE.COIN_TYPE_MAX) {
                reward_coin_map.set(coin_type, {amount_owed: rwd_coin.amount_owed.clone(), price_in_u: 1, value_in_u: 0})
              } else {
                console.log('%s [warning] close position: unrecognized coin in reward: %s', date.toLocaleString(), rwd_coin.coin_address)
                fs.appendFileSync(fileName, util.format('%s [warning] close position: unrecognized coin in reward: %s', date.toLocaleString(), rwd_coin.coin_address))
                fs.appendFileSync(fileNameBrief, util.format('%s [warning] close position: unrecognized coin in reward: %s', date.toLocaleString(), rwd_coin.coin_address))
              }      
            }
            var reward_value = calcValueInU(reward_coin_map, pool_map, 'reward')

            






            // var rwd = calcRewardValueInWUSDC(posRewarderResult[0].rewarderAmountOwed, poolTmp.current_sqrt_price, cetus_wusdc_pool_temp.current_sqrt_price)
            // var fee = calcFeeValueInWUSDC(collectFeesQuote[0], poolTmp.current_sqrt_price)
            // pos.reward_cetus_total.iadd(rwd.reward_cetus)
            // pos.reward_sui_total.iadd(rwd.reward_sui)
            // pos.reward_wusdc_total.iadd(rwd.reward_wusdc)
            // pos.reward_value_in_wusdc_total += (rwd.total_reward_value_in_wusdc)

            // pos.fee_sui_total.iadd(fee.fee_coin_b)
            // pos.fee_wusdc_total.iadd(fee.fee_coin_a)
            // pos.fee_value_in_wusdc_total += fee.total_fee_value_in_wusdc

           
            // pre get wallet balance for update success check
            // must get before close tx
            const CoinBalance = await SDK.fullClient.getAllBalances({owner: account_address})
            var coinWalletAmount: CoinAmounts = {coinA: new BN(0), coinB: new BN(0)}
            for (const coin of CoinBalance) {
              switch(getCoinTypeEnum(coin.coinType)) {
                case coin_a_type:
                  coinWalletAmount.coinA = new BN(coin.totalBalance)
                  break;
                case coin_b_type:
                  coinWalletAmount.coinB = new BN(coin.totalBalance)
                  break;
                default:
                  break;
              }
            }

            // var price = d(1).div(TickMath.tickIndexToPrice(position_index_to_close[i], 6, 9)).toNumber()
            // var cur_position_liquidity_in_wusdc = (price >= 2.0 ? position_liquidity_in_coin_a : new BN(position_liquidity_in_coin_a.toNumber() * price / 2.0))
            // console.log('%s [info] coin b upper price: %d, liquidity in coin a:%s', date.toLocaleString(), price, cur_position_liquidity_in_wusdc.toString())
            // fs.appendFileSync(fileName, util.format('%s [info] coin b upper price: %d, liquidity in coin a:%s', date.toLocaleString(), price, cur_position_liquidity_in_wusdc.toString()))   

            var liquidityBaselineInfo: LiquidityBaselineInfo = {
              coin_a: new BN(0),
              coin_b: new BN(0),
              liquidity: new BN(0),
              liquidity_in_coin_a: new BN(0),
              liquidity_in_coin_b: new BN(0)
            }
            getCurAndBounderCoinAmountFromLiquidity(main_pool, position_liquidity,
                              position_index_to_close[i], position_index_to_close[i] + POSITION_TICK_RANGE, liquidityBaselineInfo)

            var position_coin_map = new Map<COIN_TYPE, CoinValueCalc>()
            position_coin_map.set(coin_a_type, {amount_owed: liquidityBaselineInfo.coin_a.clone(), price_in_u: 1, value_in_u: 0})
            position_coin_map.set(coin_b_type, {amount_owed: liquidityBaselineInfo.coin_b.clone(), price_in_u: 1, value_in_u: 0})
            var position_value = calcValueInU(position_coin_map, pool_map, 'pos')

            // dump close info
            date.setTime(Date.now())
            var reward_print: string = ''
            for (const [key, value] of reward_coin_map) {
              reward_print += (relative_coin_info.get(key)!.coin_name + ': ' + value.amount_owed.toString() + '; ')
            }
            console.log('%s [info] est coin_a to remove : %s, est coin_b to remove : %s, total_position_value_in_u: %d', date.toLocaleString(), 
                                          liquidityBaselineInfo.coin_a.toString(), liquidityBaselineInfo.coin_b.toString(), position_value)
            console.log('%s [info] fee_coin_a to claim: %s, fee_coin_b to claim: %s, total_fee_value_in_u : %d', date.toLocaleString(), 
                                          fee_coin_map.get(coin_a_type)?.amount_owed.toString(), fee_coin_map.get(coin_b_type)?.amount_owed.toString(), fee_value)
            console.log('%s [info] reward: %s total_reward_value_in_u : %d', date.toLocaleString(), reward_print, reward_value)
            console.log('%s [info] total value in u: %d', date.toLocaleString(), position_value + fee_value + reward_value)


            fs.appendFileSync(fileName, util.format('%s [info] est coin_a to remove : %s, est coin_b to remove : %s, total_position_value_in_u: %d\n', date.toLocaleString(), 
                                          liquidityBaselineInfo.coin_a.toString(), liquidityBaselineInfo.coin_b.toString(), position_value))            
            fs.appendFileSync(fileName, util.format('%s [info] fee_coin_a to claim: %s, fee_coin_b to claim: %s, total_fee_value_in_u : %d\n', date.toLocaleString(), 
                                          fee_coin_map.get(coin_a_type)?.amount_owed.toString(), fee_coin_map.get(coin_b_type)?.amount_owed.toString(), fee_value))            
            fs.appendFileSync(fileName, util.format('%s [info] reward: %s total_reward_value_in_u : %d\n', date.toLocaleString(), reward_print, reward_value)) 
            fs.appendFileSync(fileName, util.format('%s [info] total value in u: %d\n', date.toLocaleString(), position_value + fee_value + reward_value))


            fs.appendFileSync(fileNameBrief, util.format('%s [info] est coin_a to remove : %s, est coin_b to remove : %s, total_position_value_in_u: %d\n', date.toLocaleString(), 
                                          liquidityBaselineInfo.coin_a.toString(), liquidityBaselineInfo.coin_b.toString(), position_value))            
            fs.appendFileSync(fileNameBrief, util.format('%s [info] fee_coin_a to claim: %s, fee_coin_b to claim: %s, total_fee_value_in_u : %d\n', date.toLocaleString(), 
                                          fee_coin_map.get(coin_a_type)?.amount_owed.toString(), fee_coin_map.get(coin_b_type)?.amount_owed.toString(), fee_value))            
            fs.appendFileSync(fileNameBrief, util.format('%s [info] reward: %s total_reward_value_in_u : %d\n', date.toLocaleString(), reward_print, reward_value)) 
            fs.appendFileSync(fileNameBrief, util.format('%s [info] total value in u: %d\n', date.toLocaleString(), position_value + fee_value + reward_value))

            // close position
            var rewardCoin: RewarderAmountOwed[] = [...posRewarderResult[0].rewarderAmountOwed]
            const rewardCoinTypes = rewardCoin.filter((item) => Number(item.amount_owed) > 0).map((item)=> item.coin_address)
            const success = await closePosition(main_pool, pos.pos_object_id, rewardCoinTypes, sendKeypair)
            if (success) {
              // wait for wallet balance change finished
              // calc coinWalletAmountEst
              var coinWalletAmountEst: CoinAmounts = {
                coinA: coinWalletAmount.coinA.add(liquidityBaselineInfo.coin_a),
                coinB: coinWalletAmount.coinB.add(liquidityBaselineInfo.coin_b)
              }

              // calc coinDenominator
              var coinDenominator: CoinAmounts = 
              {
                coinA: liquidityBaselineInfo.liquidity_in_coin_a.clone(),
                coinB: liquidityBaselineInfo.liquidity_in_coin_b.clone()
              }
              
              await waitOperationFinish(account_address, coinWalletAmountEst, coinDenominator, Percentage.fromDecimal(d(closeLiquiditySlippagePercent))) // liquidity sync check: 15%


              // update result
              for (const [key, value] of reward_coin_map) {
                var found = false
                for (const rwd_amt of pos.reward_amount_claimed_total) {
                  if (rwd_amt.coin_type == key) {
                    rwd_amt.amount_owed.iadd(value.amount_owed)
                    found = true
                    break
                  }
                }
                if (!found) {
                  pos.reward_amount_claimed_total.push({coin_type: key, amount_owed: value.amount_owed.clone()})
                }
              }
              pos.reward_value_in_u_claimed_total += reward_value

              pos.fee_coin_a_claimed_total.iadd(fee_coin_map.get(coin_a_type)!.amount_owed)
              pos.fee_coin_b_claimed_total.iadd(fee_coin_map.get(coin_b_type)!.amount_owed)
              pos.fee_value_in_u_claimed_total += fee_value


              pos.position_opened = false
              pos.pos_object_id = ''
        
              if (opened_position_lower_tick_array.indexOf(position_index_to_close[i]) != -1) {
                opened_position_lower_tick_array.splice(opened_position_lower_tick_array.indexOf(position_index_to_close[i]), 1)
                opened_position_lower_tick_array.sort()
              }
            } else {
              date.setTime(Date.now())
              console.log('%s [warning] close position fail: txn rsp indicate fail', date.toLocaleString())
              fs.appendFileSync(fileName, util.format('%s [warning] close position fail: txn rsp indicate fail\n', date.toLocaleString()))
              fs.appendFileSync(fileNameBrief, util.format('%s [warning] close position fail: txn rsp indicate fail\n', date.toLocaleString()))
            }            
          } else {
            date.setTime(Date.now())
            console.log('%s [warning] close position fail: missing pos_object_id', date.toLocaleString())
            fs.appendFileSync(fileName, util.format('%s [warning] close position fail: missing pos_object_id\n', date.toLocaleString()))
            fs.appendFileSync(fileNameBrief, util.format('%s [warning] close position fail: missing pos_object_id\n', date.toLocaleString()))
          }
          date.setTime(Date.now())
          console.log('%s [info] close process finished: %d', date.toLocaleString(), position_index_to_close[i])
          fs.appendFileSync(fileName, util.format('%s [info] close process finished: %d\n', date.toLocaleString(), position_index_to_close[i]))
          dumpOpenedPositionInfo(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)
          dumpOpenedPositionInfoToFile(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)
        } catch(e) {
          if (e instanceof Error) {
            console.error('%s [error] close position get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack)
            fs.appendFileSync(fileName, util.format('%s [error] close position get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
            fs.appendFileSync(fileNameBrief, util.format('%s [error] close position get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
          } else {
            console.error('close position get an exception'); console.error(e);
            fs.appendFileSync(fileName,'close position get an exception\n')
            fs.appendFileSync(fileNameBrief,'close position get an exception\n')
          }
          exception_catched = true
          break;
        }
      }

      if (exception_catched) {
        continue
      }

      need_close_position = false
      position_index_to_close = []
    }    








    date.setTime(Date.now())
    console.log('\n%s [info] == open position process == ', date.toLocaleString())
    fs.appendFileSync(fileName, util.format('\n%s [info] == open position process == \n', date.toLocaleString()))


    // open position proces
    if (need_open_position) {
      fs.appendFileSync(fileNameBrief, util.format('\n%s [info] == open position process == \n', date.toLocaleString()))
      try {
        date.setTime(Date.now())
        console.log('%s [info] need_open_position: %d', date.toLocaleString(), cur_position_tick_index)
        fs.appendFileSync(fileName, util.format('%s [info] need_open_position: %d\n', date.toLocaleString(), cur_position_tick_index))
        fs.appendFileSync(fileNameBrief, util.format('%s [info] need_open_position: %d\n', date.toLocaleString(), cur_position_tick_index))

        // var price = d(1).div(TickMath.tickIndexToPrice(cur_position_tick_index, 6, 9)).toNumber()
        // var cur_position_liquidity_in_wusdc = (price >= 2.0 ? position_liquidity_in_coin_a : new BN(position_liquidity_in_coin_a.toNumber() * price / 2.0))
        // console.log('%s [info] coin b upper price: %d, liquidity in coin a:%s', date.toLocaleString(), price, cur_position_liquidity_in_wusdc.toString())
        // fs.appendFileSync(fileName, util.format('%s [info] coin b upper price: %d, liquidity in coin a:%s', date.toLocaleString(), price, cur_position_liquidity_in_wusdc.toString()))  

        var liquidityBaselineInfo: LiquidityBaselineInfo = {
          coin_a: new BN(0),
          coin_b: new BN(0),
          liquidity: new BN(0),
          liquidity_in_coin_a: new BN(0),
          liquidity_in_coin_b: new BN(0)
        }
        getCurAndBounderCoinAmountFromLiquidity(main_pool, position_liquidity, 
                  cur_position_tick_index, cur_position_tick_index_high_bounder, liquidityBaselineInfo)
        
        // dump open pos info
        date.setTime(Date.now())
        console.log('%s [info] opened pos info: %d - (%d) - %d', date.toLocaleString(), 
                cur_position_tick_index, main_pool.current_tick_index, cur_position_tick_index_high_bounder)
        console.log('%s [info] opened pos info: liquidity : %s, liquidity_in_coin_a : %s, liquidity_in_coin_b : %s, coin_a : %s, coin_b : %s', date.toLocaleString(), 
                liquidityBaselineInfo.liquidity.toString(), 
                liquidityBaselineInfo.liquidity_in_coin_a.toString(), liquidityBaselineInfo.liquidity_in_coin_b.toString(), 
                liquidityBaselineInfo.coin_a.toString(), liquidityBaselineInfo.coin_b.toString())

        fs.appendFileSync(fileName, util.format('%s [info] opened pos info: %d - (%d) - %d\n', date.toLocaleString(), 
                cur_position_tick_index, main_pool.current_tick_index, cur_position_tick_index_high_bounder))
        fs.appendFileSync(fileName, util.format('%s [info] opened pos info: liquidity : %s, liquidity_in_coin_a : %s, liquidity_in_coin_b : %s, coin_a : %s, coin_b : %s\n', date.toLocaleString(),
                liquidityBaselineInfo.liquidity.toString(), 
                liquidityBaselineInfo.liquidity_in_coin_a.toString(), liquidityBaselineInfo.liquidity_in_coin_b.toString(), 
                liquidityBaselineInfo.coin_a.toString(), liquidityBaselineInfo.coin_b.toString()))

        fs.appendFileSync(fileNameBrief, util.format('%s [info] opened pos info: %d - (%d) - %d\n', date.toLocaleString(), 
                cur_position_tick_index, main_pool.current_tick_index, cur_position_tick_index_high_bounder))
        fs.appendFileSync(fileNameBrief, util.format('%s [info] opened pos info: liquidity : %s, liquidity_in_coin_a : %s, liquidity_in_coin_b : %s, coin_a : %s, coin_b : %s\n', date.toLocaleString(),
                liquidityBaselineInfo.liquidity.toString(), 
                liquidityBaselineInfo.liquidity_in_coin_a.toString(), liquidityBaselineInfo.liquidity_in_coin_b.toString(), 
                liquidityBaselineInfo.coin_a.toString(), liquidityBaselineInfo.coin_b.toString()))
              
      
        // the amount may change very fast near boundary
        // up to 5% slippage each coin; by denominator of total position liquidity amount
        const addLiquidityTotalSlippage = openLiquiditySlippagePercent / 100

        // var coinADelta = d(is_position_liquidity_in_coin_a? position_liquidity_in_coin.toString() : liquidityBaselineInfo.liquidity_in_coin_a.toString()).mul(addLiquidityTotalSlippage).ceil()
        // var coinBDelta = d(is_position_liquidity_in_coin_a? liquidityBaselineInfo.liquidity_in_coin_b.toString(): position_liquidity_in_coin.toString()).mul(addLiquidityTotalSlippage).ceil()
        var coinADelta = d(liquidityBaselineInfo.liquidity_in_coin_a.toString()).mul(addLiquidityTotalSlippage).ceil()
        var coinBDelta = d(liquidityBaselineInfo.liquidity_in_coin_b.toString()).mul(addLiquidityTotalSlippage).ceil()

        var coinAmounts: CoinAmounts = 
        {
          coinA: liquidityBaselineInfo.coin_a.add(new BN(coinADelta.toString())), 
          coinB: liquidityBaselineInfo.coin_b.add(new BN(coinBDelta.toString())) 
        }
      
        const CoinBalance = await SDK.fullClient.getAllBalances({owner: account_address})
        var coinWalletAmount: CoinAmounts = {coinA: new BN(0), coinB: new BN(0)}
        for (const coin of CoinBalance) {
          switch(getCoinTypeEnum(coin.coinType)) {
            case coin_a_type:
              coinWalletAmount.coinA = new BN(coin.totalBalance)
              break;
            case coin_b_type:
              coinWalletAmount.coinB = new BN(coin.totalBalance)
              break;
            default:
              break;
          }
        }
        
        var coinBufferAmount: CoinAmounts =         
        {
          coinA: wallet_balance_buffer_in_coin_a.clone(),
          coinB: wallet_balance_buffer_in_coin_b.clone()
        }
        
        // dump wallet info, and coin amount need for open pos
        date.setTime(Date.now())
        console.log('%s [info] wallet: coin a : %s, coin b : %s', date.toLocaleString(), 
                        coinWalletAmount.coinA.toString(), coinWalletAmount.coinB.toString())
        console.log('%s [info] wallet buffer: coin a : %s, coin b : %s', date.toLocaleString(), 
                        coinBufferAmount.coinA.toString(), coinBufferAmount.coinB.toString())
        console.log('%s [info] coin a allocated for open pos: %s = calc: %s + slippage: %s(total liquidity in coin a: %s * slippage rate: %d%%)', date.toLocaleString(), 
                        coinAmounts.coinA.toString(), liquidityBaselineInfo.coin_a.toString(), coinADelta.toString(), 
                        liquidityBaselineInfo.liquidity_in_coin_a.toString(), openLiquiditySlippagePercent)
        console.log('%s [info] coin b allocated for open pos: %s = calc: %s + slippage: %s(total liquidity in coin b: %s * slippage rate: %d%%)', date.toLocaleString(),
                        coinAmounts.coinB.toString(), liquidityBaselineInfo.coin_b.toString(), coinBDelta.toString(),
                        liquidityBaselineInfo.liquidity_in_coin_b.toString(), openLiquiditySlippagePercent)

        fs.appendFileSync(fileName, util.format('%s [info] wallet: coin a : %s, coin b : %s\n', date.toLocaleString(), 
                        coinWalletAmount.coinA.toString(), coinWalletAmount.coinB.toString()))
        fs.appendFileSync(fileName, util.format('%s [info] wallet buffer: coin a : %s, coin b : %s\n', date.toLocaleString(), 
                        coinBufferAmount.coinA.toString(), coinBufferAmount.coinB.toString()))
        fs.appendFileSync(fileName, util.format('%s [info] coin a allocated for open pos: %s = calc: %s + slippage: %s(total liquidity in coin a: %s * slippage rate: %d%%)\n', date.toLocaleString(), 
                        coinAmounts.coinA.toString(), liquidityBaselineInfo.coin_a.toString(), coinADelta.toString(), 
                        liquidityBaselineInfo.liquidity_in_coin_a.toString(), openLiquiditySlippagePercent))
        fs.appendFileSync(fileName, util.format('%s [info] coin b allocated for open pos: %s = calc: %s + slippage: %s(total liquidity in coin b: %s * slippage rate: %d%%)\n', date.toLocaleString(),
                        coinAmounts.coinB.toString(), liquidityBaselineInfo.coin_b.toString(), coinBDelta.toString(),
                        liquidityBaselineInfo.liquidity_in_coin_b.toString(), openLiquiditySlippagePercent))


        // fs.appendFileSync(fileNameBrief, util.format('%s [info] wallet: coin a : %s, coin b : %s\n', date.toLocaleString(), 
        //                 coinWalletAmount.coinA.toString(), coinWalletAmount.coinB.toString()))
        // fs.appendFileSync(fileNameBrief, util.format('%s [info] wallet buffer: coin a : %s, coin b : %s\n', date.toLocaleString(), 
        //                 coinBufferAmount.coinA.toString(), coinBufferAmount.coinB.toString()))
        // fs.appendFileSync(fileNameBrief, util.format('%s [info] coin a allocated for open pos: %s = calc: %s + slippage: %s(total liquidity in coin a: %s * slippage rate: %d%%)\n', date.toLocaleString(), 
        //                 coinAmounts.coinA.toString(), liquidityBaselineInfo.coin_a.toString(), coinADelta.toString(), 
        //                 liquidityBaselineInfo.liquidity_in_coin_a.toString(), openLiquiditySlippagePercent))
        // fs.appendFileSync(fileNameBrief, util.format('%s [info] coin b allocated for open pos: %s = calc: %s + slippage: %s(total liquidity in coin b: %s * slippage rate: %d%%)\n', date.toLocaleString(),
        //                 coinAmounts.coinB.toString(), liquidityBaselineInfo.coin_b.toString(), coinBDelta.toString(),
        //                 liquidityBaselineInfo.liquidity_in_coin_b.toString(), openLiquiditySlippagePercent))

      
        var checkBalanceInfo: CheckBalanceInfo = {
          situation: 0,
          estimatedAmountIn: new BN(0),
          estimatedAmountOut: new BN(0),
          estimatedFeeAmount: new BN(0),
          amount: new BN(0),
          byAmountIn: false,
          amountLimit: new BN(0)
        }
        const succeed = await rebalanceCoinAAndCoinBByMinimumBoth(main_pool, coinAmounts, coinWalletAmount, coinBufferAmount, sendKeypair, checkBalanceInfo)  
        if (succeed) { // situation = 0/1/2
          var coinWalletAmountAfterSwapCheck: CoinAmounts = {coinA: new BN(0), coinB: new BN(0)}      
          if (checkBalanceInfo.situation != 0) {
            // wait for wallet balance change finished
            var coinWalletAmountEst: CoinAmounts = {coinA: new BN(0), coinB: new BN(0)}
            var coinDenominator: CoinAmounts = {coinA: new BN(0), coinB: new BN(0)}
            if (checkBalanceInfo.situation == 1) {
              coinWalletAmountEst.coinA = coinWalletAmount.coinA.add(checkBalanceInfo.estimatedAmountOut)
              coinWalletAmountEst.coinB = coinWalletAmount.coinB.sub(checkBalanceInfo.estimatedAmountIn)
              coinDenominator.coinA = checkBalanceInfo.estimatedAmountOut.clone()
              coinDenominator.coinB = checkBalanceInfo.estimatedAmountIn.clone()
            } else if (checkBalanceInfo.situation == 2) {
              coinWalletAmountEst.coinA = coinWalletAmount.coinA.sub(checkBalanceInfo.estimatedAmountIn)
              coinWalletAmountEst.coinB = coinWalletAmount.coinB.add(checkBalanceInfo.estimatedAmountOut)
              coinDenominator.coinA = checkBalanceInfo.estimatedAmountIn.clone()
              coinDenominator.coinB = checkBalanceInfo.estimatedAmountOut.clone()
            }
            coinWalletAmountAfterSwapCheck = await waitOperationFinish(account_address, coinWalletAmountEst, coinDenominator, Percentage.fromDecimal(d(swapSlippagePercent))) // swapSlippagePercent
          } else {
            // no balance change, just use former result
            coinWalletAmountAfterSwapCheck.coinA = coinWalletAmount.coinA.clone()
            coinWalletAmountAfterSwapCheck.coinB = coinWalletAmount.coinB.clone()
            // const CoinBalance = await SDK.fullClient.getAllBalances({owner: account_address})
            // for (const coin of CoinBalance) {
            //   switch(getCoinTypeEnum(coin.coinType)) {
            //     case COIN_TYPE.WUSDC:
            //       coinWalletAmountAfterSwapCheck.coinA = new BN(coin.totalBalance)
            //       break;
            //     case COIN_TYPE.SUI:
            //       coinWalletAmountAfterSwapCheck.coinB = new BN(coin.totalBalance)
            //       break;
            //     default:
            //       break;
            //   }
            // }
          }

          var liquidityBaselineInfo: LiquidityBaselineInfo = {
            coin_a: new BN(0),
            coin_b: new BN(0),
            liquidity: new BN(0),
            liquidity_in_coin_a: new BN(0),
            liquidity_in_coin_b: new BN(0)
          }


          // check again by cur price, for log
          var liquidityBaselineInfo: LiquidityBaselineInfo = {
            coin_a: new BN(0),
            coin_b: new BN(0),
            liquidity: new BN(0),
            liquidity_in_coin_a: new BN(0),
            liquidity_in_coin_b: new BN(0)
          }
          getCurAndBounderCoinAmountFromLiquidity(main_pool, position_liquidity, 
                    cur_position_tick_index, cur_position_tick_index_high_bounder, liquidityBaselineInfo)

          // dump new coin amount need for open pos after swap wait
          date.setTime(Date.now())
          console.log('%s [info] est coin a to add after swap: %s, est coin b to add after swap : %s', date.toLocaleString(), 
                                        liquidityBaselineInfo.coin_a.toString(), liquidityBaselineInfo.coin_b.toString())
          fs.appendFileSync(fileName, util.format('%s [info] est coin a to add after swap : %s, est coin b to add after swap : %s\n', date.toLocaleString(), 
                                        liquidityBaselineInfo.coin_a.toString(), liquidityBaselineInfo.coin_b.toString()))
          fs.appendFileSync(fileNameBrief, util.format('%s [info] est coin a to add after swap : %s, est coin b to add after swap : %s\n', date.toLocaleString(), 
                                        liquidityBaselineInfo.coin_a.toString(), liquidityBaselineInfo.coin_b.toString()))
      
          const tx_success = await addLiquidityWithFixedLiquidity(main_pool, liquidityBaselineInfo.liquidity, coinAmounts, cur_position_tick_index, cur_position_tick_index_high_bounder, sendKeypair)
          if (tx_success) {
            // wait for wallet balance change finished           
            // calc coinWalletAmountEst
            var coinWalletAmountEst: CoinAmounts = {
              coinA: coinWalletAmountAfterSwapCheck.coinA.sub(liquidityBaselineInfo.coin_a), 
              coinB: coinWalletAmountAfterSwapCheck.coinB.sub(liquidityBaselineInfo.coin_b)
            }

            // calc coinDenominator
            var coinDenominator: CoinAmounts = 
            {
              coinA: liquidityBaselineInfo.liquidity_in_coin_a.clone(),
              coinB: liquidityBaselineInfo.liquidity_in_coin_b.clone()
            }
            
            await waitOperationFinish(account_address, coinWalletAmountEst, coinDenominator, Percentage.fromDecimal(d(openLiquiditySlippagePercent))) // openLiquiditySlippagePercent


            // retrieve new position info, try once
            var pos_object_id: string = ''
            var liquidity: string = ''
            try {
              const position_list = await SDK.Position.getPositionList(account_address, [main_pool_address,], false)
              var opened_position_index: number[] = [] // for log
              for (let i = 0; i < position_list.length; i++) {
                if (position_list[i].tick_lower_index == cur_position_tick_index) {
                  pos_object_id = position_list[i].pos_object_id
                  liquidity = position_list[i].liquidity
                }
                opened_position_index.push(position_list[i].tick_lower_index)
              }
              if (pos_object_id == '') {
                date.setTime(Date.now())
                console.log('%s [warning] open position: can not retrieve pos just add, only retrieved : %s. maybe updated later.', date.toLocaleString(), 
                      opened_position_index.toString())
                fs.appendFileSync(fileName, util.format('%s [warning] open position: can not retrieve pos just add, only retrieved : %s. maybe updated later.\n', date.toLocaleString(), 
                      opened_position_index.toString()))
                fs.appendFileSync(fileNameBrief, util.format('%s [warning] open position: can not retrieve pos just add, only retrieved : %s. maybe updated later.\n', date.toLocaleString(), 
                      opened_position_index.toString()))
              }
            } catch (e) {
              date.setTime(Date.now())
              if (e instanceof Error) {
                console.error('%s [error] open position: SDK.Position.getPositionList get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack)
                fs.appendFileSync(fileName, util.format('%s [error] open position: SDK.Position.getPositionList get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
                fs.appendFileSync(fileNameBrief, util.format('%s [error] open position: SDK.Position.getPositionList get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
              } else {
                console.error('open position: SDK.Position.getPositionList get an exception'); console.error(e);
                fs.appendFileSync(fileName, 'open position: SDK.Position.getPositionList get an exception\n')
                fs.appendFileSync(fileNameBrief, 'open position: SDK.Position.getPositionList get an exception\n')
              }
            }
      
            // open position update position_info_map
            if (position_info_map.has(cur_position_tick_index)) {
              var pos = position_info_map.get(cur_position_tick_index)!
              pos.position_opened = true
              pos.pos_object_id = pos_object_id
              pos.on_position_times++
            } else {
              // first add pos entry
              var position_info_init_value: PositionInfo = {
                tick_lower_index: cur_position_tick_index,
                tick_upper_index: cur_position_tick_index_high_bounder,
                coin_type_a: main_pool.coinTypeA,
                coin_type_b: main_pool.coinTypeB,
                pos_object_id: pos_object_id,
                liquidity: liquidityBaselineInfo.liquidity.clone(),
                lower_bounder_coin_a_amount: liquidityBaselineInfo.liquidity_in_coin_a.clone(), // = LiquidityBaselineInfo.liquidity_in_coin_a
                upper_bounder_coin_b_amount: liquidityBaselineInfo.liquidity_in_coin_b.clone(),
                // lower_bounder_coin_a_amount: is_position_liquidity_in_coin_a? position_liquidity_in_coin.clone() : liquidityBaselineInfo.liquidity_in_coin_a.clone(), // = LiquidityBaselineInfo.liquidity_in_coin_a
                // upper_bounder_coin_b_amount: is_position_liquidity_in_coin_a? liquidityBaselineInfo.liquidity_in_coin_b.clone() : position_liquidity_in_coin.clone(), // = LiquidityBaselineInfo.liquidity_in_coin_a
                tick_lower_coin_a_price: TickMath.tickIndexToPrice(cur_position_tick_index, coin_a_decimals, coin_b_decimals).toNumber(),
                tick_upper_coin_a_price: TickMath.tickIndexToPrice(cur_position_tick_index_high_bounder, coin_a_decimals, coin_b_decimals).toNumber(),
                tick_lower_coin_b_price: d(1).div(TickMath.tickIndexToPrice(cur_position_tick_index, coin_a_decimals, coin_b_decimals)).toNumber(),
                tick_upper_coin_b_price: d(1).div(TickMath.tickIndexToPrice(cur_position_tick_index_high_bounder, coin_a_decimals, coin_b_decimals)).toNumber(),
                fee_coin_a_claimed_total: new BN(0),
                fee_coin_b_claimed_total: new BN(0),
                fee_value_in_u_claimed_total: 0,
                reward_amount_claimed_total: [],
                reward_value_in_u_claimed_total: 0,
                init_tick: main_pool.current_tick_index,
                position_opened: true,
                on_position_times: 1,
                short_times_on_base_coin: 0
              }
              position_info_map.set(cur_position_tick_index, position_info_init_value)
            }

            // open position update opened_position_lower_tick_array
            opened_position_lower_tick_array.push(cur_position_tick_index)
            opened_position_lower_tick_array.sort()
          } else {
            date.setTime(Date.now())
            console.log('%s [error] open position fail: tx fail', date.toLocaleString())
            fs.appendFileSync(fileName, util.format('%s [error] open position fail: tx fail\n', date.toLocaleString()))
            fs.appendFileSync(fileNameBrief, util.format('%s [error] open position fail: tx fail\n', date.toLocaleString()))
          }
        } else {
          date.setTime(Date.now())
          console.log('%s [error] open position fail: swap fail', date.toLocaleString())
          fs.appendFileSync(fileName, util.format('%s [error] open position fail: swap fail\n', date.toLocaleString()))
          fs.appendFileSync(fileNameBrief, util.format('%s [error] open position fail: swap fail\n', date.toLocaleString()))
        }
        date.setTime(Date.now())
        console.log('%s [info] open position finished: %d', date.toLocaleString(), cur_position_tick_index)
        fs.appendFileSync(fileName, util.format('%s [info] open position finished: %d\n', date.toLocaleString(), cur_position_tick_index))
        dumpOpenedPositionInfo(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)
        dumpOpenedPositionInfoToFile(cur_position_tick_index, opened_position_lower_tick_array, position_info_map)
      } catch(e) {
        if (e instanceof Error) {
          console.error('%s [error] open position get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack)
          fs.appendFileSync(fileName, util.format('%s [error] open position get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
          fs.appendFileSync(fileNameBrief, util.format('%s [error] open position get an exception:\n%s \n%s \n%s \n', date.toLocaleString(), e.message, e.name, e.stack))
        } else {
          console.error('open position get an exception'); console.error(e);
          fs.appendFileSync(fileName,'open position get an exception\n')
          fs.appendFileSync(fileNameBrief,'open position get an exception\n')
        }
        continue
      }

      need_open_position = false
      position_index_to_open = 0
    }

    dumpAllPositionShortInfo(cur_position_tick_index, position_info_map)
    dumpAllPositionShortInfoToFile(cur_position_tick_index, position_info_map)


    // update old
    cur_position_tick_index_old = cur_position_tick_index
    cur_base_tick_index_old = cur_base_tick_index



  } // for (;;) 
}

main()