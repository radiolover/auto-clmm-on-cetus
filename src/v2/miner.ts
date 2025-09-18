
import Decimal from 'decimal.js';
// import d from 'decimal.js';
import BN from 'bn.js'
import * as fs from 'fs';
import * as util from 'util';
import * as sqlite3 from 'sqlite3';

import { SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { CoinAssist, ClmmPoolUtil, TickMath, TickUtil,CoinAmounts , Percentage, adjustForSlippage ,MathUtil} from '@cetusprotocol/common-sdk';
import { d } from '@cetusprotocol/common-sdk';

import * as sqlite3_utils from './sqlite3_utils';




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



const SQLITE_DB_FILE_NAME = 'PositionInfo.db';






















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
























export type CheckPointStatus = {
    unix_timestamp_ms: number;
    tick_index: number;
    sui_price: Decimal;    
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
};

export function newCheckPointStatus(): CheckPointStatus {
    let ret: CheckPointStatus = {
        unix_timestamp_ms: 0,
        tick_index: 0,
        sui_price: d(0),
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
        gas_reserved: new BN(0)
    };
    return ret;
}

function dumpCheckPoint(check_point_status: CheckPointStatus) {
    console.log('Timestamp: ', new Date(check_point_status.unix_timestamp_ms).toLocaleString());
    console.log('Tick Index: ', check_point_status.tick_index);
    console.log('SUI Price: ', check_point_status.sui_price);
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
    pool: string;
    position: string
};


function newLiquidityEvent(): LiquidityEvent  {
    let ret: LiquidityEvent = {
        after_liquidity: new BN(0),
        amount_a: new BN(0),
        amount_b: new BN(0),
        liquidity: new BN(0),
        pool: '',
        position: ''
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
                    pool: string;
                    position: string;
                };
                ret.after_liquidity = new BN(json.after_liquidity);
                ret.amount_a = new BN(json.amount_a);
                ret.amount_b = new BN(json.amount_b);
                ret.liquidity = new BN(json.liquidity);
                ret.pool = json.pool;
                ret.position = json.position;
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
                    pool: string;
                    position: string;
                };
                ret.after_liquidity = new BN(json.after_liquidity);
                ret.amount_a = new BN(json.amount_a);
                ret.amount_b = new BN(json.amount_b);
                ret.liquidity = new BN(json.liquidity);
                ret.pool = json.pool;
                ret.position = json.position;
            }
        }
    }
    return ret;
}





export type TransactionInfo = {
    unix_timestamp_ms: number;
    digest: string;
    total_gas_fee: BN;
    balance_change: BalanceChange;
    liquidity_event: LiquidityEvent;
    fee_and_reward: FeeAndReward;
}

export function newTransactionInfo() {
    let ret: TransactionInfo = {
        unix_timestamp_ms: 0,
        digest: '',
        total_gas_fee: new BN(0),
        balance_change: newBalanceChange(),
        liquidity_event: newLiquidityEvent(),
        fee_and_reward: newFeeAndReward()
    };
    return ret;
}

type TransactionInfoQueryOptions = {
    get_fee_and_rwd: boolean;
    get_balance_change: boolean;
    get_add_liquidity_event: boolean;
    get_remove_liquidity_event: boolean;
    get_total_gas_fee: boolean;
};



async function getTransactionInfo(digest: string, tx_info: TransactionInfo, tx_opt: TransactionInfoQueryOptions, sendKeypair: Ed25519Keypair) {
    while (true) {
        try {
            const tx_rsp = await cetusClmmSDK.FullClient.getTransactionBlock({
                digest, 
                options: {
                    showBalanceChanges: tx_opt.get_balance_change,
                    showEffects: true, //  tx_opt.get_total_gas_fee and effects?.status.status
                    showEvents: tx_opt.get_fee_and_rwd || tx_opt.get_add_liquidity_event || tx_opt.get_remove_liquidity_event,
                    // showInput: true,
                    // showObjectChanges: true,
                    // showRawEffects: true,
                    // showRawInput:true
                }
            });
            if (tx_rsp.effects?.status.status !== 'success') {
                date.setTime(Date.now())
                console.log('%s [ERROR] cetusClmmSDK.FullClient.getTransactionBlock return failed, wait 2s and try again...', date.toLocaleString());
                await new Promise(f => setTimeout(f, 2000));
                continue;
            }

            if (tx_rsp.timestampMs) {
                tx_info.unix_timestamp_ms = Number.parseInt(tx_rsp.timestampMs);
            } else {
                tx_info.unix_timestamp_ms = Date.now();
            }
            
            tx_info.digest = digest;
            // effect 
            if (tx_opt.get_total_gas_fee) {
                tx_info.total_gas_fee = getTotalGasFee(tx_rsp);
            }

            // balance change
            if (tx_opt.get_balance_change) {
                tx_info.balance_change = getBalanceChange(tx_rsp);
            }

            // events
            if (tx_opt.get_add_liquidity_event) {
                tx_info.liquidity_event = getAddLiquidityEvent(tx_rsp);
            } 
            if (tx_opt.get_remove_liquidity_event) {
                tx_info.liquidity_event = getRemoveLiquidityEvent(tx_rsp);
            }
            
            if (tx_opt.get_fee_and_rwd) {
                tx_info.fee_and_reward = getFeeAndRewardCollectEvent(tx_rsp);
            }
        } catch(e) {
            date.setTime(Date.now())
            if (e instanceof Error) {
                console.error('%s [ERROR] getTransactionBlock get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
            } else {
                console.error('[ERROR] getTransactionBlock get an exception'); 
                console.error(e);
            }
            console.error('wait 2s and try again...'); 
            await new Promise(f => setTimeout(f, 2000));
            continue;
        }
        break;
    }
}


function dumpTransactionInfo(title: string, tx_info: TransactionInfo, tx_opt: TransactionInfoQueryOptions) {
    console.log('- %s - ', title);
    console.log('timestamp: ', new Date(tx_info.unix_timestamp_ms).toLocaleString());
    console.log('digest: ', tx_info.digest);

    if (tx_opt.get_total_gas_fee) {
        console.log('total_gas_fee: ', tx_info.total_gas_fee.toString());
    }
    if (tx_opt.get_balance_change) {
        console.log('balance_change.usdc_change: ', tx_info.balance_change.usdc_change.toString());
        console.log('balance_change.sui_change: ', tx_info.balance_change.sui_change.toString());
        console.log('balance_change.cetus_change: ', tx_info.balance_change.cetus_change.toString());
    }

    if (tx_opt.get_add_liquidity_event || tx_opt.get_remove_liquidity_event) {
        console.log('liquidity_event.after_liquidity: ', tx_info.liquidity_event.after_liquidity.toString());
        console.log('liquidity_event.amount_a: ', tx_info.liquidity_event.amount_a.toString());
        console.log('liquidity_event.amount_b: ', tx_info.liquidity_event.amount_b.toString());
        console.log('liquidity_event.liquidity: ', tx_info.liquidity_event.liquidity.toString());
        console.log('liquidity_event.pool: ', tx_info.liquidity_event.pool);
        console.log('liquidity_event.position: ', tx_info.liquidity_event.position);
    }

    if (tx_opt.get_fee_and_rwd) {
        console.log('fee_and_reward.fee_owned_a: ', tx_info.fee_and_reward.fee_owned_a.toString());
        console.log('fee_and_reward.fee_owned_b: ', tx_info.fee_and_reward.fee_owned_b.toString());
        console.log('fee_and_reward.rwd_owned_sui: ', tx_info.fee_and_reward.rwd_owned_sui.toString());
        console.log('fee_and_reward.rwd_owned_cetus: ', tx_info.fee_and_reward.rwd_owned_cetus.toString());
    }
    console.log('- %s End- ', title);
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






type Quota = {
    usdc_quota_in_wallet: BN;
    sui_quota_in_wallet: BN;
    usdc_quota_in_pos: BN;
    sui_quota_in_pos: BN;
};

function newQuota() {
    let ret: Quota = {
        usdc_quota_in_wallet: new BN(0),
        sui_quota_in_wallet: new BN(0),
        usdc_quota_in_pos: new BN(0),
        sui_quota_in_pos: new BN(0)
    };
    return ret;
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












function dumpTransactionStatistics(title: string, check_point_status_old: CheckPointStatus, check_point_status_new: CheckPointStatus, 
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








export type PositionInfo = { 
    unix_timestamp_ms: number;
    pos_id: string;
    is_open: number; 
    close_unix_timestamp_ms: number;
    close_tick_index: number;
    close_tick_index_cetus: number;
    total_gas_used: BN;
    fee_coin_a: BN; 
    fee_coin_b: BN; 
    rwd_sui: BN; 
    rwd_cetus: BN;
    benefit_holding_coin_ab: Decimal; 
    benefit_holding_coin_a: Decimal; 
    benefit_holding_coin_b: Decimal; 
};


export function newPositionInfo(): PositionInfo {
    let ret: PositionInfo = {
        unix_timestamp_ms: 0,
        pos_id: '',
        is_open: 0,
        close_unix_timestamp_ms: 0,
        close_tick_index: 0,
        close_tick_index_cetus: 0,
        total_gas_used: new BN(0),
        fee_coin_a: new BN(0),
        fee_coin_b: new BN(0),
        rwd_sui: new BN(0),
        rwd_cetus: new BN(0),
        benefit_holding_coin_ab: d(0),
        benefit_holding_coin_a: d(0),
        benefit_holding_coin_b: d(0)
    };
    return ret;
}















type BenefitStatisticsCtx = {
    total_gas_fee: BN;
    total_gas_fee_value: Decimal;
    fee_and_rwd_value: FeeAndRewardValue;
    init_quota_value_now: QuotaValue;
    init_quota_value_at_the_beginning: QuotaValue;
    cur_quota_value_now: QuotaValue;
    init_quota_as_usdc_value_now: Decimal;
    init_quota_as_sui_value_now: Decimal;
    inpermanent_loss_with_holding_both_coin_ab: Decimal;
    inpermanent_loss_with_holding_only_coin_a: Decimal;
    inpermanent_loss_with_holding_only_coin_b: Decimal;
};

function newBenefitStatisticsCtx() {
    let ret: BenefitStatisticsCtx = {
        total_gas_fee: new BN(0),
        total_gas_fee_value: d(0),
        fee_and_rwd_value: newFeeAndRewardValue(),
        init_quota_value_now: newQuotaValue(),
        init_quota_value_at_the_beginning: newQuotaValue(),
        cur_quota_value_now: newQuotaValue(),
        init_quota_as_usdc_value_now: d(0),
        init_quota_as_sui_value_now: d(0),
        inpermanent_loss_with_holding_both_coin_ab: d(0),
        inpermanent_loss_with_holding_only_coin_a: d(0),
        inpermanent_loss_with_holding_only_coin_b: d(0)
    };
    return ret;
}


function dumpBenefitStatistics(benefit_stat: BenefitStatisticsCtx) {

    console.log('Total Gas Used: %s, value: %s', benefit_stat.total_gas_fee.neg().toString(), benefit_stat.total_gas_fee_value.neg().toString());
    console.log('Impermanent Loss Value(Coin ab Initial): %s', benefit_stat.inpermanent_loss_with_holding_both_coin_ab);
    console.log('Impermanent Loss Value(Coin a Initial): %s', benefit_stat.inpermanent_loss_with_holding_only_coin_a);
    console.log('Impermanent Loss Value(Coin b Initial): %s', benefit_stat.inpermanent_loss_with_holding_only_coin_b);
    console.log('Total Fee and Reward Value: %s', benefit_stat.fee_and_rwd_value.total_value);

    console.log('=');

    // Relative Benifit Now
    let total_benefit = benefit_stat.total_gas_fee_value.neg().add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_both_coin_ab);
    console.log('Benifit(2 Holding Both Coin ab): %s (%s%%)', 
        total_benefit, 
        total_benefit.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));

    let total_benefit_holding_only_a = benefit_stat.total_gas_fee_value.neg().add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_only_coin_a);
    console.log('Benifit(2 Holding Only Coin a): %s (%s%%)', 
        total_benefit_holding_only_a, 
        total_benefit_holding_only_a.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));

    let total_benefit_holding_only_b = benefit_stat.total_gas_fee_value.neg().add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_only_coin_b);
    console.log('Benifit(2 Holding Only Coin b): %s (%s%%)', 
        total_benefit_holding_only_b, 
        total_benefit_holding_only_b.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));

    let total_benefit_without_gas = benefit_stat.fee_and_rwd_value.total_value.add(benefit_stat.inpermanent_loss_with_holding_both_coin_ab);
    console.log('Benifit(2 Holding Both Coin ab, Without Gas): %s (%s%%)', 
        total_benefit_without_gas, 
        total_benefit_without_gas.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));    

    let total_benefit_holding_only_a_without_gas = benefit_stat.fee_and_rwd_value.total_value.add(benefit_stat.inpermanent_loss_with_holding_only_coin_a);
    console.log('Benifit(2 Holding Only Coin a, Without Gas): %s (%s%%)', 
        total_benefit_holding_only_a_without_gas, 
        total_benefit_holding_only_a_without_gas.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));    

    let total_benefit_holding_only_b_without_gas = benefit_stat.fee_and_rwd_value.total_value.add(benefit_stat.inpermanent_loss_with_holding_only_coin_b);
    console.log('Benifit(2 Holding Only Coin b, Without Gas): %s (%s%%)', 
        total_benefit_holding_only_b_without_gas, 
        total_benefit_holding_only_b_without_gas.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));
    console.log('--------------------------------------------------------');
    console.log('Quota Value Now: %s, Total Value Loss Now: %s, FeeRwd Value Now: %s', 
        benefit_stat.cur_quota_value_now.total_quota_value.toString(),
        benefit_stat.inpermanent_loss_with_holding_only_coin_a.add(benefit_stat.total_gas_fee_value.neg()).toString(),
        benefit_stat.fee_and_rwd_value.total_value.toString()
    );
    console.log('--------------------------------------------------------');
}






