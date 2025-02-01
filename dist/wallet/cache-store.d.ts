import { Wallet } from './wallet';
import { iDB } from './indexed-db';
export interface CacheStoreItem {
    id: string;
    ts: number;
}
export interface CacheItemAddressIndexes {
    id?: string;
    ts?: number;
    receive: number;
    change: number;
}
export declare class CacheStore {
    wallet: Wallet;
    store: Map<string, CacheStoreItem>;
    idb: iDB | undefined;
    constructor(wallet: Wallet);
    setAddressIndexes(data: CacheItemAddressIndexes): void;
    getAddressIndexes(): CacheItemAddressIndexes | undefined;
    private set;
    private get;
    save(item: CacheStoreItem): void;
    emitCache(item: CacheStoreItem): void;
    restore(): Promise<void>;
}
//# sourceMappingURL=cache-store.d.ts.map