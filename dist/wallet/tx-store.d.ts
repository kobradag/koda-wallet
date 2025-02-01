import { Wallet } from './wallet';
import { iDB } from './indexed-db';
import { Api } from 'custom-types';
interface APITx {
    block_time: number;
    transaction_id: string;
}
export interface TXStoreItem {
    in: boolean;
    ts: number;
    id: string;
    amount: number;
    address: string;
    blueScore: number;
    note?: string;
    tx?: any;
    myAddress?: boolean;
    isCoinbase: boolean;
    isMoved?: boolean;
    version?: number;
}
export declare const internalNames: {
    mainnet: string;
    kobra: string;
    testnet: string;
    kobratest: string;
    kobrasim: string;
    kobradev: string;
    kobrareg: string;
};
export declare class TXStore {
    static MAX: number;
    wallet: Wallet;
    store: Map<string, TXStoreItem>;
    txToEmitList: TXStoreItem[];
    updatedTxToEmitList: TXStoreItem[];
    idb: iDB | undefined;
    constructor(wallet: Wallet);
    add(tx: TXStoreItem, skipSave?: boolean): boolean;
    removePendingUTXO(utxo: Api.Utxo, address?: string): void;
    fetchTransactions(txIds: string[]): Promise<APITx[]>;
    fetchTxTime(txIds: string[]): Promise<Record<string, number>>;
    addAddressUTXOs(address: string, utxos: Api.Utxo[], ts?: number): Promise<void>;
    addFromUTXOs(list: Map<string, Api.Utxo[]>): void;
    save(tx: TXStoreItem): void;
    pendingUpdate: string[];
    updateTxTimeoutId: NodeJS.Timeout | null;
    updateTransactionTime(id: string): void;
    emitTx(tx: TXStoreItem): void;
    emitTxs(): void;
    emitTxTimeoutId: NodeJS.Timeout | null;
    emitUpdateTxTimeoutId: NodeJS.Timeout | null;
    emitUpdateTx(tx: TXStoreItem): void;
    emitUpdateTxImpl(): void;
    updatingTransactionsInprogress: boolean;
    startUpdatingTransactions(version?: undefined | number): Promise<boolean>;
    transactionUpdating: boolean;
    updateTransactionTimeImpl(txIdList?: string[] | null, notify?: boolean, callback?: Function | null): Promise<void>;
    getDBEntries(version?: undefined | number): Promise<{
        list: TXStoreItem[];
        txWithMissingVersion: string[];
    }>;
    restore(): Promise<void>;
}
export {};
//# sourceMappingURL=tx-store.d.ts.map