async function closePosition(pool: Pool, pos: Position, sendKeypair: Ed25519Keypair): Promise<string> {
    let digest = '';
    while (true) {
        try {
            const reward_coin_types = pool.rewarder_infos.map((rewarder) => rewarder.coin_type);
            const close_position_payload = await cetusClmmSDK.Position.closePositionPayload({
                coin_type_a: pool.coin_type_a,
                coin_type_b: pool.coin_type_b,
                min_amount_a: '0',
                min_amount_b: '0',
                rewarder_coin_types: reward_coin_types,
                pool_id: pool.id,
                pos_id: pos.pos_object_id,
                collect_fee: true,
                });
            dumpSDKRet2Logfile('Close Position: cetusClmmSDK.Position.closePositionPayload', JSON.stringify(close_position_payload, null, 2));
            console.log('[%s] - cetusClmmSDK.Position.closePositionPayload - ', date.toLocaleString());

            const transfer_txn = await cetusClmmSDK.FullClient.sendTransaction(sendKeypair, close_position_payload);
            dumpSDKRet2Logfile('Close Position: cetusClmmSDK.FullClient.sendTransaction', JSON.stringify(transfer_txn, null, 2));
            console.log('[%s] - cetusClmmSDK.FullClient.sendTransaction: %s - ', date.toLocaleString(), transfer_txn?.effects?.status.status);

            if (transfer_txn?.effects?.status.status !== "success") {
                console.log('[error] Close Position: cetusClmmSDK.FullClient.sendTransaction return failed, wait 2s and try again...');
                await new Promise(f => setTimeout(f, 2000));
                continue;
            }                    
            digest = transfer_txn.digest;
        } catch(e) {
            if (e instanceof Error) {
                console.error('%s [error] Close Position get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
            } else {
                console.error('[error] Close Position get an exception'); 
                console.error(e);
            }
            console.error('wait 2s and try again...'); 
            await new Promise(f => setTimeout(f, 2000));
            continue;
        }
        break;
    }
    return digest;
}



async function processExistingPosition(pool: Pool, pos_list: Position[], sendKeypair: Ed25519Keypair): Promise<Position | null> {
    let pos_active: Position | null = null;
    if (pos_list.length <=0 ) {
        return pos_active;
    }    

    for (const pos of pos_list) {
        if (pool.current_tick_index < pos.tick_lower_index || pool.current_tick_index >= pos.tick_upper_index) {  // [ , )

            let save_to_db = false;
            let db : sqlite3.Database | undefined = undefined;
            let open_db_ctx = await sqlite3_utils.openDatabase(SQLITE_DB_FILE_NAME);
            if (open_db_ctx.success) {
                save_to_db = true;
                db = open_db_ctx.db;
            } else {
                console.log('Open database failed:', open_db_ctx.error)
            }

            let retrieve_db_success = false;
            let position_info = newPositionInfo();
            let check_point_status_arr: CheckPointStatus[] = [];
            let tx_info_arr: TransactionInfo[] = [];

            position_info.pos_id = pos.pos_object_id;

            if (save_to_db && db) {
                let ret = await sqlite3_utils.getPositionInfo(db, position_info);
                let ret2 = await sqlite3_utils.getCheckPointStatus(db, position_info, check_point_status_arr);
                let ret3 = await sqlite3_utils.getTransactionInfo(db, position_info, tx_info_arr);
                retrieve_db_success = ret.success && ret2.success && ret3.success && (check_point_status_arr.length > 1) && (tx_info_arr.length > 1);
            }
            console.log('===== position_info =======\n%s', JSON.stringify(position_info, null, 2));
            console.log('===== check_point_status_arr =======\n%s', JSON.stringify(check_point_status_arr, null, 2));
            console.log('===== tx_info_arr =======\n%s', JSON.stringify(tx_info_arr, null, 2));



            const account_address = sendKeypair.getPublicKey().toSuiAddress();
            let wallet_balance_after_add_liquidity = await getAllWalletBalance(account_address);

            // close position
            let digest_close_position = await closePosition(pool, pos, sendKeypair);

            // get transaction data
            // get close transaction info
            let tx_info_close_position = newTransactionInfo();
            let tx_opt_close_position: TransactionInfoQueryOptions = {
                get_add_liquidity_event: false,
                get_balance_change: true,
                get_fee_and_rwd: true,
                get_total_gas_fee: true,
                get_remove_liquidity_event: true
            };
            await getTransactionInfo(digest_close_position, tx_info_close_position, tx_opt_close_position, sendKeypair);

            // dump close transaction info
            dumpTransactionInfo('Close Position Transaction Rsp', tx_info_close_position, tx_opt_close_position);


            if (!retrieve_db_success) {
                console.log('DB data damaged, just close position %s', pos.pos_object_id);
                if (save_to_db && db) {
                    db.close();
                }
                continue;
            }


            let total_gas_fee_previous = new BN(0);
            for (const tx of tx_info_arr) {
                total_gas_fee_previous.iadd(tx.total_gas_fee);
            }

            let check_point_status_last = check_point_status_arr[check_point_status_arr.length - 1];
            let check_point_status = check_point_status_arr[0];





            let wallet_balance_after_close_position = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
            while(true) {
                try {
                    wallet_balance_after_close_position = await getAllWalletBalance(account_address);
                    // wait for wallet balance updated.
                    while (balanceNotChange(wallet_balance_after_add_liquidity, wallet_balance_after_close_position)) {
                        date.setTime(Date.now());
                        console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());
                        await new Promise(f => setTimeout(f, 1000));
                        wallet_balance_after_close_position = await getAllWalletBalance(account_address);
                    }
                    break;
                } catch(e) {
                    if (e instanceof Error) {
                        console.error('%s [error] wait for wallet balance updated get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                    } else {
                        console.error('wait for wallet balance updated get an exception'); 
                        console.error(e);
                    }
                    await new Promise(f => setTimeout(f, 100)); // 0.1s
                }
            }            


            // get check_point_status
            let check_point_status_after_close_position = newCheckPointStatus();
            check_point_status_after_close_position.gas_reserved = SUI_GAS_RESERVED.sub(total_gas_fee_previous).sub(tx_info_close_position.total_gas_fee);
            check_point_status_after_close_position.usdc_balance = new BN(wallet_balance_after_close_position.usdc_amount);
            check_point_status_after_close_position.sui_balance = new BN(wallet_balance_after_close_position.sui_amount);
            check_point_status_after_close_position.cetus_balance = new BN(wallet_balance_after_close_position.cetus_amount);
            check_point_status_after_close_position.usdc_quota_in_wallet = check_point_status_after_close_position.usdc_balance.sub(tx_info_close_position.fee_and_reward.fee_owned_a);
            check_point_status_after_close_position.sui_quota_in_wallet = check_point_status_after_close_position.sui_balance.sub(check_point_status_after_close_position.gas_reserved).
                    sub(tx_info_close_position.fee_and_reward.fee_owned_b).sub(tx_info_close_position.fee_and_reward.rwd_owned_sui);
            check_point_status_after_close_position.usdc_fee = tx_info_close_position.fee_and_reward.fee_owned_a.clone();
            check_point_status_after_close_position.sui_fee = tx_info_close_position.fee_and_reward.fee_owned_b.clone();
            check_point_status_after_close_position.sui_rwd = tx_info_close_position.fee_and_reward.rwd_owned_sui.clone();
            check_point_status_after_close_position.cetus_rwd = tx_info_close_position.fee_and_reward.rwd_owned_cetus.clone();
            

            // get price and value
            let sui_price_after_close_position = d(0);
            let pools_after_close_position: Pool[] | null = null;
            while(true) {
                try {
                    pools_after_close_position = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_SUI_0_05]);
                    if (pools_after_close_position == null || pools_after_close_position.length <= 0) {
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
            sui_price_after_close_position = d(1).div(TickMath.tickIndexToPrice(pools_after_close_position[0].current_tick_index, 6, 9));
            check_point_status_after_close_position.sui_price = sui_price_after_close_position;
            check_point_status_after_close_position.tick_index = pools_after_close_position[0].current_tick_index;
            check_point_status_after_close_position.unix_timestamp_ms = Date.now();

            // print
            console.log('');
            console.log(' - Check Point : After Close Position - ');
            dumpCheckPoint(check_point_status_after_close_position);

            let quota_value_after_close_position = calcQuotaValue(sui_price_after_close_position, check_point_status_after_close_position);
            console.log('Total Quota Value: ', quota_value_after_close_position.total_quota_value);
            console.log('');



            // dump transaction statistics
            dumpTransactionStatistics('Close Position Transaction Stat.', check_point_status_last, check_point_status_after_close_position, 
                sui_price_after_close_position, digest_close_position, tx_info_close_position.total_gas_fee, tx_info_close_position.balance_change);







            
            // for fee_adn rwd calc
            let sui_price_final = d(0);
            sui_price_final = d(1).div(TickMath.tickIndexToPrice(pools_after_close_position[0].current_tick_index, 6, 9));

            let cetus_price_final = d(0);
            let cetus_pools_after_close_position: Pool[] | null = null;
            while(true) {
                try {
                    cetus_pools_after_close_position = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_CETUS_0_25]);
                    if (cetus_pools_after_close_position == null || cetus_pools_after_close_position.length <= 0) {
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
            cetus_price_final = d(1).div(TickMath.tickIndexToPrice(cetus_pools_after_close_position[0].current_tick_index, 6, 9));


            // dump benefit
            let benefit_stat = newBenefitStatisticsCtx();
            benefit_stat.total_gas_fee = total_gas_fee_previous.add(tx_info_close_position.total_gas_fee);
            benefit_stat.total_gas_fee_value = Decimal(benefit_stat.total_gas_fee.toString()).mul(Decimal.pow(10, -9)).mul(sui_price_final);

            benefit_stat.cur_quota_value_now = calcQuotaValue(sui_price_final, check_point_status_after_close_position);
            benefit_stat.init_quota_value_now = calcQuotaValue(sui_price_final, check_point_status);
            benefit_stat.init_quota_value_at_the_beginning = calcQuotaValue(check_point_status.sui_price, check_point_status);
            benefit_stat.init_quota_as_usdc_value_now = benefit_stat.init_quota_value_at_the_beginning.total_quota_value;
            benefit_stat.init_quota_as_sui_value_now = benefit_stat.init_quota_value_at_the_beginning.total_quota_value.div(check_point_status.sui_price).mul(sui_price_final);

            benefit_stat.inpermanent_loss_with_holding_both_coin_ab = benefit_stat.cur_quota_value_now.total_quota_value.sub(benefit_stat.init_quota_value_now.total_quota_value);
            benefit_stat.inpermanent_loss_with_holding_only_coin_a = benefit_stat.cur_quota_value_now.total_quota_value.sub(benefit_stat.init_quota_as_usdc_value_now);
            benefit_stat.inpermanent_loss_with_holding_only_coin_b = benefit_stat.cur_quota_value_now.total_quota_value.sub(benefit_stat.init_quota_as_sui_value_now);

            benefit_stat.fee_and_rwd_value = getFeeAndRewardValue(sui_price_final, cetus_price_final, tx_info_close_position.fee_and_reward);

            console.log('--------------------------------------------------------');
            dumpBenefitStatistics(benefit_stat);
            console.log('--------------------------------------------------------');  



            // save to db
            if (save_to_db && db) {
                position_info.fee_coin_a = tx_info_close_position.fee_and_reward.fee_owned_a.clone();
                position_info.fee_coin_b = tx_info_close_position.fee_and_reward.fee_owned_b.clone();
                position_info.rwd_sui = tx_info_close_position.fee_and_reward.rwd_owned_sui.clone();
                position_info.rwd_cetus = tx_info_close_position.fee_and_reward.rwd_owned_cetus.clone();

                position_info.close_unix_timestamp_ms = tx_info_close_position.unix_timestamp_ms;

                position_info.is_open = 0;
                position_info.close_tick_index = check_point_status_after_close_position.tick_index;
                position_info.close_tick_index_cetus = cetus_pools_after_close_position[0].current_tick_index;
                position_info.total_gas_used = benefit_stat.total_gas_fee.clone();

                let total_benefit = benefit_stat.total_gas_fee_value.neg()
                    .add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_both_coin_ab);
                let total_benefit_holding_only_a = benefit_stat.total_gas_fee_value.neg()
                    .add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_only_coin_a);
                let total_benefit_holding_only_b = benefit_stat.total_gas_fee_value.neg()
                    .add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_only_coin_b);

                position_info.benefit_holding_coin_ab = total_benefit;
                position_info.benefit_holding_coin_a = total_benefit_holding_only_a;
                position_info.benefit_holding_coin_b = total_benefit_holding_only_b;
                await sqlite3_utils.insertTransactionInfo(db, position_info, tx_info_close_position, 'close_position');
                await sqlite3_utils.insertCheckPointStatus(db, position_info, check_point_status_after_close_position);
                await sqlite3_utils.updatePositionInfo(db, position_info);
            }
        } else {
            pos_active = {...pos};
        }
    }

    return pos_active;
}



































