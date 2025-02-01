"use strict";
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
exports.TXStore = exports.internalNames = void 0;
const indexed_db_1 = require("./indexed-db");
const API_BASE = "https://api.kaspa.org/";
exports.internalNames = {
    mainnet: "default",
    kobra: "default",
    testnet: "testnet",
    kobratest: "testnet",
    kobrasim: "simnet",
    kobradev: "devnet",
    kobrareg: "kobrareg"
};
class TXStore {
    constructor(wallet) {
        this.store = new Map();
        this.txToEmitList = [];
        this.updatedTxToEmitList = [];
        this.pendingUpdate = [];
        this.updateTxTimeoutId = null;
        this.emitTxTimeoutId = null;
        this.emitUpdateTxTimeoutId = null;
        this.updatingTransactionsInprogress = false;
        this.transactionUpdating = false;
        this.wallet = wallet;
        let { uid, network } = wallet;
        let sNetwork = exports.internalNames[network] || network;
        //this.restore();
        if (typeof indexedDB != "undefined")
            this.idb = new indexed_db_1.iDB({ storeName: "tx", dbName: "kaspa_" + uid + "_" + sNetwork });
    }
    add(tx, skipSave = false) {
        //console.log("idb add:tx:", "ts:"+tx.ts, "skipSave:"+skipSave, tx)
        if (this.store.has(tx.id))
            return false;
        this.store.set(tx.id, tx);
        this.emitTx(tx);
        if (this.store.size > TXStore.MAX)
            this.store = new Map([...this.store.entries()].slice(-TXStore.MAX));
        if (!skipSave)
            this.save(tx);
        return true;
    }
    removePendingUTXO(utxo, address = '') {
        let id = utxo.transactionId + ":" + utxo.index;
        let dbItem = this.store.get(id);
        if (dbItem) {
            dbItem.isMoved = true;
            this.store.set(id, dbItem);
            this.save(dbItem);
        }
        else {
            dbItem = {
                in: true,
                ts: Date.now(),
                id,
                amount: utxo.amount,
                address,
                blueScore: utxo.blockDaaScore,
                tx: false, //TODO
                isMoved: true,
                isCoinbase: false
            };
        }
        this.emitTx(dbItem);
    }
    fetchTransactions(txIds) {
        return fetch(`${API_BASE}transactions/search?fields=transaction_id%2Cblock_time`, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'content-type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify({ "transactionIds": txIds })
        })
            .catch(err => {
            this.wallet.logger.debug("ExplorerAPI transactions/search : error", err);
        })
            .then((response) => {
            this.wallet.logger.debug("ExplorerAPI transactions/search, txIds:", txIds, "Response:", response);
            if (response) {
                return response.json();
            }
        })
            .then(data => {
            this.wallet.logger.debug("ExplorerAPI transactions/search, data:", data);
            if (Array.isArray(data))
                return data;
            return [];
        });
    }
    fetchTxTime(txIds) {
        return __awaiter(this, void 0, void 0, function* () {
            let txs = yield this.fetchTransactions(txIds);
            //this.wallet.logger.info("fetchTransactions: result", txs);
            let txid2time = {};
            if (Array.isArray(txs)) {
                txs.forEach(tx => {
                    txid2time[tx.transaction_id] = tx.block_time;
                });
            }
            return txid2time;
        });
    }
    addAddressUTXOs(address, utxos, ts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!utxos.length || this.wallet.addressManager.isOurChange(address))
                return;
            utxos.forEach(utxo => {
                let item = {
                    in: true,
                    ts: ts || Date.now(),
                    id: utxo.transactionId + ":" + utxo.index,
                    amount: utxo.amount,
                    address,
                    blueScore: utxo.blockDaaScore,
                    isCoinbase: utxo.isCoinbase,
                    tx: false //TODO
                };
                this.add(item);
            });
        });
    }
    addFromUTXOs(list) {
        let ts = Date.now();
        list.forEach((utxos, address) => {
            this.addAddressUTXOs(address, utxos, ts);
        });
    }
    save(tx) {
        var _a;
        if (this.wallet.options.updateTxTimes) {
            this.updateTransactionTime(tx.id);
        }
        if (typeof indexedDB != "undefined") {
            (_a = this.idb) === null || _a === void 0 ? void 0 : _a.set(tx.id, JSON.stringify(tx));
        }
    }
    updateTransactionTime(id) {
        this.wallet.logger.debug("updateTransactionTime", id);
        this.pendingUpdate.push(id);
        if (this.updateTxTimeoutId) {
            clearTimeout(this.updateTxTimeoutId);
        }
        if (this.pendingUpdate.length > 500) {
            this.updateTransactionTimeImpl();
        }
        else {
            this.updateTxTimeoutId = setTimeout(() => {
                this.updateTransactionTimeImpl();
            }, 10000);
        }
    }
    emitTx(tx) {
        if (this.wallet.syncSignal && !this.wallet.syncInProggress) {
            if (tx.isMoved) {
                this.wallet.emit("moved-transaction", tx);
            }
            else {
                this.wallet.emit("new-transaction", tx);
            }
            return;
        }
        if (this.emitTxTimeoutId) {
            clearTimeout(this.emitTxTimeoutId);
        }
        this.txToEmitList.push(tx);
        if (this.txToEmitList.length > 500) {
            this.emitTxs();
        }
        else {
            this.emitTxTimeoutId = setTimeout(() => {
                this.emitTxs();
            }, 3000);
        }
    }
    emitTxs() {
        let list = this.txToEmitList;
        this.txToEmitList = [];
        this.wallet.emit("transactions", list);
    }
    emitUpdateTx(tx) {
        this.updatedTxToEmitList.push(tx);
        if (this.emitUpdateTxTimeoutId) {
            clearTimeout(this.emitUpdateTxTimeoutId);
        }
        if (this.updatedTxToEmitList.length > 500) {
            this.emitUpdateTxImpl();
        }
        else {
            this.emitUpdateTxTimeoutId = setTimeout(() => {
                this.emitUpdateTxImpl();
            }, 3000);
        }
    }
    emitUpdateTxImpl() {
        let list = this.updatedTxToEmitList;
        this.updatedTxToEmitList = [];
        this.wallet.emit("update-transactions", list);
    }
    startUpdatingTransactions() {
        return __awaiter(this, arguments, void 0, function* (version = undefined) {
            this.wallet.logger.info("startUpdatingTransactions:", this.updatingTransactionsInprogress);
            if (this.updatingTransactionsInprogress) {
                this.wallet.emit("transactions-update-status", { status: "in-progress" });
                return false;
            }
            let { txWithMissingVersion: ids } = yield this.getDBEntries(version);
            if (ids.length) {
                this.updatingTransactionsInprogress = true;
                this.wallet.emit("transactions-update-status", { status: "started" });
                yield this.updateTransactionTimeImpl(ids, true, () => {
                    this.updatingTransactionsInprogress = false;
                    this.wallet.emit("transactions-update-status", { status: "finished" });
                });
            }
            else {
                this.wallet.emit("transactions-update-status", { status: "finished", total: 0, updated: 0 });
            }
            return true;
        });
    }
    updateTransactionTimeImpl() {
        return __awaiter(this, arguments, void 0, function* (txIdList = null, notify = false, callback = null) {
            if (this.transactionUpdating) {
                setTimeout(() => {
                    this.updateTransactionTimeImpl(txIdList, notify, callback);
                }, 2000);
                return;
            }
            this.transactionUpdating = true;
            let ids = txIdList || this.pendingUpdate;
            let total = 0;
            this.pendingUpdate = [];
            this.wallet.logger.debug("updateTransactionTimeImpl:", ids);
            const CHUNK_SIZE = 500;
            let chunks = [];
            let txIds = [];
            let txId2Id = {};
            ids.map(id => {
                let txId = id.split(":")[0];
                if (!txId2Id[txId]) {
                    txId2Id[txId] = [];
                    txIds.push(txId);
                    total++;
                    if (txIds.length == CHUNK_SIZE) {
                        chunks.push(txIds);
                        txIds = [];
                    }
                }
                txId2Id[txId].push(id);
            });
            if (notify) {
                this.wallet.emit("transactions-update-status", {
                    status: "progress",
                    total,
                    updated: 0
                });
            }
            if (txIds.length) {
                chunks.push(txIds);
            }
            const updateTx = (id_1, ...args_1) => __awaiter(this, [id_1, ...args_1], void 0, function* (id, ts = 0) {
                let tx = null;
                if (this.idb) {
                    let txStr = yield this.idb.get(id);
                    try {
                        tx = JSON.parse(txStr);
                    }
                    catch (e) {
                        tx = {};
                    }
                }
                tx = tx || {};
                if (ts) {
                    tx.ts = ts;
                    tx.version = 2;
                }
                else {
                    tx.version = 1;
                }
                if (tx.id == id && this.idb) {
                    this.idb.set(id, JSON.stringify(tx));
                }
                tx.id = id;
                this.emitUpdateTx(tx);
                this.wallet.logger.debug("updateTransactionTimeImpl: tx updated", id, "ts:", ts, tx);
            });
            let updatedCount = 0;
            let fetch_txs = () => __awaiter(this, void 0, void 0, function* () {
                let txIds = chunks.shift();
                //this.wallet.logger.info("updateTransactionTimeImpl: fetch_txs", txIds);
                if (!txIds) {
                    this.transactionUpdating = false;
                    callback === null || callback === void 0 ? void 0 : callback();
                    return;
                }
                let count = txIds.length;
                let txId2time = yield this.fetchTxTime(txIds);
                //this.wallet.logger.info("updateTransactionTimeImpl: txId2time", txId2time);
                Object.keys(txId2time).forEach(txId => {
                    let ts = txId2time[txId];
                    let index = txIds.indexOf(txId);
                    if (index > -1) {
                        txIds.splice(index, 1);
                    }
                    txId2Id[txId].forEach((id) => __awaiter(this, void 0, void 0, function* () {
                        yield updateTx(id, ts);
                    }));
                });
                //txs which failed to fetch
                if (this.idb) {
                    txIds.map(txId => {
                        txId2Id[txId].forEach((id) => __awaiter(this, void 0, void 0, function* () {
                            yield updateTx(id);
                        }));
                    });
                }
                updatedCount += count;
                if (notify) {
                    this.wallet.emit("transactions-update-status", {
                        status: "progress",
                        total,
                        updated: updatedCount
                    });
                }
                setTimeout(fetch_txs, 2000);
            });
            setTimeout(fetch_txs, 1000);
        });
    }
    getDBEntries() {
        return __awaiter(this, arguments, void 0, function* (version = undefined) {
            if (!this.idb) {
                return {
                    list: [],
                    txWithMissingVersion: []
                };
            }
            let entries = (yield this.idb.entries().catch((err) => {
                console.log("tx-store: entries():error", err);
            })) || [];
            let length = entries.length;
            console.log("tx-entries length:", length);
            let list = [];
            let ids = [];
            for (let i = 0; i < length; i++) {
                let [key, txStr] = entries[i];
                if (!txStr)
                    continue;
                try {
                    let tx = JSON.parse(txStr);
                    if (tx.version === undefined || (version && tx.version != version)) {
                        ids.push(tx.id);
                    }
                    list.push(tx);
                }
                catch (e) {
                    this.wallet.logger.error("LS-TX parse error - 104:", txStr, e);
                }
            }
            return {
                list,
                txWithMissingVersion: ids
            };
        });
    }
    restore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.idb) {
                let { list } = yield this.getDBEntries();
                list.sort((a, b) => {
                    return a.ts - b.ts;
                }).map(o => {
                    this.add(o, true);
                });
            }
        });
    }
}
exports.TXStore = TXStore;
TXStore.MAX = 20000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHgtc3RvcmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi93YWxsZXQvdHgtc3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQ0EsNkNBQWlDO0FBR2pDLE1BQU0sUUFBUSxHQUFHLHdCQUF3QixDQUFDO0FBc0I3QixRQUFBLGFBQWEsR0FBRztJQUM1QixPQUFPLEVBQUcsU0FBUztJQUNuQixLQUFLLEVBQUUsU0FBUztJQUNoQixPQUFPLEVBQUcsU0FBUztJQUNuQixTQUFTLEVBQUUsU0FBUztJQUNwQixRQUFRLEVBQUUsUUFBUTtJQUNsQixRQUFRLEVBQUUsUUFBUTtJQUNYLFFBQVEsRUFBRSxVQUFVO0NBQzNCLENBQUE7QUFFRCxNQUFhLE9BQU87SUFTbkIsWUFBWSxNQUFhO1FBTHpCLFVBQUssR0FBNEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUMzQyxpQkFBWSxHQUFpQixFQUFFLENBQUM7UUFDaEMsd0JBQW1CLEdBQWlCLEVBQUUsQ0FBQztRQXFIdkMsa0JBQWEsR0FBWSxFQUFFLENBQUM7UUFDNUIsc0JBQWlCLEdBQXVCLElBQUksQ0FBQztRQStDN0Msb0JBQWUsR0FBdUIsSUFBSSxDQUFDO1FBQzNDLDBCQUFxQixHQUF1QixJQUFJLENBQUM7UUFzQmpELG1DQUE4QixHQUFXLEtBQUssQ0FBQztRQXNCL0Msd0JBQW1CLEdBQVcsS0FBSyxDQUFDO1FBOU1uQyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLEVBQUMsR0FBRyxFQUFFLE9BQU8sRUFBQyxHQUFHLE1BQU0sQ0FBQztRQUM1QixJQUFJLFFBQVEsR0FBVSxxQkFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFFLE9BQU8sQ0FBQztRQUN0RCxpQkFBaUI7UUFDakIsSUFBRyxPQUFPLFNBQVMsSUFBSSxXQUFXO1lBQ2pDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxnQkFBRyxDQUFDLEVBQUMsU0FBUyxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsUUFBUSxHQUFDLEdBQUcsR0FBQyxHQUFHLEdBQUMsUUFBUSxFQUFDLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRUQsR0FBRyxDQUFDLEVBQWMsRUFBRSxRQUFRLEdBQUMsS0FBSztRQUNqQyxtRUFBbUU7UUFDbkUsSUFBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sS0FBSyxDQUFDO1FBQ2QsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxQixJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2hCLElBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLEdBQUc7WUFDL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLElBQUcsQ0FBQyxRQUFRO1lBQ1gsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNmLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUNELGlCQUFpQixDQUFDLElBQWEsRUFBRSxVQUFlLEVBQUU7UUFDakQsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLGFBQWEsR0FBQyxHQUFHLEdBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUMzQyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNoQyxJQUFHLE1BQU0sRUFBQyxDQUFDO1lBQ1YsTUFBTSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7WUFDdEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkIsQ0FBQzthQUFJLENBQUM7WUFDTCxNQUFNLEdBQUc7Z0JBQ1IsRUFBRSxFQUFFLElBQUk7Z0JBQ1IsRUFBRSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQ2QsRUFBRTtnQkFDRixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07Z0JBQ25CLE9BQU87Z0JBQ1AsU0FBUyxFQUFDLElBQUksQ0FBQyxhQUFhO2dCQUM1QixFQUFFLEVBQUMsS0FBSyxFQUFDLE1BQU07Z0JBQ2YsT0FBTyxFQUFDLElBQUk7Z0JBQ1osVUFBVSxFQUFDLEtBQUs7YUFDaEIsQ0FBQztRQUNILENBQUM7UUFDRCxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3JCLENBQUM7SUFDRCxpQkFBaUIsQ0FBQyxLQUFjO1FBQy9CLE9BQU8sS0FBSyxDQUFDLEdBQUcsUUFBUSx3REFBd0QsRUFBRTtZQUNoRixPQUFPLEVBQUU7Z0JBQ1IsNkJBQTZCLEVBQUUsR0FBRztnQkFDbEMsY0FBYyxFQUFFLGtCQUFrQjthQUNsQztZQUNELE1BQU0sRUFBRSxNQUFNO1lBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsQ0FBQztTQUNqRCxDQUFDO2FBQ0QsS0FBSyxDQUFDLEdBQUcsQ0FBQSxFQUFFO1lBQ1gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLHlDQUF5QyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzFFLENBQUMsQ0FBQzthQUNELElBQUksQ0FBQyxDQUFDLFFBQXNCLEVBQUUsRUFBRTtZQUNoQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMseUNBQXlDLEVBQUUsS0FBSyxFQUFHLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNuRyxJQUFJLFFBQVEsRUFBQyxDQUFDO2dCQUNiLE9BQU8sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFBO1lBQ3ZCLENBQUM7UUFDRixDQUFDLENBQUM7YUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDWixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsd0NBQXdDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztnQkFDdEIsT0FBTyxJQUFJLENBQUE7WUFDWixPQUFPLEVBQUUsQ0FBQztRQUNYLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNLLFdBQVcsQ0FBQyxLQUFjOztZQUMvQixJQUFJLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM5Qyw0REFBNEQ7WUFDNUQsSUFBSSxTQUFTLEdBQTBCLEVBQUUsQ0FBQztZQUMxQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQztnQkFDdkIsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUEsRUFBRTtvQkFDZixTQUFTLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUM7Z0JBQzlDLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQztZQUVELE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7S0FBQTtJQUNLLGVBQWUsQ0FBQyxPQUFjLEVBQUUsS0FBZ0IsRUFBRSxFQUFVOztZQUNqRSxJQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDO2dCQUNsRSxPQUFNO1lBRVAsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUEsRUFBRTtnQkFDbkIsSUFBSSxJQUFJLEdBQUc7b0JBQ1YsRUFBRSxFQUFFLElBQUk7b0JBQ1IsRUFBRSxFQUFFLEVBQUUsSUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO29CQUNsQixFQUFFLEVBQUUsSUFBSSxDQUFDLGFBQWEsR0FBQyxHQUFHLEdBQUMsSUFBSSxDQUFDLEtBQUs7b0JBQ3JDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtvQkFDbkIsT0FBTztvQkFDUCxTQUFTLEVBQUMsSUFBSSxDQUFDLGFBQWE7b0JBQzVCLFVBQVUsRUFBQyxJQUFJLENBQUMsVUFBVTtvQkFDMUIsRUFBRSxFQUFDLEtBQUssQ0FBQSxNQUFNO2lCQUNkLENBQUM7Z0JBQ0YsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoQixDQUFDLENBQUMsQ0FBQTtRQUNILENBQUM7S0FBQTtJQUNELFlBQVksQ0FBQyxJQUE0QjtRQUN4QyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDcEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUMsRUFBRTtZQUM5QixJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFDekMsQ0FBQyxDQUFDLENBQUE7SUFDSCxDQUFDO0lBRUQsSUFBSSxDQUFDLEVBQWM7O1FBQ2xCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFDLENBQUM7WUFDdEMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNuQyxDQUFDO1FBQ0QsSUFBRyxPQUFPLFNBQVMsSUFBSSxXQUFXLEVBQUMsQ0FBQztZQUNuQyxNQUFBLElBQUksQ0FBQyxHQUFHLDBDQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtRQUN6QyxDQUFDO0lBQ0YsQ0FBQztJQUlELHFCQUFxQixDQUFDLEVBQVM7UUFDOUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXRELElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzVCLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFDLENBQUM7WUFDM0IsWUFBWSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7UUFFRCxJQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxHQUFHLEdBQUcsRUFBQyxDQUFDO1lBQ25DLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1FBQ2xDLENBQUM7YUFBSSxDQUFDO1lBQ0wsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFVBQVUsQ0FBQyxHQUFFLEVBQUU7Z0JBQ3ZDLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1lBQ2xDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNYLENBQUM7SUFDRixDQUFDO0lBRUQsTUFBTSxDQUFDLEVBQWM7UUFDcEIsSUFBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxFQUFDLENBQUM7WUFDMUQsSUFBRyxFQUFFLENBQUMsT0FBTyxFQUFDLENBQUM7Z0JBQ2QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDM0MsQ0FBQztpQkFBSSxDQUFDO2dCQUNMLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3pDLENBQUM7WUFDRCxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLGVBQWUsRUFBQyxDQUFDO1lBQ3pCLFlBQVksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUVELElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzNCLElBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsR0FBRyxFQUFDLENBQUM7WUFDbEMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2hCLENBQUM7YUFBSSxDQUFDO1lBQ0wsSUFBSSxDQUFDLGVBQWUsR0FBRyxVQUFVLENBQUMsR0FBRSxFQUFFO2dCQUNyQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDaEIsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ1YsQ0FBQztJQUNGLENBQUM7SUFDRCxPQUFPO1FBQ04sSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztRQUM3QixJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUlELFlBQVksQ0FBQyxFQUFjO1FBQzFCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbEMsSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUMsQ0FBQztZQUMvQixZQUFZLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDMUMsQ0FBQztRQUVELElBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sR0FBRyxHQUFHLEVBQUMsQ0FBQztZQUN6QyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN6QixDQUFDO2FBQUksQ0FBQztZQUNMLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxVQUFVLENBQUMsR0FBRSxFQUFFO2dCQUMzQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN6QixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDVixDQUFDO0lBQ0YsQ0FBQztJQUVELGdCQUFnQjtRQUNmLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztRQUNwQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsRUFBRSxDQUFDO1FBQzlCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFHSyx5QkFBeUI7NkRBQUMsVUFBeUIsU0FBUztZQUNqRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsSUFBSSxDQUFDLDhCQUE4QixDQUFDLENBQUM7WUFDM0YsSUFBSSxJQUFJLENBQUMsOEJBQThCLEVBQUMsQ0FBQztnQkFDeEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsRUFBQyxNQUFNLEVBQUMsYUFBYSxFQUFDLENBQUMsQ0FBQztnQkFDdkUsT0FBTyxLQUFLLENBQUE7WUFDYixDQUFDO1lBRUQsSUFBSSxFQUFDLG9CQUFvQixFQUFDLEdBQUcsRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUVsRSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEVBQUMsQ0FBQztnQkFDZixJQUFJLENBQUMsOEJBQThCLEdBQUcsSUFBSSxDQUFDO2dCQUMzQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxFQUFDLE1BQU0sRUFBQyxTQUFTLEVBQUMsQ0FBQyxDQUFDO2dCQUNuRSxNQUFNLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUUsRUFBRTtvQkFDbkQsSUFBSSxDQUFDLDhCQUE4QixHQUFHLEtBQUssQ0FBQztvQkFDNUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsRUFBQyxNQUFNLEVBQUMsVUFBVSxFQUFDLENBQUMsQ0FBQztnQkFDckUsQ0FBQyxDQUFDLENBQUM7WUFDSixDQUFDO2lCQUFJLENBQUM7Z0JBQ0wsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUUsRUFBQyxNQUFNLEVBQUMsVUFBVSxFQUFFLEtBQUssRUFBQyxDQUFDLEVBQUUsT0FBTyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7WUFDekYsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFBO1FBQ1osQ0FBQztLQUFBO0lBRUsseUJBQXlCOzZEQUFDLFdBQXVCLElBQUksRUFBRSxTQUFlLEtBQUssRUFBRSxXQUF1QixJQUFJO1lBQzdHLElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFDLENBQUM7Z0JBQzdCLFVBQVUsQ0FBQyxHQUFFLEVBQUU7b0JBQ2QsSUFBSSxDQUFDLHlCQUF5QixDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQzVELENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDVCxPQUFNO1lBQ1AsQ0FBQztZQUNELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUM7WUFDaEMsSUFBSSxHQUFHLEdBQUcsUUFBUSxJQUFFLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDdkMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO1lBQ2QsSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLDRCQUE0QixFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzVELE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQztZQUN2QixJQUFJLE1BQU0sR0FBYyxFQUFFLENBQUM7WUFFM0IsSUFBSSxLQUFLLEdBQVksRUFBRSxDQUFDO1lBQ3hCLElBQUksT0FBTyxHQUE0QixFQUFFLENBQUM7WUFFMUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUEsRUFBRTtnQkFDWCxJQUFJLElBQUksR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM1QixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFDLENBQUM7b0JBQ25CLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7b0JBQ25CLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2pCLEtBQUssRUFBRSxDQUFDO29CQUNSLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxVQUFVLEVBQUMsQ0FBQzt3QkFDL0IsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDbkIsS0FBSyxHQUFHLEVBQUUsQ0FBQztvQkFDWixDQUFDO2dCQUNGLENBQUM7Z0JBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN4QixDQUFDLENBQUMsQ0FBQTtZQUVGLElBQUksTUFBTSxFQUFDLENBQUM7Z0JBQ1gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUU7b0JBQzlDLE1BQU0sRUFBQyxVQUFVO29CQUNqQixLQUFLO29CQUNMLE9BQU8sRUFBQyxDQUFDO2lCQUNULENBQUMsQ0FBQztZQUNKLENBQUM7WUFFRCxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUMsQ0FBQztnQkFDakIsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNwQixDQUFDO1lBRUQsTUFBTSxRQUFRLEdBQUcsa0JBQThCLEVBQUUsdURBQXpCLEVBQVMsRUFBRSxLQUFVLENBQUM7Z0JBQzdDLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQztnQkFDZCxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUMsQ0FBQztvQkFDYixJQUFJLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUNuQyxJQUFHLENBQUM7d0JBQ0gsRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3hCLENBQUM7b0JBQUEsT0FBTSxDQUFDLEVBQUMsQ0FBQzt3QkFDVCxFQUFFLEdBQUcsRUFBRSxDQUFDO29CQUNULENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxFQUFFLEdBQUcsRUFBRSxJQUFFLEVBQUUsQ0FBQztnQkFFWixJQUFJLEVBQUUsRUFBQyxDQUFDO29CQUNQLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDO29CQUNYLEVBQUUsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO2dCQUNoQixDQUFDO3FCQUFJLENBQUM7b0JBQ0wsRUFBRSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7Z0JBQ2hCLENBQUM7Z0JBRUQsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFDLENBQUM7b0JBQzVCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7Z0JBQ3JDLENBQUM7Z0JBRUQsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7Z0JBRVgsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDdEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3RGLENBQUMsQ0FBQSxDQUFBO1lBQ0QsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO1lBQ3JCLElBQUksU0FBUyxHQUFHLEdBQU8sRUFBRTtnQkFDeEIsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUMzQix5RUFBeUU7Z0JBQ3pFLElBQUksQ0FBQyxLQUFLLEVBQUMsQ0FBQztvQkFDWCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsS0FBSyxDQUFDO29CQUNqQyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLEVBQUksQ0FBQztvQkFDYixPQUFNO2dCQUNQLENBQUM7Z0JBQ0QsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztnQkFDekIsSUFBSSxTQUFTLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM5Qyw2RUFBNkU7Z0JBQzdFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQSxFQUFFO29CQUNwQyxJQUFJLEVBQUUsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3pCLElBQUksS0FBSyxHQUFJLEtBQWtCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUM5QyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBQyxDQUFDO3dCQUNkLEtBQWtCLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDdEMsQ0FBQztvQkFFRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQU0sRUFBRSxFQUFDLEVBQUU7d0JBQ2hDLE1BQU0sUUFBUSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDeEIsQ0FBQyxDQUFBLENBQUMsQ0FBQTtnQkFDSCxDQUFDLENBQUMsQ0FBQztnQkFFSCwyQkFBMkI7Z0JBQzNCLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBQyxDQUFDO29CQUNiLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFBLEVBQUU7d0JBQ2YsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFNLEVBQUUsRUFBQyxFQUFFOzRCQUNoQyxNQUFNLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQzt3QkFDcEIsQ0FBQyxDQUFBLENBQUMsQ0FBQTtvQkFDSCxDQUFDLENBQUMsQ0FBQTtnQkFDSCxDQUFDO2dCQUNELFlBQVksSUFBSSxLQUFLLENBQUM7Z0JBRXRCLElBQUksTUFBTSxFQUFDLENBQUM7b0JBQ1gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLEVBQUU7d0JBQzlDLE1BQU0sRUFBQyxVQUFVO3dCQUNqQixLQUFLO3dCQUNMLE9BQU8sRUFBQyxZQUFZO3FCQUNwQixDQUFDLENBQUM7Z0JBQ0osQ0FBQztnQkFFRCxVQUFVLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFBO1lBQzVCLENBQUMsQ0FBQSxDQUFDO1lBQ0YsVUFBVSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQTtRQUM1QixDQUFDO0tBQUE7SUFFSyxZQUFZOzZEQUFDLFVBQXlCLFNBQVM7WUFDcEQsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUMsQ0FBQztnQkFDZCxPQUFPO29CQUNOLElBQUksRUFBQyxFQUFFO29CQUNQLG9CQUFvQixFQUFDLEVBQUU7aUJBQ3ZCLENBQUE7WUFDRixDQUFDO1lBRUQsSUFBSSxPQUFPLEdBQUcsQ0FBQSxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFDLEVBQUU7Z0JBQ25ELE9BQU8sQ0FBQyxHQUFHLENBQUMsMkJBQTJCLEVBQUUsR0FBRyxDQUFDLENBQUE7WUFDOUMsQ0FBQyxDQUFDLEtBQUUsRUFBRSxDQUFDO1lBQ1AsSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztZQUM1QixPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixFQUFFLE1BQU0sQ0FBQyxDQUFBO1lBQ3pDLElBQUksSUFBSSxHQUFpQixFQUFFLENBQUM7WUFDNUIsSUFBSSxHQUFHLEdBQVksRUFBRSxDQUFDO1lBQ3RCLEtBQUssSUFBSSxDQUFDLEdBQUMsQ0FBQyxFQUFFLENBQUMsR0FBQyxNQUFNLEVBQUMsQ0FBQyxFQUFFLEVBQUMsQ0FBQztnQkFDM0IsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQzdCLElBQUcsQ0FBQyxLQUFLO29CQUNSLFNBQVM7Z0JBQ1YsSUFBRyxDQUFDO29CQUNILElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQzNCLElBQUksRUFBRSxDQUFDLE9BQU8sS0FBSyxTQUFTLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsRUFBQyxDQUFDO3dCQUNuRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDakIsQ0FBQztvQkFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUNmLENBQUM7Z0JBQUEsT0FBTSxDQUFDLEVBQUMsQ0FBQztvQkFDVCxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsMEJBQTBCLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFBO2dCQUMvRCxDQUFDO1lBQ0YsQ0FBQztZQUVELE9BQU87Z0JBQ04sSUFBSTtnQkFDSixvQkFBb0IsRUFBQyxHQUFHO2FBQ3hCLENBQUE7UUFDRixDQUFDO0tBQUE7SUFDSyxPQUFPOztZQUNaLElBQUcsSUFBSSxDQUFDLEdBQUcsRUFBQyxDQUFDO2dCQUNaLElBQUksRUFBQyxJQUFJLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFFdkMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUMsRUFBRTtvQkFDakIsT0FBTyxDQUFDLENBQUMsRUFBRSxHQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUEsRUFBRTtvQkFDVCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtnQkFDbEIsQ0FBQyxDQUFDLENBQUE7WUFDSCxDQUFDO1FBQ0YsQ0FBQztLQUFBOztBQTdYRiwwQkE4WEM7QUE1WE8sV0FBRyxHQUFHLEtBQUssQUFBUixDQUFTIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtXYWxsZXR9IGZyb20gJy4vd2FsbGV0JztcbmltcG9ydCB7aURCfSBmcm9tICcuL2luZGV4ZWQtZGInO1xuaW1wb3J0IHtBcGl9IGZyb20gJ2N1c3RvbS10eXBlcyc7XG5cbmNvbnN0IEFQSV9CQVNFID0gXCJodHRwczovL2FwaS5rYXNwYS5vcmcvXCI7XG5cbmludGVyZmFjZSBBUElUeHtcblx0YmxvY2tfdGltZTpudW1iZXIsXG5cdHRyYW5zYWN0aW9uX2lkOnN0cmluZ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRYU3RvcmVJdGVte1xuXHRpbjpib29sZWFuO1xuXHR0czpudW1iZXI7XG5cdGlkOnN0cmluZztcblx0YW1vdW50Om51bWJlcjtcblx0YWRkcmVzczpzdHJpbmc7XG5cdGJsdWVTY29yZTpudW1iZXI7XG5cdG5vdGU/OnN0cmluZztcblx0dHg/OmFueSxcblx0bXlBZGRyZXNzPzpib29sZWFuLFxuXHRpc0NvaW5iYXNlOmJvb2xlYW4sXG5cdGlzTW92ZWQ/OmJvb2xlYW4sXG5cdHZlcnNpb24/Om51bWJlclxufVxuXG5leHBvcnQgY29uc3QgaW50ZXJuYWxOYW1lcyA9IHtcblx0bWFpbm5ldCA6IFwiZGVmYXVsdFwiLFxuXHRrb2JyYTogXCJkZWZhdWx0XCIsXG5cdHRlc3RuZXQgOiBcInRlc3RuZXRcIixcblx0a29icmF0ZXN0OiBcInRlc3RuZXRcIixcblx0a29icmFzaW06IFwic2ltbmV0XCIsXG5cdGtvYnJhZGV2OiBcImRldm5ldFwiLFxuICAgICAgICBrb2JyYXJlZzogXCJrb2JyYXJlZ1wiXG59XG5cbmV4cG9ydCBjbGFzcyBUWFN0b3Jle1xuXG5cdHN0YXRpYyBNQVggPSAyMDAwMDtcblx0d2FsbGV0OldhbGxldDtcblx0c3RvcmU6TWFwPHN0cmluZywgVFhTdG9yZUl0ZW0+ID0gbmV3IE1hcCgpO1xuXHR0eFRvRW1pdExpc3Q6VFhTdG9yZUl0ZW1bXSA9IFtdO1xuXHR1cGRhdGVkVHhUb0VtaXRMaXN0OlRYU3RvcmVJdGVtW10gPSBbXTtcblx0aWRiOmlEQnx1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3Iod2FsbGV0OldhbGxldCl7XG5cdFx0dGhpcy53YWxsZXQgPSB3YWxsZXQ7XG5cdFx0bGV0IHt1aWQsIG5ldHdvcmt9ID0gd2FsbGV0O1xuXHRcdGxldCBzTmV0d29yazpzdHJpbmcgPSBpbnRlcm5hbE5hbWVzW25ldHdvcmtdfHxuZXR3b3JrO1xuXHRcdC8vdGhpcy5yZXN0b3JlKCk7XG5cdFx0aWYodHlwZW9mIGluZGV4ZWREQiAhPSBcInVuZGVmaW5lZFwiKVxuXHRcdFx0dGhpcy5pZGIgPSBuZXcgaURCKHtzdG9yZU5hbWU6XCJ0eFwiLCBkYk5hbWU6XCJrYXNwYV9cIit1aWQrXCJfXCIrc05ldHdvcmt9KTtcblx0fVxuXG5cdGFkZCh0eDpUWFN0b3JlSXRlbSwgc2tpcFNhdmU9ZmFsc2Upe1xuXHRcdC8vY29uc29sZS5sb2coXCJpZGIgYWRkOnR4OlwiLCBcInRzOlwiK3R4LnRzLCBcInNraXBTYXZlOlwiK3NraXBTYXZlLCB0eClcblx0XHRpZih0aGlzLnN0b3JlLmhhcyh0eC5pZCkpXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0dGhpcy5zdG9yZS5zZXQodHguaWQsIHR4KTtcblx0XHR0aGlzLmVtaXRUeCh0eCk7XG5cdFx0aWYodGhpcy5zdG9yZS5zaXplID4gVFhTdG9yZS5NQVgpXG5cdFx0XHR0aGlzLnN0b3JlID0gbmV3IE1hcChbLi4udGhpcy5zdG9yZS5lbnRyaWVzKCldLnNsaWNlKC1UWFN0b3JlLk1BWCkpO1xuXHRcdGlmKCFza2lwU2F2ZSlcblx0XHRcdHRoaXMuc2F2ZSh0eCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cmVtb3ZlUGVuZGluZ1VUWE8odXR4bzpBcGkuVXR4bywgYWRkcmVzczpzdHJpbmc9Jycpe1xuXHRcdGxldCBpZCA9IHV0eG8udHJhbnNhY3Rpb25JZCtcIjpcIit1dHhvLmluZGV4O1xuXHRcdGxldCBkYkl0ZW0gPSB0aGlzLnN0b3JlLmdldChpZCk7XG5cdFx0aWYoZGJJdGVtKXtcblx0XHRcdGRiSXRlbS5pc01vdmVkID0gdHJ1ZTtcblx0XHRcdHRoaXMuc3RvcmUuc2V0KGlkLCBkYkl0ZW0pO1xuXHRcdFx0dGhpcy5zYXZlKGRiSXRlbSk7XG5cdFx0fWVsc2V7XG5cdFx0XHRkYkl0ZW0gPSB7XG5cdFx0XHRcdGluOiB0cnVlLFxuXHRcdFx0XHR0czogRGF0ZS5ub3coKSxcblx0XHRcdFx0aWQsXG5cdFx0XHRcdGFtb3VudDogdXR4by5hbW91bnQsXG5cdFx0XHRcdGFkZHJlc3MsXG5cdFx0XHRcdGJsdWVTY29yZTp1dHhvLmJsb2NrRGFhU2NvcmUsXG5cdFx0XHRcdHR4OmZhbHNlLC8vVE9ET1xuXHRcdFx0XHRpc01vdmVkOnRydWUsXG5cdFx0XHRcdGlzQ29pbmJhc2U6ZmFsc2Vcblx0XHRcdH07XG5cdFx0fVxuXHRcdHRoaXMuZW1pdFR4KGRiSXRlbSk7XG5cdH1cblx0ZmV0Y2hUcmFuc2FjdGlvbnModHhJZHM6c3RyaW5nW10pOlByb21pc2U8QVBJVHhbXT4ge1xuXHRcdHJldHVybiBmZXRjaChgJHtBUElfQkFTRX10cmFuc2FjdGlvbnMvc2VhcmNoP2ZpZWxkcz10cmFuc2FjdGlvbl9pZCUyQ2Jsb2NrX3RpbWVgLCB7XG5cdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHQnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuXHRcdFx0XHRcdCdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHRcdFx0fSxcblx0XHRcdFx0bWV0aG9kOiBcIlBPU1RcIixcblx0XHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoeyBcInRyYW5zYWN0aW9uSWRzXCI6IHR4SWRzIH0pXG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKGVycj0+e1xuXHRcdFx0XHR0aGlzLndhbGxldC5sb2dnZXIuZGVidWcoXCJFeHBsb3JlckFQSSB0cmFuc2FjdGlvbnMvc2VhcmNoIDogZXJyb3JcIiwgZXJyKTtcblx0XHRcdH0pXG5cdFx0XHQudGhlbigocmVzcG9uc2U6dm9pZHxSZXNwb25zZSkgPT4ge1xuXHRcdFx0XHR0aGlzLndhbGxldC5sb2dnZXIuZGVidWcoXCJFeHBsb3JlckFQSSB0cmFuc2FjdGlvbnMvc2VhcmNoLCB0eElkczpcIiwgdHhJZHMsICBcIlJlc3BvbnNlOlwiLCByZXNwb25zZSk7XG5cdFx0XHRcdGlmIChyZXNwb25zZSl7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3BvbnNlLmpzb24oKVxuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZGF0YSA9PiB7XG5cdFx0XHRcdHRoaXMud2FsbGV0LmxvZ2dlci5kZWJ1ZyhcIkV4cGxvcmVyQVBJIHRyYW5zYWN0aW9ucy9zZWFyY2gsIGRhdGE6XCIsIGRhdGEpO1xuXHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSlcblx0XHRcdFx0XHRyZXR1cm4gZGF0YVxuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9KTtcblx0fVxuXHRhc3luYyBmZXRjaFR4VGltZSh0eElkczpzdHJpbmdbXSk6UHJvbWlzZTxSZWNvcmQ8c3RyaW5nLCBudW1iZXI+Pntcblx0XHRsZXQgdHhzID0gYXdhaXQgdGhpcy5mZXRjaFRyYW5zYWN0aW9ucyh0eElkcyk7XG5cdFx0Ly90aGlzLndhbGxldC5sb2dnZXIuaW5mbyhcImZldGNoVHJhbnNhY3Rpb25zOiByZXN1bHRcIiwgdHhzKTtcblx0XHRsZXQgdHhpZDJ0aW1lOlJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7fTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheSh0eHMpKXtcblx0XHRcdHR4cy5mb3JFYWNoKHR4PT57XG5cdFx0XHRcdHR4aWQydGltZVt0eC50cmFuc2FjdGlvbl9pZF0gPSB0eC5ibG9ja190aW1lO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHR4aWQydGltZTtcblx0fVxuXHRhc3luYyBhZGRBZGRyZXNzVVRYT3MoYWRkcmVzczpzdHJpbmcsIHV0eG9zOkFwaS5VdHhvW10sIHRzPzpudW1iZXIpe1xuXHRcdGlmKCF1dHhvcy5sZW5ndGggfHwgdGhpcy53YWxsZXQuYWRkcmVzc01hbmFnZXIuaXNPdXJDaGFuZ2UoYWRkcmVzcykpXG5cdFx0XHRyZXR1cm5cblxuXHRcdHV0eG9zLmZvckVhY2godXR4bz0+e1xuXHRcdFx0bGV0IGl0ZW0gPSB7XG5cdFx0XHRcdGluOiB0cnVlLFxuXHRcdFx0XHR0czogdHN8fERhdGUubm93KCksXG5cdFx0XHRcdGlkOiB1dHhvLnRyYW5zYWN0aW9uSWQrXCI6XCIrdXR4by5pbmRleCxcblx0XHRcdFx0YW1vdW50OiB1dHhvLmFtb3VudCxcblx0XHRcdFx0YWRkcmVzcyxcblx0XHRcdFx0Ymx1ZVNjb3JlOnV0eG8uYmxvY2tEYWFTY29yZSxcblx0XHRcdFx0aXNDb2luYmFzZTp1dHhvLmlzQ29pbmJhc2UsXG5cdFx0XHRcdHR4OmZhbHNlLy9UT0RPXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5hZGQoaXRlbSk7XG5cdFx0fSlcblx0fVxuXHRhZGRGcm9tVVRYT3MobGlzdDpNYXA8c3RyaW5nLCBBcGkuVXR4b1tdPil7XG5cdFx0bGV0IHRzID0gRGF0ZS5ub3coKTtcblx0XHRsaXN0LmZvckVhY2goKHV0eG9zLCBhZGRyZXNzKT0+e1xuXHRcdFx0dGhpcy5hZGRBZGRyZXNzVVRYT3MoYWRkcmVzcywgdXR4b3MsIHRzKVxuXHRcdH0pXG5cdH1cblxuXHRzYXZlKHR4OlRYU3RvcmVJdGVtKXtcblx0XHRpZiAodGhpcy53YWxsZXQub3B0aW9ucy51cGRhdGVUeFRpbWVzKXtcblx0XHRcdHRoaXMudXBkYXRlVHJhbnNhY3Rpb25UaW1lKHR4LmlkKTtcblx0XHR9XG5cdFx0aWYodHlwZW9mIGluZGV4ZWREQiAhPSBcInVuZGVmaW5lZFwiKXtcblx0XHRcdHRoaXMuaWRiPy5zZXQodHguaWQsIEpTT04uc3RyaW5naWZ5KHR4KSlcblx0XHR9XG5cdH1cblxuXHRwZW5kaW5nVXBkYXRlOnN0cmluZ1tdID0gW107XG5cdHVwZGF0ZVR4VGltZW91dElkOk5vZGVKUy5UaW1lb3V0fG51bGwgPSBudWxsO1xuXHR1cGRhdGVUcmFuc2FjdGlvblRpbWUoaWQ6c3RyaW5nKXtcblx0XHR0aGlzLndhbGxldC5sb2dnZXIuZGVidWcoXCJ1cGRhdGVUcmFuc2FjdGlvblRpbWVcIiwgaWQpO1xuXG5cdFx0dGhpcy5wZW5kaW5nVXBkYXRlLnB1c2goaWQpO1xuXHRcdGlmICh0aGlzLnVwZGF0ZVR4VGltZW91dElkKXtcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLnVwZGF0ZVR4VGltZW91dElkKTtcblx0XHR9XG5cdFxuXHRcdGlmKHRoaXMucGVuZGluZ1VwZGF0ZS5sZW5ndGggPiA1MDApe1xuXHRcdFx0dGhpcy51cGRhdGVUcmFuc2FjdGlvblRpbWVJbXBsKCk7XG5cdFx0fWVsc2V7XG5cdFx0XHR0aGlzLnVwZGF0ZVR4VGltZW91dElkID0gc2V0VGltZW91dCgoKT0+e1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVRyYW5zYWN0aW9uVGltZUltcGwoKTtcblx0XHRcdH0sIDEwMDAwKTtcblx0XHR9XG5cdH1cblxuXHRlbWl0VHgodHg6VFhTdG9yZUl0ZW0pe1xuXHRcdGlmKHRoaXMud2FsbGV0LnN5bmNTaWduYWwgJiYgIXRoaXMud2FsbGV0LnN5bmNJblByb2dncmVzcyl7XG5cdFx0XHRpZih0eC5pc01vdmVkKXtcblx0XHRcdFx0dGhpcy53YWxsZXQuZW1pdChcIm1vdmVkLXRyYW5zYWN0aW9uXCIsIHR4KTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHR0aGlzLndhbGxldC5lbWl0KFwibmV3LXRyYW5zYWN0aW9uXCIsIHR4KTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5lbWl0VHhUaW1lb3V0SWQpe1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuZW1pdFR4VGltZW91dElkKTtcblx0XHR9XG5cblx0XHR0aGlzLnR4VG9FbWl0TGlzdC5wdXNoKHR4KTtcblx0XHRpZih0aGlzLnR4VG9FbWl0TGlzdC5sZW5ndGggPiA1MDApe1xuXHRcdFx0dGhpcy5lbWl0VHhzKCk7XG5cdFx0fWVsc2V7XG5cdFx0XHR0aGlzLmVtaXRUeFRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCk9Pntcblx0XHRcdFx0dGhpcy5lbWl0VHhzKCk7XG5cdFx0XHR9LCAzMDAwKTtcblx0XHR9XG5cdH1cblx0ZW1pdFR4cygpe1xuXHRcdGxldCBsaXN0ID0gdGhpcy50eFRvRW1pdExpc3Q7XG5cdFx0dGhpcy50eFRvRW1pdExpc3QgPSBbXTtcblx0XHR0aGlzLndhbGxldC5lbWl0KFwidHJhbnNhY3Rpb25zXCIsIGxpc3QpO1xuXHR9XG5cblx0ZW1pdFR4VGltZW91dElkOk5vZGVKUy5UaW1lb3V0fG51bGwgPSBudWxsO1xuXHRlbWl0VXBkYXRlVHhUaW1lb3V0SWQ6Tm9kZUpTLlRpbWVvdXR8bnVsbCA9IG51bGw7XG5cdGVtaXRVcGRhdGVUeCh0eDpUWFN0b3JlSXRlbSl7XG5cdFx0dGhpcy51cGRhdGVkVHhUb0VtaXRMaXN0LnB1c2godHgpO1xuXHRcdGlmICh0aGlzLmVtaXRVcGRhdGVUeFRpbWVvdXRJZCl7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5lbWl0VXBkYXRlVHhUaW1lb3V0SWQpO1xuXHRcdH1cblx0XG5cdFx0aWYodGhpcy51cGRhdGVkVHhUb0VtaXRMaXN0Lmxlbmd0aCA+IDUwMCl7XG5cdFx0XHR0aGlzLmVtaXRVcGRhdGVUeEltcGwoKTtcblx0XHR9ZWxzZXtcblx0XHRcdHRoaXMuZW1pdFVwZGF0ZVR4VGltZW91dElkID0gc2V0VGltZW91dCgoKT0+e1xuXHRcdFx0XHR0aGlzLmVtaXRVcGRhdGVUeEltcGwoKTtcblx0XHRcdH0sIDMwMDApO1xuXHRcdH1cblx0fVxuXG5cdGVtaXRVcGRhdGVUeEltcGwoKXtcblx0XHRsZXQgbGlzdCA9IHRoaXMudXBkYXRlZFR4VG9FbWl0TGlzdDtcblx0XHR0aGlzLnVwZGF0ZWRUeFRvRW1pdExpc3QgPSBbXTtcblx0XHR0aGlzLndhbGxldC5lbWl0KFwidXBkYXRlLXRyYW5zYWN0aW9uc1wiLCBsaXN0KTtcblx0fVxuXG5cdHVwZGF0aW5nVHJhbnNhY3Rpb25zSW5wcm9ncmVzczpib29sZWFuID0gZmFsc2U7XG5cdGFzeW5jIHN0YXJ0VXBkYXRpbmdUcmFuc2FjdGlvbnModmVyc2lvbjp1bmRlZmluZWR8bnVtYmVyPXVuZGVmaW5lZCk6UHJvbWlzZTxib29sZWFuPntcblx0XHR0aGlzLndhbGxldC5sb2dnZXIuaW5mbyhcInN0YXJ0VXBkYXRpbmdUcmFuc2FjdGlvbnM6XCIsIHRoaXMudXBkYXRpbmdUcmFuc2FjdGlvbnNJbnByb2dyZXNzKTtcblx0XHRpZiAodGhpcy51cGRhdGluZ1RyYW5zYWN0aW9uc0lucHJvZ3Jlc3Mpe1xuXHRcdFx0dGhpcy53YWxsZXQuZW1pdChcInRyYW5zYWN0aW9ucy11cGRhdGUtc3RhdHVzXCIsIHtzdGF0dXM6XCJpbi1wcm9ncmVzc1wifSk7XG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHR9XG5cdFx0XG5cdFx0bGV0IHt0eFdpdGhNaXNzaW5nVmVyc2lvbjppZHN9ID0gYXdhaXQgdGhpcy5nZXREQkVudHJpZXModmVyc2lvbik7XG5cdFx0XG5cdFx0aWYgKGlkcy5sZW5ndGgpe1xuXHRcdFx0dGhpcy51cGRhdGluZ1RyYW5zYWN0aW9uc0lucHJvZ3Jlc3MgPSB0cnVlO1xuXHRcdFx0dGhpcy53YWxsZXQuZW1pdChcInRyYW5zYWN0aW9ucy11cGRhdGUtc3RhdHVzXCIsIHtzdGF0dXM6XCJzdGFydGVkXCJ9KTtcblx0XHRcdGF3YWl0IHRoaXMudXBkYXRlVHJhbnNhY3Rpb25UaW1lSW1wbChpZHMsIHRydWUsICgpPT57XG5cdFx0XHRcdHRoaXMudXBkYXRpbmdUcmFuc2FjdGlvbnNJbnByb2dyZXNzID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMud2FsbGV0LmVtaXQoXCJ0cmFuc2FjdGlvbnMtdXBkYXRlLXN0YXR1c1wiLCB7c3RhdHVzOlwiZmluaXNoZWRcIn0pO1xuXHRcdFx0fSk7XG5cdFx0fWVsc2V7XG5cdFx0XHR0aGlzLndhbGxldC5lbWl0KFwidHJhbnNhY3Rpb25zLXVwZGF0ZS1zdGF0dXNcIiwge3N0YXR1czpcImZpbmlzaGVkXCIsIHRvdGFsOjAsIHVwZGF0ZWQ6MH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZVxuXHR9XG5cdHRyYW5zYWN0aW9uVXBkYXRpbmc6Ym9vbGVhbiA9IGZhbHNlO1xuXHRhc3luYyB1cGRhdGVUcmFuc2FjdGlvblRpbWVJbXBsKHR4SWRMaXN0OnN0cmluZ1tdfG51bGw9bnVsbCwgbm90aWZ5OmJvb2xlYW49ZmFsc2UsIGNhbGxiYWNrOkZ1bmN0aW9ufG51bGw9bnVsbCl7XG5cdFx0aWYgKHRoaXMudHJhbnNhY3Rpb25VcGRhdGluZyl7XG5cdFx0XHRzZXRUaW1lb3V0KCgpPT57XG5cdFx0XHRcdHRoaXMudXBkYXRlVHJhbnNhY3Rpb25UaW1lSW1wbCh0eElkTGlzdCwgbm90aWZ5LCBjYWxsYmFjayk7XG5cdFx0XHR9LCAyMDAwKTtcblx0XHRcdHJldHVyblxuXHRcdH1cblx0XHR0aGlzLnRyYW5zYWN0aW9uVXBkYXRpbmcgPSB0cnVlO1xuXHRcdGxldCBpZHMgPSB0eElkTGlzdHx8dGhpcy5wZW5kaW5nVXBkYXRlO1xuXHRcdGxldCB0b3RhbCA9IDA7XG5cdFx0dGhpcy5wZW5kaW5nVXBkYXRlID0gW107XG5cdFx0dGhpcy53YWxsZXQubG9nZ2VyLmRlYnVnKFwidXBkYXRlVHJhbnNhY3Rpb25UaW1lSW1wbDpcIiwgaWRzKTtcblx0XHRjb25zdCBDSFVOS19TSVpFID0gNTAwO1xuXHRcdGxldCBjaHVua3M6c3RyaW5nW11bXSA9IFtdO1xuXG5cdFx0bGV0IHR4SWRzOnN0cmluZ1tdID0gW107XG5cdFx0bGV0IHR4SWQySWQ6UmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XG5cblx0XHRpZHMubWFwKGlkPT57XG5cdFx0XHRsZXQgdHhJZCA9IGlkLnNwbGl0KFwiOlwiKVswXTtcblx0XHRcdGlmICghdHhJZDJJZFt0eElkXSl7XG5cdFx0XHRcdHR4SWQySWRbdHhJZF0gPSBbXTtcblx0XHRcdFx0dHhJZHMucHVzaCh0eElkKTtcblx0XHRcdFx0dG90YWwrKztcblx0XHRcdFx0aWYgKHR4SWRzLmxlbmd0aCA9PSBDSFVOS19TSVpFKXtcblx0XHRcdFx0XHRjaHVua3MucHVzaCh0eElkcyk7XG5cdFx0XHRcdFx0dHhJZHMgPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dHhJZDJJZFt0eElkXS5wdXNoKGlkKTtcblx0XHR9KVxuXG5cdFx0aWYgKG5vdGlmeSl7XG5cdFx0XHR0aGlzLndhbGxldC5lbWl0KFwidHJhbnNhY3Rpb25zLXVwZGF0ZS1zdGF0dXNcIiwge1xuXHRcdFx0XHRzdGF0dXM6XCJwcm9ncmVzc1wiLFxuXHRcdFx0XHR0b3RhbCxcblx0XHRcdFx0dXBkYXRlZDowXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAodHhJZHMubGVuZ3RoKXtcblx0XHRcdGNodW5rcy5wdXNoKHR4SWRzKTtcblx0XHR9XG5cblx0XHRjb25zdCB1cGRhdGVUeCA9IGFzeW5jIChpZDpzdHJpbmcsIHRzOm51bWJlcj0wKT0+e1xuXHRcdFx0bGV0IHR4ID0gbnVsbDtcblx0XHRcdGlmICh0aGlzLmlkYil7XG5cdFx0XHRcdGxldCB0eFN0ciA9IGF3YWl0IHRoaXMuaWRiLmdldChpZCk7XG5cdFx0XHRcdHRyeXtcblx0XHRcdFx0XHR0eCA9IEpTT04ucGFyc2UodHhTdHIpO1xuXHRcdFx0XHR9Y2F0Y2goZSl7XG5cdFx0XHRcdFx0dHggPSB7fTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dHggPSB0eHx8e307XG5cdFx0XHRcblx0XHRcdGlmICh0cyl7XG5cdFx0XHRcdHR4LnRzID0gdHM7XG5cdFx0XHRcdHR4LnZlcnNpb24gPSAyO1xuXHRcdFx0fWVsc2V7XG5cdFx0XHRcdHR4LnZlcnNpb24gPSAxO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiAodHguaWQgPT0gaWQgJiYgdGhpcy5pZGIpe1xuXHRcdFx0XHR0aGlzLmlkYi5zZXQoaWQsIEpTT04uc3RyaW5naWZ5KHR4KSlcblx0XHRcdH1cblxuXHRcdFx0dHguaWQgPSBpZDtcblxuXHRcdFx0dGhpcy5lbWl0VXBkYXRlVHgodHgpO1xuXHRcdFx0dGhpcy53YWxsZXQubG9nZ2VyLmRlYnVnKFwidXBkYXRlVHJhbnNhY3Rpb25UaW1lSW1wbDogdHggdXBkYXRlZFwiLCBpZCwgXCJ0czpcIiwgdHMsIHR4KTtcblx0XHR9XG5cdFx0bGV0IHVwZGF0ZWRDb3VudCA9IDA7XG5cdFx0bGV0IGZldGNoX3R4cyA9IGFzeW5jKCk9Pntcblx0XHRcdGxldCB0eElkcyA9IGNodW5rcy5zaGlmdCgpO1xuXHRcdFx0Ly90aGlzLndhbGxldC5sb2dnZXIuaW5mbyhcInVwZGF0ZVRyYW5zYWN0aW9uVGltZUltcGw6IGZldGNoX3R4c1wiLCB0eElkcyk7XG5cdFx0XHRpZiAoIXR4SWRzKXtcblx0XHRcdFx0dGhpcy50cmFuc2FjdGlvblVwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHRcdGNhbGxiYWNrPy4oKTtcblx0XHRcdFx0cmV0dXJuXG5cdFx0XHR9XG5cdFx0XHRsZXQgY291bnQgPSB0eElkcy5sZW5ndGg7XG5cdFx0XHRsZXQgdHhJZDJ0aW1lID0gYXdhaXQgdGhpcy5mZXRjaFR4VGltZSh0eElkcyk7XG5cdFx0XHQvL3RoaXMud2FsbGV0LmxvZ2dlci5pbmZvKFwidXBkYXRlVHJhbnNhY3Rpb25UaW1lSW1wbDogdHhJZDJ0aW1lXCIsIHR4SWQydGltZSk7XG5cdFx0XHRPYmplY3Qua2V5cyh0eElkMnRpbWUpLmZvckVhY2godHhJZD0+e1xuXHRcdFx0XHRsZXQgdHMgPSB0eElkMnRpbWVbdHhJZF07XG5cdFx0XHRcdGxldCBpbmRleCA9ICh0eElkcyBhcyBzdHJpbmdbXSkuaW5kZXhPZih0eElkKTtcblx0XHRcdFx0aWYgKGluZGV4ID4gLTEpe1xuXHRcdFx0XHRcdCh0eElkcyBhcyBzdHJpbmdbXSkuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHR4SWQySWRbdHhJZF0uZm9yRWFjaChhc3luYyhpZCk9Pntcblx0XHRcdFx0XHRhd2FpdCB1cGRhdGVUeChpZCwgdHMpO1xuXHRcdFx0XHR9KVxuXHRcdFx0fSk7XG5cblx0XHRcdC8vdHhzIHdoaWNoIGZhaWxlZCB0byBmZXRjaFxuXHRcdFx0aWYgKHRoaXMuaWRiKXtcblx0XHRcdFx0dHhJZHMubWFwKHR4SWQ9Pntcblx0XHRcdFx0XHR0eElkMklkW3R4SWRdLmZvckVhY2goYXN5bmMoaWQpPT57XG5cdFx0XHRcdFx0XHRhd2FpdCB1cGRhdGVUeChpZCk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0fSlcblx0XHRcdH1cblx0XHRcdHVwZGF0ZWRDb3VudCArPSBjb3VudDtcblxuXHRcdFx0aWYgKG5vdGlmeSl7XG5cdFx0XHRcdHRoaXMud2FsbGV0LmVtaXQoXCJ0cmFuc2FjdGlvbnMtdXBkYXRlLXN0YXR1c1wiLCB7XG5cdFx0XHRcdFx0c3RhdHVzOlwicHJvZ3Jlc3NcIixcblx0XHRcdFx0XHR0b3RhbCxcblx0XHRcdFx0XHR1cGRhdGVkOnVwZGF0ZWRDb3VudFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0c2V0VGltZW91dChmZXRjaF90eHMsIDIwMDApXG5cdFx0fTtcblx0XHRzZXRUaW1lb3V0KGZldGNoX3R4cywgMTAwMClcblx0fVxuXG5cdGFzeW5jIGdldERCRW50cmllcyh2ZXJzaW9uOnVuZGVmaW5lZHxudW1iZXI9dW5kZWZpbmVkKTpQcm9taXNlPHtsaXN0OlRYU3RvcmVJdGVtW10sIHR4V2l0aE1pc3NpbmdWZXJzaW9uOnN0cmluZ1tdfT57XG5cdFx0aWYgKCF0aGlzLmlkYil7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsaXN0OltdLFxuXHRcdFx0XHR0eFdpdGhNaXNzaW5nVmVyc2lvbjpbXVxuXHRcdFx0fVxuXHRcdH1cblx0XG5cdFx0bGV0IGVudHJpZXMgPSBhd2FpdCB0aGlzLmlkYi5lbnRyaWVzKCkuY2F0Y2goKGVycik9Pntcblx0XHRcdGNvbnNvbGUubG9nKFwidHgtc3RvcmU6IGVudHJpZXMoKTplcnJvclwiLCBlcnIpXG5cdFx0fSl8fFtdO1xuXHRcdGxldCBsZW5ndGggPSBlbnRyaWVzLmxlbmd0aDtcblx0XHRjb25zb2xlLmxvZyhcInR4LWVudHJpZXMgbGVuZ3RoOlwiLCBsZW5ndGgpXG5cdFx0bGV0IGxpc3Q6VFhTdG9yZUl0ZW1bXSA9IFtdO1xuXHRcdGxldCBpZHM6c3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGxldCBpPTA7IGk8bGVuZ3RoO2krKyl7XG5cdFx0XHRsZXQgW2tleSwgdHhTdHJdID0gZW50cmllc1tpXVxuXHRcdFx0aWYoIXR4U3RyKVxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdHRyeXtcblx0XHRcdFx0bGV0IHR4ID0gSlNPTi5wYXJzZSh0eFN0cik7XG5cdFx0XHRcdGlmICh0eC52ZXJzaW9uID09PSB1bmRlZmluZWQgfHwgKHZlcnNpb24gJiYgdHgudmVyc2lvbiAhPSB2ZXJzaW9uKSl7XG5cdFx0XHRcdFx0aWRzLnB1c2godHguaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxpc3QucHVzaCh0eCk7XG5cdFx0XHR9Y2F0Y2goZSl7XG5cdFx0XHRcdHRoaXMud2FsbGV0LmxvZ2dlci5lcnJvcihcIkxTLVRYIHBhcnNlIGVycm9yIC0gMTA0OlwiLCB0eFN0ciwgZSlcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bGlzdCxcblx0XHRcdHR4V2l0aE1pc3NpbmdWZXJzaW9uOmlkc1xuXHRcdH1cblx0fVxuXHRhc3luYyByZXN0b3JlKCl7XG5cdFx0aWYodGhpcy5pZGIpe1xuXHRcdFx0bGV0IHtsaXN0fSA9IGF3YWl0IHRoaXMuZ2V0REJFbnRyaWVzKCk7XG5cblx0XHRcdGxpc3Quc29ydCgoYSwgYik9Pntcblx0XHRcdFx0cmV0dXJuIGEudHMtYi50cztcblx0XHRcdH0pLm1hcChvPT57XG5cdFx0XHRcdHRoaXMuYWRkKG8sIHRydWUpXG5cdFx0XHR9KVxuXHRcdH1cblx0fVxufVxuIl19