
import Decimal from 'decimal.js';
import BN from 'bn.js'
import * as fs from 'fs';
import * as util from 'util';
import * as sqlite3 from 'sqlite3';
import * as readline from "readline";

import { CoinBalance, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { CoinAssist, ClmmPoolUtil, TickMath, TickUtil,CoinAmounts , Percentage, adjustForSlippage ,MathUtil} from '@cetusprotocol/common-sdk';
import { d } from '@cetusprotocol/common-sdk';
import { CetusClmmSDK, Pool, Position, AddLiquidityFixTokenParams, 
    FetchPosRewardParams, FetchPosFeeParams, CollectFeesQuote, PosRewarderResult} from '@cetusprotocol/sui-clmm-sdk';
import { AggregatorClient, RouterData } from "@cetusprotocol/aggregator-sdk";

import * as sqlite3_utils from './sqlite3_utils';




const cetusClmmSDK = CetusClmmSDK.createSDK({});

const client = new AggregatorClient();









const MNEMONICS = '';  // your mnemonics
// Account 1, Account 2 .... of your wallet
const HD_WALLET_PATH = 'm\/44\'\/784\'\/0\'\/0\'\/0\'';
// const path = 'm\/44\'\/784\'\/1\'\/0\'\/0\''
// const path = 'm\/44\'\/784\'\/2\'\/0\'\/0\''








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













const POOL_ADDRESS = POOL_ADDRESS_USDC_SUI_0_05;
const POOL_ADDRESS_FOR_FEE = POOL_ADDRESS_USDC_CETUS_0_25;

const POOL_TICK_SPACING = POOL_TICK_SPACING_USDC_SUI_0_05;
const POOL_TICK_SPACING_TIMES: number = 6;



// const POOL_ADDRESS = POOL_ADDRESS_USDC_SUI_0_25;
// const POOL_ADDRESS_FOR_FEE = POOL_ADDRESS_USDC_CETUS_0_25;

// const POOL_TICK_SPACING = POOL_TICK_SPACING_USDC_SUI_0_25;
// const POOL_TICK_SPACING_TIMES: number = 2;



const POSITION_TICK_RANGE: number = POOL_TICK_SPACING * POOL_TICK_SPACING_TIMES;


const SLIPPAGE_AGGREGATOR_SWAP = 0.01
const SLIPPAGE_FOR_ADD_LIQUIDITY = 0.1



const SQLITE_DB_FILE_NAME = 'PositionInfo.db';

const MINER_CONFIG_FILE_NAME = 'miner_config.json';





const date = new Date();
const LOG_FILE_NAME = 'log_file_name_' + date.toISOString() + '.log';

function dumpSDKRet2Logfile(title: string, context: string) {
    date.setTime(Date.now())
    fs.appendFileSync(LOG_FILE_NAME, util.format('\n[%s] ===== %s =====\n', date.toLocaleString(), title));
    fs.appendFileSync(LOG_FILE_NAME, util.format(context));
    fs.appendFileSync(LOG_FILE_NAME, util.format('\n[%s] ===== %s End =====\n', date.toLocaleString(), title));
}















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

    if (coin_a_amount.ltn(0)) {
        coin_a_amount = new BN(0);
    }
    
    if (coin_b_amount.ltn(0)) {
        coin_b_amount = new BN(0);
    }

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
        if (rebalance_info.need_swap) {
            rebalance_info.a2b = false;
            rebalance_info.amount_in = coin_b_amount.clone();
            let coin_a_amount_with_decimals = Decimal(coin_b_amount.toString()).mul(Decimal.pow(10, -COIN_B_DECIMALS)).div(price);        
            rebalance_info.amount_out = new BN(coin_a_amount_with_decimals.mul(Decimal.pow(10, COIN_A_DECIMALS)).round().toString());
            rebalance_info.coin_a_amount_new = rebalance_info.amount_out.clone();
            rebalance_info.coin_b_amount_new = new BN(0);
        }
        
    } else if (current_tick_index >= tick_upper_index) {
        rebalance_info.valid = true;
        rebalance_info.need_swap = !coin_a_amount.eqn(0);
        if (rebalance_info.need_swap) {
            rebalance_info.a2b = true;
            rebalance_info.amount_in = coin_a_amount.clone();
            let coin_b_amount_with_decimals = Decimal(coin_a_amount.toString()).mul(Decimal.pow(10, -COIN_A_DECIMALS)).mul(price);  
            rebalance_info.amount_out = new BN(coin_b_amount_with_decimals.mul(Decimal.pow(10, COIN_B_DECIMALS)).round().toString());
            rebalance_info.coin_a_amount_new = new BN(0);
            rebalance_info.coin_b_amount_new = rebalance_info.amount_out.clone();
        }
        
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

        if (coin_a_amount.gt(coin_a_amount_new)) {
            rebalance_info.valid = true;
            rebalance_info.need_swap = true;
            rebalance_info.a2b = true;
            rebalance_info.amount_in = coin_a_amount.sub(coin_a_amount_new);
            rebalance_info.amount_out = coin_b_amount_new.sub(coin_b_amount);
        } else if (coin_a_amount.eq(coin_a_amount_new)) {
            rebalance_info.valid = true;
            rebalance_info.need_swap = false;
            rebalance_info.a2b = false;
            rebalance_info.amount_in = new BN(0);
            rebalance_info.amount_out = new BN(0);
        } else {
            rebalance_info.valid = true;
            rebalance_info.need_swap = true;
            rebalance_info.a2b = false;
            rebalance_info.amount_in = coin_b_amount.sub(coin_b_amount_new);
            rebalance_info.amount_out = coin_a_amount_new.sub(coin_a_amount);
        }

        rebalance_info.coin_a_amount_new = coin_a_amount_new.clone();
        rebalance_info.coin_b_amount_new = coin_b_amount_new.clone();
    }

    return rebalance_info;
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


function balanceNotChange(coin_amount_old: AllCoinAmounts, coin_amount_new: AllCoinAmounts): boolean {
    let coin_a_not_change = Decimal(coin_amount_old.usdc_amount).eq(d(coin_amount_new.usdc_amount));
    let coin_b_not_change = Decimal(coin_amount_old.sui_amount).eq(d(coin_amount_new.sui_amount));
    let cetus_not_change = Decimal(coin_amount_old.cetus_amount).eq(d(coin_amount_new.cetus_amount));
    return coin_a_not_change && coin_b_not_change && cetus_not_change;
}









type WalletBalanceValue = {
    usdc_value: Decimal;
    sui_value: Decimal;
    cetus_value: Decimal;
    total_value: Decimal;
};

function newWalletBalanceValue(): WalletBalanceValue {
    let ret: WalletBalanceValue = {
        usdc_value: d(0),
        sui_value: d(0),
        cetus_value: d(0),
        total_value: d(0)
    };
    return ret;
}



function calcBalanceValue(sui_price: Decimal, cetus_price: Decimal, check_point_status: CheckPointStatus): WalletBalanceValue {
    let ret = newWalletBalanceValue();
    ret.usdc_value = Decimal(check_point_status.usdc_balance.toString()).mul(Decimal.pow(10, -6));
    ret.sui_value = Decimal(check_point_status.sui_balance.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);
    ret.cetus_value = Decimal(check_point_status.cetus_balance.toString()).mul(Decimal.pow(10, -9)).mul(cetus_price);
    ret.total_value = ret.usdc_value.add(ret.sui_value).add(ret.cetus_value);
    return ret;
}

function calcLiquidityValue(sui_price: Decimal, check_point_status: CheckPointStatus): WalletBalanceValue {
    let ret = newWalletBalanceValue();
    ret.usdc_value = Decimal(check_point_status.usdc_in_liquidity.toString()).mul(Decimal.pow(10, -6));
    ret.sui_value = Decimal(check_point_status.sui_in_liquidity.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);
    ret.cetus_value = d(0);
    ret.total_value = ret.usdc_value.add(ret.sui_value).add(ret.cetus_value);
    return ret;
}

function calcBalanceLiquidityValue(sui_price: Decimal, cetus_price: Decimal, check_point_status: CheckPointStatus): WalletBalanceValue {
    let ret = newWalletBalanceValue();
    let total_usdc = check_point_status.usdc_balance.add(check_point_status.usdc_in_liquidity);
    ret.usdc_value = Decimal(total_usdc.toString()).mul(Decimal.pow(10, -6));

    let total_sui = check_point_status.sui_balance.add(check_point_status.sui_in_liquidity);
    ret.sui_value = Decimal(total_sui.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);

    let total_cetus = check_point_status.cetus_balance;
    ret.cetus_value = Decimal(total_cetus.toString()).mul(Decimal.pow(10, -9)).mul(cetus_price);

    ret.total_value = ret.usdc_value.add(ret.sui_value).add(ret.cetus_value);
    return ret;
}