async function main() {

    const sendKeypair = Ed25519Keypair.deriveKeypair(MNEMONICS, HD_WALLET_PATH);
    const account_address = sendKeypair.getPublicKey().toSuiAddress();
    cetusClmmSDK.setSenderAddress(account_address);
    console.log('Account Address: ', account_address);




    let position_info = newPositionInfo();

    let save_to_db = false;
    let db : sqlite3.Database | undefined = undefined;
    let open_db_ctx = await sqlite3_utils.openDatabase(SQLITE_DB_FILE_NAME);
    if (open_db_ctx.success) {
        save_to_db = true;
        db = open_db_ctx.db;
    } else {
        console.log('Open database failed:', open_db_ctx.error)
    }

    if (save_to_db && db) {
        await sqlite3_utils.tryCreatePositionInfoTable(db);
    }
    




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
    sui_price = d(1).div(TickMath.tickIndexToPrice(pools[0].current_tick_index, 6, 9));

    check_point_status.sui_price = sui_price;
    check_point_status.tick_index = pools[0].current_tick_index;
    check_point_status.unix_timestamp_ms = Date.now();
    

    // print
    console.log('');
    console.log(' - Check Point : Initial - ');
    dumpCheckPoint(check_point_status);

    let quota_value = calcQuotaValue(sui_price, check_point_status);
    console.log('Total Quota Value: ', quota_value.total_quota_value);
    console.log('');

    check_point_status_last = check_point_status;










    
    let position_lower_bound_seed = 0;



    let current_tick_index = 0;
    let tick_lower_index = 0;
    let tick_upper_index = 0; 
    
    
    let digest_swap = '';
    let tx_info_swap = newTransactionInfo();
    let tx_opt_swap: TransactionInfoQueryOptions = {
        get_total_gas_fee: true,
        get_balance_change: true,
        get_add_liquidity_event: false,
        get_remove_liquidity_event: false,
        get_fee_and_rwd: false   
    };

    let wallet_balance_after_swap = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
    let check_point_status_after_swap = newCheckPointStatus();

    let check_point_status_after_swap_arr: CheckPointStatus[] = [];
    let tx_info_swap_arr: TransactionInfo[] = [];
    let total_gas_fee_swap_accumulate = new BN(0);







    let current_tick_index_after_swap = 0;
    let tick_lower_index_after_swap = 0;
    let tick_upper_index_after_swap = 0;

    let digest_add_liquidity = '';
    let tx_info_add_liquidity = newTransactionInfo();
    let tx_opt_add_liquidity: TransactionInfoQueryOptions = {
        get_total_gas_fee: true,
        get_balance_change: true,
        get_add_liquidity_event: true,
        get_remove_liquidity_event: false,
        get_fee_and_rwd: false   
    };
    let wallet_balance_after_add_liquidity = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
    let check_point_status_after_add_liquidity = newCheckPointStatus();



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
        // total_gas_fee_swap = new BN(0);
        // balance_change_swap = newBalanceChange();
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


        // get swap transaction info
        tx_info_swap = newTransactionInfo();
        tx_opt_swap = {
            get_total_gas_fee: true,
            get_balance_change: true,
            get_add_liquidity_event: false,
            get_remove_liquidity_event: false,
            get_fee_and_rwd: false   
        };
        await getTransactionInfo(digest_swap, tx_info_swap, tx_opt_swap, sendKeypair);

        // dump add_liquidity transaction info
        dumpTransactionInfo('Aggregator Swap Transaction Rsp', tx_info_swap, tx_opt_swap);


        // swap special saving
        total_gas_fee_swap_accumulate.iadd(tx_info_swap.total_gas_fee);
        console.log('total_gas_fee_swap_accumulate: ', total_gas_fee_swap_accumulate.toString());

        tx_info_swap_arr.push({...tx_info_swap});





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
        sui_price_after_swap = d(1).div(TickMath.tickIndexToPrice(pools_after_swap[0].current_tick_index, 6, 9));
        check_point_status_after_swap.sui_price = sui_price_after_swap;
        check_point_status_after_swap.tick_index = pools_after_swap[0].current_tick_index;
        check_point_status_after_swap.unix_timestamp_ms = Date.now();        

        // print
        console.log('');
        console.log(' - Check Point : After Swap - ');
        dumpCheckPoint(check_point_status_after_swap);

        let quota_value_after_swap = calcQuotaValue(sui_price_after_swap, check_point_status_after_swap);
        console.log('Total Quota Value: ', quota_value_after_swap.total_quota_value);
        console.log('');


        // dump transaction statistics
        dumpTransactionStatistics('Swap Transaction Stat.', check_point_status_last, check_point_status_after_swap, 
            sui_price_after_swap, digest_swap, tx_info_swap.total_gas_fee, tx_info_swap.balance_change);




        check_point_status_last = {...check_point_status_after_swap};

        check_point_status_after_swap_arr.push({...check_point_status_after_swap});


        console.log('');
        console.log('');

        

        























        console.log('\n');

        // get new pool status for add liquidity
        // let pools_after_swap: Pool[] | null = null;
        // while(true) { // try best to recover
        //     try {
        //         pools_after_swap = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_SUI_0_05]);
        //         if (pools_after_swap == null || pools_after_swap.length <= 0) {
        //             console.log('[ERROR] can not retrive pool info with getAssignPools, wait and try again...');
        //             await new Promise(f => setTimeout(f, 500));
        //             continue;
        //         }
        //     } catch (e) {
        //         if (e instanceof Error) {
        //             console.error('%s [error] getAssignPools get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
        //         } else {
        //             console.error('getAssignPools get an exception'); 
        //             console.error(e);
        //         }
        //         console.error('wait and try again...'); 
        //         await new Promise(f => setTimeout(f, 500));
        //         continue;
        //     }
        //     break;
        // }
        

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
        const slippage_for_add_liquidity = 0.05;
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



        // get add_liquidity transaction info
        tx_info_add_liquidity = newTransactionInfo();
        tx_opt_add_liquidity = {
            get_total_gas_fee: true,
            get_balance_change: true,
            get_add_liquidity_event: true,
            get_remove_liquidity_event: false,
            get_fee_and_rwd: false   
        };
        await getTransactionInfo(digest_add_liquidity, tx_info_add_liquidity, tx_opt_add_liquidity, sendKeypair);

        // dump add_liquidity transaction info
        dumpTransactionInfo('Add Liquidity Transaction Rsp', tx_info_add_liquidity, tx_opt_add_liquidity);



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
        check_point_status_after_add_liquidity.gas_reserved = SUI_GAS_RESERVED.sub(total_gas_fee_swap_accumulate).sub(tx_info_add_liquidity.total_gas_fee);
        check_point_status_after_add_liquidity.usdc_balance = new BN(wallet_balance_after_add_liquidity.usdc_amount);
        check_point_status_after_add_liquidity.sui_balance = new BN(wallet_balance_after_add_liquidity.sui_amount);
        check_point_status_after_add_liquidity.cetus_balance = new BN(wallet_balance_after_add_liquidity.cetus_amount);
        check_point_status_after_add_liquidity.usdc_quota_in_wallet = check_point_status_after_add_liquidity.usdc_balance.clone();
        check_point_status_after_add_liquidity.sui_quota_in_wallet = check_point_status_after_add_liquidity.sui_balance.sub(check_point_status_after_add_liquidity.gas_reserved);   
        check_point_status_after_add_liquidity.usdc_quota_in_pos = tx_info_add_liquidity.liquidity_event.amount_a.clone();
        check_point_status_after_add_liquidity.sui_quota_in_pos = tx_info_add_liquidity.liquidity_event.amount_b.clone();

        // get price and value
        let sui_price_after_add_liquidity = d(0);

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
        sui_price_after_add_liquidity = d(1).div(TickMath.tickIndexToPrice(pools_after_add_liquidity[0].current_tick_index, 6, 9));
        check_point_status_after_add_liquidity.sui_price = sui_price_after_add_liquidity;
        check_point_status_after_add_liquidity.tick_index = pools_after_add_liquidity[0].current_tick_index;
        check_point_status_after_add_liquidity.unix_timestamp_ms = Date.now();        

        // print
        console.log('');
        console.log(' - Check Point : After Add Liquidity - ');
        dumpCheckPoint(check_point_status_after_add_liquidity);

        let quota_value_after_add_liquidity = calcQuotaValue(sui_price_after_add_liquidity, check_point_status_after_swap);
        console.log('Total Quota Value: ', quota_value_after_add_liquidity.total_quota_value);
        console.log('');       


        // dump transaction statistics
        dumpTransactionStatistics('Add Liquidity Transaction Stat.', check_point_status_last, check_point_status_after_add_liquidity, 
            sui_price_after_add_liquidity, digest_add_liquidity, tx_info_add_liquidity.total_gas_fee, tx_info_add_liquidity.balance_change);
            
        check_point_status_last = {...check_point_status_after_add_liquidity};

        break;
    }


    
    // save to db
    if (save_to_db && db) {
        position_info.unix_timestamp_ms = tx_info_add_liquidity.unix_timestamp_ms;
        position_info.pos_id = tx_info_add_liquidity.liquidity_event.position;
        position_info.is_open = 1;
        await sqlite3_utils.insertPositionInfo(db, position_info);

        await sqlite3_utils.tryCreateCheckPointStatusTable(db, position_info);
        await sqlite3_utils.tryCreateTransactionInfoTable(db, position_info);

        
        await sqlite3_utils.insertCheckPointStatus(db, position_info, check_point_status);
        
        for (const tx of tx_info_swap_arr) {
            await sqlite3_utils.insertTransactionInfo(db, position_info, tx, 'swap');
        }
        
        for (const chk of check_point_status_after_swap_arr) {
            await sqlite3_utils.insertCheckPointStatus(db, position_info, chk);
        }

        await sqlite3_utils.insertTransactionInfo(db, position_info, tx_info_add_liquidity, 'add_liquidity');

        await sqlite3_utils.insertCheckPointStatus(db, position_info, check_point_status_after_add_liquidity);
    }










    // calc impermanent loss and value loss in lower/upper bounder and print    
    let tick_when_add_liquidity = getAddLiquidityTickIndex(tx_info_add_liquidity.liquidity_event, tick_lower_index_after_swap, tick_upper_index_after_swap);

    console.log('');
    console.log('Position Tick Range When Add Liquidity: %d - (%d) - %d', tick_lower_index_after_swap, tick_when_add_liquidity, tick_upper_index_after_swap);

    let impermanent_loss_ctx = getImpermanentLossCtx(tick_lower_index_after_swap, tick_when_add_liquidity, tick_upper_index_after_swap, 
        tx_info_add_liquidity.liquidity_event, check_point_status, check_point_status_after_add_liquidity);
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

        // get cetus/ sui price
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

        let cetus_price_upper_index = cetus_price_after_add_liquidity.mul(impermanent_loss_ctx.sui_price_upper_index).div(sui_price_after_add_liquidity);
        let fee_and_reward_value_upper_index = getFeeAndRewardValue(impermanent_loss_ctx.sui_price_upper_index, cetus_price_upper_index, fee_and_reward);


        console.log('--------------------------------------------------------');
        dumpImpermanentLossAndEarningRatio(impermanent_loss_ctx, fee_and_reward_value_lower_index, fee_and_reward_value_upper_index);
        console.log('--------------------------------------------------------');




        // dump current benifit      

        let benefit_stat = newBenefitStatisticsCtx();
        benefit_stat.total_gas_fee = total_gas_fee_swap_accumulate.add(tx_info_add_liquidity.total_gas_fee);
        benefit_stat.total_gas_fee_value = Decimal(benefit_stat.total_gas_fee.toString()).mul(Decimal.pow(10, -9)).mul(sui_price_after_add_liquidity);

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

        benefit_stat.cur_quota_value_now = calcQuotaValue(sui_price_after_add_liquidity, check_point_status_in_clmm);
        benefit_stat.init_quota_value_now = calcQuotaValue(sui_price_after_add_liquidity, check_point_status);
        benefit_stat.init_quota_value_at_the_beginning = calcQuotaValue(check_point_status.sui_price, check_point_status);
        benefit_stat.init_quota_as_usdc_value_now = benefit_stat.init_quota_value_at_the_beginning.total_quota_value;
        benefit_stat.init_quota_as_sui_value_now = benefit_stat.init_quota_value_at_the_beginning.total_quota_value.div(check_point_status.sui_price).mul(sui_price_after_add_liquidity);

        benefit_stat.inpermanent_loss_with_holding_both_coin_ab = benefit_stat.cur_quota_value_now.total_quota_value.sub(benefit_stat.init_quota_value_now.total_quota_value);
        benefit_stat.inpermanent_loss_with_holding_only_coin_a = benefit_stat.cur_quota_value_now.total_quota_value.sub(benefit_stat.init_quota_as_usdc_value_now);
        benefit_stat.inpermanent_loss_with_holding_only_coin_b = benefit_stat.cur_quota_value_now.total_quota_value.sub(benefit_stat.init_quota_as_sui_value_now);

        benefit_stat.fee_and_rwd_value = fee_and_reward_value;

        console.log('--------------------------------------------------------');
        dumpBenefitStatistics(benefit_stat);
        console.log('--------------------------------------------------------');        



        // if (current_tick_index_after_add_liquidity < tick_lower_index_after_swap || current_tick_index_after_add_liquidity > tick_upper_index_after_swap) {
        //     console.log('Out of range, close position...');
        //     // close position
        //     let digest_close_position = await closePosition(pools_after_add_liquidity[0], positions[0], sendKeypair);

        //     // get close transaction info
        //     let tx_info_close_position = newTransactionInfo();
        //     let tx_opt_close_position: TransactionInfoQueryOptions = {
        //         get_total_gas_fee: true,
        //         get_balance_change: true,
        //         get_add_liquidity_event: false, 
        //         get_remove_liquidity_event: true,
        //         get_fee_and_rwd: true
        //     };
        //     await getTransactionInfo(digest_close_position, tx_info_close_position, tx_opt_close_position, sendKeypair);

        //     // dump close transaction info
        //     dumpTransactionInfo('Close Position Transaction Rsp', tx_info_close_position, tx_opt_close_position);


        //     let wallet_balance_after_close_position = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
        //     while(true) {
        //         try {
        //             wallet_balance_after_close_position = await getAllWalletBalance(account_address);
        //             // wait for wallet balance updated.
        //             while (balanceNotChange(wallet_balance_after_add_liquidity, wallet_balance_after_close_position)) {
        //                 date.setTime(Date.now());
        //                 console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());
        //                 await new Promise(f => setTimeout(f, 1000));
        //                 wallet_balance_after_close_position = await getAllWalletBalance(account_address);
        //             }
        //             break;
        //         } catch(e) {
        //             if (e instanceof Error) {
        //                 console.error('%s [error] wait for wallet balance updated get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
        //             } else {
        //                 console.error('wait for wallet balance updated get an exception'); 
        //                 console.error(e);
        //             }
        //             await new Promise(f => setTimeout(f, 100)); // 0.1s
        //         }
        //     }

        //     // get check_point_status
        //     let check_point_status_after_close_position = newCheckPointStatus();
        //     check_point_status_after_close_position.gas_reserved = SUI_GAS_RESERVED.sub(total_gas_fee_swap_accumulate).sub(tx_info_add_liquidity.total_gas_fee).sub(tx_info_close_position.total_gas_fee);
        //     check_point_status_after_close_position.usdc_balance = new BN(wallet_balance_after_close_position.usdc_amount);
        //     check_point_status_after_close_position.sui_balance = new BN(wallet_balance_after_close_position.sui_amount);
        //     check_point_status_after_close_position.cetus_balance = new BN(wallet_balance_after_close_position.cetus_amount);
        //     check_point_status_after_close_position.usdc_quota_in_wallet = check_point_status_after_close_position.usdc_balance.sub(tx_info_close_position.fee_and_reward.fee_owned_a);
        //     check_point_status_after_close_position.sui_quota_in_wallet = check_point_status_after_close_position.sui_balance.sub(check_point_status_after_close_position.gas_reserved).
        //             sub(tx_info_close_position.fee_and_reward.fee_owned_b).sub(tx_info_close_position.fee_and_reward.rwd_owned_sui);
        //     check_point_status_after_close_position.usdc_fee = tx_info_close_position.fee_and_reward.fee_owned_a.clone();
        //     check_point_status_after_close_position.sui_fee = tx_info_close_position.fee_and_reward.fee_owned_b.clone();
        //     check_point_status_after_close_position.sui_rwd = tx_info_close_position.fee_and_reward.rwd_owned_sui.clone();
        //     check_point_status_after_close_position.cetus_rwd = tx_info_close_position.fee_and_reward.rwd_owned_cetus.clone();
            

        //     // get price and value
        //     let sui_price_after_close_position = d(0);
        //     let pools_after_close_position: Pool[] | null = null;
        //     while(true) {
        //         try {
        //             pools_after_close_position = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_SUI_0_05]);
        //             if (pools_after_close_position == null || pools_after_close_position.length <= 0) {
        //                 console.log('[ERROR] can not retrive pool info with getAssignPools, wait and try again...');
        //                 await new Promise(f => setTimeout(f, 500));
        //                 continue;
        //             }
        //         } catch (e) {
        //             if (e instanceof Error) {
        //                 console.error('%s [error] getAssignPools get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
        //             } else {
        //                 console.error('getAssignPools get an exception'); 
        //                 console.error(e);
        //             }
        //             console.error('wait and try again...'); 
        //             await new Promise(f => setTimeout(f, 500));
        //             continue;
        //         }
        //         break;
        //     }
        //     sui_price_after_close_position = d(1).div(TickMath.tickIndexToPrice(pools_after_close_position[0].current_tick_index, 6, 9));
        //     check_point_status_after_close_position.sui_price = sui_price_after_close_position;
        //     check_point_status_after_close_position.tick_index = pools_after_close_position[0].current_tick_index;
        //     check_point_status_after_close_position.unix_timestamp_ms = Date.now();

        //     // print
        //     console.log('');
        //     console.log(' - Check Point : After Close Position - ');
        //     dumpCheckPoint(check_point_status_after_close_position);

        //     let quota_value_after_close_position = calcQuotaValue(sui_price_after_close_position, check_point_status_after_close_position);
        //     console.log('Total Quota Value: ', quota_value_after_close_position.total_quota_value);
        //     console.log('');

        //     // dump transaction statistics
        //     dumpTransactionStatistics('Close Position Transaction Stat.', check_point_status_last, check_point_status_after_close_position, 
        //         sui_price_after_close_position, digest_close_position, tx_info_close_position.total_gas_fee, tx_info_close_position.balance_change);

        //     check_point_status_last = {...check_point_status_after_close_position};







            
        //     // for fee_adn rwd calc
        //     let sui_price_final = d(0);
        //     sui_price_final = d(1).div(TickMath.tickIndexToPrice(pools_after_close_position[0].current_tick_index, 6, 9));

        //     let cetus_price_final = d(0);
        //     let cetus_pools_after_close_position: Pool[] | null = null;
        //     while(true) {
        //         try {
        //             cetus_pools_after_close_position = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_USDC_CETUS_0_25]);
        //             if (cetus_pools_after_close_position == null || cetus_pools_after_close_position.length <= 0) {
        //                 console.log('[ERROR] can not retrive pool info with getAssignPools, wait and try again...');
        //                 await new Promise(f => setTimeout(f, 500));
        //                 continue;
        //             }
        //         } catch (e) {
        //             if (e instanceof Error) {
        //                 console.error('%s [error] getAssignPools get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
        //             } else {
        //                 console.error('getAssignPools get an exception'); 
        //                 console.error(e);
        //             }
        //             console.error('wait and try again...'); 
        //             await new Promise(f => setTimeout(f, 500));
        //             continue;
        //         }
        //         break;
        //     }
        //     cetus_price_final = d(1).div(TickMath.tickIndexToPrice(cetus_pools_after_close_position[0].current_tick_index, 6, 9));


        //     // dump benefit
        //     benefit_stat = newBenefitStatisticsCtx();
        //     benefit_stat.total_gas_fee = total_gas_fee_swap_accumulate.add(tx_info_add_liquidity.total_gas_fee).add(tx_info_close_position.total_gas_fee);
        //     benefit_stat.total_gas_fee_value = Decimal(benefit_stat.total_gas_fee.toString()).mul(Decimal.pow(10, -9)).mul(sui_price_final);

        //     benefit_stat.cur_quota_value_now = calcQuotaValue(sui_price_final, check_point_status_after_close_position);
        //     benefit_stat.init_quota_value_now = calcQuotaValue(sui_price_final, check_point_status);
        //     benefit_stat.init_quota_value_at_the_beginning = calcQuotaValue(check_point_status.sui_price, check_point_status);
        //     benefit_stat.init_quota_as_usdc_value_now = benefit_stat.init_quota_value_at_the_beginning.total_quota_value;
        //     benefit_stat.init_quota_as_sui_value_now = benefit_stat.init_quota_value_at_the_beginning.total_quota_value.div(check_point_status.sui_price).mul(sui_price_final);

        //     benefit_stat.inpermanent_loss_with_holding_both_coin_ab = benefit_stat.cur_quota_value_now.total_quota_value.sub(benefit_stat.init_quota_value_now.total_quota_value);
        //     benefit_stat.inpermanent_loss_with_holding_only_coin_a = benefit_stat.cur_quota_value_now.total_quota_value.sub(benefit_stat.init_quota_as_usdc_value_now);
        //     benefit_stat.inpermanent_loss_with_holding_only_coin_b = benefit_stat.cur_quota_value_now.total_quota_value.sub(benefit_stat.init_quota_as_sui_value_now);

        //     benefit_stat.fee_and_rwd_value = getFeeAndRewardValue(sui_price_final, cetus_price_final, tx_info_close_position.fee_and_reward);

        //     console.log('--------------------------------------------------------');
        //     dumpBenefitStatistics(benefit_stat);
        //     console.log('--------------------------------------------------------');  



        //     // save to db
        //     if (save_to_db && db) {
        //         position_info.fee_coin_a = tx_info_close_position.fee_and_reward.fee_owned_a.clone();
        //         position_info.fee_coin_b = tx_info_close_position.fee_and_reward.fee_owned_b.clone();
        //         position_info.rwd_sui = tx_info_close_position.fee_and_reward.rwd_owned_sui.clone();
        //         position_info.rwd_cetus = tx_info_close_position.fee_and_reward.rwd_owned_cetus.clone();

        //         position_info.close_unix_timestamp_ms = tx_info_close_position.unix_timestamp_ms;

        //         position_info.is_open = 0;
        //         position_info.close_tick_index = check_point_status_after_close_position.tick_index;
        //         position_info.close_tick_index_cetus = cetus_pools_after_close_position[0].current_tick_index;
        //         position_info.total_gas_used = benefit_stat.total_gas_fee.clone();

        //         let total_benefit = benefit_stat.total_gas_fee_value.neg()
        //             .add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_both_coin_ab);
        //         let total_benefit_holding_only_a = benefit_stat.total_gas_fee_value.neg()
        //             .add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_only_coin_a);
        //         let total_benefit_holding_only_b = benefit_stat.total_gas_fee_value.neg()
        //             .add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_only_coin_b);

        //         position_info.benefit_holding_coin_ab = total_benefit;
        //         position_info.benefit_holding_coin_a = total_benefit_holding_only_a;
        //         position_info.benefit_holding_coin_b = total_benefit_holding_only_b;
        //         await sqlite3_utils.insertTransactionInfo(db, position_info, tx_info_close_position, 'close_position');
        //         await sqlite3_utils.insertCheckPointStatus(db, position_info, check_point_status_after_close_position);
        //         await sqlite3_utils.updatePositionInfo(db, position_info);
        //     }
        //     break;
        // }
    }
    return;
}

