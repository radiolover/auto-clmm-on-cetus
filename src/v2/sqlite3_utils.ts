

import * as sqlite3 from 'sqlite3';
import Decimal from 'decimal.js';
import BN from 'bn.js'
import * as util from 'util';



import {PositionInfo, CheckPointStatus, TransactionInfo, newPositionInfo, newCheckPointStatus, newTransactionInfo} from './miner'


const SQLITE_DB_FILE_NAME = 'PositionInfo.db';


type PositionInfoDB = { 
    unix_timestamp_ms: number;
    pos_id: string;
    is_open: number; 
    close_unix_timestamp_ms: number;
    close_tick_index: number;
    close_tick_index_cetus: number;
    total_gas_used: string; 
    fee_coin_a: string; 
    fee_coin_b: string; 
    rwd_sui: string; 
    rwd_cetus: string;
    benefit_holding_coin_ab: string; 
    benefit_holding_coin_a: string; 
    benefit_holding_coin_b: string; 
};


function positionInfoDB2PositionInfo(row: PositionInfoDB): PositionInfo {
    let position_info: PositionInfo = newPositionInfo();
    position_info.unix_timestamp_ms = row.unix_timestamp_ms;
    position_info.pos_id = row.pos_id;
    position_info.is_open = row.is_open;
    position_info.close_unix_timestamp_ms = row.close_unix_timestamp_ms;
    position_info.close_tick_index = row.close_tick_index;
    position_info.close_tick_index_cetus = row.close_tick_index_cetus;
    position_info.total_gas_used = new BN(row.total_gas_used);
    position_info.fee_coin_a = new BN(row.fee_coin_a);
    position_info.fee_coin_b = new BN(row.fee_coin_b);
    position_info.rwd_sui = new BN(row.rwd_sui);
    position_info.rwd_cetus = new BN(row.rwd_cetus);
    position_info.benefit_holding_coin_ab = new Decimal(row.benefit_holding_coin_ab);
    position_info.benefit_holding_coin_a = new Decimal(row.benefit_holding_coin_a);
    position_info.benefit_holding_coin_b = new Decimal(row.benefit_holding_coin_b);
    return position_info;
}

type CheckPointStatusDB = {    
    unix_timestamp_ms: number;
    type: string;
    cur_tick_index_for_tx: number;
    tick_lower_index_for_tx: number;
    tick_upper_index_for_tx: number;
    usdc_sui_tick_index: number;
    sui_price: string;
    usdc_cetus_tick_index: number;
    cetus_price: string;
    usdc_balance: string;
    sui_balance: string;
    cetus_balance: string;
    usdc_in_liquidity: string;
    sui_in_liquidity: string;
    usdc_fee: string;
    sui_fee: string;
    sui_rwd: string;
    cetus_rwd: string;
    pos_unix_timestamp_ms: number;
    pos_id: string;
};


function checkPointStatusDB2CheckPointStatus(row: CheckPointStatusDB): CheckPointStatus {
    let ret: CheckPointStatus = newCheckPointStatus();
    ret.unix_timestamp_ms = row.unix_timestamp_ms;
    ret.type = row.type;
    ret.cur_tick_index_for_tx = row.cur_tick_index_for_tx;
    ret.tick_lower_index_for_tx = row.tick_lower_index_for_tx;
    ret.tick_upper_index_for_tx = row.tick_upper_index_for_tx;
    ret.usdc_sui_tick_index = row.usdc_sui_tick_index;
    ret.sui_price = new Decimal(row.sui_price);
    ret.usdc_cetus_tick_index = row.usdc_cetus_tick_index;
    ret.cetus_price = new Decimal(row.cetus_price);
    ret.usdc_balance = new BN(row.usdc_balance);
    ret.sui_balance = new BN(row.sui_balance);
    ret.cetus_balance = new BN(row.cetus_balance);
    ret.usdc_in_liquidity = new BN(row.usdc_in_liquidity);
    ret.sui_in_liquidity = new BN(row.sui_in_liquidity);
    ret.usdc_fee = new BN(row.usdc_fee);
    ret.sui_fee = new BN(row.sui_fee);
    ret.sui_rwd = new BN(row.sui_rwd);
    ret.cetus_rwd = new BN(row.cetus_rwd);
    return ret;
}


