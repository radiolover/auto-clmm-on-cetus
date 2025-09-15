
import Decimal from 'decimal.js';
// import d from 'decimal.js';
import BN from 'bn.js'
import * as fs from 'fs';
import * as util from 'util';

import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { CoinAssist, ClmmPoolUtil, TickMath, TickUtil,CoinAmounts , Percentage, adjustForSlippage ,MathUtil} from '@cetusprotocol/common-sdk';
import { d } from '@cetusprotocol/common-sdk';



import { CetusClmmSDK, Pool, Position, AddLiquidityFixTokenParams, 
    FetchPosRewardParams, FetchPosFeeParams, CollectFeesQuote, PosRewarderResult} from '@cetusprotocol/sui-clmm-sdk';
const cetusClmmSDK = CetusClmmSDK.createSDK({});


import { AggregatorClient, RouterData } from "@cetusprotocol/aggregator-sdk";
const client = new AggregatorClient();





enum CoinTypeEnum {  
    USDC = 0,
    SUI,
    CETUS,
    DEEP,
    COIN_TYPE_MAX
}

const COIN_TYPE_ADDRESS_SUI = '0x2::sui::SUI';
const COIN_TYPE_ADDRESS_USDC = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
const COIN_TYPE_ADDRESS_DEEP = '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP';
const COIN_TYPE_ADDRESS_CETUS = '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS';


function getCoinTypeEnum(coinType: string): CoinTypeEnum {
    if (coinType === COIN_TYPE_ADDRESS_USDC || coinType.endsWith('dba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC')) {
        return CoinTypeEnum.USDC;
    } else if (coinType === COIN_TYPE_ADDRESS_SUI || coinType.endsWith('2::sui::SUI')) {
        return CoinTypeEnum.SUI;
    } else if (coinType === COIN_TYPE_ADDRESS_CETUS || coinType.endsWith('6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS')) {
        return CoinTypeEnum.CETUS;
    } else if (coinType === COIN_TYPE_ADDRESS_DEEP || coinType.endsWith('deeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP')) {
        return CoinTypeEnum.DEEP;
    }
    return CoinTypeEnum.COIN_TYPE_MAX;
}

function getCoinTypeAddress(coinType: CoinTypeEnum): string {
    let coin_address = '';
    switch(coinType) {
        case CoinTypeEnum.USDC:
            coin_address = COIN_TYPE_ADDRESS_USDC;
            break;
        case CoinTypeEnum.SUI:
            coin_address = COIN_TYPE_ADDRESS_SUI;
            break;
        case CoinTypeEnum.CETUS:
            coin_address = COIN_TYPE_ADDRESS_CETUS;
            break;
        case CoinTypeEnum.DEEP:
            coin_address = COIN_TYPE_ADDRESS_DEEP;
            break;
        default:
            break;            
    }
    return coin_address;
}





const POOL_ADDRESS_USDC_SUI_0_05 = '0x51e883ba7c0b566a26cbc8a94cd33eb0abd418a77cc1e60ad22fd9b1f29cd2ab';
const POOL_ADDRESS_USDC_SUI_0_25 = '0xb8d7d9e66a60c239e7a60110efcf8de6c705580ed924d0dde141f4a0e2c90105';
const POOL_ADDRESS_USDC_CETUS_0_25 = '0x3b13ac70030d587624e407bbe791160b459c48f1049e04269eb8ee731f5442b4';

const POOL_TICK_SPACING_USDC_SUI_0_05: number = 10;
const POOL_TICK_SPACING_USDC_SUI_0_25: number = 60;


const COIN_A_TYPE = CoinTypeEnum.USDC;
const COIN_A_DECIMALS = 6;
const COIN_A_NAME = 'USDC';

const COIN_B_TYPE = CoinTypeEnum.SUI;
const COIN_B_DECIMALS = 9;
const COIN_B_NAME = 'SUI';

const SUI_GAS_RESERVED = new BN(1 * 1000000000); // 1 sui

const ACCOUNT_ADDRESS = '';

const date = new Date();
const LOG_FILE_NAME = 'log_file_name_' + date.toISOString() + '.log';





const MNEMONICS = '';  // your mnemonics
// Account 1, Account 2 .... of your wallet
const HD_WALLET_PATH = 'm\/44\'\/784\'\/0\'\/0\'\/0\'';
// const path = 'm\/44\'\/784\'\/1\'\/0\'\/0\''
// const path = 'm\/44\'\/784\'\/2\'\/0\'\/0\''



// 60 ticks base range for 0.25% fee rate
// const BASE_TICK_RANGE: number = 60
// position param
// const BASE_TICK_RANGE_COUNT: number = 1





const POOL_TICK_SPACING_TIMES: number = 12; 
const POSITION_TICK_RANGE: number = POOL_TICK_SPACING_USDC_SUI_0_05 * POOL_TICK_SPACING_TIMES;







type RebalanceInfo = {
    valid: boolean;
    need_swap: boolean;
    a2b: boolean;
    amount_in: BN;
    amount_out: BN;
    coin_a_amount_new: BN;
    coin_b_amount_new: BN;  
}

function getRebalanceDirectionAndAmount(coin_a_amount: BN, coin_b_amount: BN, 
                current_tick_index: number, tick_lower_index: number, tick_upper_index: number) : RebalanceInfo {

    let rebalance_info: RebalanceInfo = {
        valid: true,
        need_swap: false,
        a2b: true,
        amount_in: new BN(0),
        amount_out: new BN(0),
        coin_a_amount_new: new BN(0),
        coin_b_amount_new: new BN(0)
    };

    let price = TickMath.tickIndexToPrice(current_tick_index, COIN_A_DECIMALS, COIN_B_DECIMALS);

    if (current_tick_index <= tick_lower_index) {
        rebalance_info.valid = true;
        rebalance_info.need_swap = !coin_b_amount.eqn(0);
        rebalance_info.a2b = false;
        rebalance_info.amount_in = coin_b_amount.clone();
        let coin_a_amount_with_decimals = Decimal(coin_b_amount.toString()).mul(Decimal.pow(10, -COIN_B_DECIMALS)).div(price);        
        rebalance_info.amount_out = new BN(coin_a_amount_with_decimals.mul(Decimal.pow(10, COIN_A_DECIMALS)).round().toString());
        rebalance_info.coin_a_amount_new = rebalance_info.amount_out.clone();
        rebalance_info.coin_b_amount_new = new BN(0);
    } else if (current_tick_index >= tick_upper_index) {
        rebalance_info.valid = true;
        rebalance_info.need_swap = !coin_a_amount.eqn(0);
        rebalance_info.a2b = true;
        rebalance_info.amount_in = coin_a_amount.clone();
        let coin_b_amount_with_decimals = Decimal(coin_a_amount.toString()).mul(Decimal.pow(10, -COIN_A_DECIMALS)).mul(price);  
        rebalance_info.amount_out = new BN(coin_b_amount_with_decimals.mul(Decimal.pow(10, COIN_B_DECIMALS)).round().toString());
        rebalance_info.coin_a_amount_new = new BN(0);
        rebalance_info.coin_b_amount_new = rebalance_info.amount_out.clone();
    } else {
        let coin_a_amount_d = Decimal(coin_a_amount.toString())
        let coin_b_amount_d = Decimal(coin_b_amount.toString())

        // calc expected ratio and price on current tick
        const liquidity_input = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(tick_lower_index, tick_upper_index, new BN(100 * 1000000000), 
            false, true, 0.05, TickMath.tickIndexToSqrtPriceX64(current_tick_index));

        let ratio = Decimal(liquidity_input.coin_amount_b).div(Decimal(liquidity_input.coin_amount_a));
        let abstract_price = TickMath.tickIndexToPrice(current_tick_index, 0, 0) // treat as basic unit without coin's decimal

        // calc new coin amount
        let numerator = abstract_price.mul(coin_a_amount_d).plus(coin_b_amount_d);
        let denominator = ratio.plus(abstract_price);
        let coin_a_amount_new_d = numerator.div(denominator);
        let coin_b_amount_new_d = numerator.div(denominator).mul(ratio);

        let coin_a_amount_new = new BN(coin_a_amount_new_d.round().toString());
        let coin_b_amount_new = new BN(coin_b_amount_new_d.round().toString());

        if (coin_a_amount.gt(coin_a_amount_new) && coin_b_amount.lt(coin_b_amount_new)) {
            rebalance_info.valid = true;
            rebalance_info.need_swap = true;
            rebalance_info.a2b = true;
            rebalance_info.amount_in = coin_a_amount.sub(coin_a_amount_new);
            rebalance_info.amount_out = coin_b_amount_new.sub(coin_b_amount);
        } else if (coin_a_amount.lt(coin_a_amount_new) && coin_b_amount.gt(coin_b_amount_new)) {
            rebalance_info.valid = true;
            rebalance_info.need_swap = true;
            rebalance_info.a2b = false;
            rebalance_info.amount_in = coin_b_amount.sub(coin_b_amount_new);
            rebalance_info.amount_out = coin_a_amount_new.sub(coin_a_amount);
        } else if (coin_a_amount.eq(coin_a_amount_new) && coin_b_amount.eq(coin_b_amount_new)) {
            rebalance_info.valid = true;
            rebalance_info.need_swap = false;
            rebalance_info.a2b = false;
            rebalance_info.amount_in = new BN(0);
            rebalance_info.amount_out = new BN(0);
        } else {
            // invalid
            rebalance_info.valid = false;
            rebalance_info.need_swap = false;
            rebalance_info.a2b = false;
            rebalance_info.amount_in = new BN(0);
            rebalance_info.amount_out = new BN(0);
        }
        rebalance_info.coin_a_amount_new = coin_a_amount_new.clone();
        rebalance_info.coin_b_amount_new = coin_b_amount_new.clone();
    }

    return rebalance_info;
}





async function getCurrentSuiPrice() {
    // SUI-USDC 0.05%, 0x51e883ba7c0b566a26cbc8a94cd33eb0abd418a77cc1e60ad22fd9b1f29cd2ab
    let price = d(0)
    const pools = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_SUI_0_05]);
    if (pools.length) {
        price = d(1).div(TickMath.tickIndexToPrice(pools[0].current_tick_index, 6, 9));
    }
    return price;
}

async function getCurrentCetusPrice() {
    // SUI-USDC 0.05%, 0x51e883ba7c0b566a26cbc8a94cd33eb0abd418a77cc1e60ad22fd9b1f29cd2ab
    let price = d(0)
    const pools = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_CETUS_0_25]);
    if (pools.length) {
        price = d(1).div(TickMath.tickIndexToPrice(pools[0].current_tick_index, 6, 9));
    }
    return price;
}


async function getWalletBalance(account_address: string) : Promise<CoinAmounts> {
    const CoinBalance = await cetusClmmSDK.FullClient.getAllBalances({owner: account_address});
    let coin_wallet_amount: CoinAmounts = {coin_amount_a: '0', coin_amount_b: '0'};
    for (const coin of CoinBalance) {
        switch(getCoinTypeEnum(coin.coinType)) {
        case COIN_A_TYPE:
            coin_wallet_amount.coin_amount_a = coin.totalBalance;
            break;
        case COIN_B_TYPE:
            coin_wallet_amount.coin_amount_b = coin.totalBalance;
            break;
        default:
            break;
        }
    }
    return coin_wallet_amount;
}


type AllCoinAmounts = {
    usdc_amount: string;
    sui_amount: string;
    cetus_amount: string;
};

async function getAllWalletBalance(account_address: string): Promise<AllCoinAmounts> {
    let ret: AllCoinAmounts = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
    const CoinBalance = await cetusClmmSDK.FullClient.getAllBalances({owner: account_address});
    for (const coin of CoinBalance) {
        switch(getCoinTypeEnum(coin.coinType)) {
        case CoinTypeEnum.USDC:
            ret.usdc_amount = coin.totalBalance;
            break;
        case CoinTypeEnum.SUI:
            ret.sui_amount = coin.totalBalance;
            break;
        case CoinTypeEnum.CETUS:
            ret.cetus_amount = coin.totalBalance;
            break;
        default:
            break;
        }
    }
    return ret;
}