main();































// type CheckPointStatus = {
//     wallet_balance: CoinAmounts;
//     usdc_quota_in_wallet: BN;
//     sui_quota_in_wallet: BN;
//     usdc_quota_in_pos: BN;
//     sui_quota_in_pos: BN;
//     gas_reserved: BN;
//     sui_price: Decimal;
//     usdc_quota_value: Decimal;
//     sui_quota_value: Decimal;
//     total_quota_value: Decimal;
// };

// function dumpCheckPoint(check_point_status: CheckPointStatus) {
//     console.log('USDC Balance: ', check_point_status.wallet_balance.coin_amount_a);
//     console.log('SUI Balance: ', check_point_status.wallet_balance.coin_amount_b);
//     console.log('USDC Quota in Wallet: ', check_point_status.usdc_quota_in_wallet.toString());
//     console.log('USDC Quota in Wallet: %s (%s wallet balance - %s gas_rsv)', 
//         check_point_status.sui_quota_in_wallet.toString(), check_point_status.wallet_balance.coin_amount_b, check_point_status.gas_reserved.toString());
//     console.log('USDC Quota in Position: ', check_point_status.usdc_quota_in_pos.toString());
//     console.log('USDC Quota in Position: ', check_point_status.usdc_quota_in_pos.toString());
//     console.log('SUI Price: ', check_point_status.sui_price);
//     console.log('USDC Quota Value: ', check_point_status.usdc_quota_value);
//     console.log('SUI Quota Value: ', check_point_status.sui_quota_value);
//     console.log('Total Quota Value: ', check_point_status.total_quota_value);
// }




    // let check_point_status_after_swap: CheckPointStatus = {
    //     wallet_balance: {coin_amount_a: '', coin_amount_b: ''},
    //     usdc_quota_in_wallet: new BN(0),
    //     sui_quota_in_wallet: new BN(0),
    //     usdc_quota_in_pos: new BN(0),
    //     sui_quota_in_pos: new BN(0),
    //     gas_reserved: new BN(0),
    //     sui_price: d(0),
    //     usdc_quota_value: d(0),
    //     sui_quota_value: d(0),
    //     total_quota_value: d(0)
    // };
    // check_point_status_after_swap.wallet_balance = wallet_balance_tmp;
    // check_point_status_after_swap.sui_price = sui_price_tmp;
    // check_point_status_after_swap.gas_reserved = SUI_GAS_RESERVED.sub(total_gas_fee_swap);
    // check_point_status_after_swap.usdc_quota_in_wallet = new BN(check_point_status_after_swap.wallet_balance.coin_amount_a);
    // check_point_status_after_swap.sui_quota_in_wallet = new BN(check_point_status_after_swap.wallet_balance.coin_amount_b).sub(check_point_status_after_swap.gas_reserved);
    // check_point_status_after_swap.usdc_quota_value = Decimal(check_point_status_after_swap.usdc_quota_in_wallet.toString()).mul(Decimal.pow(10, -6));
    // check_point_status_after_swap.sui_quota_value = Decimal(check_point_status_after_swap.sui_quota_in_wallet.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_after_swap.sui_price);
    // check_point_status_after_swap.total_quota_value = check_point_status_after_swap.usdc_quota_value.add(check_point_status_after_swap.sui_quota_value);

    // // dump check point
    // console.log('')
    // console.log(' - Check Point After Swap - ')
    // dumpCheckPoint(check_point_status_after_swap);
    // console.log('')


    



    





    // dump transaction statistics
    // console.log(' ========== Swap Transaction Info ========== ');
    // console.log('Digest: ', digest_swap);  

    // console.log('USDC %s => %s, balance_change: %s, balance_change(rsp): %s', 
    //     check_point_status.wallet_balance.coin_amount_a,
    //     check_point_status_after_swap.wallet_balance.coin_amount_a,
    //     check_point_status_after_swap.usdc_quota_in_wallet.sub(check_point_status.usdc_quota_in_wallet).toString(),
    //     balance_change_swap.usdc_change.toString());

    // console.log('SUI %s => %s, balance_change: %s = %s - %s(total gas fee), balance_change(rsp): %s', 
    //     check_point_status.wallet_balance.coin_amount_b,
    //     check_point_status_after_swap.wallet_balance.coin_amount_b,
    //     check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet).sub(total_gas_fee_swap).toString(),        
    //     check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet).toString(),
    //     total_gas_fee_swap.toString(),
    //     balance_change_swap.sui_change.toString());

    // console.log('USDC Quota in Wallet %s => %s, delta: %s', 
    //     check_point_status.usdc_quota_in_wallet.toString(),
    //     check_point_status_after_swap.usdc_quota_in_wallet.toString(),
    //     check_point_status_after_swap.usdc_quota_in_wallet.sub(check_point_status.usdc_quota_in_wallet).toString());

    // console.log('SUI Quota in Wallet %s => %s, delta: %s', 
    //     check_point_status.sui_quota_in_wallet.toString(),
    //     check_point_status_after_swap.sui_quota_in_wallet.toString(),
    //     check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet).toString());

    // console.log('USDC Quota in Position %s => %s, delta: %s', 
    //     check_point_status.usdc_quota_in_pos.toString(),
    //     check_point_status_after_swap.usdc_quota_in_pos.toString(),
    //     check_point_status_after_swap.usdc_quota_in_pos.sub(check_point_status.usdc_quota_in_pos).toString());

    // console.log('SUI Quota in Position %s => %s, delta: %s', 
    //     check_point_status.sui_quota_in_wallet.toString(),
    //     check_point_status_after_swap.sui_quota_in_wallet.toString(),
    //     check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet).toString());


    // console.log('');
    // console.log('Lost : ');
    // console.log('Total Gas Fee : ', total_gas_fee_swap.neg().toString());


    // console.log('');
    // console.log('SUI Price: ', check_point_status_after_swap.sui_price);
    
    // console.log('Total Value before: ', check_point_status.total_quota_value);
    // // console.log('Total Value before in new: ', check_point_status.sui_quota_value.mul(check_point_status_after_swap.sui_price).div(check_point_status.sui_price).add(check_point_status.usdc_quota_value));
    // console.log('Total Value after : ', check_point_status_after_swap.total_quota_value);
    // console.log('Delta:');
    // console.log(check_point_status_after_swap.total_quota_value.sub(check_point_status.total_quota_value));

    

    // let swap_actual = new BN(0);
    // let swap_deviation = new BN(0);
    // let swap_deviation_percentage = d(0);
    // let swap_deviation_percentage1 = d(0);
    // if (rebalance_info.a2b) {
    //     swap_actual = check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet);
    //     swap_deviation = swap_actual.sub(rebalance_info.amount_out);
    //     swap_deviation_percentage = Decimal(swap_deviation.toString()).div(d(rebalance_info.amount_out.toString()));
    //     console.log('Swap Fee + slippage : SUI %s (%s(Actual) - %s(Calc), %s, %s%%)', 
    //         swap_deviation.toString(), swap_actual.toString(), rebalance_info.amount_out.toString(), 
    //         swap_deviation_percentage.toString(), swap_deviation_percentage.mul(100).toFixed(6).toString());
    // } else {
    //     swap_actual = check_point_status_after_swap.usdc_quota_in_wallet.sub(check_point_status.usdc_quota_in_wallet);
    //     swap_deviation = swap_actual.sub(rebalance_info.amount_out);
    //     swap_deviation_percentage = Decimal(swap_deviation.toString()).div(d(rebalance_info.amount_out.toString()));
    //     console.log('Swap Fee + slippage : USDC %s (%s(Actual) - %s(Calc), %s, %s%%)', 
    //         swap_deviation.toString(), swap_actual.toString(), rebalance_info.amount_out.toString(), 
    //         swap_deviation_percentage.toString(), swap_deviation_percentage.mul(100).toFixed(6).toString());
    // }

    // console.log('');
    // let total_gas_fee_swap_in_decimals = Decimal(total_gas_fee_swap.neg().toString()).mul(Decimal.pow(10, -9));
    // let total_gas_fee_swap_value = total_gas_fee_swap_in_decimals.mul(check_point_status_after_swap.sui_price);
    // console.log('Gas: %s(%s * Price)', total_gas_fee_swap_value, total_gas_fee_swap_in_decimals);

    // let swap_fee_slippage_value = d(0);
    // let description = '';
    // if (rebalance_info.a2b) {
    //     swap_fee_slippage_value = Decimal(swap_deviation.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_after_swap.sui_price);
    //     description = util.format("(%s * Price)", Decimal(swap_deviation.toString()).mul(Decimal.pow(10, -9)));
    // } else {
    //     swap_fee_slippage_value = Decimal(swap_deviation.toString()).mul(Decimal.pow(10, -6));
    // }
    // console.log('Swap Fee + Slippage: %s%s', swap_fee_slippage_value, description);
    // console.log('=');
    // console.log(total_gas_fee_swap_value.add(swap_fee_slippage_value));
    // console.log(' ========== Swap Transaction Info End ========== ');














    // let check_point_status_after_add_liquidity: CheckPointStatus = {
    //     wallet_balance: {coin_amount_a: '', coin_amount_b: ''},
    //     usdc_quota_in_wallet: new BN(0),
    //     sui_quota_in_wallet: new BN(0),
    //     usdc_quota_in_pos: new BN(0),
    //     sui_quota_in_pos: new BN(0),
    //     gas_reserved: new BN(0),
    //     sui_price: d(0),
    //     usdc_quota_value: d(0),
    //     sui_quota_value: d(0),
    //     total_quota_value: d(0)
    // };
    // check_point_status_after_add_liquidity.wallet_balance = await getWalletBalance(account_address);

    // // wait for wallet balance updated.
    // while (balanceNotChange(check_point_status_after_swap.wallet_balance, check_point_status_after_add_liquidity.wallet_balance)) {
    //     date.setTime(Date.now());
    //     console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());
    //     await new Promise(f => setTimeout(f, 1000));
    //     check_point_status_after_add_liquidity.wallet_balance = await getWalletBalance(account_address);
    // }

    // check_point_status_after_add_liquidity.sui_price = await getCurrentSuiPrice();
    // check_point_status_after_add_liquidity.gas_reserved = SUI_GAS_RESERVED.sub(total_gas_fee_swap).sub(total_gas_fee_add_liquidity);
    // check_point_status_after_add_liquidity.usdc_quota_in_wallet = new BN(check_point_status_after_add_liquidity.wallet_balance.coin_amount_a);
    // check_point_status_after_add_liquidity.sui_quota_in_wallet = new BN(check_point_status_after_add_liquidity.wallet_balance.coin_amount_b).sub(check_point_status_after_add_liquidity.gas_reserved);
    // check_point_status_after_add_liquidity.usdc_quota_value = Decimal(check_point_status_after_add_liquidity.usdc_quota_in_wallet.toString()).mul(Decimal.pow(10, -6));
    // check_point_status_after_add_liquidity.sui_quota_value = Decimal(check_point_status_after_add_liquidity.sui_quota_in_wallet.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_after_add_liquidity.sui_price);
    // check_point_status_after_add_liquidity.total_quota_value = check_point_status_after_add_liquidity.usdc_quota_value.add(check_point_status_after_add_liquidity.sui_quota_value);

    // // dump check point
    // console.log('');
    // console.log(' - Check Point After Add Liquidity - ');
    // dumpCheckPoint(check_point_status_after_add_liquidity);
    // console.log('');


    // // additional print with pos
    // console.log('USDC in pos: ', add_liquidity_event.amount_a.toString());
    // console.log('SUI in pos: ', add_liquidity_event.amount_b.toString());
    // console.log('liquidity in pos: ', add_liquidity_event.after_liquidity.toString());

    // let usdc_value_in_pos = Decimal(add_liquidity_event.amount_a.toString()).mul(Decimal.pow(10, -6));
    // let sui_value_in_pos = Decimal(add_liquidity_event.amount_b.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_after_add_liquidity.sui_price);
    // let total_value_in_pos = usdc_value_in_pos.add(sui_value_in_pos);

    // console.log('USDC Value for liquidity + USDC Value in pos(by price after swap): ', 
    //     check_point_status_after_add_liquidity.usdc_quota_value.add(usdc_value_in_pos));
    // console.log('SUI Value for liquidity + SUI Value in pos(by price after swap): ', 
    //     check_point_status_after_add_liquidity.sui_quota_value.add(sui_value_in_pos));
    // console.log('Total Value for liquidity + Total Value in pos(by price after swap): ', check_point_status_after_add_liquidity.total_quota_value.add(total_value_in_pos));







    // // dump transaction statistics
    // console.log('');
    // console.log(' ========== Add Liquidity Transaction Info ========== ');
    // console.log('Digest: ', digest_add_liquidity);  

    // console.log('USDC %s => %s, delta(tx): %s, delta(calc): %s', 
    //     check_point_status_after_swap.wallet_balance.coin_amount_a,
    //     check_point_status_after_add_liquidity.wallet_balance.coin_amount_a,
    //     balance_change_add_liquidity.usdc_change.toString(),
    //     check_point_status_after_add_liquidity.usdc_quota_in_wallet.sub(check_point_status_after_swap.usdc_quota_in_wallet).toString());

    // console.log('SUI %s => %s, delta(tx): %s = %s(add liqui) - %s(total fee), delta(calc): %s', 
    //     check_point_status_after_swap.wallet_balance.coin_amount_b,
    //     check_point_status_after_add_liquidity.wallet_balance.coin_amount_b,
    //     balance_change_add_liquidity.sui_change.toString(),
    //     check_point_status_after_add_liquidity.sui_quota_in_wallet.sub(check_point_status_after_swap.sui_quota_in_wallet).toString(),
    //     total_gas_fee_add_liquidity.toString(),
    //     check_point_status_after_add_liquidity.sui_quota_in_wallet.sub(check_point_status_after_swap.sui_quota_in_wallet).sub(total_gas_fee_add_liquidity).toString());

    // console.log('USDC for liquidity %s => %s, delta: %s', 
    //     check_point_status_after_swap.usdc_quota_in_wallet.toString(),
    //     check_point_status_after_add_liquidity.usdc_quota_in_wallet.toString(),
    //     check_point_status_after_add_liquidity.usdc_quota_in_wallet.sub(check_point_status_after_swap.usdc_quota_in_wallet).toString());

    // console.log('SUI for liquidity %s => %s, delta: %s', 
    //     check_point_status_after_swap.sui_quota_in_wallet.toString(),
    //     check_point_status_after_add_liquidity.sui_quota_in_wallet.toString(),
    //     check_point_status_after_add_liquidity.sui_quota_in_wallet.sub(check_point_status_after_swap.sui_quota_in_wallet).toString());

    // console.log('');
    // console.log('Lost : ');
    // console.log('Total Gas Fee : ', total_gas_fee_add_liquidity.neg().toString());


    // console.log('');
    // let sui_value_old_in_new_price = Decimal(check_point_status_after_swap.sui_quota_in_wallet.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_after_add_liquidity.sui_price);
    // let total_value_in_new_price = check_point_status_after_add_liquidity.usdc_quota_value.add(sui_value_old_in_new_price);
    // console.log('SUI Price: ', check_point_status_after_add_liquidity.sui_price);
    // console.log('Total Value before: ', total_value_in_new_price);
    // console.log('Total Value after : ', check_point_status_after_add_liquidity.total_quota_value.add(total_value_in_pos));
    // console.log('Delta:');
    // console.log(check_point_status_after_add_liquidity.total_quota_value.add(total_value_in_pos).sub(total_value_in_new_price));

    // console.log('');
    // let total_gas_fee_add_liquidity_in_decimals = Decimal(total_gas_fee_add_liquidity.neg().toString()).mul(Decimal.pow(10, -9));
    // let total_gas_fee_add_liquidity_value = total_gas_fee_add_liquidity_in_decimals.mul(check_point_status_after_add_liquidity.sui_price);
    // console.log('Gas: %s(%s * Price)', total_gas_fee_add_liquidity_value, total_gas_fee_add_liquidity_in_decimals);

    // console.log(' ========== Add Liquidity Transaction Info End ========== ');
    // console.log('');




            // let check_point_status_after_close_position: CheckPointStatus = {
            //     wallet_balance: {coin_amount_a: '', coin_amount_b: ''},
            //     usdc_quota_in_wallet: new BN(0),
            //     sui_quota_in_wallet: new BN(0),
            //     usdc_quota_in_pos: new BN(0),
            //     sui_quota_in_pos: new BN(0),
            //     gas_reserved: new BN(0),
            //     sui_price: d(0),
            //     usdc_quota_value: d(0),
            //     sui_quota_value: d(0),
            //     total_quota_value: d(0)
            // };
            // check_point_status_after_close_position.wallet_balance = await getWalletBalance(account_address);

            // // wait for wallet balance updated.
            // while (balanceNotChange(check_point_status_after_add_liquidity.wallet_balance, check_point_status_after_close_position.wallet_balance)) {
            //     date.setTime(Date.now());
            //     console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());
            //     await new Promise(f => setTimeout(f, 1000));
            //     check_point_status_after_close_position.wallet_balance = await getWalletBalance(account_address);
            // }

            // check_point_status_after_close_position.sui_price = await getCurrentSuiPrice();
            // check_point_status_after_close_position.gas_reserved = SUI_GAS_RESERVED.sub(total_gas_fee_swap).sub(total_gas_fee_add_liquidity).sub(total_gas_fee_close_position);
            // check_point_status_after_close_position.usdc_quota_in_wallet = new BN(check_point_status_after_close_position.wallet_balance.coin_amount_a);
            // check_point_status_after_close_position.sui_quota_in_wallet = new BN(check_point_status_after_close_position.wallet_balance.coin_amount_b).sub(check_point_status_after_close_position.gas_reserved);
            // check_point_status_after_close_position.usdc_quota_value = Decimal(check_point_status_after_close_position.usdc_quota_in_wallet.toString()).mul(Decimal.pow(10, -6));
            // check_point_status_after_close_position.sui_quota_value = Decimal(check_point_status_after_close_position.sui_quota_in_wallet.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_after_close_position.sui_price);
            // check_point_status_after_close_position.total_quota_value = check_point_status_after_close_position.usdc_quota_value.add(check_point_status_after_close_position.sui_quota_value);

            // // dump check point
            // console.log('');
            // console.log(' - Check Point After Close Position - ');
            // dumpCheckPoint(check_point_status_after_close_position);
            // console.log('');