type TransactionInfoDB = {    
    unix_timestamp_ms: number;
    type: string;
    digest: string;    
    total_gas_fee: string;
    balance_change_usdc: string;
    balance_change_sui: string;
    balance_change_cetus: string;
    liquidity_event_after_liquidity: string;
    liquidity_event_amount_a: string;
    liquidity_event_amount_b: string;
    liquidity_event_liquidity: string;
    fee_and_reward_fee_owned_a: string;
    fee_and_reward_fee_owned_b: string;
    fee_and_reward_rwd_owned_cetus: string;
    fee_and_reward_rwd_owned_sui: string;
    pos_unix_timestamp_ms: number;
    pos_id: string;
};

function transactionInfoDB2TransactionInfo(row: TransactionInfoDB): TransactionInfo {
    let ret: TransactionInfo = newTransactionInfo();
    ret.unix_timestamp_ms = row.unix_timestamp_ms;
    ret.type = row.type;
    ret.digest = row.digest;
    ret.total_gas_fee = new BN(row.total_gas_fee);
    ret.balance_change.usdc_change = new BN(row.balance_change_usdc);
    ret.balance_change.sui_change = new BN(row.balance_change_sui);
    ret.balance_change.cetus_change = new BN(row.balance_change_cetus);
    ret.liquidity_event.after_liquidity = new BN(row.liquidity_event_after_liquidity);
    ret.liquidity_event.amount_a = new BN(row.liquidity_event_amount_a);
    ret.liquidity_event.amount_b = new BN(row.liquidity_event_amount_b);
    ret.liquidity_event.liquidity = new BN(row.liquidity_event_liquidity);
    ret.fee_and_reward.fee_owned_a = new BN(row.fee_and_reward_fee_owned_a);
    ret.fee_and_reward.fee_owned_b = new BN(row.fee_and_reward_fee_owned_b);
    ret.fee_and_reward.rwd_owned_sui = new BN(row.fee_and_reward_rwd_owned_sui);
    ret.fee_and_reward.rwd_owned_cetus = new BN(row.fee_and_reward_rwd_owned_cetus);
    return ret;
}








function runAsync(db: sqlite3.Database, sql: string): Promise<{success: boolean; error?: string}> {
    return new Promise((resolve) => {
        db.run(sql, (err) => {
            if (err) {
                resolve({success: false, error: err.message});
            } else {
                resolve({success: true});
            }
        });
    });
}

function runAsyncWithParam(db: sqlite3.Database, sql: string, params: any): Promise<{success: boolean; error?: string}> {
    return new Promise((resolve) => {
        db.run(sql, params, (err) => {
            if (err) {
                resolve({success: false, error: err.message });
            } else {
                resolve({success: true});
            }
        });
    });
}



function allAsync<T = any>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{success: boolean; error?: string, rows?: T[]}> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                resolve({success: false, error: err.message});
            } else {
                resolve({success: true, rows: rows as T[]});
            }
        });
    });
}

function getAsync<T = any>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<{success: boolean; error?: string, row?: T}> {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                resolve({success: false, error: err.message});
            } else {
                resolve({success: true, row: row as T});
            }
        });
    });
}






function tableExists(db: sqlite3.Database, tableName: string): Promise<{success: boolean; error?: string, exist?: boolean}> {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [tableName],
            (err, row) => {
                if (err) {
                    resolve({success: false, error: err.message });
                } else if (row){
                    resolve({success: true, exist: true});
                } else {
                    resolve({success: true, exist: false});
                }
            }
        );
    });
}


function formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0"); // 月份从0开始
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}






export function openDatabase(filename: string): Promise<{success: boolean; error?: string, db?: sqlite3.Database}> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(filename, (err) => {
            if (err) {
                resolve({success: false, error: err.message});
            } else {
                resolve({success: true, db});
            }
        });
    });
}