type FeeAndReward = {
    fee_owned_a: BN;
    fee_owned_b: BN;
    rwd_owned_cetus: BN;
    rwd_owned_sui: BN;
};


function newFeeAndReward(): FeeAndReward {
    let ret: FeeAndReward = {
        fee_owned_a: new BN(0),
        fee_owned_b: new BN(0),
        rwd_owned_cetus: new BN(0),
        rwd_owned_sui: new BN(0)
    };
    return ret;
}

async function getFeeAndReward(pool: Pool, pos: Position): Promise<FeeAndReward> {
    let ret : FeeAndReward = {
        fee_owned_a: new BN(0),
        fee_owned_b: new BN(0),
        rwd_owned_cetus: new BN(0),
        rwd_owned_sui: new BN(0)
    };

    const posRewardParamsList: FetchPosRewardParams[] = [];
    const posFeeParamsList: FetchPosFeeParams[] = [];

    posRewardParamsList.push({
        pool_id: pool.id,
        position_id: pos.pos_object_id,
        rewarder_types: pool.rewarder_infos.map((rewarder) => rewarder.coin_type),
        coin_type_a: pool.coin_type_a,
        coin_type_b: pool.coin_type_b,
    });

    posFeeParamsList.push({
        pool_id: pool.id,
        position_id: pos.pos_object_id,
        coin_type_a: pool.coin_type_a,
        coin_type_b: pool.coin_type_b,
    });
    const collectFeesQuote: CollectFeesQuote[] = await cetusClmmSDK.Rewarder.fetchPosFeeAmount(posFeeParamsList);
    const posRewarderResult: PosRewarderResult[] = await cetusClmmSDK.Rewarder.fetchPosRewardersAmount(posRewardParamsList);   

    ret.fee_owned_a = new BN(collectFeesQuote[0].fee_owned_a);
    ret.fee_owned_b = new BN(collectFeesQuote[0].fee_owned_b);

    for (const rwd of posRewarderResult[0].rewarder_amounts) {
        if (getCoinTypeEnum(rwd.coin_type) === CoinTypeEnum.CETUS) {
            ret.rwd_owned_cetus.iadd(new BN(rwd.amount_owned));
        } else if (getCoinTypeEnum(rwd.coin_type) === CoinTypeEnum.SUI) {
            ret.rwd_owned_sui.iadd(new BN(rwd.amount_owned));
        }
    }

    return ret;
}


// type FeeAndRewardCollectEvent = {
//     fee_usdc_amount: BN;
//     fee_sui_amount:BN;
//     rwd_sui_amount: BN;
//     rwd_cetus_amount: BN;
// };

// function newFeeAndRewardCollectEvent(): FeeAndRewardCollectEvent {
//     let ret: FeeAndRewardCollectEvent = {
//         fee_usdc_amount: new BN(0),
//         fee_sui_amount: new BN(0),
//         rwd_sui_amount: new BN(0),
//         rwd_cetus_amount: new BN(0)
//     };
//     return ret;
// }

function getFeeAndRewardCollectEvent(rst: SuiTransactionBlockResponse): FeeAndReward {
    let ret = newFeeAndReward();
    if (rst.events?.length) {
        for (const event of rst.events) {            
            if (event.type.endsWith('::pool::CollectRewardV2Event')) {
                // rwd: one coin one event
                const json = event.parsedJson as {
                    amount: string;
                    rewarder_type: {
                        name: string;
                    };
                };
                switch(getCoinTypeEnum(json.rewarder_type.name)) {
                    case CoinTypeEnum.SUI:
                        ret.rwd_owned_sui.iadd(new BN(json.amount));
                        break;
                    case CoinTypeEnum.CETUS:
                        ret.rwd_owned_cetus.iadd(new BN(json.amount));
                        break;
                    default:
                        break;
                }

            } else if (event.type.endsWith('::pool::CollectFeeEvent')) {
                // fee: maybe pool_script and pool_script_v2 event exist at the same time
                const json = event.parsedJson as {
                    amount_a: string;
                    amount_b: string;
                };
                ret.fee_owned_a.iadd(new BN(json.amount_a));
                ret.fee_owned_b.iadd(new BN(json.amount_b));
            }
        }
    }
    return ret;
}







type FeeAndRewardValue = {
    fee_usdc_value: Decimal;
    fee_sui_value: Decimal;
    rwd_sui_value: Decimal;
    rwd_cetus_value: Decimal;
    total_value: Decimal;
};

function newFeeAndRewardValue(): FeeAndRewardValue{
    let ret: FeeAndRewardValue = {
        fee_usdc_value: d(0),
        fee_sui_value: d(0),
        rwd_sui_value: d(0),
        rwd_cetus_value: d(0),
        total_value: d(0)
    };
    return ret;
}


function getFeeAndRewardValue(sui_price: Decimal, cetus_price: Decimal, fee_and_reward: FeeAndReward): FeeAndRewardValue {
    let ret = newFeeAndRewardValue();
    ret.fee_usdc_value = Decimal(fee_and_reward.fee_owned_a.toString()).mul(Decimal.pow(10, -6));
    ret.fee_sui_value = Decimal(fee_and_reward.fee_owned_b.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);
    ret.rwd_sui_value = Decimal(fee_and_reward.rwd_owned_sui.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);
    ret.rwd_cetus_value = Decimal(fee_and_reward.rwd_owned_cetus.toString()).mul(Decimal.pow(10, -9)).mul(cetus_price);
    ret.total_value = ret.fee_usdc_value.add(ret.fee_sui_value).add(ret.rwd_sui_value).add(ret.rwd_cetus_value);
    return ret;
}










function getTotalGasFee(rst: SuiTransactionBlockResponse): BN {
    let gas = new BN(0);
    if (rst.effects) {
        let computationCost = new BN(rst.effects.gasUsed.computationCost);
        let storageCost = new BN(rst.effects.gasUsed.storageCost);
        let storageRebate = new BN(rst.effects.gasUsed.storageRebate);
        gas.iadd(computationCost);
        gas.iadd(storageCost);
        gas.isub(storageRebate);
    }
    return gas;
}








type BalanceChange = {
    usdc_change: BN;
    sui_change: BN;
    cetus_change: BN;
};

function newBalanceChange(): BalanceChange {
    let ret: BalanceChange = {
        usdc_change: new BN(0),
        sui_change: new BN(0),
        cetus_change: new BN(0)
    };
    return ret;
}


function getBalanceChange(rst: SuiTransactionBlockResponse): BalanceChange {
    let ret = newBalanceChange();
    if (rst.balanceChanges) {
        for (const balance of rst.balanceChanges) {
            if (getCoinTypeEnum(balance.coinType) === CoinTypeEnum.CETUS) {
                ret.cetus_change = new BN(balance.amount);
            } else if (getCoinTypeEnum(balance.coinType) === CoinTypeEnum.SUI) {
                ret.sui_change = new BN(balance.amount);
            } else if (getCoinTypeEnum(balance.coinType) === CoinTypeEnum.USDC) {
                ret.usdc_change = new BN(balance.amount);
            }
        }
    } else {
        console.log('rst.balanceChanges is empty');
    }
    return ret;
}








type LiquidityEvent = {
    after_liquidity: BN;
    amount_a: BN;
    amount_b: BN;
    liquidity: BN;
};


function newLiquidityEvent(): LiquidityEvent  {
    let ret: LiquidityEvent = {
        after_liquidity: new BN(0),
        amount_a: new BN(0),
        amount_b: new BN(0),
        liquidity: new BN(0)
    };
    return ret;
}

function getAddLiquidityEvent(rst: SuiTransactionBlockResponse): LiquidityEvent {
    let ret = newLiquidityEvent();
    if (rst.events?.length) {
        for (const event of rst.events) {
            if (event.type.endsWith('::pool::AddLiquidityEvent')) {
                const json = event.parsedJson as {
                    after_liquidity: string;
                    amount_a: string;
                    amount_b: string;
                    liquidity: string;
                };
                ret.after_liquidity = new BN(json.after_liquidity);
                ret.amount_a = new BN(json.amount_a);
                ret.amount_b = new BN(json.amount_b);
                ret.liquidity = new BN(json.liquidity);
            }
        }
    }

    return ret;
}

function getRemoveLiquidityEvent(rst: SuiTransactionBlockResponse): LiquidityEvent {
    let ret = newLiquidityEvent();

    if (rst.events?.length) {
        for (const event of rst.events) {
            if (event.type.endsWith('::pool::RemoveLiquidityEvent')) {
                const json = event.parsedJson as {
                    after_liquidity: string;
                    amount_a: string;
                    amount_b: string;
                    liquidity: string;
                };
                ret.after_liquidity = new BN(json.after_liquidity);
                ret.amount_a = new BN(json.amount_a);
                ret.amount_b = new BN(json.amount_b);
                ret.liquidity = new BN(json.liquidity);
            }
        }
    }
    return ret;
}










function getAddLiquidityTickIndex(add_liqui_event: LiquidityEvent, tick_lower_index: number, tick_upper_index: number): number {
    let add_liqui_tick = -443637;
    const sqrtPl = new Decimal(TickMath.tickIndexToSqrtPriceX64(tick_lower_index).toString());
    const sqrtPu = new Decimal(TickMath.tickIndexToSqrtPriceX64(tick_upper_index).toString());

    let after_liquidity_d = Decimal(add_liqui_event.after_liquidity.toString());
    let amount_a_d = Decimal(add_liqui_event.amount_a.toString());
    let amount_b_d = Decimal(add_liqui_event.amount_b.toString());

    const sqrtP_from_A = MathUtil.toX64Decimal(after_liquidity_d).mul(sqrtPu).div(amount_a_d.mul(sqrtPu).add(MathUtil.toX64Decimal(after_liquidity_d)));
    const sqrtP_from_B = amount_b_d.div(MathUtil.fromX64Decimal(after_liquidity_d)).add(sqrtPl);
    const sqrtP = sqrtP_from_A.add(sqrtP_from_B).div(2);

    if (sqrtP.isNaN()) {
        console.log('sqrtP is NaN return');
        return add_liqui_tick;
    }
    add_liqui_tick = TickMath.sqrtPriceX64ToTickIndex(new BN(sqrtP.round().toString()));
    return add_liqui_tick;
}













type ImpermanentLossCtx2 = {
    sui_price_when_add_liquidity: Decimal;
    sui_price_lower_index: Decimal;
    sui_price_upper_index: Decimal;
    coin_a_amount_lower_index: CoinAmounts;
    coin_b_amount_upper_index: CoinAmounts;

    initial_value: Decimal;
    impermanent_value_lower_index: Decimal;
    impermanent_value_upper_index: Decimal;
    position_value_lower_index: Decimal;
    position_value_upper_index: Decimal;
    quota_value_lower_index: Decimal;
    quota_value_upper_index: Decimal;

    impermanent_loss_lower_index: Decimal;
    impermanent_loss_upper_index: Decimal;
    pos_value_loss_lower_index: Decimal;
    pos_value_loss_upper_index: Decimal;
    quota_value_loss_lower_index: Decimal;
    quota_value_loss_upper_index: Decimal;
};