// type WalletBalanceAndValue = {
//     coin_wallet_amount: CoinAmounts;
//     coin_a_for_liquidity: BN;
//     coin_b_for_liquidity: BN;
//     gas_reserved: BN;
//     coin_b_price: Decimal;
//     coin_a_value: Decimal;
//     coin_b_value: Decimal;
//     total_quota_value: Decimal;
// };



// async function dumpWalletBalanceAndValue(account_address: string, gas_reserved: BN): Promise<WalletBalanceAndValue> {

//     let ret: WalletBalanceAndValue = {
//         coin_wallet_amount : {coin_amount_a : '0', coin_amount_b: '0'},
//         coin_a_for_liquidity: new BN(0),
//         coin_b_for_liquidity: new BN(0),
//         gas_reserved: new BN(0),
//         coin_b_price: d(0),
//         coin_a_value: d(0),
//         coin_b_value: d(0),
//         total_quota_value: d(0)
//     };


//     let coin_wallet_amount = await getWalletBalance(account_address);
//     let price = await getCurrentSuiPrice();

//     ret.coin_wallet_amount.coin_amount_a = coin_wallet_amount.coin_amount_a;
//     ret.coin_wallet_amount.coin_amount_b = coin_wallet_amount.coin_amount_b;
//     ret.gas_reserved = gas_reserved.clone();
//     ret.coin_b_price = price;

//     if (new BN(coin_wallet_amount.coin_amount_b).lt(gas_reserved)) {
//         console.log('[ERROR] dumpWalletBalanceAndValue: Insufficient sui for gas rsv. Coin B: %s, Gas Rsv: %s',
//             coin_wallet_amount.coin_amount_b, gas_reserved.toString()
//         );
//         return ret;
//     }

//     let usdc_amount_for_liquidity = new BN(coin_wallet_amount.coin_amount_a);
//     let sui_amount_for_liquidity = new BN(coin_wallet_amount.coin_amount_b).sub(gas_reserved);

//     console.log('USDC in wallet: ', coin_wallet_amount.coin_amount_a);
//     console.log('SUI in wallet: ', coin_wallet_amount.coin_amount_b);
//     console.log('USDC for liquidity: ', coin_wallet_amount.coin_amount_a);
//     console.log('SUI for liquidity: %s (-%s gas_rsv)', sui_amount_for_liquidity.toString(), gas_reserved.toString());
    
//     console.log('SUI Price: ', price);
//     let coin_a_value_in_u = Decimal(usdc_amount_for_liquidity.toString()).mul(Decimal.pow(10, -6));
//     let coin_b_value_in_u = Decimal(sui_amount_for_liquidity.toString()).mul(Decimal.pow(10, -9)).mul(price);
//     console.log('Total Value for liquidity: ', coin_a_value_in_u.add(coin_b_value_in_u));