export async function tryCreatePositionInfoTable(db: sqlite3.Database): Promise<{success: boolean; error?: string}> {
    let sql = `CREATE TABLE IF NOT EXISTS position_info(
                    unix_timestamp_ms INTEGER,
                    pos_id TEXT,
                    is_open INTEGER,
                    close_unix_timestamp_ms INTEGER,
                    close_tick_index INTEGER,
                    close_tick_index_cetus INTEGER,
                    total_gas_used TEXT,
                    fee_coin_a TEXT,
                    fee_coin_b TEXT,
                    rwd_sui TEXT,
                    rwd_cetus TEXT,                        
                    benefit_holding_coin_ab TEXT,
                    benefit_holding_coin_a TEXT,
                    benefit_holding_coin_b TEXT,
                    PRIMARY KEY (unix_timestamp_ms, pos_id)
            )`;
    let ret = await runAsync(db, sql);
    if (ret.success) {
        console.log('tryCreatePositionInfoTable successfully: \n ', sql);
    } else {
        console.log('tryCreatePositionInfoTable failed: %s\n%s', ret.error, sql);
    }
    return ret;
}


export async function tryCreateCheckPointStatusTable(db: sqlite3.Database, position_info: PositionInfo): Promise<{success: boolean; error?: string}> {
    if (position_info.pos_id === '' || position_info.unix_timestamp_ms === 0) {
        console.log('tryCreateCheckPointStatusTable: position_info is empty');
        return {success: false, error: 'pos_info_empty'};
    }
    let table_name = util.format('check_point_status_%s_%s', formatDate(new Date(position_info.unix_timestamp_ms)), position_info.pos_id);
    let sql = 'CREATE TABLE IF NOT EXISTS ' + table_name + `(
                unix_timestamp_ms INTEGER PRIMARY KEY,
                type TEXT,
                cur_tick_index_for_tx INTEGER,
                tick_lower_index_for_tx INTEGER,
                tick_upper_index_for_tx INTEGER,
                usdc_sui_tick_index INTEGER,
                sui_price TEXT,
                usdc_cetus_tick_index INTEGER,
                cetus_price TEXT,
                usdc_balance TEXT,
                sui_balance TEXT,
                cetus_balance TEXT,
                usdc_in_liquidity TEXT,
                sui_in_liquidity TEXT,
                usdc_fee TEXT,
                sui_fee TEXT,
                sui_rwd TEXT,                        
                cetus_rwd TEXT,            
                pos_unix_timestamp_ms INTEGER,
                pos_id TEXT
        )`;
    let ret = await runAsync(db, sql);
    if (ret.success) {
        console.log('tryCreateCheckPointStatusTable successfully: \n', sql);
    } else {
        console.log('tryCreateCheckPointStatusTable failed: %s\n%s', ret.error, sql);
    }
    return ret;
}




export async function tryCreateTransactionInfoTable(db: sqlite3.Database, position_info: PositionInfo): Promise<{success: boolean; error?: string}> {
    if (position_info.pos_id === '' || position_info.unix_timestamp_ms === 0) {
        console.log('tryCreateTransactionInfoTable: position_info is empty');
        return {success: false, error: 'pos_info_empty'};
    }
    let table_name = util.format('transaction_info_%s_%s', formatDate(new Date(position_info.unix_timestamp_ms)), position_info.pos_id);
    let sql = 'CREATE TABLE IF NOT EXISTS ' + table_name + `(
                unix_timestamp_ms INTEGER PRIMARY KEY,
                type TEXT,
                digest TEXT,
                total_gas_fee TEXT,
                balance_change_usdc TEXT,
                balance_change_sui TEXT,
                balance_change_cetus TEXT,
                liquidity_event_after_liquidity TEXT,
                liquidity_event_amount_a TEXT,
                liquidity_event_amount_b TEXT,
                liquidity_event_liquidity TEXT,                        
                fee_and_reward_fee_owned_a TEXT,
                fee_and_reward_fee_owned_b TEXT,
                fee_and_reward_rwd_owned_cetus TEXT,
                fee_and_reward_rwd_owned_sui TEXT,
                pos_unix_timestamp_ms INTEGER,
                pos_id TEXT
            )`;
    let ret = await runAsync(db, sql);
    if (ret.success) {
        console.log('tryCreateTransactionInfoTable successfully: \n', sql);
    } else {
        console.log('tryCreateTransactionInfoTable failed: %s\n%s', ret.error, sql);
    }
    return ret;
}