function newImpermanentLossCtx2(): ImpermanentLossCtx2 {
    let ret: ImpermanentLossCtx2 = {
        sui_price_when_add_liquidity: d(0),
        sui_price_lower_index: d(0),
        sui_price_upper_index: d(0),
        coin_a_amount_lower_index: {coin_amount_a: '', coin_amount_b: ''},
        coin_b_amount_upper_index: {coin_amount_a: '', coin_amount_b: ''},

        initial_value: d(0),
        impermanent_value_lower_index: d(0),
        impermanent_value_upper_index: d(0),
        position_value_lower_index: d(0),
        position_value_upper_index: d(0),
        quota_value_lower_index: d(0),
        quota_value_upper_index: d(0),

        impermanent_loss_lower_index: d(0),
        impermanent_loss_upper_index: d(0),
        pos_value_loss_lower_index: d(0),
        pos_value_loss_upper_index: d(0),
        quota_value_loss_lower_index: d(0),
        quota_value_loss_upper_index: d(0)
    };
    return ret;
}




function getImpermanentLossCtx2(tick_lower_index: number, tick_when_add_liquidity: number, tick_upper_index: number, 
    add_liqui_event: LiquidityEvent, check_point_status: CheckPointStatus,  check_point_statu_after_add_liquidity: CheckPointStatus): ImpermanentLossCtx2 {

    let ret = newImpermanentLossCtx2();

    ret.sui_price_when_add_liquidity = d(1).div(TickMath.tickIndexToPrice(tick_when_add_liquidity, 6, 9));
    ret.sui_price_lower_index = d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9));
    ret.sui_price_upper_index = d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9));

    let amount_a_d = d(add_liqui_event.amount_a.toString());
    let amount_b_d = d(add_liqui_event.amount_b.toString());



    ret.initial_value = amount_a_d.mul(Decimal.pow(10, -6)).add(amount_b_d.mul(Decimal.pow(10, -9)).mul(ret.sui_price_when_add_liquidity));
    ret.impermanent_value_lower_index = amount_a_d.mul(Decimal.pow(10, -6)).add(amount_b_d.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index));
    ret.impermanent_value_upper_index = amount_a_d.mul(Decimal.pow(10, -6)).add(amount_b_d.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index));


    ret.coin_a_amount_lower_index = ClmmPoolUtil.getCoinAmountFromLiquidity(add_liqui_event.after_liquidity, 
        TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
        TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
        TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
        false);

    ret.coin_b_amount_upper_index = ClmmPoolUtil.getCoinAmountFromLiquidity(add_liqui_event.after_liquidity, 
        TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
        TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
        TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
        false);

    ret.position_value_lower_index = Decimal(ret.coin_a_amount_lower_index.coin_amount_a).mul(Decimal.pow(10, -6));
    ret.position_value_upper_index = Decimal(ret.coin_b_amount_upper_index.coin_amount_b).mul(Decimal.pow(10, -9).mul(ret.sui_price_upper_index));



    let quota_value_begin_in_initial_price = calcQuotaValue(check_point_status.sui_price, check_point_status);
    let check_point_statu_in_round  = { ...check_point_statu_after_add_liquidity };



    ret.impermanent_loss_lower_index = ret.position_value_lower_index.sub(ret.impermanent_value_lower_index);
    ret.impermanent_loss_upper_index = ret.position_value_upper_index.sub(ret.impermanent_value_upper_index);

    ret.pos_value_loss_lower_index = ret.position_value_lower_index.sub(ret.initial_value);
    ret.pos_value_loss_upper_index = ret.position_value_upper_index.sub(ret.initial_value);

    return ret;
}







type ImpermanentLossCtx = {
    sui_price_when_add_liquidity: Decimal;
    sui_price_lower_index: Decimal;
    sui_price_upper_index: Decimal;
    usdc_price_when_add_liquidity: Decimal;
    usdc_price_lower_index: Decimal;
    usdc_price_upper_index: Decimal;
    coin_amount_lower: CoinAmounts;
    coin_amount_upper: CoinAmounts;


    liquidity_amount_a_initial_index: Decimal;
    liquidity_amount_b_initial_index: Decimal;
    liquidity_amount_a_lower_index: Decimal;
    liquidity_amount_b_lower_index: Decimal;
    liquidity_amount_a_upper_index: Decimal;
    liquidity_amount_b_upper_index: Decimal;
    quota_amount_a_initial: Decimal;
    quota_amount_b_initial: Decimal;
    quota_amount_a_lower_index: Decimal;
    quota_amount_b_lower_index: Decimal;
    quota_amount_a_upper_index: Decimal;
    quota_amount_b_upper_index: Decimal;

    liquidity_value_initial_index: Decimal;
    liquidity_value_lower_index: Decimal;
    liquidity_value_upper_index: Decimal;
    liquidity_hold_coin_ab_value_lower_index: Decimal;
    liquidity_hold_coin_ab_value_upper_index: Decimal;
    liquidity_hold_coin_a_value_lower_index: Decimal;
    liquidity_hold_coin_a_value_upper_index: Decimal;
    liquidity_hold_coin_b_value_lower_index: Decimal;
    liquidity_hold_coin_b_value_upper_index: Decimal;

    quota_value_initial: Decimal;
    quota_value_lower_index: Decimal;
    quota_value_upper_index: Decimal;
    quota_hold_coin_ab_value_lower_index: Decimal;
    quota_hold_coin_ab_value_upper_index: Decimal;
    quota_hold_coin_a_value_lower_index: Decimal;
    quota_hold_coin_a_value_upper_index: Decimal;
    quota_hold_coin_b_value_lower_index: Decimal;
    quota_hold_coin_b_value_upper_index: Decimal;


    liquidity_impermanent_loss_coin_ab_lower_index: Decimal;
    liquidity_impermanent_loss_coin_a_lower_index: Decimal;
    liquidity_impermanent_loss_coin_b_lower_index: Decimal;

    liquidity_impermanent_loss_coin_ab_upper_index: Decimal;
    liquidity_impermanent_loss_coin_a_upper_index: Decimal;
    liquidity_impermanent_loss_coin_b_upper_index: Decimal;

    quota_impermanent_loss_coin_ab_lower_index: Decimal;
    quota_impermanent_loss_coin_a_lower_index: Decimal;
    quota_impermanent_loss_coin_b_lower_index: Decimal;

    quota_impermanent_loss_coin_ab_upper_index: Decimal;
    quota_impermanent_loss_coin_a_upper_index: Decimal;
    quota_impermanent_loss_coin_b_upper_index: Decimal;
};


function newImpermanentLossCtx(): ImpermanentLossCtx {
    let ret: ImpermanentLossCtx = {
        sui_price_when_add_liquidity: d(0),
        sui_price_lower_index: d(0),
        sui_price_upper_index: d(0),
        usdc_price_when_add_liquidity: d(0),
        usdc_price_lower_index: d(0),
        usdc_price_upper_index: d(0),
        coin_amount_lower: {coin_amount_a: '', coin_amount_b: ''},
        coin_amount_upper: {coin_amount_a: '', coin_amount_b: ''},


        liquidity_amount_a_initial_index: d(0),
        liquidity_amount_b_initial_index: d(0),
        liquidity_amount_a_lower_index: d(0),
        liquidity_amount_b_lower_index: d(0),
        liquidity_amount_a_upper_index: d(0),
        liquidity_amount_b_upper_index: d(0),
        quota_amount_a_initial: d(0),
        quota_amount_b_initial: d(0),
        quota_amount_a_lower_index: d(0),
        quota_amount_b_lower_index: d(0),
        quota_amount_a_upper_index: d(0),
        quota_amount_b_upper_index: d(0),

        liquidity_value_initial_index: d(0),
        liquidity_value_lower_index: d(0),
        liquidity_value_upper_index: d(0),
        liquidity_hold_coin_ab_value_lower_index: d(0),
        liquidity_hold_coin_ab_value_upper_index: d(0),
        liquidity_hold_coin_a_value_lower_index: d(0),
        liquidity_hold_coin_a_value_upper_index: d(0),
        liquidity_hold_coin_b_value_lower_index: d(0),
        liquidity_hold_coin_b_value_upper_index: d(0),

        quota_value_initial: d(0),
        quota_value_lower_index: d(0),
        quota_value_upper_index: d(0),
        quota_hold_coin_ab_value_lower_index: d(0),
        quota_hold_coin_ab_value_upper_index: d(0),
        quota_hold_coin_a_value_lower_index: d(0),
        quota_hold_coin_a_value_upper_index: d(0),
        quota_hold_coin_b_value_lower_index: d(0),
        quota_hold_coin_b_value_upper_index: d(0),


        liquidity_impermanent_loss_coin_ab_lower_index: d(0),
        liquidity_impermanent_loss_coin_a_lower_index: d(0),
        liquidity_impermanent_loss_coin_b_lower_index: d(0),

        liquidity_impermanent_loss_coin_ab_upper_index: d(0),
        liquidity_impermanent_loss_coin_a_upper_index: d(0),
        liquidity_impermanent_loss_coin_b_upper_index: d(0),

        quota_impermanent_loss_coin_ab_lower_index: d(0),
        quota_impermanent_loss_coin_a_lower_index: d(0),
        quota_impermanent_loss_coin_b_lower_index: d(0),

        quota_impermanent_loss_coin_ab_upper_index: d(0),
        quota_impermanent_loss_coin_a_upper_index: d(0),
        quota_impermanent_loss_coin_b_upper_index: d(0)

    };
    return ret;
}