//     ret.coin_a_value = coin_a_value_in_u;
//     ret.coin_b_value = coin_b_value_in_u;
//     ret.total_quota_value = coin_a_value_in_u.add(coin_b_value_in_u);
//     ret.coin_a_for_liquidity = usdc_amount_for_liquidity.clone();
//     ret.coin_b_for_liquidity = sui_amount_for_liquidity.clone();
//     ret.gas_reserved = gas_reserved.clone();
//     return ret;
// }








    // let coin_wallet_amount = await getWalletBalance(account_address);
    // if (new BN(coin_wallet_amount.coin_amount_b).lt(SUI_GAS_RESERVED)) {
    //     console.log('[ERROR] Insufficient sui gas(1 sui at least)');
    //     return;
    // }
    // let total_usdc_amount = new BN(coin_wallet_amount.coin_amount_a);
    // let total_sui_amount = new BN(coin_wallet_amount.coin_amount_b).sub(SUI_GAS_RESERVED);

    // // const total_usdc_amount = new BN(0);
    // // const total_sui_amount = new BN(2000000000);

    // console.log(JSON.stringify(coin_wallet_amount, null, 2));

    // let price = await getCurrentSuiPrice();
    // // let price = d(1).div(TickMath.tickIndexToPrice(58740, 6, 9));
    // // let price = d(1).div(TickMath.tickIndexToPrice(pools[0].current_tick_index, 6, 9));
    // // let price = d(3.707786768770878904870598587314120678629118067635537997694028654);

    // console.log('Check point 1')
    // console.log('USDC:', total_usdc_amount.toString());
    // console.log('SUI:', total_sui_amount.toString());
    // console.log('Price: ', price);
    // let coin_a_value_in_u = Decimal(total_usdc_amount.toString()).mul(Decimal.pow(10, -6));
    // let coin_b_value_in_u = Decimal(total_sui_amount.toString()).mul(Decimal.pow(10, -9)).mul(price);
    // console.log('Total Value: ', coin_a_value_in_u.add(coin_b_value_in_u));
    
    



        // swap method 2
        // const swap_ticks = await cetusClmmSDK.Pool.fetchTicksByRpc(pools[0].ticks_handle);
        // const res = cetusClmmSDK.Swap.calculateRates({
        //     decimals_a: COIN_A_DECIMALS,
        //     decimals_b: COIN_B_DECIMALS,
        //     a2b: rebalance_info.a2b,
        //     by_amount_in: true,
        //     amount: rebalance_info.amount_in,
        //     swap_ticks,
        //     current_pool: pools[0]
        //     });
        // console.log('====cetusClmmSDK.Swap.calculateRates===');
        // console.log('res.a2b: ', res.a2b);
        // console.log('res.amount: ', res.amount.toString());
        // console.log('res.estimated_amount_in: ', res.estimated_amount_in.toString());
        // console.log('res.estimated_amount_out: ', res.estimated_amount_out.toString());
        // console.log('res.estimated_end_sqrt_price: ', res.estimated_end_sqrt_price.toString());
        // console.log('res.estimated_fee_amount: ', res.estimated_fee_amount.toString());
        // console.log('res.extra_compute_limit: ', res.extra_compute_limit);
        // console.log('res.is_exceed: ', res.is_exceed);
        // console.log('res.price_impact_pct: ', res.price_impact_pct);



        // const slippage = Percentage.fromDecimal(d(5)) // by denominator of swap amount
        // // const other_side_amount = byAmountIn ? res.estimated_amount_out : res.estimatedAmountIn
        // const amount_out_limit = adjustForSlippage(res.estimated_amount_out, slippage, false)
        // console.log('amount_out_limit: ', amount_out_limit);

        // const swap_payload = await cetusClmmSDK.Swap.createSwapPayload({
        //     pool_id: pools[0].id,
        //     coin_type_a: pools[0].coin_type_a,
        //     coin_type_b: pools[0].coin_type_b,
        //     a2b: rebalance_info.a2b,
        //     by_amount_in: true,
        //     amount: res.amount.toString(),
        //     amount_limit: amount_out_limit.toString()
        //     })

        // date.setTime(Date.now());
        // console.log('[%s]=====cetusClmmSDK.Swap.createSwapPayload=====', date.toLocaleString());
        // fs.appendFileSync(LOG_FILE_NAME, util.format('\n[%s] =====cetusClmmSDK.Swap.createSwapPayload=====\n', date.toLocaleString()));
        // fs.appendFileSync(LOG_FILE_NAME, util.format(JSON.stringify(swap_payload, null, 2)));

        // const transferTxn = await cetusClmmSDK.FullClient.sendTransaction(sendKeypair, swap_payload);cetusClmmSDK.FullClient.executeTx
        // date.setTime(Date.now());
        // console.log('[%s]=====cetusClmmSDK.FullClient.sendTransaction=====', date.toLocaleString());
        // fs.appendFileSync(LOG_FILE_NAME, util.format('\n[%s] =====cetusClmmSDK.FullClient.sendTransaction=====\n', date.toLocaleString()));
        // fs.appendFileSync(LOG_FILE_NAME, util.format(JSON.stringify(transferTxn, null, 2)));

 
        // if (transferTxn?.effects?.status.status === 'success') {
        //     gas = getTotalGasFee(transferTxn);
        //     console.log("[%s] sendTransaction total gas fee: %s", date.toLocaleString(), gas.toString());

        //     transaction_digest = transferTxn.digest;
        //     console.log("[%s] sendTransaction digest: %s", date.toLocaleString(), transaction_digest);


        //     console.log("[%s] sendTransaction exec transaction success", date.toLocaleString());
        //     const wait_rst = await cetusClmmSDK.FullClient.waitForTransaction({digest: transferTxn.digest});
        //     date.setTime(Date.now());
        //     console.log('[%s]=====cetusClmmSDK.FullClient.waitForTransaction=====', date.toLocaleString());
        //     fs.appendFileSync(LOG_FILE_NAME, util.format('\n[%s] =====cetusClmmSDK.FullClient.waitForTransaction=====\n', date.toLocaleString()));
        //     fs.appendFileSync(LOG_FILE_NAME, util.format(JSON.stringify(wait_rst, null, 2)));

        //     if (wait_rst.effects?.status.status === 'success') {
        //         console.log("[%s] waitForTransaction exec transaction success", date.toLocaleString());
        //     } else {
        //         console.log("[%s] waitForTransaction exec transaction failed", date.toLocaleString());
        //     }
        // } else {
        //     console.log("[%s] sendTransaction exec transaction failed.", date.toLocaleString());
        // }





    // // wait for new wallet balance
    // let numerator = d(0);
    // let denominator = d(0);

    // let coin_a_wallet_old = new BN(check_point_status.wallet_balance.coin_amount_a);
    // let coin_b_wallet_old = new BN(check_point_status.wallet_balance.coin_amount_b);

    // let coin_wallet_amount_after_swap = await getWalletBalance(account_address);    
    // let coin_a_wallet_new = new BN(coin_wallet_amount_after_swap.coin_amount_a);
    // let coin_b_wallet_new = new BN(coin_wallet_amount_after_swap.coin_amount_b);   

    // if (rebalance_info.a2b) {
    //     numerator = d(coin_a_wallet_old.sub(rebalance_info.amount_in).sub(coin_a_wallet_new).abs().toString());
    //     denominator = d(rebalance_info.amount_in.toString());
    // } else {
    //     numerator = d(coin_b_wallet_old.sub(rebalance_info.amount_in).sub(total_gas_fee).sub(coin_b_wallet_new).abs().toString());
    //     denominator = d(rebalance_info.amount_in.toString());
    // }
    // console.log('coin_a_wallet_old: %s, coin_a_wallet_new: %s', 
    //     coin_a_wallet_old.toString(),coin_a_wallet_new.toString());
    // console.log('coin_b_wallet_old: %s, coin_b_wallet_new: %s', 
    //     coin_b_wallet_old.toString(),coin_b_wallet_new.toString());
    // console.log('numerator: %s, denominator: %s, numerator / denominator: %s', 
    //     numerator, denominator, numerator.div(denominator));

    // while (numerator.div(denominator).gte(0.1)) {
    //     date.setTime(Date.now())
    //     console.log('[%s]=====Wallet is not updated, wait a second =====', date.toLocaleString());

    //     await new Promise(f => setTimeout(f, 1000));

    //     coin_wallet_amount_after_swap = await getWalletBalance(account_address);
    //     coin_a_wallet_new = new BN(coin_wallet_amount_after_swap.coin_amount_a);
    //     coin_b_wallet_new = new BN(coin_wallet_amount_after_swap.coin_amount_b);

    //     if (rebalance_info.a2b) {
    //         numerator = d(coin_a_wallet_old.sub(coin_a_wallet_new).abs().toString());
    //         denominator = d(rebalance_info.amount_in.toString());
    //     } else {
    //         numerator = d(coin_b_wallet_new.add(total_gas_fee).sub(coin_b_wallet_old).abs().toString());
    //         denominator = d(rebalance_info.amount_in.toString());
    //     }

    //     console.log('coin_a_wallet_old: %s, coin_a_wallet_new: %s', 
    //         coin_a_wallet_old.toString(),coin_a_wallet_new.toString());
    //     console.log('coin_b_wallet_old: %s, coin_b_wallet_new: %s', 
    //         coin_b_wallet_old.toString(),coin_b_wallet_new.toString());
    //     console.log('numerator: %s, denominator: %s, numerator / denominator: %s', 
    //         numerator, denominator, numerator.div(denominator));
    // }


    // console.log(JSON.stringify(coin_wallet_amount_after_swap, null, 2));



    // // get coin a /b new balance
    // let sui_gas_rsv_remain = SUI_GAS_RESERVED.sub(total_gas_fee);
    // let total_usdc_amount_after_swap = new BN(coin_wallet_amount_after_swap.coin_amount_a);
    // let total_sui_amount_after_swap = new BN(coin_wallet_amount_after_swap.coin_amount_b).sub(sui_gas_rsv_remain);
    


    // // dump check point value
    // let price_after_swap = await getCurrentSuiPrice();
    // console.log('Check point 2')
    // console.log('USDC:', total_usdc_amount_after_swap.toString());
    // console.log('SUI:', total_sui_amount_after_swap.toString());
    // console.log('Price: ', price_after_swap);
    // let coin_a_value_in_u_after_swap = Decimal(total_usdc_amount_after_swap.toString()).mul(Decimal.pow(10, -6));
    // let coin_b_value_in_u_after_swap = Decimal(total_sui_amount_after_swap.toString()).mul(Decimal.pow(10, -9)).mul(price_after_swap);
    // console.log('Total Value: ', coin_a_value_in_u_after_swap.add(coin_b_value_in_u_after_swap));





    // // wait for new wallet balance

    // let balance_coin_a_before_add_liquidity = new BN(coin_wallet_amount_after_swap.coin_amount_a);
    // let balance_coin_b_before_add_liquidity = new BN(coin_wallet_amount_after_swap.coin_amount_b);

    // let coin_wallet_amount_after_add_liquidity = await getWalletBalance(account_address);
    // let balance_coin_a_after_add_liquidity = new BN(coin_wallet_amount_after_add_liquidity.coin_amount_a);
    // let balance_coin_b_after_add_liquidity = new BN(coin_wallet_amount_after_add_liquidity.coin_amount_b);


    // let coin_a_not_change = balance_coin_a_before_add_liquidity.eq(balance_coin_a_after_add_liquidity);
    // let coin_b_not_change = balance_coin_b_before_add_liquidity.eq(balance_coin_b_after_add_liquidity);

    // console.log('balance_coin_a_before_add_liquidity: %s, balance_coin_a_after_add_liquidity: %s', 
    //     balance_coin_a_before_add_liquidity.toString(),balance_coin_a_after_add_liquidity.toString());
    // console.log('balance_coin_b_before_add_liquidity: %s, balance_coin_b_after_add_liquidity: %s', 
    //     balance_coin_b_before_add_liquidity.toString(),balance_coin_b_after_add_liquidity.toString());

    // console.log('coin_a_not_change:', coin_a_not_change);
    // console.log('coin_b_not_change:', coin_b_not_change);

    // while (coin_a_not_change || coin_b_not_change) {
    //     date.setTime(Date.now())
    //     console.log('[%s]=====Wallet is not updated, wait a second =====', date.toLocaleString());
    //     await new Promise(f => setTimeout(f, 1000));

    //     coin_wallet_amount_after_add_liquidity = await getWalletBalance(account_address);

    //     balance_coin_a_after_add_liquidity = new BN(coin_wallet_amount_after_add_liquidity.coin_amount_a);
    //     balance_coin_b_after_add_liquidity = new BN(coin_wallet_amount_after_add_liquidity.coin_amount_b);

    //     coin_a_not_change = balance_coin_a_before_add_liquidity.eq(balance_coin_a_after_add_liquidity);
    //     coin_b_not_change = balance_coin_b_before_add_liquidity.eq(balance_coin_b_after_add_liquidity);

    //     console.log('balance_coin_a_before_add_liquidity: %s, balance_coin_a_after_add_liquidity: %s', 
    //         balance_coin_a_before_add_liquidity.toString(),balance_coin_a_after_add_liquidity.toString());
    //     console.log('balance_coin_b_before_add_liquidity: %s, balance_coin_b_after_add_liquidity: %s', 
    //         balance_coin_b_before_add_liquidity.toString(),balance_coin_b_after_add_liquidity.toString());

    //     console.log('coin_a_not_change:', coin_a_not_change);
    //     console.log('coin_b_not_change:', coin_b_not_change);
    // }

    // console.log(JSON.stringify(coin_wallet_amount_after_add_liquidity, null, 2));








    // // get coin a / b new balance in use
    // let sui_gas_rsv_remain_after_add_liquidity = sui_gas_rsv_remain.sub(gas_add_liquidity);
    // let total_usdc_amount_after_add_liquidity = new BN(coin_wallet_amount_after_add_liquidity.coin_amount_a);
    // let total_sui_amount_after_add_liquidity = new BN(coin_wallet_amount_after_add_liquidity.coin_amount_b).sub(sui_gas_rsv_remain_after_add_liquidity);

    // let position_usdc_amount_after_add_liquidity = total_usdc_amount_after_swap.sub(total_usdc_amount_after_add_liquidity);
    // let position_sui_amount_after_add_liquidity = total_sui_amount_after_swap.sub(total_sui_amount_after_add_liquidity);


    // // dump check point value
    // let price_after_add_liquidity = await getCurrentSuiPrice();
    // console.log('Check point 3')
    // console.log('USDC:', total_usdc_amount_after_add_liquidity.toString());
    // console.log('SUI:', total_sui_amount_after_add_liquidity.toString());
    // console.log('USDC in position:', position_usdc_amount_after_add_liquidity.toString());
    // console.log('SUI in position:', position_sui_amount_after_add_liquidity.toString());

    // console.log('Price: ', price_after_add_liquidity);
    // let coin_a_value_in_u_after_add_liquidity = Decimal(total_usdc_amount_after_add_liquidity.toString()).mul(Decimal.pow(10, -6));
    // let coin_b_value_in_u_after_add_liquidity = Decimal(total_sui_amount_after_add_liquidity.toString()).mul(Decimal.pow(10, -9)).mul(price_after_add_liquidity);
    // console.log('Total Value: ', coin_a_value_in_u_after_add_liquidity.add(coin_b_value_in_u_after_add_liquidity));

    // let coin_a_value_in_u_in_position = Decimal(position_usdc_amount_after_add_liquidity.toString()).mul(Decimal.pow(10, -6));
    // let coin_b_value_in_u_in_position = Decimal(position_sui_amount_after_add_liquidity.toString()).mul(Decimal.pow(10, -9)).mul(price_after_add_liquidity);
    // console.log('Total Value In Position: ', coin_a_value_in_u_in_position.add(coin_b_value_in_u_in_position));





    //  // dump statistics for swap
    // console.log('======================================================');
    // console.log('Digest : ', transaction_digest_add_liquidity);
    // console.log('SUI %s => %s (%s)', total_sui_amount_after_swap.toString(), total_sui_amount_after_add_liquidity.toString(), 
    //     total_sui_amount_after_add_liquidity.sub(total_sui_amount_after_swap).toString());
    // console.log('USDC %s => %s (%s)', total_usdc_amount_after_swap.toString(), total_usdc_amount_after_add_liquidity.toString(), 
    //     total_usdc_amount_after_add_liquidity.sub(total_usdc_amount_after_swap).toString());

    // console.log('\n');
    // console.log('Lost : ');
    // console.log('Total Gas Fee : ', gas_add_liquidity.neg().toString());

    // console.log('\n');
    // console.log('Price After Swap: ', price_after_swap);
    // console.log('Price After Add Liquidity) : ', price_after_add_liquidity);    
    
    // let total_value_after_add_liquidity = coin_a_value_in_u_after_add_liquidity.add(coin_b_value_in_u_after_add_liquidity).add(coin_a_value_in_u_in_position).add(coin_b_value_in_u_in_position);
    // console.log('Total Value After Swap: ', total_value_after_swap);
    // console.log('Total Value After Add Liquidity: ', total_value_after_add_liquidity);
    // console.log('Delta:');
    // console.log(total_value_after_add_liquidity.sub(total_value_after_swap));




    // console.log('\n');
    // let gas_add_liquidity_in_decimals = Decimal(gas_add_liquidity.neg().toString()).mul(Decimal.pow(10, -9));
    // let gas_value_in_u_after_add_liquidity = gas_add_liquidity_in_decimals.mul(price_after_add_liquidity);
    // console.log('Gas: %s(%s * Price)', gas_value_in_u_after_add_liquidity, gas_add_liquidity_in_decimals);

    // console.log('======================================================');




            //  // wait for new wallet balance

            // let balance_coin_a_before_close_liquidity = new BN(coin_wallet_amount_after_add_liquidity.coin_amount_a);
            // let balance_coin_b_before_close_liquidity = new BN(coin_wallet_amount_after_add_liquidity.coin_amount_b);

            // let coin_wallet_amount_after_close_liquidity = await getWalletBalance(account_address);
            // let balance_coin_a_after_close_liquidity = new BN(coin_wallet_amount_after_close_liquidity.coin_amount_a);
            // let balance_coin_b_after_close_liquidity = new BN(coin_wallet_amount_after_close_liquidity.coin_amount_b);


            // let coin_a_not_change = balance_coin_a_before_close_liquidity.eq(balance_coin_a_after_close_liquidity);
            // let coin_b_not_change = balance_coin_b_before_close_liquidity.eq(balance_coin_b_after_close_liquidity);

            // console.log('balance_coin_a_before_close_liquidity: %s, balance_coin_a_after_close_liquidity: %s', 
            //     balance_coin_a_before_close_liquidity.toString(), balance_coin_a_after_close_liquidity.toString());
            // console.log('balance_coin_b_before_close_liquidity: %s, balance_coin_b_after_close_liquidity: %s', 
            //     balance_coin_b_before_close_liquidity.toString(), balance_coin_b_after_close_liquidity.toString());

            // console.log('coin_a_not_change:', coin_a_not_change);
            // console.log('coin_b_not_change:', coin_b_not_change);

            // while (coin_a_not_change || coin_b_not_change) {
            //     date.setTime(Date.now())
            //     console.log('[%s]=====Wallet is not updated, wait a second =====', date.toLocaleString());
            //     await new Promise(f => setTimeout(f, 1000));

            //     coin_wallet_amount_after_close_liquidity = await getWalletBalance(account_address);

            //     balance_coin_a_after_close_liquidity = new BN(coin_wallet_amount_after_close_liquidity.coin_amount_a);
            //     balance_coin_b_after_close_liquidity = new BN(coin_wallet_amount_after_close_liquidity.coin_amount_b);


            //     coin_a_not_change = balance_coin_a_before_add_liquidity.eq(balance_coin_a_after_add_liquidity);
            //     coin_b_not_change = balance_coin_b_before_add_liquidity.eq(balance_coin_b_after_add_liquidity);

            //     console.log('balance_coin_a_before_close_liquidity: %s, balance_coin_a_after_close_liquidity: %s', 
            //         balance_coin_a_before_close_liquidity.toString(), balance_coin_a_after_close_liquidity.toString());
            //     console.log('balance_coin_b_before_close_liquidity: %s, balance_coin_b_after_close_liquidity: %s', 
            //         balance_coin_b_before_close_liquidity.toString(), balance_coin_b_after_close_liquidity.toString());

            //     console.log('coin_a_not_change:', coin_a_not_change);
            //     console.log('coin_b_not_change:', coin_b_not_change);
            // }









    //  // dump transaction statistics
    // console.log(' ========== Swap Transaction Info ========== ');
    // console.log('Digest: ', digest_swap);  

    // console.log('USDC %s => %s, balance_change: %s, balance_change(rsp): %s', 
    //     check_point_status.wallet_balance.coin_amount_a,
    //     check_point_status_after_swap.wallet_balance.coin_amount_a,
    //     check_point_status_after_swap.usdc_quota_in_wallet.sub(check_point_status.usdc_quota_in_wallet).toString(),
    //     balance_change_swap.usdc_change.toString());

    // console.log('SUI %s => %s, balance_change: %s = %s - %s(total gas fee), balance_change(rsp): %s', 
    //     check_point_status.wallet_balance.coin_amount_b,
    //     check_point_status_after_swap.wallet_balance.coin_amount_b,
    //     check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet).sub(total_gas_fee_swap).toString(),        
    //     check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet).toString(),
    //     total_gas_fee_swap.toString(),
    //     balance_change_swap.sui_change.toString());

    // console.log('USDC Quota in Wallet %s => %s, delta: %s', 
    //     check_point_status.usdc_quota_in_wallet.toString(),
    //     check_point_status_after_swap.usdc_quota_in_wallet.toString(),
    //     check_point_status_after_swap.usdc_quota_in_wallet.sub(check_point_status.usdc_quota_in_wallet).toString());

    // console.log('SUI Quota in Wallet %s => %s, delta: %s', 
    //     check_point_status.sui_quota_in_wallet.toString(),
    //     check_point_status_after_swap.sui_quota_in_wallet.toString(),
    //     check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet).toString());

    // console.log('USDC Quota in Position %s => %s, delta: %s', 
    //     check_point_status.usdc_quota_in_pos.toString(),
    //     check_point_status_after_swap.usdc_quota_in_pos.toString(),
    //     check_point_status_after_swap.usdc_quota_in_pos.sub(check_point_status.usdc_quota_in_pos).toString());

    // console.log('SUI Quota in Position %s => %s, delta: %s', 
    //     check_point_status.sui_quota_in_wallet.toString(),
    //     check_point_status_after_swap.sui_quota_in_wallet.toString(),
    //     check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet).toString());


    // console.log('');
    // console.log('Lost : ');
    // console.log('Total Gas Fee : ', total_gas_fee_swap.neg().toString());


    // console.log('');
    // console.log('SUI Price before: ', check_point_status.sui_price);
    // console.log('SUI Price after : ', check_point_status_after_swap.sui_price);
    // console.log('Total Value before: ', check_point_status.total_quota_value);
    // // console.log('Total Value before in new: ', check_point_status.sui_quota_value.mul(check_point_status_after_swap.sui_price).div(check_point_status.sui_price).add(check_point_status.usdc_quota_value));
    // console.log('Total Value after : ', check_point_status_after_swap.total_quota_value);    
    // console.log('Delta:');
    // console.log(check_point_status_after_swap.total_quota_value.sub(check_point_status.total_quota_value));

    

    // let swap_actual = new BN(0);
    // let swap_deviation = new BN(0);
    // let swap_deviation_percentage = d(0);
    // let swap_deviation_percentage1 = d(0);
    // if (rebalance_info.a2b) {
    //     swap_actual = check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet);
    //     swap_deviation = swap_actual.sub(rebalance_info.amount_out);
    //     swap_deviation_percentage = Decimal(swap_deviation.toString()).div(d(rebalance_info.amount_out.toString()));
    //     console.log('Swap Fee + slippage : SUI %s (%s(Actual) - %s(Calc), %s, %s%%)', 
    //         swap_deviation.toString(), swap_actual.toString(), rebalance_info.amount_out.toString(), 
    //         swap_deviation_percentage.toString(), swap_deviation_percentage.mul(100).toFixed(6).toString());
    // } else {
    //     swap_actual = check_point_status_after_swap.usdc_quota_in_wallet.sub(check_point_status.usdc_quota_in_wallet);
    //     swap_deviation = swap_actual.sub(rebalance_info.amount_out);
    //     swap_deviation_percentage = Decimal(swap_deviation.toString()).div(d(rebalance_info.amount_out.toString()));
    //     console.log('Swap Fee + slippage : USDC %s (%s(Actual) - %s(Calc), %s, %s%%)', 
    //         swap_deviation.toString(), swap_actual.toString(), rebalance_info.amount_out.toString(), 
    //         swap_deviation_percentage.toString(), swap_deviation_percentage.mul(100).toFixed(6).toString());
    // }

    // console.log('');
    // let total_gas_fee_swap_in_decimals = Decimal(total_gas_fee_swap.neg().toString()).mul(Decimal.pow(10, -9));
    // let total_gas_fee_swap_value = total_gas_fee_swap_in_decimals.mul(check_point_status_after_swap.sui_price);
    // console.log('Gas: %s(%s * Price)', total_gas_fee_swap_value, total_gas_fee_swap_in_decimals);

    // let swap_fee_slippage_value = d(0);
    // let description = '';
    // if (rebalance_info.a2b) {
    //     swap_fee_slippage_value = Decimal(swap_deviation.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_after_swap.sui_price);
    //     description = util.format("(%s * Price)", Decimal(swap_deviation.toString()).mul(Decimal.pow(10, -9)));
    // } else {
    //     swap_fee_slippage_value = Decimal(swap_deviation.toString()).mul(Decimal.pow(10, -6));
    // }
    // console.log('Swap Fee + Slippage: %s%s', swap_fee_slippage_value, description);
    // console.log('=');
    // console.log(total_gas_fee_swap_value.add(swap_fee_slippage_value));
    // console.log(' ========== Swap Transaction Info End ========== ');
    // console.log('');
    // console.log('');






        // // swap method 1
        // try {
        //     const routers = await client.findRouters({
        //         from: rebalance_info.a2b ? COIN_TYPE_ADDRESS_USDC : COIN_TYPE_ADDRESS_SUI,
        //         target: rebalance_info.a2b ? COIN_TYPE_ADDRESS_SUI : COIN_TYPE_ADDRESS_USDC,
        //         amount: rebalance_info.amount_in,
        //         byAmountIn: true // `true` means fix input amount, `false` means fix output amount
        //     });
        //     dumpSDKRet2Logfile('Swap:findRouters', JSON.stringify(routers, null, 2));
        //     console.log('[%s] - client.findRouters: %s - ', date.toLocaleString(), routers ? 'Not return null' : 'Return null');

        //     if (routers) {
        //         client.signer = account_address;
        //         const txb = new Transaction();
        //         await client.fastRouterSwap({
        //             routers,
        //             txb,
        //             slippage: 0.01,
        //         })

        //         const result = await client.devInspectTransactionBlock(txb);
        //         dumpSDKRet2Logfile('Swap: devInspectTransactionBlock', JSON.stringify(result, null, 2));
        //         console.log('[%s] - client.devInspectTransactionBlock: %s - ', date.toLocaleString(), result.effects.status.status);

        //         if (result.effects.status.status === "success") {
        //             // const signAndExecuteResult = await client.client.signAndExecuteTransaction({transaction:txb, signer: sendKeypair});
        //             const signAndExecuteResult = await client.signAndExecuteTransaction(txb, sendKeypair);
        //             dumpSDKRet2Logfile('Swap: signAndExecuteTransaction', JSON.stringify(signAndExecuteResult, null, 2));
        //             console.log('[%s] - client.signAndExecuteTransaction: %s - ', date.toLocaleString(), signAndExecuteResult.effects?.status.status);

                    
        //             digest_swap = signAndExecuteResult.digest;
        //             total_gas_fee_swap = getTotalGasFee(signAndExecuteResult);
        //             balance_change_swap = getBalanceChange(signAndExecuteResult);

        //             // if (signAndExecuteResult.effects?.status.status === 'success') {
        //             //     const waitResult = await client.client.waitForTransaction({digest: signAndExecuteResult.digest});
        //             //     dumpSDKRet2Logfile('Swap: waitForTransaction', JSON.stringify(waitResult, null, 2));
        //             //     console.log('[%s] - client.client.waitForTransactionn: %s - ', date.toLocaleString(), waitResult.effects?.status.status);
        //             // } else {
        //             //     return;
        //             // }
        //         } else {
        //             return;
        //         }
        //     } else {
        //         return;
        //     }
        // } catch(e) {
        //     if (e instanceof Error) {
        //         console.error('%s [error] aggregator swap get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
        //     } else {
        //         console.error('aggregator swap get an exception'); 
        //         console.error(e);
        //     }
        //     return;
        // }




    // const add_liquidity_payload = await cetusClmmSDK.Position.createAddLiquidityFixTokenPayload(add_liquidity_payload_params);
    // dumpSDKRet2Logfile('Add Liquidity: cetusClmmSDK.Position.createAddLiquidityFixTokenPayload', JSON.stringify(add_liquidity_payload, null, 2));
    // console.log('[%s] - cetusClmmSDK.Position.createAddLiquidityFixTokenPayload - ', date.toLocaleString());


    // const transfer_txn = await cetusClmmSDK.FullClient.sendTransaction(sendKeypair, add_liquidity_payload);
    // dumpSDKRet2Logfile('Add Liquidity: cetusClmmSDK.FullClient.sendTransaction', JSON.stringify(transfer_txn, null, 2));
    // console.log('[%s] - cetusClmmSDK.FullClient.sendTransaction: %s - ', date.toLocaleString(), transfer_txn?.effects?.status.status);

    // if (transfer_txn?.effects?.status.status === "success") {
    //     digest_add_liquidity = transfer_txn.digest;
    //     total_gas_fee_add_liquidity = getTotalGasFee(transfer_txn);
    //     balance_change_add_liquidity = getBalanceChange(transfer_txn);
    //     add_liquidity_event = getAddLiquidityEvent(transfer_txn);
    // } else {
    //     return;
    // }


    // calc swap loss manual
    // let swap_actual = new BN(0);
    // let swap_deviation = new BN(0);
    // let swap_deviation_percentage = d(0);
    // let swap_deviation_percentage1 = d(0);
    // if (rebalance_info.a2b) {
    //     swap_actual = check_point_status_after_swap.sui_quota_in_wallet.sub(check_point_status.sui_quota_in_wallet);
    //     swap_deviation = swap_actual.sub(rebalance_info.amount_out);
    //     swap_deviation_percentage = Decimal(swap_deviation.toString()).div(d(rebalance_info.amount_out.toString()));
    //     console.log('Swap Fee + slippage : SUI %s (%s(Actual) - %s(Calc), %s, %s%%)', 
    //         swap_deviation.toString(), swap_actual.toString(), rebalance_info.amount_out.toString(), 
    //         swap_deviation_percentage.toString(), swap_deviation_percentage.mul(100).toFixed(6).toString());
    // } else {
    //     swap_actual = check_point_status_after_swap.usdc_quota_in_wallet.sub(check_point_status.usdc_quota_in_wallet);
    //     swap_deviation = swap_actual.sub(rebalance_info.amount_out);
    //     swap_deviation_percentage = Decimal(swap_deviation.toString()).div(d(rebalance_info.amount_out.toString()));
    //     console.log('Swap Fee + slippage : USDC %s (%s(Actual) - %s(Calc), %s, %s%%)', 
    //         swap_deviation.toString(), swap_actual.toString(), rebalance_info.amount_out.toString(), 
    //         swap_deviation_percentage.toString(), swap_deviation_percentage.mul(100).toFixed(6).toString());
    // }

    // let swap_fee_slippage_value = d(0);
    // let description = '';
    // if (rebalance_info.a2b) {
    //     swap_fee_slippage_value = Decimal(swap_deviation.toString()).mul(Decimal.pow(10, -9)).mul(sui_price_after_swap);
    //     description = util.format("(%s * Price)", Decimal(swap_deviation.toString()).mul(Decimal.pow(10, -9)));
    // } else {
    //     swap_fee_slippage_value = Decimal(swap_deviation.toString()).mul(Decimal.pow(10, -6));
    // }
    // console.log('Swap Fee + Slippage: %s%s', swap_fee_slippage_value, description);
