export async function insertPositionInfo(db: sqlite3.Database, position_info: PositionInfo): Promise<{success: boolean; error?: string}> {
    if (position_info.pos_id === '' || position_info.unix_timestamp_ms === 0) {
        console.log('insertPositionInfo: position_info is empty');
        return {success: false, error: 'pos_info_empty'};
    }
    let table_name = 'position_info';
    let ret_table_chk = await tableExists(db, table_name);
    if (ret_table_chk.success) {
        if (!ret_table_chk.exist) {
            console.log('insertPositionInfo table not exist: %s', table_name);
            return {success: false, error: 'table_not_exist'};
        }
    } else {
        console.log('insertPositionInfo table exist check failed:', ret_table_chk.error);
        return ret_table_chk;
    }

    let value_string = util.format('%d, \'%s\', %d, %d, %d, %d, \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\'', 
        position_info.unix_timestamp_ms,
        position_info.pos_id,
        position_info.is_open,
        position_info.close_unix_timestamp_ms,
        position_info.close_tick_index,
        position_info.close_tick_index_cetus,
        position_info.total_gas_used.toString(),
        position_info.fee_coin_a.toString(),
        position_info.fee_coin_b.toString(),
        position_info.rwd_sui.toString(),
        position_info.rwd_cetus.toString(),
        position_info.benefit_holding_coin_ab.toString(),
        position_info.benefit_holding_coin_a.toString(),
        position_info.benefit_holding_coin_b.toString()
    );

    let sql = util.format('INSERT INTO %s VALUES (%s)', table_name, value_string);
    let ret = await runAsync(db, sql);
    if (ret.success) {
        console.log('insertPositionInfo successfully: \n', sql);
    } else {
        console.log('insertPositionInfo failed: %s\n%s', ret.error, sql);
    }
    return ret;
}


export async function updatePositionInfo(db: sqlite3.Database, position_info: PositionInfo): Promise<{success: boolean; error?: string}> {
    if (position_info.pos_id === '' || position_info.unix_timestamp_ms === 0) {
        console.log('updatePositionInfo: position_info is empty');
        return {success: false, error: 'pos_info_empty'};
    }
    let table_name = 'position_info';
    let ret_table_chk = await tableExists(db, table_name);
    if (ret_table_chk.success) {
        if (!ret_table_chk.exist) {
            console.log('updatePositionInfo table not exist: %s', table_name);
            return {success: false, error: 'table_not_exist'};
        }
    } else {
        console.log('updatePositionInfo table exist check failed:', ret_table_chk.error);
        return ret_table_chk;
    }

    let value_string = util.format(
           `is_open = %d, 
            close_unix_timestamp_ms = %d, 
            close_tick_index = %d, 
            close_tick_index_cetus = %d, 
            total_gas_used = '%s',
            fee_coin_a = '%s',
            fee_coin_b = '%s',
            rwd_sui = '%s',
            rwd_cetus = '%s',
            benefit_holding_coin_ab = '%s',
            benefit_holding_coin_a = '%s',
            benefit_holding_coin_b = '%s'
            `, 
        position_info.is_open,
        position_info.close_unix_timestamp_ms,
        position_info.close_tick_index,
        position_info.close_tick_index_cetus,
        position_info.total_gas_used.toString(),
        position_info.fee_coin_a.toString(),
        position_info.fee_coin_b.toString(),
        position_info.rwd_sui.toString(),
        position_info.rwd_cetus.toString(),
        position_info.benefit_holding_coin_ab.toString(),
        position_info.benefit_holding_coin_a.toString(),
        position_info.benefit_holding_coin_b.toString()
    );
    let where_clause = util.format('(unix_timestamp_ms = %d AND pos_id=\'%s\')', position_info.unix_timestamp_ms, position_info.pos_id,);

    let sql = util.format('UPDATE  %s SET %s WHERE %s', table_name, value_string, where_clause);
    let ret = await runAsync(db, sql);
    if (ret.success) {
        console.log('updatePositionInfo successfully: \n', sql);
    } else {
        console.log('updatePositionInfo failed: %s\n%s', ret.error, sql);
    }
    return ret;
}


