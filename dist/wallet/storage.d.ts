import { WalletCache } from '../types/custom-types';
export type StorageType = 'FILE' | 'LS';
export type StorageOpts = {
    logLevel?: string;
    password?: string;
    fileDbOptions?: {
        fileName?: string;
        folder?: string;
    };
};
export interface TXStoreItem {
    in: boolean;
    ts: number;
    id: string;
    amount: number;
    address: string;
    note?: string;
    tx?: any;
}
export interface WalletMeta {
    version?: string;
    generator?: string;
    encryption?: string;
    wallet?: {
        mnemonic?: string;
    };
}
export interface WalletContent {
    type: string;
    version: string;
    generator: string;
    encryption: string;
    wallet: {
        mnemonic: string;
    };
}
declare abstract class DBInterface {
    abstract backup(): void;
    abstract saveWallet(data: string): void;
    abstract getWallet(): string | false;
    abstract getCache(): string | undefined;
    abstract saveCache(cache: string): void;
}
export declare class Storage {
    logger: any;
    db: DBInterface;
    constructor(opt?: StorageOpts);
    getWallet(): WalletContent | false;
    _buildWalletContent(mnemonic: string, meta?: WalletMeta): {
        type: string;
        encryption: string;
        version: number;
        generator: string;
        wallet: {
            mnemonic: string;
        };
    } & WalletMeta;
    createWallet(mnemonic: string, meta?: WalletMeta): void;
    saveWallet(mnemonic: string, meta?: WalletMeta): void;
    getCache(): WalletCache | false;
    saveCache(cache: WalletCache): void;
    setLogLevel(level: string): void;
    addTransaction(tx: TXStoreItem): void;
}
export {};
//# sourceMappingURL=storage.d.ts.map