//     type ImpermanentLossCtx = {
//     sui_price_when_add_liquidity: Decimal;
//     sui_price_lower_index: Decimal;
//     sui_price_upper_index: Decimal;
//     usdc_price_when_add_liquidity: Decimal;
//     usdc_price_lower_index: Decimal;
//     usdc_price_upper_index: Decimal;
//     coin_amount_lower: CoinAmounts;
//     coin_amount_upper: CoinAmounts;


//     liquidity_amount_a_initial_index: Decimal;
//     liquidity_amount_b_initial_index: Decimal;
//     liquidity_amount_a_lower_index: Decimal;
//     liquidity_amount_b_lower_index: Decimal;
//     liquidity_amount_a_upper_index: Decimal;
//     liquidity_amount_b_upper_index: Decimal;
//     quota_amount_a_initial: Decimal;
//     quota_amount_b_initial: Decimal;
//     quota_amount_a_lower_index: Decimal;
//     quota_amount_b_lower_index: Decimal;
//     quota_amount_a_upper_index: Decimal;
//     quota_amount_b_upper_index: Decimal;

//     liquidity_usdc_value_initial_index: Decimal;
//     liquidity_usdc_value_lower_index: Decimal;
//     liquidity_usdc_value_upper_index: Decimal;
//     liquidity_hold_usdc_value_lower_index: Decimal;
//     liquidity_hold_usdc_value_upper_index: Decimal;

//     liquidity_sui_value_initial_index: Decimal;
//     liquidity_sui_value_lower_index: Decimal;
//     liquidity_sui_value_upper_index: Decimal;    
//     liquidity_hold_sui_value_lower_index: Decimal;    
//     liquidity_hold_sui_value_upper_index: Decimal; 
    
//     quota_usdc_value_initial: Decimal;
//     quota_usdc_value_lower_index: Decimal;
//     quota_usdc_value_upper_index: Decimal;
//     quota_hold_usdc_value_lower_index: Decimal;
//     quota_hold_usdc_value_upper_index: Decimal;
    
//     quota_sui_value_initial: Decimal;    
//     quota_sui_value_lower_index: Decimal;
//     quota_sui_value_upper_index: Decimal;
//     quota_hold_sui_value_lower_index: Decimal;    
//     quota_hold_sui_value_upper_index: Decimal;



//     liquidity_usdc_impermanent_loss_lower_index: Decimal;
//     liquidity_abs_usdc_impermanent_loss_lower_index: Decimal;

//     liquidity_usdc_impermanent_loss_upper_index: Decimal;
//     liquidity_abs_usdc_impermanent_loss_upper_index: Decimal;

//     liquidity_sui_impermanent_loss_lower_index: Decimal;    
//     liquidity_abs_sui_impermanent_loss_lower_index: Decimal;

//     liquidity_sui_impermanent_loss_upper_index: Decimal;    
//     liquidity_abs_sui_impermanent_loss_upper_index: Decimal;




//     quota_usdc_impermanent_loss_lower_index: Decimal;
//     quota_abs_usdc_impermanent_loss_lower_index: Decimal;

//     quota_usdc_impermanent_loss_upper_index: Decimal;
//     quota_abs_usdc_impermanent_loss_upper_index: Decimal;

//     quota_sui_impermanent_loss_lower_index: Decimal;
//     quota_abs_sui_impermanent_loss_lower_index: Decimal;

//     quota_sui_impermanent_loss_upper_index: Decimal;    
//     quota_abs_sui_impermanent_loss_upper_index: Decimal;
// };

// function newImpermanentLossCtx(): ImpermanentLossCtx {
//     let ret: ImpermanentLossCtx = {
//         sui_price_when_add_liquidity: d(0),
//         sui_price_lower_index: d(0),
//         sui_price_upper_index: d(0),
//         usdc_price_when_add_liquidity: d(0),
//         usdc_price_lower_index: d(0),
//         usdc_price_upper_index: d(0),
//         coin_amount_lower: {coin_amount_a: '', coin_amount_b: ''},
//         coin_amount_upper: {coin_amount_a: '', coin_amount_b: ''},


//         liquidity_amount_a_initial_index: d(0),
//         liquidity_amount_b_initial_index: d(0),
//         liquidity_amount_a_lower_index: d(0),
//         liquidity_amount_b_lower_index: d(0),
//         liquidity_amount_a_upper_index: d(0),
//         liquidity_amount_b_upper_index: d(0),
//         quota_amount_a_initial: d(0),
//         quota_amount_b_initial: d(0),
//         quota_amount_a_lower_index: d(0),
//         quota_amount_b_lower_index: d(0),
//         quota_amount_a_upper_index: d(0),
//         quota_amount_b_upper_index: d(0),

//         liquidity_usdc_value_initial_index: d(0),
//         liquidity_usdc_value_lower_index: d(0),
//         liquidity_usdc_value_upper_index: d(0),
//         liquidity_hold_usdc_value_lower_index: d(0),
//         liquidity_hold_usdc_value_upper_index: d(0),

//         liquidity_sui_value_initial_index: d(0),
//         liquidity_sui_value_lower_index: d(0),
//         liquidity_sui_value_upper_index: d(0),
//         liquidity_hold_sui_value_lower_index: d(0),
//         liquidity_hold_sui_value_upper_index: d(0),
        
//         quota_usdc_value_initial: d(0),
//         quota_usdc_value_lower_index: d(0),
//         quota_usdc_value_upper_index: d(0),
//         quota_hold_usdc_value_lower_index: d(0),
//         quota_hold_usdc_value_upper_index: d(0),
        
//         quota_sui_value_initial: d(0),
//         quota_sui_value_lower_index: d(0),
//         quota_sui_value_upper_index: d(0),
//         quota_hold_sui_value_lower_index: d(0),
//         quota_hold_sui_value_upper_index: d(0),