function getImpermanentLossCtx(tick_lower_index: number, tick_when_add_liquidity: number, tick_upper_index: number, 
    add_liqui_event: LiquidityEvent, check_point_status: CheckPointStatus,  check_point_statu_after_add_liquidity: CheckPointStatus): ImpermanentLossCtx {

    let ret = newImpermanentLossCtx();

    ret.usdc_price_when_add_liquidity = TickMath.tickIndexToPrice(tick_when_add_liquidity, 6, 9);
    ret.usdc_price_lower_index = TickMath.tickIndexToPrice(tick_lower_index, 6, 9);
    ret.usdc_price_upper_index = TickMath.tickIndexToPrice(tick_upper_index, 6, 9);

    ret.sui_price_when_add_liquidity = d(1).div(ret.usdc_price_when_add_liquidity);
    ret.sui_price_lower_index = d(1).div(ret.usdc_price_lower_index);
    ret.sui_price_upper_index = d(1).div(ret.usdc_price_upper_index);

    ret.coin_amount_lower = ClmmPoolUtil.getCoinAmountFromLiquidity(add_liqui_event.after_liquidity, 
        TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
        TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
        TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
        false);
    ret.coin_amount_upper = ClmmPoolUtil.getCoinAmountFromLiquidity(add_liqui_event.after_liquidity, 
        TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
        TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
        TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
        false);


   


    ret.liquidity_amount_a_initial_index = d(add_liqui_event.amount_a.toString());
    ret.liquidity_amount_b_initial_index = d(add_liqui_event.amount_b.toString());
    ret.liquidity_amount_a_lower_index = d(ret.coin_amount_lower.coin_amount_a);
    ret.liquidity_amount_b_lower_index = d(0);
    ret.liquidity_amount_a_upper_index = d(0);
    ret.liquidity_amount_b_upper_index = d(ret.coin_amount_upper.coin_amount_b);


    ret.liquidity_value_initial_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).add(
        ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_when_add_liquidity)
    );

    ret.liquidity_value_lower_index = ret.liquidity_amount_a_lower_index.mul(Decimal.pow(10, -6));
    ret.liquidity_value_upper_index = ret.liquidity_amount_b_upper_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index);

    ret.liquidity_hold_coin_ab_value_lower_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).add(
        ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index)
    );
    ret.liquidity_hold_coin_ab_value_upper_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).add(
        ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index)
    );

    // value in u not change
    ret.liquidity_hold_coin_a_value_lower_index = ret.liquidity_value_initial_index;
    ret.liquidity_hold_coin_a_value_upper_index = ret.liquidity_value_initial_index;


    let liquidity_coin_b_value_initial_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).mul(ret.usdc_price_when_add_liquidity).add(
        ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9))
    ); //  = ret.liquidity_value_initial_index.div(ret.sui_price_when_add_liquidity)

    ret.liquidity_hold_coin_b_value_lower_index = liquidity_coin_b_value_initial_index.mul(ret.sui_price_lower_index);
    ret.liquidity_hold_coin_b_value_upper_index = liquidity_coin_b_value_initial_index.mul(ret.sui_price_upper_index);


    ret.liquidity_impermanent_loss_coin_ab_lower_index = ret.liquidity_value_lower_index.sub(ret.liquidity_hold_coin_ab_value_lower_index);
    ret.liquidity_impermanent_loss_coin_ab_upper_index = ret.liquidity_value_upper_index.sub(ret.liquidity_hold_coin_ab_value_upper_index);
    ret.liquidity_impermanent_loss_coin_a_lower_index = ret.liquidity_value_lower_index.sub(ret.liquidity_hold_coin_a_value_lower_index);
    ret.liquidity_impermanent_loss_coin_a_upper_index = ret.liquidity_value_upper_index.sub(ret.liquidity_hold_coin_a_value_upper_index);
    ret.liquidity_impermanent_loss_coin_b_lower_index = ret.liquidity_value_lower_index.sub(ret.liquidity_hold_coin_b_value_lower_index);
    ret.liquidity_impermanent_loss_coin_b_upper_index = ret.liquidity_value_upper_index.sub(ret.liquidity_hold_coin_b_value_upper_index);




    ret.quota_amount_a_initial = d(check_point_status.usdc_quota_in_wallet.add(check_point_status.usdc_quota_in_pos).toString());
    ret.quota_amount_b_initial = d(check_point_status.sui_quota_in_wallet.add(check_point_status.sui_quota_in_pos).toString());
    ret.quota_amount_a_lower_index = d(check_point_statu_after_add_liquidity.usdc_quota_in_wallet.add(new BN(ret.coin_amount_lower.coin_amount_a)).toString());
    ret.quota_amount_b_lower_index = d(check_point_statu_after_add_liquidity.sui_quota_in_wallet.toString());
    ret.quota_amount_a_upper_index = d(check_point_statu_after_add_liquidity.usdc_quota_in_wallet.toString());
    ret.quota_amount_b_upper_index = d(check_point_statu_after_add_liquidity.sui_quota_in_wallet.add(new BN(ret.coin_amount_upper.coin_amount_b)).toString());



    // initial price before swap, not add liquidity price
    ret.quota_value_initial = ret.quota_amount_a_initial.mul(Decimal.pow(10, -6)).add(
        ret.quota_amount_b_initial.mul(Decimal.pow(10, -9)).mul(check_point_status.sui_price)
    );

    ret.quota_value_lower_index = ret.quota_amount_a_lower_index.mul(Decimal.pow(10, -6)).add(
        ret.quota_amount_b_lower_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index)
    );

    ret.quota_value_upper_index = ret.quota_amount_a_upper_index.mul(Decimal.pow(10, -6)).add(
        ret.quota_amount_b_upper_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index)
    );

    ret.quota_hold_coin_ab_value_lower_index = ret.quota_amount_a_initial.mul(Decimal.pow(10, -6)).add(
        ret.quota_amount_b_initial.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index)
    );

    ret.quota_hold_coin_ab_value_upper_index = ret.quota_amount_a_initial.mul(Decimal.pow(10, -6)).add(
        ret.quota_amount_b_initial.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index)
    );


    ret.quota_hold_coin_a_value_lower_index = ret.quota_value_initial;
    ret.quota_hold_coin_a_value_upper_index = ret.quota_value_initial;

    let quota_coin_b_value_initial_index = ret.quota_value_initial.div(check_point_status.sui_price);
    ret.quota_hold_coin_b_value_lower_index = quota_coin_b_value_initial_index.mul(ret.sui_price_lower_index);
    ret.quota_hold_coin_b_value_upper_index = quota_coin_b_value_initial_index.mul(ret.sui_price_upper_index);


    ret.quota_impermanent_loss_coin_ab_lower_index = ret.quota_value_lower_index.sub(ret.quota_hold_coin_ab_value_lower_index);
    ret.quota_impermanent_loss_coin_ab_upper_index = ret.quota_value_upper_index.sub(ret.quota_hold_coin_ab_value_upper_index);
    ret.quota_impermanent_loss_coin_a_lower_index = ret.quota_value_lower_index.sub(ret.quota_hold_coin_a_value_lower_index);
    ret.quota_impermanent_loss_coin_a_upper_index = ret.quota_value_upper_index.sub(ret.quota_hold_coin_a_value_upper_index);
    ret.quota_impermanent_loss_coin_b_lower_index = ret.quota_value_lower_index.sub(ret.quota_hold_coin_b_value_lower_index);
    ret.quota_impermanent_loss_coin_b_upper_index = ret.quota_value_upper_index.sub(ret.quota_hold_coin_b_value_upper_index);

    return ret;
}

function dumpImpermanentLossAndEarningRatio(impermanent_loss_ctx: ImpermanentLossCtx, fee_and_reward_value_lower_index: FeeAndRewardValue, fee_and_reward_value_upper_index: FeeAndRewardValue) {

    console.log('impermanent_loss(liquidity, coin ab, lower_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_coin_ab_lower_index.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_coin_ab_lower_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(liquidity, coin ab, upper_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_coin_ab_upper_index.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_coin_ab_upper_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(liquidity, coin a, lower_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_coin_a_lower_index.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_coin_a_lower_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(liquidity, coin a, upper_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_coin_a_upper_index.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_coin_a_upper_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(liquidity, coin b, lower_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_coin_b_lower_index.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_coin_b_lower_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(liquidity, coin b, upper_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_coin_b_upper_index.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_coin_b_upper_index).mul(100).abs().toFixed(6)
    );
    console.log('');


    console.log('impermanent_loss(quota, coin ab, lower_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.quota_impermanent_loss_coin_ab_lower_index.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.quota_impermanent_loss_coin_ab_lower_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(quota, coin ab, upper_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.quota_impermanent_loss_coin_ab_upper_index.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.quota_impermanent_loss_coin_ab_upper_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(quota, coin a, lower_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.quota_impermanent_loss_coin_a_lower_index.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.quota_impermanent_loss_coin_a_lower_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(quota, coin a, upper_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.quota_impermanent_loss_coin_a_upper_index.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.quota_impermanent_loss_coin_a_upper_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(quota, coin b, lower_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.quota_impermanent_loss_coin_b_lower_index.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.quota_impermanent_loss_coin_b_lower_index).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(quota, coin b, upper_index): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.quota_impermanent_loss_coin_b_upper_index.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.quota_impermanent_loss_coin_b_upper_index).mul(100).abs().toFixed(6)
    );
}









function dumpSDKRet2Logfile(title: string, context: string) {
    date.setTime(Date.now())
    fs.appendFileSync(LOG_FILE_NAME, util.format('\n[%s] ===== %s =====\n', date.toLocaleString(), title));
    fs.appendFileSync(LOG_FILE_NAME, util.format(context));
    fs.appendFileSync(LOG_FILE_NAME, util.format('\n[%s] ===== %s End =====\n', date.toLocaleString(), title));
}

function balanceNotChange(coin_amount_old: AllCoinAmounts, coin_amount_new: AllCoinAmounts): boolean {
    let coin_a_not_change = Decimal(coin_amount_old.usdc_amount).eq(d(coin_amount_new.usdc_amount));
    let coin_b_not_change = Decimal(coin_amount_old.sui_amount).eq(d(coin_amount_new.sui_amount));

    // console.log('coin_amount_old.coin_amount_a: %s, coin_amount_new.coin_amount_a: %s', 
    //     coin_amount_old.coin_amount_a, coin_amount_new.coin_amount_a);
    // console.log('coin_amount_old.coin_amount_b: %s, coin_amount_new.coin_amount_b: %s', 
    //     coin_amount_old.coin_amount_b, coin_amount_new.coin_amount_b);
    // console.log('coin_a_not_change:', coin_a_not_change);
    // console.log('coin_b_not_change:', coin_b_not_change);
    return coin_a_not_change || coin_b_not_change;
}






type CheckPointStatus = {
    usdc_balance: BN;
    sui_balance: BN;
    cetus_balance: BN;
    usdc_quota_in_wallet: BN;
    sui_quota_in_wallet: BN;
    usdc_quota_in_pos: BN;
    sui_quota_in_pos: BN;
    usdc_fee: BN;
    sui_fee: BN;
    sui_rwd: BN;
    cetus_rwd: BN;
    gas_reserved: BN;
    sui_price: Decimal;
};

function newCheckPointStatus(): CheckPointStatus {
    let ret: CheckPointStatus = {
        usdc_balance: new BN(0),
        sui_balance: new BN(0),
        cetus_balance: new BN(0),
        usdc_quota_in_wallet: new BN(0),
        sui_quota_in_wallet: new BN(0),
        usdc_quota_in_pos: new BN(0),
        sui_quota_in_pos: new BN(0),
        usdc_fee: new BN(0),
        sui_fee: new BN(0),
        sui_rwd: new BN(0),
        cetus_rwd: new BN(0),
        gas_reserved: new BN(0),
        sui_price: d(0)
    };
    return ret;
}

function dumpCheckPoint(check_point_status: CheckPointStatus) {
    console.log('USDC Balance: ', check_point_status.usdc_balance.toString());
    console.log('SUI Balance: ', check_point_status.sui_balance.toString());
    console.log('CETUS Balance: ', check_point_status.cetus_balance.toString());
    console.log('USDC Quota in Wallet: ', check_point_status.usdc_quota_in_wallet.toString());
    console.log('SUI Quota in Wallet: ', check_point_status.sui_quota_in_wallet.toString());
    console.log('USDC Quota in Position: ', check_point_status.usdc_quota_in_pos.toString());
    console.log('SUI Quota in Position: ', check_point_status.sui_quota_in_pos.toString());
    console.log('USDC Fee: ', check_point_status.usdc_fee.toString());
    console.log('SUI Fee: ', check_point_status.sui_fee.toString());
    console.log('SUI Reward: ', check_point_status.sui_rwd.toString());
    console.log('CETUS Reward: ', check_point_status.cetus_rwd.toString());
    console.log('Gas Reserved: ', check_point_status.gas_reserved.toString());
    console.log('SUI Price: ', check_point_status.sui_price);
}









type QuotaValue = {
    usdc_quota_in_wallet_value: Decimal;
    sui_quota_in_wallet_value: Decimal;
    usdc_quota_in_pos_value: Decimal;
    sui_quota_in_pos_value: Decimal;
    total_quota_value: Decimal;
};

function newQuotaValue(): QuotaValue {
    let ret: QuotaValue = {
        usdc_quota_in_wallet_value: d(0),
        sui_quota_in_wallet_value: d(0),
        usdc_quota_in_pos_value: d(0),
        sui_quota_in_pos_value: d(0),
        total_quota_value:d(0)
    };
    return ret;
}

function calcQuotaValue(sui_price: Decimal, check_point_status: CheckPointStatus): QuotaValue {
    let ret = newQuotaValue();
    ret.usdc_quota_in_wallet_value = Decimal(check_point_status.usdc_quota_in_wallet.toString()).mul(Decimal.pow(10, -6));
    ret.sui_quota_in_wallet_value = Decimal(check_point_status.sui_quota_in_wallet.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);
    ret.usdc_quota_in_pos_value = Decimal(check_point_status.usdc_quota_in_pos.toString()).mul(Decimal.pow(10, -6));
    ret.sui_quota_in_pos_value = Decimal(check_point_status.sui_quota_in_pos.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);
    ret.total_quota_value = ret.usdc_quota_in_wallet_value.add(ret.sui_quota_in_wallet_value).add(ret.usdc_quota_in_pos_value).add(ret.sui_quota_in_pos_value);
    return ret;
}