export async function insertCheckPointStatus(db: sqlite3.Database, position_info: PositionInfo, check_point_status: CheckPointStatus): Promise<{success: boolean; error?: string}>{
    if (position_info.pos_id === '' || position_info.unix_timestamp_ms === 0) {
        console.log('insertCheckPointStatus: position_info is empty');
        return {success: false, error: 'pos_info_empty'};
    }
    let table_name = util.format('check_point_status_%s_%s', formatDate(new Date(position_info.unix_timestamp_ms)), position_info.pos_id);
    let ret_table_chk = await tableExists(db, table_name);
    if (ret_table_chk.success) {
        if (!ret_table_chk.exist) {
            console.log('insertCheckPointStatus table not exist: %s', table_name);
            return {success: false, error: 'table_not_exist'};
        }
    } else {
        console.log('insertCheckPointStatus table exist check failed:', ret_table_chk.error);
        return ret_table_chk;
    }

    let value_string = util.format('%d, \'%s\', %d, %d, %d, %d, \'%s\', %d, \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', %d, \'%s\'', 
        check_point_status.unix_timestamp_ms,
        check_point_status.type,
        check_point_status.cur_tick_index_for_tx,
        check_point_status.tick_lower_index_for_tx,
        check_point_status.tick_upper_index_for_tx,
        check_point_status.usdc_sui_tick_index,
        check_point_status.sui_price.toString(),
        check_point_status.usdc_cetus_tick_index,
        check_point_status.cetus_price.toString(),
        check_point_status.usdc_balance.toString(),
        check_point_status.sui_balance.toString(),
        check_point_status.cetus_balance.toString(),
        check_point_status.usdc_in_liquidity.toString(),
        check_point_status.sui_in_liquidity.toString(),
        check_point_status.usdc_fee.toString(),
        check_point_status.sui_fee.toString(),
        check_point_status.sui_rwd.toString(),
        check_point_status.cetus_rwd.toString(),
        position_info.unix_timestamp_ms,
        position_info.pos_id
    );

    let sql = util.format('INSERT INTO %s VALUES (%s)', table_name, value_string);
    let ret = await runAsync(db, sql);
    if (ret.success) {
        console.log('insertCheckPointStatus successfully: \n', sql);
    } else {
        console.log('insertCheckPointStatus failed: %s\n%s', ret.error, sql);
    }
    return ret;
}

export async function insertTransactionInfo(db: sqlite3.Database, position_info: PositionInfo, transaction_info: TransactionInfo): Promise<{success: boolean; error?: string}> {
    if (position_info.pos_id === '' || position_info.unix_timestamp_ms === 0) {
        console.log('insertTransactionInfo: position_info is empty');
        return {success: false, error: 'pos_info_empty'};
    }
    let table_name = util.format('transaction_info_%s_%s', formatDate(new Date(position_info.unix_timestamp_ms)), position_info.pos_id); 
    let ret_table_chk = await tableExists(db, table_name);
    if (ret_table_chk.success) {
        if (!ret_table_chk.exist) {
            console.log('insertCheckPointStatus table not exist: %s', table_name);
            return {success: false, error: 'table_not_exist'};
        }
    } else {
        console.log('insertCheckPointStatus table exist check failed:', ret_table_chk.error);
        return ret_table_chk;
    }

    let value_string = util.format('%d, \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', \'%s\', %d, \'%s\'', 
        transaction_info.unix_timestamp_ms,
        transaction_info.type,
        transaction_info.digest,        
        transaction_info.total_gas_fee.toString(),
        transaction_info.balance_change.usdc_change.toString(),
        transaction_info.balance_change.sui_change.toString(),
        transaction_info.balance_change.cetus_change.toString(),
        transaction_info.liquidity_event.after_liquidity.toString(),
        transaction_info.liquidity_event.amount_a.toString(),
        transaction_info.liquidity_event.amount_b.toString(),
        transaction_info.liquidity_event.liquidity.toString(),
        transaction_info.fee_and_reward.fee_owned_a.toString(),
        transaction_info.fee_and_reward.fee_owned_b.toString(),
        transaction_info.fee_and_reward.rwd_owned_cetus.toString(),
        transaction_info.fee_and_reward.rwd_owned_sui.toString(),
        position_info.unix_timestamp_ms,
        position_info.pos_id
    );

    let sql = util.format('INSERT INTO %s VALUES (%s)', table_name, value_string);
    let ret = await runAsync(db, sql);
    if (ret.success) {
        console.log('insertTransactionInfo successfully: \n', sql);
    } else {
        console.log('insertTransactionInfo failed: %s\n%s', ret.error, sql);
    }
    return ret;
}

