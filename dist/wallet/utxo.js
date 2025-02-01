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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UtxoSet = exports.COINBASE_CFM_COUNT = exports.CONFIRMATION_COUNT = exports.UnspentOutput = void 0;
const unspent_output_1 = require("./unspent-output");
Object.defineProperty(exports, "UnspentOutput", { enumerable: true, get: function () { return unspent_output_1.UnspentOutput; } });
const helper = __importStar(require("../utils/helper"));
// import * as api from './apiHelpers';
const wallet_1 = require("./wallet");
const event_target_impl_1 = require("./event-target-impl");
const KAS = helper.KAS;
exports.CONFIRMATION_COUNT = 10;
exports.COINBASE_CFM_COUNT = 100;
let seq = 0;
class UtxoSet extends event_target_impl_1.EventTargetImpl {
    constructor(wallet) {
        super();
        this.utxos = {
            confirmed: new Map(),
            pending: new Map(),
            used: new Map()
        };
        this.inUse = [];
        this.totalBalance = 0;
        this.availableBalance = 0;
        this.debug = false;
        this.utxoStorage = {};
        this.addressesUtxoSyncStatuses = new Map();
        this.wallet = wallet;
    }
    /**
     * Add UTXOs to UTXO set.
     * @param utxos Array of UTXOs from kaspa API.
     * @param address Address of UTXO owner.
     */
    add(utxos, address) {
        const utxoIds = [];
        this.logger.utxodebug("add utxos", utxos);
        const { blueScore } = this.wallet;
        utxos.forEach((utxo) => {
            const utxoId = utxo.transactionId + utxo.index.toString();
            const utxoInUse = this.inUse.includes(utxoId);
            const alreadyHaveIt = !!(this.utxos.confirmed.has(utxoId) || this.utxos.pending.has(utxoId));
            //console.log("utxo.scriptPubKey", utxo)
            //console.log("utxoInUse", {utxoInUse, alreadyHaveIt})
            if (!utxoInUse && !alreadyHaveIt /*&& utxo.isSpendable*/) {
                utxoIds.push(utxoId);
                let confirmed = (blueScore - utxo.blockDaaScore >= (utxo.isCoinbase ? exports.COINBASE_CFM_COUNT : exports.CONFIRMATION_COUNT));
                let unspentOutput = new unspent_output_1.UnspentOutput({
                    txid: utxo.transactionId,
                    address,
                    vout: utxo.index,
                    scriptPubKey: utxo.scriptPublicKey.scriptPublicKey,
                    scriptPublicKeyVersion: utxo.scriptPublicKey.version,
                    satoshis: +utxo.amount,
                    blockDaaScore: utxo.blockDaaScore,
                    isCoinbase: utxo.isCoinbase
                });
                //confirmed = confirmed || this.isOurChange(unspentOutput);
                //confirmed = /*confirmed || */this.isOurChange(unspentOutput);
                //if(confirmed){
                //	console.log("Change address: unspentOutput", blueScore-utxo.blockDaaScore, unspentOutput)
                //}
                let map = this.utxos[confirmed ? 'confirmed' : 'pending'];
                map.set(utxoId, unspentOutput);
                this.wallet.adjustBalance(confirmed, unspentOutput.satoshis);
            }
            else if (utxoInUse) {
                let unspentOutput = new unspent_output_1.UnspentOutput({
                    txid: utxo.transactionId,
                    address,
                    vout: utxo.index,
                    scriptPubKey: utxo.scriptPublicKey.scriptPublicKey,
                    scriptPublicKeyVersion: utxo.scriptPublicKey.version,
                    satoshis: +utxo.amount,
                    blockDaaScore: utxo.blockDaaScore,
                    isCoinbase: utxo.isCoinbase
                });
                this.utxos.used.set(utxoId, unspentOutput);
            }
        });
        if (utxoIds.length) {
            this.logger.utxodebug(`adding ${utxoIds.length} UTXO entries:\n`, utxoIds);
            this.logger.utxo(`incoming ${utxoIds.length} UTXO entries`);
        }
        this.wallet.txStore.addAddressUTXOs(address, utxos);
        return utxoIds;
    }
    get logger() {
        return this.wallet.logger;
    }
    remove(utxoIds) {
        this.release(utxoIds);
        let { blueScore } = this.wallet;
        let utxo;
        utxoIds.forEach(id => {
            utxo = this.utxos.confirmed.get(id);
            if (utxo) {
                this.utxos.confirmed.delete(id);
                this.wallet.adjustBalance(true, -utxo.satoshis);
            }
            utxo = this.utxos.pending.get(id);
            if (utxo) {
                this.utxos.pending.delete(id);
                this.wallet.adjustBalance(false, -utxo.satoshis);
                //duplicate tx issue handling
                if (utxo.blockDaaScore - blueScore < 70) {
                    let apiUTXO = {
                        transactionId: utxo.txId,
                        amount: utxo.satoshis,
                        scriptPublicKey: {
                            version: utxo.scriptPublicKeyVersion,
                            scriptPublicKey: utxo.scriptPubKey
                        },
                        blockDaaScore: utxo.blockDaaScore,
                        index: utxo.outputIndex,
                        isCoinbase: utxo.isCoinbase
                    };
                    this.wallet.txStore.removePendingUTXO(apiUTXO, utxo.address.toString());
                }
            }
        });
    }
    clearUsed() {
        this.inUse = [];
        this.utxos.used.clear();
        this.wallet.updateDebugInfo();
        this.wallet.emitCache();
    }
    clearMissing() {
        const { confirmed, pending, used } = this.utxos;
        let missing = this.inUse.filter(utxoId => {
            return !(confirmed.has(utxoId) || pending.has(utxoId) || used.has(utxoId));
        });
        if (!missing.length)
            return false;
        this.release(missing);
        return true;
    }
    release(utxoIdsToEnable) {
        // assigns new array without any utxoIdsToEnable
        this.inUse = this.inUse.filter((utxoId) => !utxoIdsToEnable.includes(utxoId));
        utxoIdsToEnable.forEach(utxoId => {
            this.utxos.used.delete(utxoId);
        });
        this.wallet.updateDebugInfo();
        this.wallet.emitCache();
        // this.updateUtxoBalance();
    }
    updateUtxoBalance() {
        const { blueScore } = this.wallet;
        [...this.utxos.pending.values()].forEach(utxo => {
            if (blueScore - utxo.blockDaaScore < (utxo.isCoinbase ? exports.COINBASE_CFM_COUNT : exports.CONFIRMATION_COUNT))
                return;
            this.utxos.pending.delete(utxo.txId + utxo.outputIndex);
            this.wallet.adjustBalance(false, -utxo.satoshis, false);
            this.utxos.confirmed.set(utxo.txId + utxo.outputIndex, utxo);
            this.wallet.adjustBalance(true, utxo.satoshis);
        });
    }
    clear() {
        this.utxos.confirmed.clear();
        this.utxos.pending.clear();
        this.utxos.used.clear();
        this.inUse = [];
        this.availableBalance = 0;
        this.utxoStorage = {};
        this.logger.info('UTXO set cleared.');
    }
    updateUsed(utxos) {
        utxos.forEach(utxo => {
            this.inUse.push(utxo.id);
            this.utxos.used.set(utxo.txId, utxo);
        });
        this.wallet.updateDebugInfo();
        this.wallet.emitCache();
    }
    /**
     * Naively select UTXOs.
     * @param txAmount Provide the amount that the UTXOs should cover.
     * @throws Error message if the UTXOs can't cover the `txAmount`
     */
    selectUtxos(txAmount) {
        const utxos = [];
        const utxoIds = [];
        let totalVal = 0;
        let list = [...this.utxos.confirmed.values()];
        list = list.filter((utxo) => {
            return !this.inUse.includes(utxo.id);
        });
        list.sort((a, b) => {
            return a.blockDaaScore - b.blockDaaScore || b.satoshis - a.satoshis || a.txId.localeCompare(b.txId) || a.outputIndex - b.outputIndex;
        });
        let mass = 0;
        for (const utxo of list) {
            //console.log("info",`UTXO ID: ${utxoId}  , UTXO: ${utxo}`);
            //if (!this.inUse.includes(utxoId)) {
            utxoIds.push(utxo.id);
            utxos.push(utxo);
            mass += utxo.mass;
            totalVal += utxo.satoshis;
            //}
            if (totalVal >= txAmount)
                break;
        }
        if (totalVal < txAmount)
            throw new Error(`Insufficient balance - need: ${KAS(txAmount)} KODA, available: ${KAS(totalVal)} KODA`);
        return {
            utxoIds,
            utxos,
            mass
        };
    }
    /**
     * Naively collect UTXOs.
     * @param maxCount Provide the max UTXOs count.
     */
    collectUtxos(maxCount = 10000) {
        const utxos = [];
        const utxoIds = [];
        let totalVal = 0;
        let list = [...this.utxos.confirmed.values()];
        list = list.filter((utxo) => {
            return !this.inUse.includes(utxo.id);
        });
        list.sort((a, b) => {
            return a.blockDaaScore - b.blockDaaScore || b.satoshis - a.satoshis || a.txId.localeCompare(b.txId) || a.outputIndex - b.outputIndex;
        });
        let maxMass = wallet_1.Wallet.MaxMassUTXOs;
        let mass = 0;
        for (const utxo of list) {
            if (utxos.length >= maxCount || mass + utxo.mass >= maxMass)
                break;
            utxoIds.push(utxo.id);
            utxos.push(utxo);
            totalVal += utxo.satoshis;
            mass += utxo.mass;
        }
        //console.log("maxMass:"+maxMass, "mass:"+mass)
        return {
            utxoIds,
            utxos,
            amount: totalVal,
            mass
        };
    }
    syncAddressesUtxos(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const newAddresses = addresses.map(address => {
                if (this.addressesUtxoSyncStatuses.has(address))
                    return;
                this.addressesUtxoSyncStatuses.set(address, false);
                return address;
            }).filter(address => address);
            //in sync process addressDiscovery calls findUtxos
            if (!newAddresses.length || (this.wallet.syncInProggress && !this.wallet.options.disableAddressDerivation))
                return;
            yield this.wallet.findUtxos(newAddresses);
            if (!this.wallet.syncOnce)
                yield this.utxoSubscribe();
        });
    }
    utxoSubscribe() {
        return __awaiter(this, void 0, void 0, function* () {
            let addresses = [];
            this.addressesUtxoSyncStatuses.forEach((sent, address) => {
                //if(sent)
                //  return
                //  !!!FIXME prevent multiple address subscriptions
                //if(!this.addressesUtxoSyncStatuses.get(address)) {
                //this.addressesUtxoSyncStatuses.set(address, true);
                addresses.push(address);
                //}
            });
            if (!addresses.length)
                return addresses;
            //console.log(`[${this.wallet.network}] !!! +++++++++++++++ SUBSCRIBING TO ADDRESSES :)\n`,addresses);
            let utxoChangedRes = yield this.wallet.api.subscribeUtxosChanged(addresses, this.onUtxosChanged.bind(this))
                .catch((error) => {
                console.log(`[${this.wallet.network}] RPC ERROR in uxtoSync! while registering addresses:`, error, addresses);
                addresses.map(address => {
                    this.addressesUtxoSyncStatuses.set(address, false);
                });
            });
            //console.log("utxoSync:utxoChangedRes:", utxoChangedRes, "\n utxoSync addresses:", addresses)
            return addresses;
        });
    }
    onUtxosChanged(added, removed) {
        // console.log("onUtxosChanged:res", added, removed)
        added.forEach((utxos, address) => {
            //this.logger.log('info', `${address}: ${utxos.length} utxos found.+=+=+=+=+=+=+++++=======+===+====+====+====+`);
            if (!utxos.length)
                return;
            if (!this.utxoStorage[address]) {
                this.utxoStorage[address] = utxos;
            }
            else {
                let txid2Utxo = {};
                utxos.forEach(utxo => {
                    txid2Utxo[utxo.transactionId + utxo.index] = utxo;
                });
                let oldUtxos = this.utxoStorage[address].filter(utxo => {
                    return !txid2Utxo[utxo.transactionId + utxo.index];
                });
                this.utxoStorage[address] = [...oldUtxos, ...utxos];
            }
            this.add(utxos, address);
        });
        this.wallet.txStore.addFromUTXOs(added);
        let utxoIds = [];
        removed.forEach((utxos, address) => {
            let txid2Outpoint = {};
            utxos.forEach(utxo => {
                txid2Outpoint[utxo.transactionId + utxo.index] = utxo;
                utxoIds.push(utxo.transactionId + utxo.index);
            });
            if (!this.utxoStorage[address])
                return;
            this.utxoStorage[address] = this.utxoStorage[address].filter(utxo => {
                return !txid2Outpoint[utxo.transactionId + utxo.index];
            });
        });
        if (utxoIds.length)
            this.remove(utxoIds);
        const isActivityOnReceiveAddr = this.utxoStorage[this.wallet.receiveAddress] !== undefined;
        if (isActivityOnReceiveAddr)
            this.wallet.addressManager.receiveAddress.next();
        //this.updateUtxoBalance();
        this.wallet.emit("utxo-change", { added, removed });
    }
    isOur(utxo) {
        return (!!this.wallet.transactions[utxo.txId]) || this.isOurChange(utxo);
    }
    isOurChange(utxo) {
        return this.wallet.addressManager.isOurChange(String(utxo.address));
    }
    get count() {
        return this.utxos.confirmed.size + this.utxos.pending.size;
    }
    get confirmedCount() {
        return this.utxos.confirmed.size;
    }
}
exports.UtxoSet = UtxoSet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXR4by5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3dhbGxldC91dHhvLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHFEQUErQztBQVN2Qyw4RkFUQSw4QkFBYSxPQVNBO0FBTHJCLHdEQUEwQztBQUMxQyx1Q0FBdUM7QUFDdkMscUNBQWdDO0FBQ2hDLDJEQUFvRDtBQUNwRCxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBRVYsUUFBQSxrQkFBa0IsR0FBRyxFQUFFLENBQUM7QUFDeEIsUUFBQSxrQkFBa0IsR0FBRyxHQUFHLENBQUM7QUFFdEMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ1osTUFBYSxPQUFRLFNBQVEsbUNBQWU7SUF3QjNDLFlBQVksTUFBYztRQUN6QixLQUFLLEVBQUUsQ0FBQztRQXhCVCxVQUFLLEdBSUQ7WUFDSCxTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQUU7WUFDcEIsT0FBTyxFQUFFLElBQUksR0FBRyxFQUFFO1lBQ2xCLElBQUksRUFBRSxJQUFJLEdBQUcsRUFBRTtTQUNmLENBQUM7UUFFRixVQUFLLEdBQWEsRUFBRSxDQUFDO1FBRXJCLGlCQUFZLEdBQUcsQ0FBQyxDQUFDO1FBRWpCLHFCQUFnQixHQUFHLENBQUMsQ0FBQztRQUNyQixVQUFLLEdBQVksS0FBSyxDQUFDO1FBRXZCLGdCQUFXLEdBQWtDLEVBQUUsQ0FBQztRQUloRCw4QkFBeUIsR0FBNEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUk5RCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN0QixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEdBQUcsQ0FBQyxLQUFpQixFQUFFLE9BQWU7UUFDckMsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO1FBQzdCLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxLQUFL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UUFFbEQsMkJBQTJCO1FBQzNCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFDLEtBQUssRUFBRSxPQUFPLEVBQUMsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCxLQUFLLENBQUMsSUFBa0I7UUFDdkIsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ3pFLENBQUM7SUFFRCxXQUFXLENBQUMsSUFBa0I7UUFDN0IsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFBO0lBQ3BFLENBQUM7SUFDRCxJQUFJLEtBQUs7UUFDUixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDNUQsQ0FBQztJQUVELElBQUksY0FBYztRQUNqQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQTtJQUNqQyxDQUFDO0NBQ0Q7QUE3WEQsMEJBNlhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtBcGksUlBDfSBmcm9tICdjdXN0b20tdHlwZXMnO1xuaW1wb3J0IHtVbnNwZW50T3V0cHV0fSBmcm9tICcuL3Vuc3BlbnQtb3V0cHV0Jztcbi8vIEB0cy1pZ25vcmVcbmltcG9ydCAqIGFzIGthc3BhY29yZSBmcm9tICdAa2FzcGEvY29yZS1saWInO1xuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgKiBhcyBoZWxwZXIgZnJvbSAnLi4vdXRpbHMvaGVscGVyJztcbi8vIGltcG9ydCAqIGFzIGFwaSBmcm9tICcuL2FwaUhlbHBlcnMnO1xuaW1wb3J0IHtXYWxsZXR9IGZyb20gJy4vd2FsbGV0JztcbmltcG9ydCB7RXZlbnRUYXJnZXRJbXBsfSBmcm9tICcuL2V2ZW50LXRhcmdldC1pbXBsJztcbmNvbnN0IEtBUyA9IGhlbHBlci5LQVM7XG5leHBvcnQge1Vuc3BlbnRPdXRwdXR9O1xuZXhwb3J0IGNvbnN0IENPTkZJUk1BVElPTl9DT1VOVCA9IDEwO1xuZXhwb3J0IGNvbnN0IENPSU5CQVNFX0NGTV9DT1VOVCA9IDEwMDtcblxubGV0IHNlcSA9IDA7XG5leHBvcnQgY2xhc3MgVXR4b1NldCBleHRlbmRzIEV2ZW50VGFyZ2V0SW1wbCB7XG5cdHV0eG9zOiB7XG5cdFx0Y29uZmlybWVkOiBNYXAgPHN0cmluZywgVW5zcGVudE91dHB1dCA+O1xuXHRcdHBlbmRpbmc6IE1hcCA8c3RyaW5nLCBVbnNwZW50T3V0cHV0ID47XG5cdFx0dXNlZDpNYXAgPHN0cmluZywgVW5zcGVudE91dHB1dCA+O1xuXHR9ID0ge1xuXHRcdGNvbmZpcm1lZDogbmV3IE1hcCgpLFxuXHRcdHBlbmRpbmc6IG5ldyBNYXAoKSxcblx0XHR1c2VkOiBuZXcgTWFwKClcblx0fTtcblxuXHRpblVzZTogc3RyaW5nW10gPSBbXTtcblxuXHR0b3RhbEJhbGFuY2UgPSAwO1xuXG5cdGF2YWlsYWJsZUJhbGFuY2UgPSAwO1xuXHRkZWJ1ZzogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHV0eG9TdG9yYWdlOiBSZWNvcmQgPCBzdHJpbmcsIEFwaS5VdHhvW10gPiA9IHt9O1xuXG5cdHdhbGxldDogV2FsbGV0O1xuXG5cdGFkZHJlc3Nlc1V0eG9TeW5jU3RhdHVzZXM6IE1hcCA8IHN0cmluZywgYm9vbGVhbiA+ID0gbmV3IE1hcCgpO1xuXG5cdGNvbnN0cnVjdG9yKHdhbGxldDogV2FsbGV0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLndhbGxldCA9IHdhbGxldDtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGQgVVRYT3MgdG8gVVRYTyBzZXQuXG5cdCAqIEBwYXJhbSB1dHhvcyBBcnJheSBvZiBVVFhPcyBmcm9tIGthc3BhIEFQSS5cblx0ICogQHBhcmFtIGFkZHJlc3MgQWRkcmVzcyBvZiBVVFhPIG93bmVyLlxuXHQgKi9cblx0YWRkKHV0eG9zOiBBcGkuVXR4b1tdLCBhZGRyZXNzOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgdXR4b0lkczogc3RyaW5nW10gPSBbXTtcblx0XHR0aGlzLmxvZ2dlci51dHhvZGVidWcoXCJhZGQgdXR4b3NcIiwgdXR4b3MpXG5cdFx0Y29uc3Qge2JsdWVTY29yZX0gPSB0aGlzLndhbGxldDtcblx0XHR1dHhvcy5mb3JFYWNoKCh1dHhvKSA9PiB7XG5cdFx0XHRjb25zdCB1dHhvSWQgPSB1dHhvLnRyYW5zYWN0aW9uSWQgKyB1dHhvLmluZGV4LnRvU3RyaW5nKCk7XG5cdFx0XHRjb25zdCB1dHhvSW5Vc2UgPSB0aGlzLmluVXNlLmluY2x1ZGVzKHV0eG9JZCk7XG5cdFx0XHRjb25zdCBhbHJlYWR5SGF2ZUl0ID0gISEodGhpcy51dHhvcy5jb25maXJtZWQuaGFzKHV0eG9JZCkgfHwgdGhpcy51dHhvcy5wZW5kaW5nLmhhcyh1dHhvSWQpKTtcblx0XHRcdC8vY29uc29sZS5sb2coXCJ1dHhvLnNjcmlwdFB1YktleVwiLCB1dHhvKVxuXHRcdFx0Ly9jb25zb2xlLmxvZyhcInV0eG9JblVzZVwiLCB7dXR4b0luVXNlLCBhbHJlYWR5SGF2ZUl0fSlcblx0XHRcdGlmICghdXR4b0luVXNlICYmICFhbHJlYWR5SGF2ZUl0IC8qJiYgdXR4by5pc1NwZW5kYWJsZSovICkge1xuXHRcdFx0XHR1dHhvSWRzLnB1c2godXR4b0lkKTtcblx0XHRcdFx0bGV0IGNvbmZpcm1lZCA9IChibHVlU2NvcmUtdXR4by5ibG9ja0RhYVNjb3JlPj0gKHV0eG8uaXNDb2luYmFzZT8gQ09JTkJBU0VfQ0ZNX0NPVU5UIDogQ09ORklSTUFUSU9OX0NPVU5UKSk7XG5cdFx0XHRcdGxldCB1bnNwZW50T3V0cHV0ID0gbmV3IFVuc3BlbnRPdXRwdXQoe1xuXHRcdFx0XHRcdHR4aWQ6IHV0eG8udHJhbnNhY3Rpb25JZCxcblx0XHRcdFx0XHRhZGRyZXNzLFxuXHRcdFx0XHRcdHZvdXQ6IHV0eG8uaW5kZXgsXG5cdFx0XHRcdFx0c2NyaXB0UHViS2V5OiB1dHhvLnNjcmlwdFB1YmxpY0tleS5zY3JpcHRQdWJsaWNLZXksXG5cdFx0XHRcdFx0c2NyaXB0UHVibGljS2V5VmVyc2lvbjogdXR4by5zY3JpcHRQdWJsaWNLZXkudmVyc2lvbixcblx0XHRcdFx0XHRzYXRvc2hpczogK3V0eG8uYW1vdW50LFxuXHRcdFx0XHRcdGJsb2NrRGFhU2NvcmU6IHV0eG8uYmxvY2tEYWFTY29yZSxcblx0XHRcdFx0XHRpc0NvaW5iYXNlOiB1dHhvLmlzQ29pbmJhc2Vcblx0XHRcdFx0fSlcblx0XHRcdFx0Ly9jb25maXJtZWQgPSBjb25maXJtZWQgfHwgdGhpcy5pc091ckNoYW5nZSh1bnNwZW50T3V0cHV0KTtcblx0XHRcdFx0Ly9jb25maXJtZWQgPSAvKmNvbmZpcm1lZCB8fCAqL3RoaXMuaXNPdXJDaGFuZ2UodW5zcGVudE91dHB1dCk7XG5cdFx0XHRcdC8vaWYoY29uZmlybWVkKXtcblx0XHRcdFx0Ly9cdGNvbnNvbGUubG9nKFwiQ2hhbmdlIGFkZHJlc3M6IHVuc3BlbnRPdXRwdXRcIiwgYmx1ZVNjb3JlLXV0eG8uYmxvY2tEYWFTY29yZSwgdW5zcGVudE91dHB1dClcblx0XHRcdFx0Ly99XG5cdFx0XHRcdGxldCBtYXAgPSB0aGlzLnV0eG9zW2NvbmZpcm1lZD8nY29uZmlybWVkJzoncGVuZGluZyddO1xuXHRcdFx0XHRtYXAuc2V0KHV0eG9JZCwgdW5zcGVudE91dHB1dCk7XG5cdFx0XHRcdHRoaXMud2FsbGV0LmFkanVzdEJhbGFuY2UoY29uZmlybWVkLCB1bnNwZW50T3V0cHV0LnNhdG9zaGlzKTtcblx0XHRcdH1lbHNlIGlmKHV0eG9JblVzZSl7XG5cdFx0XHRcdGxldCB1bnNwZW50T3V0cHV0ID0gbmV3IFVuc3BlbnRPdXRwdXQoe1xuXHRcdFx0XHRcdHR4aWQ6IHV0eG8udHJhbnNhY3Rpb25JZCxcblx0XHRcdFx0XHRhZGRyZXNzLFxuXHRcdFx0XHRcdHZvdXQ6IHV0eG8uaW5kZXgsXG5cdFx0XHRcdFx0c2NyaXB0UHViS2V5OiB1dHhvLnNjcmlwdFB1YmxpY0tleS5zY3JpcHRQdWJsaWNLZXksXG5cdFx0XHRcdFx0c2NyaXB0UHVibGljS2V5VmVyc2lvbjogdXR4by5zY3JpcHRQdWJsaWNLZXkudmVyc2lvbixcblx0XHRcdFx0XHRzYXRvc2hpczogK3V0eG8uYW1vdW50LFxuXHRcdFx0XHRcdGJsb2NrRGFhU2NvcmU6IHV0eG8uYmxvY2tEYWFTY29yZSxcblx0XHRcdFx0XHRpc0NvaW5iYXNlOiB1dHhvLmlzQ29pbmJhc2Vcblx0XHRcdFx0fSlcblx0XHRcdFx0dGhpcy51dHhvcy51c2VkLnNldCh1dHhvSWQsIHVuc3BlbnRPdXRwdXQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGlmICh1dHhvSWRzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5sb2dnZXIudXR4b2RlYnVnKGBhZGRpbmcgJHt1dHhvSWRzLmxlbmd0aH0gVVRYTyBlbnRyaWVzOlxcbmAsIHV0eG9JZHMpO1xuXHRcdFx0dGhpcy5sb2dnZXIudXR4byhgaW5jb21pbmcgJHt1dHhvSWRzLmxlbmd0aH0gVVRYTyBlbnRyaWVzYCk7XG5cdFx0fVxuXHRcdHRoaXMud2FsbGV0LnR4U3RvcmUuYWRkQWRkcmVzc1VUWE9zKGFkZHJlc3MsIHV0eG9zKTtcblx0XHRyZXR1cm4gdXR4b0lkcztcblx0fVxuXG5cdGdldCBsb2dnZXIoKXtcblx0XHRyZXR1cm4gdGhpcy53YWxsZXQubG9nZ2VyXG5cdH1cblxuXHRyZW1vdmUodXR4b0lkczogc3RyaW5nW10pOiB2b2lkIHtcblx0XHR0aGlzLnJlbGVhc2UodXR4b0lkcyk7XG5cdFx0bGV0IHtibHVlU2NvcmV9ID0gdGhpcy53YWxsZXQ7XG5cdFx0bGV0IHV0eG87XG5cdFx0dXR4b0lkcy5mb3JFYWNoKGlkPT4ge1xuXHRcdFx0dXR4byA9IHRoaXMudXR4b3MuY29uZmlybWVkLmdldChpZCk7XG5cdFx0XHRpZih1dHhvKXtcblx0XHRcdFx0dGhpcy51dHhvcy5jb25maXJtZWQuZGVsZXRlKGlkKTtcblx0XHRcdFx0dGhpcy53YWxsZXQuYWRqdXN0QmFsYW5jZSh0cnVlLCAtdXR4by5zYXRvc2hpcyk7XG5cdFx0XHR9XG5cblx0XHRcdHV0eG8gPSB0aGlzLnV0eG9zLnBlbmRpbmcuZ2V0KGlkKTtcblx0XHRcdGlmKHV0eG8pe1xuXHRcdFx0XHR0aGlzLnV0eG9zLnBlbmRpbmcuZGVsZXRlKGlkKTtcblx0XHRcdFx0dGhpcy53YWxsZXQuYWRqdXN0QmFsYW5jZShmYWxzZSwgLXV0eG8uc2F0b3NoaXMpO1xuXG5cdFx0XHRcdC8vZHVwbGljYXRlIHR4IGlzc3VlIGhhbmRsaW5nXG5cdFx0XHRcdGlmKHV0eG8uYmxvY2tEYWFTY29yZS1ibHVlU2NvcmUgPCA3MCl7XG5cdFx0XHRcdFx0bGV0IGFwaVVUWE86QXBpLlV0eG8gPSB7XG5cdFx0XHRcdFx0XHR0cmFuc2FjdGlvbklkOiB1dHhvLnR4SWQsXG5cdFx0XHRcdFx0XHRhbW91bnQ6dXR4by5zYXRvc2hpcyxcblx0XHRcdFx0XHRcdHNjcmlwdFB1YmxpY0tleTp7XG5cdFx0XHRcdFx0XHRcdHZlcnNpb246dXR4by5zY3JpcHRQdWJsaWNLZXlWZXJzaW9uLFxuXHRcdFx0XHRcdFx0XHRzY3JpcHRQdWJsaWNLZXk6IHV0eG8uc2NyaXB0UHViS2V5XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0YmxvY2tEYWFTY29yZTp1dHhvLmJsb2NrRGFhU2NvcmUsXG5cdFx0XHRcdFx0XHRpbmRleDp1dHhvLm91dHB1dEluZGV4LFxuXHRcdFx0XHRcdFx0aXNDb2luYmFzZTp1dHhvLmlzQ29pbmJhc2Vcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy53YWxsZXQudHhTdG9yZS5yZW1vdmVQZW5kaW5nVVRYTyhhcGlVVFhPLCB1dHhvLmFkZHJlc3MudG9TdHJpbmcoKSlcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0Y2xlYXJVc2VkKCl7XG5cdFx0dGhpcy5pblVzZSA9IFtdO1xuXHRcdHRoaXMudXR4b3MudXNlZC5jbGVhcigpO1xuXHRcdHRoaXMud2FsbGV0LnVwZGF0ZURlYnVnSW5mbygpO1xuXHRcdHRoaXMud2FsbGV0LmVtaXRDYWNoZSgpO1xuXHR9XG5cblx0Y2xlYXJNaXNzaW5nKCk6Ym9vbGVhbntcblx0XHRjb25zdCB7Y29uZmlybWVkLCBwZW5kaW5nLCB1c2VkfSA9IHRoaXMudXR4b3M7XG5cdFx0bGV0IG1pc3NpbmcgPSB0aGlzLmluVXNlLmZpbHRlcih1dHhvSWQ9Pntcblx0XHRcdHJldHVybiAhKGNvbmZpcm1lZC5oYXModXR4b0lkKSB8fCBwZW5kaW5nLmhhcyh1dHhvSWQpIHx8IHVzZWQuaGFzKHV0eG9JZCkpXG5cdFx0fSlcblx0XHRpZighbWlzc2luZy5sZW5ndGgpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHR0aGlzLnJlbGVhc2UobWlzc2luZyk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRyZWxlYXNlKHV0eG9JZHNUb0VuYWJsZTogc3RyaW5nW10pOiB2b2lkIHtcblx0XHQvLyBhc3NpZ25zIG5ldyBhcnJheSB3aXRob3V0IGFueSB1dHhvSWRzVG9FbmFibGVcblx0XHR0aGlzLmluVXNlID0gdGhpcy5pblVzZS5maWx0ZXIoKHV0eG9JZCkgPT4gIXV0eG9JZHNUb0VuYWJsZS5pbmNsdWRlcyh1dHhvSWQpKTtcblx0XHR1dHhvSWRzVG9FbmFibGUuZm9yRWFjaCh1dHhvSWQ9Pntcblx0XHRcdHRoaXMudXR4b3MudXNlZC5kZWxldGUodXR4b0lkKTtcblx0XHR9KVxuXHRcdHRoaXMud2FsbGV0LnVwZGF0ZURlYnVnSW5mbygpO1xuXHRcdHRoaXMud2FsbGV0LmVtaXRDYWNoZSgpO1xuXHRcdC8vIHRoaXMudXBkYXRlVXR4b0JhbGFuY2UoKTtcblx0fVxuXG5cdHVwZGF0ZVV0eG9CYWxhbmNlKCk6IHZvaWQge1xuXHRcdGNvbnN0IHtibHVlU2NvcmV9ID0gdGhpcy53YWxsZXQ7XG5cdFx0Wy4uLnRoaXMudXR4b3MucGVuZGluZy52YWx1ZXMoKV0uZm9yRWFjaCh1dHhvPT57XG5cdFx0XHRpZihibHVlU2NvcmUtdXR4by5ibG9ja0RhYVNjb3JlIDwgKHV0eG8uaXNDb2luYmFzZT8gQ09JTkJBU0VfQ0ZNX0NPVU5UIDogQ09ORklSTUFUSU9OX0NPVU5UKSlcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHR0aGlzLnV0eG9zLnBlbmRpbmcuZGVsZXRlKHV0eG8udHhJZCt1dHhvLm91dHB1dEluZGV4KTtcblx0XHRcdHRoaXMud2FsbGV0LmFkanVzdEJhbGFuY2UoZmFsc2UsIC11dHhvLnNhdG9zaGlzLCBmYWxzZSk7XG5cdFx0XHR0aGlzLnV0eG9zLmNvbmZpcm1lZC5zZXQodXR4by50eElkK3V0eG8ub3V0cHV0SW5kZXgsIHV0eG8pO1xuXHRcdFx0dGhpcy53YWxsZXQuYWRqdXN0QmFsYW5jZSh0cnVlLCB1dHhvLnNhdG9zaGlzKTtcblx0XHR9KVxuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy51dHhvcy5jb25maXJtZWQuY2xlYXIoKTtcblx0XHR0aGlzLnV0eG9zLnBlbmRpbmcuY2xlYXIoKTtcblx0XHR0aGlzLnV0eG9zLnVzZWQuY2xlYXIoKTtcblx0XHR0aGlzLmluVXNlID0gW107XG5cdFx0dGhpcy5hdmFpbGFibGVCYWxhbmNlID0gMDtcblx0XHR0aGlzLnV0eG9TdG9yYWdlID0ge307XG5cdFx0dGhpcy5sb2dnZXIuaW5mbygnVVRYTyBzZXQgY2xlYXJlZC4nKTtcblx0fVxuXG5cdHVwZGF0ZVVzZWQodXR4b3M6VW5zcGVudE91dHB1dFtdKXtcblx0XHR1dHhvcy5mb3JFYWNoKHV0eG89Pntcblx0XHRcdHRoaXMuaW5Vc2UucHVzaCh1dHhvLmlkKTtcblx0XHRcdHRoaXMudXR4b3MudXNlZC5zZXQodXR4by50eElkLCB1dHhvKTtcblx0XHR9KVxuXHRcdHRoaXMud2FsbGV0LnVwZGF0ZURlYnVnSW5mbygpO1xuXHRcdHRoaXMud2FsbGV0LmVtaXRDYWNoZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5haXZlbHkgc2VsZWN0IFVUWE9zLlxuXHQgKiBAcGFyYW0gdHhBbW91bnQgUHJvdmlkZSB0aGUgYW1vdW50IHRoYXQgdGhlIFVUWE9zIHNob3VsZCBjb3Zlci5cblx0ICogQHRocm93cyBFcnJvciBtZXNzYWdlIGlmIHRoZSBVVFhPcyBjYW4ndCBjb3ZlciB0aGUgYHR4QW1vdW50YFxuXHQgKi9cblx0c2VsZWN0VXR4b3ModHhBbW91bnQ6IG51bWJlcik6IHtcblx0XHR1dHhvSWRzOiBzdHJpbmdbXTtcblx0XHR1dHhvczogVW5zcGVudE91dHB1dFtdLFxuXHRcdG1hc3M6IG51bWJlclxuXHR9IHtcblx0XHRjb25zdCB1dHhvczogVW5zcGVudE91dHB1dFtdID0gW107XG5cdFx0Y29uc3QgdXR4b0lkczogc3RyaW5nW10gPSBbXTtcblx0XHRsZXQgdG90YWxWYWwgPSAwO1xuXHRcdGxldCBsaXN0ID0gWy4uLnRoaXMudXR4b3MuY29uZmlybWVkLnZhbHVlcygpXTtcblxuXHRcdGxpc3QgPSBsaXN0LmZpbHRlcigodXR4bykgPT4ge1xuXHRcdFx0cmV0dXJuICF0aGlzLmluVXNlLmluY2x1ZGVzKHV0eG8uaWQpO1xuXHRcdH0pO1xuXG5cdFx0bGlzdC5zb3J0KChhOiBVbnNwZW50T3V0cHV0LCBiOiBVbnNwZW50T3V0cHV0KTogbnVtYmVyID0+IHtcblx0XHRcdHJldHVybiBhLmJsb2NrRGFhU2NvcmUgLSBiLmJsb2NrRGFhU2NvcmUgfHwgYi5zYXRvc2hpcyAtIGEuc2F0b3NoaXMgfHwgYS50eElkLmxvY2FsZUNvbXBhcmUoYi50eElkKSB8fCBhLm91dHB1dEluZGV4IC0gYi5vdXRwdXRJbmRleDtcblx0XHR9KVxuXHRcdGxldCBtYXNzID0gMDtcblx0XHRmb3IgKGNvbnN0IHV0eG8gb2YgbGlzdCkge1xuXHRcdFx0Ly9jb25zb2xlLmxvZyhcImluZm9cIixgVVRYTyBJRDogJHt1dHhvSWR9ICAsIFVUWE86ICR7dXR4b31gKTtcblx0XHRcdC8vaWYgKCF0aGlzLmluVXNlLmluY2x1ZGVzKHV0eG9JZCkpIHtcblx0XHRcdFx0dXR4b0lkcy5wdXNoKHV0eG8uaWQpO1xuXHRcdFx0XHR1dHhvcy5wdXNoKHV0eG8pO1xuXHRcdFx0XHRtYXNzICs9IHV0eG8ubWFzcztcblx0XHRcdFx0dG90YWxWYWwgKz0gdXR4by5zYXRvc2hpcztcblx0XHRcdC8vfVxuXHRcdFx0aWYgKHRvdGFsVmFsID49IHR4QW1vdW50KSBicmVhaztcblx0XHR9XG5cdFx0aWYgKHRvdGFsVmFsIDwgdHhBbW91bnQpXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEluc3VmZmljaWVudCBiYWxhbmNlIC0gbmVlZDogJHtLQVModHhBbW91bnQpfSBLT0RBLCBhdmFpbGFibGU6ICR7S0FTKHRvdGFsVmFsKX0gS09EQWApO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHV0eG9JZHMsXG5cdFx0XHR1dHhvcyxcblx0XHRcdG1hc3Ncblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIE5haXZlbHkgY29sbGVjdCBVVFhPcy5cblx0ICogQHBhcmFtIG1heENvdW50IFByb3ZpZGUgdGhlIG1heCBVVFhPcyBjb3VudC5cblx0ICovXG5cdGNvbGxlY3RVdHhvcyhtYXhDb3VudDogbnVtYmVyID0gMTAwMDApOiB7XG5cdFx0dXR4b0lkczogc3RyaW5nW107XG5cdFx0dXR4b3M6IFVuc3BlbnRPdXRwdXRbXSxcblx0XHRhbW91bnQ6IG51bWJlcixcblx0XHRtYXNzOiBudW1iZXJcblx0fSB7XG5cdFx0Y29uc3QgdXR4b3M6IFVuc3BlbnRPdXRwdXRbXSA9IFtdO1xuXHRcdGNvbnN0IHV0eG9JZHM6IHN0cmluZ1tdID0gW107XG5cdFx0bGV0IHRvdGFsVmFsID0gMDtcblx0XHRsZXQgbGlzdCA9IFsuLi50aGlzLnV0eG9zLmNvbmZpcm1lZC52YWx1ZXMoKV07XG5cblx0XHRsaXN0ID0gbGlzdC5maWx0ZXIoKHV0eG8pID0+IHtcblx0XHRcdHJldHVybiAhdGhpcy5pblVzZS5pbmNsdWRlcyh1dHhvLmlkKTtcblx0XHR9KTtcblxuXHRcdGxpc3Quc29ydCgoYTogVW5zcGVudE91dHB1dCwgYjogVW5zcGVudE91dHB1dCk6IG51bWJlciA9PiB7XG5cdFx0XHRyZXR1cm4gYS5ibG9ja0RhYVNjb3JlIC0gYi5ibG9ja0RhYVNjb3JlIHx8IGIuc2F0b3NoaXMgLSBhLnNhdG9zaGlzIHx8IGEudHhJZC5sb2NhbGVDb21wYXJlKGIudHhJZCkgfHwgYS5vdXRwdXRJbmRleCAtIGIub3V0cHV0SW5kZXg7XG5cdFx0fSlcblx0XHRsZXQgbWF4TWFzcyA9IFdhbGxldC5NYXhNYXNzVVRYT3M7XG5cdFx0XG5cdFx0bGV0IG1hc3MgPSAwO1xuXHRcdGZvciAoY29uc3QgdXR4byBvZiBsaXN0KSB7XG5cdFx0XHRpZiAodXR4b3MubGVuZ3RoID49IG1heENvdW50IHx8IG1hc3MrdXR4by5tYXNzID49IG1heE1hc3MpXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0dXR4b0lkcy5wdXNoKHV0eG8uaWQpO1xuXHRcdFx0dXR4b3MucHVzaCh1dHhvKTtcblx0XHRcdHRvdGFsVmFsICs9IHV0eG8uc2F0b3NoaXM7XG5cdFx0XHRtYXNzICs9IHV0eG8ubWFzcztcblx0XHR9XG5cdFx0Ly9jb25zb2xlLmxvZyhcIm1heE1hc3M6XCIrbWF4TWFzcywgXCJtYXNzOlwiK21hc3MpXG5cdFx0cmV0dXJuIHtcblx0XHRcdHV0eG9JZHMsXG5cdFx0XHR1dHhvcyxcblx0XHRcdGFtb3VudDogdG90YWxWYWwsXG5cdFx0XHRtYXNzXG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIHN5bmNBZGRyZXNzZXNVdHhvcyhhZGRyZXNzZXM6IHN0cmluZ1tdKSB7XG5cdFx0Y29uc3QgbmV3QWRkcmVzc2VzID0gYWRkcmVzc2VzLm1hcChhZGRyZXNzID0+IHtcblx0XHRcdGlmICh0aGlzLmFkZHJlc3Nlc1V0eG9TeW5jU3RhdHVzZXMuaGFzKGFkZHJlc3MpKVxuXHRcdFx0XHRyZXR1cm5cblx0XHRcdHRoaXMuYWRkcmVzc2VzVXR4b1N5bmNTdGF0dXNlcy5zZXQoYWRkcmVzcywgZmFsc2UpO1xuXHRcdFx0cmV0dXJuIGFkZHJlc3M7XG5cdFx0fSkuZmlsdGVyKGFkZHJlc3MgPT4gYWRkcmVzcykgYXMgc3RyaW5nW107XG5cblx0XHQvL2luIHN5bmMgcHJvY2VzcyBhZGRyZXNzRGlzY292ZXJ5IGNhbGxzIGZpbmRVdHhvc1xuXHRcdGlmICghbmV3QWRkcmVzc2VzLmxlbmd0aCB8fCAodGhpcy53YWxsZXQuc3luY0luUHJvZ2dyZXNzICYmICF0aGlzLndhbGxldC5vcHRpb25zLmRpc2FibGVBZGRyZXNzRGVyaXZhdGlvbikpXG5cdFx0XHRyZXR1cm5cblxuXHRcdGF3YWl0IHRoaXMud2FsbGV0LmZpbmRVdHhvcyhuZXdBZGRyZXNzZXMpO1xuXG5cdFx0aWYoIXRoaXMud2FsbGV0LnN5bmNPbmNlKVxuXHRcdFx0YXdhaXQgdGhpcy51dHhvU3Vic2NyaWJlKCk7XG5cdH1cblxuXHRhc3luYyB1dHhvU3Vic2NyaWJlKCk6IFByb21pc2UgPCBzdHJpbmdbXSA+IHtcblx0XHRsZXQgYWRkcmVzc2VzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdHRoaXMuYWRkcmVzc2VzVXR4b1N5bmNTdGF0dXNlcy5mb3JFYWNoKChzZW50LCBhZGRyZXNzKSA9PiB7XG5cdFx0XHQvL2lmKHNlbnQpXG5cdFx0XHQvLyAgcmV0dXJuXG5cblx0XHRcdC8vICAhISFGSVhNRSBwcmV2ZW50IG11bHRpcGxlIGFkZHJlc3Mgc3Vic2NyaXB0aW9uc1xuXHRcdFx0Ly9pZighdGhpcy5hZGRyZXNzZXNVdHhvU3luY1N0YXR1c2VzLmdldChhZGRyZXNzKSkge1xuXHRcdFx0Ly90aGlzLmFkZHJlc3Nlc1V0eG9TeW5jU3RhdHVzZXMuc2V0KGFkZHJlc3MsIHRydWUpO1xuXHRcdFx0YWRkcmVzc2VzLnB1c2goYWRkcmVzcyk7XG5cdFx0XHQvL31cblx0XHR9KTtcblxuXHRcdGlmICghYWRkcmVzc2VzLmxlbmd0aClcblx0XHRcdHJldHVybiBhZGRyZXNzZXM7XG5cdFx0Ly9jb25zb2xlLmxvZyhgWyR7dGhpcy53YWxsZXQubmV0d29ya31dICEhISArKysrKysrKysrKysrKysgU1VCU0NSSUJJTkcgVE8gQUREUkVTU0VTIDopXFxuYCxhZGRyZXNzZXMpO1xuXHRcdGxldCB1dHhvQ2hhbmdlZFJlcyA9IGF3YWl0IHRoaXMud2FsbGV0LmFwaS5zdWJzY3JpYmVVdHhvc0NoYW5nZWQoYWRkcmVzc2VzLCB0aGlzLm9uVXR4b3NDaGFuZ2VkLmJpbmQodGhpcykpXG5cdFx0XHQuY2F0Y2goKGVycm9yOiBSUEMuRXJyb3IpID0+IHtcblx0XHRcdFx0Y29uc29sZS5sb2coYFske3RoaXMud2FsbGV0Lm5ldHdvcmt9XSBSUEMgRVJST1IgaW4gdXh0b1N5bmMhIHdoaWxlIHJlZ2lzdGVyaW5nIGFkZHJlc3NlczpgLCBlcnJvciwgYWRkcmVzc2VzKTtcblx0XHRcdFx0YWRkcmVzc2VzLm1hcChhZGRyZXNzID0+IHtcblx0XHRcdFx0XHR0aGlzLmFkZHJlc3Nlc1V0eG9TeW5jU3RhdHVzZXMuc2V0KGFkZHJlc3MsIGZhbHNlKTtcblx0XHRcdFx0fSlcblx0XHRcdH0pXG5cblx0XHQvL2NvbnNvbGUubG9nKFwidXR4b1N5bmM6dXR4b0NoYW5nZWRSZXM6XCIsIHV0eG9DaGFuZ2VkUmVzLCBcIlxcbiB1dHhvU3luYyBhZGRyZXNzZXM6XCIsIGFkZHJlc3Nlcylcblx0XHRyZXR1cm4gYWRkcmVzc2VzO1xuXHR9XG5cblx0b25VdHhvc0NoYW5nZWQoYWRkZWQ6IE1hcCA8IHN0cmluZywgQXBpLlV0eG9bXSA+ICwgcmVtb3ZlZDogTWFwIDwgc3RyaW5nLCBSUEMuT3V0cG9pbnRbXSA+ICkge1xuXHRcdC8vIGNvbnNvbGUubG9nKFwib25VdHhvc0NoYW5nZWQ6cmVzXCIsIGFkZGVkLCByZW1vdmVkKVxuXHRcdGFkZGVkLmZvckVhY2goKHV0eG9zLCBhZGRyZXNzKSA9PiB7XG5cdFx0XHQvL3RoaXMubG9nZ2VyLmxvZygnaW5mbycsIGAke2FkZHJlc3N9OiAke3V0eG9zLmxlbmd0aH0gdXR4b3MgZm91bmQuKz0rPSs9Kz0rPSs9KysrKys9PT09PT09Kz09PSs9PT09Kz09PT0rPT09PStgKTtcblx0XHRcdGlmICghdXR4b3MubGVuZ3RoKVxuXHRcdFx0XHRyZXR1cm5cblxuXHRcdFx0aWYgKCF0aGlzLnV0eG9TdG9yYWdlW2FkZHJlc3NdKSB7XG5cdFx0XHRcdHRoaXMudXR4b1N0b3JhZ2VbYWRkcmVzc10gPSB1dHhvcztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGxldCB0eGlkMlV0eG86IFJlY29yZCA8IHN0cmluZywgQXBpLlV0eG8gPiA9IHt9O1xuXHRcdFx0XHR1dHhvcy5mb3JFYWNoKHV0eG8gPT4ge1xuXHRcdFx0XHRcdHR4aWQyVXR4b1t1dHhvLnRyYW5zYWN0aW9uSWQgKyB1dHhvLmluZGV4XSA9IHV0eG87XG5cdFx0XHRcdH0pXG5cdFx0XHRcdGxldCBvbGRVdHhvcyA9IHRoaXMudXR4b1N0b3JhZ2VbYWRkcmVzc10uZmlsdGVyKHV0eG8gPT4ge1xuXHRcdFx0XHRcdHJldHVybiAhdHhpZDJVdHhvW3V0eG8udHJhbnNhY3Rpb25JZCArIHV0eG8uaW5kZXhdXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLnV0eG9TdG9yYWdlW2FkZHJlc3NdID0gWy4uLm9sZFV0eG9zLCAuLi51dHhvc107XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmFkZCh1dHhvcywgYWRkcmVzcyk7XG5cdFx0fSlcblxuXHRcdHRoaXMud2FsbGV0LnR4U3RvcmUuYWRkRnJvbVVUWE9zKGFkZGVkKTtcblxuXHRcdGxldCB1dHhvSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdHJlbW92ZWQuZm9yRWFjaCgodXR4b3MsIGFkZHJlc3MpID0+IHtcblx0XHRcdGxldCB0eGlkMk91dHBvaW50OiBSZWNvcmQgPCBzdHJpbmcsIFJQQy5PdXRwb2ludCA+ID0ge307XG5cdFx0XHR1dHhvcy5mb3JFYWNoKHV0eG8gPT4ge1xuXHRcdFx0XHR0eGlkMk91dHBvaW50W3V0eG8udHJhbnNhY3Rpb25JZCArIHV0eG8uaW5kZXhdID0gdXR4bztcblx0XHRcdFx0dXR4b0lkcy5wdXNoKHV0eG8udHJhbnNhY3Rpb25JZCArIHV0eG8uaW5kZXgpO1xuXHRcdFx0fSlcblx0XHRcdGlmICghdGhpcy51dHhvU3RvcmFnZVthZGRyZXNzXSlcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHR0aGlzLnV0eG9TdG9yYWdlW2FkZHJlc3NdID0gdGhpcy51dHhvU3RvcmFnZVthZGRyZXNzXS5maWx0ZXIodXR4byA9PiB7XG5cdFx0XHRcdHJldHVybiAhdHhpZDJPdXRwb2ludFt1dHhvLnRyYW5zYWN0aW9uSWQgKyB1dHhvLmluZGV4XVxuXHRcdFx0fSk7XG5cdFx0fSlcblxuXHRcdGlmICh1dHhvSWRzLmxlbmd0aClcblx0XHRcdHRoaXMucmVtb3ZlKHV0eG9JZHMpO1xuXG5cdFx0Y29uc3QgaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIgPVxuXHRcdFx0dGhpcy51dHhvU3RvcmFnZVt0aGlzLndhbGxldC5yZWNlaXZlQWRkcmVzc10gIT09IHVuZGVmaW5lZDtcblx0XHRpZiAoaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIpXG5cdFx0XHR0aGlzLndhbGxldC5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5uZXh0KCk7XG5cblx0XHQvL3RoaXMudXBkYXRlVXR4b0JhbGFuY2UoKTtcblx0XHR0aGlzLndhbGxldC5lbWl0KFwidXR4by1jaGFuZ2VcIiwge2FkZGVkLCByZW1vdmVkfSk7XG5cdH1cblxuXHRpc091cih1dHhvOlVuc3BlbnRPdXRwdXQpOiBib29sZWFue1xuXHRcdHJldHVybiAoISF0aGlzLndhbGxldC50cmFuc2FjdGlvbnNbdXR4by50eElkXSkgfHwgdGhpcy5pc091ckNoYW5nZSh1dHhvKVxuXHR9XG5cblx0aXNPdXJDaGFuZ2UodXR4bzpVbnNwZW50T3V0cHV0KTpib29sZWFue1xuXHRcdHJldHVybiB0aGlzLndhbGxldC5hZGRyZXNzTWFuYWdlci5pc091ckNoYW5nZShTdHJpbmcodXR4by5hZGRyZXNzKSlcblx0fVxuXHRnZXQgY291bnQoKTpudW1iZXJ7XG5cdFx0cmV0dXJuIHRoaXMudXR4b3MuY29uZmlybWVkLnNpemUgKyB0aGlzLnV0eG9zLnBlbmRpbmcuc2l6ZTtcblx0fVxuXG5cdGdldCBjb25maXJtZWRDb3VudCgpOm51bWJlcntcblx0XHRyZXR1cm4gdGhpcy51dHhvcy5jb25maXJtZWQuc2l6ZVxuXHR9XG59XG4iXX0=