function calcAllValue(sui_price: Decimal, cetus_price: Decimal, check_point_status: CheckPointStatus): WalletBalanceValue {
    let ret = newWalletBalanceValue();
    let total_usdc = check_point_status.usdc_balance.add(check_point_status.usdc_in_liquidity).add(check_point_status.usdc_fee);
    ret.usdc_value = Decimal(total_usdc.toString()).mul(Decimal.pow(10, -6));

    let total_sui = check_point_status.sui_balance.add(check_point_status.sui_in_liquidity).add(check_point_status.sui_fee).add(check_point_status.sui_rwd);
    ret.sui_value = Decimal(total_sui.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);

    let total_cetus = check_point_status.cetus_balance.add(check_point_status.cetus_rwd);
    ret.cetus_value = Decimal(total_cetus.toString()).mul(Decimal.pow(10, -9)).mul(cetus_price);

    ret.total_value = ret.usdc_value.add(ret.sui_value).add(ret.cetus_value);
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

function cloneFeeAndReward(ori: FeeAndReward): FeeAndReward {
    let ret: FeeAndReward = {
        fee_owned_a: ori.fee_owned_a.clone(),
        fee_owned_b: ori.fee_owned_b.clone(),
        rwd_owned_cetus: ori.rwd_owned_cetus.clone(),
        rwd_owned_sui: ori.rwd_owned_sui.clone()
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


export type TransactionInfo = {
    unix_timestamp_ms: number;
    type: string;  // 'merge_coin_usdc','merge_coin_sui','aggregator_swap', 'add_liquidity', 'close_position', 'merge_coin_cetus','cetus_aggregator_swap', 
    digest: string;
    total_gas_fee: BN;
    balance_change: BalanceChange;
    liquidity_event: LiquidityEvent;
    fee_and_reward: FeeAndReward;
}

export function newTransactionInfo():TransactionInfo  {
    let ret: TransactionInfo = {
        unix_timestamp_ms: 0,
        type: '',
        digest: '',
        total_gas_fee: new BN(0),
        balance_change: newBalanceChange(),
        liquidity_event: newLiquidityEvent(),
        fee_and_reward: newFeeAndReward()
    };
    return ret;
}

function cloneTransactionInfo(ori: TransactionInfo): TransactionInfo {
    let ret = {...ori};
    ret.total_gas_fee = ori.total_gas_fee.clone();
    ret.balance_change.usdc_change = ori.balance_change.usdc_change.clone();
    ret.balance_change.sui_change = ori.balance_change.sui_change.clone();
    ret.balance_change.cetus_change = ori.balance_change.cetus_change.clone();
    ret.fee_and_reward = cloneFeeAndReward(ori.fee_and_reward);
    ret.liquidity_event.after_liquidity = ori.liquidity_event.after_liquidity.clone();
    ret.liquidity_event.amount_a = ori.liquidity_event.amount_a.clone();
    ret.liquidity_event.amount_b = ori.liquidity_event.amount_b.clone();
    ret.liquidity_event.liquidity = ori.liquidity_event.liquidity.clone();
    ret.liquidity_event.pool = ori.liquidity_event.pool;
    ret.liquidity_event.position = ori.liquidity_event.position;
    return ret;
}

type TransactionInfoQueryOptions = {
    get_fee_and_rwd: boolean;
    get_balance_change: boolean;
    get_add_liquidity_event: boolean;
    get_remove_liquidity_event: boolean;
    get_total_gas_fee: boolean;
};










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

function getAddLiquidityEvent(rst: SuiTransactionBlockResponse): LiquidityEvent {
    let ret = newLiquidityEvent();
    if (rst.events?.length) {
        for (const event of rst.events) {
            if (event.type.endsWith('::pool::AddLiquidityEvent') || event.type.endsWith('::pool::AddLiquidityV2Event')) {
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
            if (event.type.endsWith('::pool::RemoveLiquidityEvent') || event.type.endsWith('::pool::RemoveLiquidityV2Event')) {
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

async function getTransactionInfo(digest: string, tx_info: TransactionInfo, tx_opt: TransactionInfoQueryOptions, sendKeypair: Ed25519Keypair) {
    while (true) {
        try {
            // const tx_rsp = await cetusClmmSDK.FullClient.getTransactionBlock({
            //     digest, 
            //     options: {
            //         showBalanceChanges: tx_opt.get_balance_change,
            //         showEffects: true, //  tx_opt.get_total_gas_fee and effects?.status.status
            //         showEvents: tx_opt.get_fee_and_rwd || tx_opt.get_add_liquidity_event || tx_opt.get_remove_liquidity_event,
            //         // showInput: true,
            //         // showObjectChanges: true,
            //         // showRawEffects: true,
            //         // showRawInput:true
            //     }
            // });
            const tx_rsp = await cetusClmmSDK.FullClient.waitForTransaction({
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
                console.log('%s [WARNNING] cetusClmmSDK.FullClient.getTransactionBlock: the retrieved tx is a failed tx(%s)', date.toLocaleString(), digest);
                // await new Promise(f => setTimeout(f, 2000));
                // continue;
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
    console.log('type: ', tx_info.type);
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














export type CheckPointStatus = {
    unix_timestamp_ms: number;
    type: string; // 'initial','after_swap', 'after_add_liquidity','after_close_position', 'after_post_process'
    cur_tick_index_for_tx: number;
    tick_lower_index_for_tx: number;
    tick_upper_index_for_tx: number;
    usdc_sui_tick_index: number;
    sui_price: Decimal;
    usdc_cetus_tick_index: number;
    cetus_price: Decimal;
    usdc_balance: BN;
    sui_balance: BN;
    cetus_balance: BN;
    usdc_in_liquidity: BN;
    sui_in_liquidity: BN;
    usdc_fee: BN;
    sui_fee: BN;
    sui_rwd: BN;
    cetus_rwd: BN;
};

export function newCheckPointStatus(): CheckPointStatus {
    let ret: CheckPointStatus = {
        unix_timestamp_ms: 0,
        type: '',
        cur_tick_index_for_tx: 0,
        tick_lower_index_for_tx: 0,
        tick_upper_index_for_tx: 0,
        usdc_sui_tick_index: 0,
        sui_price: d(0),
        usdc_cetus_tick_index: 0,
        cetus_price: d(0),
        usdc_balance: new BN(0),
        sui_balance: new BN(0),
        cetus_balance: new BN(0),
        usdc_in_liquidity: new BN(0),
        sui_in_liquidity: new BN(0),
        usdc_fee: new BN(0),
        sui_fee: new BN(0),
        sui_rwd: new BN(0),
        cetus_rwd: new BN(0)
    };
    return ret;
}

function cloneCheckPointStatus(ori: CheckPointStatus): CheckPointStatus {
    let ret: CheckPointStatus = {
        unix_timestamp_ms: ori.unix_timestamp_ms,
        type: ori.type,
        cur_tick_index_for_tx: ori.cur_tick_index_for_tx,
        tick_lower_index_for_tx: ori.tick_lower_index_for_tx,
        tick_upper_index_for_tx: ori.tick_upper_index_for_tx,
        usdc_sui_tick_index: ori.usdc_sui_tick_index,
        sui_price: new Decimal(ori.sui_price),
        usdc_cetus_tick_index: ori.usdc_cetus_tick_index,
        cetus_price: new Decimal(ori.cetus_price),
        usdc_balance: ori.usdc_balance.clone(),
        sui_balance: ori.sui_balance.clone(),
        cetus_balance: ori.cetus_balance.clone(),
        usdc_in_liquidity: ori.usdc_in_liquidity.clone(),
        sui_in_liquidity: ori.sui_in_liquidity.clone(),
        usdc_fee: ori.usdc_fee.clone(),
        sui_fee: ori.sui_fee.clone(),
        sui_rwd: ori.sui_rwd.clone(),
        cetus_rwd: ori.cetus_rwd.clone()
    };
    return ret;
}

function dumpCheckPoint(check_point_status: CheckPointStatus) {
    console.log('Timestamp: ', new Date(check_point_status.unix_timestamp_ms).toLocaleString());
    console.log('Type: ', check_point_status.type);
    console.log('Current Tick Index (for Transaction if exist): ', check_point_status.cur_tick_index_for_tx);
    console.log('Tick Lower Index (for Transaction if exist): ', check_point_status.tick_lower_index_for_tx);
    console.log('Tick Upper Index (for Transaction if exist): ', check_point_status.tick_upper_index_for_tx);
    console.log('USDC-SUI Tick Index: ', check_point_status.usdc_sui_tick_index);
    console.log('SUI Price: ', check_point_status.sui_price);
    console.log('USDC-CETUS Tick Index: ', check_point_status.usdc_cetus_tick_index);
    console.log('CETUS Price: ', check_point_status.cetus_price);
    console.log('USDC Balance: ', check_point_status.usdc_balance.toString());
    console.log('SUI Balance: ', check_point_status.sui_balance.toString());
    console.log('CETUS Balance: ', check_point_status.cetus_balance.toString());
    console.log('USDC in Liquidity: ', check_point_status.usdc_in_liquidity.toString());
    console.log('SUI in Liquidity: ', check_point_status.sui_in_liquidity.toString());
    console.log('USDC Fee: ', check_point_status.usdc_fee.toString());
    console.log('SUI Fee: ', check_point_status.sui_fee.toString());
    console.log('SUI Reward: ', check_point_status.sui_rwd.toString());
    console.log('CETUS Reward: ', check_point_status.cetus_rwd.toString());
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

    sui_price_initial: Decimal;
    cetus_price_initial: Decimal;
    cetus_price_when_add_liquidity: Decimal;
    cetus_price_lower_index_est: Decimal;
    cetus_price_upper_index_est: Decimal;

    coin_amount_lower: CoinAmounts;
    coin_amount_upper: CoinAmounts;


    liquidity_amount_usdc_when_add_liquidity: Decimal;
    liquidity_amount_sui_when_add_liquidity: Decimal;
    liquidity_value_when_add_liquidity: Decimal;

    liquidity_amount_usdc_lower_index: Decimal;
    liquidity_amount_sui_lower_index: Decimal;
    liquidity_value_lower_index: Decimal;
    liquidity_value_lower_index_if_hold_all: Decimal;
    liquidity_value_lower_index_if_hold_usdc: Decimal;
    liquidity_value_lower_index_if_hold_sui: Decimal;
    liquidity_impermanent_loss_lower_index_if_hold_all: Decimal;
    liquidity_impermanent_loss_lower_index_if_hold_usdc: Decimal;
    liquidity_impermanent_loss_lower_index_if_hold_sui: Decimal;

    liquidity_amount_usdc_upper_index: Decimal;
    liquidity_amount_sui_upper_index: Decimal;
    liquidity_value_upper_index: Decimal;
    liquidity_value_upper_index_if_hold_all: Decimal;
    liquidity_value_upper_index_if_hold_usdc: Decimal;
    liquidity_value_upper_index_if_hold_sui: Decimal;
    liquidity_impermanent_loss_upper_index_if_hold_all: Decimal;
    liquidity_impermanent_loss_upper_index_if_hold_usdc: Decimal;
    liquidity_impermanent_loss_upper_index_if_hold_sui: Decimal;




    all_amount_usdc_initial: Decimal;
    all_amount_sui_initial: Decimal;
    all_amount_cetus_initial: Decimal;
    all_value_initial: Decimal;

    all_amount_usdc_lower_index: Decimal;
    all_amount_sui_lower_index: Decimal;
    all_amount_cetus_lower_index: Decimal;
    all_value_lower_index: Decimal;
    all_value_lower_index_if_hold_all: Decimal;
    all_value_lower_index_if_hold_usdc: Decimal;
    all_value_lower_index_if_hold_sui: Decimal;
    all_impermanent_loss_lower_index_if_hold_all: Decimal;
    all_impermanent_loss_lower_index_if_hold_usdc: Decimal;
    all_impermanent_loss_lower_index_if_hold_sui: Decimal;

    all_amount_usdc_upper_index: Decimal;
    all_amount_sui_upper_index: Decimal;
    all_amount_cetus_upper_index: Decimal;
    all_value_upper_index: Decimal;
    all_value_upper_index_if_hold_all: Decimal;
    all_value_upper_index_if_hold_usdc: Decimal;
    all_value_upper_index_if_hold_sui: Decimal;
    all_impermanent_loss_upper_index_if_hold_all: Decimal;
    all_impermanent_loss_upper_index_if_hold_usdc: Decimal;
    all_impermanent_loss_upper_index_if_hold_sui: Decimal;
};


function newImpermanentLossCtx(): ImpermanentLossCtx {
    let ret: ImpermanentLossCtx = {
        sui_price_when_add_liquidity: d(0),
        sui_price_lower_index: d(0),
        sui_price_upper_index: d(0),

        sui_price_initial: d(0),
        cetus_price_initial: d(0),

        cetus_price_when_add_liquidity: d(0),
        cetus_price_lower_index_est: d(0),
        cetus_price_upper_index_est: d(0),

        coin_amount_lower: {coin_amount_a: '', coin_amount_b: ''},
        coin_amount_upper: {coin_amount_a: '', coin_amount_b: ''},


        liquidity_amount_usdc_when_add_liquidity: d(0),
        liquidity_amount_sui_when_add_liquidity: d(0),
        liquidity_value_when_add_liquidity: d(0),

        liquidity_amount_usdc_lower_index: d(0),
        liquidity_amount_sui_lower_index: d(0),
        liquidity_value_lower_index: d(0),
        liquidity_value_lower_index_if_hold_all: d(0),
        liquidity_value_lower_index_if_hold_usdc: d(0),
        liquidity_value_lower_index_if_hold_sui: d(0),
        liquidity_impermanent_loss_lower_index_if_hold_all: d(0),
        liquidity_impermanent_loss_lower_index_if_hold_usdc: d(0),
        liquidity_impermanent_loss_lower_index_if_hold_sui: d(0),

        liquidity_amount_usdc_upper_index: d(0),
        liquidity_amount_sui_upper_index: d(0),
        liquidity_value_upper_index: d(0),
        liquidity_value_upper_index_if_hold_all: d(0),
        liquidity_value_upper_index_if_hold_usdc: d(0),
        liquidity_value_upper_index_if_hold_sui: d(0),
        liquidity_impermanent_loss_upper_index_if_hold_all: d(0),
        liquidity_impermanent_loss_upper_index_if_hold_usdc: d(0),
        liquidity_impermanent_loss_upper_index_if_hold_sui: d(0),

        all_amount_usdc_initial: d(0),
        all_amount_sui_initial: d(0),
        all_amount_cetus_initial: d(0),
        all_value_initial: d(0),

        all_amount_usdc_lower_index: d(0),
        all_amount_sui_lower_index: d(0),
        all_amount_cetus_lower_index: d(0),
        all_value_lower_index: d(0),
        all_value_lower_index_if_hold_all:d(0),
        all_value_lower_index_if_hold_usdc: d(0),
        all_value_lower_index_if_hold_sui: d(0),
        all_impermanent_loss_lower_index_if_hold_all: d(0),
        all_impermanent_loss_lower_index_if_hold_usdc: d(0),
        all_impermanent_loss_lower_index_if_hold_sui: d(0),

        all_amount_usdc_upper_index: d(0),
        all_amount_sui_upper_index: d(0),
        all_amount_cetus_upper_index: d(0),
        all_value_upper_index: d(0),
        all_value_upper_index_if_hold_all: d(0),
        all_value_upper_index_if_hold_usdc: d(0),
        all_value_upper_index_if_hold_sui: d(0),
        all_impermanent_loss_upper_index_if_hold_all: d(0),
        all_impermanent_loss_upper_index_if_hold_usdc: d(0),
        all_impermanent_loss_upper_index_if_hold_sui: d(0)
    };
    return ret;
}


function getImpermanentLossCtx(tick_lower_index: number, tick_when_add_liquidity: number, tick_upper_index: number, 
    add_liqui_event: LiquidityEvent, check_point_status: CheckPointStatus,  check_point_statu_after_add_liquidity: CheckPointStatus): ImpermanentLossCtx {

    let ret = newImpermanentLossCtx();

    ret.sui_price_when_add_liquidity = d(1).div(TickMath.tickIndexToPrice(tick_when_add_liquidity, 6, 9));
    ret.sui_price_lower_index = d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9));
    ret.sui_price_upper_index = d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9));

    ret.sui_price_initial = check_point_status.sui_price;
    ret.cetus_price_initial = check_point_status.cetus_price;

    ret.cetus_price_when_add_liquidity = d(1).div(TickMath.tickIndexToPrice(check_point_statu_after_add_liquidity.usdc_cetus_tick_index, 6, 9))
    ret.cetus_price_lower_index_est = ret.sui_price_lower_index.mul(ret.cetus_price_when_add_liquidity).div(ret.sui_price_when_add_liquidity);
    ret.cetus_price_upper_index_est = ret.sui_price_upper_index.mul(ret.cetus_price_when_add_liquidity).div(ret.sui_price_when_add_liquidity);

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


    ret.liquidity_amount_usdc_when_add_liquidity = d(add_liqui_event.amount_a.toString());
    ret.liquidity_amount_sui_when_add_liquidity = d(add_liqui_event.amount_b.toString());
    ret.liquidity_value_when_add_liquidity = ret.liquidity_amount_usdc_when_add_liquidity.mul(Decimal.pow(10, -6)).add(
        ret.liquidity_amount_sui_when_add_liquidity.mul(Decimal.pow(10, -9)).mul(ret.sui_price_when_add_liquidity)
    );


    ret.liquidity_amount_usdc_lower_index = d(ret.coin_amount_lower.coin_amount_a);
    ret.liquidity_amount_sui_lower_index = d(0);
    ret.liquidity_value_lower_index = ret.liquidity_amount_usdc_lower_index.mul(Decimal.pow(10, -6));

    ret.liquidity_value_lower_index_if_hold_all = ret.liquidity_amount_usdc_when_add_liquidity.mul(Decimal.pow(10, -6)).add(
        ret.liquidity_amount_sui_when_add_liquidity.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index)
    );
    ret.liquidity_value_lower_index_if_hold_usdc = ret.liquidity_value_when_add_liquidity;
    ret.liquidity_value_lower_index_if_hold_sui = ret.liquidity_value_when_add_liquidity.div(ret.sui_price_when_add_liquidity).mul(ret.sui_price_lower_index);

    ret.liquidity_impermanent_loss_lower_index_if_hold_all = ret.liquidity_value_lower_index.sub(ret.liquidity_value_lower_index_if_hold_all);
    ret.liquidity_impermanent_loss_lower_index_if_hold_usdc = ret.liquidity_value_lower_index.sub(ret.liquidity_value_lower_index_if_hold_usdc);
    ret.liquidity_impermanent_loss_lower_index_if_hold_sui = ret.liquidity_value_lower_index.sub(ret.liquidity_value_lower_index_if_hold_sui);


    ret.liquidity_amount_usdc_upper_index = d(0);
    ret.liquidity_amount_sui_upper_index = d(ret.coin_amount_upper.coin_amount_b);
    ret.liquidity_value_upper_index = ret.liquidity_amount_sui_upper_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index);
    ret.liquidity_value_upper_index_if_hold_all = ret.liquidity_amount_usdc_when_add_liquidity.mul(Decimal.pow(10, -6)).add(
        ret.liquidity_amount_sui_when_add_liquidity.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index)
    );
    ret.liquidity_value_upper_index_if_hold_usdc = ret.liquidity_value_when_add_liquidity;
    ret.liquidity_value_upper_index_if_hold_sui = ret.liquidity_value_when_add_liquidity.div(ret.sui_price_when_add_liquidity).mul(ret.sui_price_upper_index);
    ret.liquidity_impermanent_loss_upper_index_if_hold_all = ret.liquidity_value_upper_index.sub(ret.liquidity_value_upper_index_if_hold_all);
    ret.liquidity_impermanent_loss_upper_index_if_hold_usdc = ret.liquidity_value_upper_index.sub(ret.liquidity_value_upper_index_if_hold_usdc);
    ret.liquidity_impermanent_loss_upper_index_if_hold_sui = ret.liquidity_value_upper_index.sub(ret.liquidity_value_upper_index_if_hold_sui);





    ret.all_amount_usdc_initial = d(check_point_status.usdc_balance.toString());
    ret.all_amount_sui_initial = d(check_point_status.sui_balance.toString());
    ret.all_amount_cetus_initial = d(check_point_status.cetus_balance.toString());
    ret.all_value_initial = ret.all_amount_usdc_initial.mul(Decimal.pow(10, -6)).add(
        ret.all_amount_sui_initial.mul(Decimal.pow(10, -9)).mul(ret.sui_price_initial)).add(
        ret.all_amount_cetus_initial.mul(Decimal.pow(10, -9)).mul(ret.cetus_price_initial)
    );


    ret.all_amount_usdc_lower_index = d(check_point_statu_after_add_liquidity.usdc_balance.add(new BN(ret.coin_amount_lower.coin_amount_a)).toString());
    ret.all_amount_sui_lower_index = d(check_point_statu_after_add_liquidity.sui_balance.toString());
    ret.all_amount_cetus_lower_index = d(check_point_statu_after_add_liquidity.cetus_balance.toString());

    ret.all_value_lower_index = ret.all_amount_usdc_lower_index.mul(Decimal.pow(10, -6)).add(
        ret.all_amount_sui_lower_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index)).add(
        ret.all_amount_cetus_lower_index.mul(Decimal.pow(10, -9)).mul(ret.cetus_price_lower_index_est));

    ret.all_value_lower_index_if_hold_all = ret.all_amount_usdc_initial.mul(Decimal.pow(10, -6)).add(
        ret.all_amount_sui_initial.mul(Decimal.pow(10, -9)).mul(ret.sui_price_lower_index)).add(
        ret.all_amount_cetus_lower_index.mul(Decimal.pow(10, -9)).mul(ret.cetus_price_lower_index_est));
    ret.all_value_lower_index_if_hold_usdc = ret.all_value_initial;
    ret.all_value_lower_index_if_hold_sui = ret.all_value_initial.div(ret.sui_price_initial).mul(ret.sui_price_lower_index);

    ret.all_impermanent_loss_lower_index_if_hold_all = ret.all_value_lower_index.sub(ret.all_value_lower_index_if_hold_all);
    ret.all_impermanent_loss_lower_index_if_hold_usdc = ret.all_value_lower_index.sub(ret.all_value_lower_index_if_hold_usdc);
    ret.all_impermanent_loss_lower_index_if_hold_sui = ret.all_value_lower_index.sub(ret.all_value_lower_index_if_hold_sui);


    ret.all_amount_usdc_upper_index = d(check_point_statu_after_add_liquidity.usdc_balance.toString());
    ret.all_amount_sui_upper_index = d(check_point_statu_after_add_liquidity.sui_balance.add(new BN(ret.coin_amount_upper.coin_amount_b)).toString());
    ret.all_amount_cetus_upper_index = d(check_point_statu_after_add_liquidity.cetus_balance.toString());

    ret.all_value_upper_index = ret.all_amount_usdc_upper_index.mul(Decimal.pow(10, -6)).add(
        ret.all_amount_sui_upper_index.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index)).add(
        ret.all_amount_cetus_upper_index.mul(Decimal.pow(10, -9)).mul(ret.cetus_price_upper_index_est));

    ret.all_value_upper_index_if_hold_all = ret.all_amount_usdc_initial.mul(Decimal.pow(10, -6)).add(
        ret.all_amount_sui_initial.mul(Decimal.pow(10, -9)).mul(ret.sui_price_upper_index)).add(
        ret.all_amount_cetus_initial.mul(Decimal.pow(10, -9)).mul(ret.cetus_price_upper_index_est));

    ret.all_value_upper_index_if_hold_usdc = ret.all_value_initial;
    ret.all_value_upper_index_if_hold_sui = ret.all_value_initial.div(ret.sui_price_initial).mul(ret.sui_price_upper_index);

    ret.all_impermanent_loss_upper_index_if_hold_all = ret.all_value_upper_index.sub(ret.all_value_upper_index_if_hold_all);
    ret.all_impermanent_loss_upper_index_if_hold_usdc = ret.all_value_upper_index.sub(ret.all_value_upper_index_if_hold_usdc);
    ret.all_impermanent_loss_upper_index_if_hold_sui = ret.all_value_upper_index.sub(ret.all_value_upper_index_if_hold_sui);

    return ret;
}

function dumpImpermanentLossAndEarningRatio(impermanent_loss_ctx: ImpermanentLossCtx, fee_and_reward_value_lower_index: FeeAndRewardValue, fee_and_reward_value_upper_index: FeeAndRewardValue) {

    console.log('impermanent_loss(liquidity, lower_index, 2 hold both): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_lower_index_if_hold_all.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_lower_index_if_hold_all).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(liquidity, lower_index, 2 hold usdc): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_lower_index_if_hold_usdc.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_lower_index_if_hold_usdc).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(liquidity, lower_index, 2 hold sui): %s(fee_rwd) / %s(imper_los), %s%% <=', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_lower_index_if_hold_sui.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_lower_index_if_hold_sui).mul(100).abs().toFixed(6)
    );



    console.log('impermanent_loss(liquidity, upper_index, 2 hold both): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_upper_index_if_hold_all.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_upper_index_if_hold_all).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(liquidity, upper_index, 2 hold usdc): %s(fee_rwd) / %s(imper_los), %s%% <=', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_upper_index_if_hold_usdc.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_upper_index_if_hold_usdc).mul(100).abs().toFixed(6)
    );

    console.log('impermanent_loss(liquidity, upper_index, 2 hold sui): %s(fee_rwd) / %s(imper_los), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.liquidity_impermanent_loss_upper_index_if_hold_sui.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.liquidity_impermanent_loss_upper_index_if_hold_sui).mul(100).abs().toFixed(6)
    );


    console.log('');


    console.log('delta(balance + liquidity, lower_index, 2 hold all): %s(fee_rwd) / %s(delta), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.all_impermanent_loss_lower_index_if_hold_all.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.all_impermanent_loss_lower_index_if_hold_all).mul(100).abs().toFixed(6)
    );

    console.log('delta(balance + liquidity, lower_index, 2 hold usdc): %s(fee_rwd) / %s(delta), %s%%', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.all_impermanent_loss_lower_index_if_hold_usdc.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.all_impermanent_loss_lower_index_if_hold_usdc).mul(100).abs().toFixed(6)
    );

    console.log('delta(balance + liquidity, lower_index, 2 hold sui): %s(fee_rwd) / %s(delta), %s%% <=', 
        fee_and_reward_value_lower_index.total_value.toFixed(6),
        impermanent_loss_ctx.all_impermanent_loss_lower_index_if_hold_sui.toFixed(6),
        fee_and_reward_value_lower_index.total_value.div(impermanent_loss_ctx.all_impermanent_loss_lower_index_if_hold_sui).mul(100).abs().toFixed(6)
    );

    console.log('delta(balance + liquidity, upper_index, 2 hold all): %s(fee_rwd) / %s(delta), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.all_impermanent_loss_upper_index_if_hold_all.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.all_impermanent_loss_upper_index_if_hold_all).mul(100).abs().toFixed(6)
    );   

    console.log('delta(balance + liquidity, upper_index, 2 hold usdc): %s(fee_rwd) / %s(delta), %s%% <=', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.all_impermanent_loss_upper_index_if_hold_usdc.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.all_impermanent_loss_upper_index_if_hold_usdc).mul(100).abs().toFixed(6)
    );    

    console.log('delta(balance + liquidity, upper_index, 2 hold sui): %s(fee_rwd) / %s(delta), %s%%', 
        fee_and_reward_value_upper_index.total_value.toFixed(6),
        impermanent_loss_ctx.all_impermanent_loss_upper_index_if_hold_sui.toFixed(6),
        fee_and_reward_value_upper_index.total_value.div(impermanent_loss_ctx.all_impermanent_loss_upper_index_if_hold_sui).mul(100).abs().toFixed(6)
    );
}




























// function dumpTransactionStatistics(title: string, check_point_status_old: CheckPointStatus, check_point_status_new: CheckPointStatus, 
//         sui_price: Decimal, digest: string, total_gas_fee: BN, balance_change: BalanceChange) {
//     console.log(' ========== %s ========== ', title);
//     console.log('Digest: ', digest);  

//     console.log('USDC %s => %s, balance_change: %s, balance_change(rsp): %s', 
//         check_point_status_old.usdc_balance.toString(),
//         check_point_status_new.usdc_balance.toString(),
//         check_point_status_new.usdc_balance.sub(check_point_status_old.usdc_balance).toString(),
//         balance_change.usdc_change.toString());