export async function getPositionInfo(db: sqlite3.Database, pos_object_id: string): Promise<{success: boolean; error?: string, position_info?:PositionInfo}> {
    if (pos_object_id === '') {
        console.log('getPositionInfo: pos_object_id is empty');
        return {success: false, error: 'pos_object_id_empty'};
    }
    let table_name = 'position_info';
    let ret_table_chk = await tableExists(db, table_name);
    if (ret_table_chk.success) {
        if (!ret_table_chk.exist) {
            console.log('getPositionInfo table not exist: %s', table_name);
            return {success: false, error: 'table_not_exist'};
        }
    } else {
        console.log('getPositionInfo table exist check failed:', ret_table_chk.error);
        return ret_table_chk;
    }
    let where_clause = util.format('(pos_id=\'%s\')', pos_object_id);

    let sql = util.format('SELECT * FROM %s WHERE %s', table_name, where_clause);
    let ret = await getAsync<PositionInfoDB>(db, sql);
    if (ret.success) {
        console.log('getPositionInfo successfully: \n', sql);
        if (ret.row) {
            // console.log(ret.row);
            let position_info = positionInfoDB2PositionInfo(ret.row);
            return {success: true, position_info};
            
        } else {
            return {success: false, error: 'no_row_selected'};
        }
    } else {
        console.log('getPositionInfo failed: %s\n%s', ret.error, sql);
    }
    return ret;
}



export async function getAllPositionInfo(db: sqlite3.Database): Promise<{success: boolean; error?: string, position_infos?: PositionInfo[]}>{

    let table_name = 'position_info';
    let ret_table_chk = await tableExists(db, table_name);
    if (ret_table_chk.success) {
        if (!ret_table_chk.exist) {
            console.log('getAllPositionInfo table not exist: %s', table_name);
            return {success: false, error: 'table_not_exist'};
        }
    } else {
        console.log('getAllPositionInfo table exist check failed:', ret_table_chk.error);
        return ret_table_chk;
    }

    let order_by_clause = 'unix_timestamp_ms';

    let sql = util.format('SELECT * FROM %s ORDER BY %s', table_name, order_by_clause);
    let ret = await allAsync<PositionInfoDB>(db, sql);
    if (ret.success) {
        console.log('getAllPositionInfo successfully: \n', sql);
        if (ret.rows) {
            // console.log(ret.rows);
            let position_infos: PositionInfo[] = [];
            for (const row of ret.rows) {
                position_infos.push(positionInfoDB2PositionInfo(row));
            }
            return {success: true, position_infos};
        } else {
            return {success: false, error: 'no_row_selected'};
        }
    } else {
        console.log('getAllPositionInfo failed: %s\n%s', ret.error, sql);
    }
    return ret;
}



export async function getAllCheckPointStatus(db: sqlite3.Database, position_info: PositionInfo): Promise<{success: boolean; error?: string, check_point_status_arr?: CheckPointStatus[]}>{
    if (position_info.pos_id === '' || position_info.unix_timestamp_ms === 0) {
        console.log('getAllCheckPointStatus: position_info is empty');
        return {success: false, error: 'pos_info_empty'};
    }
    let table_name = util.format('check_point_status_%s_%s', formatDate(new Date(position_info.unix_timestamp_ms)), position_info.pos_id);
    let ret_table_chk = await tableExists(db, table_name);
    if (ret_table_chk.success) {
        if (!ret_table_chk.exist) {
            console.log('getAllCheckPointStatus table not exist: %s', table_name);
            return {success: false, error: 'table_not_exist'};
        }
    } else {
        console.log('getAllCheckPointStatus table exist check failed:', ret_table_chk.error);
        return ret_table_chk;
    }

    let order_by_clause = 'unix_timestamp_ms';

    let sql = util.format('SELECT * FROM %s ORDER BY %s', table_name, order_by_clause);
    let ret = await allAsync<CheckPointStatusDB>(db, sql);
    if (ret.success) {
        console.log('getAllCheckPointStatus successfully: \n', sql);
        if (ret.rows) {
            // console.log(ret.rows);
            let check_point_status_arr: CheckPointStatus[] = [];
            for (const row of ret.rows) {
                check_point_status_arr.push(checkPointStatusDB2CheckPointStatus(row));
            }
            return {success: true, check_point_status_arr};
        } else {
            return {success: false, error: 'no_row_selected'};
        }
    } else {
        console.log('getAllCheckPointStatus failed: %s\n%s', ret.error, sql);
    }
    return ret;
}