function dumpTransactionInfo(title: string, check_point_status_old: CheckPointStatus, check_point_status_new: CheckPointStatus, 
        sui_price: Decimal, digest: string, total_gas_fee: BN, balance_change: BalanceChange) {
    console.log(' ========== %s ========== ', title);
    console.log('Digest: ', digest);  

    console.log('USDC %s => %s, balance_change: %s, balance_change(rsp): %s', 
        check_point_status_old.usdc_balance.toString(),
        check_point_status_new.usdc_balance.toString(),
        check_point_status_new.usdc_balance.sub(check_point_status_old.usdc_balance).toString(),
        balance_change.usdc_change.toString());

    console.log('SUI %s => %s, balance_change: %s, balance_change(rsp): %s', 
        check_point_status_old.sui_balance.toString(),
        check_point_status_new.sui_balance.toString(),
        check_point_status_new.sui_balance.sub(check_point_status_old.sui_balance).toString(),
        balance_change.sui_change.toString());

    console.log('CETUS %s => %s, balance_change: %s, balance_change(rsp): %s', 
        check_point_status_old.cetus_balance.toString(),
        check_point_status_new.cetus_balance.toString(),
        check_point_status_new.cetus_balance.sub(check_point_status_old.cetus_balance).toString(),
        balance_change.cetus_change.toString());

    console.log('USDC Quota in Wallet %s => %s, delta: %s', 
        check_point_status_old.usdc_quota_in_wallet.toString(),
        check_point_status_new.usdc_quota_in_wallet.toString(),
        check_point_status_new.usdc_quota_in_wallet.sub(check_point_status_old.usdc_quota_in_wallet).toString());

    console.log('SUI Quota in Wallet %s => %s, delta: %s', 
        check_point_status_old.sui_quota_in_wallet.toString(),
        check_point_status_new.sui_quota_in_wallet.toString(),
        check_point_status_new.sui_quota_in_wallet.sub(check_point_status_old.sui_quota_in_wallet).toString());

    console.log('USDC Quota in Position %s => %s, delta: %s', 
        check_point_status_old.usdc_quota_in_pos.toString(),
        check_point_status_new.usdc_quota_in_pos.toString(),
        check_point_status_new.usdc_quota_in_pos.sub(check_point_status_old.usdc_quota_in_pos).toString());

    console.log('SUI Quota in Position %s => %s, delta: %s', 
        check_point_status_old.sui_quota_in_pos.toString(),
        check_point_status_new.sui_quota_in_pos.toString(),
        check_point_status_new.sui_quota_in_pos.sub(check_point_status_old.sui_quota_in_pos).toString());


    console.log('');
    console.log('Lost : ');
    console.log('Total Gas Fee : ', total_gas_fee.neg().toString());


    console.log('');
    console.log('SUI Price: ', sui_price);
    let quota_value_old = calcQuotaValue(sui_price, check_point_status_old);
    let quota_value_new = calcQuotaValue(sui_price, check_point_status_new);
    
    console.log('Total Quota Value before: ', quota_value_old.total_quota_value);
    console.log('Total Quota Value after : ', quota_value_new.total_quota_value);
    console.log('Delta(Relative Loss):');
    console.log(quota_value_new.total_quota_value.sub(quota_value_old.total_quota_value));

    console.log('');
    let total_gas_fee_in_decimals = Decimal(total_gas_fee.neg().toString()).mul(Decimal.pow(10, -9));
    let total_gas_fee_value = total_gas_fee_in_decimals.mul(sui_price);
    console.log('Gas: %s(%s * SUI Price)', total_gas_fee_value, total_gas_fee_in_decimals);

    console.log(' ========== %s End ========== ', title);
}




