//     console.log('SUI %s => %s, balance_change: %s, balance_change(rsp): %s', 
//         check_point_status_old.sui_balance.toString(),
//         check_point_status_new.sui_balance.toString(),
//         check_point_status_new.sui_balance.sub(check_point_status_old.sui_balance).toString(),
//         balance_change.sui_change.toString());

//     console.log('CETUS %s => %s, balance_change: %s, balance_change(rsp): %s', 
//         check_point_status_old.cetus_balance.toString(),
//         check_point_status_new.cetus_balance.toString(),
//         check_point_status_new.cetus_balance.sub(check_point_status_old.cetus_balance).toString(),
//         balance_change.cetus_change.toString());

//     console.log('USDC Quota in Wallet %s => %s, delta: %s', 
//         check_point_status_old.usdc_quota_in_wallet.toString(),
//         check_point_status_new.usdc_quota_in_wallet.toString(),
//         check_point_status_new.usdc_quota_in_wallet.sub(check_point_status_old.usdc_quota_in_wallet).toString());

//     console.log('SUI Quota in Wallet %s => %s, delta: %s', 
//         check_point_status_old.sui_quota_in_wallet.toString(),
//         check_point_status_new.sui_quota_in_wallet.toString(),
//         check_point_status_new.sui_quota_in_wallet.sub(check_point_status_old.sui_quota_in_wallet).toString());

//     console.log('USDC Quota in Position %s => %s, delta: %s', 
//         check_point_status_old.usdc_quota_in_pos.toString(),
//         check_point_status_new.usdc_quota_in_pos.toString(),
//         check_point_status_new.usdc_quota_in_pos.sub(check_point_status_old.usdc_quota_in_pos).toString());

//     console.log('SUI Quota in Position %s => %s, delta: %s', 
//         check_point_status_old.sui_quota_in_pos.toString(),
//         check_point_status_new.sui_quota_in_pos.toString(),
//         check_point_status_new.sui_quota_in_pos.sub(check_point_status_old.sui_quota_in_pos).toString());


//     console.log('');
//     console.log('Lost : ');
//     console.log('Total Gas Fee : ', total_gas_fee.neg().toString());


//     console.log('');
//     console.log('SUI Price: ', sui_price);
//     let quota_value_old = calcQuotaValue(sui_price, check_point_status_old);
//     let quota_value_new = calcQuotaValue(sui_price, check_point_status_new);
    
//     console.log('Total Quota Value before: ', quota_value_old.total_quota_value);
//     console.log('Total Quota Value after : ', quota_value_new.total_quota_value);
//     console.log('Delta(Relative Loss):');
//     console.log(quota_value_new.total_quota_value.sub(quota_value_old.total_quota_value));

//     console.log('');
//     let total_gas_fee_in_decimals = Decimal(total_gas_fee.neg().toString()).mul(Decimal.pow(10, -9));
//     let total_gas_fee_value = total_gas_fee_in_decimals.mul(sui_price);
//     console.log('Gas: %s(%s * SUI Price)', total_gas_fee_value, total_gas_fee_in_decimals);

//     console.log(' ========== %s End ========== ', title);
// }








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

function clonePositionInfo(ori: PositionInfo): PositionInfo {
    let ret = {...ori};
    ret.total_gas_used = ori.total_gas_used.clone();
    ret.fee_coin_a = ori.fee_coin_a.clone();
    ret.fee_coin_b = ori.fee_coin_b.clone();
    ret.rwd_sui = ori.rwd_sui.clone();
    ret.rwd_cetus = ori.rwd_cetus.clone();
    ret.benefit_holding_coin_ab = new Decimal(ori.benefit_holding_coin_ab);
    ret.benefit_holding_coin_a = new Decimal(ori.benefit_holding_coin_a);
    ret.benefit_holding_coin_b = new Decimal(ori.benefit_holding_coin_b);
    return ret;
}

type PositionInfoHistoryStatistics = {
    total_gas_used: BN;
    fee_coin_a: BN; 
    fee_coin_b: BN; 
    rwd_sui: BN; 
    rwd_cetus: BN;
    benefit_holding_coin_ab: Decimal; 
    benefit_holding_coin_a: Decimal; 
    benefit_holding_coin_b: Decimal; 
};


