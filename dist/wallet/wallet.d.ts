declare const Mnemonic: any;
import * as kaspacore from '@kaspa/core-lib';
import * as helper from '../utils/helper';
export * from './storage';
export * from './error';
import { Crypto } from './crypto';
import { Network, NetworkOptions, SelectedNetwork, Api, TxSend, TxResp, PendingTransactions, WalletCache, IRPC, WalletOptions, WalletOpt, TxInfo, ComposeTxInfo, BuildTxResult, TxCompoundOptions, DebugInfo, ScaneMoreResult } from '../types/custom-types';
import { Logger } from '../utils/logger';
import { AddressManager } from './address-manager';
import { UtxoSet, CONFIRMATION_COUNT, COINBASE_CFM_COUNT } from './utxo';
import { TXStore } from './tx-store';
import { CacheStore } from './cache-store';
import { KaspaAPI } from './api';
import { EventTargetImpl } from './event-target-impl';
declare const BALANCE_CONFIRMED: unique symbol;
declare const BALANCE_PENDING: unique symbol;
declare const BALANCE_TOTAL: unique symbol;
declare const COMPOUND_UTXO_MAX_COUNT = 500;
export { kaspacore, COMPOUND_UTXO_MAX_COUNT, CONFIRMATION_COUNT, COINBASE_CFM_COUNT };
/** Class representing an HDWallet with derivable child addresses */
declare class Wallet extends EventTargetImpl {
    static Mnemonic: typeof Mnemonic;
    static passwordHandler: typeof Crypto;
    static Crypto: typeof Crypto;
    static kaspacore: typeof kaspacore;
    static COMPOUND_UTXO_MAX_COUNT: number;
    static MaxMassAcceptedByBlock: number;
    static MaxMassUTXOs: number;
    static networkTypes: Object;
    static networkAliases: Object;
    static KAS(v: number): string;
    static initRuntime(): any;
    /**
     * Converts a mnemonic to a new wallet.
     * @param seedPhrase The 12 word seed phrase.
     * @returns new Wallet
     */
    static fromMnemonic(seedPhrase: string, networkOptions: NetworkOptions, options?: WalletOptions): Wallet;
    /**
     * Creates a new Wallet from encrypted wallet data.
     * @param password the password the user encrypted their seed phrase with
     * @param encryptedMnemonic the encrypted seed phrase from local storage
     * @throws Will throw "Incorrect password" if password is wrong
     */
    static import(password: string, encryptedMnemonic: string, networkOptions: NetworkOptions, options?: WalletOptions): Promise<Wallet>;
    HDWallet: kaspacore.HDPrivateKey;
    disableBalanceNotifications: boolean;
    get balance(): {
        available: number;
        pending: number;
        total: number;
    };
    /**
     * Set by addressManager
     */
    get receiveAddress(): string;
    get changeAddress(): string;
    /**
     * Current network.
     */
    network: Network;
    api: KaspaAPI;
    /**
     * Default fee
     */
    defaultFee: number;
    subnetworkId: string;
    last_tx_: string;
    /**
     * Current API endpoint for selected network
     */
    apiEndpoint: string;
    /**
     * A 12 word mnemonic.
     */
    mnemonic: string;
    utxoSet: UtxoSet;
    addressManager: AddressManager;
    blueScore: number;
    syncVirtualSelectedParentBlueScoreStarted: boolean;
    syncInProggress: boolean;
    pendingInfo: PendingTransactions;
    /**
     * Transactions sorted by hash.
     */
    transactions: Record<string, {
        rawTx: string;
        utxoIds: string[];
        amount: number;
        to: string;
        fee: number;
    }>;
    /**
     * Transaction arrays keyed by address.
     */
    transactionsStorage: Record<string, Api.Transaction[]>;
    options: WalletOpt;
    connectSignal: helper.DeferredPromise;
    txStore: TXStore;
    cacheStore: CacheStore;
    uid: string;
    /** Create a wallet.
     * @param walletSave (optional)
     * @param walletSave.privKey Saved wallet's private key.
     * @param walletSave.seedPhrase Saved wallet's seed phrase.
     */
    constructor(privKey: string, seedPhrase: string, networkOptions: NetworkOptions, options?: WalletOptions);
    createUID(): string;
    onApiConnect(): Promise<void>;
    connected: boolean | undefined;
    onApiDisconnect(): void;
    update(syncOnce?: boolean): Promise<void>;
    syncOnce: boolean | undefined;
    syncSignal: helper.DeferredPromise | undefined;
    waitOrSync(): helper.DeferredPromise | Promise<void>;
    sync(syncOnce?: boolean | undefined): Promise<void>;
    getVirtualSelectedParentBlueScore(): Promise<{
        blueScore: number;
    }>;
    getVirtualDaaScore(): Promise<{
        virtualDaaScore: number;
    }>;
    initBlueScoreSync(once?: boolean): Promise<void>;
    addressManagerInitialized: boolean | undefined;
    initAddressManager(): void;
    startUpdatingTransactions(version?: undefined | number): Promise<boolean>;
    /**
     * Set rpc provider
     * @param rpc
     */
    setRPC(rpc: IRPC): void;
    /**
     * Queries API for address[] UTXOs. Adds tx to transactions storage. Also sorts the entire transaction set.
     * @param addresses
     */
    findUtxos(addresses: string[], debug?: boolean): Promise<{
        txID2Info: Map<string, {
            utxos: Api.Utxo[];
            address: string;
        }>;
        addressesWithUTXOs: string[];
    }>;
    [BALANCE_CONFIRMED]: number;
    [BALANCE_PENDING]: number;
    [BALANCE_TOTAL]: number;
    adjustBalance(isConfirmed: boolean, amount: number, notify?: boolean): void;
    /**
     * Emit wallet balance.
     */
    lastBalanceNotification: {
        available: number;
        pending: number;
    };
    emitBalance(): void;
    debugInfo: DebugInfo;
    updateDebugInfo(): void;
    clearUsedUTXOs(): void;
    emitCache(): void;
    lastAddressNotification: {
        receive?: string;
        change?: string;
    };
    emitAddress(): void;
    /**
     * Updates the selected network
     * @param network name of the network
     */
    updateNetwork(network: SelectedNetwork): Promise<void>;
    demolishWalletState(networkPrefix?: Network): void;
    scanMoreAddresses(count?: number, debug?: boolean, receiveStart?: number, changeStart?: number): Promise<ScaneMoreResult>;
    /**
     * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
     * @param threshold stop discovering after `threshold` addresses with no activity
     */
    addressDiscovery(threshold?: number, debug?: boolean, receiveStart?: number, changeStart?: number, count?: number): Promise<{
        debugInfo: Map<string, {
            utxos: Api.Utxo[];
            address: string;
        }> | null;
        highestIndex: {
            receive: number;
            change: number;
        };
        endPoints: {
            receive: number;
            change: number;
        };
    }>;
    /**
     * Compose a serialized, signed transaction
     * @param obj
     * @param obj.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param obj.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
     * @param obj.fee Fee for miners in sompis
     * @param obj.changeAddrOverride Use this to override automatic change address derivation
     * @throws if amount is above `Number.MAX_SAFE_INTEGER`
     */
    composeTx({ toAddr, amount, fee, changeAddrOverride, skipSign, privKeysInfo, compoundingUTXO, compoundingUTXOMaxCount }: TxSend): ComposeTxInfo;
    minimumRequiredTransactionRelayFee(mass: number): number;
    /**
     * Estimate transaction fee. Returns transaction data.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    estimateTransaction(txParamsArg: TxSend): Promise<TxInfo>;
    composeTxAndNetworkFeeInfo(txParamsArg: TxSend): Promise<TxInfo>;
    /**
     * Build a transaction. Returns transaction info.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    buildTransaction(txParamsArg: TxSend, debug?: boolean): Promise<BuildTxResult>;
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    submitTransaction(txParamsArg: TxSend, debug?: boolean): Promise<TxResp | null>;
    compoundUTXOs(txCompoundOptions?: TxCompoundOptions, debug?: boolean): Promise<TxResp | null>;
    /**
     * After we see the transaction in the API results, delete it from our pending list.
     * @param id The tx hash
     */
    runStateChangeHooks(): void;
    emitedUTXOs: Set<string>;
    startUTXOsPolling(): void;
    emitUTXOs(): void;
    get cache(): {
        utxos: {
            inUse: string[];
        };
        addresses: {
            receiveCounter: number;
            changeCounter: number;
        };
    };
    restoreCache(cache: WalletCache): void;
    /**
     * Generates encrypted wallet data.
     * @param password user's chosen password
     * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
     */
    export(password: string): Promise<string>;
    logger: Logger;
    loggerLevel: number;
    setLogLevel(level: string): void;
}
export { Wallet };
//# sourceMappingURL=wallet.d.ts.map