//         liquidity_usdc_impermanent_loss_lower_index: d(0),
//         liquidity_abs_usdc_impermanent_loss_lower_index: d(0),

//         liquidity_usdc_impermanent_loss_upper_index: d(0),
//         liquidity_abs_usdc_impermanent_loss_upper_index: d(0),

//         liquidity_sui_impermanent_loss_lower_index: d(0),
//         liquidity_abs_sui_impermanent_loss_lower_index: d(0),

//         liquidity_sui_impermanent_loss_upper_index: d(0),
//         liquidity_abs_sui_impermanent_loss_upper_index: d(0),




//         quota_usdc_impermanent_loss_lower_index: d(0),
//         quota_abs_usdc_impermanent_loss_lower_index: d(0),

//         quota_usdc_impermanent_loss_upper_index: d(0),
//         quota_abs_usdc_impermanent_loss_upper_index: d(0),

//         quota_sui_impermanent_loss_lower_index: d(0),
//         quota_abs_sui_impermanent_loss_lower_index: d(0),

//         quota_sui_impermanent_loss_upper_index: d(0),
//         quota_abs_sui_impermanent_loss_upper_index: d(0)
//     };
//     return ret;
// }


// function getImpermanentLossCtx(tick_lower_index: number, tick_when_add_liquidity: number, tick_upper_index: number, 
//     add_liqui_event: LiquidityEvent, check_point_status: CheckPointStatus,  check_point_statu_after_add_liquidity: CheckPointStatus): ImpermanentLossCtx {

//     let ret = newImpermanentLossCtx();

//     ret.usdc_price_when_add_liquidity = TickMath.tickIndexToPrice(tick_when_add_liquidity, 6, 9);
//     ret.usdc_price_lower_index = TickMath.tickIndexToPrice(tick_lower_index, 6, 9);
//     ret.usdc_price_upper_index = TickMath.tickIndexToPrice(tick_upper_index, 6, 9);

//     ret.sui_price_when_add_liquidity = d(1).div(ret.usdc_price_when_add_liquidity);
//     ret.sui_price_lower_index = d(1).div(ret.usdc_price_lower_index);
//     ret.sui_price_upper_index = d(1).div(ret.usdc_price_upper_index);

//     ret.coin_amount_lower = ClmmPoolUtil.getCoinAmountFromLiquidity(add_liqui_event.after_liquidity, 
//         TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
//         TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
//         TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
//         false);
//     ret.coin_amount_upper = ClmmPoolUtil.getCoinAmountFromLiquidity(add_liqui_event.after_liquidity, 
//         TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
//         TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
//         TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
//         false);


   


//     ret.liquidity_amount_a_initial_index = d(add_liqui_event.amount_a.toString());
//     ret.liquidity_amount_b_initial_index = d(add_liqui_event.amount_b.toString());
//     ret.liquidity_amount_a_lower_index = d(ret.coin_amount_lower.coin_amount_a);
//     ret.liquidity_amount_b_lower_index = d(0);
//     ret.liquidity_amount_a_upper_index = d(0);
//     ret.liquidity_amount_b_upper_index = d(ret.coin_amount_upper.coin_amount_b);






//     ret.liquidity_usdc_value_initial_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).add(ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_when_add_liquidity));
//     ret.liquidity_usdc_value_lower_index = ret.liquidity_amount_a_lower_index.mul(Decimal.pow(10, -6));
//     ret.liquidity_hold_usdc_value_lower_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).add(ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index));
//     ret.liquidity_usdc_value_upper_index = ret.liquidity_amount_b_upper_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index);
//     ret.liquidity_hold_usdc_value_upper_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).add(ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index));

    
    
    
    
//     ret.liquidity_sui_value_initial_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).mul(ret.usdc_price_when_add_liquidity).add(ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9)));
//     ret.liquidity_sui_value_lower_index = ret.liquidity_amount_a_lower_index.mul(Decimal.pow(10, -6)).mul(ret.usdc_price_lower_index);
//     ret.liquidity_hold_sui_value_lower_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).mul(ret.usdc_price_lower_index).add(ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9)));
//     ret.liquidity_sui_value_upper_index = ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9));     
//     ret.liquidity_hold_sui_value_upper_index = ret.liquidity_amount_a_initial_index.mul(Decimal.pow(10, -6)).mul(ret.usdc_price_upper_index).add(ret.liquidity_amount_b_initial_index.mul(Decimal.pow(10, -9)));





//     ret.liquidity_usdc_impermanent_loss_lower_index = ret.liquidity_usdc_value_lower_index.sub(ret.liquidity_hold_usdc_value_lower_index);
//     ret.liquidity_abs_usdc_impermanent_loss_lower_index = ret.liquidity_usdc_value_lower_index.sub(ret.liquidity_usdc_value_initial_index);    

//     ret.liquidity_usdc_impermanent_loss_upper_index = ret.liquidity_usdc_value_upper_index.sub(ret.liquidity_hold_usdc_value_upper_index);
//     ret.liquidity_abs_usdc_impermanent_loss_upper_index = ret.liquidity_usdc_value_upper_index.sub(ret.liquidity_usdc_value_initial_index);


//     ret.liquidity_sui_impermanent_loss_lower_index = ret.liquidity_sui_value_lower_index.sub(ret.liquidity_hold_sui_value_lower_index);
//     ret.liquidity_abs_sui_impermanent_loss_lower_index = ret.liquidity_sui_value_lower_index.sub(ret.liquidity_sui_value_initial_index);

//     ret.liquidity_sui_impermanent_loss_upper_index = ret.liquidity_sui_value_upper_index.sub(ret.liquidity_hold_sui_value_upper_index);
//     ret.liquidity_abs_sui_impermanent_loss_upper_index = ret.liquidity_sui_value_upper_index.sub(ret.liquidity_sui_value_initial_index);









//     ret.quota_amount_a_initial = d(check_point_status.usdc_quota_in_wallet.add(check_point_status.usdc_quota_in_pos).toString());
//     ret.quota_amount_b_initial = d(check_point_status.sui_quota_in_wallet.add(check_point_status.sui_quota_in_pos).toString());
//     ret.quota_amount_a_lower_index = d(check_point_statu_after_add_liquidity.usdc_quota_in_wallet.add(new BN(ret.coin_amount_lower.coin_amount_a)).toString());
//     ret.quota_amount_b_lower_index = d(check_point_statu_after_add_liquidity.sui_quota_in_wallet.toString());
//     ret.quota_amount_a_upper_index = d(check_point_statu_after_add_liquidity.usdc_quota_in_wallet.toString());
//     ret.quota_amount_b_upper_index = d(check_point_statu_after_add_liquidity.sui_quota_in_wallet.add(new BN(ret.coin_amount_upper.coin_amount_b)).toString());


//     // initial price before swap, not add liquidity price
//     ret.quota_usdc_value_initial = ret.quota_amount_a_initial.mul(Decimal.pow(10, -6)).add(ret.quota_amount_b_initial.mul(Decimal.pow(10, -9)).mul(check_point_status.sui_price));
//     ret.quota_usdc_value_lower_index = ret.quota_amount_a_lower_index.mul(Decimal.pow(10, -6)).add(ret.quota_amount_b_lower_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index));
//     ret.quota_hold_usdc_value_lower_index = ret.quota_amount_a_initial.mul(Decimal.pow(10, -6)).add(ret.quota_amount_b_initial.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index));
//     ret.quota_usdc_value_upper_index = ret.quota_amount_a_upper_index.mul(Decimal.pow(10, -6)).add(ret.quota_amount_b_upper_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index));
//     ret.quota_hold_usdc_value_upper_index = ret.quota_amount_a_initial.mul(Decimal.pow(10, -6)).add(ret.quota_amount_b_initial.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index));


//     // initial price before swap, not add liquidity price
//     ret.quota_sui_value_initial = ret.quota_amount_a_initial.mul(Decimal.pow(10, -6)).mul(d(1).div(check_point_status.sui_price)).add(ret.quota_amount_b_initial.mul(Decimal.pow(10, -9)));
//     ret.quota_sui_value_lower_index = ret.quota_amount_a_lower_index.mul(Decimal.pow(10, -6)).mul(ret.usdc_price_lower_index).add(ret.quota_amount_b_lower_index.mul(Decimal.pow(10, -9)));
//     ret.quota_hold_sui_value_lower_index = ret.quota_amount_a_initial.mul(Decimal.pow(10, -6)).mul(ret.usdc_price_lower_index).add(ret.quota_amount_b_initial.mul(Decimal.pow(10, -9)));
//     ret.quota_sui_value_upper_index = ret.quota_amount_a_upper_index.mul(Decimal.pow(10, -6)).mul(ret.usdc_price_upper_index).add(ret.quota_amount_b_upper_index.mul(Decimal.pow(10, -9)));
//     ret.quota_hold_sui_value_upper_index = ret.quota_amount_a_initial.mul(Decimal.pow(10, -6)).mul(ret.usdc_price_upper_index).add(ret.quota_amount_b_initial.mul(Decimal.pow(10, -9)));




//     ret.quota_usdc_impermanent_loss_lower_index = ret.quota_usdc_value_lower_index.sub(ret.quota_hold_usdc_value_lower_index);
//     ret.quota_abs_usdc_impermanent_loss_lower_index = ret.quota_usdc_value_lower_index.sub(ret.quota_usdc_value_initial);

//     ret.quota_usdc_impermanent_loss_upper_index = ret.quota_usdc_value_upper_index.sub(ret.quota_hold_usdc_value_upper_index);
//     ret.quota_abs_usdc_impermanent_loss_upper_index = ret.quota_usdc_value_upper_index.sub(ret.quota_usdc_value_initial);


//     ret.quota_sui_impermanent_loss_lower_index = ret.quota_sui_value_lower_index.sub(ret.quota_hold_sui_value_lower_index);
//     ret.quota_abs_sui_impermanent_loss_lower_index = ret.quota_sui_value_lower_index.sub(ret.quota_sui_value_initial); 

//     ret.quota_sui_impermanent_loss_upper_index = ret.quota_sui_value_upper_index.sub(ret.quota_hold_sui_value_upper_index);
//     ret.quota_abs_sui_impermanent_loss_upper_index = ret.quota_sui_value_upper_index.sub(ret.quota_sui_value_initial); 



//     return ret;
// }
    










        // // Absolute Benifit Now
        // console.log('--------------------------------------------------------');
        // let quota_value_begin_in_initial_price = calcQuotaValue(check_point_status.sui_price, check_point_status);
        // let initial_amount_value_change = cur_quota_value_holding_both_coin_ab.total_quota_value.sub(quota_value_begin_in_initial_price.total_quota_value);
        // console.log('Init amount value change: ', initial_amount_value_change.toString());

        // let absolute_benifit = initial_amount_value_change.add(total_benefit);
        // console.log('Absolute Benifit: %s(%s%%)', absolute_benifit.toString(), absolute_benifit.div(quota_value_begin_in_initial_price.total_quota_value).mul(100));

        // let absolute_benifit_without_gas = initial_amount_value_change.add(total_benefit_without_gas);
        // console.log('Absolute Benifit(Without Gas): %s(%s%%)', absolute_benifit_without_gas.toString(), absolute_benifit_without_gas.div(quota_value_begin_in_initial_price.total_quota_value).mul(100));
     




// type ImpermanentLossCtx2 = {
//     sui_price_when_add_liquidity: Decimal;
//     sui_price_lower_index: Decimal;
//     sui_price_upper_index: Decimal;
//     coin_a_amount_lower_index: CoinAmounts;
//     coin_b_amount_upper_index: CoinAmounts;

//     initial_value: Decimal;
//     impermanent_value_lower_index: Decimal;
//     impermanent_value_upper_index: Decimal;
//     position_value_lower_index: Decimal;
//     position_value_upper_index: Decimal;
//     quota_value_lower_index: Decimal;
//     quota_value_upper_index: Decimal;

//     impermanent_loss_lower_index: Decimal;
//     impermanent_loss_upper_index: Decimal;
//     pos_value_loss_lower_index: Decimal;
//     pos_value_loss_upper_index: Decimal;
//     quota_value_loss_lower_index: Decimal;
//     quota_value_loss_upper_index: Decimal;
// };

// function newImpermanentLossCtx2(): ImpermanentLossCtx2 {
//     let ret: ImpermanentLossCtx2 = {
//         sui_price_when_add_liquidity: d(0),
//         sui_price_lower_index: d(0),
//         sui_price_upper_index: d(0),
//         coin_a_amount_lower_index: {coin_amount_a: '', coin_amount_b: ''},
//         coin_b_amount_upper_index: {coin_amount_a: '', coin_amount_b: ''},

//         initial_value: d(0),
//         impermanent_value_lower_index: d(0),
//         impermanent_value_upper_index: d(0),
//         position_value_lower_index: d(0),
//         position_value_upper_index: d(0),
//         quota_value_lower_index: d(0),
//         quota_value_upper_index: d(0),

//         impermanent_loss_lower_index: d(0),
//         impermanent_loss_upper_index: d(0),
//         pos_value_loss_lower_index: d(0),
//         pos_value_loss_upper_index: d(0),
//         quota_value_loss_lower_index: d(0),
//         quota_value_loss_upper_index: d(0)
//     };
//     return ret;
// }




// function getImpermanentLossCtx2(tick_lower_index: number, tick_when_add_liquidity: number, tick_upper_index: number, 
//     add_liqui_event: LiquidityEvent, check_point_status: CheckPointStatus,  check_point_statu_after_add_liquidity: CheckPointStatus): ImpermanentLossCtx2 {

//     let ret = newImpermanentLossCtx2();

//     ret.sui_price_when_add_liquidity = d(1).div(TickMath.tickIndexToPrice(tick_when_add_liquidity, 6, 9));
//     ret.sui_price_lower_index = d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9));
//     ret.sui_price_upper_index = d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9));

//     let amount_a_d = d(add_liqui_event.amount_a.toString());
//     let amount_b_d = d(add_liqui_event.amount_b.toString());



//     ret.initial_value = amount_a_d.mul(Decimal.pow(10, -6)).add(amount_b_d.mul(Decimal.pow(10, -9)).mul(ret.sui_price_when_add_liquidity));
//     ret.impermanent_value_lower_index = amount_a_d.mul(Decimal.pow(10, -6)).add(amount_b_d.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index));
//     ret.impermanent_value_upper_index = amount_a_d.mul(Decimal.pow(10, -6)).add(amount_b_d.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index));


//     ret.coin_a_amount_lower_index = ClmmPoolUtil.getCoinAmountFromLiquidity(add_liqui_event.after_liquidity, 
//         TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
//         TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
//         TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
//         false);

//     ret.coin_b_amount_upper_index = ClmmPoolUtil.getCoinAmountFromLiquidity(add_liqui_event.after_liquidity, 
//         TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
//         TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
//         TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
//         false);

//     ret.position_value_lower_index = Decimal(ret.coin_a_amount_lower_index.coin_amount_a).mul(Decimal.pow(10, -6));
//     ret.position_value_upper_index = Decimal(ret.coin_b_amount_upper_index.coin_amount_b).mul(Decimal.pow(10, -9).mul(ret.sui_price_upper_index));



//     let quota_value_begin_in_initial_price = calcQuotaValue(check_point_status.sui_price, check_point_status);
//     let check_point_statu_in_round  = { ...check_point_statu_after_add_liquidity };



//     ret.impermanent_loss_lower_index = ret.position_value_lower_index.sub(ret.impermanent_value_lower_index);
//     ret.impermanent_loss_upper_index = ret.position_value_upper_index.sub(ret.impermanent_value_upper_index);

//     ret.pos_value_loss_lower_index = ret.position_value_lower_index.sub(ret.initial_value);
//     ret.pos_value_loss_upper_index = ret.position_value_upper_index.sub(ret.initial_value);

//     return ret;
// }