function newPositionInfoHistoryStatistics(): PositionInfoHistoryStatistics {
    let ret: PositionInfoHistoryStatistics = {
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
    fee_and_rwd: FeeAndReward;
    fee_and_rwd_value: FeeAndRewardValue;

    balance_liquidity_value_initial: Decimal;
    balance_liquidity_value_now: Decimal;

    all_value_initial: Decimal;
    all_value_now: Decimal;
    all_value_now_if_hold_all: Decimal;
    all_value_now_if_hold_usdc: Decimal;
    all_value_now_if_hold_sui: Decimal;

    benefit_now_if_hold_all: Decimal;
    benefit_now_if_hold_usdc: Decimal;
    benefit_now_if_hold_sui: Decimal;
};

function newBenefitStatisticsCtx() {
    let ret: BenefitStatisticsCtx = {
        total_gas_fee: new BN(0),
        total_gas_fee_value: d(0),
        fee_and_rwd: newFeeAndReward(),
        fee_and_rwd_value: newFeeAndRewardValue(),

        balance_liquidity_value_initial: d(0),
        balance_liquidity_value_now: d(0),

        all_value_initial: d(0),
        all_value_now: d(0),
        all_value_now_if_hold_all: d(0),
        all_value_now_if_hold_usdc: d(0),
        all_value_now_if_hold_sui: d(0),

        benefit_now_if_hold_all: d(0),
        benefit_now_if_hold_usdc: d(0),
        benefit_now_if_hold_sui: d(0)
    };
    return ret;
}


function dumpBenefitStatistics(benefit_stat: BenefitStatisticsCtx) {
    let liquidity_balance_delta = benefit_stat.balance_liquidity_value_now.sub(benefit_stat.balance_liquidity_value_initial)
    console.log('Balance and Liquidity Value delta: %s (include Total Gas Used: %s, Value Earnings(Current Price): %s)', 
        liquidity_balance_delta, 
        benefit_stat.total_gas_fee.toString(),
        benefit_stat.total_gas_fee_value.neg().toString()
    );
    console.log('Fee and Reward Value(Current Price): %s', benefit_stat.fee_and_rwd_value.total_value);

    // Relative Benifit Now   

    console.log('Benifit 2 Holding USDC (From Position Begin): %s', benefit_stat.benefit_now_if_hold_usdc);
    console.log('Benifit 2 Holding SUI (From Position Begin): %s ', benefit_stat.benefit_now_if_hold_sui);
    console.log('Benifit 2 Holding all (From Position Begin): %s',  benefit_stat.benefit_now_if_hold_all);

    // let total_benefit_without_gas = benefit_stat.benefit_now_if_hold_all.sub(benefit_stat.total_gas_fee_value.neg());
    // console.log('Benifit(2 Holding All, Without Gas): %s (%s%%)', 
    //     total_benefit_without_gas, 
    //     total_benefit_without_gas.div(benefit_stat.all_balance_value_initial).mul(100));    

    // let total_benefit_holding_only_a_without_gas = benefit_stat.benefit_now_if_hold_usdc.sub(benefit_stat.total_gas_fee_value.neg());
    // console.log('Benifit(2 Holding USDC, Without Gas): %s (%s%%)', 
    //     total_benefit_holding_only_a_without_gas, 
    //     total_benefit_holding_only_a_without_gas.div(benefit_stat.all_balance_value_initial).mul(100));    

    // let total_benefit_holding_only_b_without_gas = benefit_stat.benefit_now_if_hold_sui.sub(benefit_stat.total_gas_fee_value.neg());
    // console.log('Benifit(2 Holding SUI, Without Gas): %s (%s%%)', 
    //     total_benefit_holding_only_b_without_gas, 
    //     total_benefit_holding_only_b_without_gas.div(benefit_stat.all_balance_value_initial).mul(100));

    // let total_benefit = benefit_stat.total_gas_fee_value.neg().add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_both_coin_ab);
    // console.log('Benifit(2 Holding Both Coin ab): %s (%s%%)', 
    //     total_benefit, 
    //     total_benefit.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));

    // let total_benefit_holding_only_a = benefit_stat.total_gas_fee_value.neg().add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_only_coin_a);
    // console.log('Benifit(2 Holding Only Coin a): %s (%s%%)', 
    //     total_benefit_holding_only_a, 
    //     total_benefit_holding_only_a.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));

    // let total_benefit_holding_only_b = benefit_stat.total_gas_fee_value.neg().add(benefit_stat.fee_and_rwd_value.total_value).add(benefit_stat.inpermanent_loss_with_holding_only_coin_b);
    // console.log('Benifit(2 Holding Only Coin b): %s (%s%%)', 
    //     total_benefit_holding_only_b, 
    //     total_benefit_holding_only_b.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));

    // let total_benefit_without_gas = benefit_stat.fee_and_rwd_value.total_value.add(benefit_stat.inpermanent_loss_with_holding_both_coin_ab);
    // console.log('Benifit(2 Holding Both Coin ab, Without Gas): %s (%s%%)', 
    //     total_benefit_without_gas, 
    //     total_benefit_without_gas.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));    

    // let total_benefit_holding_only_a_without_gas = benefit_stat.fee_and_rwd_value.total_value.add(benefit_stat.inpermanent_loss_with_holding_only_coin_a);
    // console.log('Benifit(2 Holding Only Coin a, Without Gas): %s (%s%%)', 
    //     total_benefit_holding_only_a_without_gas, 
    //     total_benefit_holding_only_a_without_gas.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));    

    // let total_benefit_holding_only_b_without_gas = benefit_stat.fee_and_rwd_value.total_value.add(benefit_stat.inpermanent_loss_with_holding_only_coin_b);
    // console.log('Benifit(2 Holding Only Coin b, Without Gas): %s (%s%%)', 
    //     total_benefit_holding_only_b_without_gas, 
    //     total_benefit_holding_only_b_without_gas.div(benefit_stat.init_quota_value_at_the_beginning.total_quota_value).mul(100));

    // let quota_value_in_pos = benefit_stat.cur_quota_value_now.usdc_quota_in_pos_value.add(benefit_stat.cur_quota_value_now.sui_quota_in_pos_value);
    // console.log('Quota Value(in pos / all / percentage): %s / %s / %s%%', 
    //     quota_value_in_pos,
    //     benefit_stat.cur_quota_value_now.total_quota_value.toString(),
    //     quota_value_in_pos.div(benefit_stat.cur_quota_value_now.total_quota_value).mul(100)
    // );
    // console.log('Total Value Loss Now: %s, FeeRwd Value Now: %s', 
    //     benefit_stat.inpermanent_loss_with_holding_only_coin_a.add(benefit_stat.total_gas_fee_value.neg()).toString(),
    //     benefit_stat.fee_and_rwd_value.total_value.toString()
    // );
}



function dumpBenefitStatisticsHistory(benefit_stat: BenefitStatisticsCtx, 
        position_info_history_stat: PositionInfoHistoryStatistics, 
        check_point_status_first: CheckPointStatus, 
        sui_price: Decimal, 
        cetus_price: Decimal) {
    let total_gas_fee = benefit_stat.total_gas_fee.add(position_info_history_stat.total_gas_used);
    let total_gas_fee_value = Decimal(total_gas_fee.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);
    console.log('Gas Fee (Accumulate from DB Historical): %s, Value Earnings(Current Price): %s', total_gas_fee.toString(), total_gas_fee_value.neg().toString());


    let total_fee_coin_a = benefit_stat.fee_and_rwd.fee_owned_a.add(position_info_history_stat.fee_coin_a);
    let total_fee_coin_a_value = Decimal(total_fee_coin_a.toString()).mul(Decimal.pow(10, -6));

    let total_fee_coin_b = benefit_stat.fee_and_rwd.fee_owned_b.add(position_info_history_stat.fee_coin_b);
    let total_fee_coin_b_value = Decimal(total_fee_coin_b.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);

    let total_rwd_sui = benefit_stat.fee_and_rwd.rwd_owned_sui.add(position_info_history_stat.rwd_sui);
    let total_rwd_sui_value = Decimal(total_rwd_sui.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);

    let total_rwd_cetus = benefit_stat.fee_and_rwd.rwd_owned_cetus.add(position_info_history_stat.rwd_cetus);
    let total_rwd_cetus_value = Decimal(total_rwd_cetus.toString()).mul(Decimal.pow(10, -9)).mul(cetus_price);

    let total_fee_rwd_value = total_fee_coin_a_value.add(total_fee_coin_b_value).add(total_rwd_sui_value).add(total_rwd_cetus_value);

    console.log('Fee Amount A (Accumulate from DB Historical): %s, Value Earnings(Current Price): %s', total_fee_coin_a.toString(), total_fee_coin_a_value.toString());
    console.log('Fee Amount B (Accumulate from DB Historical): %s, Value Earnings(Current Price): %s', total_fee_coin_b.toString(), total_fee_coin_b_value.toString());
    console.log('Reward SUI (Accumulate from DB Historical): %s, Value Earnings(Current Price): %s', total_rwd_sui.toString(), total_rwd_sui_value.toString());
    console.log('Reward Cetus (Accumulate from DB Historical): %s, Value Earnings(Current Price): %s', total_rwd_cetus.toString(), total_rwd_cetus_value.toString());
    console.log('Value Sum(Current Price): %s', total_fee_rwd_value.toString());



    let total_benefit_both_coin_ab = benefit_stat.benefit_now_if_hold_all.add(position_info_history_stat.benefit_holding_coin_ab);
    let total_benefit_only_coin_a = benefit_stat.benefit_now_if_hold_usdc.add(position_info_history_stat.benefit_holding_coin_a);
    let total_benefit_only_coin_b = benefit_stat.benefit_now_if_hold_sui.add(position_info_history_stat.benefit_holding_coin_b);
    
    console.log('Benefit 2 Holding USDC Only (Accumulate from DB Historical): %s', total_benefit_only_coin_a.toString());
    console.log('Benefit 2 Holding SUI Only (Accumulate from DB Historical): %s', total_benefit_only_coin_b.toString());
    console.log('Benefit 2 Holding All Coin (Accumulate from DB Historical): %s', total_benefit_both_coin_ab.toString());

    console.log('');
    // delta from startup
    let sui_value_startup = d(check_point_status_first.sui_balance.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_first.sui_price);
    let usdc_value_startup = d(check_point_status_first.usdc_balance.toString()).mul(Decimal.pow(10, -6));
    let cetus_value_startup = d(check_point_status_first.cetus_balance.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_first.cetus_price);
    let all_value_startup = usdc_value_startup.add(sui_value_startup).add(cetus_value_startup);
    let all_value_now = benefit_stat.all_value_now;
    let sui_value_now = d(check_point_status_first.sui_balance.toString()).mul(Decimal.pow(10, -9)).mul(sui_price);
    let usdc_value_now = d(check_point_status_first.usdc_balance.toString()).mul(Decimal.pow(10, -6));
    let cetus_value_now = d(check_point_status_first.cetus_balance.toString()).mul(Decimal.pow(10, -9)).mul(cetus_price);
    let all_value_now_if_hold_all = sui_value_now.add(usdc_value_now).add(cetus_value_now);
    let all_value_now_if_hold_usdc = all_value_startup;
    let all_value_now_if_hold_sui = all_value_startup.div(check_point_status_first.sui_price).mul(sui_price);

    
    console.log('Benefit 2 Holding USDC Only (From Startup): %s', all_value_now.sub(all_value_now_if_hold_usdc).toString());
    console.log('Benefit 2 Holding SUI Only (From Startup): %s', all_value_now.sub(all_value_now_if_hold_sui).toString());
    console.log('Benefit 2 Holding All Coin (From Startup): %s', all_value_now.sub(all_value_now_if_hold_all).toString());
}














async function getCoins(account_address: string, coin_type: string): Promise<string[]> {
    // merge coin check
    let coins: string[] = [];
    let retry_times = 5;
    while(true) { // try best to recover
        try {
            let hasNextPage = true;
            let cursor: string | null| undefined = null;            

            while (hasNextPage) {
                const rsp = await cetusClmmSDK.FullClient.getCoins({
                    owner: account_address,
                    coinType: coin_type,
                    cursor,
                    limit: 50
                });

                rsp.data.forEach(c => coins.push(c.coinObjectId));
                hasNextPage = rsp.hasNextPage;
                cursor = rsp.nextCursor;
            }
        } catch (e) {
            if (e instanceof Error) {
                console.error('%s [error] getCoins get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
            } else {
                console.error('getCoins get an exception'); 
                console.error(e);
            }

            coins = [];
            if (retry_times <= 0) {
                console.error('no retry_times remains, return undefined.');
                break;
            }
            console.error('wait and try again...'); 
            await new Promise(f => setTimeout(f, 500));
            retry_times--;            
            continue;
        }
        break;
    }
    return coins;
}



async function mergeCoin(coins: string[], sendKeypair: Ed25519Keypair): Promise<SuiTransactionBlockResponse | undefined> {
    const tx = new Transaction();
    let tx_rsp: SuiTransactionBlockResponse | undefined = undefined;
    let retry_times = 5;

    while(true) {
        try {
            if (coins.length <= 1) {
                return tx_rsp;
            }
            const primaryCoin = tx.object(coins[0]);
            const toMerge = coins.slice(1).map(id => tx.object(id));
            tx.mergeCoins(primaryCoin, toMerge);
            tx_rsp = await cetusClmmSDK.FullClient.signAndExecuteTransaction(
                {
                    transaction: tx, 
                    signer: sendKeypair, 
                    options: {
                        showEffects: true,
                        showEvents: true,
                        showInput: true,
                        showBalanceChanges: true,
                    },
                }
            );
            dumpSDKRet2Logfile('mergeCoin: cetusClmmSDK.FullClient.signAndExecuteTransaction', JSON.stringify(tx_rsp, null, 2));
            console.log('[%s] - mergeCoin: cetusClmmSDK.FullClient.signAndExecuteTransaction: %s - ', date.toLocaleString(), tx_rsp.effects?.status.status);
        } catch(e) {
            if (e instanceof Error) {
                console.error('%s [error] mergeCoin get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
            } else {
                console.error('[error] mergeCoin get an exception'); 
                console.error(e);
            }
            if (retry_times <= 0) {
                console.error('no retry_times remains, return undefined.');
                tx_rsp = undefined;
                break;
            }
            console.error('wait 2s and try again..., remain times: ', retry_times); 
            await new Promise(f => setTimeout(f, 2000));
            retry_times = retry_times - 1;
            continue;
        }
        break;
    }                    
    return tx_rsp;
}


async function aggregatorSwap(from: string, target: string, amount: BN, by_amount_in: boolean, sendKeypair: Ed25519Keypair):  Promise<SuiTransactionBlockResponse | undefined> {

    let txb = new Transaction();
    let tx_rsp: SuiTransactionBlockResponse | undefined = undefined;
    let retry_times = 5;
    while (true) { // try best to recover
        try {
            const routers = await client.findRouters({
                from,
                target,
                amount,
                byAmountIn: by_amount_in // `true` means fix input amount, `false` means fix output amount
            }); 
            dumpSDKRet2Logfile('Aggregator Swap: client.findRouters', JSON.stringify(routers, null, 2));
            console.log('[%s] - Aggregator Swap: client.findRouters: %s - ', date.toLocaleString(), routers ? 'success' : 'failure');

            if (routers == null) {
                console.log('[error] Swap: client.findRouter return null'); 
                if (retry_times <= 0) {
                    console.error('no retry_times remains, return undefined.');
                    tx_rsp = undefined;
                    break;
                }
                console.log('[error] wait 2s and try again..., remain times:', retry_times);
                await new Promise(f => setTimeout(f, 2000));
                retry_times = retry_times - 1;
                continue;
            }

            client.signer = sendKeypair.getPublicKey().toSuiAddress();
            await client.fastRouterSwap({
                routers,
                txb,
                slippage: SLIPPAGE_AGGREGATOR_SWAP,
            });



            const result = await client.devInspectTransactionBlock(txb);
            dumpSDKRet2Logfile('Aggregator Swap: client.devInspectTransactionBlock', JSON.stringify(result, null, 2));
            console.log('[%s] - Aggregator Swap: client.devInspectTransactionBlock: %s - ', date.toLocaleString(), result.effects.status.status);


            tx_rsp = await client.signAndExecuteTransaction(txb, sendKeypair);
            // const signAndExecuteResult = await client.sendTransaction(txb, sendKeypair);
            dumpSDKRet2Logfile('Aggregator Swap: client.signAndExecuteTransaction', JSON.stringify(tx_rsp, null, 2));
            console.log('[%s] - Aggregator Swap: client.signAndExecuteTransaction: %s - ', date.toLocaleString(), tx_rsp.effects?.status.status);

        } catch (e) {
            if (e instanceof Error) {
                console.error('%s [error] Aggregator Swap get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
            } else {
                console.error('[error] Aggregator Swap get an exception'); 
                console.error(e);
            }
            if (retry_times <= 0) {
                console.error('no retry_times remains, return undefined.');
                tx_rsp = undefined;
                break;
            }
            console.error('wait 2s and try again..., remain times: ', retry_times); 
            await new Promise(f => setTimeout(f, 2000));
            retry_times = retry_times - 1;
            continue;
        }
        break;
    }
    return tx_rsp;
}




async function closePosition(pool: Pool, pos: Position, sendKeypair: Ed25519Keypair):  Promise<SuiTransactionBlockResponse | undefined> {
    let transfer_txn: SuiTransactionBlockResponse | undefined = undefined;
    let retry_times = 5;
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
            console.log('[%s] - Close Position: cetusClmmSDK.Position.closePositionPayload - ', date.toLocaleString());

            transfer_txn = await cetusClmmSDK.FullClient.sendTransaction(sendKeypair, close_position_payload);
            dumpSDKRet2Logfile('Close Position: cetusClmmSDK.FullClient.sendTransaction', JSON.stringify(transfer_txn, null, 2));
            console.log('[%s] - Close Position: cetusClmmSDK.FullClient.sendTransaction: %s - ', date.toLocaleString(), transfer_txn?.effects?.status.status);
        } catch(e) {
            if (e instanceof Error) {
                console.error('%s [error] Close Position get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
            } else {
                console.error('[error] Close Position get an exception'); 
                console.error(e);
            }
            if (retry_times <= 0) {
                console.error('no retry_times remains, return undefined.');
                transfer_txn = undefined;
                break;
            }

            console.error('wait 2s and try again..., remain times:', retry_times);
            await new Promise(f => setTimeout(f, 2000));
            retry_times = retry_times - 1;
            continue;
        }
        break;
    }
    return transfer_txn;
}




enum PositionState {
    Initial = 0,
    Swap,
    AddLiquidity,
    PreRunning,
    Running,
    ClosePosition,
    PostProcess,
    Clean,
    PositionStateMax
};



function askQuestion(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}


type MinerConfig = {
    mode: string;  // 'running', 'close_position'
    close_when_sig_int: string;
};

function newMinerConfig(): MinerConfig {
    let ret: MinerConfig = {
        mode: 'running',
        close_when_sig_int: 'false'
    };
    return ret;
}




async function loadMinerConfig(): Promise<MinerConfig> {
    let miner_config = newMinerConfig();

    if (fs.existsSync(MINER_CONFIG_FILE_NAME)) {
        try {
            let raw_file: string = fs.readFileSync(MINER_CONFIG_FILE_NAME).toString();
            miner_config = JSON.parse(raw_file);
        } catch (e) {
            date.setTime(Date.now());
            if (e instanceof Error) {
                console.log('%s [error] load %s and parse get an exception:\n%s \n%s \n%s', date.toLocaleString(), MINER_CONFIG_FILE_NAME, e.message, e.name, e.stack)
            } else {
                console.log('%s [error] load %s and parse get an exception',date.toLocaleString(), MINER_CONFIG_FILE_NAME); 
                console.log(e);
            }
            miner_config = newMinerConfig();
        }
    }
    return miner_config;
}































async function main() {
    const sendKeypair = Ed25519Keypair.deriveKeypair(MNEMONICS, HD_WALLET_PATH);
    const account_address = sendKeypair.getPublicKey().toSuiAddress();
    cetusClmmSDK.setSenderAddress(account_address);
    console.log('Account Address: ', account_address);


    let miner_config = await loadMinerConfig();
    console.log('miner config: ', miner_config);



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



    // Initial
    let check_point_status = newCheckPointStatus();    
    let pools: Pool[] | null = null;
    let cetus_pools: Pool[] | null = null;
    


    // Swap
    let pools_swap: Pool[] | null = null;
    let tx_info_merge_coin_usdc: TransactionInfo | null = null;
    let tx_info_merge_coin_sui: TransactionInfo | null = null;
    let tx_info_aggregator_swap = newTransactionInfo();
    let check_point_status_after_swap = newCheckPointStatus();
    let pools_after_swap: Pool[] | null = null;
    let cetus_pools_after_swap: Pool[] | null = null;



    // Add Liquidity
    let pools_add_liquidity: Pool[] | null = null;
    let tx_info_add_liquidity = newTransactionInfo();
    let check_point_status_after_add_liquidity = newCheckPointStatus();
    let pools_after_add_liquidity: Pool[] | null = null;
    let cetus_pools_after_add_liquidity: Pool[] | null = null;



    // Running
    let pools_running: Pool[] | null = null;
    let cetus_pools_running: Pool[] | null = null;
    let positions_running: Position[] | null = null;



    // Close position
    let pools_close_position: Pool[] | null = null;
    let positions_close_position: Position[] | null = null;
    let tx_info_close_position = newTransactionInfo();
    let check_point_status_after_close_position = newCheckPointStatus();
    let pools_after_close_position: Pool[] | null = null;
    let cetus_pools_after_close_position: Pool[] | null = null;


    // Post Process 
    let tx_info_merge_coin_cetus: TransactionInfo | null = null;
    let tx_info_cetus_aggregator_swap: TransactionInfo | null = null;
    let check_point_status_after_post_process: CheckPointStatus | null = null;
    let pools_after_post_process: Pool[] | null = null;
    let cetus_pools_after_post_process: Pool[] | null = null;



    // helper
    let check_point_status_first = newCheckPointStatus();
    let check_point_status_last = newCheckPointStatus();

    let tx_info_arr: TransactionInfo[] = [];
    let tx_info_arr_length_last: number = 0;
    let check_point_status_arr: CheckPointStatus[] = [];
    let check_point_status_arr_length_last: number = 0;

    let total_gas_fee_accumulate = new BN(0);

    let tick_when_add_liquidity = 0;
    let impermanent_loss_ctx = newImpermanentLossCtx();

    let running_circle = 0;
    let running_circle_in_range = 0;


    let position_state: number = PositionState.Initial;






    let exit = false;
    let exit_process_finished = false;
    let exit_and_close_position = false;
    process.on('SIGINT', async function () {
        date.setTime(Date.now());
        console.log('%s [info] SIGINT received. CLose all position and save data...', date.toLocaleString());


        exit_process_finished = false;
        // const answer = await askQuestion("Close position at the same time? (y/n): ");
        // if (answer.toLowerCase() === "y") {
        //     exit_and_close_position = true;
        // } else {
        //     exit = true;
        // }
        exit = true;

        while (!exit_process_finished) {
            await new Promise(f => setTimeout(f, 500));
        }
        console.log('%s [info] Exit process finished.', date.toLocaleString());

        process.exit();
    });







    // - try to recover if db data is not damaged - 

    let pools_prehandle: Pool[] | null = null;
    let positions_prehandle: Position[] | null = null;

    let position_info_restore = newPositionInfo();
    let check_point_status_arr_restore: CheckPointStatus[] = [];
    let tx_info_arr_restore: TransactionInfo[] = [];

    date.setTime(Date.now());
    // get existing position and recover ctx
    while(true) { // try best to recover
        try {
            pools_prehandle = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
            if (pools_prehandle == null || pools_prehandle.length <= 0) {
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

    positions_prehandle = null;
    while(true) {
        try {
            positions_prehandle = await cetusClmmSDK.Position.getPositionList(account_address, [POOL_ADDRESS], false);
            if (positions_prehandle == null) {
                console.log('[ERROR] can not retrive positions_prehandle info with getPositionList, wait and try again...');
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



    if (positions_prehandle.length > 1) { 
        console.log('[ERROR] unclosed position amount > 1, please close them manually. exit!');
        return;
    } else if (positions_prehandle.length == 1) {

        let breakpoint_recoverable = false;

        // try to make sure is it breakpoint_recoverable
        if (save_to_db && db) { 
            position_info_restore = newPositionInfo();
            check_point_status_arr_restore = [];
            tx_info_arr_restore = [];

            let get_success = false;
            let ret = await sqlite3_utils.getPositionInfo(db, positions_prehandle[0].pos_object_id);
            if(ret.success && ret.position_info){
                position_info_restore = ret.position_info;
                let ret2 = await sqlite3_utils.getAllCheckPointStatus(db, position_info_restore);
                if (ret2.success && ret2.check_point_status_arr && ret2.check_point_status_arr.length > 0) {
                    check_point_status_arr_restore = ret2.check_point_status_arr;
                    let ret3 = await sqlite3_utils.getAllTransactionInfo(db, position_info_restore);
                    if (ret3.success && ret3.tx_info_arr && ret3.tx_info_arr.length > 0) {
                        tx_info_arr_restore = ret3.tx_info_arr;
                        get_success = true;
                    }
                    
                }
            }

            console.log('get_success:',get_success);
            console.log('--------------------------------------------------------');
            console.log('position_info_restore: \n%s', JSON.stringify(position_info_restore, null, 2));
            console.log('--------------------------------------------------------');
            console.log('check_point_status_arr_restore: \n%s', JSON.stringify(check_point_status_arr_restore, null, 2));
            console.log('--------------------------------------------------------');
            console.log('tx_info_arr_restore: \n%s', JSON.stringify(tx_info_arr_restore, null, 2));
            console.log('--------------------------------------------------------');

            if (get_success) {
                position_info = clonePositionInfo(position_info_restore);
                check_point_status_last = cloneCheckPointStatus(check_point_status_arr_restore[check_point_status_arr_restore.length - 1]);
                console.log('check_point_status_last.type = ', check_point_status_last.type);

                if (check_point_status_last.type === 'after_add_liquidity') {
                    // 'initial', 'after_swap', 'after_add_liquidity','after_close_position', 'after_post_process'
                    for (const chk_status of check_point_status_arr_restore) {
                        check_point_status_arr.push(cloneCheckPointStatus(chk_status));
                        switch (chk_status.type) {
                            case 'initial':
                                check_point_status = cloneCheckPointStatus(chk_status);
                                break;
                            case 'after_swap':
                                check_point_status_after_swap = cloneCheckPointStatus(chk_status);
                                break;
                            case 'after_add_liquidity':
                                check_point_status_after_add_liquidity = cloneCheckPointStatus(chk_status);
                                break;
                            case 'after_close_position':
                                check_point_status_after_close_position = cloneCheckPointStatus(chk_status);
                                break;
                            case 'after_post_process':
                                check_point_status_after_post_process = cloneCheckPointStatus(chk_status);
                                break;
                            default:
                                console.log('Unknown check_point_status type: \n%s', JSON.stringify(check_point_status_arr_restore, null, 2));
                                break;
                        }
                    }
                    check_point_status_arr_length_last = check_point_status_arr.length;



                    for (const tx_info of tx_info_arr_restore) {
                        total_gas_fee_accumulate.iadd(tx_info.total_gas_fee);
                        tx_info_arr.push(cloneTransactionInfo(tx_info));
                        // 'merge_coin_usdc','merge_coin_sui','aggregator_swap', 'add_liquidity', 'close_position', 'merge_coin_cetus','cetus_aggregator_swap', 
                        switch(tx_info.type) {
                            case 'merge_coin_usdc':
                                tx_info_merge_coin_usdc = cloneTransactionInfo(tx_info);
                                break;
                            case 'merge_coin_sui':
                                tx_info_merge_coin_sui = cloneTransactionInfo(tx_info);
                                break;
                            case 'aggregator_swap':
                                tx_info_aggregator_swap = cloneTransactionInfo(tx_info);
                                break;
                            case 'add_liquidity':
                                tx_info_add_liquidity = cloneTransactionInfo(tx_info);
                                break;
                            case 'close_position':
                                tx_info_close_position = cloneTransactionInfo(tx_info);
                                break;
                            case 'merge_coin_cetus':
                                tx_info_merge_coin_cetus = cloneTransactionInfo(tx_info);
                                break;
                            case 'cetus_aggregator_swap':
                                tx_info_cetus_aggregator_swap = cloneTransactionInfo(tx_info);
                                break;
                            default:
                                console.log('Unknown tx_info type: \n%s', JSON.stringify(tx_info_arr_restore, null, 2));
                                break;
                        }
                    }
                    tx_info_arr_length_last = tx_info_arr.length;
                    breakpoint_recoverable = true;                    
                }
            }
        }

        console.log('breakpoint_recoverable: ', breakpoint_recoverable);

        if (breakpoint_recoverable) {
            if (pools_prehandle[0].current_tick_index < positions_prehandle[0].tick_lower_index || 
                    pools_prehandle[0].current_tick_index > positions_prehandle[0].tick_upper_index || 
                    miner_config.mode === 'close_position') { // or close_position mode
                position_state = PositionState.ClosePosition;
            } else {
                position_state = PositionState.PreRunning;
            }

        } else { // just close
            while (true) {
                let tx_rsp = await closePosition(pools_prehandle[0], positions_prehandle[0], sendKeypair);

                if (tx_rsp == undefined) { // exception exceed retry times
                    console.log('[error] Close Position: cetusClmmSDK.FullClient.sendTransaction exception exceed retry time, wait 2s and try again...');
                    await new Promise(f => setTimeout(f, 2000));
                    continue;
                }

                let digest_close_position = tx_rsp.digest;
        
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

                if (tx_rsp?.effects?.status.status !== "success") {
                    console.log('[error] Close Position: cetusClmmSDK.FullClient.sendTransaction return failed, wait 2s and try again...');
                    await new Promise(f => setTimeout(f, 2000));
                    continue;
                }

                break;
            }

            position_state = PositionState.Clean; // clean the global var when trying to make sure
        }
    } else {
        position_state = PositionState.Initial;
    }






    // get history
    console.log('- get history -');
    let position_info_history_stat = newPositionInfoHistoryStatistics();
    
    if (save_to_db && db) {
        // let position_info_statictics: PositionInfo[] = [];

        let ret = await sqlite3_utils.getAllPositionInfo(db);
        if (ret.success && ret.position_infos) {
            // init position_info_history_stat
            for (const pos of ret.position_infos) {
                position_info_history_stat.total_gas_used.iadd(pos.total_gas_used);
                position_info_history_stat.fee_coin_a.iadd(pos.fee_coin_a);
                position_info_history_stat.fee_coin_b.iadd(pos.fee_coin_b);
                position_info_history_stat.rwd_sui.iadd(pos.rwd_sui);
                position_info_history_stat.rwd_cetus.iadd(pos.rwd_cetus);
                position_info_history_stat.benefit_holding_coin_ab = position_info_history_stat.benefit_holding_coin_ab.add(pos.benefit_holding_coin_ab);
                position_info_history_stat.benefit_holding_coin_a = position_info_history_stat.benefit_holding_coin_a.add(pos.benefit_holding_coin_a);
                position_info_history_stat.benefit_holding_coin_b = position_info_history_stat.benefit_holding_coin_b.add(pos.benefit_holding_coin_b);
            }

            // init check_point_status_first
            if (ret.position_infos.length) {
                let chk_ret = await sqlite3_utils.getAllCheckPointStatus(db, ret.position_infos[0]);
                if (chk_ret.success && chk_ret.check_point_status_arr && chk_ret.check_point_status_arr.length) {
                    check_point_status_first = cloneCheckPointStatus(chk_ret.check_point_status_arr[0]);
                }
            }
        }
    }



    for(;;) {
        if (exit) {
            break;
        }





        if (position_state == PositionState.Initial) {
            await new Promise(f => setTimeout(f, 5000));
            console.log('');
            console.log('');
            console.log('--------------------------------------------------------');
            console.log('Stage Initial');
            console.log('--------------------------------------------------------');

            // get check_point_status
            let wallet_balance: AllCoinAmounts = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
            while(true) {
                try {
                    wallet_balance = await getAllWalletBalance(account_address);
                    console.log('wallet_balance: usdc %s, sui %s, cetus %s', 
                        wallet_balance.usdc_amount, 
                        wallet_balance.sui_amount, 
                        wallet_balance.cetus_amount);
                    console.log('wallet_balance of check_point_status_last: usdc %s, sui %s, cetus %s', 
                        check_point_status_last.usdc_balance.toString(),
                        check_point_status_last.sui_balance.toString(),
                        check_point_status_last.cetus_balance.toString()
                    );
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

            // get price and value
            let sui_price = d(0);
            pools = null;
            while(true) { // try best to recover
                try {
                    pools = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
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


            let cetus_price = d(0);
            cetus_pools = null;
            while(true) {
                try {
                    cetus_pools = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_FOR_FEE]);
                    if (cetus_pools == null || cetus_pools.length <= 0) {
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
            cetus_price = d(1).div(TickMath.tickIndexToPrice(cetus_pools[0].current_tick_index, 6, 9));



            check_point_status = newCheckPointStatus();

            check_point_status.unix_timestamp_ms = Date.now();
            check_point_status.type = 'initial';

            // no tx of this check point
            // cur_tick_index_for_tx = tick_lower_index_for_tx = tick_upper_index_for_tx = 0

            check_point_status.usdc_sui_tick_index = pools[0].current_tick_index;
            check_point_status.sui_price = sui_price;
            check_point_status.usdc_cetus_tick_index = cetus_pools[0].current_tick_index;
            check_point_status.cetus_price = cetus_price;

            check_point_status.usdc_balance = new BN(wallet_balance.usdc_amount);
            check_point_status.sui_balance = new BN(wallet_balance.sui_amount);
            check_point_status.cetus_balance = new BN(wallet_balance.cetus_amount);

            // no coin in liquidity and fee rwd
            // usdc_in_liquidity = sui_in_liquidity = usdc_fee = sui_fee = sui_rwd = cetus_rwd = 0

            check_point_status_arr.push(cloneCheckPointStatus(check_point_status));

            
            // dump check point
            console.log('');
            console.log(' - Check Point : Initial - ');
            dumpCheckPoint(check_point_status);

            // dump balance and liquidity value now
            let balance_liquidity_value = calcBalanceLiquidityValue(sui_price, cetus_price, check_point_status);
            console.log('Total Balance Liquidity Value: ', balance_liquidity_value.total_value);
            console.log('');


            if (check_point_status_first.unix_timestamp_ms === 0) {
                check_point_status_first = cloneCheckPointStatus(check_point_status);
            }
            check_point_status_last = check_point_status;
            

            total_gas_fee_accumulate = new BN(0);

            position_state = PositionState.Swap;
        }








        if (position_state == PositionState.Swap) {
            do {
                console.log('');
                console.log('');
                console.log('--------------------------------------------------------');
                console.log('Stage Aggregator Swap');
                console.log('--------------------------------------------------------');

                // get tick
                pools_swap = null;             
                while(true) { // try best to recover
                    try {
                        pools_swap = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
                        if (pools_swap == null || pools_swap.length <= 0) {
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

                let current_tick_index = pools_swap[0].current_tick_index;
                let tick_lower_index = 0;
                let tick_upper_index = 0;

                let tick_spacing_lower_index = Math.floor(current_tick_index / POOL_TICK_SPACING) * POOL_TICK_SPACING;
                let tick_spacing_upper_index = tick_spacing_lower_index + POOL_TICK_SPACING;                
                // let tick_spacing_lower_index = TickMath.getPrevInitializeTickIndex(current_tick_index, POOL_TICK_SPACING) + POOL_TICK_SPACING;
                // let tick_spacing_upper_index = TickMath.getNextInitializeTickIndex(current_tick_index, POOL_TICK_SPACING);

                let tick_lower_side = (tick_spacing_upper_index - current_tick_index) > (current_tick_index - tick_spacing_lower_index); // [tick_lower_index, tick_middle)

                if (POOL_TICK_SPACING_TIMES % 2) { // odd
                    tick_lower_index = tick_spacing_lower_index - Math.floor(POOL_TICK_SPACING_TIMES / 2) * POOL_TICK_SPACING;
                    tick_upper_index = tick_spacing_upper_index + Math.floor(POOL_TICK_SPACING_TIMES / 2) * POOL_TICK_SPACING;
                } else { // even
                    tick_lower_index = (tick_lower_side? tick_spacing_lower_index : tick_spacing_upper_index) - Math.floor(POOL_TICK_SPACING_TIMES / 2) * POOL_TICK_SPACING;
                    tick_upper_index = (tick_lower_side? tick_spacing_lower_index : tick_spacing_upper_index) + Math.floor(POOL_TICK_SPACING_TIMES / 2) * POOL_TICK_SPACING;
                }


                console.log('Tick Basic Space: %d - (%d) - %d', tick_spacing_lower_index, current_tick_index, tick_spacing_upper_index);  
                console.log('Position Tick Range for Swap Calc / Add: %d - (%d) - %d', tick_lower_index, current_tick_index, tick_upper_index);
                console.log('Initial Lower Boundary Calc Seed: ', tick_lower_index);
                if (current_tick_index === tick_lower_index || current_tick_index === tick_upper_index) {
                    // when POOL_TICK_SPACING_TIMES == 1
                    console.log('current_tick_index at border, wait 5s and retry...');
                    await new Promise(f => setTimeout(f, 5000));

                    position_state = PositionState.Swap;
                    break;
                }




                // rebalance
                let sui_balance_exclude_gas_reserve = check_point_status_last.sui_balance.sub(SUI_GAS_RESERVED);

                const rebalance_info = getRebalanceDirectionAndAmount(
                    check_point_status_last.usdc_balance.clone(), 
                    sui_balance_exclude_gas_reserve.clone(),
                    current_tick_index, 
                    tick_lower_index, 
                    tick_upper_index);
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


                // do not swap , just jump to add liquidity
                if (!rebalance_info.valid || !rebalance_info.need_swap) {
                    console.log('no need to rebalance, jump to add liquidity.');
                    position_state = PositionState.AddLiquidity;
                    break;
                }

                // optimize
                // if add liquidity failed, the next swap amount maybe very tiny
                let change_delta_coin_a = rebalance_info.a2b ? rebalance_info.amount_in : rebalance_info.amount_out;
                let change_ratio_coin_a = d(change_delta_coin_a.toString()).div(check_point_status_last.usdc_balance.toString());
                let change_delta_coin_b = rebalance_info.a2b ? rebalance_info.amount_out : rebalance_info.amount_in;
                let change_ratio_coin_b = d(change_delta_coin_b.toString()).div(sui_balance_exclude_gas_reserve.toString());

                if (change_ratio_coin_a.lt(0.05) && change_ratio_coin_b.lt(0.05)) {
                    console.log('delta is too small to rebalance, jump to add liquidity. change_ratio_coin_a: %s, change_ratio_coin_b: %s', change_ratio_coin_a, change_ratio_coin_b);
                    position_state = PositionState.AddLiquidity;
                    break;
                }


                
                // check and perform coin merge for usdc
                let coin_balance = await cetusClmmSDK.FullClient.getBalance({
                    owner: account_address,
                    coinType: COIN_TYPE_ADDRESS_USDC
                });
                if (coin_balance.coinObjectCount >= 50) {
                    let coins_object_usdc = await getCoins(account_address, COIN_TYPE_ADDRESS_USDC);
                    if (coins_object_usdc.length){
                        let tx_rsp = await mergeCoin(coins_object_usdc, sendKeypair);
                        if (tx_rsp == undefined) {
                            console.log('mergeCoin USDC tx_rsp = null, process continue.'); 
                        } else {
                            // success or failed(maybe insufficient gas) tx with gas use

                            // get swap transaction info
                            tx_info_merge_coin_usdc = newTransactionInfo();
                            let tx_opt_merge_coin_usdc: TransactionInfoQueryOptions = {
                                get_total_gas_fee: true,
                                get_balance_change: true,
                                get_add_liquidity_event: false,
                                get_remove_liquidity_event: false,
                                get_fee_and_rwd: false   
                            };
                            await getTransactionInfo(tx_rsp.digest, tx_info_merge_coin_usdc, tx_opt_merge_coin_usdc, sendKeypair);
                            tx_info_merge_coin_usdc.type = 'merge_coin_usdc';

                            tx_info_arr.push(cloneTransactionInfo(tx_info_merge_coin_usdc));

                            total_gas_fee_accumulate.iadd(tx_info_merge_coin_usdc.total_gas_fee);
                            console.log('total_gas_fee_accumulate: ', total_gas_fee_accumulate.toString());

                            // dump add_liquidity transaction info
                            console.log('');
                            dumpTransactionInfo('Merge Coin USDC Transaction Rsp', tx_info_merge_coin_usdc, tx_opt_merge_coin_usdc);

                            if (tx_rsp.effects?.status.status === 'failure') {
                                console.log('mergeCoin USDC mergeCoin return failure, process continue.');
                            }
                        }
                    }
                }

                // check and perform coin merge for sui
                coin_balance = await cetusClmmSDK.FullClient.getBalance({
                    owner: account_address,
                    coinType: COIN_TYPE_ADDRESS_SUI
                });
                if (coin_balance.coinObjectCount >= 50) {                    
                    let coins_object_sui = await getCoins(account_address, COIN_TYPE_ADDRESS_SUI);
                    if (coins_object_sui.length){
                        let tx_rsp = await mergeCoin(coins_object_sui, sendKeypair);
                        if (tx_rsp == undefined) {
                            console.log('mergeCoin SUI tx_rsp = null, process continue.'); 
                        } else {
                            // success or failed(maybe insufficient gas) tx with gas use

                            // get swap transaction info
                            tx_info_merge_coin_sui = newTransactionInfo();
                            let tx_opt_merge_coin_sui: TransactionInfoQueryOptions = {
                                get_total_gas_fee: true,
                                get_balance_change: true,
                                get_add_liquidity_event: false,
                                get_remove_liquidity_event: false,
                                get_fee_and_rwd: false   
                            };
                            await getTransactionInfo(tx_rsp.digest, tx_info_merge_coin_sui, tx_opt_merge_coin_sui, sendKeypair);
                            tx_info_merge_coin_sui.type = 'merge_coin_sui';

                            tx_info_arr.push(cloneTransactionInfo(tx_info_merge_coin_sui));

                            total_gas_fee_accumulate.iadd(tx_info_merge_coin_sui.total_gas_fee);
                            console.log('total_gas_fee_accumulate: ', total_gas_fee_accumulate.toString());

                            // dump add_liquidity transaction info
                            console.log('');
                            dumpTransactionInfo('Merge Coin SUI Transaction Rsp', tx_info_merge_coin_sui, tx_opt_merge_coin_sui);

                            if (tx_rsp.effects?.status.status === 'failure') {
                                console.log('mergeCoin SUI mergeCoin return failure, process continue.');
                            }
                        }
                    }
                }

                

                




                // perform swap
                let digest_swap = '';
                let tx_rsp = await aggregatorSwap(
                    rebalance_info.a2b ? COIN_TYPE_ADDRESS_USDC : COIN_TYPE_ADDRESS_SUI,
                    rebalance_info.a2b ? COIN_TYPE_ADDRESS_SUI : COIN_TYPE_ADDRESS_USDC,
                    rebalance_info.amount_in.clone(),
                    true,
                    sendKeypair
                );

                if (tx_rsp == undefined) {
                    console.log('[error] Swap: exception exceed retry time, wait 2s and try again...'); 
                    await new Promise(f => setTimeout(f, 2000));

                    position_state = PositionState.Swap;
                    break;
                }

                // success or failed(maybe insufficient gas) tx with gas use
                digest_swap = tx_rsp.digest;

                // get swap transaction info
                tx_info_aggregator_swap = newTransactionInfo();
                let tx_opt_swap: TransactionInfoQueryOptions = {
                    get_total_gas_fee: true,
                    get_balance_change: true,
                    get_add_liquidity_event: false,
                    get_remove_liquidity_event: false,
                    get_fee_and_rwd: false   
                };
                await getTransactionInfo(digest_swap, tx_info_aggregator_swap, tx_opt_swap, sendKeypair);
                tx_info_aggregator_swap.type = 'aggregator_swap';

                tx_info_arr.push(cloneTransactionInfo(tx_info_aggregator_swap));

                total_gas_fee_accumulate.iadd(tx_info_aggregator_swap.total_gas_fee);
                console.log('total_gas_fee_accumulate: ', total_gas_fee_accumulate.toString());

                // dump add_liquidity transaction info
                console.log('');
                dumpTransactionInfo('Aggregator Swap Transaction Rsp', tx_info_aggregator_swap, tx_opt_swap);




                // get wallet balance
                let wallet_balance: AllCoinAmounts = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
                let wallet_balance_before: AllCoinAmounts = {
                    usdc_amount: check_point_status_last.usdc_balance.toString(),
                    sui_amount: check_point_status_last.sui_balance.toString(),
                    cetus_amount: check_point_status_last.cetus_balance.toString()
                };
                while(true) { // try best to recover
                    try {
                        wallet_balance = await getAllWalletBalance(account_address);
                        // wait for wallet balance updated.
                        while (balanceNotChange(wallet_balance_before, wallet_balance)) {
                            date.setTime(Date.now());
                            console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());                            
                            console.log('[%s][WARNING] wallet_balance: usdc %s, sui %s, cetus %s', 
                                wallet_balance.usdc_amount, 
                                wallet_balance.sui_amount, 
                                wallet_balance.cetus_amount);
                            console.log('[%s][WARNING] wallet_balance_before: usdc %s, sui %s, cetus %s', date.toLocaleString(),
                                wallet_balance_before.usdc_amount, 
                                wallet_balance_before.sui_amount, 
                                wallet_balance_before.cetus_amount);
                            console.log('[%s][WARNING] wallet_balance of check_point_status_last: usdc %s, sui %s, cetus %s', date.toLocaleString(),
                                check_point_status_last.usdc_balance.toString(),
                                check_point_status_last.sui_balance.toString(),
                                check_point_status_last.cetus_balance.toString()
                            );
                            await new Promise(f => setTimeout(f, 1000));
                            wallet_balance = await getAllWalletBalance(account_address);
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

                // get price and value
                let sui_price_after_swap = d(0);
                pools_after_swap = null;
                while(true) { // try best to recover
                    try {
                        pools_after_swap = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
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

                let cetus_price_after_swap = d(0);
                cetus_pools_after_swap = null;
                while(true) {
                    try {
                        cetus_pools_after_swap = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_FOR_FEE]);
                        if (cetus_pools_after_swap == null || cetus_pools_after_swap.length <= 0) {
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
                cetus_price_after_swap = d(1).div(TickMath.tickIndexToPrice(cetus_pools_after_swap[0].current_tick_index, 6, 9));


                // get check_point_status
                check_point_status_after_swap = newCheckPointStatus();                

                check_point_status_after_swap.unix_timestamp_ms = Date.now();
                check_point_status_after_swap.type = 'after_swap';

                check_point_status_after_swap.cur_tick_index_for_tx = current_tick_index;
                check_point_status_after_swap.tick_lower_index_for_tx = tick_lower_index;
                check_point_status_after_swap.tick_upper_index_for_tx = tick_upper_index;
                
                check_point_status_after_swap.usdc_sui_tick_index = pools_after_swap[0].current_tick_index;
                check_point_status_after_swap.sui_price = sui_price_after_swap;
                check_point_status_after_swap.usdc_cetus_tick_index = cetus_pools_after_swap[0].current_tick_index;
                check_point_status_after_swap.cetus_price = cetus_price_after_swap;

                check_point_status_after_swap.usdc_balance = new BN(wallet_balance.usdc_amount);
                check_point_status_after_swap.sui_balance = new BN(wallet_balance.sui_amount);
                check_point_status_after_swap.cetus_balance = new BN(wallet_balance.cetus_amount);

                // no coin in liquidity and fee rwd
                // usdc_in_liquidity = sui_in_liquidity = usdc_fee = sui_fee = sui_rwd = cetus_rwd = 0

                check_point_status_arr.push(cloneCheckPointStatus(check_point_status_after_swap));


                // print
                console.log('');
                console.log(' - Check Point : After Swap - ');
                dumpCheckPoint(check_point_status_after_swap);

                let balance_liquidity_value_after_swap = calcBalanceLiquidityValue(sui_price_after_swap, cetus_price_after_swap, check_point_status_after_swap);
                console.log('Total Balance Liquidity Value: ', balance_liquidity_value_after_swap.total_value);
                console.log('');


                // dump transaction statistics
                // dumpTransactionStatistics('Swap Transaction Stat.', check_point_status_last, check_point_status_after_swap, 
                //     sui_price_after_swap, digest_swap, tx_info_aggregator_swap.total_gas_fee, tx_info_aggregator_swap.balance_change);
                // console.log('');
                // console.log('');                
                

                check_point_status_last = cloneCheckPointStatus(check_point_status_after_swap);

                




                if (tx_rsp.effects?.status.status !== "success") {
                    console.log('[error] Swap: client.signAndExecuteTransaction return failed, wait 2s and try again...'); 
                    await new Promise(f => setTimeout(f, 2000));

                    position_state = PositionState.Swap;
                    break;
                }

                position_state = PositionState.AddLiquidity;

            } while(false);

        }







        if (position_state == PositionState.AddLiquidity) {
            do {
                console.log('');
                console.log('');
                console.log('--------------------------------------------------------');
                console.log('Stage Add AddLiquidity');
                console.log('--------------------------------------------------------');


                pools_add_liquidity = null;
                while(true) { // try best to recover
                    try {
                        pools_add_liquidity = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
                        if (pools_add_liquidity == null || pools_add_liquidity.length <= 0) {
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
                

                let current_tick_index = pools_add_liquidity[0].current_tick_index;
                // let tick_lower_index = initial_lower_boundary_seed + Math.floor((current_tick_index - initial_lower_boundary_seed) / POSITION_TICK_RANGE) * POSITION_TICK_RANGE;
                // let tick_upper_index = tick_lower_index + POSITION_TICK_RANGE;
                let tick_lower_index = check_point_status_after_swap.tick_lower_index_for_tx;
                let tick_upper_index = check_point_status_after_swap.tick_upper_index_for_tx;

                console.log('%d - (%d) - %d (Pool Tick for Swap)', 
                    check_point_status_after_swap.tick_lower_index_for_tx, 
                    check_point_status_after_swap.cur_tick_index_for_tx,
                    check_point_status_after_swap.tick_upper_index_for_tx);
                console.log('%d - (%d) - %d (Pool Tick for Add Liquidity)', tick_lower_index, current_tick_index, tick_upper_index);

                if (current_tick_index <= check_point_status_last.tick_lower_index_for_tx || current_tick_index >= check_point_status_last.tick_upper_index_for_tx) {
                    console.log('[ERROR] Current tick is out of range, need rebalance again.');
                    position_state = PositionState.Swap;
                    break;
                }

                if (Decimal(current_tick_index - check_point_status_last.cur_tick_index_for_tx).abs().gte(10)) {
                    console.log('[WARNING] current_tick_index change more than 10 tick');
                }



                // try to decide fix_amount_a, amount_a,amount_b for add liquidity

                let fix_amount_a = false;
                let coin_amount = new BN(0);
                let cur_sqrt_price = TickMath.tickIndexToSqrtPriceX64(current_tick_index);

                let sui_balance_exclude_gas_reserve = check_point_status_after_swap.sui_balance.sub(SUI_GAS_RESERVED).sub(total_gas_fee_accumulate);

                let total_usdc_slippage = new BN(d(check_point_status_after_swap.usdc_balance.toString()).mul(SLIPPAGE_FOR_ADD_LIQUIDITY).round().toString());
                let total_sui_slippage = new BN(d(sui_balance_exclude_gas_reserve.toString()).mul(SLIPPAGE_FOR_ADD_LIQUIDITY).round().toString());

                // discount slippage_for_add_liquidity per side, to meet huge change of position coin ratio
                let total_usdc_amount_after_swap_for_slippage = check_point_status_after_swap.usdc_balance.sub(total_usdc_slippage);
                let total_sui_amount_after_swap_for_slippage = sui_balance_exclude_gas_reserve.sub(total_sui_slippage);
                
                console.log('')
                console.log(' - estLiquidityAndCoinAmountFromOneAmounts - ')
                console.log(' Coin A Amount in Wallet %s * (1 - slippage) = Amount used for est %s ', check_point_status_after_swap.usdc_balance.toString(), total_usdc_amount_after_swap_for_slippage.toString(), );
                console.log(' Coin B Amount in Wallet except gas reserve %s * (1 - slippage) = Amount used for est %s', sui_balance_exclude_gas_reserve.toString(), total_sui_amount_after_swap_for_slippage.toString());
                

                // try fix coin a
                fix_amount_a = true;
                coin_amount = total_usdc_amount_after_swap_for_slippage.clone();
                let liquidity_input = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
                    tick_lower_index,
                    tick_upper_index,
                    coin_amount,
                    fix_amount_a,
                    true,
                    SLIPPAGE_FOR_ADD_LIQUIDITY,
                    cur_sqrt_price
                )

                console.log(' - ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(try fix Coin A): return - ');
                console.log('liquidity_input.coin_amount_a: ', liquidity_input.coin_amount_a);
                console.log('liquidity_input.coin_amount_b: ', liquidity_input.coin_amount_b);
                console.log('liquidity_input.coin_amount_limit_a: ', liquidity_input.coin_amount_limit_a);
                console.log('liquidity_input.coin_amount_limit_b: ', liquidity_input.coin_amount_limit_b);
                console.log('liquidity_input.fix_amount_a: ', liquidity_input.fix_amount_a);
                console.log('liquidity_input.liquidity_amount: ', liquidity_input.liquidity_amount);

                if (sui_balance_exclude_gas_reserve.lt(new BN(liquidity_input.coin_amount_limit_b))) {
                    console.log('coin b remain(%s) except gas reserved is insuffcient for required - liquidity_input.coin_amount_limit_b(%s)', 
                        sui_balance_exclude_gas_reserve.toString(), liquidity_input.coin_amount_limit_b);

                    
                    // try fix coin b
                    fix_amount_a = false;
                    coin_amount = total_sui_amount_after_swap_for_slippage.clone();

                    liquidity_input = ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(
                        tick_lower_index,
                        tick_upper_index,
                        coin_amount,
                        fix_amount_a,
                        true,
                        SLIPPAGE_FOR_ADD_LIQUIDITY,
                        cur_sqrt_price
                    )

                    console.log(' - ClmmPoolUtil.estLiquidityAndCoinAmountFromOneAmounts(try fix Coin B): return - ');
                    console.log('liquidity_input.coin_amount_a: ', liquidity_input.coin_amount_a);
                    console.log('liquidity_input.coin_amount_b: ', liquidity_input.coin_amount_b);
                    console.log('liquidity_input.coin_amount_limit_a: ', liquidity_input.coin_amount_limit_a);
                    console.log('liquidity_input.coin_amount_limit_b: ', liquidity_input.coin_amount_limit_b);
                    console.log('liquidity_input.fix_amount_a: ', liquidity_input.fix_amount_a);
                    console.log('liquidity_input.liquidity_amount: ', liquidity_input.liquidity_amount);

                    if (check_point_status_after_swap.usdc_balance.lt(new BN(liquidity_input.coin_amount_limit_a))) {
                        console.log('coin a remain(%s) is insuffcient for required - iquidity_input.coin_amount_limit_a(%s)', 
                                    check_point_status_after_swap.usdc_balance.toString(), liquidity_input.coin_amount_limit_a);
                        console.log('[ERROR] The remain coin cannot meet the required for add liquidity, rebalance again. ');

                        position_state = PositionState.Swap;
                        break;
                    }
                }

                const amount_a = fix_amount_a ? coin_amount : new BN(liquidity_input.coin_amount_limit_a);
                const amount_b = fix_amount_a ? new BN(liquidity_input.coin_amount_limit_b) : coin_amount;


                console.log(' - est result used for add liquidity - ');
                console.log('slippage_for_add_liquidity: ', SLIPPAGE_FOR_ADD_LIQUIDITY);
                console.log('fix_amount_a: ', fix_amount_a);
                console.log('amount_a for add liquidity: ', amount_a.toString());
                console.log('amount_b for add liquidity: ', amount_b.toString());
                console.log('')

                if (amount_a.gte(check_point_status_after_swap.usdc_balance) || amount_b.gte(sui_balance_exclude_gas_reserve)) {
                    console.log('[ERROR] amount_a / b need greater than wallet amount after swap, rebalance again!');

                    position_state = PositionState.Swap;
                    break;
                }



                // perform add liquidity
                let digest_add_liquidity = '';

                const add_liquidity_payload_params: AddLiquidityFixTokenParams = {
                    coin_type_a: pools_add_liquidity[0].coin_type_a,
                    coin_type_b: pools_add_liquidity[0].coin_type_b,
                    pool_id: pools_add_liquidity[0].id,
                    tick_lower: tick_lower_index,
                    tick_upper: tick_upper_index,
                    fix_amount_a,
                    amount_a: amount_a.toString(),
                    amount_b: amount_b.toString(),
                    slippage: SLIPPAGE_FOR_ADD_LIQUIDITY,
                    is_open: true,
                    pos_id: '',
                    rewarder_coin_types: [],
                    collect_fee: false,
                }


                let tx_rsp: SuiTransactionBlockResponse | undefined = undefined;
                let retry_times = 5;
                while (true) {
                    try { // can not recover, process from the begining again
                        const add_liquidity_payload = await cetusClmmSDK.Position.createAddLiquidityFixTokenPayload(add_liquidity_payload_params);
                        dumpSDKRet2Logfile('Add Liquidity: cetusClmmSDK.Position.createAddLiquidityFixTokenPayload', JSON.stringify(add_liquidity_payload, null, 2));
                        console.log('[%s] - cetusClmmSDK.Position.createAddLiquidityFixTokenPayload - ', date.toLocaleString());

                        tx_rsp = await cetusClmmSDK.FullClient.sendTransaction(sendKeypair, add_liquidity_payload);
                        dumpSDKRet2Logfile('Add Liquidity: cetusClmmSDK.FullClient.sendTransaction', JSON.stringify(tx_rsp, null, 2));
                        console.log('[%s] - cetusClmmSDK.FullClient.sendTransaction: %s - ', date.toLocaleString(), tx_rsp?.effects?.status.status);
                        
                    } catch (e) {
                        if (e instanceof Error) {
                            console.error('%s [error] Add Liquidity get an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
                        } else {
                            console.error('[error] Add Liquidity get an exception'); 
                            console.error(e);
                        }
                        if (retry_times <= 0) {
                            console.error('no retry_times remains, return undefined. rebalance again');
                            tx_rsp = undefined;
                            break;
                        }
                        console.error('wait 2s and try again..., remain times: ', retry_times); 
                        await new Promise(f => setTimeout(f, 2000));
                        retry_times = retry_times - 1;
                        continue;
                    }
                    break;
                }

                if (tx_rsp == undefined) {
                    console.log('[error] Add Liquidity: cetusClmmSDK.FullClient.sendTransaction return undefined | exception exceed retry time, wait 2s and rebalance again...');
                    await new Promise(f => setTimeout(f, 2000));

                    position_state = PositionState.Swap;
                    break;
                }


                digest_add_liquidity = tx_rsp.digest;

                // get add_liquidity transaction info
                tx_info_add_liquidity = newTransactionInfo();
                let tx_opt_add_liquidity: TransactionInfoQueryOptions = {
                    get_total_gas_fee: true,
                    get_balance_change: true,
                    get_add_liquidity_event: true,
                    get_remove_liquidity_event: false,
                    get_fee_and_rwd: false   
                };
                await getTransactionInfo(digest_add_liquidity, tx_info_add_liquidity, tx_opt_add_liquidity, sendKeypair);
                tx_info_add_liquidity.type = 'add_liquidity';                

                tx_info_arr.push(cloneTransactionInfo(tx_info_add_liquidity));

                total_gas_fee_accumulate.iadd(tx_info_add_liquidity.total_gas_fee);
                console.log('total_gas_fee_accumulate: ', total_gas_fee_accumulate.toString());

                // dump add_liquidity transaction info
                console.log('');
                dumpTransactionInfo('Add Liquidity Transaction Rsp', tx_info_add_liquidity, tx_opt_add_liquidity);

                



                // wallet_balance_after_add_liquidity = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
                let wallet_balance: AllCoinAmounts = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
                let wallet_balance_before: AllCoinAmounts = {
                    usdc_amount: check_point_status_last.usdc_balance.toString(),
                    sui_amount: check_point_status_last.sui_balance.toString(),
                    cetus_amount: check_point_status_last.cetus_balance.toString()
                };

                while(true) { // try best to recover
                    try {
                        wallet_balance = await getAllWalletBalance(account_address);
                        // wait for wallet balance updated.
                        while (balanceNotChange(wallet_balance_before, wallet_balance)) {
                            date.setTime(Date.now());
                            console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());                            
                            console.log('[%s][WARNING] wallet_balance: usdc %s, sui %s, cetus %s',  date.toLocaleString(),
                                wallet_balance.usdc_amount, 
                                wallet_balance.sui_amount, 
                                wallet_balance.cetus_amount);
                            console.log('[%s][WARNING] wallet_balance_before: usdc %s, sui %s, cetus %s', date.toLocaleString(),
                                wallet_balance_before.usdc_amount, 
                                wallet_balance_before.sui_amount, 
                                wallet_balance_before.cetus_amount);
                            console.log('[%s][WARNING] wallet_balance of check_point_status_last: usdc %s, sui %s, cetus %s', date.toLocaleString(),
                                check_point_status_last.usdc_balance.toString(),
                                check_point_status_last.sui_balance.toString(),
                                check_point_status_last.cetus_balance.toString()
                            );
                            await new Promise(f => setTimeout(f, 1000));
                            wallet_balance = await getAllWalletBalance(account_address);
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


                

                // get price and value
                let sui_price_after_add_liquidity = d(0);

                pools_after_add_liquidity = null;
                while(true) {
                    try {
                        pools_after_add_liquidity = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
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

                let cetus_price_after_add_liquidity = d(0);
                cetus_pools_after_add_liquidity = null;
                while(true) {
                    try {
                        cetus_pools_after_add_liquidity = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_FOR_FEE]);
                        if (cetus_pools_after_add_liquidity == null || cetus_pools_after_add_liquidity.length <= 0) {
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
                cetus_price_after_add_liquidity = d(1).div(TickMath.tickIndexToPrice(cetus_pools_after_add_liquidity[0].current_tick_index, 6, 9));



                // get check_point_status
                check_point_status_after_add_liquidity = newCheckPointStatus();

                check_point_status_after_add_liquidity.unix_timestamp_ms = Date.now();
                check_point_status_after_add_liquidity.type = 'after_add_liquidity';

                check_point_status_after_add_liquidity.cur_tick_index_for_tx = current_tick_index;
                check_point_status_after_add_liquidity.tick_lower_index_for_tx = tick_lower_index;
                check_point_status_after_add_liquidity.tick_upper_index_for_tx = tick_upper_index;

                check_point_status_after_add_liquidity.usdc_sui_tick_index = pools_after_add_liquidity[0].current_tick_index;
                check_point_status_after_add_liquidity.sui_price = sui_price_after_add_liquidity;
                check_point_status_after_add_liquidity.usdc_cetus_tick_index = cetus_pools_after_add_liquidity[0].current_tick_index;
                check_point_status_after_add_liquidity.cetus_price = cetus_price_after_add_liquidity;

                check_point_status_after_add_liquidity.usdc_balance = new BN(wallet_balance.usdc_amount);
                check_point_status_after_add_liquidity.sui_balance = new BN(wallet_balance.sui_amount);
                check_point_status_after_add_liquidity.cetus_balance = new BN(wallet_balance.cetus_amount);

                check_point_status_after_add_liquidity.usdc_in_liquidity = tx_info_add_liquidity.liquidity_event.amount_a.clone();
                check_point_status_after_add_liquidity.sui_in_liquidity = tx_info_add_liquidity.liquidity_event.amount_b.clone();
                // no coin  fee rwd
                // usdc_fee = sui_fee = sui_rwd = cetus_rwd = 0

                check_point_status_arr.push(cloneCheckPointStatus(check_point_status_after_add_liquidity));

                // print
                console.log('');
                console.log(' - Check Point : After Add Liquidity - ');
                dumpCheckPoint(check_point_status_after_add_liquidity);

                let balance_liquidity_value_after_add_liquidity = calcBalanceLiquidityValue(sui_price_after_add_liquidity, cetus_price_after_add_liquidity, check_point_status_after_add_liquidity);
                console.log('Total Balance Liquidity Value: ', balance_liquidity_value_after_add_liquidity.total_value);
                console.log('');       


                // dump transaction statistics
                // dumpTransactionStatistics('Add Liquidity Transaction Stat.', check_point_status_last, check_point_status_after_add_liquidity, 
                //     sui_price_after_add_liquidity, digest_add_liquidity, tx_info_add_liquidity.total_gas_fee, tx_info_add_liquidity.balance_change);
                // console.log('');
                // console.log('');

                


                check_point_status_last = cloneCheckPointStatus(check_point_status_after_add_liquidity);

                

                // failed transaction, retry
                if (tx_rsp?.effects?.status.status !== "success") {
                    console.log('[error] Add Liquidity: cetusClmmSDK.FullClient.sendTransaction return failed, wait 2s and rebalance again...');
                    await new Promise(f => setTimeout(f, 2000));

                    position_state = PositionState.Swap;
                    break;
                }


            
                // db sync point 1
                position_info = newPositionInfo();
                if (save_to_db && db) {
                    position_info.unix_timestamp_ms = tx_info_add_liquidity.unix_timestamp_ms;
                    position_info.pos_id = tx_info_add_liquidity.liquidity_event.position;
                    position_info.is_open = 1;
                    await sqlite3_utils.insertPositionInfo(db, position_info);

                    await sqlite3_utils.tryCreateCheckPointStatusTable(db, position_info);
                    await sqlite3_utils.tryCreateTransactionInfoTable(db, position_info);

                    tx_info_arr_length_last = tx_info_arr.length;
                    for (const tx of tx_info_arr) {
                        await sqlite3_utils.insertTransactionInfo(db, position_info, tx);
                    }

                    check_point_status_arr_length_last = check_point_status_arr.length;
                    for (const chk of check_point_status_arr) {
                        await sqlite3_utils.insertCheckPointStatus(db, position_info, chk);
                    }
                    
                    // await sqlite3_utils.insertCheckPointStatus(db, position_info, check_point_status);

                    // for (const chk of check_point_status_after_swap_arr) {
                    //     await sqlite3_utils.insertCheckPointStatus(db, position_info, chk);
                    // }
                    // for (const chk of check_point_status_after_add_liquidity_arr) {
                    //     await sqlite3_utils.insertCheckPointStatus(db, position_info, chk);
                    // }

                    // for (const tx of tx_info_swap_arr) {
                    //     await sqlite3_utils.insertTransactionInfo(db, position_info, tx);
                    // }
                    // for (const tx of tx_info_add_liquidity_arr) {
                    //     await sqlite3_utils.insertTransactionInfo(db, position_info, tx);
                    // }
                }

                position_state = PositionState.PreRunning;

            } while(false);
        }











        if (position_state == PositionState.PreRunning) {
            console.log('');
            console.log('');
            console.log('--------------------------------------------------------');
            console.log('Stage PreRunning');
            console.log('--------------------------------------------------------');

            // calc impermanent loss and value loss in lower/upper bounder and print    
            tick_when_add_liquidity = getAddLiquidityTickIndex(
                tx_info_add_liquidity.liquidity_event, 
                check_point_status_after_add_liquidity.tick_lower_index_for_tx, 
                check_point_status_after_add_liquidity.tick_upper_index_for_tx);

            console.log('');
            console.log('Position Tick Range When Add Liquidity: %d - (%d) - %d', 
                check_point_status_after_add_liquidity.tick_lower_index_for_tx, 
                tick_when_add_liquidity, 
                check_point_status_after_add_liquidity.tick_upper_index_for_tx);



            impermanent_loss_ctx = getImpermanentLossCtx(
                check_point_status_after_add_liquidity.tick_lower_index_for_tx, 
                tick_when_add_liquidity, 
                check_point_status_after_add_liquidity.tick_upper_index_for_tx, 
                tx_info_add_liquidity.liquidity_event, 
                check_point_status, 
                check_point_status_after_add_liquidity);
            console.log(' - impermanent_loss_ctx - ');
            console.log(JSON.stringify(impermanent_loss_ctx, null, 2));
            console.log('');

            running_circle = 0;
            position_state = PositionState.Running;
        }














        if (position_state == PositionState.Running) {

            do {
                
                if (exit_and_close_position) {
                    console.log('exit_and_close_position has been set.');
                    position_state = PositionState.ClosePosition;
                    break;
                }

                await new Promise(f => setTimeout(f, 10000)); // 10s 

                // get new pool status for query pos status
                pools_running = null;
                while(true) {
                    try {
                        pools_running = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
                        if (pools_running == null || pools_running.length <= 0) {
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
                                
                let current_tick_index = pools_running[0].current_tick_index;
                // let tick_lower_index = initial_lower_boundary_seed + Math.floor((current_tick_index - initial_lower_boundary_seed) / POSITION_TICK_RANGE) * POSITION_TICK_RANGE;
                // let tick_upper_index = tick_lower_index + POSITION_TICK_RANGE;
                let tick_lower_index = check_point_status_after_add_liquidity.tick_lower_index_for_tx;
                let tick_upper_index = check_point_status_after_add_liquidity.tick_upper_index_for_tx;

                running_circle++;

                if (current_tick_index < check_point_status_after_swap.tick_lower_index_for_tx || current_tick_index > check_point_status_after_swap.tick_upper_index_for_tx) {
                    let tick_range_str_now = '';
                    if (current_tick_index < tick_lower_index) {
                        tick_range_str_now = util.format('(%d) - %d - %d (Pool Tick Now)', current_tick_index, tick_lower_index, tick_upper_index);
                    } else if (current_tick_index > tick_upper_index) {
                        tick_range_str_now = util.format('%d - %d - (%d) (Pool Tick Now)', tick_lower_index, tick_upper_index, current_tick_index);
                    } else {
                        tick_range_str_now = util.format('%d - (%d) - %d (Pool Tick Now)', tick_lower_index, current_tick_index, tick_upper_index);
                    }
                    console.log(tick_range_str_now);

                    if (current_tick_index < tick_lower_index) {
                        tick_range_str_now = util.format('(%d) - %d - %d (CoinB Price Now)', 
                            d(1).div(TickMath.tickIndexToPrice(current_tick_index, 6, 9)).toFixed(6).toString(), 
                            d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9)).toFixed(6).toString(),
                            d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9)).toFixed(6).toString());
                    } else if (current_tick_index > tick_upper_index) {
                        tick_range_str_now = util.format('%d - %d - (%d) (CoinB Price Now)',                        
                            d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9)).toFixed(6).toString(),
                            d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9)).toFixed(6).toString(),
                            d(1).div(TickMath.tickIndexToPrice(current_tick_index, 6, 9)).toFixed(6).toString());
                    } else {
                        tick_range_str_now = util.format('%d - (%d) - %d (CoinB Price Now)',                         
                            d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9)).toFixed(6).toString(),
                            d(1).div(TickMath.tickIndexToPrice(current_tick_index, 6, 9)).toFixed(6).toString(), 
                            d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9)).toFixed(6).toString());
                    }
                    console.log(tick_range_str_now);

                    // console.log('%d - (%d) - %d (Pool Tick Now)', tick_lower_index, current_tick_index, tick_upper_index);
                    // console.log('%d - (%d) - %d (CoinB Price Now)', 
                    //     d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9)).toFixed(6).toString(),
                    //     d(1).div(TickMath.tickIndexToPrice(current_tick_index, 6, 9)).toFixed(6).toString(),
                    //     d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9)).toFixed(6).toString());
                    console.log('Out of range. and running_circle = %d', running_circle);
                    // if (running_circle > 120) { // 6 * 20 min
                        // console.log('running_circle > 120, close position...');
                        position_state = PositionState.ClosePosition;
                        break;
                    // }
                }

                



                // get position
                positions_running = null;
                while(true) {
                    try {
                        positions_running = await cetusClmmSDK.Position.getPositionList(account_address, [POOL_ADDRESS], false);
                        if (positions_running == null || positions_running.length <= 0) {
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
                        fee_and_reward = await getFeeAndReward(pools_running[0], positions_running[0]);
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
                let sui_price_running = d(1).div(TickMath.tickIndexToPrice(pools_running[0].current_tick_index, 6, 9));

                let cetus_price_running = d(0);
                cetus_pools_running = null;
                while(true) {
                    try {
                        cetus_pools_running = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_FOR_FEE]);
                        if (cetus_pools_running == null || cetus_pools_running.length <= 0) {
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
                cetus_price_running = d(1).div(TickMath.tickIndexToPrice(cetus_pools_running[0].current_tick_index, 6, 9));


                // print
                date.setTime(Date.now());
                console.log('');
                console.log('');
                console.log('[%s] - New Cycle - (running_circle: %d)', date.toLocaleString(), running_circle);


                console.log('%d - (%d) - %d (Pool Tick for Swap)', 
                    check_point_status_after_swap.tick_lower_index_for_tx, 
                    check_point_status_after_swap.cur_tick_index_for_tx, 
                    check_point_status_after_swap.tick_upper_index_for_tx);
                console.log('%d - (%d) - %d (Pool Tick for Add Liquidity)', 
                    check_point_status_after_add_liquidity.tick_lower_index_for_tx, 
                    check_point_status_after_add_liquidity.cur_tick_index_for_tx, 
                    check_point_status_after_add_liquidity.tick_upper_index_for_tx, );
                console.log('%d - (%d) - %d (Pool Tick just Add Liquidity)', 
                    check_point_status_after_add_liquidity.tick_lower_index_for_tx, 
                    tick_when_add_liquidity, 
                    check_point_status_after_add_liquidity.tick_upper_index_for_tx);

                let tick_range_str_now = '';
                if (current_tick_index < tick_lower_index) {
                    tick_range_str_now = util.format('(%d) - %d - %d (Pool Tick Now)', current_tick_index, tick_lower_index, tick_upper_index);
                } else if (current_tick_index > tick_upper_index) {
                    tick_range_str_now = util.format('%d - %d - (%d) (Pool Tick Now)', tick_lower_index, tick_upper_index, current_tick_index);
                } else {
                    tick_range_str_now = util.format('%d - (%d) - %d (Pool Tick Now)', tick_lower_index, current_tick_index, tick_upper_index);
                }
                console.log(tick_range_str_now);

                if (current_tick_index < tick_lower_index) {
                    tick_range_str_now = util.format('(%d) - %d - %d (CoinB Price Now)', 
                        d(1).div(TickMath.tickIndexToPrice(current_tick_index, 6, 9)).toFixed(6).toString(), 
                        d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9)).toFixed(6).toString(),
                        d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9)).toFixed(6).toString());
                } else if (current_tick_index > tick_upper_index) {
                    tick_range_str_now = util.format('%d - %d - (%d) (CoinB Price Now)',                        
                        d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9)).toFixed(6).toString(),
                        d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9)).toFixed(6).toString(),
                        d(1).div(TickMath.tickIndexToPrice(current_tick_index, 6, 9)).toFixed(6).toString());
                } else {
                    tick_range_str_now = util.format('%d - (%d) - %d (CoinB Price Now)',                         
                        d(1).div(TickMath.tickIndexToPrice(tick_lower_index, 6, 9)).toFixed(6).toString(),
                        d(1).div(TickMath.tickIndexToPrice(current_tick_index, 6, 9)).toFixed(6).toString(), 
                        d(1).div(TickMath.tickIndexToPrice(tick_upper_index, 6, 9)).toFixed(6).toString());
                }
                console.log(tick_range_str_now);
                

                // get total fee and rwd value
                let fee_and_reward_value = getFeeAndRewardValue(sui_price_running, cetus_price_running, fee_and_reward);
                
                console.log('');
                console.log('sui_price_running: %s  |  cetus_price_running: %s', 
                    sui_price_running.toFixed(10).toString(), 
                    cetus_price_running.toFixed(10).toString());
                console.log('- Fee and Rewards Amount, Value(Current Price) - ');
                console.log('Fee USDC: %s, Value Earnings: %s  |  Fee SUI: %s,  Value Earnings: %s', 
                    fee_and_reward.fee_owned_a.toString(),
                    fee_and_reward_value.fee_usdc_value.toString(),
                    fee_and_reward.fee_owned_b.toString(),
                    fee_and_reward_value.fee_sui_value.toString()
                );
                console.log('Reward SUI: %s, Value Earnings: %s  |  Reward CETUS: %s, Value Earnings: %s', 
                    fee_and_reward.rwd_owned_sui.toString(),
                    fee_and_reward_value.rwd_sui_value.toString(),
                    fee_and_reward.rwd_owned_cetus.toString(),
                    fee_and_reward_value.rwd_cetus_value.toString()
                );
                console.log('Total Value Earnings(Current Price): ', fee_and_reward_value.total_value);


                let cetus_price_lower_index = cetus_price_running.mul(impermanent_loss_ctx.sui_price_lower_index).div(sui_price_running);
                let fee_and_reward_value_lower_index = getFeeAndRewardValue(impermanent_loss_ctx.sui_price_lower_index, cetus_price_lower_index, fee_and_reward);

                let cetus_price_upper_index = cetus_price_running.mul(impermanent_loss_ctx.sui_price_upper_index).div(sui_price_running);
                let fee_and_reward_value_upper_index = getFeeAndRewardValue(impermanent_loss_ctx.sui_price_upper_index, cetus_price_upper_index, fee_and_reward);


                console.log('--------------------------------------------------------');
                dumpImpermanentLossAndEarningRatio(impermanent_loss_ctx, fee_and_reward_value_lower_index, fee_and_reward_value_upper_index);
                console.log('--------------------------------------------------------');




                // dump current benifit                

                

                const coin_amount_in_pos = ClmmPoolUtil.getCoinAmountFromLiquidity(
                    new BN(positions_running[0].liquidity), 
                    TickMath.tickIndexToSqrtPriceX64(current_tick_index),
                    TickMath.tickIndexToSqrtPriceX64(tick_lower_index),
                    TickMath.tickIndexToSqrtPriceX64(tick_upper_index),
                    true
                );

                let check_point_status_running = newCheckPointStatus();
                check_point_status_running.unix_timestamp_ms = Date.now();
                check_point_status_running.type = 'running';

                // no tx of this check point
                // cur_tick_index_for_tx = tick_lower_index_for_tx = tick_upper_index_for_tx = 0

                check_point_status_running.usdc_sui_tick_index = pools_running[0].current_tick_index;
                check_point_status_running.sui_price = sui_price_running;
                check_point_status_running.usdc_cetus_tick_index = cetus_pools_running[0].current_tick_index;
                check_point_status_running.cetus_price = cetus_price_running;

                check_point_status_running.usdc_balance = check_point_status_after_add_liquidity.usdc_balance.clone();
                check_point_status_running.sui_balance = check_point_status_after_add_liquidity.sui_balance.clone();
                check_point_status_running.cetus_balance = check_point_status_after_add_liquidity.cetus_balance.clone();

                check_point_status_running.usdc_in_liquidity = new BN(coin_amount_in_pos.coin_amount_a);
                check_point_status_running.sui_in_liquidity = new BN(coin_amount_in_pos.coin_amount_b);

                check_point_status_running.usdc_fee = fee_and_reward.fee_owned_a.clone();
                check_point_status_running.sui_fee = fee_and_reward.fee_owned_b.clone();
                check_point_status_running.sui_rwd = fee_and_reward.rwd_owned_sui.clone();
                check_point_status_running.cetus_rwd = fee_and_reward.rwd_owned_cetus.clone();
                
                
                

                let liquidity_value = calcLiquidityValue(sui_price_running, check_point_status_running);
                let balance_liquidity_value = calcBalanceLiquidityValue(sui_price_running, cetus_price_running, check_point_status_running);
                console.log('Usage Status in Value (liquidity / liquidity + balance / percentage): %s / %s / %s%%', 
                    liquidity_value.total_value.toFixed(6),
                    balance_liquidity_value.total_value.toFixed(6),
                    liquidity_value.total_value.div(balance_liquidity_value.total_value).mul(100).toFixed(6)
                );

                let benefit_stat = newBenefitStatisticsCtx();
                benefit_stat.total_gas_fee = total_gas_fee_accumulate.clone();
                benefit_stat.total_gas_fee_value = Decimal(benefit_stat.total_gas_fee.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_after_add_liquidity.sui_price);

                benefit_stat.fee_and_rwd_value = fee_and_reward_value;
                benefit_stat.fee_and_rwd = cloneFeeAndReward(fee_and_reward);

                benefit_stat.balance_liquidity_value_initial = calcBalanceLiquidityValue(check_point_status.sui_price, check_point_status.cetus_price, check_point_status).total_value;
                benefit_stat.balance_liquidity_value_now = calcBalanceLiquidityValue(sui_price_running, cetus_price_running, check_point_status_running).total_value;

                benefit_stat.all_value_initial = calcAllValue(check_point_status.sui_price, check_point_status.cetus_price, check_point_status).total_value;
                benefit_stat.all_value_now = calcAllValue(sui_price_running, cetus_price_running, check_point_status_running).total_value;
                benefit_stat.all_value_now_if_hold_all = calcAllValue(sui_price_running, cetus_price_running, check_point_status).total_value;
                benefit_stat.all_value_now_if_hold_usdc = benefit_stat.all_value_initial;                
                benefit_stat.all_value_now_if_hold_sui = benefit_stat.all_value_initial.div(check_point_status.sui_price).mul(sui_price_running);                

                benefit_stat.benefit_now_if_hold_all = benefit_stat.all_value_now.sub(benefit_stat.all_value_now_if_hold_all);
                benefit_stat.benefit_now_if_hold_usdc = benefit_stat.all_value_now.sub(benefit_stat.all_value_now_if_hold_usdc);
                benefit_stat.benefit_now_if_hold_sui = benefit_stat.all_value_now.sub(benefit_stat.all_value_now_if_hold_sui);
                
                console.log('--------------------------------------------------------');
                dumpBenefitStatistics(benefit_stat);
                console.log('--------------------------------------------------------');
                dumpBenefitStatisticsHistory(benefit_stat, position_info_history_stat, check_point_status_first, sui_price_running, cetus_price_running);
                console.log('--------------------------------------------------------');


                


                position_state = PositionState.Running;
            } while(false);
        }










        if (position_state == PositionState.ClosePosition) {
            do {
                console.log('');
                console.log('');
                console.log('--------------------------------------------------------');
                console.log('Stage ClosePosition');
                console.log('--------------------------------------------------------');

                pools_close_position = null;
                positions_close_position = null;

                while(true) {
                    try {
                        pools_close_position = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
                        if (pools_close_position == null || pools_close_position.length <= 0) {
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

                while(true) {
                    try {
                        positions_close_position = await cetusClmmSDK.Position.getPositionList(account_address, [POOL_ADDRESS], false);
                        if (positions_close_position == null || positions_close_position.length <= 0) {
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




                // close position
                let tx_rsp = await closePosition(pools_close_position[0], positions_close_position[0], sendKeypair);

                if (tx_rsp == undefined) { // exception exceed retry times
                    console.log('[error] Close Position: cetusClmmSDK.FullClient.sendTransaction exception exceed retry time, wait 2s and try again...');
                    await new Promise(f => setTimeout(f, 2000));
                    position_state = PositionState.ClosePosition;
                    break;
                }


                let digest_close_position = tx_rsp.digest;
                // get close transaction info
                tx_info_close_position = newTransactionInfo();
                let tx_opt_close_position: TransactionInfoQueryOptions = {
                    get_total_gas_fee: true,
                    get_balance_change: true,
                    get_add_liquidity_event: false, 
                    get_remove_liquidity_event: true,
                    get_fee_and_rwd: true
                };

                await getTransactionInfo(digest_close_position, tx_info_close_position, tx_opt_close_position, sendKeypair);
                tx_info_close_position.type = 'close_position';

                tx_info_arr.push(cloneTransactionInfo(tx_info_close_position));

                total_gas_fee_accumulate.iadd(tx_info_close_position.total_gas_fee);
                console.log('total_gas_fee_accumulate: ', total_gas_fee_accumulate.toString());

                // dump close transaction info
                console.log('');
                dumpTransactionInfo('Close Position Transaction Rsp', tx_info_close_position, tx_opt_close_position);

                

                


                // wallet_balance_after_close_position = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
                let wallet_balance: AllCoinAmounts = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
                let wallet_balance_before: AllCoinAmounts = {
                    usdc_amount: check_point_status_last.usdc_balance.toString(),
                    sui_amount: check_point_status_last.sui_balance.toString(),
                    cetus_amount: check_point_status_last.cetus_balance.toString()
                };
                while(true) {
                    try {
                        wallet_balance = await getAllWalletBalance(account_address);
                        // wait for wallet balance updated.
                        while (balanceNotChange(wallet_balance_before, wallet_balance)) {
                            date.setTime(Date.now());
                            console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());
                            console.log('[%s][WARNING] wallet_balance: usdc %s, sui %s, cetus %s', date.toLocaleString(),
                                wallet_balance.usdc_amount, 
                                wallet_balance.sui_amount, 
                                wallet_balance.cetus_amount);
                            console.log('[%s][WARNING] wallet_balance_before: usdc %s, sui %s, cetus %s', date.toLocaleString(),
                                wallet_balance_before.usdc_amount, 
                                wallet_balance_before.sui_amount, 
                                wallet_balance_before.cetus_amount);
                            console.log('[%s][WARNING] wallet_balance of check_point_status_last: usdc %s, sui %s, cetus %s', date.toLocaleString(),
                                check_point_status_last.usdc_balance.toString(),
                                check_point_status_last.sui_balance.toString(),
                                check_point_status_last.cetus_balance.toString()
                            );
                            await new Promise(f => setTimeout(f, 1000));
                            wallet_balance = await getAllWalletBalance(account_address);
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
                

                // get price and value
                let sui_price_after_close_position = d(0);
                pools_after_close_position = null;
                while(true) {
                    try {
                        pools_after_close_position = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
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

                let cetus_price_after_close_position = d(0);
                cetus_pools_after_close_position = null;
                while(true) {
                    try {
                        cetus_pools_after_close_position = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_FOR_FEE]);
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
                cetus_price_after_close_position = d(1).div(TickMath.tickIndexToPrice(cetus_pools_after_close_position[0].current_tick_index, 6, 9));



                // get check_point_status
                check_point_status_after_close_position = newCheckPointStatus();
                check_point_status_after_close_position.unix_timestamp_ms = Date.now();
                check_point_status_after_close_position.type = 'after_close_position';

                // no tx of this check point
                // cur_tick_index_for_tx = tick_lower_index_for_tx = tick_upper_index_for_tx = 0

                check_point_status_after_close_position.usdc_sui_tick_index = pools_after_close_position[0].current_tick_index;
                check_point_status_after_close_position.sui_price = sui_price_after_close_position;
                check_point_status_after_close_position.usdc_cetus_tick_index = cetus_pools_after_close_position[0].current_tick_index;
                check_point_status_after_close_position.cetus_price = cetus_price_after_close_position;

                check_point_status_after_close_position.usdc_balance = new BN(wallet_balance.usdc_amount);
                check_point_status_after_close_position.sui_balance = new BN(wallet_balance.sui_amount);
                check_point_status_after_close_position.cetus_balance = new BN(wallet_balance.cetus_amount);

                // no coin in liquidity and fee rwd
                // usdc_in_liquidity = sui_in_liquidity = usdc_fee = sui_fee = sui_rwd = cetus_rwd = 0

                check_point_status_arr.push(cloneCheckPointStatus(check_point_status_after_close_position));
                
                
                

                // print
                console.log('');
                console.log(' - Check Point : After Close Position - ');
                dumpCheckPoint(check_point_status_after_close_position);

                let balance_liquidity_value_after_close_position = calcBalanceLiquidityValue(sui_price_after_close_position, cetus_price_after_close_position,check_point_status_after_close_position);
                console.log('Total Balance Liquidity Value: ', balance_liquidity_value_after_close_position.total_value);
                console.log('');

                // dump transaction statistics
                // dumpTransactionStatistics('Close Position Transaction Stat.', check_point_status_last, check_point_status_after_close_position, 
                //     sui_price_after_close_position, digest_close_position, tx_info_close_position.total_gas_fee, tx_info_close_position.balance_change);
                // console.log('');
                // console.log('');

                
                check_point_status_last = cloneCheckPointStatus(check_point_status_after_close_position);

                



                if (tx_rsp?.effects?.status.status !== "success") {
                    console.log('[error] Close Position: cetusClmmSDK.FullClient.sendTransaction return failed, wait 2s and try again...');
                    await new Promise(f => setTimeout(f, 2000));
                    position_state = PositionState.ClosePosition;
                    break;
                }

                position_state = PositionState.PostProcess;                
            } while(false);
        }






        if (position_state == PositionState.PostProcess) {

            do {
                console.log('');
                console.log('');
                console.log('--------------------------------------------------------');
                console.log('Stage PostProcess');
                console.log('--------------------------------------------------------');


                console.log('Cetus balance: %s, swap threshold 100 * 1000000000 Cetus', check_point_status_after_close_position.cetus_balance.toString());
                if (check_point_status_after_close_position.cetus_balance.gt(new BN('100').mul(new BN('1000000000')))) { // 100 cetus
                    // swap cetus to usdc

                    // check and perform coin merge for cetus
                    let coin_balance = await cetusClmmSDK.FullClient.getBalance({
                        owner: account_address,
                        coinType: COIN_TYPE_ADDRESS_CETUS
                    });
                    if (coin_balance.coinObjectCount >= 50) {
                        let coins_object_cetus = await getCoins(account_address, COIN_TYPE_ADDRESS_CETUS);
                        if (coins_object_cetus.length){
                            let tx_rsp = await mergeCoin(coins_object_cetus, sendKeypair);
                            if (tx_rsp == undefined) {
                                console.log('mergeCoin CETUS tx_rsp = null, process continue.'); 
                            } else {
                                // get swap transaction info
                                tx_info_merge_coin_cetus = newTransactionInfo();
                                let tx_opt_merge_coin_cetus: TransactionInfoQueryOptions = {
                                    get_total_gas_fee: true,
                                    get_balance_change: true,
                                    get_add_liquidity_event: false,
                                    get_remove_liquidity_event: false,
                                    get_fee_and_rwd: false   
                                };
                                await getTransactionInfo(tx_rsp.digest, tx_info_merge_coin_cetus, tx_opt_merge_coin_cetus, sendKeypair);
                                tx_info_merge_coin_cetus.type = 'merge_coin_cetus';

                                tx_info_arr.push(cloneTransactionInfo(tx_info_merge_coin_cetus));

                                total_gas_fee_accumulate.iadd(tx_info_merge_coin_cetus.total_gas_fee);
                                console.log('total_gas_fee_accumulate: ', total_gas_fee_accumulate.toString());

                                // dump add_liquidity transaction info
                                console.log('');
                                dumpTransactionInfo('Merge Coin Cetus Transaction Rsp', tx_info_merge_coin_cetus, tx_opt_merge_coin_cetus);

                                if (tx_rsp.effects?.status.status === 'failure') {
                                    console.log('mergeCoin CETUS mergeCoin return failure, process continue.');
                                }
                            }
                        }
                    }
                    



                
                    let digest_post_process = '';

                    let tx_rsp = await aggregatorSwap(
                        COIN_TYPE_ADDRESS_CETUS,
                        COIN_TYPE_ADDRESS_USDC,
                        check_point_status_after_close_position.cetus_balance.clone(),
                        true,
                        sendKeypair
                    );

                    if (tx_rsp == undefined) {
                        console.log('[error] Post Process Aggregator Swap: exception exceed retry time, wait 2s and try again...'); 
                        await new Promise(f => setTimeout(f, 2000));

                        position_state = PositionState.PostProcess;
                        break;
                    }

                    // success or failed(maybe insufficient gas) tx with gas use
                    digest_post_process = tx_rsp.digest;

                    // get swap transaction info
                    tx_info_cetus_aggregator_swap = newTransactionInfo();
                    let tx_opt_post_process: TransactionInfoQueryOptions = {
                        get_total_gas_fee: true,
                        get_balance_change: true,
                        get_add_liquidity_event: false,
                        get_remove_liquidity_event: false,
                        get_fee_and_rwd: false   
                    };
                    await getTransactionInfo(digest_post_process, tx_info_cetus_aggregator_swap, tx_opt_post_process, sendKeypair);
                    tx_info_cetus_aggregator_swap.type = 'cetus_aggregator_swap';

                    tx_info_arr.push(cloneTransactionInfo(tx_info_cetus_aggregator_swap));

                    total_gas_fee_accumulate.iadd(tx_info_cetus_aggregator_swap.total_gas_fee);
                    console.log('total_gas_fee_accumulate: ', total_gas_fee_accumulate.toString());

                    // dump add_liquidity transaction info
                    console.log('');
                    dumpTransactionInfo('Post Process Aggregator Swap Transaction Rsp', tx_info_cetus_aggregator_swap, tx_opt_post_process);                    





                    // wallet_balance_after_swap = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
                    let wallet_balance: AllCoinAmounts = {usdc_amount: '0', sui_amount: '0', cetus_amount: '0'};
                    let wallet_balance_before: AllCoinAmounts = {
                        usdc_amount: check_point_status_last.usdc_balance.toString(),
                        sui_amount: check_point_status_last.sui_balance.toString(),
                        cetus_amount: check_point_status_last.cetus_balance.toString()
                    };
                    while(true) { // try best to recover
                        try {
                            wallet_balance = await getAllWalletBalance(account_address);
                            // wait for wallet balance updated.
                            while (balanceNotChange(wallet_balance_before, wallet_balance)) {
                                date.setTime(Date.now());
                                console.log('[%s][WARNING] balanceNotChange, wait 1 second... ', date.toLocaleString());                            
                                console.log('[%s][WARNING] wallet_balance: usdc %s, sui %s, cetus %s', 
                                    wallet_balance.usdc_amount, 
                                    wallet_balance.sui_amount, 
                                    wallet_balance.cetus_amount);
                                console.log('[%s][WARNING] wallet_balance_before: usdc %s, sui %s, cetus %s', date.toLocaleString(),
                                    wallet_balance_before.usdc_amount, 
                                    wallet_balance_before.sui_amount, 
                                    wallet_balance_before.cetus_amount);
                                console.log('[%s][WARNING] wallet_balance of check_point_status_last: usdc %s, sui %s, cetus %s', date.toLocaleString(),
                                    check_point_status_last.usdc_balance.toString(),
                                    check_point_status_last.sui_balance.toString(),
                                    check_point_status_last.cetus_balance.toString()
                                );
                                await new Promise(f => setTimeout(f, 1000));
                                wallet_balance = await getAllWalletBalance(account_address);
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


                    // get price and value
                    let sui_price_after_post_process = d(0);
                    pools_after_post_process = null;
                    while(true) { // try best to recover
                        try {
                            pools_after_post_process = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
                            if (pools_after_post_process == null || pools_after_post_process.length <= 0) {
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
                    sui_price_after_post_process = d(1).div(TickMath.tickIndexToPrice(pools_after_post_process[0].current_tick_index, 6, 9));

                    let cetus_price_after_post_process = d(0);
                    cetus_pools_after_post_process = null;
                    while(true) {
                        try {
                            cetus_pools_after_post_process = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_FOR_FEE]);
                            if (cetus_pools_after_post_process == null || cetus_pools_after_post_process.length <= 0) {
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
                    cetus_price_after_post_process = d(1).div(TickMath.tickIndexToPrice(cetus_pools_after_post_process[0].current_tick_index, 6, 9));


                    // get check_point_status
                    check_point_status_after_post_process = newCheckPointStatus();
                    check_point_status_after_post_process.unix_timestamp_ms = Date.now();
                    check_point_status_after_post_process.type = 'after_post_process';

                    // no tx of this check point
                    // cur_tick_index_for_tx = tick_lower_index_for_tx = tick_upper_index_for_tx = 0

                    check_point_status_after_post_process.usdc_sui_tick_index = pools_after_post_process[0].current_tick_index;
                    check_point_status_after_post_process.sui_price = sui_price_after_post_process;
                    check_point_status_after_post_process.usdc_cetus_tick_index = cetus_pools_after_post_process[0].current_tick_index;
                    check_point_status_after_post_process.cetus_price = cetus_price_after_post_process;

                    check_point_status_after_post_process.usdc_balance = new BN(wallet_balance.usdc_amount);
                    check_point_status_after_post_process.sui_balance = new BN(wallet_balance.sui_amount);
                    check_point_status_after_post_process.cetus_balance = new BN(wallet_balance.cetus_amount);

                    // no coin in liquidity and fee rwd
                    // usdc_in_liquidity = sui_in_liquidity = usdc_fee = sui_fee = sui_rwd = cetus_rwd = 0

                    check_point_status_arr.push(cloneCheckPointStatus(check_point_status_after_post_process));




                    // print
                    console.log('');
                    console.log(' - Check Point : After Post Process - ');
                    dumpCheckPoint(check_point_status_after_post_process);

                    let balance_liquidity_value_after_post_process = calcBalanceLiquidityValue(sui_price_after_post_process, cetus_price_after_post_process, check_point_status_after_post_process);
                    console.log('Total Balance Liquidity Value: ', balance_liquidity_value_after_post_process.total_value);
                    console.log('');


                    // dump transaction statistics
                    // dumpTransactionStatistics('Swap Transaction Stat.', check_point_status_last, check_point_status_after_swap, 
                    //     sui_price_after_swap, digest_swap, tx_info_aggregator_swap.total_gas_fee, tx_info_aggregator_swap.balance_change);
                    // console.log('');
                    // console.log('');
                    
                    check_point_status_last = cloneCheckPointStatus(check_point_status_after_post_process);


                    if (tx_rsp.effects?.status.status !== "success") {
                        console.log('[error] Post Process Aggregator Swap: client.signAndExecuteTransaction return failed, wait 2s and try again...'); 
                        await new Promise(f => setTimeout(f, 2000));

                        position_state = PositionState.PostProcess;
                        break;
                    }
                }


                let benefit_stat = newBenefitStatisticsCtx();
                benefit_stat.total_gas_fee = total_gas_fee_accumulate.clone();
                benefit_stat.total_gas_fee_value = Decimal(benefit_stat.total_gas_fee.toString()).mul(Decimal.pow(10, -9)).mul(check_point_status_last.sui_price);

                benefit_stat.fee_and_rwd = cloneFeeAndReward(tx_info_close_position.fee_and_reward);
                benefit_stat.fee_and_rwd_value = getFeeAndRewardValue(
                    check_point_status_last.sui_price, 
                    check_point_status_last.cetus_price, 
                    tx_info_close_position.fee_and_reward);
                

                benefit_stat.balance_liquidity_value_initial = calcBalanceLiquidityValue(check_point_status.sui_price, check_point_status.cetus_price, check_point_status).total_value;
                benefit_stat.balance_liquidity_value_now = calcBalanceLiquidityValue(check_point_status_last.sui_price, check_point_status_last.cetus_price, check_point_status_last).total_value;

                benefit_stat.all_value_initial = calcAllValue(check_point_status.sui_price, check_point_status.cetus_price, check_point_status).total_value;
                benefit_stat.all_value_now = calcAllValue(check_point_status_last.sui_price, check_point_status_last.cetus_price, check_point_status_last).total_value;
                benefit_stat.all_value_now_if_hold_all = calcAllValue(check_point_status_last.sui_price, check_point_status_last.cetus_price, check_point_status).total_value;
                benefit_stat.all_value_now_if_hold_usdc = benefit_stat.all_value_initial;                
                benefit_stat.all_value_now_if_hold_sui = benefit_stat.all_value_initial.div(check_point_status.sui_price).mul(check_point_status_last.sui_price);                

                benefit_stat.benefit_now_if_hold_all = benefit_stat.all_value_now.sub(benefit_stat.all_value_now_if_hold_all);
                benefit_stat.benefit_now_if_hold_usdc = benefit_stat.all_value_now.sub(benefit_stat.all_value_now_if_hold_usdc);
                benefit_stat.benefit_now_if_hold_sui = benefit_stat.all_value_now.sub(benefit_stat.all_value_now_if_hold_sui);
                
                // console.log('--------------------------------------------------------');
                dumpBenefitStatistics(benefit_stat);
                console.log('--------------------------------------------------------');
                dumpBenefitStatisticsHistory(benefit_stat, position_info_history_stat, check_point_status_first, check_point_status_last.sui_price, check_point_status_last.cetus_price);
                console.log('--------------------------------------------------------');



                // update position_info_history_stat after close
                position_info_history_stat.benefit_holding_coin_ab = position_info_history_stat.benefit_holding_coin_ab.add(benefit_stat.benefit_now_if_hold_all);
                position_info_history_stat.benefit_holding_coin_a = position_info_history_stat.benefit_holding_coin_a.add(benefit_stat.benefit_now_if_hold_usdc);
                position_info_history_stat.benefit_holding_coin_b = position_info_history_stat.benefit_holding_coin_b.add(benefit_stat.benefit_now_if_hold_sui);

                position_info_history_stat.fee_coin_a.iadd(benefit_stat.fee_and_rwd.fee_owned_a);
                position_info_history_stat.fee_coin_b.iadd(benefit_stat.fee_and_rwd.fee_owned_b);
                position_info_history_stat.rwd_sui.iadd(benefit_stat.fee_and_rwd.rwd_owned_sui);
                position_info_history_stat.rwd_cetus.iadd(benefit_stat.fee_and_rwd.rwd_owned_cetus);

                position_info_history_stat.total_gas_used.iadd(total_gas_fee_accumulate);



                // db sync point 2
                if (save_to_db && db) {
                    position_info.is_open = 0;
                    position_info.close_unix_timestamp_ms = tx_info_close_position.unix_timestamp_ms;
                    position_info.close_tick_index = check_point_status_after_close_position.usdc_sui_tick_index;
                    position_info.close_tick_index_cetus = check_point_status_after_close_position.usdc_cetus_tick_index;

                    position_info.total_gas_used = benefit_stat.total_gas_fee.clone();

                    position_info.fee_coin_a = tx_info_close_position.fee_and_reward.fee_owned_a.clone();
                    position_info.fee_coin_b = tx_info_close_position.fee_and_reward.fee_owned_b.clone();
                    position_info.rwd_sui = tx_info_close_position.fee_and_reward.rwd_owned_sui.clone();
                    position_info.rwd_cetus = tx_info_close_position.fee_and_reward.rwd_owned_cetus.clone();

                    position_info.benefit_holding_coin_ab = benefit_stat.benefit_now_if_hold_all;
                    position_info.benefit_holding_coin_a = benefit_stat.benefit_now_if_hold_usdc;
                    position_info.benefit_holding_coin_b = benefit_stat.benefit_now_if_hold_sui;

                    await sqlite3_utils.updatePositionInfo(db, position_info);

                    if (check_point_status_arr.length > check_point_status_arr_length_last) {
                        for (const chk of check_point_status_arr.slice(check_point_status_arr_length_last)) {
                            await sqlite3_utils.insertCheckPointStatus(db, position_info, chk);
                        }
                        check_point_status_arr_length_last = check_point_status_arr.length;
                    }

                    if (tx_info_arr.length > tx_info_arr_length_last) {
                        for (const tx of tx_info_arr.slice(tx_info_arr_length_last)) {
                            await sqlite3_utils.insertTransactionInfo(db, position_info, tx);
                        }
                        tx_info_arr_length_last = tx_info_arr.length;
                    }

                    // for (const chk of check_point_status_after_close_position_arr) {
                    //     await sqlite3_utils.insertCheckPointStatus(db, position_info, chk);
                    // }

                    // for (const chk of check_point_status_after_post_process_arr) {
                    //     await sqlite3_utils.insertCheckPointStatus(db, position_info, chk);
                    // }

                    // for (const tx of tx_info_close_position_arr) {
                    //     await sqlite3_utils.insertTransactionInfo(db, position_info, tx);
                    // }  

                    // for (const tx of tx_info_post_process_arr) {
                    //     await sqlite3_utils.insertTransactionInfo(db, position_info, tx);
                    // }              
                }
                position_state = PositionState.Clean;

            } while(false);
        }




        if (position_state == PositionState.Clean) {
            console.log('');
            console.log('');
            console.log('--------------------------------------------------------');
            console.log('Stage Clean');
            console.log('--------------------------------------------------------');

            // reset global value
            position_info = newPositionInfo();

            // Initial
            check_point_status = newCheckPointStatus();
            pools = null;

            // Swap
            pools_swap = null;
            tx_info_merge_coin_usdc = null;
            tx_info_merge_coin_sui = null;
            tx_info_aggregator_swap = newTransactionInfo();
            check_point_status_after_swap = newCheckPointStatus();            
            pools_after_swap = null;

            // Add Liquidity
            pools_add_liquidity = null;
            tx_info_add_liquidity = newTransactionInfo();
            check_point_status_after_add_liquidity = newCheckPointStatus();
            pools_after_add_liquidity = null;


            // Running
            pools_running = null;
            cetus_pools_running = null;
            positions_running = null;


            // Close position
            pools_close_position = null;
            positions_close_position = null;
            tx_info_close_position = newTransactionInfo();
            check_point_status_after_close_position = newCheckPointStatus();
            pools_after_close_position = null;
            cetus_pools_after_close_position = null;

            // Post Process
            tx_info_merge_coin_cetus = null;
            tx_info_cetus_aggregator_swap = null;
            check_point_status_after_post_process = null;
            pools_after_post_process = null;
            cetus_pools_after_post_process = null;

            // helper
            // check_point_status_first = newCheckPointStatus();
            // check_point_status_last = newCheckPointStatus();
            tx_info_arr = [];
            tx_info_arr_length_last = 0;
            check_point_status_arr = [];
            check_point_status_arr_length_last = 0;

            total_gas_fee_accumulate = new BN(0);
            tick_when_add_liquidity = 0;

            impermanent_loss_ctx = newImpermanentLossCtx();
            running_circle = 0;
            running_circle_in_range = 0;


            if (exit_and_close_position) {
                exit = true;
            }

            position_state = PositionState.Initial;
        }
    } // for(;;)

    if (save_to_db && db) {
        db.close();
    }
    exit_process_finished = true;
    console.log('====== Exit =======');
}

main();










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

async function getCurrentSuiPrice() {
    // SUI-USDC 0.05%, 0x51e883ba7c0b566a26cbc8a94cd33eb0abd418a77cc1e60ad22fd9b1f29cd2ab
    let price = d(0)
    const pools = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS]);
    if (pools.length) {
        price = d(1).div(TickMath.tickIndexToPrice(pools[0].current_tick_index, 6, 9));
    }
    return price;
}

async function getCurrentCetusPrice() {
    // SUI-USDC 0.05%, 0x51e883ba7c0b566a26cbc8a94cd33eb0abd418a77cc1e60ad22fd9b1f29cd2ab
    let price = d(0)
    const pools = await cetusClmmSDK.Pool.getAssignPools([POOL_ADDRESS_FOR_FEE]);
    if (pools.length) {
        price = d(1).div(TickMath.tickIndexToPrice(pools[0].current_tick_index, 6, 9));
    }
    return price;
}
