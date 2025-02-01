"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = exports.COINBASE_CFM_COUNT = exports.CONFIRMATION_COUNT = exports.COMPOUND_UTXO_MAX_COUNT = exports.kaspacore = void 0;
const Mnemonic = require('bitcore-mnemonic');
const kaspacore = __importStar(require("@kaspa/core-lib"));
exports.kaspacore = kaspacore;
const helper = __importStar(require("../utils/helper"));
__exportStar(require("./storage"), exports);
__exportStar(require("./error"), exports);
const crypto_1 = require("./crypto");
const KAS = helper.KAS;
const logger_1 = require("../utils/logger");
const address_manager_1 = require("./address-manager");
const utxo_1 = require("./utxo");
Object.defineProperty(exports, "CONFIRMATION_COUNT", { enumerable: true, get: function () { return utxo_1.CONFIRMATION_COUNT; } });
Object.defineProperty(exports, "COINBASE_CFM_COUNT", { enumerable: true, get: function () { return utxo_1.COINBASE_CFM_COUNT; } });
const tx_store_1 = require("./tx-store");
const cache_store_1 = require("./cache-store");
const api_1 = require("./api");
const config_json_1 = require("../config.json");
const event_target_impl_1 = require("./event-target-impl");
const BALANCE_CONFIRMED = Symbol();
const BALANCE_PENDING = Symbol();
const BALANCE_TOTAL = Symbol();
const COMPOUND_UTXO_MAX_COUNT = 500;
exports.COMPOUND_UTXO_MAX_COUNT = COMPOUND_UTXO_MAX_COUNT;
const SompiPerKaspa = 100000000;
// MaxSompi is the maximum transaction amount allowed in sompi.
const MaxSompi = 21000000 * SompiPerKaspa;
/** Class representing an HDWallet with derivable child addresses */
class Wallet extends event_target_impl_1.EventTargetImpl {
    static KAS(v) {
        return KAS(v);
    }
    static initRuntime() {
        return kaspacore.initRuntime();
    }
    /**
     * Converts a mnemonic to a new wallet.
     * @param seedPhrase The 12 word seed phrase.
     * @returns new Wallet
     */
    static fromMnemonic(seedPhrase, networkOptions, options = {}) {
        if (!networkOptions || !networkOptions.network)
            throw new Error(`fromMnemonic(seedPhrase,networkOptions): missing network argument`);
        const privKey = new Mnemonic(seedPhrase.trim()).toHDPrivateKey().toString();
        const wallet = new this(privKey, seedPhrase, networkOptions, options);
        return wallet;
    }
    /**
     * Creates a new Wallet from encrypted wallet data.
     * @param password the password the user encrypted their seed phrase with
     * @param encryptedMnemonic the encrypted seed phrase from local storage
     * @throws Will throw "Incorrect password" if password is wrong
     */
    static import(password_1, encryptedMnemonic_1, networkOptions_1) {
        return __awaiter(this, arguments, void 0, function* (password, encryptedMnemonic, networkOptions, options = {}) {
            const decrypted = yield crypto_1.Crypto.decrypt(password, encryptedMnemonic);
            const savedWallet = JSON.parse(decrypted);
            const myWallet = new this(savedWallet.privKey, savedWallet.seedPhrase, networkOptions, options);
            return myWallet;
        });
    }
    get balance() {
        return {
            available: this[BALANCE_CONFIRMED],
            pending: this[BALANCE_PENDING],
            total: this[BALANCE_CONFIRMED] + this[BALANCE_PENDING]
        };
    }
    /**
     * Set by addressManager
     */
    get receiveAddress() {
        return this.addressManager.receiveAddress.current.address;
    }
    get changeAddress() {
        return this.addressManager.changeAddress.current.address;
    }
    /** Create a wallet.
     * @param walletSave (optional)
     * @param walletSave.privKey Saved wallet's private key.
     * @param walletSave.seedPhrase Saved wallet's seed phrase.
     */
    constructor(privKey, seedPhrase, networkOptions, options = {}) {
        super();
        this.disableBalanceNotifications = false;
        /**
         * Current network.
         */
        this.network = 'kobra';
        /**
         * Default fee
         */
        this.defaultFee = 1; //per byte
        this.subnetworkId = "0000000000000000000000000000000000000000"; //hex string
        this.last_tx_ = '';
        /**
         * Current API endpoint for selected network
         */
        this.apiEndpoint = 'localhost:16210';
        this.blueScore = -1;
        this.syncVirtualSelectedParentBlueScoreStarted = false;
        this.syncInProggress = false;
        /* eslint-disable */
        this.pendingInfo = {
            transactions: {},
            get amount() {
                const transactions = Object.values(this.transactions);
                if (transactions.length === 0)
                    return 0;
                return transactions.reduce((prev, cur) => prev + cur.amount + cur.fee, 0);
            },
            add(id, tx) {
                this.transactions[id] = tx;
            }
        };
        /**
         * Transactions sorted by hash.
         */
        this.transactions = {};
        /**
         * Transaction arrays keyed by address.
         */
        this.transactionsStorage = {};
        this[_a] = 0;
        this[_b] = 0;
        this[_c] = 0;
        /**
         * Emit wallet balance.
         */
        this.lastBalanceNotification = { available: 0, pending: 0 };
        this.debugInfo = { inUseUTXOs: { satoshis: 0, count: 0 } };
        this.lastAddressNotification = {};
        //UTXOsPollingStarted:boolean = false;
        this.emitedUTXOs = new Set();
        this.loggerLevel = 0;
        this.logger = (0, logger_1.CreateLogger)('KaspaWallet');
        this.api = new api_1.KaspaAPI();
        //@ts-ignore
        //postMessage({error:new ApiError("test") })
        let defaultOpt = {
            skipSyncBalance: false,
            syncOnce: false,
            addressDiscoveryExtent: 150,
            logLevel: 'info',
            disableAddressDerivation: false,
            checkGRPCFlags: false,
            minimumRelayTransactionFee: 1000,
            updateTxTimes: true
        };
        // console.log("CREATING WALLET FOR NETWORK", this.network);
        this.options = Object.assign(Object.assign({}, defaultOpt), options);
        //this.options.addressDiscoveryExtent = 500;
        this.setLogLevel(this.options.logLevel);
        this.network = networkOptions.network;
        this.defaultFee = networkOptions.defaultFee || this.defaultFee;
        if (networkOptions.rpc)
            this.api.setRPC(networkOptions.rpc);
        if (privKey && seedPhrase) {
            this.HDWallet = new kaspacore.HDPrivateKey(privKey);
            this.mnemonic = seedPhrase;
        }
        else {
            const temp = new Mnemonic(Mnemonic.Words.ENGLISH);
            this.mnemonic = temp.toString();
            this.HDWallet = new kaspacore.HDPrivateKey(temp.toHDPrivateKey().toString());
        }
        this.uid = this.createUID();
        this.utxoSet = new utxo_1.UtxoSet(this);
        this.txStore = new tx_store_1.TXStore(this);
        this.cacheStore = new cache_store_1.CacheStore(this);
        //this.utxoSet.on("balance-update", this.updateBalance.bind(this));
        this.addressManager = new address_manager_1.AddressManager(this.HDWallet, this.network);
        if (this.options.disableAddressDerivation)
            this.addressManager.receiveAddress.next();
        //this.initAddressManager();
        //this.sync(this.options.syncOnce);
        this.connectSignal = helper.Deferred();
        this.api.on("connect", () => {
            this.onApiConnect();
        });
        this.api.on("disconnect", () => {
            this.onApiDisconnect();
        });
    }
    createUID() {
        const { privateKey } = this.HDWallet.deriveChild(`m/44'/972/0'/1'/0'`);
        let address = privateKey.toAddress(this.network).toString().split(":")[1];
        return helper.createHash(address);
    }
    onApiConnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connectSignal.resolve();
            let { connected } = this;
            this.connected = true;
            this.logger.info("gRPC connected");
            this.emit("api-connect");
            if (this.syncSignal && connected !== undefined) { //if sync was called
                this.logger.info("starting wallet re-sync ...");
                yield this.sync(this.syncOnce);
            }
        });
    }
    onApiDisconnect() {
        this.connected = false;
        this.syncVirtualSelectedParentBlueScoreStarted = false;
        this.logger.verbose("gRPC disconnected");
        this.emit("api-disconnect");
    }
    update() {
        return __awaiter(this, arguments, void 0, function* (syncOnce = true) {
            yield this.sync(syncOnce);
        });
    }
    waitOrSync() {
        if (this.syncSignal)
            return this.syncSignal;
        return this.sync();
    }
    sync() {
        return __awaiter(this, arguments, void 0, function* (syncOnce = undefined) {
            this.syncSignal = helper.Deferred();
            yield this.connectSignal;
            if (syncOnce === undefined)
                syncOnce = this.options.syncOnce;
            syncOnce = !!syncOnce;
            this.syncInProggress = true;
            this.emit("sync-start");
            yield this.txStore.restore();
            yield this.cacheStore.restore();
            const ts0 = Date.now();
            this.logger.info(`sync ... starting wallet sync`); // ${syncOnce?'(monitoring disabled)':''}`);
            //this.logger.info(`sync ............ started, syncOnce:${syncOnce}`)
            //if last time syncOnce was OFF we have subscriptions to utxo-change
            if (this.syncOnce === false && syncOnce) {
                throw new Error("Wallet sync process already running.");
            }
            this.syncOnce = syncOnce;
            this.initAddressManager();
            yield this.initBlueScoreSync(syncOnce)
                .catch(e => {
                this.logger.info("syncVirtualSelectedParentBlueScore:error", e);
            });
            if (this.options.disableAddressDerivation) {
                this.logger.warn('sync ... running with address discovery disabled');
                this.utxoSet.syncAddressesUtxos([this.receiveAddress]);
            }
            else {
                yield this.addressDiscovery(this.options.addressDiscoveryExtent)
                    .catch(e => {
                    this.logger.info("addressDiscovery:error", e);
                });
            }
            this.syncInProggress = false;
            if (!syncOnce)
                yield this.utxoSet.utxoSubscribe();
            const ts1 = Date.now();
            const delta = ((ts1 - ts0) / 1000).toFixed(1);
            this.logger.info(`sync ... ${this.utxoSet.count} UTXO entries found`);
            this.logger.info(`sync ... indexed ${this.addressManager.receiveAddress.counter} receive and ${this.addressManager.changeAddress.counter} change addresses`);
            this.logger.info(`sync ... finished (sync done in ${delta} seconds)`);
            this.emit("sync-finish");
            const { available, pending, total } = this.balance;
            this.emit("ready", {
                available, pending, total,
                confirmedUtxosCount: this.utxoSet.confirmedCount
            });
            this.emitBalance();
            this.emitAddress();
            this.txStore.emitTxs();
            this.syncSignal.resolve();
            if (!this.utxoSet.clearMissing())
                this.updateDebugInfo();
        });
    }
    getVirtualSelectedParentBlueScore() {
        return this.api.getVirtualSelectedParentBlueScore();
    }
    getVirtualDaaScore() {
        return this.api.getVirtualDaaScore();
    }
    initBlueScoreSync() {
        return __awaiter(this, arguments, void 0, function* (once = false) {
            if (this.syncVirtualSelectedParentBlueScoreStarted)
                return;
            this.syncVirtualSelectedParentBlueScoreStarted = true;
            let r = yield this.getVirtualDaaScore();
            let { virtualDaaScore: blueScore } = r;
            console.log("getVirtualSelectedParentBlueScore :result", r);
            this.blueScore = blueScore;
            this.emit("blue-score-changed", { blueScore });
            this.utxoSet.updateUtxoBalance();
            if (once) {
                this.syncVirtualSelectedParentBlueScoreStarted = false;
                return;
            }
            this.api.subscribeVirtualDaaScoreChanged((result) => {
                let { virtualDaaScore } = result;
                //console.log("subscribeVirtualSelectedParentBlueScoreChanged:result", result)
                this.blueScore = virtualDaaScore;
                this.emit("blue-score-changed", {
                    blueScore: virtualDaaScore
                });
                this.utxoSet.updateUtxoBalance();
            }).then(r => {
                console.log("subscribeVirtualDaaScoreChanged:responce", r);
            }, e => {
                console.log("subscribeVirtualDaaScoreChanged:error", e);
            });
        });
    }
    initAddressManager() {
        if (this.addressManagerInitialized)
            return;
        this.addressManagerInitialized = true;
        this.addressManager.on("new-address", detail => {
            if (!this.syncInProggress) {
                this.emitAddress();
            }
            //console.log("new-address", detail)
            if (this.options.skipSyncBalance)
                return;
            //console.log("new-address:detail", detail)
            const { address, type } = detail;
            this.utxoSet.syncAddressesUtxos([address]);
        });
        if (!this.receiveAddress) {
            this.addressManager.receiveAddress.next();
        }
    }
    startUpdatingTransactions() {
        return __awaiter(this, arguments, void 0, function* (version = undefined) {
            return yield this.txStore.startUpdatingTransactions(version);
        });
    }
    /**
     * Set rpc provider
     * @param rpc
     */
    setRPC(rpc) {
        this.api.setRPC(rpc);
    }
    /*
    setStorageType(type:StorageType){
        this.storage.setType(type);
    }
    setStorageFolder(folder:string){
        this.storage.setFolder(folder);
    }
    setStorageFileName(fileName:string){
        this.storage.setFileName(fileName);
    }
    */
    /*
    _storage: typeof storageClasses.Storage|undefined;

    setStoragePassword(password: string) {
        if (!this.storage)
            throw new Error("Please init storage")
        this.storage.setPassword(password);
    }
    get storage(): typeof storageClasses.Storage | undefined {
        return this._storage;
    }

    openFileStorage(fileName: string, password: string, folder: string = '') {
        let storage = CreateStorage();
        if (folder)
            storage.setFolder(folder);
        storage.setFileName(fileName);
        storage.setPassword(password);
        this._storage = storage;
    }
    */
    /**
     * Queries API for address[] UTXOs. Adds tx to transactions storage. Also sorts the entire transaction set.
     * @param addresses
     */
    findUtxos(addresses_1) {
        return __awaiter(this, arguments, void 0, function* (addresses, debug = false) {
            this.logger.verbose(`scanning UTXO entries for ${addresses.length} addresses`);
            const utxosMap = yield this.api.getUtxosByAddresses(addresses);
            const addressesWithUTXOs = [];
            const txID2Info = new Map();
            if (debug) {
                utxosMap.forEach((utxos, address) => {
                    // utxos.sort((b, a)=> a.index-b.index)
                    utxos.map(t => {
                        let info = txID2Info.get(t.transactionId);
                        if (!info) {
                            info = {
                                utxos: [],
                                address
                            };
                            txID2Info.set(t.transactionId, info);
                        }
                        info.utxos.push(t);
                    });
                });
            }
            utxosMap.forEach((utxos, address) => {
                // utxos.sort((b, a)=> a.index-b.index)
                this.logger.verbose(`${address} - ${utxos.length} UTXO entries found`);
                if (utxos.length !== 0) {
                    this.disableBalanceNotifications = true;
                    this.utxoSet.utxoStorage[address] = utxos;
                    this.utxoSet.add(utxos, address);
                    addressesWithUTXOs.push(address);
                    this.disableBalanceNotifications = false;
                    this.emitBalance();
                }
            });
            const isActivityOnReceiveAddr = this.utxoSet.utxoStorage[this.receiveAddress] !== undefined;
            if (isActivityOnReceiveAddr) {
                this.addressManager.receiveAddress.next();
            }
            return {
                addressesWithUTXOs,
                txID2Info
            };
        });
    }
    adjustBalance(isConfirmed, amount, notify = true) {
        const { available, pending } = this.balance;
        if (isConfirmed) {
            this[BALANCE_CONFIRMED] += amount;
        }
        else {
            this[BALANCE_PENDING] += amount;
        }
        this[BALANCE_TOTAL] = this[BALANCE_CONFIRMED] + this[BALANCE_PENDING];
        if (notify === false)
            return;
        const { available: _available, pending: _pending } = this.balance;
        if (!this.syncInProggress && !this.disableBalanceNotifications && (available != _available || pending != _pending))
            this.emitBalance();
    }
    emitBalance() {
        const { available, pending, total } = this.balance;
        const { available: _available, pending: _pending } = this.lastBalanceNotification;
        if (available == _available && pending == _pending)
            return;
        this.lastBalanceNotification = { available, pending };
        this.logger.debug(`balance available: ${available} pending: ${pending}`);
        this.emit("balance-update", {
            available,
            pending,
            total,
            confirmedUtxosCount: this.utxoSet.confirmedCount
        });
    }
    updateDebugInfo() {
        let inUseUTXOs = { satoshis: 0, count: 0 };
        let { confirmed, pending, used } = this.utxoSet.utxos || {};
        this.utxoSet.inUse.map(utxoId => {
            var _d, _e, _f;
            inUseUTXOs.satoshis += ((_d = confirmed.get(utxoId)) === null || _d === void 0 ? void 0 : _d.satoshis) ||
                ((_e = pending.get(utxoId)) === null || _e === void 0 ? void 0 : _e.satoshis) ||
                ((_f = used.get(utxoId)) === null || _f === void 0 ? void 0 : _f.satoshis) || 0;
        });
        inUseUTXOs.count = this.utxoSet.inUse.length;
        this.debugInfo = { inUseUTXOs };
        this.emit("debug-info", { debugInfo: this.debugInfo });
    }
    clearUsedUTXOs() {
        this.utxoSet.clearUsed();
    }
    emitCache() {
        let { cache } = this;
        this.emit("state-update", { cache });
    }
    emitAddress() {
        const receive = this.receiveAddress;
        const change = this.changeAddress;
        let { receive: _receive, change: _change } = this.lastAddressNotification;
        if (receive == _receive && change == _change)
            return;
        this.lastAddressNotification = { receive, change };
        this.emit("new-address", {
            receive, change
        });
    }
    /**
     * Updates the selected network
     * @param network name of the network
     */
    updateNetwork(network) {
        return __awaiter(this, void 0, void 0, function* () {
            this.demolishWalletState(network.prefix);
            this.network = network.prefix;
            this.apiEndpoint = network.apiBaseUrl;
        });
    }
    demolishWalletState(networkPrefix = this.network) {
        this.utxoSet.clear();
        this.addressManager = new address_manager_1.AddressManager(this.HDWallet, networkPrefix);
        //this.pendingInfo.transactions = {};
        this.transactions = {};
        this.transactionsStorage = {};
    }
    scanMoreAddresses() {
        return __awaiter(this, arguments, void 0, function* (count = 100, debug = false, receiveStart = -1, changeStart = -1) {
            if (this.syncInProggress)
                return { error: "Sync in progress", code: "SYNC-IN-PROGRESS" };
            if (receiveStart < 0)
                receiveStart = this.addressManager.receiveAddress.counter;
            if (changeStart < 0)
                changeStart = this.addressManager.changeAddress.counter;
            this.syncInProggress = true;
            this.emit("scan-more-addresses-started", { receiveStart, changeStart });
            let error = false;
            let res = yield this.addressDiscovery(this.options.addressDiscoveryExtent, debug, receiveStart, changeStart, count)
                .catch(e => {
                this.logger.info("addressDiscovery:error", e);
                error = e;
            });
            this.syncInProggress = false;
            if (!this.syncOnce)
                this.utxoSet.utxoSubscribe();
            this.emit("scan-more-addresses-ended", { error });
            if (error)
                return { error, code: "ADDRESS-DISCOVERY" };
            let { highestIndex = null, endPoints = null } = res || {};
            this.logger.info("scanMoreAddresses:highestIndex", highestIndex);
            this.logger.info("scanMoreAddresses:endPoints", endPoints);
            this.emit("scan-more-addresses-ended", {
                receiveFinal: this.addressManager.receiveAddress.counter - 1,
                changeFinal: this.addressManager.changeAddress.counter - 1
            });
            return {
                code: "SUCCESS",
                receive: {
                    start: receiveStart,
                    end: (endPoints === null || endPoints === void 0 ? void 0 : endPoints.receive) || receiveStart + count,
                    final: this.addressManager.receiveAddress.counter - 1
                },
                change: {
                    start: changeStart,
                    end: (endPoints === null || endPoints === void 0 ? void 0 : endPoints.change) || changeStart + count,
                    final: this.addressManager.changeAddress.counter - 1
                }
            };
        });
    }
    /**
     * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
     * @param threshold stop discovering after `threshold` addresses with no activity
     */
    addressDiscovery() {
        return __awaiter(this, arguments, void 0, function* (threshold = 64, debug = false, receiveStart = 0, changeStart = 0, count = 0) {
            var _d;
            let addressList = [];
            let debugInfo = null;
            this.logger.info(`sync ... running address discovery, threshold:${threshold}`);
            const cacheIndexes = (_d = this.cacheStore.getAddressIndexes()) !== null && _d !== void 0 ? _d : { receive: 0, change: 0 };
            this.logger.info(`sync ...cacheIndexes: receive:${cacheIndexes.receive}, change:${cacheIndexes.change}`);
            let highestIndex = {
                receive: this.addressManager.receiveAddress.counter - 1,
                change: this.addressManager.changeAddress.counter - 1
            };
            let endPoints = {
                receive: 0,
                change: 0
            };
            let maxOffset = {
                receive: receiveStart + count,
                change: changeStart + count
            };
            const doDiscovery = (n, deriveType, offset) => __awaiter(this, void 0, void 0, function* () {
                this.logger.info(`sync ... scanning ${offset} - ${offset + n} ${deriveType} addresses`);
                this.emit("sync-progress", {
                    start: offset,
                    end: offset + n,
                    addressType: deriveType
                });
                const derivedAddresses = this.addressManager.getAddresses(n, deriveType, offset);
                const addresses = derivedAddresses.map((obj) => obj.address);
                addressList = [...addressList, ...addresses];
                this.logger.verbose(`${deriveType}: address data for derived indices ${derivedAddresses[0].index}..${derivedAddresses[derivedAddresses.length - 1].index}`);
                // if (this.loggerLevel > 0)
                // 	this.logger.verbose("addressDiscovery: findUtxos for addresses::", addresses)
                const { addressesWithUTXOs, txID2Info } = yield this.findUtxos(addresses, debug);
                if (!debugInfo)
                    debugInfo = txID2Info;
                if (addressesWithUTXOs.length === 0) {
                    // address discovery complete
                    const lastAddressIndexWithTx = highestIndex[deriveType]; //offset - (threshold - n) - 1;
                    this.logger.verbose(`${deriveType}: address discovery complete`);
                    this.logger.verbose(`${deriveType}: last activity on address #${lastAddressIndexWithTx}`);
                    this.logger.verbose(`${deriveType}: no activity from ${offset}..${offset + n}`);
                    if (offset >= maxOffset[deriveType] && offset >= cacheIndexes[deriveType]) {
                        endPoints[deriveType] = offset + n;
                        return lastAddressIndexWithTx;
                    }
                }
                // else keep doing discovery
                const index = derivedAddresses
                    .filter((obj) => addressesWithUTXOs.includes(obj.address))
                    .reduce((prev, cur) => Math.max(prev, cur.index), highestIndex[deriveType]);
                highestIndex[deriveType] = index;
                return doDiscovery(n, deriveType, offset + n);
            });
            const highestReceiveIndex = yield doDiscovery(threshold, 'receive', receiveStart);
            const highestChangeIndex = yield doDiscovery(threshold, 'change', changeStart);
            this.addressManager.receiveAddress.advance(highestReceiveIndex + 1);
            this.addressManager.changeAddress.advance(highestChangeIndex + 1);
            this.logger.verbose(`receive address index: ${highestReceiveIndex}; change address index: ${highestChangeIndex}`, `receive-address-index: ${this.addressManager.receiveAddress.counter}; change address index: ${this.addressManager.changeAddress.counter}`);
            if (!this.syncOnce && !this.syncInProggress)
                yield this.utxoSet.utxoSubscribe();
            this.runStateChangeHooks();
            let addressIndexes = {
                receive: Math.max(cacheIndexes.receive, this.addressManager.receiveAddress.counter),
                change: Math.max(cacheIndexes.change, this.addressManager.changeAddress.counter)
            };
            this.logger.info(`sync ...new cache: receive:${addressIndexes.receive}, change:${addressIndexes.change}`);
            this.cacheStore.setAddressIndexes(addressIndexes);
            this.emit("sync-end", addressIndexes);
            return { highestIndex, endPoints, debugInfo };
        });
    }
    // TODO: convert amount to sompis aka satoshis
    // TODO: bn
    /**
     * Compose a serialized, signed transaction
     * @param obj
     * @param obj.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param obj.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
     * @param obj.fee Fee for miners in sompis
     * @param obj.changeAddrOverride Use this to override automatic change address derivation
     * @throws if amount is above `Number.MAX_SAFE_INTEGER`
     */
    composeTx({ toAddr, amount, fee = config_json_1.DEFAULT_FEE, changeAddrOverride, skipSign = false, privKeysInfo = false, compoundingUTXO = false, compoundingUTXOMaxCount = COMPOUND_UTXO_MAX_COUNT }) {
        // TODO: bn!
        amount = parseInt(amount);
        fee = parseInt(fee);
        // if (this.loggerLevel > 0) {
        // 	for (let i = 0; i < 100; i++)
        // 		console.log('Wallet transaction request for', amount, typeof amount);
        // }
        //if (!Number.isSafeInteger(amount)) throw new Error(`Amount ${amount} is too large`);
        let utxos, utxoIds, mass;
        if (compoundingUTXO) {
            ({ utxos, utxoIds, amount, mass } = this.utxoSet.collectUtxos(compoundingUTXOMaxCount));
        }
        else {
            ({ utxos, utxoIds, mass } = this.utxoSet.selectUtxos(amount + fee));
        }
        //if(mass > Wallet.MaxMassUTXOs){
        //	throw new Error(`Maximum number of inputs (UTXOs) reached. Please reduce this transaction amount.`);
        //}
        const privKeys = utxos.reduce((prev, cur) => {
            return [this.addressManager.all[String(cur.address)], ...prev];
        }, []);
        this.logger.info("utxos.length", utxos.length);
        const changeAddr = changeAddrOverride || this.addressManager.changeAddress.next();
        try {
            const tx = new kaspacore.Transaction()
                .from(utxos)
                .to(toAddr, amount)
                .setVersion(0)
                .fee(fee)
                .change(changeAddr);
            if (!skipSign)
                tx.sign(privKeys, kaspacore.crypto.Signature.SIGHASH_ALL, 'schnorr');
            //window.txxxx = tx;
            return {
                tx: tx,
                id: tx.id,
                rawTx: tx.toString(),
                utxoIds,
                amount,
                fee,
                utxos,
                toAddr,
                privKeys: privKeysInfo ? privKeys : []
            };
        }
        catch (e) {
            console.log("composeTx:error", e);
            // !!! FIXME
            if (!changeAddrOverride)
                this.addressManager.changeAddress.reverse();
            throw e;
        }
    }
    minimumRequiredTransactionRelayFee(mass) {
        let minimumFee = (mass * this.options.minimumRelayTransactionFee) / 1000;
        if (minimumFee == 0 && this.options.minimumRelayTransactionFee > 0) {
            minimumFee = this.options.minimumRelayTransactionFee;
        }
        // Set the minimum fee to the maximum possible value if the calculated
        // fee is not in the valid range for monetary amounts.
        if (minimumFee > MaxSompi) {
            minimumFee = MaxSompi;
        }
        return minimumFee;
    }
    /*
    validateAddress(addr:string):boolean{
        let address = new kaspacore.Address(addr);
        return address.type == "pubkey";
    }
    */
    /**
     * Estimate transaction fee. Returns transaction data.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    estimateTransaction(txParamsArg) {
        return __awaiter(this, void 0, void 0, function* () {
            let address = this.addressManager.changeAddress.current.address;
            if (!address) {
                address = this.addressManager.changeAddress.next();
            }
            txParamsArg.changeAddrOverride = address;
            return this.composeTxAndNetworkFeeInfo(txParamsArg);
        });
    }
    composeTxAndNetworkFeeInfo(txParamsArg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.waitOrSync();
            if (!txParamsArg.fee)
                txParamsArg.fee = 0;
            this.logger.info(`tx ... sending to ${txParamsArg.toAddr}`);
            this.logger.info(`tx ... amount: ${KAS(txParamsArg.amount)} user fee: ${KAS(txParamsArg.fee)} max data fee: ${KAS(txParamsArg.networkFeeMax || 0)}`);
            //if(!this.validateAddress(txParamsArg.toAddr)){
            //	throw new Error("Invalid address")
            //}
            let txParams = Object.assign({}, txParamsArg);
            const networkFeeMax = txParams.networkFeeMax || 0;
            let calculateNetworkFee = !!txParams.calculateNetworkFee;
            let inclusiveFee = !!txParams.inclusiveFee;
            const { skipSign = true, privKeysInfo = false } = txParams;
            txParams.skipSign = skipSign;
            txParams.privKeysInfo = privKeysInfo;
            //console.log("calculateNetworkFee:", calculateNetworkFee, "inclusiveFee:", inclusiveFee)
            let data = this.composeTx(txParams);
            let { txSize, mass } = data.tx.getMassAndSize();
            let dataFee = this.minimumRequiredTransactionRelayFee(mass);
            const priorityFee = txParamsArg.fee;
            if (txParamsArg.compoundingUTXO) {
                inclusiveFee = true;
                calculateNetworkFee = true;
                txParamsArg.amount = data.amount;
                txParams.amount = data.amount;
                txParams.compoundingUTXO = false;
            }
            const txAmount = txParamsArg.amount;
            let amountRequested = txParamsArg.amount + priorityFee;
            let amountAvailable = data.utxos.map(utxo => utxo.satoshis).reduce((a, b) => a + b, 0);
            this.logger.verbose(`tx ... need data fee: ${KAS(dataFee)} total needed: ${KAS(amountRequested + dataFee)}`);
            this.logger.verbose(`tx ... available: ${KAS(amountAvailable)} in ${data.utxos.length} UTXOs`);
            if (networkFeeMax && dataFee > networkFeeMax) {
                throw new Error(`Fee max is ${networkFeeMax} but the minimum fee required for this transaction is ${KAS(dataFee)} KAS`);
            }
            if (calculateNetworkFee) {
                do {
                    //console.log(`insufficient data fees... incrementing by ${dataFee}`);
                    txParams.fee = priorityFee + dataFee;
                    if (inclusiveFee) {
                        txParams.amount = txAmount - txParams.fee;
                    }
                    this.logger.verbose(`tx ... insufficient data fee for transaction size of ${txSize} bytes`);
                    this.logger.verbose(`tx ... need data fee: ${KAS(dataFee)} for ${data.utxos.length} UTXOs`);
                    this.logger.verbose(`tx ... rebuilding transaction with additional inputs`);
                    let utxoLen = data.utxos.length;
                    this.logger.debug(`final fee ${txParams.fee}`);
                    data = this.composeTx(txParams);
                    ({ txSize, mass } = data.tx.getMassAndSize());
                    dataFee = this.minimumRequiredTransactionRelayFee(mass);
                    if (data.utxos.length != utxoLen)
                        this.logger.verbose(`tx ... aggregating: ${data.utxos.length} UTXOs`);
                } while ((!networkFeeMax || txParams.fee <= networkFeeMax) && txParams.fee < dataFee + priorityFee);
                if (networkFeeMax && txParams.fee > networkFeeMax)
                    throw new Error(`Maximum network fee exceeded; need: ${KAS(dataFee)} KAS maximum is: ${KAS(networkFeeMax)} KAS`);
            }
            else if (dataFee > priorityFee) {
                throw new Error(`Minimum fee required for this transaction is ${KAS(dataFee)} KAS`);
            }
            else if (inclusiveFee) {
                txParams.amount -= txParams.fee;
                data = this.composeTx(txParams);
            }
            data.dataFee = dataFee;
            data.totalAmount = txParams.fee + txParams.amount;
            data.txSize = txSize;
            data.note = txParamsArg.note || "";
            return data;
        });
    }
    /**
     * Build a transaction. Returns transaction info.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    buildTransaction(txParamsArg_1) {
        return __awaiter(this, arguments, void 0, function* (txParamsArg, debug = false) {
            const ts0 = Date.now();
            txParamsArg.skipSign = true;
            txParamsArg.privKeysInfo = true;
            const data = yield this.composeTxAndNetworkFeeInfo(txParamsArg);
            const { id, tx, utxos, utxoIds, amount, toAddr, fee, dataFee, totalAmount, txSize, note, privKeys } = data;
            const ts_0 = Date.now();
            tx.sign(privKeys, kaspacore.crypto.Signature.SIGHASH_ALL, 'schnorr');
            const { mass: txMass } = tx.getMassAndSize();
            this.logger.info("txMass", txMass);
            if (txMass > Wallet.MaxMassAcceptedByBlock) {
                throw new Error(`Transaction size/mass limit reached. Please reduce this transaction amount. (Mass: ${txMass})`);
            }
            const ts_1 = Date.now();
            //const rawTx = tx.toString();
            const ts_2 = Date.now();
            this.logger.info(`tx ... required data fee: ${KAS(dataFee)} (${utxos.length} UTXOs)`); // (${KAS(txParamsArg.fee)}+${KAS(dataFee)})`);
            //this.logger.verbose(`tx ... final fee: ${KAS(dataFee+txParamsArg.fee)} (${KAS(txParamsArg.fee)}+${KAS(dataFee)})`);
            this.logger.info(`tx ... resulting total: ${KAS(totalAmount)}`);
            //console.log(utxos);
            if (debug || this.loggerLevel > 0) {
                this.logger.debug("submitTransaction: estimateTx", data);
                this.logger.debug("sendTx:utxos", utxos);
                this.logger.debug("::utxos[0].script::", utxos[0].script);
                //console.log("::utxos[0].address::", utxos[0].address)
            }
            const { nLockTime: lockTime, version } = tx;
            if (debug || this.loggerLevel > 0)
                this.logger.debug("composeTx:tx", "txSize:", txSize);
            const ts_3 = Date.now();
            const inputs = tx.inputs.map((input) => {
                if (debug || this.loggerLevel > 0) {
                    this.logger.debug("input.script.inspect", input.script.inspect());
                }
                return {
                    previousOutpoint: {
                        transactionId: input.prevTxId.toString("hex"),
                        index: input.outputIndex
                    },
                    signatureScript: input.script.toBuffer().toString("hex"),
                    sequence: input.sequenceNumber,
                    sigOpCount: 1
                };
            });
            const ts_4 = Date.now();
            const outputs = tx.outputs.map((output) => {
                return {
                    amount: output.satoshis,
                    scriptPublicKey: {
                        scriptPublicKey: output.script.toBuffer().toString("hex"),
                        version: 0
                    }
                };
            });
            const ts_5 = Date.now();
            //const payloadStr = "0000000000000000000000000000000";
            //const payload = Buffer.from(payloadStr).toString("base64");
            //console.log("payload-hex:", Buffer.from(payloadStr).toString("hex"))
            //@ ts-ignore
            //const payloadHash = kaspacore.crypto.Hash.sha256sha256(Buffer.from(payloadStr));
            const rpcTX = {
                transaction: {
                    version,
                    inputs,
                    outputs,
                    lockTime,
                    //payload:'f00f00000000000000001976a914784bf4c2562f38fe0c49d1e0538cee4410d37e0988ac',
                    payloadHash: '0000000000000000000000000000000000000000000000000000000000000000',
                    //payloadHash:'afe7fc6fe3288e79f9a0c05c22c1ead2aae29b6da0199d7b43628c2588e296f9',
                    //
                    subnetworkId: this.subnetworkId, //Buffer.from(this.subnetworkId, "hex").toString("base64"),
                    fee,
                    //gas: 0
                }
            };
            //const rpctx = JSON.stringify(rpcTX, null, "  ");
            const ts1 = Date.now();
            this.logger.info(`tx ... generation time ${((ts1 - ts0) / 1000).toFixed(2)} sec`);
            if (debug || this.loggerLevel > 0) {
                this.logger.debug(`rpcTX ${JSON.stringify(rpcTX, null, "  ")}`);
                this.logger.debug(`rpcTX ${JSON.stringify(rpcTX)}`);
            }
            const ts_6 = Date.now();
            this.logger.info(`time in msec`, {
                "total": ts_6 - ts0,
                "estimate-transaction": ts_0 - ts0,
                "tx.sign": ts_1 - ts_0,
                "tx.toString": ts_2 - ts_1,
                //"ts_3-ts_2": ts_3-ts_2,
                "tx.inputs.map": ts_4 - ts_3,
                "tx.outputs.map": ts_5 - ts_4,
                //"ts_6-ts_5": ts_6-ts_5
            });
            if (txParamsArg.skipUTXOInUseMark !== true) {
                this.utxoSet.updateUsed(utxos);
            }
            //const rpctx = JSON.stringify(rpcTX, null, "  ");
            //console.log("rpcTX", rpcTX)
            //console.log("\n\n########rpctx\n", rpctx+"\n\n\n")
            //if(amount/1e8 > 3)
            //	throw new Error("TODO XXXXXX")
            return Object.assign(Object.assign({}, data), { rpcTX });
        });
    }
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    submitTransaction(txParamsArg_1) {
        return __awaiter(this, arguments, void 0, function* (txParamsArg, debug = false) {
            txParamsArg.skipUTXOInUseMark = true;
            let reverseChangeAddress = false;
            if (!txParamsArg.changeAddrOverride) {
                txParamsArg.changeAddrOverride = this.addressManager.changeAddress.next();
                reverseChangeAddress = true;
            }
            const { rpcTX, utxoIds, amount, toAddr, note, utxos } = yield this.buildTransaction(txParamsArg, debug);
            //console.log("rpcTX:", rpcTX)
            //throw new Error("TODO : XXXX")
            try {
                const ts = Date.now();
                let txid = yield this.api.submitTransaction(rpcTX);
                const ts3 = Date.now();
                this.logger.info(`tx ... submission time ${((ts3 - ts) / 1000).toFixed(2)} sec`);
                this.logger.info(`txid: ${txid}`);
                if (!txid) {
                    if (reverseChangeAddress)
                        this.addressManager.changeAddress.reverse();
                    return null; // as TxResp;
                }
                this.utxoSet.inUse.push(...utxoIds);
                this.txStore.add({
                    in: false, ts, id: txid, amount, address: toAddr, note,
                    blueScore: this.blueScore,
                    tx: rpcTX.transaction,
                    myAddress: this.addressManager.isOur(toAddr),
                    isCoinbase: false,
                    version: 2
                });
                this.updateDebugInfo();
                this.emitCache();
                /*
                this.pendingInfo.add(txid, {
                    rawTx: tx.toString(),
                    utxoIds,
                    amount,
                    to: toAddr,
                    fee
                });
                */
                const resp = {
                    txid,
                    //rpctx
                };
                return resp;
            }
            catch (e) {
                if (reverseChangeAddress)
                    this.addressManager.changeAddress.reverse();
                if (typeof e.setExtraDebugInfo == "function") {
                    let mass = 0;
                    let satoshis = 0;
                    let list = utxos.map(tx => {
                        var _d;
                        mass += tx.mass;
                        satoshis += tx.satoshis;
                        return Object.assign({}, tx, {
                            address: tx.address.toString(),
                            script: (_d = tx.script) === null || _d === void 0 ? void 0 : _d.toString()
                        });
                    });
                    //86500,00000000
                    let info = {
                        mass,
                        satoshis,
                        utxoCount: list.length,
                        utxos: list
                    };
                    e.setExtraDebugInfo(info);
                }
                throw e;
            }
        });
    }
    /*
    * Compound UTXOs by re-sending funds to itself
    */
    compoundUTXOs() {
        return __awaiter(this, arguments, void 0, function* (txCompoundOptions = {}, debug = false) {
            const { UTXOMaxCount = COMPOUND_UTXO_MAX_COUNT, networkFeeMax = 0, fee = 0, useLatestChangeAddress = false } = txCompoundOptions;
            //let toAddr = this.addressManager.changeAddress.next()
            let toAddr = this.addressManager.changeAddress.atIndex[0];
            //console.log("compoundUTXOs: to address:", toAddr, "useLatestChangeAddress:"+useLatestChangeAddress)
            if (useLatestChangeAddress) {
                toAddr = this.addressManager.changeAddress.current.address;
            }
            if (!toAddr) {
                toAddr = this.addressManager.changeAddress.next();
            }
            let txParamsArg = {
                toAddr,
                changeAddrOverride: toAddr,
                amount: -1,
                fee,
                networkFeeMax,
                compoundingUTXO: true,
                compoundingUTXOMaxCount: UTXOMaxCount
            };
            try {
                let res = yield this.submitTransaction(txParamsArg, debug);
                if (!(res === null || res === void 0 ? void 0 : res.txid))
                    this.addressManager.changeAddress.reverse();
                return res;
            }
            catch (e) {
                this.addressManager.changeAddress.reverse();
                throw e;
            }
        });
    }
    /*
    undoPendingTx(id: string): void {
        const {	utxoIds	} = this.pendingInfo.transactions[id];
        delete this.pendingInfo.transactions[id];
        this.utxoSet.release(utxoIds);
        this.addressManager.changeAddress.reverse();
        this.runStateChangeHooks();
    }
    */
    /**
     * After we see the transaction in the API results, delete it from our pending list.
     * @param id The tx hash
     */
    /*
   deletePendingTx(id: string): void {
       // undo + delete old utxos
       const {	utxoIds } = this.pendingInfo.transactions[id];
       delete this.pendingInfo.transactions[id];
       this.utxoSet.remove(utxoIds);
   }
   */
    runStateChangeHooks() {
        //this.utxoSet.updateUtxoBalance();
        //this.updateBalance();
    }
    startUTXOsPolling() {
        //if (this.UTXOsPollingStarted)
        //	return
        //this.UTXOsPollingStarted = true;
        this.emitUTXOs();
    }
    emitUTXOs() {
        let chunks = helper.chunks([...this.utxoSet.utxos.confirmed.values()], 100);
        chunks = chunks.concat(helper.chunks([...this.utxoSet.utxos.pending.values()], 100));
        let send = () => {
            let utxos = chunks.pop();
            if (!utxos)
                return;
            utxos = utxos.map(tx => {
                return Object.assign({}, tx, {
                    address: tx.address.toString()
                });
            });
            this.emit("utxo-sync", { utxos });
            helper.dpc(200, send);
        };
        send();
    }
    get cache() {
        return {
            //pendingTx: this.pendingInfo.transactions,
            utxos: {
                //utxoStorage: this.utxoSet.utxoStorage,
                inUse: this.utxoSet.inUse,
            },
            //transactionsStorage: this.transactionsStorage,
            addresses: {
                receiveCounter: this.addressManager.receiveAddress.counter,
                changeCounter: this.addressManager.changeAddress.counter,
            }
        };
    }
    restoreCache(cache) {
        //this.pendingInfo.transactions = cache.pendingTx;
        //this.utxoSet.utxoStorage = cache.utxos.utxoStorage;
        this.utxoSet.inUse = cache.utxos.inUse;
        /*
        Object.entries(this.utxoSet.utxoStorage).forEach(([addr, utxos]: [string, Api.Utxo[]]) => {
            this.utxoSet.add(utxos, addr);
        });
        this.transactionsStorage = cache.transactionsStorage;
        this.addressManager.getAddresses(cache.addresses.receiveCounter + 1, 'receive');
        this.addressManager.getAddresses(cache.addresses.changeCounter + 1, 'change');
        this.addressManager.receiveAddress.advance(cache.addresses.receiveCounter - 1);
        this.addressManager.changeAddress.advance(cache.addresses.changeCounter);
        //this.transactions = txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
        this.runStateChangeHooks();
        */
    }
    /**
     * Generates encrypted wallet data.
     * @param password user's chosen password
     * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
     */
    export(password) {
        return __awaiter(this, void 0, void 0, function* () {
            const savedWallet = {
                privKey: this.HDWallet.toString(),
                seedPhrase: this.mnemonic
            };
            return crypto_1.Crypto.encrypt(password, JSON.stringify(savedWallet));
        });
    }
    setLogLevel(level) {
        this.logger.setLevel(level);
        this.loggerLevel = level != 'none' ? 2 : 0;
        kaspacore.setDebugLevel(level ? 1 : 0);
    }
}
exports.Wallet = Wallet;
_a = BALANCE_CONFIRMED, _b = BALANCE_PENDING, _c = BALANCE_TOTAL;
Wallet.Mnemonic = Mnemonic;
Wallet.passwordHandler = crypto_1.Crypto;
Wallet.Crypto = crypto_1.Crypto;
Wallet.kaspacore = kaspacore;
Wallet.COMPOUND_UTXO_MAX_COUNT = COMPOUND_UTXO_MAX_COUNT;
Wallet.MaxMassAcceptedByBlock = 100000;
Wallet.MaxMassUTXOs = 100000;
//Wallet.MaxMassAcceptedByBlock -
//kaspacore.Transaction.EstimatedStandaloneMassWithoutInputs;
// TODO - integrate with Kaspacore-lib
Wallet.networkTypes = {
    kobra: { port: 44448, network: 'kobra-mainnet', name: 'mainnet' },
    kobratest: { port: 42422, network: 'kobra-testnet', name: 'testnet' },
    kobrasim: { port: 42424, network: 'kobra-simnet', name: 'simnet' },
    kobradev: { port: 424246, network: 'kobra-devnet', name: 'devnet' },
    kobrareg: { port: 42428, network: 'kobra-ergnet', name: 'regnet' }
};
Wallet.networkAliases = {
    mainnet: 'kobra',
    testnet: 'kobratest',
    regnet: 'kobrareg',
    devnet: 'kobradev',
    simnet: 'kobrasim'
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FsbGV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L3dhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDN0MsMkRBQTZDO0FBbUNyQyw4QkFBUztBQWxDakIsd0RBQTBDO0FBRTFDLDRDQUEwQjtBQUMxQiwwQ0FBd0I7QUFDeEIscUNBQWdDO0FBQ2hDLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUM7QUFTdkIsNENBQXFEO0FBQ3JELHVEQUFpRDtBQUNqRCxpQ0FBc0Y7QUFrQjFDLG1HQWxCWix5QkFBa0IsT0FrQlk7QUFBRSxtR0FsQloseUJBQWtCLE9Ba0JZO0FBakJsRix5Q0FBbUM7QUFDbkMsK0NBQXlDO0FBQ3pDLCtCQUF5QztBQUN6QyxnREFBMkQ7QUFDM0QsMkRBQW9EO0FBR3BELE1BQU0saUJBQWlCLEdBQUcsTUFBTSxFQUFFLENBQUM7QUFDbkMsTUFBTSxlQUFlLEdBQUcsTUFBTSxFQUFFLENBQUM7QUFDakMsTUFBTSxhQUFhLEdBQUcsTUFBTSxFQUFFLENBQUM7QUFDL0IsTUFBTSx1QkFBdUIsR0FBRyxHQUFHLENBQUM7QUFPakIsMERBQXVCO0FBTDFDLE1BQU0sYUFBYSxHQUFHLFNBQVcsQ0FBQTtBQUVqQywrREFBK0Q7QUFDL0QsTUFBTSxRQUFRLEdBQUcsUUFBVSxHQUFHLGFBQWEsQ0FBQTtBQUkzQyxvRUFBb0U7QUFDcEUsTUFBTSxNQUFPLFNBQVEsbUNBQWU7SUE4Qm5DLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBUTtRQUNsQixPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNmLENBQUM7SUFHRCxNQUFNLENBQUMsV0FBVztRQUNqQixPQUFPLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUNo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eUI7QUFDaEQsNkJBQXNCLEdBQUcsTUFBTSxBQUFULENBQVU7QUFDaEMsbUJBQVksR0FBRyxNQUFNLEFBQVQsQ0FBVTtBQUM3QixpQ0FBaUM7QUFDakMsNkRBQTZEO0FBRTdELHNDQUFzQztBQUMvQixtQkFBWSxHQUFXO0lBQzdCLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUcsU0FBUyxFQUFFO0lBQ2xFLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUcsU0FBUyxFQUFFO0lBQ3RFLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUcsUUFBUSxFQUFFO0lBQ25FLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUcsUUFBUSxFQUFFO0lBQ3BFLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUcsUUFBUSxFQUFFO0NBQ25FLEFBTmtCLENBTWxCO0FBRU0scUJBQWMsR0FBVztJQUMvQixPQUFPLEVBQUUsT0FBTztJQUNoQixPQUFPLEVBQUUsV0FBVztJQUNwQixNQUFNLEVBQUUsVUFBVTtJQUNsQixNQUFNLEVBQUUsVUFBVTtJQUNsQixNQUFNLEVBQUUsVUFBVTtDQUNsQixBQU5vQixDQU1wQiIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IE1uZW1vbmljID0gcmVxdWlyZSgnYml0Y29yZS1tbmVtb25pYycpO1xuaW1wb3J0ICogYXMga2FzcGFjb3JlIGZyb20gJ0BrYXNwYS9jb3JlLWxpYic7XG5pbXBvcnQgKiBhcyBoZWxwZXIgZnJvbSAnLi4vdXRpbHMvaGVscGVyJztcbmltcG9ydCB7U3RvcmFnZSwgU3RvcmFnZVR5cGV9IGZyb20gJy4vc3RvcmFnZSc7XG5leHBvcnQgKiBmcm9tICcuL3N0b3JhZ2UnO1xuZXhwb3J0ICogZnJvbSAnLi9lcnJvcic7XG5pbXBvcnQge0NyeXB0b30gZnJvbSAnLi9jcnlwdG8nO1xuY29uc3QgS0FTID0gaGVscGVyLktBUztcblxuaW1wb3J0IHtcblx0TmV0d29yaywgTmV0d29ya09wdGlvbnMsIFNlbGVjdGVkTmV0d29yaywgV2FsbGV0U2F2ZSwgQXBpLCBUeFNlbmQsIFR4UmVzcCxcblx0UGVuZGluZ1RyYW5zYWN0aW9ucywgV2FsbGV0Q2FjaGUsIElSUEMsIFJQQywgV2FsbGV0T3B0aW9ucyxcdFdhbGxldE9wdCxcblx0VHhJbmZvLCBDb21wb3NlVHhJbmZvLCBCdWlsZFR4UmVzdWx0LCBUeENvbXBvdW5kT3B0aW9ucywgRGVidWdJbmZvLFxuXHRTY2FuZU1vcmVSZXN1bHRcbn0gZnJvbSAnLi4vdHlwZXMvY3VzdG9tLXR5cGVzJztcblxuaW1wb3J0IHtDcmVhdGVMb2dnZXIsIExvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7QWRkcmVzc01hbmFnZXJ9IGZyb20gJy4vYWRkcmVzcy1tYW5hZ2VyJztcbmltcG9ydCB7VW5zcGVudE91dHB1dCwgVXR4b1NldCwgQ09ORklSTUFUSU9OX0NPVU5ULCBDT0lOQkFTRV9DRk1fQ09VTlR9IGZyb20gJy4vdXR4byc7XG5pbXBvcnQge1RYU3RvcmV9IGZyb20gJy4vdHgtc3RvcmUnO1xuaW1wb3J0IHtDYWNoZVN0b3JlfSBmcm9tICcuL2NhY2hlLXN0b3JlJztcbmltcG9ydCB7S2FzcGFBUEksIEFwaUVycm9yfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0RFRkFVTFRfRkVFLERFRkFVTFRfTkVUV09SS30gZnJvbSAnLi4vY29uZmlnLmpzb24nO1xuaW1wb3J0IHtFdmVudFRhcmdldEltcGx9IGZyb20gJy4vZXZlbnQtdGFyZ2V0LWltcGwnO1xuXG5cbmNvbnN0IEJBTEFOQ0VfQ09ORklSTUVEID0gU3ltYm9sKCk7XG5jb25zdCBCQUxBTkNFX1BFTkRJTkcgPSBTeW1ib2woKTtcbmNvbnN0IEJBTEFOQ0VfVE9UQUwgPSBTeW1ib2woKTtcbmNvbnN0IENPTVBPVU5EX1VUWE9fTUFYX0NPVU5UID0gNTAwO1xuXG5jb25zdCBTb21waVBlckthc3BhID0gMTAwXzAwMF8wMDBcblxuLy8gTWF4U29tcGkgaXMgdGhlIG1heGltdW0gdHJhbnNhY3Rpb24gYW1vdW50IGFsbG93ZWQgaW4gc29tcGkuXG5jb25zdCBNYXhTb21waSA9IDIxXzAwMF8wMDAgKiBTb21waVBlckthc3BhXG5cbmV4cG9ydCB7a2FzcGFjb3JlLCBDT01QT1VORF9VVFhPX01BWF9DT1VOVCwgQ09ORklSTUFUSU9OX0NPVU5ULCBDT0lOQkFTRV9DRk1fQ09VTlR9O1xuXG4vKiogQ2xhc3MgcmVwcmVzZW50aW5nIGFuIEhEV2FsbGV0IHdpdGggZGVyaXZhYmxlIGNoaWxkIGFkZHJlc3NlcyAqL1xuY2xhc3MgV2FsbGV0IGV4dGVuZHMgRXZlbnRUYXJnZXRJbXBsIHtcblxuXHRzdGF0aWMgTW5lbW9uaWM6IHR5cGVvZiBNbmVtb25pYyA9IE1uZW1vbmljO1xuXHRzdGF0aWMgcGFzc3dvcmRIYW5kbGVyID0gQ3J5cHRvO1xuXHRzdGF0aWMgQ3J5cHRvID0gQ3J5cHRvO1xuXHRzdGF0aWMga2FzcGFjb3JlPWthc3BhY29yZTtcblx0c3RhdGljIENPTVBPVU5EX1VUWE9fTUFYX0NPVU5UPUNPTVBPVU5EX1VUWE9fTUFYX0NPVU5UO1xuXHRzdGF0aWMgTWF4TWFzc0FjY2VwdGVkQnlCbG9jayA9IDEwMDAwMDtcblx0c3RhdGljIE1heE1hc3NVVFhPcyA9IDEwMDAwMDtcblx0Ly9XYWxsZXQuTWF4TWFzc0FjY2VwdGVkQnlCbG9jayAtXG5cdC8va2FzcGFjb3JlLlRyYW5zYWN0aW9uLkVzdGltYXRlZFN0YW5kYWxvbmVNYXNzV2l0aG91dElucHV0cztcblxuXHQvLyBUT0RPIC0gaW50ZWdyYXRlIHdpdGggS2FzcGFjb3JlLWxpYlxuXHRzdGF0aWMgbmV0d29ya1R5cGVzOiBPYmplY3QgPSB7XG5cdFx0a29icmE6IHsgcG9ydDogNDQ0NDgsIG5ldHdvcms6ICdrb2JyYS1tYWlubmV0JywgbmFtZSA6ICdtYWlubmV0JyB9LFxuXHRcdGtvYnJhdGVzdDogeyBwb3J0OiA0MjQyMiwgbmV0d29yazogJ2tvYnJhLXRlc3RuZXQnLCBuYW1lIDogJ3Rlc3RuZXQnIH0sXG5cdFx0a29icmFzaW06IHtcdHBvcnQ6IDQyNDI0LCBuZXR3b3JrOiAna29icmEtc2ltbmV0JywgbmFtZSA6ICdzaW1uZXQnIH0sXG5cdFx0a29icmFkZXY6IHtcdHBvcnQ6IDQyNDI0NiwgbmV0d29yazogJ2tvYnJhLWRldm5ldCcsIG5hbWUgOiAnZGV2bmV0JyB9LFxuXHRcdGtvYnJhcmVnOiB7IHBvcnQ6IDQyNDI4LCBuZXR3b3JrOiAna29icmEtZXJnbmV0JywgbmFtZSA6ICdyZWduZXQnIH1cblx0fVxuXG5cdHN0YXRpYyBuZXR3b3JrQWxpYXNlczogT2JqZWN0ID0ge1xuXHRcdG1haW5uZXQ6ICdrb2JyYScsXG5cdFx0dGVzdG5ldDogJ2tvYnJhdGVzdCcsXG5cdFx0cmVnbmV0OiAna29icmFyZWcnLFxuXHRcdGRldm5ldDogJ2tvYnJhZGV2Jyxcblx0XHRzaW1uZXQ6ICdrb2JyYXNpbSdcblx0fVxuXG5cblx0c3RhdGljIEtBUyh2Om51bWJlcik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEtBUyh2KTtcblx0fVxuXG5cblx0c3RhdGljIGluaXRSdW50aW1lKCkge1xuXHRcdHJldHVybiBrYXNwYWNvcmUuaW5pdFJ1bnRpbWUoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIG1uZW1vbmljIHRvIGEgbmV3IHdhbGxldC5cblx0ICogQHBhcmFtIHNlZWRQaHJhc2UgVGhlIDEyIHdvcmQgc2VlZCBwaHJhc2UuXG5cdCAqIEByZXR1cm5zIG5ldyBXYWxsZXRcblx0ICovXG5cdHN0YXRpYyBmcm9tTW5lbW9uaWMoc2VlZFBocmFzZTogc3RyaW5nLCBuZXR3b3JrT3B0aW9uczogTmV0d29ya09wdGlvbnMsIG9wdGlvbnM6IFdhbGxldE9wdGlvbnMgPSB7fSk6IFdhbGxldCB7XG5cdFx0aWYgKCFuZXR3b3JrT3B0aW9ucyB8fCAhbmV0d29ya09wdGlvbnMubmV0d29yaylcblx0XHRcdHRocm93IG5ldyBFcnJvcihgZnJvbU1uZW1vbmljKHNlZWRQaHJhc2UsbmV0d29ya09wdGlvbnMpOiBtaXNzaW5nIG5ldHdvcmsgYXJndW1lbnRgKTtcblx0XHRjb25zdCBwcml2S2V5ID0gbmV3IE1uZW1vbmljKHNlZWRQaHJhc2UudHJpbSgpKS50b0hEUHJpdmF0ZUtleSgpLnRvU3RyaW5nKCk7XG5cdFx0Y29uc3Qgd2FsbGV0ID0gbmV3IHRoaXMocHJpdktleSwgc2VlZFBocmFzZSwgbmV0d29ya09wdGlvbnMsIG9wdGlvbnMpO1xuXHRcdHJldHVybiB3YWxsZXQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyBXYWxsZXQgZnJvbSBlbmNyeXB0ZWQgd2FsbGV0IGRhdGEuXG5cdCAqIEBwYXJhbSBwYXNzd29yZCB0aGUgcGFzc3dvcmQgdGhlIHVzZXIgZW5jcnlwdGVkIHRoZWlyIHNlZWQgcGhyYXNlIHdpdGhcblx0ICogQHBhcmFtIGVuY3J5cHRlZE1uZW1vbmljIHRoZSBlbmNyeXB0ZWQgc2VlZCBwaHJhc2UgZnJvbSBsb2NhbCBzdG9yYWdlXG5cdCAqIEB0aHJvd3MgV2lsbCB0aHJvdyBcIkluY29ycmVjdCBwYXNzd29yZFwiIGlmIHBhc3N3b3JkIGlzIHdyb25nXG5cdCAqL1xuXHRzdGF0aWMgYXN5bmMgaW1wb3J0IChwYXNzd29yZDogc3RyaW5nLCBlbmNyeXB0ZWRNbmVtb25pYzogc3RyaW5nLCBuZXR3b3JrT3B0aW9uczogTmV0d29ya09wdGlvbnMsIG9wdGlvbnM6IFdhbGxldE9wdGlvbnMgPSB7fSk6IFByb21pc2UgPCBXYWxsZXQgPiB7XG5cdFx0Y29uc3QgZGVjcnlwdGVkID0gYXdhaXQgQ3J5cHRvLmRlY3J5cHQocGFzc3dvcmQsIGVuY3J5cHRlZE1uZW1vbmljKTtcblx0XHRjb25zdCBzYXZlZFdhbGxldCA9IEpTT04ucGFyc2UoZGVjcnlwdGVkKSBhcyBXYWxsZXRTYXZlO1xuXHRcdGNvbnN0IG15V2FsbGV0ID0gbmV3IHRoaXMoc2F2ZWRXYWxsZXQucHJpdktleSwgc2F2ZWRXYWxsZXQuc2VlZFBocmFzZSwgbmV0d29ya09wdGlvbnMsIG9wdGlvbnMpO1xuXHRcdHJldHVybiBteVdhbGxldDtcblx0fVxuXG5cdEhEV2FsbGV0OiBrYXNwYWNvcmUuSERQcml2YXRlS2V5O1xuXHRkaXNhYmxlQmFsYW5jZU5vdGlmaWNhdGlvbnM6IGJvb2xlYW4gPSBmYWxzZTtcblx0Z2V0IGJhbGFuY2UoKToge2F2YWlsYWJsZTogbnVtYmVyLCBwZW5kaW5nOm51bWJlciwgdG90YWw6bnVtYmVyfSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGF2YWlsYWJsZTogdGhpc1tCQUxBTkNFX0NPTkZJUk1FRF0sXG5cdFx0XHRwZW5kaW5nOiB0aGlzW0JBTEFOQ0VfUEVORElOR10sXG5cdFx0XHR0b3RhbDogdGhpc1tCQUxBTkNFX0NPTkZJUk1FRF0gKyB0aGlzW0JBTEFOQ0VfUEVORElOR11cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogU2V0IGJ5IGFkZHJlc3NNYW5hZ2VyXG5cdCAqL1xuXHRnZXQgcmVjZWl2ZUFkZHJlc3MoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY3VycmVudC5hZGRyZXNzO1xuXHR9XG5cblx0Z2V0IGNoYW5nZUFkZHJlc3MoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jdXJyZW50LmFkZHJlc3M7XG5cdH1cblxuXHQvKipcblx0ICogQ3VycmVudCBuZXR3b3JrLlxuXHQgKi9cblx0bmV0d29yazogTmV0d29yayA9ICdrb2JyYSc7XG5cblx0YXBpOiBLYXNwYUFQSTsgLy9uZXcgS2FzcGFBUEkoKTtcblxuXHQvKiogXG5cdCAqIERlZmF1bHQgZmVlXG5cdCAqL1xuXG5cdGRlZmF1bHRGZWU6IG51bWJlciA9IDE7IC8vcGVyIGJ5dGVcblxuXHRzdWJuZXR3b3JrSWQ6IHN0cmluZyA9IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMFwiOyAvL2hleCBzdHJpbmdcblxuXHRsYXN0X3R4XzpzdHJpbmcgPSAnJztcblx0LyoqXG5cdCAqIEN1cnJlbnQgQVBJIGVuZHBvaW50IGZvciBzZWxlY3RlZCBuZXR3b3JrXG5cdCAqL1xuXHRhcGlFbmRwb2ludCA9ICdsb2NhbGhvc3Q6MTYyMTAnO1xuXG5cdC8qKlxuXHQgKiBBIDEyIHdvcmQgbW5lbW9uaWMuXG5cdCAqL1xuXHRtbmVtb25pYzogc3RyaW5nO1xuXG5cdHV0eG9TZXQ6IFV0eG9TZXQ7XG5cblx0YWRkcmVzc01hbmFnZXI6IEFkZHJlc3NNYW5hZ2VyO1xuXG5cdGJsdWVTY29yZTogbnVtYmVyID0gLTE7XG5cblx0c3luY1ZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZVN0YXJ0ZWQ6Ym9vbGVhbiA9IGZhbHNlO1xuXHRzeW5jSW5Qcm9nZ3Jlc3M6Ym9vbGVhbiA9IGZhbHNlO1xuXG5cdC8qIGVzbGludC1kaXNhYmxlICovXG5cdHBlbmRpbmdJbmZvOiBQZW5kaW5nVHJhbnNhY3Rpb25zID0ge1xuXHRcdHRyYW5zYWN0aW9uczoge30sXG5cdFx0Z2V0IGFtb3VudCgpIHtcblx0XHRcdGNvbnN0IHRyYW5zYWN0aW9ucyA9IE9iamVjdC52YWx1ZXModGhpcy50cmFuc2FjdGlvbnMpO1xuXHRcdFx0aWYgKHRyYW5zYWN0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiAwO1xuXHRcdFx0cmV0dXJuIHRyYW5zYWN0aW9ucy5yZWR1Y2UoKHByZXYsIGN1cikgPT4gcHJldiArIGN1ci5hbW91bnQgKyBjdXIuZmVlLCAwKTtcblx0XHR9LFxuXHRcdGFkZChcblx0XHRcdGlkOiBzdHJpbmcsXG5cdFx0XHR0eDoge1xuXHRcdFx0XHR0bzogc3RyaW5nO1xuXHRcdFx0XHR1dHhvSWRzOiBzdHJpbmdbXTtcblx0XHRcdFx0cmF3VHg6IHN0cmluZztcblx0XHRcdFx0YW1vdW50OiBudW1iZXI7XG5cdFx0XHRcdGZlZTogbnVtYmVyXG5cdFx0XHR9XG5cdFx0KSB7XG5cdFx0XHR0aGlzLnRyYW5zYWN0aW9uc1tpZF0gPSB0eDtcblx0XHR9XG5cdH07XG5cdC8qKlxuXHQgKiBUcmFuc2FjdGlvbnMgc29ydGVkIGJ5IGhhc2guXG5cdCAqL1xuXHR0cmFuc2FjdGlvbnM6UmVjb3JkPHN0cmluZywgeyByYXdUeDogc3RyaW5nOyB1dHhvSWRzOiBzdHJpbmdbXTsgYW1vdW50OiBudW1iZXI7IHRvOiBzdHJpbmc7IGZlZTogbnVtYmVyOyB9PiA9IHt9O1xuXG5cdC8qKlxuXHQgKiBUcmFuc2FjdGlvbiBhcnJheXMga2V5ZWQgYnkgYWRkcmVzcy5cblx0ICovXG5cdHRyYW5zYWN0aW9uc1N0b3JhZ2U6IFJlY29yZCA8IHN0cmluZywgQXBpLlRyYW5zYWN0aW9uW10gPiA9IHt9O1xuXG5cblx0b3B0aW9uczogV2FsbGV0T3B0O1xuXHRjb25uZWN0U2lnbmFsOmhlbHBlci5EZWZlcnJlZFByb21pc2U7XG5cdHR4U3RvcmU6VFhTdG9yZTtcblx0Y2FjaGVTdG9yZTpDYWNoZVN0b3JlO1xuXG5cdHVpZDpzdHJpbmc7XG5cblx0LyoqIENyZWF0ZSBhIHdhbGxldC5cblx0ICogQHBhcmFtIHdhbGxldFNhdmUgKG9wdGlvbmFsKVxuXHQgKiBAcGFyYW0gd2FsbGV0U2F2ZS5wcml2S2V5IFNhdmVkIHdhbGxldCdzIHByaXZhdGUga2V5LlxuXHQgKiBAcGFyYW0gd2FsbGV0U2F2ZS5zZWVkUGhyYXNlIFNhdmVkIHdhbGxldCdzIHNlZWQgcGhyYXNlLlxuXHQgKi9cblx0Y29uc3RydWN0b3IocHJpdktleTogc3RyaW5nLCBzZWVkUGhyYXNlOiBzdHJpbmcsIG5ldHdvcmtPcHRpb25zOiBOZXR3b3JrT3B0aW9ucywgb3B0aW9uczogV2FsbGV0T3B0aW9ucyA9IHt9KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmxvZ2dlciA9IENyZWF0ZUxvZ2dlcignS2FzcGFXYWxsZXQnKTtcblx0XHR0aGlzLmFwaSA9IG5ldyBLYXNwYUFQSSgpO1xuXHRcdC8vQHRzLWlnbm9yZVxuXHRcdC8vcG9zdE1lc3NhZ2Uoe2Vycm9yOm5ldyBBcGlFcnJvcihcInRlc3RcIikgfSlcblx0XHRsZXQgZGVmYXVsdE9wdCA9IHtcblx0XHRcdHNraXBTeW5jQmFsYW5jZTogZmFsc2UsXG5cdFx0XHRzeW5jT25jZTogZmFsc2UsXG5cdFx0XHRhZGRyZXNzRGlzY292ZXJ5RXh0ZW50OjE1MCxcblx0XHRcdGxvZ0xldmVsOidpbmZvJyxcblx0XHRcdGRpc2FibGVBZGRyZXNzRGVyaXZhdGlvbjpmYWxzZSxcblx0XHRcdGNoZWNrR1JQQ0ZsYWdzOmZhbHNlLFxuXHRcdFx0bWluaW11bVJlbGF5VHJhbnNhY3Rpb25GZWU6MTAwMCxcblx0XHRcdHVwZGF0ZVR4VGltZXM6dHJ1ZVxuXHRcdH07XG5cdFx0Ly8gY29uc29sZS5sb2coXCJDUkVBVElORyBXQUxMRVQgRk9SIE5FVFdPUktcIiwgdGhpcy5uZXR3b3JrKTtcblx0XHR0aGlzLm9wdGlvbnMgPSB7Li4uZGVmYXVsdE9wdCxcdC4uLm9wdGlvbnN9O1xuXHRcdC8vdGhpcy5vcHRpb25zLmFkZHJlc3NEaXNjb3ZlcnlFeHRlbnQgPSA1MDA7XG5cdFx0dGhpcy5zZXRMb2dMZXZlbCh0aGlzLm9wdGlvbnMubG9nTGV2ZWwpOyBcblxuXHRcdHRoaXMubmV0d29yayA9IG5ldHdvcmtPcHRpb25zLm5ldHdvcms7XG5cdFx0dGhpcy5kZWZhdWx0RmVlID0gbmV0d29ya09wdGlvbnMuZGVmYXVsdEZlZSB8fCB0aGlzLmRlZmF1bHRGZWU7XG5cdFx0aWYgKG5ldHdvcmtPcHRpb25zLnJwYylcblx0XHRcdHRoaXMuYXBpLnNldFJQQyhuZXR3b3JrT3B0aW9ucy5ycGMpO1xuXG5cblx0XHRpZiAocHJpdktleSAmJiBzZWVkUGhyYXNlKSB7XG5cdFx0XHR0aGlzLkhEV2FsbGV0ID0gbmV3IGthc3BhY29yZS5IRFByaXZhdGVLZXkocHJpdktleSk7XG5cdFx0XHR0aGlzLm1uZW1vbmljID0gc2VlZFBocmFzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdGVtcCA9IG5ldyBNbmVtb25pYyhNbmVtb25pYy5Xb3Jkcy5FTkdMSVNIKTtcblx0XHRcdHRoaXMubW5lbW9uaWMgPSB0ZW1wLnRvU3RyaW5nKCk7XG5cdFx0XHR0aGlzLkhEV2FsbGV0ID0gbmV3IGthc3BhY29yZS5IRFByaXZhdGVLZXkodGVtcC50b0hEUHJpdmF0ZUtleSgpLnRvU3RyaW5nKCkpO1xuXHRcdH1cblxuXHRcdHRoaXMudWlkID0gdGhpcy5jcmVhdGVVSUQoKTtcblxuXHRcdHRoaXMudXR4b1NldCA9IG5ldyBVdHhvU2V0KHRoaXMpO1xuXHRcdHRoaXMudHhTdG9yZSA9IG5ldyBUWFN0b3JlKHRoaXMpO1xuXHRcdHRoaXMuY2FjaGVTdG9yZSA9IG5ldyBDYWNoZVN0b3JlKHRoaXMpO1xuXHRcdC8vdGhpcy51dHhvU2V0Lm9uKFwiYmFsYW5jZS11cGRhdGVcIiwgdGhpcy51cGRhdGVCYWxhbmNlLmJpbmQodGhpcykpO1xuXHRcdFxuXHRcdHRoaXMuYWRkcmVzc01hbmFnZXIgPSBuZXcgQWRkcmVzc01hbmFnZXIodGhpcy5IRFdhbGxldCwgdGhpcy5uZXR3b3JrKTtcblx0XHRpZih0aGlzLm9wdGlvbnMuZGlzYWJsZUFkZHJlc3NEZXJpdmF0aW9uKVxuXHRcdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5uZXh0KCk7XG5cdFx0Ly90aGlzLmluaXRBZGRyZXNzTWFuYWdlcigpO1xuXHRcdC8vdGhpcy5zeW5jKHRoaXMub3B0aW9ucy5zeW5jT25jZSk7XG5cdFx0dGhpcy5jb25uZWN0U2lnbmFsID0gaGVscGVyLkRlZmVycmVkKCk7XG5cdFx0dGhpcy5hcGkub24oXCJjb25uZWN0XCIsICgpPT57XG5cdFx0XHR0aGlzLm9uQXBpQ29ubmVjdCgpXG5cdFx0fSlcblx0XHR0aGlzLmFwaS5vbihcImRpc2Nvbm5lY3RcIiwgKCk9Pntcblx0XHRcdHRoaXMub25BcGlEaXNjb25uZWN0KCk7XG5cdFx0fSlcblx0fVxuXG5cdGNyZWF0ZVVJRCgpe1xuXHRcdGNvbnN0IHtwcml2YXRlS2V5fSA9IHRoaXMuSERXYWxsZXQuZGVyaXZlQ2hpbGQoYG0vNDQnLzk3Mi8wJy8xJy8wJ2ApO1xuXHRcdGxldCBhZGRyZXNzID0gcHJpdmF0ZUtleS50b0FkZHJlc3ModGhpcy5uZXR3b3JrKS50b1N0cmluZygpLnNwbGl0KFwiOlwiKVsxXVxuXHRcdHJldHVybiBoZWxwZXIuY3JlYXRlSGFzaChhZGRyZXNzKTtcblx0fVxuXG5cdGFzeW5jIG9uQXBpQ29ubmVjdCgpe1xuXHRcdHRoaXMuY29ubmVjdFNpZ25hbC5yZXNvbHZlKCk7XG5cdFx0bGV0IHtjb25uZWN0ZWR9ID0gdGhpcztcblx0XHR0aGlzLmNvbm5lY3RlZCA9IHRydWU7XG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhcImdSUEMgY29ubmVjdGVkXCIpO1xuXHRcdHRoaXMuZW1pdChcImFwaS1jb25uZWN0XCIpO1xuXHRcdGlmKHRoaXMuc3luY1NpZ25hbCAmJiBjb25uZWN0ZWQhPT11bmRlZmluZWQpIHsvL2lmIHN5bmMgd2FzIGNhbGxlZFxuXHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhcInN0YXJ0aW5nIHdhbGxldCByZS1zeW5jIC4uLlwiKTtcblx0XHRcdGF3YWl0IHRoaXMuc3luYyh0aGlzLnN5bmNPbmNlKTtcblx0XHR9XG5cdFx0XG5cdH1cblxuXHRjb25uZWN0ZWQ6Ym9vbGVhbnx1bmRlZmluZWQ7XG5cdG9uQXBpRGlzY29ubmVjdCgpIHtcblx0XHR0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xuXHRcdHRoaXMuc3luY1ZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZVN0YXJ0ZWQgPSBmYWxzZTtcblx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKFwiZ1JQQyBkaXNjb25uZWN0ZWRcIik7XG5cdFx0dGhpcy5lbWl0KFwiYXBpLWRpc2Nvbm5lY3RcIik7XG5cdH1cblxuXHRhc3luYyB1cGRhdGUoc3luY09uY2U6Ym9vbGVhbj10cnVlKXtcblx0XHRhd2FpdCB0aGlzLnN5bmMoc3luY09uY2UpO1xuXHR9XG5cblx0c3luY09uY2U6Ym9vbGVhbnx1bmRlZmluZWQ7XG5cdHN5bmNTaWduYWw6IGhlbHBlci5EZWZlcnJlZFByb21pc2V8dW5kZWZpbmVkO1xuXHR3YWl0T3JTeW5jKCl7XG5cdFx0aWYodGhpcy5zeW5jU2lnbmFsKVxuXHRcdFx0cmV0dXJuIHRoaXMuc3luY1NpZ25hbDtcblx0XHRyZXR1cm4gdGhpcy5zeW5jKCk7XG5cdH1cblx0YXN5bmMgc3luYyhzeW5jT25jZTpib29sZWFufHVuZGVmaW5lZD11bmRlZmluZWQpe1xuXHRcdHRoaXMuc3luY1NpZ25hbCA9IGhlbHBlci5EZWZlcnJlZCgpO1xuXHRcdGF3YWl0IHRoaXMuY29ubmVjdFNpZ25hbDtcblx0XHRpZihzeW5jT25jZSA9PT0gdW5kZWZpbmVkKVxuXHRcdFx0c3luY09uY2UgPSB0aGlzLm9wdGlvbnMuc3luY09uY2U7XG5cdFx0c3luY09uY2UgPSAhIXN5bmNPbmNlO1xuXG5cdFx0dGhpcy5zeW5jSW5Qcm9nZ3Jlc3MgPSB0cnVlO1xuXHRcdHRoaXMuZW1pdChcInN5bmMtc3RhcnRcIik7XG5cdFx0YXdhaXQgdGhpcy50eFN0b3JlLnJlc3RvcmUoKTtcblx0XHRhd2FpdCB0aGlzLmNhY2hlU3RvcmUucmVzdG9yZSgpO1xuXHRcdGNvbnN0IHRzMCA9IERhdGUubm93KCk7XG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhgc3luYyAuLi4gc3RhcnRpbmcgd2FsbGV0IHN5bmNgKTsvLyAke3N5bmNPbmNlPycobW9uaXRvcmluZyBkaXNhYmxlZCknOicnfWApO1xuXHRcdC8vdGhpcy5sb2dnZXIuaW5mbyhgc3luYyAuLi4uLi4uLi4uLi4gc3RhcnRlZCwgc3luY09uY2U6JHtzeW5jT25jZX1gKVxuXG5cdFx0Ly9pZiBsYXN0IHRpbWUgc3luY09uY2Ugd2FzIE9GRiB3ZSBoYXZlIHN1YnNjcmlwdGlvbnMgdG8gdXR4by1jaGFuZ2Vcblx0XHRpZih0aGlzLnN5bmNPbmNlID09PSBmYWxzZSAmJiBzeW5jT25jZSl7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJXYWxsZXQgc3luYyBwcm9jZXNzIGFscmVhZHkgcnVubmluZy5cIilcblx0XHR9XG5cblx0XHR0aGlzLnN5bmNPbmNlID0gc3luY09uY2U7XG5cdFx0dGhpcy5pbml0QWRkcmVzc01hbmFnZXIoKTtcblxuXHRcdGF3YWl0IHRoaXMuaW5pdEJsdWVTY29yZVN5bmMoc3luY09uY2UpXG5cdCAgICAuY2F0Y2goZT0+e1xuXHQgICAgICAgIHRoaXMubG9nZ2VyLmluZm8oXCJzeW5jVmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlOmVycm9yXCIsIGUpXG5cdCAgICB9KVxuXHRcdFxuXHRcdGlmKHRoaXMub3B0aW9ucy5kaXNhYmxlQWRkcmVzc0Rlcml2YXRpb24pe1xuXHRcdFx0dGhpcy5sb2dnZXIud2Fybignc3luYyAuLi4gcnVubmluZyB3aXRoIGFkZHJlc3MgZGlzY292ZXJ5IGRpc2FibGVkJyk7XG5cdFx0XHR0aGlzLnV0eG9TZXQuc3luY0FkZHJlc3Nlc1V0eG9zKFt0aGlzLnJlY2VpdmVBZGRyZXNzXSk7XG5cdFx0fWVsc2V7XG5cdFx0ICAgIGF3YWl0IHRoaXMuYWRkcmVzc0Rpc2NvdmVyeSh0aGlzLm9wdGlvbnMuYWRkcmVzc0Rpc2NvdmVyeUV4dGVudClcblx0XHQgICAgLmNhdGNoKGU9Pntcblx0XHQgICAgICAgIHRoaXMubG9nZ2VyLmluZm8oXCJhZGRyZXNzRGlzY292ZXJ5OmVycm9yXCIsIGUpXG5cdFx0ICAgIH0pXG5cdCAgICB9XG5cblx0ICAgIHRoaXMuc3luY0luUHJvZ2dyZXNzID0gZmFsc2U7XG5cdCAgICBpZighc3luY09uY2UpXG5cdFx0XHRhd2FpdCB0aGlzLnV0eG9TZXQudXR4b1N1YnNjcmliZSgpO1xuXG5cdFx0Y29uc3QgdHMxID0gRGF0ZS5ub3coKTtcblx0XHRjb25zdCBkZWx0YSA9ICgodHMxLXRzMCkvMTAwMCkudG9GaXhlZCgxKTtcblx0ICAgIHRoaXMubG9nZ2VyLmluZm8oYHN5bmMgLi4uICR7dGhpcy51dHhvU2V0LmNvdW50fSBVVFhPIGVudHJpZXMgZm91bmRgKTtcblx0XHR0aGlzLmxvZ2dlci5pbmZvKGBzeW5jIC4uLiBpbmRleGVkICR7dGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jb3VudGVyfSByZWNlaXZlIGFuZCAke3RoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jb3VudGVyfSBjaGFuZ2UgYWRkcmVzc2VzYCk7XG5cdCAgICB0aGlzLmxvZ2dlci5pbmZvKGBzeW5jIC4uLiBmaW5pc2hlZCAoc3luYyBkb25lIGluICR7ZGVsdGF9IHNlY29uZHMpYCk7XG5cdFx0dGhpcy5lbWl0KFwic3luYy1maW5pc2hcIik7XG5cdFx0Y29uc3Qge2F2YWlsYWJsZSwgcGVuZGluZywgdG90YWx9ID0gdGhpcy5iYWxhbmNlO1xuXHRcdHRoaXMuZW1pdChcInJlYWR5XCIsIHtcblx0XHRcdGF2YWlsYWJsZSxwZW5kaW5nLCB0b3RhbCxcblx0XHRcdGNvbmZpcm1lZFV0eG9zQ291bnQ6IHRoaXMudXR4b1NldC5jb25maXJtZWRDb3VudFxuXHRcdH0pO1xuXHQgICAgdGhpcy5lbWl0QmFsYW5jZSgpO1xuXHQgICAgdGhpcy5lbWl0QWRkcmVzcygpO1xuXHQgICAgdGhpcy50eFN0b3JlLmVtaXRUeHMoKTtcblx0ICAgIHRoaXMuc3luY1NpZ25hbC5yZXNvbHZlKCk7XG5cdFx0aWYoIXRoaXMudXR4b1NldC5jbGVhck1pc3NpbmcoKSlcblx0XHRcdHRoaXMudXBkYXRlRGVidWdJbmZvKCk7XG5cdH1cblxuXHRnZXRWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYXBpLmdldFZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZSgpO1xuXHR9XG5cblx0Z2V0VmlydHVhbERhYVNjb3JlKCkge1xuXHRcdHJldHVybiB0aGlzLmFwaS5nZXRWaXJ0dWFsRGFhU2NvcmUoKTtcblx0fVxuXG5cdGFzeW5jIGluaXRCbHVlU2NvcmVTeW5jKG9uY2U6Ym9vbGVhbiA9IGZhbHNlKSB7XG5cdFx0aWYodGhpcy5zeW5jVmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlU3RhcnRlZClcblx0XHRcdHJldHVybjtcblx0XHR0aGlzLnN5bmNWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVTdGFydGVkID0gdHJ1ZTtcblx0XHRsZXQgciA9IGF3YWl0IHRoaXMuZ2V0VmlydHVhbERhYVNjb3JlKCk7XG5cdFx0bGV0IHt2aXJ0dWFsRGFhU2NvcmU6Ymx1ZVNjb3JlfSA9IHI7XG5cdFx0Y29uc29sZS5sb2coXCJnZXRWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmUgOnJlc3VsdFwiLCByKVxuXHRcdHRoaXMuYmx1ZVNjb3JlID0gYmx1ZVNjb3JlO1xuXHRcdHRoaXMuZW1pdChcImJsdWUtc2NvcmUtY2hhbmdlZFwiLCB7Ymx1ZVNjb3JlfSlcblx0XHR0aGlzLnV0eG9TZXQudXBkYXRlVXR4b0JhbGFuY2UoKTtcblxuXHRcdGlmKG9uY2UpIHtcblx0XHRcdHRoaXMuc3luY1ZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZVN0YXJ0ZWQgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5hcGkuc3Vic2NyaWJlVmlydHVhbERhYVNjb3JlQ2hhbmdlZCgocmVzdWx0KSA9PiB7XG5cdFx0XHRsZXQge3ZpcnR1YWxEYWFTY29yZX0gPSByZXN1bHQ7XG5cdFx0XHQvL2NvbnNvbGUubG9nKFwic3Vic2NyaWJlVmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlQ2hhbmdlZDpyZXN1bHRcIiwgcmVzdWx0KVxuXHRcdFx0dGhpcy5ibHVlU2NvcmUgPSB2aXJ0dWFsRGFhU2NvcmU7XG5cdFx0XHR0aGlzLmVtaXQoXCJibHVlLXNjb3JlLWNoYW5nZWRcIiwge1xuXHRcdFx0XHRibHVlU2NvcmU6IHZpcnR1YWxEYWFTY29yZVxuXHRcdFx0fSlcblx0XHRcdHRoaXMudXR4b1NldC51cGRhdGVVdHhvQmFsYW5jZSgpO1xuXHRcdH0pLnRoZW4ocj0+e1xuXHRcdFx0Y29uc29sZS5sb2coXCJzdWJzY3JpYmVWaXJ0dWFsRGFhU2NvcmVDaGFuZ2VkOnJlc3BvbmNlXCIsIHIpXG5cdFx0fSwgZT0+e1xuXHRcdFx0Y29uc29sZS5sb2coXCJzdWJzY3JpYmVWaXJ0dWFsRGFhU2NvcmVDaGFuZ2VkOmVycm9yXCIsIGUpXG5cdFx0fSlcblx0fVxuXG5cdGFkZHJlc3NNYW5hZ2VySW5pdGlhbGl6ZWQ6Ym9vbGVhbnx1bmRlZmluZWQ7XG5cdGluaXRBZGRyZXNzTWFuYWdlcigpIHtcblx0XHRpZih0aGlzLmFkZHJlc3NNYW5hZ2VySW5pdGlhbGl6ZWQpXG5cdFx0XHRyZXR1cm5cblx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VySW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG5cdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5vbihcIm5ldy1hZGRyZXNzXCIsIGRldGFpbCA9PiB7XG5cdFx0XHRpZighdGhpcy5zeW5jSW5Qcm9nZ3Jlc3Mpe1xuXHRcdFx0XHR0aGlzLmVtaXRBZGRyZXNzKCk7XG5cdFx0XHR9XG5cdFx0XHQvL2NvbnNvbGUubG9nKFwibmV3LWFkZHJlc3NcIiwgZGV0YWlsKVxuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5za2lwU3luY0JhbGFuY2UpXG5cdFx0XHRcdHJldHVyblxuXG5cdFx0XHQvL2NvbnNvbGUubG9nKFwibmV3LWFkZHJlc3M6ZGV0YWlsXCIsIGRldGFpbClcblx0XHRcdGNvbnN0IHtcdGFkZHJlc3MsIHR5cGUgfSA9IGRldGFpbDtcblx0XHRcdHRoaXMudXR4b1NldC5zeW5jQWRkcmVzc2VzVXR4b3MoW2FkZHJlc3NdKTtcblx0XHR9KVxuXHRcdGlmKCF0aGlzLnJlY2VpdmVBZGRyZXNzKXtcblx0XHRcdHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MubmV4dCgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHN0YXJ0VXBkYXRpbmdUcmFuc2FjdGlvbnModmVyc2lvbjp1bmRlZmluZWR8bnVtYmVyPXVuZGVmaW5lZCk6UHJvbWlzZTxib29sZWFuPntcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy50eFN0b3JlLnN0YXJ0VXBkYXRpbmdUcmFuc2FjdGlvbnModmVyc2lvbik7XG5cdH1cblxuXHQvKipcblx0ICogU2V0IHJwYyBwcm92aWRlclxuXHQgKiBAcGFyYW0gcnBjXG5cdCAqL1xuXHRzZXRSUEMocnBjOiBJUlBDKSB7XG5cdFx0dGhpcy5hcGkuc2V0UlBDKHJwYyk7XG5cdH1cblxuXHQvKlxuXHRzZXRTdG9yYWdlVHlwZSh0eXBlOlN0b3JhZ2VUeXBlKXtcblx0XHR0aGlzLnN0b3JhZ2Uuc2V0VHlwZSh0eXBlKTtcblx0fVxuXHRzZXRTdG9yYWdlRm9sZGVyKGZvbGRlcjpzdHJpbmcpe1xuXHRcdHRoaXMuc3RvcmFnZS5zZXRGb2xkZXIoZm9sZGVyKTtcblx0fVxuXHRzZXRTdG9yYWdlRmlsZU5hbWUoZmlsZU5hbWU6c3RyaW5nKXtcblx0XHR0aGlzLnN0b3JhZ2Uuc2V0RmlsZU5hbWUoZmlsZU5hbWUpO1xuXHR9XG5cdCovXG5cdC8qXG5cdF9zdG9yYWdlOiB0eXBlb2Ygc3RvcmFnZUNsYXNzZXMuU3RvcmFnZXx1bmRlZmluZWQ7XG5cblx0c2V0U3RvcmFnZVBhc3N3b3JkKHBhc3N3b3JkOiBzdHJpbmcpIHtcblx0XHRpZiAoIXRoaXMuc3RvcmFnZSlcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlBsZWFzZSBpbml0IHN0b3JhZ2VcIilcblx0XHR0aGlzLnN0b3JhZ2Uuc2V0UGFzc3dvcmQocGFzc3dvcmQpO1xuXHR9XG5cdGdldCBzdG9yYWdlKCk6IHR5cGVvZiBzdG9yYWdlQ2xhc3Nlcy5TdG9yYWdlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RvcmFnZTtcblx0fVxuXG5cdG9wZW5GaWxlU3RvcmFnZShmaWxlTmFtZTogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nLCBmb2xkZXI6IHN0cmluZyA9ICcnKSB7XG5cdFx0bGV0IHN0b3JhZ2UgPSBDcmVhdGVTdG9yYWdlKCk7XG5cdFx0aWYgKGZvbGRlcilcblx0XHRcdHN0b3JhZ2Uuc2V0Rm9sZGVyKGZvbGRlcik7XG5cdFx0c3RvcmFnZS5zZXRGaWxlTmFtZShmaWxlTmFtZSk7XG5cdFx0c3RvcmFnZS5zZXRQYXNzd29yZChwYXNzd29yZCk7XG5cdFx0dGhpcy5fc3RvcmFnZSA9IHN0b3JhZ2U7XG5cdH1cblx0Ki9cblxuXHQvKipcblx0ICogUXVlcmllcyBBUEkgZm9yIGFkZHJlc3NbXSBVVFhPcy4gQWRkcyB0eCB0byB0cmFuc2FjdGlvbnMgc3RvcmFnZS4gQWxzbyBzb3J0cyB0aGUgZW50aXJlIHRyYW5zYWN0aW9uIHNldC5cblx0ICogQHBhcmFtIGFkZHJlc3Nlc1xuXHQgKi9cblx0YXN5bmMgZmluZFV0eG9zKGFkZHJlc3Nlczogc3RyaW5nW10sIGRlYnVnID0gZmFsc2UpOiBQcm9taXNlIDwge1xuXHRcdHR4SUQySW5mbzogTWFwIDwgc3RyaW5nLFxuXHRcdHtcblx0XHRcdHV0eG9zOiBBcGkuVXR4b1tdLFxuXHRcdFx0YWRkcmVzczogc3RyaW5nXG5cdFx0fSA+ICxcblx0XHRhZGRyZXNzZXNXaXRoVVRYT3M6IHN0cmluZ1tdXG5cdH0gPiB7XG5cdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgc2Nhbm5pbmcgVVRYTyBlbnRyaWVzIGZvciAke2FkZHJlc3Nlcy5sZW5ndGh9IGFkZHJlc3Nlc2ApO1xuXG5cdFx0Y29uc3QgdXR4b3NNYXAgPSBhd2FpdCB0aGlzLmFwaS5nZXRVdHhvc0J5QWRkcmVzc2VzKGFkZHJlc3NlcylcblxuXHRcdGNvbnN0IGFkZHJlc3Nlc1dpdGhVVFhPczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCB0eElEMkluZm8gPSBuZXcgTWFwKCk7XG5cblx0XHRpZiAoZGVidWcpIHtcblx0XHRcdHV0eG9zTWFwLmZvckVhY2goKHV0eG9zLCBhZGRyZXNzKSA9PiB7XG5cdFx0XHRcdC8vIHV0eG9zLnNvcnQoKGIsIGEpPT4gYS5pbmRleC1iLmluZGV4KVxuXHRcdFx0XHR1dHhvcy5tYXAodCA9PiB7XG5cdFx0XHRcdFx0bGV0IGluZm8gPSB0eElEMkluZm8uZ2V0KHQudHJhbnNhY3Rpb25JZCk7XG5cdFx0XHRcdFx0aWYgKCFpbmZvKSB7XG5cdFx0XHRcdFx0XHRpbmZvID0ge1xuXHRcdFx0XHRcdFx0XHR1dHhvczogW10sXG5cdFx0XHRcdFx0XHRcdGFkZHJlc3Ncblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR0eElEMkluZm8uc2V0KHQudHJhbnNhY3Rpb25JZCwgaW5mbyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGluZm8udXR4b3MucHVzaCh0KTtcblx0XHRcdFx0fSlcblx0XHRcdH0pXG5cdFx0fVxuXG5cdFx0dXR4b3NNYXAuZm9yRWFjaCgodXR4b3MsIGFkZHJlc3MpID0+IHtcblx0XHRcdC8vIHV0eG9zLnNvcnQoKGIsIGEpPT4gYS5pbmRleC1iLmluZGV4KVxuXHRcdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgJHthZGRyZXNzfSAtICR7dXR4b3MubGVuZ3RofSBVVFhPIGVudHJpZXMgZm91bmRgKTtcblx0XHRcdGlmICh1dHhvcy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgXHRcdHRoaXMuZGlzYWJsZUJhbGFuY2VOb3RpZmljYXRpb25zID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlW2FkZHJlc3NdID0gdXR4b3M7XG5cdFx0XHRcdHRoaXMudXR4b1NldC5hZGQodXR4b3MsIGFkZHJlc3MpO1xuXHRcdFx0XHRhZGRyZXNzZXNXaXRoVVRYT3MucHVzaChhZGRyZXNzKTtcblx0XHRcdFx0dGhpcy5kaXNhYmxlQmFsYW5jZU5vdGlmaWNhdGlvbnMgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5lbWl0QmFsYW5jZSgpO1xuICAgICAgXHRcdH1cblx0XHR9KVxuXG5cdFx0Y29uc3QgaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIgPVxuXHRcdFx0dGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlW3RoaXMucmVjZWl2ZUFkZHJlc3NdICE9PSB1bmRlZmluZWQ7XG5cdFx0aWYgKGlzQWN0aXZpdHlPblJlY2VpdmVBZGRyKSB7XG5cdFx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLm5leHQoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdGFkZHJlc3Nlc1dpdGhVVFhPcyxcblx0XHRcdHR4SUQySW5mb1xuXHRcdH07XG5cdH1cblxuXHRbQkFMQU5DRV9DT05GSVJNRURdOm51bWJlciA9IDA7XG5cdFtCQUxBTkNFX1BFTkRJTkddOm51bWJlciA9IDA7XG5cdFtCQUxBTkNFX1RPVEFMXTpudW1iZXIgPSAwO1xuXHRhZGp1c3RCYWxhbmNlKGlzQ29uZmlybWVkOmJvb2xlYW4sIGFtb3VudDpudW1iZXIsIG5vdGlmeTpib29sZWFuPXRydWUpe1xuXHRcdGNvbnN0IHthdmFpbGFibGUsIHBlbmRpbmd9ID0gdGhpcy5iYWxhbmNlO1xuXHRcdGlmKGlzQ29uZmlybWVkKXtcblx0XHRcdHRoaXNbQkFMQU5DRV9DT05GSVJNRURdICs9IGFtb3VudDtcblx0XHR9ZWxzZXtcblx0XHRcdHRoaXNbQkFMQU5DRV9QRU5ESU5HXSArPSBhbW91bnQ7XG5cdFx0fVxuXG5cdFx0dGhpc1tCQUxBTkNFX1RPVEFMXSA9IHRoaXNbQkFMQU5DRV9DT05GSVJNRURdICsgdGhpc1tCQUxBTkNFX1BFTkRJTkddO1xuXG5cdFx0aWYobm90aWZ5PT09ZmFsc2UpXG5cdFx0XHRyZXR1cm5cblx0XHRjb25zdCB7YXZhaWxhYmxlOl9hdmFpbGFibGUsIHBlbmRpbmc6X3BlbmRpbmd9ID0gdGhpcy5iYWxhbmNlO1xuXHRcdGlmKCF0aGlzLnN5bmNJblByb2dncmVzcyAmJiAhdGhpcy5kaXNhYmxlQmFsYW5jZU5vdGlmaWNhdGlvbnMgJiYgKGF2YWlsYWJsZSE9X2F2YWlsYWJsZSB8fCBwZW5kaW5nIT1fcGVuZGluZykpXG5cdFx0XHR0aGlzLmVtaXRCYWxhbmNlKCk7XG5cdH1cblxuXHQvKipcblx0ICogRW1pdCB3YWxsZXQgYmFsYW5jZS5cblx0ICovXG5cdGxhc3RCYWxhbmNlTm90aWZpY2F0aW9uOnthdmFpbGFibGU6bnVtYmVyLCBwZW5kaW5nOm51bWJlcn0gPSB7YXZhaWxhYmxlOjAsIHBlbmRpbmc6MH1cblx0ZW1pdEJhbGFuY2UoKTogdm9pZCB7XG5cdFx0Y29uc3Qge2F2YWlsYWJsZSwgcGVuZGluZywgdG90YWx9ID0gdGhpcy5iYWxhbmNlO1xuXHRcdGNvbnN0IHthdmFpbGFibGU6X2F2YWlsYWJsZSwgcGVuZGluZzpfcGVuZGluZ30gPSB0aGlzLmxhc3RCYWxhbmNlTm90aWZpY2F0aW9uO1xuXHRcdGlmKGF2YWlsYWJsZT09X2F2YWlsYWJsZSAmJiBwZW5kaW5nPT1fcGVuZGluZylcblx0XHRcdHJldHVyblxuXHRcdHRoaXMubGFzdEJhbGFuY2VOb3RpZmljYXRpb24gPSB7YXZhaWxhYmxlLCBwZW5kaW5nfTtcblx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhgYmFsYW5jZSBhdmFpbGFibGU6ICR7YXZhaWxhYmxlfSBwZW5kaW5nOiAke3BlbmRpbmd9YCk7XG5cdFx0dGhpcy5lbWl0KFwiYmFsYW5jZS11cGRhdGVcIiwge1xuXHRcdFx0YXZhaWxhYmxlLFxuXHRcdFx0cGVuZGluZyxcblx0XHRcdHRvdGFsLFxuXHRcdFx0Y29uZmlybWVkVXR4b3NDb3VudDogdGhpcy51dHhvU2V0LmNvbmZpcm1lZENvdW50XG5cdFx0fSk7XG5cdH1cblxuXHRkZWJ1Z0luZm86RGVidWdJbmZvID0ge2luVXNlVVRYT3M6e3NhdG9zaGlzOjAsIGNvdW50OjB9fTtcblx0dXBkYXRlRGVidWdJbmZvKCl7XG5cdFx0bGV0IGluVXNlVVRYT3MgPSB7c2F0b3NoaXM6MCwgY291bnQ6MH07XG5cdFx0bGV0IHtjb25maXJtZWQsIHBlbmRpbmcsIHVzZWR9ID0gdGhpcy51dHhvU2V0LnV0eG9zfHx7fTtcblx0XHR0aGlzLnV0eG9TZXQuaW5Vc2UubWFwKHV0eG9JZCA9PiB7XG5cdFx0XHRpblVzZVVUWE9zLnNhdG9zaGlzICs9IGNvbmZpcm1lZC5nZXQodXR4b0lkKT8uc2F0b3NoaXMgfHxcblx0XHRcdFx0cGVuZGluZy5nZXQodXR4b0lkKT8uc2F0b3NoaXMgfHxcblx0XHRcdFx0dXNlZC5nZXQodXR4b0lkKT8uc2F0b3NoaXMgfHwgMDtcblx0XHR9KTtcblx0XHRpblVzZVVUWE9zLmNvdW50ID0gdGhpcy51dHhvU2V0LmluVXNlLmxlbmd0aDtcblx0XHR0aGlzLmRlYnVnSW5mbyA9IHtpblVzZVVUWE9zfTtcblx0XHR0aGlzLmVtaXQoXCJkZWJ1Zy1pbmZvXCIsIHtkZWJ1Z0luZm86dGhpcy5kZWJ1Z0luZm99KTtcblx0fVxuXG5cdGNsZWFyVXNlZFVUWE9zKCl7XG5cdFx0dGhpcy51dHhvU2V0LmNsZWFyVXNlZCgpO1xuXHR9XG5cblx0ZW1pdENhY2hlKCl7XG5cdFx0bGV0IHtjYWNoZX0gPSB0aGlzO1xuXHRcdHRoaXMuZW1pdChcInN0YXRlLXVwZGF0ZVwiLCB7Y2FjaGV9KTtcblx0fVxuXG5cdGxhc3RBZGRyZXNzTm90aWZpY2F0aW9uOntyZWNlaXZlPzpzdHJpbmcsIGNoYW5nZT86c3RyaW5nfSA9IHt9O1xuXHRlbWl0QWRkcmVzcygpe1xuXHRcdGNvbnN0IHJlY2VpdmUgPSB0aGlzLnJlY2VpdmVBZGRyZXNzO1xuXHRcdGNvbnN0IGNoYW5nZSA9IHRoaXMuY2hhbmdlQWRkcmVzcztcblx0XHRsZXQge3JlY2VpdmU6X3JlY2VpdmUsIGNoYW5nZTpfY2hhbmdlfT0gdGhpcy5sYXN0QWRkcmVzc05vdGlmaWNhdGlvblxuXHRcdGlmKHJlY2VpdmUgPT0gX3JlY2VpdmUgJiYgY2hhbmdlID09IF9jaGFuZ2UpXG5cdFx0XHRyZXR1cm5cblx0XHR0aGlzLmxhc3RBZGRyZXNzTm90aWZpY2F0aW9uID0ge3JlY2VpdmUsIGNoYW5nZX07XG5cdFx0dGhpcy5lbWl0KFwibmV3LWFkZHJlc3NcIiwge1xuXHRcdFx0cmVjZWl2ZSwgY2hhbmdlXG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgc2VsZWN0ZWQgbmV0d29ya1xuXHQgKiBAcGFyYW0gbmV0d29yayBuYW1lIG9mIHRoZSBuZXR3b3JrXG5cdCAqL1xuXHRhc3luYyB1cGRhdGVOZXR3b3JrKG5ldHdvcms6IFNlbGVjdGVkTmV0d29yayk6IFByb21pc2UgPCB2b2lkID4ge1xuXHRcdHRoaXMuZGVtb2xpc2hXYWxsZXRTdGF0ZShuZXR3b3JrLnByZWZpeCk7XG5cdFx0dGhpcy5uZXR3b3JrID0gbmV0d29yay5wcmVmaXg7XG5cdFx0dGhpcy5hcGlFbmRwb2ludCA9IG5ldHdvcmsuYXBpQmFzZVVybDtcblx0fVxuXG5cdGRlbW9saXNoV2FsbGV0U3RhdGUobmV0d29ya1ByZWZpeDogTmV0d29yayA9IHRoaXMubmV0d29yayk6IHZvaWQge1xuXHRcdHRoaXMudXR4b1NldC5jbGVhcigpO1xuXHRcdHRoaXMuYWRkcmVzc01hbmFnZXIgPSBuZXcgQWRkcmVzc01hbmFnZXIodGhpcy5IRFdhbGxldCwgbmV0d29ya1ByZWZpeCk7XG5cdFx0Ly90aGlzLnBlbmRpbmdJbmZvLnRyYW5zYWN0aW9ucyA9IHt9O1xuXHRcdHRoaXMudHJhbnNhY3Rpb25zID0ge307XG5cdFx0dGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlID0ge307XG5cdH1cblxuXHRhc3luYyBzY2FuTW9yZUFkZHJlc3Nlcyhjb3VudD0xMDAsIGRlYnVnPWZhbHNlLCByZWNlaXZlU3RhcnQ9LTEsIGNoYW5nZVN0YXJ0PS0xKTogUHJvbWlzZTxTY2FuZU1vcmVSZXN1bHQ+e1xuXHRcdGlmICh0aGlzLnN5bmNJblByb2dncmVzcylcblx0XHRcdHJldHVybiB7ZXJyb3I6IFwiU3luYyBpbiBwcm9ncmVzc1wiLCBjb2RlOlwiU1lOQy1JTi1QUk9HUkVTU1wifTtcblxuXHRcdGlmKHJlY2VpdmVTdGFydCA8IDApXG5cdFx0XHRyZWNlaXZlU3RhcnQgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXJcblxuXHRcdGlmKGNoYW5nZVN0YXJ0IDwgMClcblx0XHRcdGNoYW5nZVN0YXJ0ID0gdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmNvdW50ZXJcblxuXHRcdHRoaXMuc3luY0luUHJvZ2dyZXNzID0gdHJ1ZTtcblx0XHR0aGlzLmVtaXQoXCJzY2FuLW1vcmUtYWRkcmVzc2VzLXN0YXJ0ZWRcIiwge3JlY2VpdmVTdGFydCwgY2hhbmdlU3RhcnR9KVxuXHRcdGxldCBlcnJvciA9IGZhbHNlO1xuXHRcdGxldCByZXMgPSBhd2FpdCB0aGlzLmFkZHJlc3NEaXNjb3ZlcnkodGhpcy5vcHRpb25zLmFkZHJlc3NEaXNjb3ZlcnlFeHRlbnQsIGRlYnVnLCByZWNlaXZlU3RhcnQsIGNoYW5nZVN0YXJ0LCBjb3VudClcblx0XHQuY2F0Y2goZT0+e1xuXHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhcImFkZHJlc3NEaXNjb3Zlcnk6ZXJyb3JcIiwgZSlcblx0XHRcdGVycm9yID0gZTtcblx0XHR9KVxuXG5cdFx0dGhpcy5zeW5jSW5Qcm9nZ3Jlc3MgPSBmYWxzZTtcblx0XHRpZighdGhpcy5zeW5jT25jZSlcblx0XHRcdHRoaXMudXR4b1NldC51dHhvU3Vic2NyaWJlKCk7XG5cdFx0dGhpcy5lbWl0KFwic2Nhbi1tb3JlLWFkZHJlc3Nlcy1lbmRlZFwiLCB7ZXJyb3J9KVxuXG5cdFx0aWYoZXJyb3IpXG5cdFx0XHRyZXR1cm4ge2Vycm9yLCBjb2RlOlwiQUREUkVTUy1ESVNDT1ZFUllcIn07XG5cblx0XHRsZXQge2hpZ2hlc3RJbmRleD1udWxsLCBlbmRQb2ludHM9bnVsbH0gPSByZXN8fHt9O1xuXHRcdHRoaXMubG9nZ2VyLmluZm8oXCJzY2FuTW9yZUFkZHJlc3NlczpoaWdoZXN0SW5kZXhcIiwgaGlnaGVzdEluZGV4KVxuXHRcdHRoaXMubG9nZ2VyLmluZm8oXCJzY2FuTW9yZUFkZHJlc3NlczplbmRQb2ludHNcIiwgZW5kUG9pbnRzKVxuXG5cdFx0dGhpcy5lbWl0KFwic2Nhbi1tb3JlLWFkZHJlc3Nlcy1lbmRlZFwiLCB7XG5cdFx0XHRyZWNlaXZlRmluYWw6dGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jb3VudGVyLTEsXG5cdFx0XHRjaGFuZ2VGaW5hbDp0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuY291bnRlci0xXG5cdFx0fSlcblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb2RlOlwiU1VDQ0VTU1wiLFxuXHRcdFx0cmVjZWl2ZTp7XG5cdFx0XHRcdHN0YXJ0OnJlY2VpdmVTdGFydCxcblx0XHRcdFx0ZW5kOiBlbmRQb2ludHM/LnJlY2VpdmV8fHJlY2VpdmVTdGFydCtjb3VudCxcblx0XHRcdFx0ZmluYWw6dGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jb3VudGVyLTFcblx0XHRcdH0sXG5cdFx0XHRjaGFuZ2U6e1xuXHRcdFx0XHRzdGFydDpjaGFuZ2VTdGFydCxcblx0XHRcdFx0ZW5kOiBlbmRQb2ludHM/LmNoYW5nZXx8Y2hhbmdlU3RhcnQrY291bnQsXG5cdFx0XHRcdGZpbmFsOnRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jb3VudGVyLTFcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIERlcml2ZXMgcmVjZWl2ZUFkZHJlc3NlcyBhbmQgY2hhbmdlQWRkcmVzc2VzIGFuZCBjaGVja3MgdGhlaXIgdHJhbnNhY3Rpb25zIGFuZCBVVFhPcy5cblx0ICogQHBhcmFtIHRocmVzaG9sZCBzdG9wIGRpc2NvdmVyaW5nIGFmdGVyIGB0aHJlc2hvbGRgIGFkZHJlc3NlcyB3aXRoIG5vIGFjdGl2aXR5XG5cdCAqL1xuXHRhc3luYyBhZGRyZXNzRGlzY292ZXJ5KHRocmVzaG9sZCA9IDY0LCBkZWJ1ZyA9IGZhbHNlLCByZWNlaXZlU3RhcnQ9MCwgY2hhbmdlU3RhcnQ9MCwgY291bnQ9MCk6IFByb21pc2UgPHtcblx0XHRkZWJ1Z0luZm86IE1hcCA8c3RyaW5nLCB7dXR4b3M6IEFwaS5VdHhvW10sIGFkZHJlc3M6IHN0cmluZ30+fG51bGw7XG5cdFx0aGlnaGVzdEluZGV4OntyZWNlaXZlOm51bWJlciwgY2hhbmdlOm51bWJlcn0sXG5cdFx0ZW5kUG9pbnRzOntyZWNlaXZlOm51bWJlciwgY2hhbmdlOm51bWJlcn1cblx0fT4ge1xuXHRcdGxldCBhZGRyZXNzTGlzdDogc3RyaW5nW10gPSBbXTtcblx0XHRsZXQgZGVidWdJbmZvOiBNYXAgPCBzdHJpbmcsIHt1dHhvczogQXBpLlV0eG9bXSwgYWRkcmVzczogc3RyaW5nfSA+IHwgbnVsbCA9IG51bGw7XG5cblx0XHR0aGlzLmxvZ2dlci5pbmZvKGBzeW5jIC4uLiBydW5uaW5nIGFkZHJlc3MgZGlzY292ZXJ5LCB0aHJlc2hvbGQ6JHt0aHJlc2hvbGR9YCk7XG5cdFx0Y29uc3QgY2FjaGVJbmRleGVzID0gdGhpcy5jYWNoZVN0b3JlLmdldEFkZHJlc3NJbmRleGVzKCk/P3tyZWNlaXZlOjAsIGNoYW5nZTowfVxuXHRcdHRoaXMubG9nZ2VyLmluZm8oYHN5bmMgLi4uY2FjaGVJbmRleGVzOiByZWNlaXZlOiR7Y2FjaGVJbmRleGVzLnJlY2VpdmV9LCBjaGFuZ2U6JHtjYWNoZUluZGV4ZXMuY2hhbmdlfWApO1xuXHRcdGxldCBoaWdoZXN0SW5kZXggPSB7XG5cdFx0XHRyZWNlaXZlOnRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY291bnRlci0xLFxuXHRcdFx0Y2hhbmdlOnRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jb3VudGVyLTFcblx0XHR9XG5cdFx0bGV0IGVuZFBvaW50cyA9IHtcblx0XHRcdHJlY2VpdmU6MCxcblx0XHRcdGNoYW5nZTowXG5cdFx0fVxuXHRcdGxldCBtYXhPZmZzZXQgPSB7XG5cdFx0XHRyZWNlaXZlOiByZWNlaXZlU3RhcnQgKyBjb3VudCxcblx0XHRcdGNoYW5nZTogY2hhbmdlU3RhcnQgKyBjb3VudFxuXHRcdH1cblxuXHRcdGNvbnN0IGRvRGlzY292ZXJ5ID0gYXN5bmMoXG5cdFx0XHRuOm51bWJlciwgZGVyaXZlVHlwZToncmVjZWl2ZSd8J2NoYW5nZScsIG9mZnNldDpudW1iZXJcblx0XHQpOiBQcm9taXNlIDxudW1iZXI+ID0+IHtcblxuXHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhgc3luYyAuLi4gc2Nhbm5pbmcgJHtvZmZzZXR9IC0gJHtvZmZzZXQrbn0gJHtkZXJpdmVUeXBlfSBhZGRyZXNzZXNgKTtcblx0XHRcdHRoaXMuZW1pdChcInN5bmMtcHJvZ3Jlc3NcIiwge1xuXHRcdFx0XHRzdGFydDpvZmZzZXQsXG5cdFx0XHRcdGVuZDpvZmZzZXQrbixcblx0XHRcdFx0YWRkcmVzc1R5cGU6ZGVyaXZlVHlwZVxuXHRcdFx0fSlcblx0XHRcdGNvbnN0IGRlcml2ZWRBZGRyZXNzZXMgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLmdldEFkZHJlc3NlcyhuLCBkZXJpdmVUeXBlLCBvZmZzZXQpO1xuXHRcdFx0Y29uc3QgYWRkcmVzc2VzID0gZGVyaXZlZEFkZHJlc3Nlcy5tYXAoKG9iaikgPT4gb2JqLmFkZHJlc3MpO1xuXHRcdFx0YWRkcmVzc0xpc3QgPSBbLi4uYWRkcmVzc0xpc3QsIC4uLmFkZHJlc3Nlc107XG5cdFx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKFxuXHRcdFx0XHRgJHtkZXJpdmVUeXBlfTogYWRkcmVzcyBkYXRhIGZvciBkZXJpdmVkIGluZGljZXMgJHtkZXJpdmVkQWRkcmVzc2VzWzBdLmluZGV4fS4uJHtkZXJpdmVkQWRkcmVzc2VzW2Rlcml2ZWRBZGRyZXNzZXMubGVuZ3RoLTFdLmluZGV4fWBcblx0XHRcdCk7XG5cdFx0XHQvLyBpZiAodGhpcy5sb2dnZXJMZXZlbCA+IDApXG5cdFx0XHQvLyBcdHRoaXMubG9nZ2VyLnZlcmJvc2UoXCJhZGRyZXNzRGlzY292ZXJ5OiBmaW5kVXR4b3MgZm9yIGFkZHJlc3Nlczo6XCIsIGFkZHJlc3Nlcylcblx0XHRcdGNvbnN0IHthZGRyZXNzZXNXaXRoVVRYT3MsIHR4SUQySW5mb30gPSBhd2FpdCB0aGlzLmZpbmRVdHhvcyhhZGRyZXNzZXMsIGRlYnVnKTtcblx0XHRcdGlmICghZGVidWdJbmZvKVxuXHRcdFx0XHRkZWJ1Z0luZm8gPSB0eElEMkluZm87XG5cdFx0XHRpZiAoYWRkcmVzc2VzV2l0aFVUWE9zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHQvLyBhZGRyZXNzIGRpc2NvdmVyeSBjb21wbGV0ZVxuXHRcdFx0XHRjb25zdCBsYXN0QWRkcmVzc0luZGV4V2l0aFR4ID0gaGlnaGVzdEluZGV4W2Rlcml2ZVR5cGVdOy8vb2Zmc2V0IC0gKHRocmVzaG9sZCAtIG4pIC0gMTtcblx0XHRcdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgJHtkZXJpdmVUeXBlfTogYWRkcmVzcyBkaXNjb3ZlcnkgY29tcGxldGVgKTtcblx0XHRcdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgJHtkZXJpdmVUeXBlfTogbGFzdCBhY3Rpdml0eSBvbiBhZGRyZXNzICMke2xhc3RBZGRyZXNzSW5kZXhXaXRoVHh9YCk7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLnZlcmJvc2UoYCR7ZGVyaXZlVHlwZX06IG5vIGFjdGl2aXR5IGZyb20gJHtvZmZzZXR9Li4ke29mZnNldCArIG59YCk7XG5cdFx0XHRcdGlmKG9mZnNldCA+PSBtYXhPZmZzZXRbZGVyaXZlVHlwZV0gJiYgb2Zmc2V0ID49IGNhY2hlSW5kZXhlc1tkZXJpdmVUeXBlXSl7XG5cdFx0XHRcdFx0ZW5kUG9pbnRzW2Rlcml2ZVR5cGVdID0gb2Zmc2V0K247XG5cdFx0XHRcdFx0cmV0dXJuIGxhc3RBZGRyZXNzSW5kZXhXaXRoVHg7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIGVsc2Uga2VlcCBkb2luZyBkaXNjb3Zlcnlcblx0XHRcdGNvbnN0IGluZGV4ID1cblx0XHRcdFx0ZGVyaXZlZEFkZHJlc3Nlc1xuXHRcdFx0XHQuZmlsdGVyKChvYmopID0+IGFkZHJlc3Nlc1dpdGhVVFhPcy5pbmNsdWRlcyhvYmouYWRkcmVzcykpXG5cdFx0XHRcdC5yZWR1Y2UoKHByZXYsIGN1cikgPT4gTWF0aC5tYXgocHJldiwgY3VyLmluZGV4KSwgaGlnaGVzdEluZGV4W2Rlcml2ZVR5cGVdKTtcblx0XHRcdGhpZ2hlc3RJbmRleFtkZXJpdmVUeXBlXSA9IGluZGV4O1xuXHRcdFx0cmV0dXJuIGRvRGlzY292ZXJ5KG4sIGRlcml2ZVR5cGUsIG9mZnNldCArIG4pO1xuXHRcdH07XG5cdFx0Y29uc3QgaGlnaGVzdFJlY2VpdmVJbmRleCA9IGF3YWl0IGRvRGlzY292ZXJ5KHRocmVzaG9sZCwgJ3JlY2VpdmUnLCByZWNlaXZlU3RhcnQpO1xuXHRcdGNvbnN0IGhpZ2hlc3RDaGFuZ2VJbmRleCA9IGF3YWl0IGRvRGlzY292ZXJ5KHRocmVzaG9sZCwgJ2NoYW5nZScsIGNoYW5nZVN0YXJ0KTtcblx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmFkdmFuY2UoaGlnaGVzdFJlY2VpdmVJbmRleCArIDEpO1xuXHRcdHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5hZHZhbmNlKGhpZ2hlc3RDaGFuZ2VJbmRleCArIDEpO1xuXHRcdHRoaXMubG9nZ2VyLnZlcmJvc2UoXG5cdFx0XHRgcmVjZWl2ZSBhZGRyZXNzIGluZGV4OiAke2hpZ2hlc3RSZWNlaXZlSW5kZXh9OyBjaGFuZ2UgYWRkcmVzcyBpbmRleDogJHtoaWdoZXN0Q2hhbmdlSW5kZXh9YCxcblx0XHRcdGByZWNlaXZlLWFkZHJlc3MtaW5kZXg6ICR7dGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jb3VudGVyfTsgY2hhbmdlIGFkZHJlc3MgaW5kZXg6ICR7dGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmNvdW50ZXJ9YFxuXHRcdCk7XG5cblx0XHRpZighdGhpcy5zeW5jT25jZSAmJiAhdGhpcy5zeW5jSW5Qcm9nZ3Jlc3MpXG5cdFx0XHRhd2FpdCB0aGlzLnV0eG9TZXQudXR4b1N1YnNjcmliZSgpO1xuXG5cdFx0dGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG5cdFx0bGV0IGFkZHJlc3NJbmRleGVzID0ge1xuXHRcdFx0cmVjZWl2ZTpNYXRoLm1heChjYWNoZUluZGV4ZXMucmVjZWl2ZSwgdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jb3VudGVyKSxcblx0XHRcdGNoYW5nZTpNYXRoLm1heChjYWNoZUluZGV4ZXMuY2hhbmdlLCB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuY291bnRlcilcblx0XHR9XG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhgc3luYyAuLi5uZXcgY2FjaGU6IHJlY2VpdmU6JHthZGRyZXNzSW5kZXhlcy5yZWNlaXZlfSwgY2hhbmdlOiR7YWRkcmVzc0luZGV4ZXMuY2hhbmdlfWApO1xuXHRcdHRoaXMuY2FjaGVTdG9yZS5zZXRBZGRyZXNzSW5kZXhlcyhhZGRyZXNzSW5kZXhlcylcblx0XHR0aGlzLmVtaXQoXCJzeW5jLWVuZFwiLCBhZGRyZXNzSW5kZXhlcylcblx0XHRyZXR1cm4ge2hpZ2hlc3RJbmRleCwgZW5kUG9pbnRzLCBkZWJ1Z0luZm99O1xuXHR9XG5cblx0Ly8gVE9ETzogY29udmVydCBhbW91bnQgdG8gc29tcGlzIGFrYSBzYXRvc2hpc1xuXHQvLyBUT0RPOiBiblxuXHQvKipcblx0ICogQ29tcG9zZSBhIHNlcmlhbGl6ZWQsIHNpZ25lZCB0cmFuc2FjdGlvblxuXHQgKiBAcGFyYW0gb2JqXG5cdCAqIEBwYXJhbSBvYmoudG9BZGRyIFRvIGFkZHJlc3MgaW4gY2FzaGFkZHIgZm9ybWF0IChlLmcuIGthc3BhdGVzdDpxcTBkNmgwcHJqbTVtcGRsZDVwbmNzdDNhZHUweWFtNnhjaDR0cjY5azIpXG5cdCAqIEBwYXJhbSBvYmouYW1vdW50IEFtb3VudCB0byBzZW5kIGluIHNvbXBpcyAoMTAwMDAwMDAwICgxZTgpIHNvbXBpcyBpbiAxIEtBUylcblx0ICogQHBhcmFtIG9iai5mZWUgRmVlIGZvciBtaW5lcnMgaW4gc29tcGlzXG5cdCAqIEBwYXJhbSBvYmouY2hhbmdlQWRkck92ZXJyaWRlIFVzZSB0aGlzIHRvIG92ZXJyaWRlIGF1dG9tYXRpYyBjaGFuZ2UgYWRkcmVzcyBkZXJpdmF0aW9uXG5cdCAqIEB0aHJvd3MgaWYgYW1vdW50IGlzIGFib3ZlIGBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUmBcblx0ICovXG5cdGNvbXBvc2VUeCh7XG5cdFx0dG9BZGRyLFxuXHRcdGFtb3VudCxcblx0XHRmZWUgPSBERUZBVUxUX0ZFRSxcblx0XHRjaGFuZ2VBZGRyT3ZlcnJpZGUsXG5cdFx0c2tpcFNpZ24gPSBmYWxzZSxcblx0XHRwcml2S2V5c0luZm8gPSBmYWxzZSxcblx0XHRjb21wb3VuZGluZ1VUWE8gPSBmYWxzZSxcblx0XHRjb21wb3VuZGluZ1VUWE9NYXhDb3VudCA9IENPTVBPVU5EX1VUWE9fTUFYX0NPVU5UXG5cdH06IFR4U2VuZCk6IENvbXBvc2VUeEluZm8ge1xuXHRcdC8vIFRPRE86IGJuIVxuXHRcdGFtb3VudCA9IHBhcnNlSW50KGFtb3VudCBhcyBhbnkpO1xuXHRcdGZlZSA9IHBhcnNlSW50KGZlZSBhcyBhbnkpO1xuXHRcdC8vIGlmICh0aGlzLmxvZ2dlckxldmVsID4gMCkge1xuXHRcdC8vIFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMDA7IGkrKylcblx0XHQvLyBcdFx0Y29uc29sZS5sb2coJ1dhbGxldCB0cmFuc2FjdGlvbiByZXF1ZXN0IGZvcicsIGFtb3VudCwgdHlwZW9mIGFtb3VudCk7XG5cdFx0Ly8gfVxuXHRcdC8vaWYgKCFOdW1iZXIuaXNTYWZlSW50ZWdlcihhbW91bnQpKSB0aHJvdyBuZXcgRXJyb3IoYEFtb3VudCAke2Ftb3VudH0gaXMgdG9vIGxhcmdlYCk7XG5cdFx0bGV0IHV0eG9zLCB1dHhvSWRzLCBtYXNzO1xuXHRcdGlmKGNvbXBvdW5kaW5nVVRYTyl7XG5cdFx0XHQoe3V0eG9zLCB1dHhvSWRzLCBhbW91bnQsIG1hc3N9ID0gdGhpcy51dHhvU2V0LmNvbGxlY3RVdHhvcyhjb21wb3VuZGluZ1VUWE9NYXhDb3VudCkpO1xuXHRcdH1lbHNle1xuXHRcdFx0KHt1dHhvcywgdXR4b0lkcywgbWFzc30gPSB0aGlzLnV0eG9TZXQuc2VsZWN0VXR4b3MoYW1vdW50ICsgZmVlKSk7XG5cdFx0fVxuXHRcdC8vaWYobWFzcyA+IFdhbGxldC5NYXhNYXNzVVRYT3Mpe1xuXHRcdC8vXHR0aHJvdyBuZXcgRXJyb3IoYE1heGltdW0gbnVtYmVyIG9mIGlucHV0cyAoVVRYT3MpIHJlYWNoZWQuIFBsZWFzZSByZWR1Y2UgdGhpcyB0cmFuc2FjdGlvbiBhbW91bnQuYCk7XG5cdFx0Ly99XG5cdFx0Y29uc3QgcHJpdktleXMgPSB1dHhvcy5yZWR1Y2UoKHByZXY6IHN0cmluZ1tdLCBjdXI6VW5zcGVudE91dHB1dCkgPT4ge1xuXHRcdFx0cmV0dXJuIFt0aGlzLmFkZHJlc3NNYW5hZ2VyLmFsbFtTdHJpbmcoY3VyLmFkZHJlc3MpXSwgLi4ucHJldl0gYXMgc3RyaW5nW107XG5cdFx0fSwgW10pO1xuXG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhcInV0eG9zLmxlbmd0aFwiLCB1dHhvcy5sZW5ndGgpXG5cblx0XHRjb25zdCBjaGFuZ2VBZGRyID0gY2hhbmdlQWRkck92ZXJyaWRlIHx8IHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5uZXh0KCk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHR4OiBrYXNwYWNvcmUuVHJhbnNhY3Rpb24gPSBuZXcga2FzcGFjb3JlLlRyYW5zYWN0aW9uKClcblx0XHRcdFx0LmZyb20odXR4b3MpXG5cdFx0XHRcdC50byh0b0FkZHIsIGFtb3VudClcblx0XHRcdFx0LnNldFZlcnNpb24oMClcblx0XHRcdFx0LmZlZShmZWUpXG5cdFx0XHRcdC5jaGFuZ2UoY2hhbmdlQWRkcilcblx0XHRcdGlmKCFza2lwU2lnbilcblx0XHRcdFx0dHguc2lnbihwcml2S2V5cywga2FzcGFjb3JlLmNyeXB0by5TaWduYXR1cmUuU0lHSEFTSF9BTEwsICdzY2hub3JyJyk7XG5cblx0XHRcdC8vd2luZG93LnR4eHh4ID0gdHg7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eDogdHgsXG5cdFx0XHRcdGlkOiB0eC5pZCxcblx0XHRcdFx0cmF3VHg6IHR4LnRvU3RyaW5nKCksXG5cdFx0XHRcdHV0eG9JZHMsXG5cdFx0XHRcdGFtb3VudCxcblx0XHRcdFx0ZmVlLFxuXHRcdFx0XHR1dHhvcyxcblx0XHRcdFx0dG9BZGRyLFxuXHRcdFx0XHRwcml2S2V5czogcHJpdktleXNJbmZvP3ByaXZLZXlzOltdXG5cdFx0XHR9O1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUubG9nKFwiY29tcG9zZVR4OmVycm9yXCIsIGUpXG5cdFx0XHQvLyAhISEgRklYTUVcblx0XHRcdGlmKCFjaGFuZ2VBZGRyT3ZlcnJpZGUpXG5cdFx0XHRcdHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5yZXZlcnNlKCk7XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblx0fVxuXG5cdG1pbmltdW1SZXF1aXJlZFRyYW5zYWN0aW9uUmVsYXlGZWUobWFzczpudW1iZXIpOm51bWJlcntcblx0XHRsZXQgbWluaW11bUZlZSA9IChtYXNzICogdGhpcy5vcHRpb25zLm1pbmltdW1SZWxheVRyYW5zYWN0aW9uRmVlKSAvIDEwMDBcblxuXHRcdGlmIChtaW5pbXVtRmVlID09IDAgJiYgdGhpcy5vcHRpb25zLm1pbmltdW1SZWxheVRyYW5zYWN0aW9uRmVlID4gMCkge1xuXHRcdFx0bWluaW11bUZlZSA9IHRoaXMub3B0aW9ucy5taW5pbXVtUmVsYXlUcmFuc2FjdGlvbkZlZVxuXHRcdH1cblxuXHRcdC8vIFNldCB0aGUgbWluaW11bSBmZWUgdG8gdGhlIG1heGltdW0gcG9zc2libGUgdmFsdWUgaWYgdGhlIGNhbGN1bGF0ZWRcblx0XHQvLyBmZWUgaXMgbm90IGluIHRoZSB2YWxpZCByYW5nZSBmb3IgbW9uZXRhcnkgYW1vdW50cy5cblx0XHRpZiAobWluaW11bUZlZSA+IE1heFNvbXBpKSB7XG5cdFx0XHRtaW5pbXVtRmVlID0gTWF4U29tcGlcblx0XHR9XG5cblx0XHRyZXR1cm4gbWluaW11bUZlZVxuXHR9XG5cblx0Lypcblx0dmFsaWRhdGVBZGRyZXNzKGFkZHI6c3RyaW5nKTpib29sZWFue1xuXHRcdGxldCBhZGRyZXNzID0gbmV3IGthc3BhY29yZS5BZGRyZXNzKGFkZHIpO1xuXHRcdHJldHVybiBhZGRyZXNzLnR5cGUgPT0gXCJwdWJrZXlcIjtcblx0fVxuXHQqL1xuXG5cdC8qKlxuXHQgKiBFc3RpbWF0ZSB0cmFuc2FjdGlvbiBmZWUuIFJldHVybnMgdHJhbnNhY3Rpb24gZGF0YS5cblx0ICogQHBhcmFtIHR4UGFyYW1zXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FzcGF0ZXN0OnFxMGQ2aDBwcmptNW1wZGxkNXBuY3N0M2FkdTB5YW02eGNoNHRyNjlrMilcblx0ICogQHBhcmFtIHR4UGFyYW1zLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLQVMpXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy5mZWUgRmVlIGZvciBtaW5lcnMgaW4gc29tcGlzXG5cdCAqIEB0aHJvd3MgYEZldGNoRXJyb3JgIGlmIGVuZHBvaW50IGlzIGRvd24uIEFQSSBlcnJvciBtZXNzYWdlIGlmIHR4IGVycm9yLiBFcnJvciBpZiBhbW91bnQgaXMgdG9vIGxhcmdlIHRvIGJlIHJlcHJlc2VudGVkIGFzIGEgamF2YXNjcmlwdCBudW1iZXIuXG5cdCAqL1xuXHRhc3luYyBlc3RpbWF0ZVRyYW5zYWN0aW9uKHR4UGFyYW1zQXJnOiBUeFNlbmQpOiBQcm9taXNlIDwgVHhJbmZvID4ge1xuXHRcdGxldCBhZGRyZXNzID0gdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmN1cnJlbnQuYWRkcmVzcztcblx0XHRpZighYWRkcmVzcyl7XG5cdFx0XHRhZGRyZXNzID0gdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLm5leHQoKTtcblx0XHR9XG5cdFx0dHhQYXJhbXNBcmcuY2hhbmdlQWRkck92ZXJyaWRlID0gYWRkcmVzcztcblx0XHRyZXR1cm4gdGhpcy5jb21wb3NlVHhBbmROZXR3b3JrRmVlSW5mbyh0eFBhcmFtc0FyZyk7XG5cdH1cblx0YXN5bmMgY29tcG9zZVR4QW5kTmV0d29ya0ZlZUluZm8odHhQYXJhbXNBcmc6IFR4U2VuZCk6IFByb21pc2UgPCBUeEluZm8gPntcblx0XHRhd2FpdCB0aGlzLndhaXRPclN5bmMoKTtcblx0XHRpZighdHhQYXJhbXNBcmcuZmVlKVxuXHRcdFx0dHhQYXJhbXNBcmcuZmVlID0gMDtcblx0XHR0aGlzLmxvZ2dlci5pbmZvKGB0eCAuLi4gc2VuZGluZyB0byAke3R4UGFyYW1zQXJnLnRvQWRkcn1gKVxuXHRcdHRoaXMubG9nZ2VyLmluZm8oYHR4IC4uLiBhbW91bnQ6ICR7S0FTKHR4UGFyYW1zQXJnLmFtb3VudCl9IHVzZXIgZmVlOiAke0tBUyh0eFBhcmFtc0FyZy5mZWUpfSBtYXggZGF0YSBmZWU6ICR7S0FTKHR4UGFyYW1zQXJnLm5ldHdvcmtGZWVNYXh8fDApfWApXG5cblx0XHQvL2lmKCF0aGlzLnZhbGlkYXRlQWRkcmVzcyh0eFBhcmFtc0FyZy50b0FkZHIpKXtcblx0XHQvL1x0dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBhZGRyZXNzXCIpXG5cdFx0Ly99XG5cblx0XHRsZXQgdHhQYXJhbXMgOiBUeFNlbmQgPSB7IC4uLnR4UGFyYW1zQXJnIH0gYXMgVHhTZW5kO1xuXHRcdGNvbnN0IG5ldHdvcmtGZWVNYXggPSB0eFBhcmFtcy5uZXR3b3JrRmVlTWF4IHx8IDA7XG5cdFx0bGV0IGNhbGN1bGF0ZU5ldHdvcmtGZWUgPSAhIXR4UGFyYW1zLmNhbGN1bGF0ZU5ldHdvcmtGZWU7XG5cdFx0bGV0IGluY2x1c2l2ZUZlZSA9ICEhdHhQYXJhbXMuaW5jbHVzaXZlRmVlO1xuXHRcdGNvbnN0IHtza2lwU2lnbj10cnVlLCBwcml2S2V5c0luZm89ZmFsc2V9ID0gdHhQYXJhbXM7XG5cdFx0dHhQYXJhbXMuc2tpcFNpZ24gPSBza2lwU2lnbjtcblx0XHR0eFBhcmFtcy5wcml2S2V5c0luZm8gPSBwcml2S2V5c0luZm87XG5cblx0XHQvL2NvbnNvbGUubG9nKFwiY2FsY3VsYXRlTmV0d29ya0ZlZTpcIiwgY2FsY3VsYXRlTmV0d29ya0ZlZSwgXCJpbmNsdXNpdmVGZWU6XCIsIGluY2x1c2l2ZUZlZSlcblxuXHRcdGxldCBkYXRhID0gdGhpcy5jb21wb3NlVHgodHhQYXJhbXMpO1xuXHRcdFxuXHRcdGxldCB7dHhTaXplLCBtYXNzfSA9IGRhdGEudHguZ2V0TWFzc0FuZFNpemUoKTtcblx0XHRsZXQgZGF0YUZlZSA9IHRoaXMubWluaW11bVJlcXVpcmVkVHJhbnNhY3Rpb25SZWxheUZlZShtYXNzKTtcblx0XHRjb25zdCBwcmlvcml0eUZlZSA9IHR4UGFyYW1zQXJnLmZlZTtcblxuXHRcdGlmKHR4UGFyYW1zQXJnLmNvbXBvdW5kaW5nVVRYTyl7XG5cdFx0XHRpbmNsdXNpdmVGZWUgPSB0cnVlO1xuXHRcdFx0Y2FsY3VsYXRlTmV0d29ya0ZlZSA9IHRydWU7XG5cdFx0XHR0eFBhcmFtc0FyZy5hbW91bnQgPSBkYXRhLmFtb3VudDtcblx0XHRcdHR4UGFyYW1zLmFtb3VudCA9IGRhdGEuYW1vdW50O1xuXHRcdFx0dHhQYXJhbXMuY29tcG91bmRpbmdVVFhPID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdHhBbW91bnQgPSB0eFBhcmFtc0FyZy5hbW91bnQ7XG5cdFx0bGV0IGFtb3VudFJlcXVlc3RlZCA9IHR4UGFyYW1zQXJnLmFtb3VudCtwcmlvcml0eUZlZTtcblxuXHRcdGxldCBhbW91bnRBdmFpbGFibGUgPSBkYXRhLnV0eG9zLm1hcCh1dHhvPT51dHhvLnNhdG9zaGlzKS5yZWR1Y2UoKGEsYik9PmErYiwwKTtcblx0XHR0aGlzLmxvZ2dlci52ZXJib3NlKGB0eCAuLi4gbmVlZCBkYXRhIGZlZTogJHtLQVMoZGF0YUZlZSl9IHRvdGFsIG5lZWRlZDogJHtLQVMoYW1vdW50UmVxdWVzdGVkK2RhdGFGZWUpfWApXG5cdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgdHggLi4uIGF2YWlsYWJsZTogJHtLQVMoYW1vdW50QXZhaWxhYmxlKX0gaW4gJHtkYXRhLnV0eG9zLmxlbmd0aH0gVVRYT3NgKVxuXG5cdFx0aWYobmV0d29ya0ZlZU1heCAmJiBkYXRhRmVlID4gbmV0d29ya0ZlZU1heCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBGZWUgbWF4IGlzICR7bmV0d29ya0ZlZU1heH0gYnV0IHRoZSBtaW5pbXVtIGZlZSByZXF1aXJlZCBmb3IgdGhpcyB0cmFuc2FjdGlvbiBpcyAke0tBUyhkYXRhRmVlKX0gS0FTYCk7XG5cdFx0fVxuXG5cdFx0aWYoY2FsY3VsYXRlTmV0d29ya0ZlZSl7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdC8vY29uc29sZS5sb2coYGluc3VmZmljaWVudCBkYXRhIGZlZXMuLi4gaW5jcmVtZW50aW5nIGJ5ICR7ZGF0YUZlZX1gKTtcblx0XHRcdFx0dHhQYXJhbXMuZmVlID0gcHJpb3JpdHlGZWUrZGF0YUZlZTtcblx0XHRcdFx0aWYoaW5jbHVzaXZlRmVlKXtcblx0XHRcdFx0XHR0eFBhcmFtcy5hbW91bnQgPSB0eEFtb3VudC10eFBhcmFtcy5mZWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgdHggLi4uIGluc3VmZmljaWVudCBkYXRhIGZlZSBmb3IgdHJhbnNhY3Rpb24gc2l6ZSBvZiAke3R4U2l6ZX0gYnl0ZXNgKTtcblx0XHRcdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgdHggLi4uIG5lZWQgZGF0YSBmZWU6ICR7S0FTKGRhdGFGZWUpfSBmb3IgJHtkYXRhLnV0eG9zLmxlbmd0aH0gVVRYT3NgKTtcblx0XHRcdFx0dGhpcy5sb2dnZXIudmVyYm9zZShgdHggLi4uIHJlYnVpbGRpbmcgdHJhbnNhY3Rpb24gd2l0aCBhZGRpdGlvbmFsIGlucHV0c2ApO1xuXHRcdFx0XHRsZXQgdXR4b0xlbiA9IGRhdGEudXR4b3MubGVuZ3RoO1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhgZmluYWwgZmVlICR7dHhQYXJhbXMuZmVlfWApO1xuXHRcdFx0XHRkYXRhID0gdGhpcy5jb21wb3NlVHgodHhQYXJhbXMpO1xuXHRcdFx0XHQoe3R4U2l6ZSwgbWFzc30gPSBkYXRhLnR4LmdldE1hc3NBbmRTaXplKCkpO1xuXHRcdFx0XHRkYXRhRmVlID0gdGhpcy5taW5pbXVtUmVxdWlyZWRUcmFuc2FjdGlvblJlbGF5RmVlKG1hc3MpO1xuXHRcdFx0XHRpZihkYXRhLnV0eG9zLmxlbmd0aCAhPSB1dHhvTGVuKVxuXHRcdFx0XHRcdHRoaXMubG9nZ2VyLnZlcmJvc2UoYHR4IC4uLiBhZ2dyZWdhdGluZzogJHtkYXRhLnV0eG9zLmxlbmd0aH0gVVRYT3NgKTtcblxuXHRcdFx0fSB3aGlsZSgoIW5ldHdvcmtGZWVNYXggfHwgdHhQYXJhbXMuZmVlIDw9IG5ldHdvcmtGZWVNYXgpICYmIHR4UGFyYW1zLmZlZSA8IGRhdGFGZWUrcHJpb3JpdHlGZWUpO1xuXG5cdFx0XHRpZihuZXR3b3JrRmVlTWF4ICYmIHR4UGFyYW1zLmZlZSA+IG5ldHdvcmtGZWVNYXgpXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgTWF4aW11bSBuZXR3b3JrIGZlZSBleGNlZWRlZDsgbmVlZDogJHtLQVMoZGF0YUZlZSl9IEtBUyBtYXhpbXVtIGlzOiAke0tBUyhuZXR3b3JrRmVlTWF4KX0gS0FTYCk7XG5cblx0XHR9ZWxzZSBpZihkYXRhRmVlID4gcHJpb3JpdHlGZWUpe1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBNaW5pbXVtIGZlZSByZXF1aXJlZCBmb3IgdGhpcyB0cmFuc2FjdGlvbiBpcyAke0tBUyhkYXRhRmVlKX0gS0FTYCk7XG5cdFx0fWVsc2UgaWYoaW5jbHVzaXZlRmVlKXtcblx0XHRcdHR4UGFyYW1zLmFtb3VudCAtPSB0eFBhcmFtcy5mZWU7XG5cdFx0XHRkYXRhID0gdGhpcy5jb21wb3NlVHgodHhQYXJhbXMpO1xuXHRcdH1cblxuXHRcdGRhdGEuZGF0YUZlZSA9IGRhdGFGZWU7XG5cdFx0ZGF0YS50b3RhbEFtb3VudCA9IHR4UGFyYW1zLmZlZSt0eFBhcmFtcy5hbW91bnQ7XG5cdFx0ZGF0YS50eFNpemUgPSB0eFNpemU7XG5cdFx0ZGF0YS5ub3RlID0gdHhQYXJhbXNBcmcubm90ZXx8XCJcIjtcblxuXHRcdHJldHVybiBkYXRhIGFzIFR4SW5mb1xuXHR9XG5cblx0LyoqXG5cdCAqIEJ1aWxkIGEgdHJhbnNhY3Rpb24uIFJldHVybnMgdHJhbnNhY3Rpb24gaW5mby5cblx0ICogQHBhcmFtIHR4UGFyYW1zXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FzcGF0ZXN0OnFxMGQ2aDBwcmptNW1wZGxkNXBuY3N0M2FkdTB5YW02eGNoNHRyNjlrMilcblx0ICogQHBhcmFtIHR4UGFyYW1zLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLQVMpXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy5mZWUgRmVlIGZvciBtaW5lcnMgaW4gc29tcGlzXG5cdCAqIEB0aHJvd3MgYEZldGNoRXJyb3JgIGlmIGVuZHBvaW50IGlzIGRvd24uIEFQSSBlcnJvciBtZXNzYWdlIGlmIHR4IGVycm9yLiBFcnJvciBpZiBhbW91bnQgaXMgdG9vIGxhcmdlIHRvIGJlIHJlcHJlc2VudGVkIGFzIGEgamF2YXNjcmlwdCBudW1iZXIuXG5cdCAqL1xuXHRhc3luYyBidWlsZFRyYW5zYWN0aW9uKHR4UGFyYW1zQXJnOiBUeFNlbmQsIGRlYnVnID0gZmFsc2UpOiBQcm9taXNlIDwgQnVpbGRUeFJlc3VsdCA+IHtcblx0XHRjb25zdCB0czAgPSBEYXRlLm5vdygpO1xuXHRcdHR4UGFyYW1zQXJnLnNraXBTaWduID0gdHJ1ZTtcblx0XHR0eFBhcmFtc0FyZy5wcml2S2V5c0luZm8gPSB0cnVlO1xuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNvbXBvc2VUeEFuZE5ldHdvcmtGZWVJbmZvKHR4UGFyYW1zQXJnKTtcblx0XHRjb25zdCB7IFxuXHRcdFx0aWQsIHR4LCB1dHhvcywgdXR4b0lkcywgYW1vdW50LCB0b0FkZHIsXG5cdFx0XHRmZWUsIGRhdGFGZWUsIHRvdGFsQW1vdW50LCB0eFNpemUsIG5vdGUsIHByaXZLZXlzXG5cdFx0fSA9IGRhdGE7XG5cblx0XHRjb25zdCB0c18wID0gRGF0ZS5ub3coKTtcblx0XHR0eC5zaWduKHByaXZLZXlzLCBrYXNwYWNvcmUuY3J5cHRvLlNpZ25hdHVyZS5TSUdIQVNIX0FMTCwgJ3NjaG5vcnInKTtcblx0XHRjb25zdCB7bWFzczp0eE1hc3N9ID0gdHguZ2V0TWFzc0FuZFNpemUoKTtcblx0XHR0aGlzLmxvZ2dlci5pbmZvKFwidHhNYXNzXCIsIHR4TWFzcylcblx0XHRpZih0eE1hc3MgPiBXYWxsZXQuTWF4TWFzc0FjY2VwdGVkQnlCbG9jayl7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRyYW5zYWN0aW9uIHNpemUvbWFzcyBsaW1pdCByZWFjaGVkLiBQbGVhc2UgcmVkdWNlIHRoaXMgdHJhbnNhY3Rpb24gYW1vdW50LiAoTWFzczogJHt0eE1hc3N9KWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRzXzEgPSBEYXRlLm5vdygpO1xuXHRcdC8vY29uc3QgcmF3VHggPSB0eC50b1N0cmluZygpO1xuXHRcdGNvbnN0IHRzXzIgPSBEYXRlLm5vdygpO1xuXG5cblx0XHR0aGlzLmxvZ2dlci5pbmZvKGB0eCAuLi4gcmVxdWlyZWQgZGF0YSBmZWU6ICR7S0FTKGRhdGFGZWUpfSAoJHt1dHhvcy5sZW5ndGh9IFVUWE9zKWApOy8vICgke0tBUyh0eFBhcmFtc0FyZy5mZWUpfSske0tBUyhkYXRhRmVlKX0pYCk7XG5cdFx0Ly90aGlzLmxvZ2dlci52ZXJib3NlKGB0eCAuLi4gZmluYWwgZmVlOiAke0tBUyhkYXRhRmVlK3R4UGFyYW1zQXJnLmZlZSl9ICgke0tBUyh0eFBhcmFtc0FyZy5mZWUpfSske0tBUyhkYXRhRmVlKX0pYCk7XG5cdFx0dGhpcy5sb2dnZXIuaW5mbyhgdHggLi4uIHJlc3VsdGluZyB0b3RhbDogJHtLQVModG90YWxBbW91bnQpfWApO1xuXG5cblx0XHQvL2NvbnNvbGUubG9nKHV0eG9zKTtcblxuXHRcdGlmIChkZWJ1ZyB8fCB0aGlzLmxvZ2dlckxldmVsID4gMCkge1xuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoXCJzdWJtaXRUcmFuc2FjdGlvbjogZXN0aW1hdGVUeFwiLCBkYXRhKVxuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoXCJzZW5kVHg6dXR4b3NcIiwgdXR4b3MpXG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhcIjo6dXR4b3NbMF0uc2NyaXB0OjpcIiwgdXR4b3NbMF0uc2NyaXB0KVxuXHRcdFx0Ly9jb25zb2xlLmxvZyhcIjo6dXR4b3NbMF0uYWRkcmVzczo6XCIsIHV0eG9zWzBdLmFkZHJlc3MpXG5cdFx0fVxuXG5cdFx0Y29uc3Qge25Mb2NrVGltZTogbG9ja1RpbWUsIHZlcnNpb24gfSA9IHR4O1xuXG5cdFx0aWYgKGRlYnVnIHx8IHRoaXMubG9nZ2VyTGV2ZWwgPiAwKVxuXHRcdFx0dGhpcy5sb2dnZXIuZGVidWcoXCJjb21wb3NlVHg6dHhcIiwgXCJ0eFNpemU6XCIsIHR4U2l6ZSlcblxuXHRcdGNvbnN0IHRzXzMgPSBEYXRlLm5vdygpO1xuXHRcdGNvbnN0IGlucHV0czogUlBDLlRyYW5zYWN0aW9uSW5wdXRbXSA9IHR4LmlucHV0cy5tYXAoKGlucHV0OiBrYXNwYWNvcmUuVHJhbnNhY3Rpb24uSW5wdXQpID0+IHtcblx0XHRcdGlmIChkZWJ1ZyB8fCB0aGlzLmxvZ2dlckxldmVsID4gMCkge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhcImlucHV0LnNjcmlwdC5pbnNwZWN0XCIsIGlucHV0LnNjcmlwdC5pbnNwZWN0KCkpXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHByZXZpb3VzT3V0cG9pbnQ6IHtcblx0XHRcdFx0XHR0cmFuc2FjdGlvbklkOiBpbnB1dC5wcmV2VHhJZC50b1N0cmluZyhcImhleFwiKSxcblx0XHRcdFx0XHRpbmRleDogaW5wdXQub3V0cHV0SW5kZXhcblx0XHRcdFx0fSxcblx0XHRcdFx0c2lnbmF0dXJlU2NyaXB0OiBpbnB1dC5zY3JpcHQudG9CdWZmZXIoKS50b1N0cmluZyhcImhleFwiKSxcblx0XHRcdFx0c2VxdWVuY2U6IGlucHV0LnNlcXVlbmNlTnVtYmVyLFxuXHRcdFx0XHRzaWdPcENvdW50OjFcblx0XHRcdH07XG5cdFx0fSlcblx0XHRjb25zdCB0c180ID0gRGF0ZS5ub3coKTtcblx0XHRjb25zdCBvdXRwdXRzOiBSUEMuVHJhbnNhY3Rpb25PdXRwdXRbXSA9IHR4Lm91dHB1dHMubWFwKChvdXRwdXQ6IGthc3BhY29yZS5UcmFuc2FjdGlvbi5PdXRwdXQpID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGFtb3VudDogb3V0cHV0LnNhdG9zaGlzLFxuXHRcdFx0XHRzY3JpcHRQdWJsaWNLZXk6IHtcblx0XHRcdFx0XHRzY3JpcHRQdWJsaWNLZXk6IG91dHB1dC5zY3JpcHQudG9CdWZmZXIoKS50b1N0cmluZyhcImhleFwiKSxcblx0XHRcdFx0XHR2ZXJzaW9uOiAwXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KVxuXHRcdGNvbnN0IHRzXzUgPSBEYXRlLm5vdygpO1xuXG5cdFx0Ly9jb25zdCBwYXlsb2FkU3RyID0gXCIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwXCI7XG5cdFx0Ly9jb25zdCBwYXlsb2FkID0gQnVmZmVyLmZyb20ocGF5bG9hZFN0cikudG9TdHJpbmcoXCJiYXNlNjRcIik7XG5cdFx0Ly9jb25zb2xlLmxvZyhcInBheWxvYWQtaGV4OlwiLCBCdWZmZXIuZnJvbShwYXlsb2FkU3RyKS50b1N0cmluZyhcImhleFwiKSlcblx0XHQvL0AgdHMtaWdub3JlXG5cdFx0Ly9jb25zdCBwYXlsb2FkSGFzaCA9IGthc3BhY29yZS5jcnlwdG8uSGFzaC5zaGEyNTZzaGEyNTYoQnVmZmVyLmZyb20ocGF5bG9hZFN0cikpO1xuXHRcdGNvbnN0IHJwY1RYOiBSUEMuU3VibWl0VHJhbnNhY3Rpb25SZXF1ZXN0ID0ge1xuXHRcdFx0dHJhbnNhY3Rpb246IHtcblx0XHRcdFx0dmVyc2lvbixcblx0XHRcdFx0aW5wdXRzLFxuXHRcdFx0XHRvdXRwdXRzLFxuXHRcdFx0XHRsb2NrVGltZSxcblx0XHRcdFx0Ly9wYXlsb2FkOidmMDBmMDAwMDAwMDAwMDAwMDAwMDE5NzZhOTE0Nzg0YmY0YzI1NjJmMzhmZTBjNDlkMWUwNTM4Y2VlNDQxMGQzN2UwOTg4YWMnLFxuXHRcdFx0XHRwYXlsb2FkSGFzaDogJzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAnLFxuXHRcdFx0XHQvL3BheWxvYWRIYXNoOidhZmU3ZmM2ZmUzMjg4ZTc5ZjlhMGMwNWMyMmMxZWFkMmFhZTI5YjZkYTAxOTlkN2I0MzYyOGMyNTg4ZTI5NmY5Jyxcblx0XHRcdFx0Ly9cblx0XHRcdFx0c3VibmV0d29ya0lkOiB0aGlzLnN1Ym5ldHdvcmtJZCwgLy9CdWZmZXIuZnJvbSh0aGlzLnN1Ym5ldHdvcmtJZCwgXCJoZXhcIikudG9TdHJpbmcoXCJiYXNlNjRcIiksXG5cdFx0XHRcdGZlZSxcblx0XHRcdFx0Ly9nYXM6IDBcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL2NvbnN0IHJwY3R4ID0gSlNPTi5zdHJpbmdpZnkocnBjVFgsIG51bGwsIFwiICBcIik7XG5cblx0XHRjb25zdCB0czEgPSBEYXRlLm5vdygpO1xuXHRcdHRoaXMubG9nZ2VyLmluZm8oYHR4IC4uLiBnZW5lcmF0aW9uIHRpbWUgJHsoKHRzMS10czApLzEwMDApLnRvRml4ZWQoMil9IHNlY2ApXG5cblx0XHRpZiAoZGVidWcgfHwgdGhpcy5sb2dnZXJMZXZlbCA+IDApIHtcblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGBycGNUWCAke0pTT04uc3RyaW5naWZ5KHJwY1RYLCBudWxsLCBcIiAgXCIpfWApXG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhgcnBjVFggJHtKU09OLnN0cmluZ2lmeShycGNUWCl9YClcblx0XHR9XG5cblx0XHRjb25zdCB0c182ID0gRGF0ZS5ub3coKTtcblxuXHRcdHRoaXMubG9nZ2VyLmluZm8oYHRpbWUgaW4gbXNlY2AsIHtcblx0XHRcdFwidG90YWxcIjogdHNfNi10czAsXG5cdFx0XHRcImVzdGltYXRlLXRyYW5zYWN0aW9uXCI6IHRzXzAtdHMwLFxuXHRcdFx0XCJ0eC5zaWduXCI6IHRzXzEtdHNfMCxcblx0XHRcdFwidHgudG9TdHJpbmdcIjogdHNfMi10c18xLFxuXHRcdFx0Ly9cInRzXzMtdHNfMlwiOiB0c18zLXRzXzIsXG5cdFx0XHRcInR4LmlucHV0cy5tYXBcIjogdHNfNC10c18zLFxuXHRcdFx0XCJ0eC5vdXRwdXRzLm1hcFwiOiB0c181LXRzXzQsXG5cdFx0XHQvL1widHNfNi10c181XCI6IHRzXzYtdHNfNVxuXHRcdH0pXG5cblx0XHRpZih0eFBhcmFtc0FyZy5za2lwVVRYT0luVXNlTWFyayAhPT0gdHJ1ZSl7XG5cdFx0XHR0aGlzLnV0eG9TZXQudXBkYXRlVXNlZCh1dHhvcyk7XG5cdFx0fVxuXG5cdFx0Ly9jb25zdCBycGN0eCA9IEpTT04uc3RyaW5naWZ5KHJwY1RYLCBudWxsLCBcIiAgXCIpO1xuXHRcdC8vY29uc29sZS5sb2coXCJycGNUWFwiLCBycGNUWClcblx0XHQvL2NvbnNvbGUubG9nKFwiXFxuXFxuIyMjIyMjIyNycGN0eFxcblwiLCBycGN0eCtcIlxcblxcblxcblwiKVxuXHRcdC8vaWYoYW1vdW50LzFlOCA+IDMpXG5cdFx0Ly9cdHRocm93IG5ldyBFcnJvcihcIlRPRE8gWFhYWFhYXCIpXG5cdFx0cmV0dXJuIHsuLi5kYXRhLCBycGNUWH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTZW5kIGEgdHJhbnNhY3Rpb24uIFJldHVybnMgdHJhbnNhY3Rpb24gaWQuXG5cdCAqIEBwYXJhbSB0eFBhcmFtc1xuXHQgKiBAcGFyYW0gdHhQYXJhbXMudG9BZGRyIFRvIGFkZHJlc3MgaW4gY2FzaGFkZHIgZm9ybWF0IChlLmcuIGthc3BhdGVzdDpxcTBkNmgwcHJqbTVtcGRsZDVwbmNzdDNhZHUweWFtNnhjaDR0cjY5azIpXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy5hbW91bnQgQW1vdW50IHRvIHNlbmQgaW4gc29tcGlzICgxMDAwMDAwMDAgKDFlOCkgc29tcGlzIGluIDEgS0FTKVxuXHQgKiBAcGFyYW0gdHhQYXJhbXMuZmVlIEZlZSBmb3IgbWluZXJzIGluIHNvbXBpc1xuXHQgKiBAdGhyb3dzIGBGZXRjaEVycm9yYCBpZiBlbmRwb2ludCBpcyBkb3duLiBBUEkgZXJyb3IgbWVzc2FnZSBpZiB0eCBlcnJvci4gRXJyb3IgaWYgYW1vdW50IGlzIHRvbyBsYXJnZSB0byBiZSByZXByZXNlbnRlZCBhcyBhIGphdmFzY3JpcHQgbnVtYmVyLlxuXHQgKi9cblx0YXN5bmMgc3VibWl0VHJhbnNhY3Rpb24odHhQYXJhbXNBcmc6IFR4U2VuZCwgZGVidWcgPSBmYWxzZSk6IFByb21pc2UgPCBUeFJlc3AgfCBudWxsID4ge1xuXHRcdHR4UGFyYW1zQXJnLnNraXBVVFhPSW5Vc2VNYXJrID0gdHJ1ZTtcblxuXHRcdGxldCByZXZlcnNlQ2hhbmdlQWRkcmVzcyA9IGZhbHNlO1xuXHRcdGlmKCF0eFBhcmFtc0FyZy5jaGFuZ2VBZGRyT3ZlcnJpZGUpe1xuXHRcdFx0dHhQYXJhbXNBcmcuY2hhbmdlQWRkck92ZXJyaWRlID0gdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLm5leHQoKTtcblx0XHRcdHJldmVyc2VDaGFuZ2VBZGRyZXNzID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCB7XG5cdFx0XHRycGNUWCwgdXR4b0lkcywgYW1vdW50LCB0b0FkZHIsIG5vdGUsIHV0eG9zXG5cdFx0fSA9IGF3YWl0IHRoaXMuYnVpbGRUcmFuc2FjdGlvbih0eFBhcmFtc0FyZywgZGVidWcpO1xuXG5cdFx0Ly9jb25zb2xlLmxvZyhcInJwY1RYOlwiLCBycGNUWClcblx0XHQvL3Rocm93IG5ldyBFcnJvcihcIlRPRE8gOiBYWFhYXCIpXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHRzID0gRGF0ZS5ub3coKTtcblx0XHRcdGxldCB0eGlkOiBzdHJpbmcgPSBhd2FpdCB0aGlzLmFwaS5zdWJtaXRUcmFuc2FjdGlvbihycGNUWCk7XG5cdFx0XHRjb25zdCB0czMgPSBEYXRlLm5vdygpO1xuXHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhgdHggLi4uIHN1Ym1pc3Npb24gdGltZSAkeygodHMzLXRzKS8xMDAwKS50b0ZpeGVkKDIpfSBzZWNgKTtcblx0XHRcdHRoaXMubG9nZ2VyLmluZm8oYHR4aWQ6ICR7dHhpZH1gKTtcblx0XHRcdGlmKCF0eGlkKXtcblx0XHRcdFx0aWYocmV2ZXJzZUNoYW5nZUFkZHJlc3MpXG5cdFx0XHRcdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLnJldmVyc2UoKTtcblx0XHRcdFx0cmV0dXJuIG51bGw7Ly8gYXMgVHhSZXNwO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnV0eG9TZXQuaW5Vc2UucHVzaCguLi51dHhvSWRzKTtcblx0XHRcdHRoaXMudHhTdG9yZS5hZGQoe1xuXHRcdFx0XHRpbjpmYWxzZSwgdHMsIGlkOnR4aWQsIGFtb3VudCwgYWRkcmVzczp0b0FkZHIsIG5vdGUsXG5cdFx0XHRcdGJsdWVTY29yZTogdGhpcy5ibHVlU2NvcmUsXG5cdFx0XHRcdHR4OnJwY1RYLnRyYW5zYWN0aW9uLFxuXHRcdFx0XHRteUFkZHJlc3M6IHRoaXMuYWRkcmVzc01hbmFnZXIuaXNPdXIodG9BZGRyKSxcblx0XHRcdFx0aXNDb2luYmFzZTogZmFsc2UsXG5cdFx0XHRcdHZlcnNpb246MlxuXHRcdFx0fSlcblx0XHRcdHRoaXMudXBkYXRlRGVidWdJbmZvKCk7XG5cdFx0XHR0aGlzLmVtaXRDYWNoZSgpXG5cdFx0XHQvKlxuXHRcdFx0dGhpcy5wZW5kaW5nSW5mby5hZGQodHhpZCwge1xuXHRcdFx0XHRyYXdUeDogdHgudG9TdHJpbmcoKSxcblx0XHRcdFx0dXR4b0lkcyxcblx0XHRcdFx0YW1vdW50LFxuXHRcdFx0XHR0bzogdG9BZGRyLFxuXHRcdFx0XHRmZWVcblx0XHRcdH0pO1xuXHRcdFx0Ki9cblx0XHRcdGNvbnN0IHJlc3A6IFR4UmVzcCA9IHtcblx0XHRcdFx0dHhpZCxcblx0XHRcdFx0Ly9ycGN0eFxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3A7XG5cdFx0fSBjYXRjaCAoZTphbnkpIHtcblx0XHRcdGlmKHJldmVyc2VDaGFuZ2VBZGRyZXNzKVxuXHRcdFx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MucmV2ZXJzZSgpO1xuXHRcdFx0aWYgKHR5cGVvZiBlLnNldEV4dHJhRGVidWdJbmZvID09IFwiZnVuY3Rpb25cIil7XG5cdFx0XHRcdGxldCBtYXNzID0gMDtcblx0XHRcdFx0bGV0IHNhdG9zaGlzID0gMDtcblx0XHRcdFx0bGV0IGxpc3QgPSB1dHhvcy5tYXAodHg9Pntcblx0XHRcdFx0XHRtYXNzICs9IHR4Lm1hc3M7XG5cdFx0XHRcdFx0c2F0b3NoaXMgKz0gdHguc2F0b3NoaXM7XG5cdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHR4LCB7XG5cdFx0XHRcdFx0XHRhZGRyZXNzOnR4LmFkZHJlc3MudG9TdHJpbmcoKSxcblx0XHRcdFx0XHRcdHNjcmlwdDp0eC5zY3JpcHQ/LnRvU3RyaW5nKClcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Ly84NjUwMCwwMDAwMDAwMFxuXHRcdFx0XHRsZXQgaW5mbyA9IHtcblx0XHRcdFx0XHRtYXNzLFxuXHRcdFx0XHRcdHNhdG9zaGlzLFxuXHRcdFx0XHRcdHV0eG9Db3VudDogbGlzdC5sZW5ndGgsXG5cdFx0XHRcdFx0dXR4b3M6IGxpc3Rcblx0XHRcdFx0fVxuXHRcdFx0XHRlLnNldEV4dHJhRGVidWdJbmZvKGluZm8pXG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdCogQ29tcG91bmQgVVRYT3MgYnkgcmUtc2VuZGluZyBmdW5kcyB0byBpdHNlbGZcblx0Ki9cdFxuXHRhc3luYyBjb21wb3VuZFVUWE9zKHR4Q29tcG91bmRPcHRpb25zOlR4Q29tcG91bmRPcHRpb25zPXt9LCBkZWJ1Zz1mYWxzZSk6UHJvbWlzZTxUeFJlc3B8bnVsbD4ge1xuXHRcdGNvbnN0IHtcblx0XHRcdFVUWE9NYXhDb3VudD1DT01QT1VORF9VVFhPX01BWF9DT1VOVCxcblx0XHRcdG5ldHdvcmtGZWVNYXg9MCxcblx0XHRcdGZlZT0wLFxuXHRcdFx0dXNlTGF0ZXN0Q2hhbmdlQWRkcmVzcz1mYWxzZVxuXHRcdH0gPSB0eENvbXBvdW5kT3B0aW9ucztcblxuXHRcdC8vbGV0IHRvQWRkciA9IHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5uZXh0KClcblxuXHRcdGxldCB0b0FkZHIgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuYXRJbmRleFswXTtcblx0XHQvL2NvbnNvbGUubG9nKFwiY29tcG91bmRVVFhPczogdG8gYWRkcmVzczpcIiwgdG9BZGRyLCBcInVzZUxhdGVzdENoYW5nZUFkZHJlc3M6XCIrdXNlTGF0ZXN0Q2hhbmdlQWRkcmVzcylcblx0XHRpZiAodXNlTGF0ZXN0Q2hhbmdlQWRkcmVzcyl7XG5cdFx0XHR0b0FkZHIgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuY3VycmVudC5hZGRyZXNzO1xuXHRcdH1cblx0XHRpZighdG9BZGRyKXtcblx0XHRcdHRvQWRkciA9IHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5uZXh0KCk7XG5cdFx0fVxuXG5cdFx0bGV0IHR4UGFyYW1zQXJnID0ge1xuXHRcdFx0dG9BZGRyLFxuXHRcdFx0Y2hhbmdlQWRkck92ZXJyaWRlOnRvQWRkcixcblx0XHRcdGFtb3VudDogLTEsXG5cdFx0XHRmZWUsXG5cdFx0XHRuZXR3b3JrRmVlTWF4LFxuXHRcdFx0Y29tcG91bmRpbmdVVFhPOnRydWUsXG5cdFx0XHRjb21wb3VuZGluZ1VUWE9NYXhDb3VudDpVVFhPTWF4Q291bnRcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGxldCByZXMgPSBhd2FpdCB0aGlzLnN1Ym1pdFRyYW5zYWN0aW9uKHR4UGFyYW1zQXJnLCBkZWJ1Zyk7XG5cdFx0XHRpZighcmVzPy50eGlkKVxuXHRcdFx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MucmV2ZXJzZSgpXG5cdFx0XHRyZXR1cm4gcmVzO1xuXHRcdH1jYXRjaChlKXtcblx0XHRcdHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5yZXZlcnNlKCk7XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuZG9QZW5kaW5nVHgoaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHtcdHV0eG9JZHNcdH0gPSB0aGlzLnBlbmRpbmdJbmZvLnRyYW5zYWN0aW9uc1tpZF07XG5cdFx0ZGVsZXRlIHRoaXMucGVuZGluZ0luZm8udHJhbnNhY3Rpb25zW2lkXTtcblx0XHR0aGlzLnV0eG9TZXQucmVsZWFzZSh1dHhvSWRzKTtcblx0XHR0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MucmV2ZXJzZSgpO1xuXHRcdHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuXHR9XG5cdCovXG5cblx0LyoqXG5cdCAqIEFmdGVyIHdlIHNlZSB0aGUgdHJhbnNhY3Rpb24gaW4gdGhlIEFQSSByZXN1bHRzLCBkZWxldGUgaXQgZnJvbSBvdXIgcGVuZGluZyBsaXN0LlxuXHQgKiBAcGFyYW0gaWQgVGhlIHR4IGhhc2hcblx0ICovXG5cdCAvKlxuXHRkZWxldGVQZW5kaW5nVHgoaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdC8vIHVuZG8gKyBkZWxldGUgb2xkIHV0eG9zXG5cdFx0Y29uc3Qge1x0dXR4b0lkcyB9ID0gdGhpcy5wZW5kaW5nSW5mby50cmFuc2FjdGlvbnNbaWRdO1xuXHRcdGRlbGV0ZSB0aGlzLnBlbmRpbmdJbmZvLnRyYW5zYWN0aW9uc1tpZF07XG5cdFx0dGhpcy51dHhvU2V0LnJlbW92ZSh1dHhvSWRzKTtcblx0fVxuXHQqL1xuXG5cdHJ1blN0YXRlQ2hhbmdlSG9va3MoKTogdm9pZCB7XG5cdFx0Ly90aGlzLnV0eG9TZXQudXBkYXRlVXR4b0JhbGFuY2UoKTtcblx0XHQvL3RoaXMudXBkYXRlQmFsYW5jZSgpO1xuXHR9XG5cblx0Ly9VVFhPc1BvbGxpbmdTdGFydGVkOmJvb2xlYW4gPSBmYWxzZTtcblx0ZW1pdGVkVVRYT3M6U2V0PHN0cmluZz4gPSBuZXcgU2V0KClcblx0c3RhcnRVVFhPc1BvbGxpbmcoKXtcblx0XHQvL2lmICh0aGlzLlVUWE9zUG9sbGluZ1N0YXJ0ZWQpXG5cdFx0Ly9cdHJldHVyblxuXHRcdC8vdGhpcy5VVFhPc1BvbGxpbmdTdGFydGVkID0gdHJ1ZTtcblx0XHR0aGlzLmVtaXRVVFhPcygpO1xuXHR9XG5cblx0ZW1pdFVUWE9zKCl7XG5cdFx0bGV0IGNodW5rcyA9IGhlbHBlci5jaHVua3MoWy4uLnRoaXMudXR4b1NldC51dHhvcy5jb25maXJtZWQudmFsdWVzKCldLCAxMDApO1xuXHRcdGNodW5rcyA9IGNodW5rcy5jb25jYXQoaGVscGVyLmNodW5rcyhbLi4udGhpcy51dHhvU2V0LnV0eG9zLnBlbmRpbmcudmFsdWVzKCldLCAxMDApKTtcblxuXHRcdGxldCBzZW5kID0gKCk9Pntcblx0XHRcdGxldCB1dHhvcyA9IGNodW5rcy5wb3AoKTtcblx0XHRcdGlmICghdXR4b3MpXG5cdFx0XHRcdHJldHVyblxuXHRcdFx0dXR4b3MgPSB1dHhvcy5tYXAodHg9Pntcblx0XHRcdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHR4LCB7XG5cdFx0XHRcdFx0YWRkcmVzczp0eC5hZGRyZXNzLnRvU3RyaW5nKClcblx0XHRcdFx0fSlcblx0XHRcdH0pXG5cdFx0XHR0aGlzLmVtaXQoXCJ1dHhvLXN5bmNcIiwge3V0eG9zfSlcblxuXHRcdFx0aGVscGVyLmRwYygyMDAsIHNlbmQpXG5cdFx0fVxuXG5cdFx0c2VuZCgpO1xuXHR9XG5cblx0Z2V0IGNhY2hlKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHQvL3BlbmRpbmdUeDogdGhpcy5wZW5kaW5nSW5mby50cmFuc2FjdGlvbnMsXG5cdFx0XHR1dHhvczoge1xuXHRcdFx0XHQvL3V0eG9TdG9yYWdlOiB0aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2UsXG5cdFx0XHRcdGluVXNlOiB0aGlzLnV0eG9TZXQuaW5Vc2UsXG5cdFx0XHR9LFxuXHRcdFx0Ly90cmFuc2FjdGlvbnNTdG9yYWdlOiB0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UsXG5cdFx0XHRhZGRyZXNzZXM6IHtcblx0XHRcdFx0cmVjZWl2ZUNvdW50ZXI6IHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY291bnRlcixcblx0XHRcdFx0Y2hhbmdlQ291bnRlcjogdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmNvdW50ZXIsXG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHJlc3RvcmVDYWNoZShjYWNoZTogV2FsbGV0Q2FjaGUpOiB2b2lkIHtcblx0XHQvL3RoaXMucGVuZGluZ0luZm8udHJhbnNhY3Rpb25zID0gY2FjaGUucGVuZGluZ1R4O1xuXHRcdC8vdGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlID0gY2FjaGUudXR4b3MudXR4b1N0b3JhZ2U7XG5cdFx0dGhpcy51dHhvU2V0LmluVXNlID0gY2FjaGUudXR4b3MuaW5Vc2U7XG5cdFx0Lypcblx0XHRPYmplY3QuZW50cmllcyh0aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2UpLmZvckVhY2goKFthZGRyLCB1dHhvc106IFtzdHJpbmcsIEFwaS5VdHhvW11dKSA9PiB7XG5cdFx0XHR0aGlzLnV0eG9TZXQuYWRkKHV0eG9zLCBhZGRyKTtcblx0XHR9KTtcblx0XHR0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UgPSBjYWNoZS50cmFuc2FjdGlvbnNTdG9yYWdlO1xuXHRcdHRoaXMuYWRkcmVzc01hbmFnZXIuZ2V0QWRkcmVzc2VzKGNhY2hlLmFkZHJlc3Nlcy5yZWNlaXZlQ291bnRlciArIDEsICdyZWNlaXZlJyk7XG5cdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5nZXRBZGRyZXNzZXMoY2FjaGUuYWRkcmVzc2VzLmNoYW5nZUNvdW50ZXIgKyAxLCAnY2hhbmdlJyk7XG5cdFx0dGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5hZHZhbmNlKGNhY2hlLmFkZHJlc3Nlcy5yZWNlaXZlQ291bnRlciAtIDEpO1xuXHRcdHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5hZHZhbmNlKGNhY2hlLmFkZHJlc3Nlcy5jaGFuZ2VDb3VudGVyKTtcblx0XHQvL3RoaXMudHJhbnNhY3Rpb25zID0gdHhQYXJzZXIodGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlLCBPYmplY3Qua2V5cyh0aGlzLmFkZHJlc3NNYW5hZ2VyLmFsbCkpO1xuXHRcdHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuXHRcdCovXG5cdH1cblxuXHQvKipcblx0ICogR2VuZXJhdGVzIGVuY3J5cHRlZCB3YWxsZXQgZGF0YS5cblx0ICogQHBhcmFtIHBhc3N3b3JkIHVzZXIncyBjaG9zZW4gcGFzc3dvcmRcblx0ICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIG9iamVjdC1saWtlIHN0cmluZy4gU3VnZ2VzdGVkIHRvIHN0b3JlIGFzIHN0cmluZyBmb3IgLmltcG9ydCgpLlxuXHQgKi9cblx0YXN5bmMgZXhwb3J0IChwYXNzd29yZDogc3RyaW5nKTogUHJvbWlzZSA8IHN0cmluZyA+IHtcblx0XHRjb25zdCBzYXZlZFdhbGxldDogV2FsbGV0U2F2ZSA9IHtcblx0XHRcdHByaXZLZXk6IHRoaXMuSERXYWxsZXQudG9TdHJpbmcoKSxcblx0XHRcdHNlZWRQaHJhc2U6IHRoaXMubW5lbW9uaWNcblx0XHR9O1xuXHRcdHJldHVybiBDcnlwdG8uZW5jcnlwdChwYXNzd29yZCwgSlNPTi5zdHJpbmdpZnkoc2F2ZWRXYWxsZXQpKTtcblx0fVxuXG5cblx0bG9nZ2VyOiBMb2dnZXI7XG5cdGxvZ2dlckxldmVsOiBudW1iZXIgPSAwO1xuXHRzZXRMb2dMZXZlbChsZXZlbDogc3RyaW5nKSB7XG5cdFx0dGhpcy5sb2dnZXIuc2V0TGV2ZWwobGV2ZWwpO1xuXHRcdHRoaXMubG9nZ2VyTGV2ZWwgPSBsZXZlbCE9J25vbmUnPzI6MDtcblx0XHRrYXNwYWNvcmUuc2V0RGVidWdMZXZlbChsZXZlbD8xOjApO1xuXHR9XG59XG5cbmV4cG9ydCB7V2FsbGV0fVxuIl19