async function main() {

    const sendKeypair = Ed25519Keypair.deriveKeypair(MNEMONICS, HD_WALLET_PATH);
    const account_address = sendKeypair.getPublicKey().toSuiAddress();
    cetusClmmSDK.setSenderAddress(account_address);
    console.log('Account Address: ', account_address);


    let check_point_status_last = newCheckPointStatus();
    // get check_point_status
    let check_point_status = newCheckPointStatus();
    let wallet_balance = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
    while(true) {
        try {
            wallet_balance = await getAllWalletBalance(account_address);   
        } catch(e) {
            if (e instanceof Error) {
                console.error('%s [error] getAllWalletBalance get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
            } else {
                console.error('getAllWalletBalance get an exception'); 
                console.error(e);
            }
            await new Promise(f => setTimeout(f, 500));
            continue;
        }
        break;
    }
    check_point_status.gas_reserved = SUI_GAS_RESERVED;
    check_point_status.usdc_balance = new BN(wallet_balance.usdc_amount);
    check_point_status.sui_balance = new BN(wallet_balance.sui_amount);
    check_point_status.cetus_balance = new BN(wallet_balance.cetus_amount);
    check_point_status.usdc_quota_in_wallet = check_point_status.usdc_balance.clone();
    check_point_status.sui_quota_in_wallet = check_point_status.sui_balance.sub(check_point_status.gas_reserved);    

    // get price and value
    let sui_price = d(0);
    while(true) {
        try {
            sui_price = await getCurrentSuiPrice();
        } catch(e) {
            if (e instanceof Error) {
                console.error('%s [error] getAllWalletBalance get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
            } else {
                console.error('getAllWalletBalance get an exception'); 
                console.error(e);
            }
            await new Promise(f => setTimeout(f, 500)); 
            continue;
        }
        break;
    }
    check_point_status.sui_price = sui_price;
    let quota_value = calcQuotaValue(sui_price, check_point_status);

    // print
    console.log('');
    console.log(' - Check Point : Initial - ');
    dumpCheckPoint(check_point_status);

    console.log('Total Quota Value: ', quota_value.total_quota_value);
    console.log('');

    check_point_status_last = check_point_status;










    
    let position_lower_bound_seed = 0;

    let current_tick_index = 0;
    let tick_lower_index = 0;
    let tick_upper_index = 0;

    let digest_swap = '';
    let total_gas_fee_swap = new BN(0);
    let balance_change_swap = newBalanceChange();    

    let wallet_balance_after_swap = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
    let check_point_status_after_swap = newCheckPointStatus();




    let current_tick_index_after_swap = 0;
    let tick_lower_index_after_swap = 0;
    let tick_upper_index_after_swap = 0;

    let digest_add_liquidity = '';
    let total_gas_fee_add_liquidity = new BN(0);
    let balance_change_add_liquidity = newBalanceChange();
    let add_liquidity_event = newLiquidityEvent();

    let wallet_balance_after_add_liquidity = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
    let check_point_status_after_add_liquidity = newCheckPointStatus();


    let total_gas_fee_swap_accumulate = new BN(0);



    while (true) {
        // get tick
        let pools: Pool[] | null = null;
        while(true) { // try best to recover
            try {
                pools = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_SUI_0_05]);
                if (pools == null || pools.length <= 0) {
                    console.log('[ERROR] can not retrive pool info with getAssignPools, wait and try again...');
                    await new Promise(f => setTimeout(f, 500));
                    continue;
                }
            } catch (e) {
                if (e instanceof Error) {
                    console.error('%s [error] getAssignPools get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('getAssignPools get an exception'); 
                    console.error(e);
                }
                console.error('wait and try again...'); 
                await new Promise(f => setTimeout(f, 500));
                continue;
            }
            break;
        }

        current_tick_index = pools[0].current_tick_index;
        tick_lower_index = 0;
        tick_upper_index = 0;

        let tick_spacing_lower_index = Math.floor(current_tick_index / POOL_TICK_SPACING_USDC_SUI_0_05) * POOL_TICK_SPACING_USDC_SUI_0_05;
        let tick_spacing_upper_index = tick_spacing_lower_index + POOL_TICK_SPACING_USDC_SUI_0_05;
        let tick_lower_side = (tick_spacing_upper_index - current_tick_index) > (current_tick_index - tick_spacing_lower_index); // [tick_lower_index, tick_middle)

        if (POOL_TICK_SPACING_TIMES % 2) { // odd
            tick_lower_index = tick_spacing_lower_index - Math.floor(POOL_TICK_SPACING_TIMES / 2) * POOL_TICK_SPACING_USDC_SUI_0_05;
            tick_upper_index = tick_spacing_upper_index + Math.floor(POOL_TICK_SPACING_TIMES / 2) * POOL_TICK_SPACING_USDC_SUI_0_05;
        } else { // even
            tick_lower_index = (tick_lower_side? tick_spacing_lower_index : tick_spacing_upper_index) - Math.floor(POOL_TICK_SPACING_TIMES / 2) * POOL_TICK_SPACING_USDC_SUI_0_05;
            tick_upper_index = (tick_lower_side? tick_spacing_lower_index : tick_spacing_upper_index) + Math.floor(POOL_TICK_SPACING_TIMES / 2) * POOL_TICK_SPACING_USDC_SUI_0_05;
        }

        position_lower_bound_seed = tick_lower_index;

        console.log('Pool Tick Spacing: %d - (%d) - %d', tick_spacing_lower_index, current_tick_index, tick_spacing_upper_index);  
        console.log('Pool Tick Status: %d - (%d) - %d', tick_lower_index, current_tick_index, tick_upper_index);
        console.log('position_lower_bound_seed: ', position_lower_bound_seed);
        if (current_tick_index === tick_lower_index || current_tick_index === tick_upper_index) {
            // when POOL_TICK_SPACING_TIMES == 1
            console.log('current_tick_index at border, exit');
            return;
        }




        // rebalance
        const rebalance_info = getRebalanceDirectionAndAmount(check_point_status_last.usdc_quota_in_wallet, check_point_status_last.sui_quota_in_wallet , current_tick_index, tick_lower_index, tick_upper_index);
        date.setTime(Date.now())
        console.log('')
        console.log('[%s] - getRebalanceDirectionAndAmount - ', date.toLocaleString());
        console.log('rebalance_info.valid', rebalance_info.valid);
        console.log('rebalance_info.need_swap', rebalance_info.need_swap);
        console.log('rebalance_info.a2b', rebalance_info.a2b);    
        console.log('rebalance_info.amount_in', rebalance_info.amount_in.toString())
        console.log('rebalance_info.amount_out', rebalance_info.amount_out.toString())
        console.log('rebalance_info.coin_a_amount_new', rebalance_info.coin_a_amount_new.toString())
        console.log('rebalance_info.coin_b_amount_new', rebalance_info.coin_b_amount_new.toString())
        console.log('')

    



        // perform swap       
        digest_swap = '';
        total_gas_fee_swap = new BN(0);
        balance_change_swap = newBalanceChange();
        if (rebalance_info.valid && rebalance_info.need_swap) {
            let txb = new Transaction();
            while (true) { // try best to recover
                try {
                    const routers = await client.findRouters({
                        from: rebalance_info.a2b ? COIN_TYPE_ADDRESS_USDC : COIN_TYPE_ADDRESS_SUI,
                        target: rebalance_info.a2b ? COIN_TYPE_ADDRESS_SUI : COIN_TYPE_ADDRESS_USDC,
                        amount: rebalance_info.amount_in,
                        byAmountIn: true // `true` means fix input amount, `false` means fix output amount
                    });

                    if (routers == null) {
                        console.log('[error] Swap: client.findRouter return null, wait 2s and try again...'); 
                        await new Promise(f => setTimeout(f, 2000));
                        continue;
                    }

                    dumpSDKRet2Logfile('Swap:findRouters', JSON.stringify(routers, null, 2));
                    console.log('[%s] - client.findRouters: %s - ', date.toLocaleString(), routers ? 'Not return null' : 'Return null');

                    client.signer = account_address;
                    await client.fastRouterSwap({
                        routers,
                        txb,
                        slippage: 0.01,
                    });

                    const result = await client.devInspectTransactionBlock(txb);
                    dumpSDKRet2Logfile('Swap: devInspectTransactionBlock', JSON.stringify(result, null, 2));
                    console.log('[%s] - client.devInspectTransactionBlock: %s - ', date.toLocaleString(), result.effects.status.status);

                    if (result.effects.status.status !== "success") {
                        console.log('[error] Swap: client.devInspectTransactionBlock return failed, continue ,do not wait'); 
                        // await new Promise(f => setTimeout(f, 2000));
                        // continue;
                    }               

                } catch (e) {
                    if (e instanceof Error) {
                        console.error('%s [error] Aggregator Swap get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                    } else {
                        console.error('[error] Aggregator Swap get an exception'); 
                        console.error(e);
                    }
                    console.error('wait 2s and try again...'); 
                    await new Promise(f => setTimeout(f, 2000));
                    continue;
                }
                break;
            }

            try { // can not recover, process from the begining
                const signAndExecuteResult = await client.signAndExecuteTransaction(txb, sendKeypair);
                // const signAndExecuteResult = await client.sendTransaction(txb, sendKeypair);
                dumpSDKRet2Logfile('Swap: signAndExecuteTransaction', JSON.stringify(signAndExecuteResult, null, 2));
                console.log('[%s] - client.signAndExecuteTransaction: %s - ', date.toLocaleString(), signAndExecuteResult.effects?.status.status);

                if (signAndExecuteResult.effects?.status.status !== "success") {
                    console.log('[error] Swap: client.signAndExecuteTransaction return failed, wait 2s and try again...'); 
                    await new Promise(f => setTimeout(f, 2000));
                    continue;
                }
                
                digest_swap = signAndExecuteResult.digest;

            } catch (e) {
                if (e instanceof Error) {
                    console.error('%s [error] Aggregator Swap get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('[error] Aggregator Swap get an exception'); 
                    console.error(e);
                }
                console.error('wait 2s and try again...'); 
                await new Promise(f => setTimeout(f, 2000));
                continue;
            }
        }

        // get swap tx rsp
        while (true) { // try best to recover
            try {
                const tx_rsp = await cetusClmmSDK.FullClient.getTransactionBlock({
                    digest: digest_swap, 
                    options: {
                        showBalanceChanges: true,
                        showEffects: true,
                        showEvents: true
                        // showInput: true,
                        // showObjectChanges: true,
                        // showRawEffects: true,
                        // showRawInput:true
                    }
                });
                if (tx_rsp.effects?.status.status !== 'success') {
                    console.log('[error] Aggregator Swap: cetusClmmSDK.FullClient.getTransactionBlock return failed, wait 2s and try again...');
                    await new Promise(f => setTimeout(f, 2000));
                    continue;
                }
                total_gas_fee_swap = getTotalGasFee(tx_rsp); // iadd to accumulate if later part fail
                balance_change_swap = getBalanceChange(tx_rsp);
            } catch(e) {
                if (e instanceof Error) {
                    console.error('%s [error] Aggregator Swap getTransactionBlock get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('[error] Aggregator Swap getTransactionBlock get an exception'); 
                    console.error(e);
                }
                console.error('wait 2s and try again...'); 
                await new Promise(f => setTimeout(f, 2000));
                continue;
            }
            break;
        }

        total_gas_fee_swap_accumulate.iadd(total_gas_fee_swap);

        console.log('')
        console.log('- Aggregator Swap Transaction Rsp - ');
        console.log('digest_swap: ', digest_swap);

        console.log('total_gas_fee_swap: ', total_gas_fee_swap.toString());
        console.log('total_gas_fee_swap_accumulate: ', total_gas_fee_swap_accumulate.toString());

        console.log('balance_change_swap.usdc_change: ', balance_change_swap.usdc_change.toString());
        console.log('balance_change_swap.sui_change: ', balance_change_swap.sui_change.toString());
        console.log('balance_change_swap.cetus_change: ', balance_change_swap.cetus_change.toString());
        console.log('')





        wallet_balance_after_swap = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
        while(true) { // try best to recover
            try {
                wallet_balance_after_swap = await getAllWalletBalance(account_address);
                // wait for wallet balance updated.
                while (balanceNotChange(wallet_balance, wallet_balance_after_swap)) {
                    date.setTime(Date.now());
                    console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());
                    await new Promise(f => setTimeout(f, 1000));
                    wallet_balance_after_swap = await getAllWalletBalance(account_address);
                }
            } catch(e) {
                if (e instanceof Error) {
                    console.error('%s [error] wait for wallet balance updated get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('wait for wallet balance updated get an exception'); 
                    console.error(e);
                }
                await new Promise(f => setTimeout(f, 100)); // 0.1s
                continue;
            }
            break;
        }



        // get check_point_status
        check_point_status_after_swap = newCheckPointStatus();
        check_point_status_after_swap.gas_reserved = SUI_GAS_RESERVED.sub(total_gas_fee_swap_accumulate);
        check_point_status_after_swap.usdc_balance = new BN(wallet_balance_after_swap.usdc_amount);
        check_point_status_after_swap.sui_balance = new BN(wallet_balance_after_swap.sui_amount);
        check_point_status_after_swap.cetus_balance = new BN(wallet_balance_after_swap.cetus_amount);
        check_point_status_after_swap.usdc_quota_in_wallet = check_point_status_after_swap.usdc_balance.clone();
        check_point_status_after_swap.sui_quota_in_wallet = check_point_status_after_swap.sui_balance.sub(check_point_status_after_swap.gas_reserved); 

        // get price and value
        let sui_price_after_swap = d(0);
        while(true) { // try best to recover
            try {
                sui_price_after_swap = await getCurrentSuiPrice();
            } catch(e) {
                if (e instanceof Error) {
                    console.error('%s [error] getCurrentSuiPrice get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('getCurrentSuiPrice get an exception'); 
                    console.error(e);
                }
                await new Promise(f => setTimeout(f, 100)); // 0.1s
                continue;
            }
            break;
        }
        check_point_status_after_swap.sui_price = sui_price_after_swap;
        let quota_value_after_swap = calcQuotaValue(sui_price_after_swap, check_point_status_after_swap);

        // print
        console.log('');
        console.log(' - Check Point : After Swap - ');
        dumpCheckPoint(check_point_status_after_swap);
        console.log('Total Quota Value: ', quota_value_after_swap.total_quota_value);
        console.log('');       


        // dump transaction statistics
        dumpTransactionInfo('Swap Transaction Info', check_point_status_last, check_point_status_after_swap, 
            sui_price_after_swap, digest_swap, total_gas_fee_swap, balance_change_swap);

        check_point_status_last = {...check_point_status_after_swap};


        console.log('');
        console.log('');

        

        























        console.log('\n');

        // get new pool status for add liquidity
        let pools_after_swap: Pool[] | null = null;
        while(true) { // try best to recover
            try {
                pools_after_swap = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_SUI_0_05]);
                if (pools_after_swap == null || pools_after_swap.length <= 0) {
                    console.log('[ERROR] can not retrive pool info with getAssignPools, wait and try again...');
                    await new Promise(f => setTimeout(f, 500));
                    continue;
                }
            } catch (e) {
                if (e instanceof Error) {
                    console.error('%s [error] getAssignPools get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('getAssignPools get an exception'); 
                    console.error(e);
                }
                console.error('wait and try again...'); 
                await new Promise(f => setTimeout(f, 500));
                continue;
            }
            break;
        }
        

        current_tick_index_after_swap = pools_after_swap[0].current_tick_index;
        tick_lower_index_after_swap = position_lower_bound_seed + Math.floor((current_tick_index_after_swap - position_lower_bound_seed) / POSITION_TICK_RANGE) * POSITION_TICK_RANGE;
        tick_upper_index_after_swap = tick_lower_index_after_swap + POSITION_TICK_RANGE;

        console.log('Pool Tick Status init: %d - (%d) - %d', tick_lower_index, current_tick_index, tick_upper_index);
        console.log('Pool Tick Status: %d - (%d) - %d', tick_lower_index_after_swap, current_tick_index_after_swap, tick_upper_index_after_swap);

        if (tick_lower_index_after_swap != tick_lower_index || tick_upper_index_after_swap != tick_upper_index) {
            console.log('[ERROR] position has switched, quit!');
            return;
        }

        if (Decimal(current_tick_index_after_swap - current_tick_index).abs().gte(10)) {
            console.log('[WARNING] current_tick_index change more than 10 tick');
        }











        // try to decide fix_amount_a, amount_a,amount_b for add liquidity

        let fix_amount_a = false;
        let coin_amount = new BN(0);
        const slippage_for_add_liquidity = 0.04;
        let cur_sqrt_price = TickMath.tickIndexToSqrtPriceX64(current_tick_index_after_swap);

        let total_usdc_slippage = new BN(d(check_point_status_after_swap.usdc_quota_in_wallet.toString()).mul(slippage_for_add_liquidity).round().toString());
        let total_sui_slippage = new BN(d(check_point_status_after_swap.sui_quota_in_wallet.toString()).mul(slippage_for_add_liquidity).round().toString());

        // discount slippage_for_add_liquidity per side, to meet huge change of position coin ratio
        let total_usdc_amount_after_swap_for_slippage = check_point_status_after_swap.usdc_quota_in_wallet.sub(total_usdc_slippage);
        let total_sui_amount_after_swap_for_slippage = check_point_status_after_swap.sui_quota_in_wallet.sub(total_sui_slippage);
        
        console.log('')
        console.log(' - estLiquidityAndCoinAmountFromOneAmounts - ')
        console.log(' Coin A Amount in Wallet %s * (1 - slippage) = Amount used for est %s ', check_point_status_after_swap.usdc_quota_in_wallet.toString(), total_usdc_amount_after_swap_for_slippage.toString(), );
        console.log(' Coin B Amount in Wallet %s * (1 - slippage) = Amount used for est %s', check_point_status_after_swap.sui_quota_in_wallet.toString(), total_sui_amount_after_swap_for_slippage.toString());
        

        // try fix coin a
        fix_amount_a = true;
        coin_amount = total_usdc_amount_after_swap_for_slippage.clone();
        let liquidity_input = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
            tick_lower_index_after_swap,
            tick_upper_index_after_swap,
            coin_amount,
            fix_amount_a,
            true,
            slippage_for_add_liquidity,
            cur_sqrt_price
        )

        console.log(' - ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(try fix Coin A): return - ');
        console.log('liquidity_input.coin_amount_a: ', liquidity_input.coin_amount_a);
        console.log('liquidity_input.coin_amount_b: ', liquidity_input.coin_amount_b);
        console.log('liquidity_input.coin_amount_limit_a: ', liquidity_input.coin_amount_limit_a);
        console.log('liquidity_input.coin_amount_limit_b: ', liquidity_input.coin_amount_limit_b);
        console.log('liquidity_input.fix_amount_a: ', liquidity_input.fix_amount_a);
        console.log('liquidity_input.liquidity_amount: ', liquidity_input.liquidity_amount);       

        if (check_point_status_after_swap.sui_quota_in_wallet.lt(new BN(liquidity_input.coin_amount_limit_b))) {
            console.log('coin b remain(%s) is insuffcient for required - iquidity_input.coin_amount_limit_b(%s)', 
                check_point_status_after_swap.sui_quota_in_wallet.toString(), liquidity_input.coin_amount_limit_b);

            
            // try fix coin b
            fix_amount_a = false;
            coin_amount = total_sui_amount_after_swap_for_slippage.clone();

            liquidity_input = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
                tick_lower_index_after_swap,
                tick_upper_index_after_swap,
                coin_amount,
                fix_amount_a,
                true,
                slippage_for_add_liquidity,
                cur_sqrt_price
            )

            console.log(' - ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(try fix Coin B): return - ');
            console.log('liquidity_input.coin_amount_a: ', liquidity_input.coin_amount_a);
            console.log('liquidity_input.coin_amount_b: ', liquidity_input.coin_amount_b);
            console.log('liquidity_input.coin_amount_limit_a: ', liquidity_input.coin_amount_limit_a);
            console.log('liquidity_input.coin_amount_limit_b: ', liquidity_input.coin_amount_limit_b);
            console.log('liquidity_input.fix_amount_a: ', liquidity_input.fix_amount_a);
            console.log('liquidity_input.liquidity_amount: ', liquidity_input.liquidity_amount);

            if (check_point_status_after_swap.usdc_quota_in_wallet.lt(new BN(liquidity_input.coin_amount_limit_a))) {
                console.log('coin a remain(%s) is insuffcient for required - iquidity_input.coin_amount_limit_a(%s)', 
                            check_point_status_after_swap.usdc_quota_in_wallet.toString(), liquidity_input.coin_amount_limit_a);
                console.log('[ERROR] The remain coin cannot meet the required for add liquidity, pls rebalance again. Exit');
                return;
            }
        }

        const amount_a = fix_amount_a ? coin_amount : new BN(liquidity_input.coin_amount_limit_a);
        const amount_b = fix_amount_a ? new BN(liquidity_input.coin_amount_limit_b) : coin_amount;


        console.log(' - est result used for add liquidity - ');
        console.log('slippage_for_add_liquidity: ', slippage_for_add_liquidity);
        console.log('fix_amount_a: ', fix_amount_a);
        console.log('amount_a for add liquidity: ', amount_a.toString());
        console.log('amount_b for add liquidity: ', amount_b.toString());
        console.log('')

        if (amount_a.gte(check_point_status_after_swap.usdc_quota_in_wallet) || amount_b.gte(check_point_status_after_swap.sui_quota_in_wallet)) {
            console.log('[ERROR] amount_a / b greater than amount after swap, quit!');        
            return;
        }

        












        // perform add liquidity
        digest_add_liquidity = '';
        total_gas_fee_add_liquidity = new BN(0);
        balance_change_add_liquidity = newBalanceChange();
        add_liquidity_event = newLiquidityEvent();

        const add_liquidity_payload_params: AddLiquidityFixTokenParams = {
            coin_type_a: pools_after_swap[0].coin_type_a,
            coin_type_b: pools_after_swap[0].coin_type_b,
            pool_id: pools_after_swap[0].id,
            tick_lower: tick_lower_index_after_swap,
            tick_upper: tick_upper_index_after_swap,
            fix_amount_a,
            amount_a: amount_a.toString(),
            amount_b: amount_b.toString(),
            slippage: slippage_for_add_liquidity,
            is_open: true,
            pos_id: '',
            rewarder_coin_types: [],
            collect_fee: false,
        }



        try { // can not recover, process from the begining again
            const add_liquidity_payload = await cetusClmmSDK.Position.createAddLiquidityFixTokenPayload(add_liquidity_payload_params);
            dumpSDKRet2Logfile('Add Liquidity: cetusClmmSDK.Position.createAddLiquidityFixTokenPayload', JSON.stringify(add_liquidity_payload, null, 2));
            console.log('[%s] - cetusClmmSDK.Position.createAddLiquidityFixTokenPayload - ', date.toLocaleString());

            const transfer_txn = await cetusClmmSDK.FullClient.sendTransaction(sendKeypair, add_liquidity_payload);
            dumpSDKRet2Logfile('Add Liquidity: cetusClmmSDK.FullClient.sendTransaction', JSON.stringify(transfer_txn, null, 2));
            console.log('[%s] - cetusClmmSDK.FullClient.sendTransaction: %s - ', date.toLocaleString(), transfer_txn?.effects?.status.status);

            if (transfer_txn?.effects?.status.status !== "success") {
                console.log('[error] Add Liquidity: cetusClmmSDK.FullClient.sendTransaction return failed, wait 2s and try again...');
                await new Promise(f => setTimeout(f, 2000));
                continue;
            }
            digest_add_liquidity = transfer_txn.digest;
        } catch (e) {
            if (e instanceof Error) {
                console.error('%s [error] Add Liquidity get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
            } else {
                console.error('[error] Add Liquidity get an exception'); 
                console.error(e);
            }
            console.error('wait 2s and try again...'); 
            await new Promise(f => setTimeout(f, 2000));
            continue;
        }

        while (true) { // try best to recover
            try {
                const tx_rsp = await cetusClmmSDK.FullClient.getTransactionBlock({
                    digest: digest_add_liquidity, 
                    options: {
                        showBalanceChanges: true,
                        showEffects: true,
                        showEvents: true
                        // showInput: true,
                        // showObjectChanges: true,
                        // showRawEffects: true,
                        // showRawInput:true
                    }
                });
                if (tx_rsp.effects?.status.status !== 'success') {
                    console.log('[error] Add Liquidity: cetusClmmSDK.FullClient.getTransactionBlock return failed, wait 2s and try again...');
                    await new Promise(f => setTimeout(f, 2000));
                    continue;
                }

                total_gas_fee_add_liquidity = getTotalGasFee(tx_rsp);
                balance_change_add_liquidity = getBalanceChange(tx_rsp);
                add_liquidity_event = getAddLiquidityEvent(tx_rsp);
            } catch(e) {
                if (e instanceof Error) {
                    console.error('%s [error] Add Liquidity getTransactionBlock get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('[error] Add Liquidity getTransactionBlock get an exception'); 
                    console.error(e);
                }
                console.error('wait 2s and try again...'); 
                await new Promise(f => setTimeout(f, 2000));
                continue;
            }
            break;
        }


        console.log('')
        console.log('- Add Liquidity Transaction Rsp - ');
        console.log('digest_add_liquidity: ', digest_add_liquidity);

        console.log('total_gas_fee_add_liquidity: ', total_gas_fee_add_liquidity.toString());

        console.log('balance_change_add_liquidity.usdc_change: ', balance_change_add_liquidity.usdc_change.toString());
        console.log('balance_change_add_liquidity.sui_change: ', balance_change_add_liquidity.sui_change.toString());
        console.log('balance_change_add_liquidity.cetus_change: ', balance_change_add_liquidity.cetus_change.toString());

        console.log('add_liquidity_event.after_liquidity: ', add_liquidity_event.after_liquidity.toString());
        console.log('add_liquidity_event.amount_a: ', add_liquidity_event.amount_a.toString());
        console.log('add_liquidity_event.amount_b: ', add_liquidity_event.amount_b.toString());
        console.log('add_liquidity_event.liquidity: ', add_liquidity_event.liquidity.toString());
        console.log('');









        wallet_balance_after_add_liquidity = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};

        while(true) { // try best to recover
            try {
                wallet_balance_after_add_liquidity = await getAllWalletBalance(account_address);
                // wait for wallet balance updated.
                while (balanceNotChange(wallet_balance_after_swap, wallet_balance_after_add_liquidity)) {
                    date.setTime(Date.now());
                    console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());
                    await new Promise(f => setTimeout(f, 1000));
                    wallet_balance_after_add_liquidity = await getAllWalletBalance(account_address);
                }                
            } catch(e) {
                if (e instanceof Error) {
                    console.error('%s [error] wait for wallet balance updated get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('wait for wallet balance updated get an exception'); 
                    console.error(e);
                }
                await new Promise(f => setTimeout(f, 100)); // 0.1s
                continue;
            }
            break;
        }



        // get check_point_status
        check_point_status_after_add_liquidity = newCheckPointStatus();
        check_point_status_after_add_liquidity.gas_reserved = SUI_GAS_RESERVED.sub(total_gas_fee_swap_accumulate).sub(total_gas_fee_add_liquidity);
        check_point_status_after_add_liquidity.usdc_balance = new BN(wallet_balance_after_add_liquidity.usdc_amount);
        check_point_status_after_add_liquidity.sui_balance = new BN(wallet_balance_after_add_liquidity.sui_amount);
        check_point_status_after_add_liquidity.cetus_balance = new BN(wallet_balance_after_add_liquidity.cetus_amount);
        check_point_status_after_add_liquidity.usdc_quota_in_wallet = check_point_status_after_add_liquidity.usdc_balance.clone();
        check_point_status_after_add_liquidity.sui_quota_in_wallet = check_point_status_after_add_liquidity.sui_balance.sub(check_point_status_after_add_liquidity.gas_reserved);   
        check_point_status_after_add_liquidity.usdc_quota_in_pos = add_liquidity_event.amount_a.clone();
        check_point_status_after_add_liquidity.sui_quota_in_pos = add_liquidity_event.amount_b.clone();

        // get price and value
        let sui_price_after_add_liquidity = d(0);
        while(true) { // try best to recover
            try {
                sui_price_after_add_liquidity = await getCurrentSuiPrice();
            } catch(e) {
                if (e instanceof Error) {
                    console.error('%s [error] getCurrentSuiPrice get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('getCurrentSuiPrice get an exception'); 
                    console.error(e);
                }
                await new Promise(f => setTimeout(f, 100)); // 0.1s
                continue;
            }
            break;
        }
        check_point_status_after_add_liquidity.sui_price = sui_price_after_add_liquidity;
        let quota_value_after_add_liquidity = calcQuotaValue(sui_price_after_add_liquidity, check_point_status_after_swap);

        // print
        console.log('');
        console.log(' - Check Point : After Add Liquidity - ');
        dumpCheckPoint(check_point_status_after_add_liquidity);
        console.log('Total Quota Value: ', quota_value_after_add_liquidity.total_quota_value);
        console.log('');       


        // dump transaction statistics
        dumpTransactionInfo('Add Liquidity Transaction Info', check_point_status_last, check_point_status_after_add_liquidity, 
            sui_price_after_add_liquidity, digest_add_liquidity, total_gas_fee_add_liquidity, balance_change_add_liquidity);
            
        check_point_status_last = {...check_point_status_after_add_liquidity};

        break;
    }










    // calc impermanent loss and value loss in lower/upper bounder and print    
    let tick_when_add_liquidity = getAddLiquidityTickIndex(add_liquidity_event, tick_lower_index_after_swap, tick_upper_index_after_swap);    

    console.log('');
    console.log('Position Tick Range When Add Liquidity: %d - (%d) - %d', tick_lower_index_after_swap, tick_when_add_liquidity, tick_upper_index_after_swap);

    let impermanent_loss_ctx = getImpermanentLossCtx(tick_lower_index_after_swap, tick_when_add_liquidity, tick_upper_index_after_swap, 
        add_liquidity_event, check_point_status, check_point_status_after_add_liquidity);
    console.log(' - impermanent_loss_ctx - ');
    console.log(JSON.stringify(impermanent_loss_ctx, null, 2));
    console.log('');







    for (;;) {
        await new Promise(f => setTimeout(f, 10000)); // 10s
        date.setTime(Date.now());
        console.log('');
        console.log('');
        console.log('[%s] New Cycle...query pool position info...', date.toLocaleString());
        

        // get new pool status for query pos status
        let pools_after_add_liquidity: Pool[] | null = null;
        while(true) {
            try {
                pools_after_add_liquidity = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_SUI_0_05]);
                if (pools_after_add_liquidity == null || pools_after_add_liquidity.length <= 0) {
                    console.log('[ERROR] can not retrive pool info with getAssignPools, wait and try again...');
                    await new Promise(f => setTimeout(f, 500));
                    continue;
                }
            } catch (e) {
                if (e instanceof Error) {
                    console.error('%s [error] getAssignPools get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('getAssignPools get an exception'); 
                    console.error(e);
                }
                console.error('wait and try again...'); 
                await new Promise(f => setTimeout(f, 500));
                continue;
            }
            break;
        }
        let current_tick_index_after_add_liquidity: number = pools_after_add_liquidity[0].current_tick_index;
        let tick_lower_index_after_add_liquidity: number = position_lower_bound_seed + Math.floor((current_tick_index_after_add_liquidity - position_lower_bound_seed) / POSITION_TICK_RANGE) * POSITION_TICK_RANGE;
        let tick_upper_index_after_add_liquidity: number = tick_lower_index_after_add_liquidity + POSITION_TICK_RANGE;

        console.log('Position Tick Range Initial: %d - (%d) - %d', tick_lower_index, current_tick_index, tick_upper_index);
        console.log('Position Tick Range After Swap: %d - (%d) - %d', tick_lower_index_after_swap, current_tick_index_after_swap, tick_upper_index_after_swap);
        console.log('Position Tick Range When Add Liquidity: %d - (%d) - %d', tick_lower_index_after_swap, tick_when_add_liquidity, tick_upper_index_after_swap);
        console.log('-> Position Tick Range Now: %d - (%d) - %d', tick_lower_index_after_add_liquidity, current_tick_index_after_add_liquidity, tick_upper_index_after_add_liquidity);
        console.log('-> Position Price Range Now: %s - (%s) - %s', 
            d(1).div(TickMath.tickIndexToPrice(tick_lower_index_after_add_liquidity, 6, 9)).toFixed(6).toString(),
            d(1).div(TickMath.tickIndexToPrice(current_tick_index_after_add_liquidity, 6, 9)).toFixed(6).toString(),
            d(1).div(TickMath.tickIndexToPrice(tick_upper_index_after_add_liquidity, 6, 9)).toFixed(6).toString());

        



        // get position
        let positions: Position[] | null = null;
        while(true) {
            try {
                positions = await cetusClmmSDK.Position.getPositionList(account_address, [POOL_ADDRESS_USDC_SUI_0_05], false);
                if (positions == null || positions.length <= 0) {
                    console.log('[ERROR] can not retrive pool info with getPositionList, wait and try again...');
                    await new Promise(f => setTimeout(f, 500));
                    continue;
                }
            } catch (e) {
                if (e instanceof Error) {
                    console.error('%s [error] getPositionList get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('getPositionList get an exception'); 
                    console.error(e);
                }
                console.error('wait and try again...'); 
                await new Promise(f => setTimeout(f, 500));
                continue;
            }
            break;
        }


        

        // get fee and reward
        let fee_and_reward: FeeAndReward = newFeeAndReward();
        while (true) {
            try {
                fee_and_reward = await getFeeAndReward(pools_after_add_liquidity[0], positions[0]);
            } catch(e) {
                if (e instanceof Error) {
                    console.error('%s [error] getFeeAndReward get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('getFeeAndReward get an exception'); 
                    console.error(e);
                }
                console.error('wait and try again...'); 
                await new Promise(f => setTimeout(f, 500));
                continue;
            }
            break;
        }
        // console.log('');
        // console.log('- Fee and Rewards - ');
        // console.log('fee_and_reward.fee_owned_a: ', fee_and_reward.fee_owned_a.toString());
        // console.log('fee_and_reward.fee_owned_b: ', fee_and_reward.fee_owned_b.toString());
        // console.log('fee_and_reward.rwd_owned_cetus: ', fee_and_reward.rwd_owned_cetus.toString());
        // console.log('fee_and_reward.rwd_owned_sui: ', fee_and_reward.rwd_owned_sui.toString());
        // console.log('');


        // get cetus price
        let cetus_price_after_add_liquidity = d(0);
        while(true) {
            try {
                cetus_price_after_add_liquidity = await getCurrentCetusPrice();
                break;
            } catch(e) {
                if (e instanceof Error) {
                    console.error('%s [error] getCurrentCetusPrice final get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                } else {
                    console.error('getCurrentCetusPrice final get an exception'); 
                    console.error(e);
                }
                await new Promise(f => setTimeout(f, 100)); // 0.1s
            }
        }

        let sui_price_after_add_liquidity = d(1).div(TickMath.tickIndexToPrice(pools_after_add_liquidity[0].current_tick_index, 6, 9));


        // get total fee and rwd value
        let fee_and_reward_value = getFeeAndRewardValue(sui_price_after_add_liquidity, cetus_price_after_add_liquidity, fee_and_reward);
        
        console.log('');
        console.log('sui_price_after_add_liquidity: %s  |  cetus_price_after_add_liquidity: %s', 
            sui_price_after_add_liquidity.toString(), 
            cetus_price_after_add_liquidity.toString());
        console.log('- Fee and Rewards Amount, Value- ');
        console.log('fee_owned_a: %s,  value: %s  |  fee_owned_b: %s,  value: %s', 
            fee_and_reward.fee_owned_a.toString(),
            fee_and_reward_value.fee_usdc_value.toString(),
            fee_and_reward.fee_owned_b.toString(),
            fee_and_reward_value.fee_sui_value.toString()
        );
        console.log('rwd_owned_sui: %s, value: %s  |  rwd_owned_cetus: %s, value: %s', 
            fee_and_reward.rwd_owned_sui.toString(),
            fee_and_reward_value.rwd_sui_value.toString(),
            fee_and_reward.rwd_owned_cetus.toString(),
            fee_and_reward_value.rwd_cetus_value.toString()
        );
        console.log('total value: ', fee_and_reward_value.total_value);        
        console.log('');


        let cetus_price_lower_index = cetus_price_after_add_liquidity.mul(impermanent_loss_ctx.sui_price_lower_index).div(sui_price_after_add_liquidity);
        let fee_and_reward_value_lower_index = getFeeAndRewardValue(impermanent_loss_ctx.sui_price_lower_index, cetus_price_lower_index, fee_and_reward);
        // console.log(' - Fee and Rewards Value Lower Index - ');
        // console.log('cetus_price_after_add_liquidity: ', cetus_price_lower_index);
        // console.log('sui_price_after_add_liquidity: ', impermanent_loss_ctx.sui_price_lower_index);
        // console.log(JSON.stringify(fee_and_reward_value_lower_index, null, 2));

        let cetus_price_upper_index = cetus_price_after_add_liquidity.mul(impermanent_loss_ctx.sui_price_upper_index).div(sui_price_after_add_liquidity);
        let fee_and_reward_value_upper_index = getFeeAndRewardValue(impermanent_loss_ctx.sui_price_upper_index, cetus_price_upper_index, fee_and_reward);
        // console.log(' - Fee and Rewards Value Upper Index - ');
        // console.log('cetus_price_after_add_liquidity: ', cetus_price_upper_index);
        // console.log('sui_price_after_add_liquidity: ', impermanent_loss_ctx.sui_price_upper_index);
        // console.log(JSON.stringify(fee_and_reward_value_upper_index, null, 2));


        console.log('--------------------------------------------------------');
        dumpImpermanentLossAndEarningRatio(impermanent_loss_ctx, fee_and_reward_value_lower_index, fee_and_reward_value_upper_index);
        console.log('--------------------------------------------------------');


        // dump current benifit
        console.log('--------------------------------------------------------');
        // gas loss
        let all_gas_fee = total_gas_fee_swap_accumulate.add(total_gas_fee_add_liquidity);
        let all_gas_fee_value = Decimal(all_gas_fee.neg().toString()).mul(Decimal.pow(10, -9)).mul(sui_price_after_add_liquidity);
        console.log('Total Gas Used: %s, value: %s', all_gas_fee.neg().toString(), all_gas_fee_value);

        // loss in transaction
        const coin_amount_in_pos = ClmmPoolUtil.getCoinAmountFromLiquidity(
            new BN(positions[0].liquidity), 
            TickMath.tickIndexToSqrtPriceX64(current_tick_index_after_add_liquidity),
            TickMath.tickIndexToSqrtPriceX64(tick_lower_index_after_swap),
            TickMath.tickIndexToSqrtPriceX64(tick_upper_index_after_swap),
            true
        );
        let check_point_status_in_clmm = {...check_point_status_after_add_liquidity};
        check_point_status_in_clmm.usdc_quota_in_pos = new BN(coin_amount_in_pos.coin_amount_a);
        check_point_status_in_clmm.sui_quota_in_pos = new BN(coin_amount_in_pos.coin_amount_b);        
        let cur_quota_value_holding_both_coin_ab = calcQuotaValue(sui_price_after_add_liquidity, check_point_status);        
        let cur_quota_value = calcQuotaValue(sui_price_after_add_liquidity, check_point_status_in_clmm);        
        let init_quota_value = calcQuotaValue(check_point_status.sui_price, check_point_status); // init_quota_value.total_quota_value equal to cur_quota_value_holding_both_coin_a

        let inpermanent_loss_with_holding_both_coin_ab = cur_quota_value.total_quota_value.sub(cur_quota_value_holding_both_coin_ab.total_quota_value);
        console.log('Impermanent Loss Value(Coin ab Initial): %s', inpermanent_loss_with_holding_both_coin_ab);

        let inpermanent_loss_with_holding_only_coin_a = cur_quota_value.total_quota_value.sub(init_quota_value.total_quota_value);
        console.log('Impermanent Loss Value(Coin a Initial): %s', inpermanent_loss_with_holding_only_coin_a);

        let cur_coin_b_value_holding_only_coin_b = init_quota_value.total_quota_value.div(check_point_status.sui_price).mul(sui_price_after_add_liquidity);
        let inpermanent_loss_with_holding_only_coin_b = cur_quota_value.total_quota_value.sub(cur_coin_b_value_holding_only_coin_b);
        console.log('Impermanent Loss Value(Coin b Initial): %s', inpermanent_loss_with_holding_only_coin_b);

        // fee and rwd earning
        console.log('Total Fee and Reward Value: %s', fee_and_reward_value.total_value);

        console.log('=');

        // Relative Benifit Now
        let total_benefit = all_gas_fee_value.add(fee_and_reward_value.total_value).add(inpermanent_loss_with_holding_both_coin_ab);
        console.log('Benifit(2 Holding Both Coin ab): %s (%s%%)', 
            total_benefit, 
            total_benefit.div(init_quota_value.total_quota_value).mul(100));

        let total_benefit_without_gas = fee_and_reward_value.total_value.add(inpermanent_loss_with_holding_both_coin_ab);
        console.log('Benifit(2 Holding Both Coin ab, Without Gas): %s (%s%%)', 
            total_benefit_without_gas, 
            total_benefit_without_gas.div(init_quota_value.total_quota_value).mul(100));


        let total_benefit_holding_only_a = all_gas_fee_value.add(fee_and_reward_value.total_value).add(inpermanent_loss_with_holding_only_coin_a);
        console.log('Benifit(2 Holding Only Coin a): %s (%s%%)', 
            total_benefit_holding_only_a, 
            total_benefit_holding_only_a.div(init_quota_value.total_quota_value).mul(100));

        let total_benefit_holding_only_a_without_gas = fee_and_reward_value.total_value.add(inpermanent_loss_with_holding_only_coin_a);
        console.log('Benifit(2 Holding Only Coin a, Without Gas): %s (%s%%)', 
            total_benefit_holding_only_a_without_gas, 
            total_benefit_holding_only_a_without_gas.div(init_quota_value.total_quota_value).mul(100));

        let total_benefit_holding_only_b = all_gas_fee_value.add(fee_and_reward_value.total_value).add(inpermanent_loss_with_holding_only_coin_b);
        console.log('Benifit(2 Holding Only Coin b): %s (%s%%)', 
            total_benefit_holding_only_b, 
            total_benefit_holding_only_b.div(init_quota_value.total_quota_value).mul(100));

        let total_benefit_holding_only_b_without_gas = fee_and_reward_value.total_value.add(inpermanent_loss_with_holding_only_coin_b);
        console.log('Benifit(2 Holding Only Coin b, Without Gas): %s (%s%%)', 
            total_benefit_holding_only_b_without_gas, 
            total_benefit_holding_only_b_without_gas.div(init_quota_value.total_quota_value).mul(100));
        console.log('--------------------------------------------------------');
        console.log('Quota Value:%s(%s), FeeRwd: %s', 
            cur_quota_value.total_quota_value.toString(), 
            inpermanent_loss_with_holding_only_coin_a.add(all_gas_fee_value).toString(),
            fee_and_reward_value.total_value.toString()
        );
        console.log('--------------------------------------------------------');



        

    }
    return;
}

main();
