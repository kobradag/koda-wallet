import { Api, RPC } from 'custom-types';
import { UnspentOutput } from './unspent-output';
import { Wallet } from './wallet';
import { EventTargetImpl } from './event-target-impl';
export { UnspentOutput };
export declare const CONFIRMATION_COUNT = 10;
export declare const COINBASE_CFM_COUNT = 100;
export declare class UtxoSet extends EventTargetImpl {
    utxos: {
        confirmed: Map<string, UnspentOutput>;
        pending: Map<string, UnspentOutput>;
        used: Map<string, UnspentOutput>;
    };
    inUse: string[];
    totalBalance: number;
    availableBalance: number;
    debug: boolean;
    utxoStorage: Record<string, Api.Utxo[]>;
    wallet: Wallet;
    addressesUtxoSyncStatuses: Map<string, boolean>;
    constructor(wallet: Wallet);
    /**
     * Add UTXOs to UTXO set.
     * @param utxos Array of UTXOs from kaspa API.
     * @param address Address of UTXO owner.
     */
    add(utxos: Api.Utxo[], address: string): string[];
    get logger(): import("@aspectron/flow-logger").FlowLogger;
    remove(utxoIds: string[]): void;
    clearUsed(): void;
    clearMissing(): boolean;
    release(utxoIdsToEnable: string[]): void;
    updateUtxoBalance(): void;
    clear(): void;
    updateUsed(utxos: UnspentOutput[]): void;
    /**
     * Naively select UTXOs.
     * @param txAmount Provide the amount that the UTXOs should cover.
     * @throws Error message if the UTXOs can't cover the `txAmount`
     */
    selectUtxos(txAmount: number): {
        utxoIds: string[];
        utxos: UnspentOutput[];
        mass: number;
    };
    /**
     * Naively collect UTXOs.
     * @param maxCount Provide the max UTXOs count.
     */
    collectUtxos(maxCount?: number): {
        utxoIds: string[];
        utxos: UnspentOutput[];
        amount: number;
        mass: number;
    };
    syncAddressesUtxos(addresses: string[]): Promise<void>;
    utxoSubscribe(): Promise<string[]>;
    onUtxosChanged(added: Map<string, Api.Utxo[]>, removed: Map<string, RPC.Outpoint[]>): void;
    isOur(utxo: UnspentOutput): boolean;
    isOurChange(utxo: UnspentOutput): boolean;
    get count(): number;
    get confirmedCount(): number;
}
//# sourceMappingURL=utxo.d.ts.map