export async function getAllTransactionInfo(db: sqlite3.Database, position_info: PositionInfo): Promise<{success: boolean; error?: string, tx_info_arr?: TransactionInfo[]}>{
    if (position_info.pos_id === '' || position_info.unix_timestamp_ms === 0) {
        console.log('getAllTransactionInfo: position_info is empty');
        return {success: false, error: 'pos_info_empty'};
    }
    let table_name = util.format('transaction_info_%s_%s', formatDate(new Date(position_info.unix_timestamp_ms)), position_info.pos_id);
    let ret_table_chk = await tableExists(db, table_name);
    if (ret_table_chk.success) {
        if (!ret_table_chk.exist) {
            console.log('getAllTransactionInfo table not exist: %s', table_name);
            return {success: false, error: 'table_not_exist'};
        }
    } else {
        console.log('getAllTransactionInfo table exist check failed:', ret_table_chk.error);
        return ret_table_chk;
    }

    let order_by_clause = 'unix_timestamp_ms';

    let sql = util.format('SELECT * FROM %s ORDER BY %s', table_name, order_by_clause);
    let ret = await allAsync<TransactionInfoDB>(db, sql);
    if (ret.success) {
        console.log('getAllTransactionInfo successfully: \n', sql);
        if (ret.rows) {
            // console.log(ret.rows);
            let tx_info_arr: TransactionInfo[] = [];
            for (const row of ret.rows) {
                tx_info_arr.push(transactionInfoDB2TransactionInfo(row));
            }
            return {success: true, tx_info_arr};
        } else {
            return {success: false, error: 'no_row_selected'};
        }
    } else {
        console.log('getAllTransactionInfo failed: %s\n%s', ret.error, sql);
    }
    return ret;
}





// async function sqliteTest2() {
//         // open database
//     let db: sqlite3.Database | null = null;
//     while (true) {
//         try {
//             db = await openDatabase(SQLITE_DB_FILE_NAME);
//             await runAsync(db, 
//                 `CREATE TABLE IF NOT EXISTS position_info(
//                         open_epoch_time INTEGER,
//                         pos_id TEXT,
//                         is_closed INTEGER,
//                         close_epoch_time INTEGER,
//                         close_tick_index TEXT,
//                         close_tick_index2 TEXT,
//                         total_gas_used TEXT,
//                         fee_coin_a TEXT,
//                         fee_coin_b TEXT,
//                         rwd_sui TEXT,
//                         rwd_cetus TEXT,                        
//                         benefit_holding_coin_ab TEXT,
//                         benefit_holding_coin_a TEXT,
//                         benefit_holding_coin_b TEXT,
//                         PRIMARY KEY (open_epoch_time, pos_id)
//                 )`
//             );

//             // await runAsyncWithParam(db, 
//             //     `INSERT INTO position_info (open_epoch_time, pos_id) VALUES (?, ?)`,
//             //     [12345, 'pos_123456']
//             // );

//             await runAsyncWithParam(db, 
//                 `UPDATE position_info 
//                  SET rwd_sui=?
//                  WHERE pos_id='pos_123456'`,
//                 ['2356']
//             );


//             let rows = await allAsync<PositionInfoDB>(db, `SELECT * FROM position_info`,  []);
//             console.log(rows)


//         } catch(e) {
//             if (e instanceof Error) {
//                 console.error('%s [error] OpenDatabase an exception:\n%s \n%s \n%s', date.toLocaleString(), e.message, e.name, e.stack);
//             } else {
//                 console.error('OpenDatabase get an exception'); 
//                 console.error(e);
//             }
//             console.log('Error opening database, wait 1s and try again...');
//             db?.close();
//             await new Promise(f => setTimeout(f, 2000));
//             continue;
//         }
//         break;
//     }
// }